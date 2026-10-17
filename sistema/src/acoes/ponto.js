// Ações do ponto. O pesquisador liga, pausa, corrige e lança o próprio ponto (a correção guarda a hora original,
// e o dono vê). O dono marca a semana como paga e muda o valor da hora (vale a partir do dia da mudança).
import { acao, Recusa, hojeBR } from '../acoes.js';

const ehMomento = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s)) && /^\d{4}-\d{2}-\d{2}T/.test(s);
const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const inteiro = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const ISO = (s) => new Date(s).toISOString();

async function proximoId(db) { const { id } = await db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM ponto').first(); return id + 1; }
// confere um intervalo digitado: o fim depois do começo e nunca no futuro
function intervalo(inicio, fim, quando) {
  if (!ehMomento(inicio) || !ehMomento(fim)) throw new Recusa('Hora inválida');
  if (Date.parse(fim) <= Date.parse(inicio)) throw new Recusa('A hora que parou precisa ser depois da hora que começou');
  if (Date.parse(fim) > Date.parse(quando) + 60e3) throw new Recusa('A hora que parou não pode ser depois de agora');
  if (Date.parse(fim) - Date.parse(inicio) > 24 * 3600e3) throw new Recusa('Mais de 24h seguidas; divida em dias');
  return [ISO(inicio), ISO(fim)];
}

acao('ponto.iniciar', ['pesquisa'], async ({ db, usuario, quando }) => {
  const ligado = await db.prepare('SELECT id FROM ponto WHERE email = ? AND fim IS NULL').bind(usuario.email).first();
  if (ligado) return { resultado: { id: ligado.id } };
  const id = await proximoId(db);
  return { resultado: { id }, comandos: [db.prepare('INSERT INTO ponto (id, email, inicio) VALUES (?, ?, ?)').bind(id, usuario.email, quando)], eventos: [{ entidade: 'ponto', id, texto: 'Ligou o cronômetro' }] };
});

acao('ponto.pausar', ['pesquisa'], async ({ db, usuario, quando }) => {
  const t = await db.prepare('SELECT id FROM ponto WHERE email = ? AND fim IS NULL').bind(usuario.email).first();
  if (!t) return { resultado: null };
  return { resultado: { id: t.id }, comandos: [db.prepare('UPDATE ponto SET fim = ? WHERE id = ?').bind(quando, t.id)], eventos: [{ entidade: 'ponto', id: t.id, texto: 'Pausou o cronômetro' }] };
});

acao('ponto.corrigir', ['pesquisa'], async ({ db, usuario, quando }, { id, inicio, fim }) => {
  const t = Number.isInteger(id) ? await db.prepare('SELECT * FROM ponto WHERE id = ? AND email = ?').bind(id, usuario.email).first() : null;
  if (!t) throw new Recusa('Trecho não encontrado', 404);
  const [ini, f] = intervalo(inicio, fim, quando);
  // a primeira correção guarda como estava; trecho lançado à mão não tem "original"
  const guardar = !t.manual && !t.original_inicio;
  return {
    resultado: { id },
    comandos: [db.prepare(`UPDATE ponto SET inicio = ?, fim = ?, corrigido_em = ?${guardar ? ', original_inicio = ?, original_fim = ?' : ''} WHERE id = ?`)
      .bind(...[ini, f, quando, ...(guardar ? [t.inicio, t.fim] : []), id])],
    eventos: [{ entidade: 'ponto', id, texto: 'Corrigiu um trecho do ponto', antes: { inicio: t.inicio, fim: t.fim }, depois: { inicio: ini, fim: f } }],
  };
});

acao('ponto.lancar', ['pesquisa'], async ({ db, usuario, quando }, { inicio, fim }) => {
  const [ini, f] = intervalo(inicio, fim, quando);
  const id = await proximoId(db);
  return {
    resultado: { id },
    comandos: [db.prepare('INSERT INTO ponto (id, email, inicio, fim, manual, corrigido_em) VALUES (?, ?, ?, ?, 1, ?)').bind(id, usuario.email, ini, f, quando)],
    eventos: [{ entidade: 'ponto', id, texto: 'Lançou horas esquecidas', depois: { inicio: ini, fim: f } }],
  };
});

const daEquipe = async (db, email) => {
  const u = await db.prepare("SELECT nome FROM usuarios WHERE email = ? AND (papel = 'pesquisador' OR pesquisa = 1)").bind(email).first();
  if (!u) throw new Recusa('Essa pessoa não está no ponto');
  return u;
};

acao('ponto.pagar', ['dono'], async ({ db }, { email, semana, valor, data }) => {
  const u = await daEquipe(db, email);
  if (!ehData(semana) || new Date(semana + 'T12:00:00Z').getUTCDay() !== 1) throw new Recusa('Semana inválida');
  if (!inteiro(valor, 1, 100_000_000) || !ehData(data)) throw new Recusa('Valor ou data inválidos');
  return {
    resultado: { ok: true },
    comandos: [db.prepare('INSERT INTO pagamentos_semana (email, semana, valor, data) VALUES (?, ?, ?, ?) ON CONFLICT(email, semana) DO UPDATE SET valor = excluded.valor, data = excluded.data').bind(email, semana, valor, data)],
    eventos: [{ entidade: 'ponto', id: email, texto: `Pagou a semana de ${semana} pra ${u.nome}`, depois: { valor, data } }],
  };
});

acao('ponto.despagar', ['dono'], async ({ db }, { email, semana }) => {
  const p = await db.prepare('SELECT * FROM pagamentos_semana WHERE email = ? AND semana = ?').bind(email, semana).first();
  if (!p) throw new Recusa('Pagamento não encontrado', 404);
  return { resultado: { ok: true }, comandos: [db.prepare('DELETE FROM pagamentos_semana WHERE email = ? AND semana = ?').bind(email, semana)], eventos: [{ entidade: 'ponto', id: email, texto: `Desfez o pagamento da semana de ${semana}`, antes: p }] };
});

acao('ponto.valorHora', ['dono'], async ({ db }, { email, valor }) => {
  const u = await daEquipe(db, email);
  if (!inteiro(valor, 1, 1_000_000)) throw new Recusa('Valor da hora inválido');
  const hoje = hojeBR();
  return {
    resultado: { desde: hoje },
    comandos: [db.prepare('INSERT INTO valores_hora (email, desde, valor) VALUES (?, ?, ?) ON CONFLICT(email, desde) DO UPDATE SET valor = excluded.valor').bind(email, hoje, valor)],
    eventos: [{ entidade: 'ponto', id: email, texto: `Valor da hora de ${u.nome}: R$ ${(valor / 100).toFixed(2).replace('.', ',')}` }],
  };
});

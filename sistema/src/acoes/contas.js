// Ações das contas de pontos. O saldo nunca é digitado: é a soma das entradas menos as saídas.
// Cada entrada é um lote com vencimento e guarda quanto ainda resta; as saídas gastam primeiro o que vence antes.
import { acao, Recusa, hojeBR } from '../acoes.js';
import { contasCompletas } from '../contas.js';
import { cpfValido } from './pessoas.js';

const ENTRADAS = ['clube', 'compra', 'transferencia', 'cartao', 'bonus', 'estorno', 'inicial'];
const COM_CUSTO = ['clube', 'compra', 'transferencia'];
const SAIDAS = ['transferencia', 'expiracao', 'ajuste'];
const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const inteiro = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const pts = (n) => n.toLocaleString('pt-BR');
const somaMeses = (dia, n) => { const d = new Date(dia + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

// próximo id de uma tabela, já contando os que este lote vai criar
async function proximos(db, tabela) {
  const { id } = await db.prepare(`SELECT COALESCE(MAX(id), 0) AS id FROM ${tabela}`).first();
  let n = id;
  return () => ++n;
}

// confere e monta uma entrada (lote). l: { conta, tipo, data, pontos, custo, vence, origem, bonus_pct, obs }
function validarEntrada(l) {
  if (!ENTRADAS.includes(l.tipo)) throw new Recusa('Tipo de entrada inválido');
  if (!ehData(l.data)) throw new Recusa('Data inválida');
  if (!inteiro(l.pontos, 1, 100_000_000)) throw new Recusa('Pontos inválidos');
  const custo = COM_CUSTO.includes(l.tipo) ? (l.custo ?? 0) : 0;
  if (!inteiro(custo, 0, 100_000_000)) throw new Recusa('Custo inválido');
  const vence = l.vence && ehData(l.vence) ? l.vence : somaMeses(l.data, 24);
  const bonus = l.tipo === 'transferencia' && l.bonus_pct != null ? l.bonus_pct : null;
  if (bonus != null && !inteiro(bonus, 0, 1000)) throw new Recusa('Bônus inválido');
  return { tipo: l.tipo, data: l.data, pontos: l.pontos, custo, vence, bonus, origem: l.tipo === 'transferencia' ? String(l.origem || '').slice(0, 40) || null : null, obs: String(l.obs || '').trim().slice(0, 300) };
}
const insertEntrada = (db, id, contaId, e, quando, email, parId = null) => db.prepare(`INSERT INTO movimentos
  (id, conta_id, lado, tipo, data, pontos, custo, vence, resta, bonus_pct, origem, par_id, obs, criado_em, criado_por)
  VALUES (?, ?, 'entrada', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, contaId, e.tipo, e.data, e.pontos, e.custo, e.vence, e.pontos, e.bonus, e.origem, parId, e.obs, quando, email);

// uma ou várias entradas de uma vez (ex.: todos os clubes do mês)
acao('mov.entradas', ['dono'], async ({ db, env, usuario, quando }, { linhas }) => {
  if (!Array.isArray(linhas) || !linhas.length || linhas.length > 200) throw new Recusa('Nenhuma entrada pra registrar');
  const ids = [...new Set(linhas.map((l) => l.conta))];
  if (!ids.every(Number.isInteger)) throw new Recusa('Conta inválida');
  const contas = await contasCompletas(env, { ids });
  if (contas.length !== ids.length) throw new Recusa('Conta não encontrada');
  const novoId = await proximos(db, 'movimentos');
  const comandos = [], eventos = [];
  linhas.forEach((l) => {
    const e = validarEntrada(l), c = contas.find((x) => x.id === l.conta), id = novoId();
    comandos.push(insertEntrada(db, id, c.id, e, quando, usuario.email));
    eventos.push({ entidade: 'conta', id: c.id, texto: `Entrada: +${pts(e.pontos)} pts (${e.tipo})`, depois: e });
  });
  return { resultado: { n: linhas.length }, comandos, eventos };
});

// gasta pontos dos lotes, do que vence antes pro que vence depois (ou de um lote escolhido, na expiração).
// Devolve os comandos e o custo proporcional dos pontos gastos (vai junto numa transferência).
function gastar(db, conta, pontos, loteId) {
  const lotes = loteId ? [...conta.lotes.filter((l) => l.id === loteId), ...conta.lotes.filter((l) => l.id !== loteId)] : conta.lotes;
  let falta = pontos;
  const usos = [];
  for (const l of lotes) { if (falta <= 0) break; const usa = Math.min(l.resta, falta); falta -= usa; usos.push({ id: l.id, usa }); }
  return { comandos: usos.map((u) => db.prepare('UPDATE movimentos SET resta = resta - ? WHERE id = ?').bind(u.usa, u.id)), usos };
}

// saída: transferência (vira entrada na conta de destino), expiração ou ajuste. A emissão nasce no atendimento.
acao('mov.saida', ['dono'], async ({ db, env, usuario, quando }, d) => {
  if (!SAIDAS.includes(d.tipo)) throw new Recusa('Tipo de saída inválido');
  if (!inteiro(d.pontos, 1, 100_000_000)) throw new Recusa('Pontos inválidos');
  const data = d.data && ehData(d.data) ? d.data : hojeBR();
  const ids = [d.conta, ...(d.tipo === 'transferencia' ? [d.destino] : [])];
  if (!ids.every(Number.isInteger)) throw new Recusa('Conta inválida');
  if (d.tipo === 'transferencia' && d.destino === d.conta) throw new Recusa('Escolha outra conta de destino');
  const contas = await contasCompletas(env, { ids });
  const c = contas.find((x) => x.id === d.conta), dest = contas.find((x) => x.id === d.destino);
  if (!c || (d.tipo === 'transferencia' && !dest)) throw new Recusa('Conta não encontrada');
  if (dest && dest.programa_id === 'livelo') throw new Recusa('A Livelo só envia pontos; não recebe');

  const novoId = await proximos(db, 'movimentos');
  const saidaId = novoId();
  const g = gastar(db, c, d.pontos, Number.isInteger(d.lote) ? d.lote : null);
  const obs = String(d.obs || '').trim().slice(0, 300);
  const comandos = [...g.comandos];
  const eventos = [];
  if (d.tipo === 'transferencia') {
    const bonus = d.bonus_pct ?? 0;
    if (!inteiro(bonus, 0, 1000)) throw new Recusa('Bônus inválido');
    const chegam = Math.round(d.pontos * (1 + bonus / 100));
    // o custo dos pontos que saíram vai junto pro lote novo (assim o custo real da conta de destino fica certo)
    const custosLotes = g.usos.length ? (await db.prepare(`SELECT id, custo, pontos FROM movimentos WHERE id IN (${g.usos.map(() => '?').join(',')})`).bind(...g.usos.map((u) => u.id)).all()).results : [];
    const custo = Math.round(g.usos.reduce((s, u) => { const l = custosLotes.find((x) => x.id === u.id); return s + (l && l.pontos ? u.usa * l.custo / l.pontos : 0); }, 0)) + (d.custo_extra ?? 0);
    const entradaId = novoId();
    // as duas pontas se apontam (par_id); a saída nasce sem o par e ganha depois que a entrada existe
    comandos.unshift(db.prepare(`INSERT INTO movimentos (id, conta_id, lado, tipo, data, pontos, obs, criado_em, criado_por)
      VALUES (?, ?, 'saida', 'transferencia', ?, ?, ?, ?, ?)`).bind(saidaId, c.id, data, d.pontos, obs, quando, usuario.email));
    comandos.push(insertEntrada(db, entradaId, dest.id, { tipo: 'transferencia', data, pontos: chegam, custo, vence: d.vence && ehData(d.vence) ? d.vence : somaMeses(data, 24), bonus, origem: c.programa, obs }, quando, usuario.email, saidaId));
    comandos.push(db.prepare('UPDATE movimentos SET par_id = ? WHERE id = ?').bind(entradaId, saidaId));
    eventos.push({ entidade: 'conta', id: c.id, texto: `Transferiu ${pts(d.pontos)} pts pra ${dest.programa} de ${dest.titular}` });
    eventos.push({ entidade: 'conta', id: dest.id, texto: `Recebeu ${pts(chegam)} pts da ${c.programa} de ${c.titular}${bonus ? ` (bônus de ${bonus}%)` : ''}` });
    return { resultado: { id: saidaId, chegam }, comandos, eventos };
  }
  comandos.unshift(db.prepare(`INSERT INTO movimentos (id, conta_id, lado, tipo, data, pontos, obs, criado_em, criado_por)
    VALUES (?, ?, 'saida', ?, ?, ?, ?, ?, ?)`).bind(saidaId, c.id, d.tipo, data, d.pontos, obs, quando, usuario.email));
  eventos.push({ entidade: 'conta', id: c.id, texto: `${d.tipo === 'expiracao' ? 'Expiraram' : 'Ajuste:'} −${pts(d.pontos)} pts${obs ? ` (${obs})` : ''}` });
  return { resultado: { id: saidaId }, comandos, eventos };
});

// acha a pessoa pelo CPF ou cadastra (cadastro único). Devolve { id, comandos }
async function pessoaPorCpf(db, nome, cpf, quando) {
  cpf = soDigitos(cpf);
  if (!cpfValido(cpf)) throw new Recusa('CPF inválido; confira os números');
  const ja = await db.prepare('SELECT id FROM pessoas WHERE cpf = ?').bind(cpf).first();
  if (ja) return { id: ja.id, comandos: [] };
  nome = String(nome || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (nome.split(' ').length < 2) throw new Recusa('Falta o nome completo');
  const { id: ult } = await db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM pessoas').first();
  return { id: ult + 1, nome, comandos: [db.prepare('INSERT INTO pessoas (id, nome, cpf, criada_em) VALUES (?, ?, ?, ?)').bind(ult + 1, nome, cpf, quando)] };
}

// beneficiário registrado à mão: CPF que já voou antes do sistema, ou cadastrado direto no programa
acao('benef.adicionar', ['dono'], async ({ db, quando }, { conta, pessoa, nome, cpf, data }) => {
  const c = Number.isInteger(conta) ? await db.prepare('SELECT id, titular_id FROM contas WHERE id = ?').bind(conta).first() : null;
  if (!c) throw new Recusa('Conta não encontrada', 404);
  if (!ehData(data)) throw new Recusa('Data inválida');
  const p = Number.isInteger(pessoa) ? { id: pessoa, comandos: [] } : await pessoaPorCpf(db, nome, cpf, quando);
  if (p.id === c.titular_id) throw new Recusa('O titular não conta como beneficiário');
  return {
    resultado: { pessoa: p.id },
    comandos: [...p.comandos, db.prepare('INSERT INTO beneficiarios_manuais (conta_id, pessoa_id, data) VALUES (?, ?, ?) ON CONFLICT(conta_id, pessoa_id) DO UPDATE SET data = excluded.data').bind(c.id, p.id, data)],
    eventos: [{ entidade: 'conta', id: c.id, texto: `Registrou beneficiário à mão${p.nome ? `: ${p.nome}` : ''}` }],
  };
});

// conta nova: titular do cadastro (ou novo, pelo CPF), programa, clube e o saldo de hoje (vira o primeiro lote)
acao('conta.criar', ['dono'], async ({ db, usuario, quando }, d) => {
  const prog = await db.prepare('SELECT id, nome FROM programas WHERE id = ?').bind(d.programa).first();
  if (!prog) throw new Recusa('Programa inválido');
  const t = Number.isInteger(d.titular) ? { id: d.titular, comandos: [] } : await pessoaPorCpf(db, d.titular?.nome, d.titular?.cpf, quando);
  if (Number.isInteger(d.titular) && !(await db.prepare('SELECT 1 FROM pessoas WHERE id = ?').bind(d.titular).first())) throw new Recusa('Titular não encontrado');
  const ja = await db.prepare('SELECT 1 FROM contas WHERE titular_id = ? AND programa_id = ?').bind(t.id, prog.id).first();
  if (ja) throw new Recusa('Esse titular já tem conta nesse programa', 409);
  let categoria = null;
  if (prog.id === 'azul') {
    const cat = await db.prepare("SELECT nome FROM categorias WHERE programa_id = 'azul' AND nome = ?").bind(d.categoria || 'Básico').first();
    if (!cat) throw new Recusa('Categoria inválida');
    categoria = cat.nome;
  }
  const clube = prog.id !== 'livelo' && d.clube != null ? d.clube : null;
  if (clube != null && !inteiro(clube, 1, 1_000_000)) throw new Recusa('Pontos do clube inválidos');
  const clubeCusto = clube != null && d.clube_custo != null ? d.clube_custo : null;
  if (clubeCusto != null && !inteiro(clubeCusto, 0, 10_000_000)) throw new Recusa('Mensalidade inválida');
  const saldo = d.saldo ?? 0;
  if (!inteiro(saldo, 0, 100_000_000)) throw new Recusa('Saldo inválido');
  const { id: ult } = await db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM contas').first();
  const id = ult + 1;
  const comandos = [...t.comandos, db.prepare(`INSERT INTO contas (id, titular_id, programa_id, clube, clube_custo, categoria, numero, criada_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, t.id, prog.id, clube, clubeCusto, categoria, String(d.numero || '').trim().slice(0, 40) || null, quando)];
  if (saldo) {
    const hoje = hojeBR(), novoId = await proximos(db, 'movimentos');
    comandos.push(insertEntrada(db, novoId(), id, { tipo: 'inicial', data: hoje, pontos: saldo, custo: 0, vence: d.vence && ehData(d.vence) ? d.vence : somaMeses(hoje, 24), bonus: null, origem: null, obs: 'Saldo do sistema antigo' }, quando, usuario.email));
  }
  return { resultado: { id }, comandos, eventos: [{ entidade: 'conta', id, texto: `Criou a conta ${prog.nome}${saldo ? ` com ${pts(saldo)} pts` : ''}` }] };
});

// altera clube, categoria, número ou desativa
acao('conta.editar', ['dono'], async ({ db }, d) => {
  const c = Number.isInteger(d.id) ? await db.prepare('SELECT * FROM contas WHERE id = ?').bind(d.id).first() : null;
  if (!c) throw new Recusa('Conta não encontrada', 404);
  const clube = c.programa_id !== 'livelo' && d.clube != null ? d.clube : null;
  if (clube != null && !inteiro(clube, 1, 1_000_000)) throw new Recusa('Pontos do clube inválidos');
  const clubeCusto = clube != null && d.clube_custo != null ? d.clube_custo : null;
  let categoria = c.categoria;
  if (c.programa_id === 'azul' && d.categoria) {
    const cat = await db.prepare("SELECT nome FROM categorias WHERE programa_id = 'azul' AND nome = ?").bind(d.categoria).first();
    if (!cat) throw new Recusa('Categoria inválida');
    categoria = cat.nome;
  }
  const depois = { clube, clube_custo: clubeCusto, categoria, numero: String(d.numero || '').trim().slice(0, 40) || null, ativa: d.ativa === false ? 0 : 1 };
  return {
    resultado: { id: c.id },
    comandos: [db.prepare('UPDATE contas SET clube = ?, clube_custo = ?, categoria = ?, numero = ?, ativa = ? WHERE id = ?').bind(...Object.values(depois), c.id)],
    eventos: [{ entidade: 'conta', id: c.id, texto: 'Alterou os dados da conta', antes: c, depois }],
  };
});

// configurações dos programas: valor da milha (milionésimos), limite de CPFs e como as vagas voltam; níveis da Azul
const REGRAS = { ano: 'zera em 1º de janeiro', janela: 'cada um libera a vaga 12 meses após a emissão', manual: 'troca manual com 30 dias de carência' };
acao('config.programas', ['dono'], async ({ db }, { programas = [], niveis = {} }) => {
  const atuais = (await db.prepare('SELECT * FROM programas').all()).results;
  const comandos = [], eventos = [];
  for (const p of programas) {
    const a = atuais.find((x) => x.id === p.id);
    if (!a || a.regra === 'nenhuma') throw new Recusa('Programa inválido');
    if (!inteiro(p.valor_milha, 1, 1_000_000)) throw new Recusa('Valor da milha inválido');
    if (!inteiro(p.limite, 1, 100)) throw new Recusa('Limite de CPFs inválido');
    if (!REGRAS[p.regra]) throw new Recusa('Regra inválida');
    if (a.valor_milha === p.valor_milha && a.limite === p.limite && a.regra === p.regra) continue;
    const renovacao = p.id === 'azul' ? `${p.limite} a 8 CPFs conforme a categoria; ${REGRAS[p.regra]}` : `${p.limite} CPFs; ${REGRAS[p.regra]}`;
    comandos.push(db.prepare('UPDATE programas SET valor_milha = ?, limite = ?, regra = ?, renovacao = ? WHERE id = ?').bind(p.valor_milha, p.limite, p.regra, renovacao, p.id));
    eventos.push({ entidade: 'programa', id: p.id, texto: `Configurações de ${a.nome}`, antes: { valor_milha: a.valor_milha, limite: a.limite, regra: a.regra }, depois: p });
  }
  for (const [nome, limite] of Object.entries(niveis)) {
    if (!inteiro(limite, 1, 100)) throw new Recusa('Limite do nível inválido');
    comandos.push(db.prepare("UPDATE categorias SET limite = ? WHERE programa_id = 'azul' AND nome = ?").bind(limite, nome));
  }
  if (Object.keys(niveis).length) eventos.push({ entidade: 'programa', id: 'azul', texto: 'Níveis da Azul', depois: niveis });
  return { resultado: { ok: true }, comandos, eventos };
});

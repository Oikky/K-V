// Emissão: um registro por voo da combinação aceita. Em pontos, a saída entra sozinha na conta escolhida,
// gastando primeiro os lotes que vencem antes, e os passageiros passam a contar como beneficiários dela.
// Com todos os voos emitidos, o orçamento vai pra Emitido.
// Tudo tem volta: corrigir (localizador, data, observação), desfazer ("lancei errado": some tudo e os pontos voltam
// pros mesmos lotes) e cancelar ("a passagem foi cancelada": os pontos que o programa devolveu entram como estorno).
import { acao, Recusa, hojeBR } from '../acoes.js';
import { SITES } from './pesquisa.js';
import { contasCompletas } from '../contas.js';
import { gastar, devolver, proximos } from '../pontos.js';
import { OBS_MAX } from './contas.js';
import { cartaoValido } from './cartoes.js';

const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const inteiro = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const pts = (n) => n.toLocaleString('pt-BR');
const somaMeses = (dia, n) => { const d = new Date(dia + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const limparLoc = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const resumoSaida = (o, t, loc) => `#${o.id} ${t.de} → ${t.para} (${loc})`;

acao('emi.registrar', ['dono'], async (ctx, d) => {
  const { db, env, usuario, quando } = ctx;
  const o = Number.isInteger(d.orcamento) ? await db.prepare('SELECT * FROM orcamentos WHERE id = ?').bind(d.orcamento).first() : null;
  if (!o) throw new Recusa('Orçamento não encontrado', 404);
  if (o.etapa !== 'fechado') throw new Recusa(o.etapa === 'emitido' ? 'Tudo já foi emitido' : 'Feche o orçamento antes de emitir', 409);
  const trechos = (await db.prepare('SELECT ordem, de, para FROM trechos WHERE orcamento_id = ? ORDER BY ordem').bind(o.id).all()).results;
  const t = trechos.find((x) => x.ordem === d.trecho);
  if (!t) throw new Recusa('Trecho inválido');
  const combo = await db.prepare('SELECT escolha FROM combos WHERE id = ?').bind(o.combo_aceita).first();
  if (!combo) throw new Recusa('Falta a combinação aceita');
  const op = await db.prepare('SELECT * FROM opcoes WHERE id = ?').bind(JSON.parse(combo.escolha)[d.trecho]).first();
  const loc = limparLoc(d.localizador);
  if (loc.length < 5 || loc.length > 8) throw new Recusa('Localizador inválido');
  const ja = await db.prepare('SELECT localizador FROM emissoes WHERE orcamento_id = ? AND trecho = ?').bind(o.id, d.trecho).first();
  if (ja) throw new Recusa(`Esse voo já foi emitido (${ja.localizador})`, 409);
  const pax = (await db.prepare('SELECT pessoa_id FROM orcamento_passageiros WHERE orcamento_id = ? ORDER BY ordem').bind(o.id).all()).results.map((p) => p.pessoa_id);
  const obs = String(d.obs || '').trim().slice(0, OBS_MAX);
  // o que foi pago no cartão da K&V (taxa, ou a passagem em dinheiro)
  const cartao = await cartaoValido(db, d.cartao);
  const pago = cartao != null ? (d.pago ?? 0) : 0;
  if (!inteiro(pago, 0, 100_000_000)) throw new Recusa('Valor pago no cartão inválido');

  const programa = SITES[op.site];
  const pagantes = o.adultos + o.criancas;
  let conta = null, pontos = null;
  const comandos = [];
  const { id: ultE } = await db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM emissoes').first();
  const emissaoId = ultE + 1;
  if (programa) {
    [conta] = Number.isInteger(d.conta) ? await contasCompletas(env, { ids: [d.conta] }) : [];
    if (!conta) throw new Recusa('Escolha de qual conta saem os pontos');
    if (conta.programa_id !== programa) throw new Recusa('Essa conta é de outro programa');
    pontos = op.milhas * pagantes;
    if (conta.saldo < pontos) throw new Recusa(`A conta só tem ${pts(conta.saldo)} pts; precisa de ${pts(pontos)}`, 409);
    const saidaId = (await proximos(db, 'movimentos'))();
    comandos.push(db.prepare(`INSERT INTO movimentos (id, conta_id, lado, tipo, data, pontos, emissao_id, obs, criado_em, criado_por)
      VALUES (?, ?, 'saida', 'emissao', ?, ?, ?, ?, ?, ?)`).bind(saidaId, conta.id, hojeBR(), pontos, emissaoId, [resumoSaida(o, t, loc), obs].filter(Boolean).join('\n'), quando, usuario.email));
    // gasta primeiro o que vence antes, anotando de qual lote saiu (pra poder desfazer)
    comandos.push(...gastar(db, conta, pontos, saidaId).comandos);
  }
  // a emissão vem antes da saída (a saída aponta pra ela)
  comandos.unshift(
    db.prepare('INSERT INTO emissoes (id, orcamento_id, trecho, conta_id, pontos, localizador, obs, cartao_id, pago, em, por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(emissaoId, o.id, d.trecho, conta ? conta.id : null, pontos, loc, obs, cartao, pago, quando, usuario.email),
    ...pax.map((p) => db.prepare('INSERT INTO emissao_passageiros (emissao_id, pessoa_id) VALUES (?, ?)').bind(emissaoId, p)),
  );
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM emissoes WHERE orcamento_id = ?').bind(o.id).first();
  const tudo = n + 1 === trechos.length;
  if (tudo) comandos.push(db.prepare("UPDATE orcamentos SET etapa = 'emitido' WHERE id = ?").bind(o.id));
  const eventos = [{ entidade: 'orcamento', id: o.id, texto: `Emitiu ${t.de} → ${t.para} (${loc})${conta ? ` pela conta de ${conta.titular}` : ''}` }];
  if (conta) eventos.push({ entidade: 'conta', id: conta.id, texto: `Emissão #${o.id} ${t.de} → ${t.para}: −${pts(pontos)} pts` });
  if (tudo) eventos.push({ entidade: 'orcamento', id: o.id, texto: 'Tudo emitido' });
  return { resultado: { id: emissaoId, tudo }, comandos, eventos };
});

// a emissão com o orçamento, o trecho e a saída de pontos
async function carregar(db, id) {
  const e = Number.isInteger(id) ? await db.prepare('SELECT * FROM emissoes WHERE id = ?').bind(id).first() : null;
  if (!e) throw new Recusa('Emissão não encontrada (talvez já tenha sido desfeita)', 404);
  const o = await db.prepare('SELECT * FROM orcamentos WHERE id = ?').bind(e.orcamento_id).first();
  const t = await db.prepare('SELECT ordem, de, para FROM trechos WHERE orcamento_id = ? AND ordem = ?').bind(o.id, e.trecho).first();
  const saida = await db.prepare("SELECT * FROM movimentos WHERE emissao_id = ? AND lado = 'saida'").bind(e.id).first();
  return { e, o, t: t || { de: '?', para: '?' }, saida };
}

// corrige o que foi digitado: localizador, data da emissão e observação. Conta e pontos se corrigem desfazendo.
acao('emi.corrigir', ['dono'], async ({ db }, d) => {
  const { e, o, t, saida } = await carregar(db, d.id);
  const loc = d.localizador != null ? limparLoc(d.localizador) : e.localizador;
  if (loc.length < 5 || loc.length > 8) throw new Recusa('Localizador inválido: são de 5 a 8 letras e números');
  const obs = d.obs != null ? String(d.obs).trim().slice(0, OBS_MAX) : e.obs;
  if (d.data != null && !ehData(d.data)) throw new Recusa('Data inválida');
  const cartao = d.cartao !== undefined ? await cartaoValido(db, d.cartao) : e.cartao_id;
  const pago = cartao == null ? 0 : d.pago ?? e.pago;
  if (!inteiro(pago, 0, 100_000_000)) throw new Recusa('Valor pago no cartão inválido');
  const comandos = [db.prepare('UPDATE emissoes SET localizador = ?, obs = ?, cartao_id = ?, pago = ? WHERE id = ?').bind(loc, obs, cartao, pago, e.id)];
  if (saida) {
    // a saída na conta leva o localizador e a observação no texto
    comandos.push(db.prepare('UPDATE movimentos SET obs = ?, data = ? WHERE id = ?').bind([resumoSaida(o, t, loc), obs].filter(Boolean).join('\n'), d.data || saida.data, saida.id));
  }
  const mudou = [loc !== e.localizador && `localizador ${e.localizador} → ${loc}`, obs !== e.obs && 'observação', (cartao !== e.cartao_id || pago !== e.pago) && 'cartão', saida && d.data && d.data !== saida.data && 'data'].filter(Boolean);
  return {
    resultado: { id: e.id },
    comandos,
    eventos: mudou.length ? [{ entidade: 'orcamento', id: o.id, texto: `Corrigiu a emissão ${t.de} → ${t.para}: ${mudou.join(', ')}`, antes: { localizador: e.localizador, obs: e.obs, data: saida && saida.data, cartao: e.cartao_id, pago: e.pago } }] : [],
  };
});

// "lancei errado": a emissão some, os pontos voltam pros lotes de onde saíram, os passageiros deixam de ocupar vaga
// por ela e o orçamento volta pra Fechado (dá pra emitir de novo).
acao('emi.desfazer', ['dono'], async ({ db }, { id }) => {
  const { e, o, t, saida } = await carregar(db, id);
  if (e.cancelada) throw new Recusa('Essa passagem já foi registrada como cancelada', 409);
  const comandos = [];
  if (saida) comandos.push(...(await devolver(db, saida)), db.prepare('DELETE FROM consumos WHERE saida_id = ?').bind(saida.id), db.prepare('DELETE FROM movimentos WHERE id = ?').bind(saida.id));
  comandos.push(
    db.prepare('DELETE FROM emissao_passageiros WHERE emissao_id = ?').bind(e.id),
    db.prepare('DELETE FROM emissoes WHERE id = ?').bind(e.id),
  );
  if (o.etapa === 'emitido') comandos.push(db.prepare("UPDATE orcamentos SET etapa = 'fechado' WHERE id = ?").bind(o.id));
  const eventos = [{ entidade: 'orcamento', id: o.id, texto: `Desfez a emissão ${t.de} → ${t.para} (${e.localizador})`, antes: { emissao: e, saida } }];
  if (saida) eventos.push({ entidade: 'conta', id: saida.conta_id, texto: `Emissão #${o.id} ${t.de} → ${t.para} desfeita: +${pts(saida.pontos)} pts voltaram` });
  return { resultado: { orcamento: o.id, trecho: e.trecho }, comandos, eventos };
});

// "a passagem foi cancelada no programa": a emissão fica no histórico como cancelada. Os pontos que o programa
// devolveu entram como estorno (pode ser menos que o gasto, ou nada). O CPF pode continuar ocupando a vaga.
// Quanto a K&V devolveu ao cliente fica anotado. Com todos os voos cancelados, o orçamento vai pra Cancelado.
acao('emi.cancelar', ['dono'], async ({ db, usuario, quando }, d) => {
  const { e, o, t, saida } = await carregar(db, d.id);
  if (e.cancelada) throw new Recusa('Essa passagem já foi registrada como cancelada', 409);
  const estorno = d.estorno ?? 0, devolvido = d.devolvido ?? 0;
  if (!inteiro(estorno, 0, 100_000_000)) throw new Recusa('Pontos devolvidos inválidos');
  if (saida && estorno > saida.pontos) throw new Recusa(`Saíram só ${pts(saida.pontos)} pts nessa emissão`);
  if (!inteiro(devolvido, 0, 1_000_000_00)) throw new Recusa('Valor devolvido ao cliente inválido');
  const obs = String(d.obs || '').trim().slice(0, OBS_MAX);
  const hoje = hojeBR();
  const comandos = [db.prepare('UPDATE emissoes SET cancelada = 1, devolvido = ?, cancelada_em = ?, cancelada_obs = ? WHERE id = ?').bind(devolvido, quando, obs, e.id)];
  if (saida && estorno) {
    const novoId = await proximos(db, 'movimentos');
    comandos.push(db.prepare(`INSERT INTO movimentos (id, conta_id, lado, tipo, data, pontos, custo, vence, resta, emissao_id, obs, criado_em, criado_por)
      VALUES (?, ?, 'entrada', 'estorno', ?, ?, 0, ?, ?, ?, ?, ?, ?)`).bind(novoId(), saida.conta_id, hoje, estorno, somaMeses(hoje, 24), estorno, e.id,
      [`Cancelamento #${o.id} ${t.de} → ${t.para} (${e.localizador})`, obs].filter(Boolean).join('\n'), quando, usuario.email));
  }
  // o CPF continua ocupando a vaga: vira beneficiário registrado na data da emissão
  if (saida && d.manterCpf !== false) {
    const pax = (await db.prepare('SELECT pessoa_id FROM emissao_passageiros WHERE emissao_id = ?').bind(e.id).all()).results;
    const titular = (await db.prepare('SELECT titular_id FROM contas WHERE id = ?').bind(saida.conta_id).first()).titular_id;
    pax.filter((p) => p.pessoa_id !== titular).forEach((p) => comandos.push(db.prepare(`INSERT INTO beneficiarios_manuais (conta_id, pessoa_id, data) VALUES (?, ?, ?)
      ON CONFLICT(conta_id, pessoa_id) DO UPDATE SET data = MAX(data, excluded.data)`).bind(saida.conta_id, p.pessoa_id, saida.data)));
  }
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM emissoes WHERE orcamento_id = ? AND cancelada = 0 AND id <> ?').bind(o.id, e.id).first();
  if (!n) comandos.push(db.prepare("UPDATE orcamentos SET etapa = 'cancelado', antes_de_perder = ? WHERE id = ?").bind(o.etapa, o.id));
  const eventos = [{ entidade: 'orcamento', id: o.id, texto: `Passagem cancelada: ${t.de} → ${t.para} (${e.localizador})${devolvido ? `, devolveu R$ ${(devolvido / 100).toFixed(2).replace('.', ',')}` : ''}`, antes: { cancelada: 0 } }];
  if (saida && estorno) eventos.push({ entidade: 'conta', id: saida.conta_id, texto: `Estorno do cancelamento #${o.id}: +${pts(estorno)} pts` });
  return { resultado: { id: e.id, tudoCancelado: !n }, comandos, eventos };
});

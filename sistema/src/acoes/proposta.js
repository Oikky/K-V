// Ações da proposta: as combinações que vão pro cliente, enviar, desistiu e reabrir.
// Dinheiro em centavos; valor da milha em milionésimos de real (R$ 0,0160 = 16000).
import { acao, Recusa } from '../acoes.js';

const inteiro = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

async function orcamento(db, id) {
  const o = Number.isInteger(id) ? await db.prepare('SELECT * FROM orcamentos WHERE id = ?').bind(id).first() : null;
  if (!o) throw new Recusa('Orçamento não encontrado', 404);
  return o;
}

// grava a proposta inteira (de 1 a 3 combinações por roteiro). Combinação com id é alterada; sem id, criada; a que sumiu da lista, apagada.
// A tela manda isso sozinha, um instante depois de cada mudança.
acao('prop.salvar', ['dono'], async ({ db }, { orcamento: oid, combos }) => {
  const o = await orcamento(db, oid);
  if (!['pesquisado', 'enviado'].includes(o.etapa)) throw new Recusa('A proposta só muda antes de fechar', 409);
  // cada roteiro é uma lista de posições de trecho; a combinação escolhe um voo em cada trecho de UM roteiro (null nos outros)
  const roteiroDe = (await db.prepare('SELECT roteiro FROM trechos WHERE orcamento_id = ? ORDER BY ordem').bind(o.id).all()).results.map((t) => t.roteiro);
  const n = roteiroDe.length, nRot = Math.max(...roteiroDe) + 1;
  if (!Array.isArray(combos) || combos.length < 1 || combos.length > 3 * nRot) throw new Recusa(`A proposta tem de 1 a ${3 * nRot} combinações`);
  const opcoes = (await db.prepare('SELECT id, trecho FROM opcoes WHERE orcamento_id = ?').bind(o.id).all()).results;
  const trechoDa = Object.fromEntries(opcoes.map((x) => [x.id, x.trecho]));
  const atuais = (await db.prepare('SELECT id FROM combos WHERE orcamento_id = ?').bind(o.id).all()).results.map((c) => c.id);

  const limpos = combos.map((c, i) => {
    const nome = String(c.nome || '').trim().slice(0, 40) || `Opção ${i + 1}`;
    const r = Array.isArray(c.escolha) ? roteiroDe[c.escolha.findIndex((id) => id != null)] : undefined;
    if (r == null || c.escolha.length !== n || c.escolha.some((id, ti) => (roteiroDe[ti] === r ? trechoDa[id] !== ti : id != null))) throw new Recusa('Combinação com voo que não é deste orçamento');
    const milha = {};
    for (const [p, v] of Object.entries(c.milha || {})) { if (!inteiro(v, 1, 1_000_000)) throw new Recusa('Valor da milha inválido'); milha[p] = v; }
    if (c.livre != null && !inteiro(c.livre, 1, 1_000_000_00)) throw new Recusa('Preço inválido');
    if (c.parcelado != null && !inteiro(c.parcelado, 1, 1_000_000_00)) throw new Recusa('Preço parcelado inválido');
    if (!inteiro(c.vezes ?? 10, 2, 12)) throw new Recusa('Número de vezes inválido');
    if (c.id != null && !atuais.includes(c.id)) throw new Recusa('Combinação não encontrada; recarregue a página', 409);
    return { id: c.id ?? null, ordem: i, nome, escolha: JSON.stringify(c.escolha), milha: JSON.stringify(milha), livre: c.livre ?? null, parcelado: c.parcelado ?? null, vezes: c.vezes ?? 10 };
  });
  const fica = new Set(limpos.map((c) => c.id).filter((x) => x != null));
  const sai = atuais.filter((id) => !fica.has(id));
  if (o.combo_aceita && sai.includes(o.combo_aceita)) throw new Recusa('Essa combinação foi a aceita; não dá pra tirar', 409);

  const { id: ult } = await db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM combos').first();
  let prox = ult;
  limpos.forEach((c) => { if (c.id == null) { c.id = ++prox; c.nova = true; } });
  const comandos = [
    ...sai.map((id) => db.prepare('DELETE FROM combos WHERE id = ?').bind(id)),
    ...limpos.map((c) => (c.nova
      ? db.prepare('INSERT INTO combos (id, orcamento_id, ordem, nome, escolha, milha, livre, parcelado, vezes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(c.id, o.id, c.ordem, c.nome, c.escolha, c.milha, c.livre, c.parcelado, c.vezes)
      : db.prepare('UPDATE combos SET ordem = ?, nome = ?, escolha = ?, milha = ?, livre = ?, parcelado = ?, vezes = ? WHERE id = ?')
        .bind(c.ordem, c.nome, c.escolha, c.milha, c.livre, c.parcelado, c.vezes, c.id))),
  ];
  // o histórico não precisa de cada tecla: só registra quando muda o número de combinações
  const eventos = sai.length || limpos.some((c) => c.nova)
    ? [{ entidade: 'orcamento', id: o.id, texto: `Montou a proposta (${limpos.length} ${limpos.length > 1 ? 'combinações' : 'combinação'})` }] : [];
  return { resultado: { ids: limpos.map((c) => c.id) }, comandos, eventos };
});

acao('prop.enviar', ['dono'], async ({ db, quando }, { id }) => {
  const o = await orcamento(db, id);
  if (o.etapa !== 'pesquisado') throw new Recusa('A proposta já foi enviada', 409);
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM combos WHERE orcamento_id = ?').bind(id).first();
  if (!n) throw new Recusa('Monte pelo menos uma combinação antes');
  return {
    resultado: { id },
    comandos: [db.prepare("UPDATE orcamentos SET etapa = 'enviado', enviada_em = ? WHERE id = ?").bind(quando, id)],
    eventos: [{ entidade: 'orcamento', id, texto: `Enviou a proposta (${n} ${n > 1 ? 'opções' : 'opção'})`, antes: { etapa: o.etapa } }],
  };
});

// texto da mensagem mudado à mão (null volta pro automático)
acao('prop.mensagem', ['dono'], async ({ db }, { id, texto }) => {
  const o = await orcamento(db, id);
  const t = texto == null ? null : String(texto).slice(0, 8000).trim() || null;
  return { resultado: { id }, comandos: [db.prepare('UPDATE orcamentos SET mensagem = ? WHERE id = ?').bind(t, o.id)] };
});

acao('orc.perder', ['dono'], async ({ db }, { id, motivo }) => {
  const o = await orcamento(db, id);
  motivo = String(motivo || '').trim().slice(0, 200);
  if (!motivo) throw new Recusa('Falta o motivo');
  if (['perdido', 'cancelado', 'emitido'].includes(o.etapa)) throw new Recusa('Esse orçamento já está fechado de outro jeito', 409);
  return {
    resultado: { id },
    comandos: [db.prepare("UPDATE orcamentos SET antes_de_perder = ?, etapa = 'perdido', motivo = ? WHERE id = ?").bind(o.etapa, motivo, id)],
    eventos: [{ entidade: 'orcamento', id, texto: `Marcou como perdido: ${motivo}`, antes: { etapa: o.etapa } }],
  };
});

acao('orc.reabrir', ['dono'], async ({ db }, { id }) => {
  const o = await orcamento(db, id);
  if (o.etapa !== 'perdido') throw new Recusa('Só reabre orçamento perdido', 409);
  const volta = o.antes_de_perder || 'enviado';
  const nomes = { novo: 'Novo', pesquisa: 'Em pesquisa', pesquisado: 'Pesquisado', enviado: 'Enviado', fechado: 'Fechado' };
  return {
    resultado: { id, etapa: volta },
    comandos: [db.prepare('UPDATE orcamentos SET etapa = ?, antes_de_perder = NULL, motivo = NULL WHERE id = ?').bind(volta, id)],
    eventos: [{ entidade: 'orcamento', id, texto: `Voltou pra ${nomes[volta] || volta}`, antes: { etapa: o.etapa, motivo: o.motivo } }],
  };
});

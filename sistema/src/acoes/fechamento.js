// Fechamento: qual combinação a pessoa aceitou, quem paga, quem voa e o recebimento.
// A tela grava sozinha enquanto o dono mexe; "Fechar orçamento" manda o mesmo com fechar: true.
// Depois de fechado ainda dá pra completar passageiros e lançar o que foi recebido.
import { acao, Recusa } from '../acoes.js';

const FORMAS = ['pix', 'cartao', 'parcelado'];
const inteiro = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

acao('fech.salvar', ['dono'], async ({ db }, d) => {
  const o = Number.isInteger(d.id) ? await db.prepare('SELECT * FROM orcamentos WHERE id = ?').bind(d.id).first() : null;
  if (!o) throw new Recusa('Orçamento não encontrado', 404);
  if (!['pesquisado', 'enviado', 'fechado', 'emitido'].includes(o.etapa)) throw new Recusa('Esse orçamento não está pra fechar', 409);
  const fechar = !!d.fechar && ['pesquisado', 'enviado'].includes(o.etapa);
  const jaFechado = ['fechado', 'emitido'].includes(o.etapa);

  let aceita = d.aceita ?? null;
  if (aceita != null) {
    const c = await db.prepare('SELECT nome FROM combos WHERE id = ? AND orcamento_id = ?').bind(aceita, o.id).first();
    if (!c) throw new Recusa('Combinação não encontrada');
    aceita = { id: aceita, nome: c.nome };
  }
  if (jaFechado && aceita?.id !== o.combo_aceita) {
    const emitiu = await db.prepare('SELECT 1 FROM emissoes WHERE orcamento_id = ? LIMIT 1').bind(o.id).first();
    if (emitiu) throw new Recusa('Já tem voo emitido; não dá pra trocar a combinação', 409);
  }
  if (fechar && !aceita) throw new Recusa('Escolha qual combinação ela aceitou');

  const total = o.adultos + o.criancas + o.bebes;
  const pax = [...new Set((d.passageiros || []).filter(Number.isInteger))];
  if (pax.length > total) throw new Recusa(`São só ${total} passageiros`);
  const ids = [...new Set([...pax, ...(d.cliente != null ? [d.cliente] : [])])];
  if (ids.length) {
    const achados = (await db.prepare(`SELECT id FROM pessoas WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results;
    if (achados.length !== ids.length) throw new Recusa('Pessoa não encontrada; recarregue a página');
  }
  if (jaFechado && o.etapa === 'emitido') {
    // quem já voou numa emissão não sai da lista
    const voou = (await db.prepare('SELECT DISTINCT ep.pessoa_id FROM emissao_passageiros ep JOIN emissoes e ON e.id = ep.emissao_id WHERE e.orcamento_id = ?').bind(o.id).all()).results;
    if (voou.some((v) => !pax.includes(v.pessoa_id))) throw new Recusa('Quem já foi emitido não sai da lista de passageiros', 409);
  }
  const forma = d.forma == null ? null : String(d.forma);
  if (forma != null && !FORMAS.includes(forma)) throw new Recusa('Forma de pagamento inválida');
  const parcelas = forma === 'parcelado' ? (d.parcelas ?? 10) : null;
  if (parcelas != null && !inteiro(parcelas, 2, 12)) throw new Recusa('Número de parcelas inválido');
  const recebido = d.recebido ?? 0;
  if (!inteiro(recebido, 0, 1_000_000_00)) throw new Recusa('Valor recebido inválido');

  const comandos = [
    db.prepare(`UPDATE orcamentos SET combo_aceita = ?, cliente_id = ?, pessoa_id = COALESCE(pessoa_id, ?), receb_forma = ?, receb_parcelas = ?, receb_recebido = ?
      ${fechar ? ", etapa = 'fechado'" : ''} WHERE id = ?`).bind(aceita?.id ?? null, d.cliente ?? null, d.cliente ?? null, forma, parcelas, recebido, o.id),
    db.prepare('DELETE FROM orcamento_passageiros WHERE orcamento_id = ?').bind(o.id),
    ...pax.map((p, i) => db.prepare('INSERT INTO orcamento_passageiros (orcamento_id, pessoa_id, ordem) VALUES (?, ?, ?)').bind(o.id, p, i)),
  ];
  const eventos = [];
  if (fechar) eventos.push({ entidade: 'orcamento', id: o.id, texto: `Fechou: ${aceita.nome}`, antes: { etapa: o.etapa } });
  else if (recebido !== o.receb_recebido && jaFechado) eventos.push({ entidade: 'orcamento', id: o.id, texto: `Recebido: R$ ${(recebido / 100).toFixed(2).replace('.', ',')}`, antes: { recebido: o.receb_recebido } });
  return { resultado: { id: o.id, fechou: fechar }, comandos, eventos };
});

// desfaz o fechamento: o orçamento volta pra Enviado (ou Pesquisado, se a proposta nunca foi marcada como enviada).
// A combinação aceita, as pessoas e o recebimento continuam marcados. Com voo emitido, desfaça a emissão antes.
acao('fech.reabrir', ['dono'], async ({ db }, { id }) => {
  const o = Number.isInteger(id) ? await db.prepare('SELECT * FROM orcamentos WHERE id = ?').bind(id).first() : null;
  if (!o) throw new Recusa('Orçamento não encontrado', 404);
  if (o.etapa !== 'fechado') throw new Recusa(o.etapa === 'emitido' ? 'Tem voo emitido: desfaça as emissões antes de reabrir' : 'Esse orçamento não está fechado', 409);
  const emitiu = await db.prepare('SELECT COUNT(*) AS n FROM emissoes WHERE orcamento_id = ?').bind(o.id).first();
  if (emitiu.n) throw new Recusa(`Tem ${emitiu.n} voo${emitiu.n > 1 ? 's' : ''} emitido${emitiu.n > 1 ? 's' : ''}: desfaça na emissão antes de reabrir`, 409);
  const volta = o.enviada_em ? 'enviado' : 'pesquisado';
  return {
    resultado: { id: o.id, etapa: volta },
    comandos: [db.prepare('UPDATE orcamentos SET etapa = ? WHERE id = ?').bind(volta, o.id)],
    eventos: [{ entidade: 'orcamento', id: o.id, texto: `Desfez o fechamento (voltou pra ${volta === 'enviado' ? 'Enviado' : 'Pesquisado'})`, antes: { etapa: o.etapa } }],
  };
});

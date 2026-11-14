// Cartões de crédito da K&V. O que se paga neles vem da entrada de pontos (compra, clube, transferência) e da emissão
// (taxa de embarque, ou a passagem em dinheiro); a fatura de cada gasto sai do dia em que o cartão fecha.
import { acao, Recusa } from '../acoes.js';

const inteiro = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

// confere o cartão escolhido num lançamento: nulo = pago de outro jeito (Pix, dinheiro)
export async function cartaoValido(db, id) {
  if (id == null) return null;
  if (!Number.isInteger(id)) throw new Recusa('Cartão inválido');
  const c = await db.prepare('SELECT id, nome FROM cartoes WHERE id = ?').bind(id).first();
  if (!c) throw new Recusa('Cartão não encontrado; recarregue a página');
  return c.id;
}
export const parcelasValidas = (n) => { const p = n ?? 1; if (!inteiro(p, 1, 24)) throw new Recusa('Número de parcelas inválido (1 a 24)'); return p; };

// cria (sem id) ou altera um cartão
acao('cartao.salvar', ['dono'], async ({ db, quando }, d) => {
  const nome = String(d.nome || '').trim().slice(0, 60);
  if (!nome) throw new Recusa('Dê um nome ao cartão (ex.: Nubank do dono)');
  const final = String(d.final || '').replace(/\D/g, '').slice(-4);
  if (!inteiro(d.fecha, 1, 31)) throw new Recusa('Dia em que a fatura fecha: de 1 a 31');
  if (!inteiro(d.vence, 1, 31)) throw new Recusa('Dia em que a fatura vence: de 1 a 31');
  const limite = d.limite == null ? null : d.limite;
  if (limite != null && !inteiro(limite, 0, 100_000_000_00)) throw new Recusa('Limite inválido');
  const ativo = d.ativo === false ? 0 : 1;
  if (d.id != null) {
    const antes = Number.isInteger(d.id) ? await db.prepare('SELECT * FROM cartoes WHERE id = ?').bind(d.id).first() : null;
    if (!antes) throw new Recusa('Cartão não encontrado', 404);
    return {
      resultado: { id: antes.id },
      comandos: [db.prepare('UPDATE cartoes SET nome = ?, final = ?, fecha = ?, vence = ?, limite = ?, ativo = ? WHERE id = ?').bind(nome, final, d.fecha, d.vence, limite, ativo, antes.id)],
      eventos: [{ entidade: 'cartao', id: antes.id, texto: ativo ? `Alterou o cartão ${nome}` : `Desativou o cartão ${nome}`, antes }],
    };
  }
  const { id: ult } = await db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM cartoes').first();
  return {
    resultado: { id: ult + 1 },
    comandos: [db.prepare('INSERT INTO cartoes (id, nome, final, fecha, vence, limite, ativo, criado_em) VALUES (?, ?, ?, ?, ?, ?, 1, ?)').bind(ult + 1, nome, final, d.fecha, d.vence, limite, quando)],
    eventos: [{ entidade: 'cartao', id: ult + 1, texto: `Cadastrou o cartão ${nome}` }],
  };
});

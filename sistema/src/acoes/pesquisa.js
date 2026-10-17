// Ações da pesquisa de voos: opções, lista de conferência, quem pesquisa e "marcar como pesquisado".
import { acao, Recusa, ehDono } from '../acoes.js';

// site → como paga e de qual programa sai a milha (igual a public/shared/orc.js)
export const SITES = { Smiles: 'smiles', Latam: 'latam', TudoAzul: 'azul', Interline: 'azul', Skyscanner: null };

async function orcamento(db, id) {
  const o = Number.isInteger(id) ? await db.prepare('SELECT * FROM orcamentos WHERE id = ?').bind(id).first() : null;
  if (!o) throw new Recusa('Orçamento não encontrado', 404);
  return o;
}
// o dono lança sempre; quem pesquisa, só no orçamento que está com ele e em pesquisa
function podeLancar(u, o) {
  if (ehDono(u)) return;
  if (o.responsavel !== u.email || o.etapa !== 'pesquisa') throw new Recusa('Esse orçamento não está em pesquisa com você', 403);
}

const ehHora = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const inteiro = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

// cria (sem id) ou altera uma opção de voo. Milhas por pessoa; taxa e preço em centavos, por pessoa.
acao('op.salvar', ['dono', 'pesquisa'], async ({ db, usuario, quando }, d) => {
  const o = await orcamento(db, d.orcamento);
  podeLancar(usuario, o);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM trechos WHERE orcamento_id = ?').bind(o.id).first();
  if (!inteiro(d.trecho, 0, n.n - 1)) throw new Recusa('Trecho inválido');
  if (!(d.site in SITES)) throw new Recusa('Site inválido');
  const pontos = SITES[d.site] != null;
  const chega = String(d.chega || '');
  if (!ehData(d.data) || !ehHora(d.sai) || !ehHora(chega.replace(/ \+1$/, ''))) throw new Recusa('Dia ou horário inválido');
  if (!inteiro(d.escalas, 0, 5)) throw new Recusa('Escalas inválidas');
  const milhas = pontos ? d.milhas : null, taxa = pontos ? d.taxa : null, preco = pontos ? null : d.preco;
  if (pontos && (!inteiro(milhas, 1, 10_000_000) || !inteiro(taxa, 0, 100_000_00))) throw new Recusa('Milhas ou taxa inválidas');
  if (!pontos && !inteiro(preco, 1, 1_000_000_00)) throw new Recusa('Preço inválido');
  const voo = String(d.voo || '').trim().toUpperCase().slice(0, 20);
  const cia = String(d.cia || voo.split(' ')[0] || d.site).slice(0, 40);
  const link = String(d.link || '').trim().slice(0, 2000);
  const campos = [d.trecho, d.site, d.data, d.sai, chega, cia, voo, d.escalas, d.bagagem ? 1 : 0, milhas, taxa, preco, link];

  if (d.id) {
    const antes = await db.prepare('SELECT * FROM opcoes WHERE id = ? AND orcamento_id = ?').bind(d.id, o.id).first();
    if (!antes) throw new Recusa('Opção não encontrada', 404);
    return {
      resultado: { id: d.id },
      comandos: [db.prepare(`UPDATE opcoes SET trecho = ?, site = ?, data = ?, sai = ?, chega = ?, cia = ?, voo = ?, escalas = ?, bagagem = ?,
        milhas = ?, taxa = ?, preco = ? , link = ? WHERE id = ?`).bind(...campos, d.id)],
      eventos: [{ entidade: 'orcamento', id: o.id, texto: `Alterou a opção ${d.site} das ${d.sai}`, antes }],
    };
  }
  const { id: ult } = await db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM opcoes').first();
  const id = ult + 1;
  return {
    resultado: { id },
    comandos: [db.prepare(`INSERT INTO opcoes (id, orcamento_id, trecho, site, data, sai, chega, cia, voo, escalas, bagagem, milhas, taxa, preco, link,
      criada_em, criada_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, o.id, ...campos, quando, usuario.email)],
    eventos: [{ entidade: 'orcamento', id: o.id, texto: `Lançou a opção ${d.site} das ${d.sai}` }],
  };
});

acao('op.apagar', ['dono', 'pesquisa'], async ({ db, usuario }, { orcamento: oid, id }) => {
  const o = await orcamento(db, oid);
  podeLancar(usuario, o);
  const antes = await db.prepare('SELECT * FROM opcoes WHERE id = ? AND orcamento_id = ?').bind(id, o.id).first();
  if (!antes) throw new Recusa('Opção não encontrada', 404);
  const combos = (await db.prepare('SELECT escolha FROM combos WHERE orcamento_id = ?').bind(o.id).all()).results;
  if (combos.some((c) => JSON.parse(c.escolha).includes(id))) throw new Recusa('Essa opção está numa combinação da proposta; troque lá antes', 409);
  return {
    resultado: { id },
    comandos: [db.prepare('DELETE FROM opcoes WHERE id = ?').bind(id)],
    eventos: [{ entidade: 'orcamento', id: o.id, texto: `Apagou a opção ${antes.site} das ${antes.sai}`, antes }],
  };
});

// marca ou desmarca um item da lista de conferência
acao('conf.marcar', ['dono', 'pesquisa'], async ({ db, usuario }, { orcamento: oid, ordem, feito }) => {
  const o = await orcamento(db, oid);
  podeLancar(usuario, o);
  const c = await db.prepare('SELECT texto FROM conferencia WHERE orcamento_id = ? AND ordem = ?').bind(o.id, ordem).first();
  if (!c) throw new Recusa('Item não encontrado', 404);
  return {
    resultado: { ordem },
    comandos: [db.prepare('UPDATE conferencia SET feito = ? WHERE orcamento_id = ? AND ordem = ?').bind(feito ? 1 : 0, o.id, ordem)],
    eventos: [{ entidade: 'orcamento', id: o.id, texto: `${feito ? 'Conferiu' : 'Desmarcou'}: ${c.texto}` }],
  };
});

// o dono põe um item a mais na lista (ex.: "só Latam")
acao('conf.adicionar', ['dono'], async ({ db }, { orcamento: oid, texto }) => {
  const o = await orcamento(db, oid);
  texto = String(texto || '').trim().slice(0, 200);
  if (!texto) throw new Recusa('Falta o texto');
  const { n } = await db.prepare('SELECT COALESCE(MAX(ordem), -1) + 1 AS n FROM conferencia WHERE orcamento_id = ?').bind(o.id).first();
  return {
    resultado: { ordem: n },
    comandos: [db.prepare('INSERT INTO conferencia (orcamento_id, ordem, texto) VALUES (?, ?, ?)').bind(o.id, n, texto)],
    eventos: [{ entidade: 'orcamento', id: o.id, texto: `Pôs na conferência: ${texto}` }],
  };
});

// o dono passa o orçamento pra alguém da pesquisa (ou devolve pra fila)
acao('orc.passar', ['dono'], async ({ db }, { id, email }) => {
  const o = await orcamento(db, id);
  let nome = null;
  if (email) {
    const u = await db.prepare("SELECT nome FROM usuarios WHERE email = ? AND ativo = 1 AND (papel = 'pesquisador' OR pesquisa = 1)").bind(email).first();
    if (!u) throw new Recusa('Essa pessoa não pesquisa voos');
    nome = u.nome;
  }
  return {
    resultado: { id },
    comandos: [db.prepare('UPDATE orcamentos SET responsavel = ? WHERE id = ?').bind(email || null, id)],
    eventos: [{ entidade: 'orcamento', id, texto: nome ? `Passou pra ${nome}` : 'Devolveu pra fila', antes: { responsavel: o.responsavel } }],
  };
});

// quem pesquisou entrega pro dono revisar
acao('orc.pesquisado', ['dono', 'pesquisa'], async ({ db, usuario }, { id }) => {
  const o = await orcamento(db, id);
  podeLancar(usuario, o);
  if (!['novo', 'pesquisa'].includes(o.etapa)) throw new Recusa('Esse orçamento já saiu da pesquisa', 409);
  return {
    resultado: { id },
    comandos: [db.prepare("UPDATE orcamentos SET etapa = 'pesquisado' WHERE id = ?").bind(id)],
    eventos: [{ entidade: 'orcamento', id, texto: 'Marcou como pesquisado', antes: { etapa: o.etapa } }],
  };
});

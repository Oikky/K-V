// Toda mudança no banco passa por aqui. A tela manda { acao, dados, chave }:
// - acao: nome registrado em ACOES (ex.: 'orc.pegar');
// - chave: única por clique; se chegar repetida, devolve o resultado da primeira vez;
// - cada ação diz quais papéis podem usá-la e devolve { resultado, eventos }.
// Os eventos (histórico: quem, o quê, quando, antes) são gravados junto, no mesmo lote.

export class Recusa extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

const ACOES = {};

// registra uma ação. Quem pode: 'dono' (o dono e o admin) e/ou 'pesquisa' (quem pesquisa voos:
// os pesquisadores e o dono que também pesquisa). Ex.: ['dono'] ou ['dono', 'pesquisa'].
export function acao(nome, papeis, fn) { ACOES[nome] = { papeis, fn }; }

export const ehDono = (u) => u.papel === 'dono' || u.papel === 'admin';
export const pesquisa = (u) => u.papel === 'pesquisador' || !!u.pesquisa;
const pode = (u, papeis) => (papeis.includes('dono') && ehDono(u)) || (papeis.includes('pesquisa') && pesquisa(u));

export const agora = () => new Date().toISOString();
// o dia de hoje no horário de Brasília (AAAA-MM-DD): datas de movimento e de emissão seguem o relógio da K&V
export const hojeBR = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);

export async function executar(env, usuario, corpo) {
  const { acao: nome, dados = {}, chave } = corpo || {};
  const a = ACOES[nome];
  if (!a) throw new Recusa(`Ação desconhecida: ${nome}`);
  if (!pode(usuario, a.papeis)) throw new Recusa('Seu papel não pode fazer isso', 403);
  if (!chave || typeof chave !== 'string' || chave.length > 100) throw new Recusa('Falta a chave da ação');

  const ja = await env.DB.prepare('SELECT resultado FROM idempotencia WHERE chave = ?').bind(chave).first();
  if (ja) return JSON.parse(ja.resultado);

  // ações que criam linhas calculam o próximo id antes; se duas pessoas gravarem no mesmo instante,
  // o lote da segunda falha (id repetido) e a ação roda de novo, já com o id seguinte
  for (let tentativa = 1; ; tentativa++) {
    try { return await rodar(env, usuario, nome, a, dados, chave); }
    catch (e) {
      if (tentativa >= 3 || !/UNIQUE constraint failed/.test(String(e.message)) || /idempotencia/.test(String(e.message))) throw e;
    }
  }
}

async function rodar(env, usuario, nome, a, dados, chave) {
  const ctx = { env, db: env.DB, usuario, quando: agora() };
  const { resultado = null, comandos = [], eventos = [] } = await a.fn(ctx, dados);

  // o que a ação quer gravar + o histórico + a chave, tudo num lote só (ou grava tudo, ou nada)
  const lote = [
    ...comandos,
    ...eventos.map((e) => env.DB.prepare(
      'INSERT INTO eventos (quando, quem, por, acao, entidade, entidade_id, texto, antes, depois) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(ctx.quando, usuario.email, usuario.admin ? usuario.admin.email : null, nome, e.entidade, String(e.id), e.texto || '',
      e.antes == null ? null : JSON.stringify(e.antes), e.depois == null ? null : JSON.stringify(e.depois))),
    env.DB.prepare('INSERT INTO idempotencia (chave, quando, resultado) VALUES (?, ?, ?)')
      .bind(chave, ctx.quando, JSON.stringify(resultado)),
  ];
  await env.DB.batch(lote);
  return resultado;
}

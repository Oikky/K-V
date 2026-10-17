// Ponto dos pesquisadores: quem pesquisa vê só o próprio; o dono vê todos (a folha).
// Vem das últimas 6 semanas, mais o trecho que ainda estiver ligado.
import { ehDono, pesquisa } from './acoes.js';

const todos = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;

export async function lerPonto(env, usuario) {
  const db = env.DB, dono = ehDono(usuario);
  const pessoas = dono
    ? await todos(db, "SELECT email, nome FROM usuarios WHERE ativo = 1 AND (papel = 'pesquisador' OR pesquisa = 1) ORDER BY nome")
    : pesquisa(usuario) ? [{ email: usuario.email, nome: usuario.nome }] : [];
  if (!pessoas.length) return { pesquisadores: [], trechos: [], pagamentos: [] };
  const emails = pessoas.map((p) => p.email), m = emails.map(() => '?').join(',');
  const desde = new Date(Date.now() - 45 * 864e5).toISOString();
  const [valores, trechos, pagamentos] = await Promise.all([
    todos(db, `SELECT email, desde, valor FROM valores_hora WHERE email IN (${m}) ORDER BY desde`, ...emails),
    todos(db, `SELECT id, email, inicio, fim, original_inicio, original_fim, manual, corrigido_em FROM ponto
               WHERE email IN (${m}) AND (inicio >= ? OR fim IS NULL) ORDER BY inicio`, ...emails, desde),
    todos(db, `SELECT email, semana, valor, data FROM pagamentos_semana WHERE email IN (${m}) ORDER BY semana DESC`, ...emails),
  ]);
  return {
    pesquisadores: pessoas.map((p) => ({ ...p, valores: valores.filter((v) => v.email === p.email).map(({ desde: d, valor }) => ({ desde: d, valor })) })),
    trechos: trechos.map((t) => ({ ...t, manual: !!t.manual })),
    pagamentos,
  };
}

// O que cada papel recebe ao abrir o sistema. O pesquisador nunca recebe contas, pontos,
// valor da milha nem preços de venda: o corte é feito aqui, antes de sair do servidor.
const todos = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;

export async function estado(env, usuario) {
  const db = env.DB, dono = usuario.papel === 'dono';
  const programas = await todos(db, dono
    ? 'SELECT id, nome, valor_milha, limite, regra, renovacao FROM programas ORDER BY rowid'
    : 'SELECT id, nome FROM programas ORDER BY rowid');
  return {
    eu: usuario,
    usuarios: await todos(db, dono
      ? 'SELECT email, nome, papel, ativo FROM usuarios ORDER BY papel, nome'
      : "SELECT email, nome, papel FROM usuarios WHERE ativo = 1 AND papel = 'pesquisador' ORDER BY nome"),
    programas,
    categorias: dono ? await todos(db, 'SELECT programa_id, nome, limite FROM categorias ORDER BY limite') : [],
  };
}

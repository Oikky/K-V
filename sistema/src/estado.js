// O que cada papel recebe ao abrir o sistema. Quem não é dono nunca recebe contas, pontos,
// valor da milha nem preços de venda: o corte é feito aqui, antes de sair do servidor.
import { ehDono } from './acoes.js';

const todos = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;

export async function estado(env, usuario) {
  const db = env.DB, dono = ehDono(usuario);
  return {
    eu: usuario,
    // o dono vê a equipe toda; quem pesquisa vê só os colegas de pesquisa (pra saber quem pegou o quê)
    usuarios: await todos(db, dono
      ? 'SELECT email, nome, papel, pesquisa, ativo FROM usuarios ORDER BY nome'
      : "SELECT email, nome, papel, pesquisa FROM usuarios WHERE ativo = 1 AND (papel = 'pesquisador' OR pesquisa = 1) ORDER BY nome"),
    programas: await todos(db, dono
      ? 'SELECT id, nome, valor_milha, limite, regra, renovacao FROM programas ORDER BY rowid'
      : 'SELECT id, nome FROM programas ORDER BY rowid'),
    categorias: dono ? await todos(db, 'SELECT programa_id, nome, limite FROM categorias ORDER BY limite') : [],
  };
}

// O que cada papel recebe ao abrir o sistema. Quem não é dono nunca recebe contas, pontos,
// valor da milha nem preços de venda: o corte é feito aqui, antes de sair do servidor.
import { ehDono } from './acoes.js';

export async function estado(env, usuario) {
  const db = env.DB, dono = ehDono(usuario);
  // as três leituras vão num lote só: uma ida ao banco em vez de três
  const [usuarios, programas, categorias, equipe, cartoes, [empresa]] = (await db.batch([
    // o dono vê a equipe toda; quem pesquisa vê só os colegas de pesquisa (pra saber quem pegou o quê)
    db.prepare(dono
      ? 'SELECT email, nome, papel, pesquisa, ativo, foto FROM usuarios ORDER BY nome'
      : "SELECT email, nome, papel, pesquisa, foto FROM usuarios WHERE ativo = 1 AND (papel = 'pesquisador' OR pesquisa = 1) ORDER BY nome"),
    db.prepare(dono
      ? 'SELECT id, nome, valor_milha, limite, regra, renovacao FROM programas ORDER BY rowid'
      : 'SELECT id, nome FROM programas ORDER BY rowid'),
    db.prepare(dono ? 'SELECT programa_id, nome, limite FROM categorias ORDER BY limite' : 'SELECT 1 WHERE 0'),
    // o admin troca de pessoa pelo menu do perfil, então recebe a equipe toda mesmo vendo como pesquisador
    db.prepare(usuario.real === 'admin' ? 'SELECT email, nome, papel, pesquisa, foto FROM usuarios WHERE ativo = 1 ORDER BY nome' : 'SELECT 1 WHERE 0'),
    // cartões de crédito da K&V (só o dono)
    db.prepare(dono ? 'SELECT id, nome, final, fecha, vence, limite, ativo FROM cartoes ORDER BY ativo DESC, nome' : 'SELECT 1 WHERE 0'),
    // a chave que libera quem pesquisa a criar orçamento
    db.prepare("SELECT json_extract(dados, '$.pesquisaCria') AS sim FROM empresa WHERE id = 1"),
  ])).map((r) => r.results);
  const podeCriar = dono || !!(empresa && empresa.sim);
  return { eu: usuario, usuarios, programas, categorias, podeCriar,...(dono ? { cartoes } : {}), ...(usuario.real === 'admin' ? { equipe } : {}) };
}

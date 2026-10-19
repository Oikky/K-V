// Ações de configuração: quem usa o sistema e o valor da milha de cada programa.
import { acao, Recusa } from '../acoes.js';

const PAPEIS = ['dono', 'pesquisador', 'admin'];

// cadastra ou altera alguém da equipe (o e-mail precisa estar liberado também no Access)
acao('usuario.salvar', ['dono'], async ({ db, usuario }, { email, nome, papel, pesquisa = false, ativo = true }) => {
  email = String(email || '').trim().toLowerCase();
  nome = String(nome || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Recusa('E-mail inválido');
  if (!nome) throw new Recusa('Falta o nome');
  if (!PAPEIS.includes(papel)) throw new Recusa('Papel inválido');
  if (papel === 'admin' && usuario.papel !== 'admin') throw new Recusa('Só o admin cadastra outro admin', 403);
  if (papel === 'pesquisador') pesquisa = true;
  if (email === usuario.email && (papel !== usuario.papel || !ativo)) throw new Recusa('Você não pode mudar o seu próprio acesso');
  const antes = await db.prepare('SELECT nome, papel, pesquisa, ativo FROM usuarios WHERE email = ?').bind(email).first();
  if (antes && antes.papel === 'admin' && usuario.papel !== 'admin') throw new Recusa('Só o admin altera o admin', 403);
  return {
    resultado: { email },
    comandos: [db.prepare(
      'INSERT INTO usuarios (email, nome, papel, pesquisa, ativo) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(email) DO UPDATE SET nome = ?2, papel = ?3, pesquisa = ?4, ativo = ?5',
    ).bind(email, nome, papel, pesquisa ? 1 : 0, ativo ? 1 : 0)],
    eventos: [{ entidade: 'usuario', id: email, texto: antes ? `Alterou ${nome}` : `Cadastrou ${nome}`, antes, depois: { nome, papel, pesquisa: !!pesquisa, ativo } }],
  };
});

// foto do perfil: a tela pega a do Google (pelo login do Access) e guarda aqui pra a equipe ver.
// Vale pra quem entrou de verdade: se o admin estiver vendo como outra pessoa, a foto continua sendo a dele.
acao('eu.foto', ['dono', 'pesquisa'], async ({ db, usuario }, { url }) => {
  url = String(url || '');
  if (!/^https:\/\/[^\s"'<>]+$/.test(url) || url.length > 600) throw new Recusa('Endereço da foto inválido');
  const email = usuario.admin ? usuario.admin.email : usuario.email;
  return { resultado: { email }, comandos: [db.prepare('UPDATE usuarios SET foto = ? WHERE email = ?').bind(url, email)] };
});

// valor padrão da milha (o que vem em toda proposta), em milionésimos de real
acao('programa.valorMilha', ['dono'], async ({ db }, { id, valor }) => {
  const p = await db.prepare('SELECT nome, valor_milha FROM programas WHERE id = ?').bind(id).first();
  if (!p) throw new Recusa('Programa não existe');
  if (!Number.isInteger(valor) || valor < 0 || valor > 1000000) throw new Recusa('Valor da milha inválido');
  return {
    resultado: { id, valor },
    comandos: [db.prepare('UPDATE programas SET valor_milha = ? WHERE id = ?').bind(valor, id)],
    eventos: [{ entidade: 'programa', id, texto: `Valor da milha ${p.nome}`, antes: { valor_milha: p.valor_milha }, depois: { valor_milha: valor } }],
  };
});

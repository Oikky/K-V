// Worker do sistema K&V. As telas (public/) são servidas direto pela Cloudflare;
// aqui só chegam /api/* (com login) e /telegram (bot, com senha secreta).
import { usuarioDa } from './auth.js';
import { executar, Recusa } from './acoes.js';
import { estado } from './estado.js';
import './acoes/base.js';

const json = (dados, status = 200) => new Response(JSON.stringify(dados), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    if (url.pathname.startsWith('/api/')) {
      const usuario = await usuarioDa(req, env);
      if (!usuario) return json({ erro: 'Seu e-mail não tem acesso ao sistema.' }, 403);
      try {
        if (url.pathname === '/api/estado' && req.method === 'GET') return json(await estado(env, usuario));
        if (url.pathname === '/api/acao' && req.method === 'POST') {
          return json({ ok: true, resultado: await executar(env, usuario, await req.json()) });
        }
        return json({ erro: 'Endereço não existe' }, 404);
      } catch (e) {
        if (e instanceof Recusa) return json({ erro: e.message }, e.status);
        console.error(e);
        return json({ erro: 'Erro no servidor. Tente de novo.' }, 500);
      }
    }

    return env.ASSETS.fetch(req);
  },
};

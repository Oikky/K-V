// Worker do sistema K&V. As telas (public/) são servidas direto pela Cloudflare;
// aqui só chegam /api/* (com login). O bot do Telegram é outro Worker (src/bot/, wrangler.bot.jsonc).
import { usuarioDa } from './auth.js';
import { executar, Recusa } from './acoes.js';
import { estado } from './estado.js';
import { listarOrcamentos, abrirOrcamento } from './orcamentos.js';
import './acoes/pesquisa.js';
import './acoes/proposta.js';
import './acoes/base.js';
import './acoes/orcamentos.js';

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
        if (url.pathname === '/api/orcamentos' && req.method === 'GET') return json(await listarOrcamentos(env, usuario));
        if (url.pathname === '/api/orcamento' && req.method === 'GET') {
          const o = await abrirOrcamento(env, usuario, Number(url.searchParams.get('id')));
          return o ? json(o) : json({ erro: 'Orçamento não encontrado (ou já saiu da sua fila).' }, 404);
        }
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

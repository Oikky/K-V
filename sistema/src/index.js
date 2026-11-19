// Worker do sistema K&V. As telas (public/) são servidas direto pela Cloudflare;
// aqui só chegam /api/* (com login). O bot do Telegram é outro Worker (src/bot/, wrangler.bot.jsonc).
import { usuarioDa } from './auth.js';
import { executar, Recusa, ehDono } from './acoes.js';
import { estado } from './estado.js';
import { listarOrcamentos, abrirOrcamento, presenca } from './orcamentos.js';
import './acoes/pesquisa.js';
import './acoes/proposta.js';
import './acoes/pessoas.js';
import './acoes/fechamento.js';
import './acoes/emissao.js';
import './acoes/contas.js';
import './acoes/ponto.js';
import { lerPonto } from './ponto.js';
import { listarPessoas, viajaCom, clientes, custosPontos, gastosCartao } from './pessoas.js';
import { contasCompletas, contaDetalhe, movimentoDetalhe } from './contas.js';
import './acoes/base.js';
import './acoes/orcamentos.js';
import './acoes/cartoes.js';
import './acoes/empresa.js';

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
        if (url.pathname === '/api/presenca' && req.method === 'POST') return json(await presenca(env, usuario, Number((await req.json().catch(() => ({}))).id)));
        if (url.pathname === '/api/ponto' && req.method === 'GET') return json(await lerPonto(env, usuario));
        // só o dono: cadastro de pessoas e contas de pontos
        if (['/api/pessoas', '/api/pessoas/juntos', '/api/contas', '/api/conta', '/api/movimento', '/api/clientes', '/api/financeiro', '/api/empresa'].includes(url.pathname) && !ehDono(usuario)) return json({ erro: 'Só o dono vê isso' }, 403);
        if (url.pathname === '/api/clientes' && req.method === 'GET') return json(await clientes(env));
        // dados da empresa pro recibo (ficam no banco: o repositório é público)
        if (url.pathname === '/api/empresa' && req.method === 'GET') { const e = await env.DB.prepare('SELECT dados, logo FROM empresa WHERE id = 1').first(); return json(e ? { ...JSON.parse(e.dados), logo: e.logo } : {}); }
        if (url.pathname === '/api/financeiro' && req.method === 'GET') { const [custos, gastos] = await Promise.all([custosPontos(env), gastosCartao(env)]); return json({ custos, gastos }); }
        if (url.pathname === '/api/pessoas' && req.method === 'GET') return json(await listarPessoas(env));
        if (url.pathname === '/api/pessoas/juntos' && req.method === 'GET') return json(await viajaCom(env, Number(url.searchParams.get('id'))));
        if (url.pathname === '/api/contas' && req.method === 'GET') return json(await contasCompletas(env, { programa: url.searchParams.get('programa') || undefined }));
        if (url.pathname === '/api/conta' && req.method === 'GET') {
          const c = await contaDetalhe(env, Number(url.searchParams.get('id')));
          return c ? json(c) : json({ erro: 'Conta não encontrada' }, 404);
        }
        if (url.pathname === '/api/movimento' && req.method === 'GET') {
          const m = await movimentoDetalhe(env, Number(url.searchParams.get('id')));
          return m ? json(m) : json({ erro: 'Movimento não encontrado (talvez tenha sido apagado)' }, 404);
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

    // página única: endereço de tela (/orcamento.html?id=4) que não é arquivo abre o index.html, e a tela certa é escolhida lá
    const r = await env.ASSETS.fetch(req);
    if (r.status === 404 && req.method === 'GET' && /^\/[\w-]*(\.html)?$/.test(url.pathname)) return env.ASSETS.fetch(new Request(new URL('/', url), req));
    return r;
  },
};

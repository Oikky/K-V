/* Página única: o sistema inteiro é o index.html; cada tela é uma função em telas/<nome>.js (com o estilo em telas/<nome>.css).
   Trocar de tela não recarrega a página: o menu fica, a tela de antes continua visível até a nova estar pronta,
   e o endereço muda (/orcamento.html?id=4), então voltar, atualizar e mandar o link funcionam igual.
   Ao sair de uma tela, tudo o que ela ligou some junto: janelas, relógios (setInterval) e escutas na página. */
(function () {
  window.KVTelas = {};
  const INICIAL = 'orcamentos';
  let atual = null; // { chave, id, limpar: [] }

  // ---------- o que a tela ligou na página, pra desligar quando ela sair ----------
  const addOrig = EventTarget.prototype.addEventListener, setIntOrig = window.setInterval;
  window.addEventListener = function (tipo, fn, op) { if (atual) atual.limpar.push(() => removeEventListener(tipo, fn, op)); return addOrig.call(this, tipo, fn, op); };
  document.addEventListener = function (tipo, fn, op) { if (atual) atual.limpar.push(() => document.removeEventListener(tipo, fn, op)); return addOrig.call(this, tipo, fn, op); };
  window.setInterval = function (...a) { const id = setIntOrig.apply(window, a); if (atual) atual.limpar.push(() => clearInterval(id)); return id; };

  const chaveDe = (url) => { const n = url.pathname.split('/').pop().replace(/\.html$/, ''); return KVTelas[n] ? n : INICIAL; };
  // a mesma tela com outro id (outra conta, outro orçamento) é uma tela nova
  const identidade = (url) => `${chaveDe(url)}|${url.searchParams.get('id') || ''}`;

  function sair() {
    if (!atual) return;
    atual.limpar.forEach((f) => { try { f(); } catch (e) {} });
    document.querySelectorAll('body > dialog').forEach((d) => { try { d.close(); } catch (e) {} d.remove(); });
    document.querySelectorAll('.rail-cron, p.carregando').forEach((e) => e.remove());
    atual = null;
  }
  function entrar(url) {
    sair();
    const chave = chaveDe(url);
    atual = { chave, id: identidade(url), limpar: [] };
    cssPendente = chave;
    document.title = 'K&V';
    KVApi.novaTela();
    try { KVTelas[chave](); } catch (e) { console.error(e); KVShell.aviso('Erro ao abrir a tela. Recarregue a página.', { erro: true }); }
  }

  // o estilo da tela nova só entra quando ela desenha (KVShell.montar chama), pra a de antes não ficar torta
  let cssPendente = null;
  function aplicarCss() {
    if (!cssPendente) return;
    // com a janela do orçamento aberta, o quadro parado no fundo continua com o estilo dele
    const fundo = document.querySelector('.area.fundo[data-tela]');
    document.querySelectorAll('link[data-tela]').forEach((l) => { l.media = l.dataset.tela === cssPendente || (fundo && l.dataset.tela === fundo.dataset.tela) ? 'all' : 'not all'; });
    cssPendente = null;
    document.querySelectorAll('.kv-ocupado').forEach((e) => e.classList.remove('kv-ocupado'));
    scrollTo(0, 0);
  }

  function ir(destino, { trocar = false } = {}) {
    const url = new URL(destino, location.href);
    if (url.origin !== location.origin) { location.href = url.href; return; }
    history[trocar ? 'replaceState' : 'pushState']({ kvTela: true }, '', url.pathname + url.search);
    entrar(url);
  }

  // links do sistema abrem a tela sem recarregar
  addOrig.call(document, 'click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.getAttribute('href').startsWith('#')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
    e.preventDefault();
    // o que foi tocado já mostra que está indo (some quando a tela nova desenha)
    const tocado = a.closest('tr, .cartao-ref') || a;
    tocado.classList.add('kv-ocupado'); setTimeout(() => tocado.classList.remove('kv-ocupado'), 8000);
    ir(url.href, { trocar: a.hasAttribute('data-trocar') });
  });
  // voltar/avançar: se mudou a tela, troca; se é a mesma tela, quem cuida é ela (janelas, abas, filtros)
  addOrig.call(window, 'popstate', () => {
    const url = new URL(location.href);
    if (!atual || identidade(url) !== atual.id) entrar(url);
  });

  // a tela não conseguiu abrir (sem conexão, sem acesso): a linha do topo vira a mensagem
  new MutationObserver(() => {
    document.querySelectorAll('p.carregando:not(.erro)').forEach((p) => { if (p.textContent.trim() !== 'Carregando…') p.classList.add('erro'); });
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.KVRota = {
    ir, trocar: (destino) => ir(destino, { trocar: true }), aplicarCss,
    // dado novo chegou do servidor: redesenha a tela atual, se a pessoa ainda não mexeu nela
    recarregar: () => entrar(new URL(location.href)),
    iniciar: () => entrar(new URL(location.href)),
  };
})();

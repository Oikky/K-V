/* RASCUNHO DESCARTÁVEL: menu lateral, tema e barra de variações. */
(function () {
  const TEMA_KEY = 'kv-rascunho-tema';
  try { const t = localStorage.getItem(TEMA_KEY); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  const ITENS = [
    { id: 'painel', nome: 'Painel', icone: 'layout-dashboard' },
    { id: 'orcamentos', nome: 'Orçamentos', icone: 'plane' },
    { id: 'contas', nome: 'Contas de pontos', icone: 'wallet', href: 'contas.html' },
    { id: 'clientes', nome: 'Clientes', icone: 'users' },
    { id: 'financeiro', nome: 'Financeiro', icone: 'chart-column' },
    { id: 'ponto', nome: 'Ponto', icone: 'timer' },
    { id: 'config', nome: 'Configurações', icone: 'settings' },
  ];

  function montar(ativo) {
    const shell = document.createElement('div');
    shell.className = 'shell';
    shell.innerHTML = `
      <nav class="rail" aria-label="Menu">
        <div class="marca">K<b>&amp;</b>V</div>
        ${ITENS.map((i) => `<a href="${i.href || '#'}" ${i.id === ativo ? 'aria-current="page"' : ''} ${i.href ? '' : 'aria-disabled="true"'} aria-label="${i.nome}">
          <i data-lucide="${i.icone}"></i><span class="dica">${i.nome}${i.href ? '' : ' (em breve)'}</span></a>`).join('')}
        <a href="#" class="baixo" id="tema" aria-label="Trocar tema"><i data-lucide="sun-moon"></i><span class="dica">Trocar tema</span></a>
      </nav>
      <main class="area" id="app"></main>`;
    document.body.prepend(shell);
    shell.querySelector('#tema').addEventListener('click', (e) => {
      e.preventDefault();
      const novo = document.documentElement.dataset.theme === 'claro' ? 'escuro' : 'claro';
      document.documentElement.dataset.theme = novo;
      try { localStorage.setItem(TEMA_KEY, novo); } catch (err) {}
    });
    return shell.querySelector('#app');
  }

  // variações: ?v=A|B|C... ; setas na barra e no teclado
  function variacoes(lista, render) {
    const params = new URLSearchParams(location.search);
    let atual = lista.find((v) => v.k === params.get('v')) || lista[0];
    const bar = document.createElement('div');
    bar.className = 'proto-bar';
    bar.innerHTML = `<button aria-label="Variação anterior">‹</button><span class="tag">RASCUNHO</span><span class="rot"></span><button aria-label="Próxima variação">›</button>`;
    document.body.append(bar);
    const [ant, prox] = bar.querySelectorAll('button');
    const ir = (passo) => {
      const i = (lista.indexOf(atual) + passo + lista.length) % lista.length;
      atual = lista[i];
      const p = new URLSearchParams(location.search); p.set('v', atual.k);
      history.replaceState(null, '', '?' + p.toString());
      desenhar();
    };
    const desenhar = () => {
      bar.querySelector('.rot').innerHTML = `${atual.k} · ${atual.nome}<small>${lista.indexOf(atual) + 1}/${lista.length}</small>`;
      document.title = `${atual.k} · ${atual.nome} · Rascunho K&V`;
      render(atual.k);
      if (window.lucide) lucide.createIcons();
    };
    ant.onclick = () => ir(-1); prox.onclick = () => ir(1);
    addEventListener('keydown', (e) => {
      const alvo = e.target;
      if (alvo.closest && alvo.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') ir(-1);
      if (e.key === 'ArrowRight') ir(1);
    });
    desenhar();
  }

  // Navegação: toda troca de vista, aba, modo ou janela vira um passo no histórico.
  // Assim o voltar do celular e o botão de voltar do mouse desfazem o último passo, em vez de sair da página.
  function irPara(mudancas) {
    const p = new URLSearchParams(location.search);
    Object.entries(mudancas).forEach(([k, v]) => (v == null ? p.delete(k) : p.set(k, v)));
    history.pushState({ kv: true }, '', '?' + p);
  }
  // fecha um passo: se ele foi aberto aqui, volta no histórico; se a página já abriu nele, só tira da URL
  function desfazer(mudancas, depois) {
    if (history.state && history.state.kv) history.back();
    else {
      const p = new URLSearchParams(location.search);
      Object.keys(mudancas).forEach((k) => p.delete(k));
      history.replaceState(null, '', '?' + p);
      depois();
    }
  }
  const aoVoltar = (fn) => addEventListener('popstate', fn);
  const param = (k) => new URLSearchParams(location.search).get(k);

  window.KVShell = { montar, variacoes, irPara, desfazer, aoVoltar, param, icones: () => window.lucide && lucide.createIcons() };
})();

/* Menu lateral, tema e navegação (voltar desfaz o último passo). Igual aos rascunhos, sem a barra de variações. */
(function () {
  const TEMA_KEY = 'kv-tema';
  try { const t = localStorage.getItem(TEMA_KEY); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  // sem href = tela ainda não passou dos rascunhos pro sistema
  const ITENS = [
    { id: 'painel', nome: 'Painel', icone: 'layout-dashboard' },
    { id: 'orcamentos', nome: 'Orçamentos', icone: 'plane', href: 'orcamentos.html' },
    { id: 'contas', nome: 'Contas de pontos', icone: 'wallet', soDono: true },
    { id: 'clientes', nome: 'Clientes', icone: 'users', soDono: true },
    { id: 'financeiro', nome: 'Financeiro', icone: 'chart-column', soDono: true },
    { id: 'ponto', nome: 'Ponto', icone: 'timer' },
    { id: 'config', nome: 'Configurações', icone: 'settings', soDono: true },
  ];

  function montar(ativo, { dono = false } = {}) {
    const itens = ITENS.filter((i) => dono || (!i.soDono && i.id !== 'painel'));
    const shell = document.createElement('div');
    shell.className = 'shell';
    shell.innerHTML = `
      <nav class="rail" aria-label="Menu">
        <div class="marca">K<b>&amp;</b>V</div>
        ${itens.map((i) => `<a href="${i.href || '#'}" data-item="${i.id}" ${i.id === ativo ? 'aria-current="page"' : ''} ${i.href ? '' : 'aria-disabled="true"'} aria-label="${i.nome}">
          <i data-lucide="${i.icone}"></i><span class="dica">${i.nome}${i.href ? '' : ' (em breve)'}</span></a>`).join('')}
        <a href="#" class="baixo" id="tema" aria-label="Trocar tema"><i data-lucide="sun-moon"></i><span class="dica">Trocar tema</span></a>
      </nav>
      <main class="area" id="app"></main>`;
    document.body.prepend(shell);
    shell.querySelectorAll('[aria-disabled="true"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
    shell.querySelector('#tema').addEventListener('click', (e) => {
      e.preventDefault();
      const novo = document.documentElement.dataset.theme === 'claro' ? 'escuro' : 'claro';
      document.documentElement.dataset.theme = novo;
      try { localStorage.setItem(TEMA_KEY, novo); } catch (err) {}
    });
    return shell.querySelector('#app');
  }

  // Toda troca de vista, filtro ou janela vira um passo no histórico: o voltar do celular e do mouse desfaz o último passo.
  function irPara(mudancas) {
    const p = new URLSearchParams(location.search);
    Object.entries(mudancas).forEach(([k, v]) => (v == null ? p.delete(k) : p.set(k, v)));
    history.pushState({ kv: true }, '', '?' + p);
  }
  const aoVoltar = (fn) => addEventListener('popstate', fn);
  const param = (k) => new URLSearchParams(location.search).get(k);

  let avisoTimer = null;
  function aviso(texto, { erro = false } = {}) {
    let el = document.querySelector('.recado');
    if (!el) { el = document.createElement('div'); el.setAttribute('role', 'status'); document.body.append(el); }
    el.className = 'recado' + (erro ? ' erro' : '');
    el.textContent = texto;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => el.remove(), erro ? 6000 : 3000);
  }

  window.KVShell = { montar, irPara, aoVoltar, param, aviso, icones: () => window.lucide && lucide.createIcons() };
})();

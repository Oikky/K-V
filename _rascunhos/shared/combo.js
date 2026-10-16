/* RASCUNHO DESCARTÁVEL: seleção com busca.
   Toda lista longa (mais de 8 opções) vira um campo onde se digita: o que se escreve filtra as opções
   e aí se escolhe. O <select> original continua no lugar, escondido, e recebe o valor escolhido
   (com os eventos input/change), então o resto do código não precisa mudar. */
(function () {
  const LIMITE = 8;
  const sem = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let n = 0;

  function melhorar(sel) {
    if (sel.dataset.combo === 'feito' || sel.multiple) return;
    sel.dataset.combo = 'feito';
    const id = 'combo' + (++n);
    const caixa = document.createElement('div');
    caixa.className = 'combo';
    caixa.innerHTML = `<input type="text" class="combo-in" role="combobox" aria-expanded="false" aria-controls="${id}" aria-autocomplete="list" autocomplete="off" spellcheck="false">
      <svg class="combo-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      <ul class="combo-lista" id="${id}" role="listbox" hidden></ul>`;
    sel.after(caixa);
    sel.hidden = true; sel.tabIndex = -1;
    const inp = caixa.querySelector('input');
    const lista = caixa.querySelector('ul');
    if (sel.id) { const lab = document.querySelector(`label[for="${sel.id}"]`); if (lab) { inp.id = sel.id + '-busca'; lab.htmlFor = inp.id; } }
    if (sel.getAttribute('aria-label')) inp.setAttribute('aria-label', sel.getAttribute('aria-label'));
    inp.placeholder = 'Digite pra buscar';

    let itens = []; let ativo = -1;
    const rotulo = () => { const o = sel.options[sel.selectedIndex]; return o ? o.textContent.trim() : ''; };
    const mostrarValor = () => { inp.value = rotulo(); };
    // a lista flutua presa ao campo (position: fixed), pra não ser cortada por tabelas que rolam ou por janelas
    const posicionar = () => {
      const r = inp.getBoundingClientRect(); const cabeEmbaixo = innerHeight - r.bottom > 220 || r.top < 260;
      const larg = Math.min(Math.max(r.width, 240), innerWidth - 16);
      lista.style.left = Math.max(8, Math.min(r.left, innerWidth - larg - 8)) + 'px'; lista.style.width = larg + 'px';
      lista.style.top = cabeEmbaixo ? (r.bottom + 6) + 'px' : ''; lista.style.bottom = cabeEmbaixo ? '' : (innerHeight - r.top + 6) + 'px';
    };
    const abrir = () => { caixa.classList.add('aberto'); lista.hidden = false; inp.setAttribute('aria-expanded', 'true'); posicionar(); };
    addEventListener('scroll', () => { if (!lista.hidden) posicionar(); }, true);
    addEventListener('resize', () => { if (!lista.hidden) posicionar(); });
    const fechar = () => { caixa.classList.remove('aberto'); lista.hidden = true; inp.setAttribute('aria-expanded', 'false'); ativo = -1; };
    function filtrar(termo) {
      const t = sem(termo.trim());
      const partes = t.split(/\s+/).filter(Boolean);
      itens = [...sel.options].filter((o) => !o.disabled || o.value === '').map((o, i) => ({ o, i }))
        .filter(({ o }) => !partes.length || partes.every((p) => sem(o.textContent).includes(p)));
      lista.innerHTML = itens.length
        ? itens.map(({ o }, k) => `<li role="option" id="${id}-${k}" data-k="${k}" aria-selected="${o.selected}" ${o.disabled ? 'aria-disabled="true"' : ''}>${marcar(o.textContent.trim(), partes)}</li>`).join('')
        : '<li class="vazio">Nada encontrado</li>';
      ativo = itens.length ? 0 : -1; destacar();
    }
    function marcar(texto, partes) {
      if (!partes.length) return esc(texto);
      const base = sem(texto); let out = ''; let i = 0;
      const marcas = new Array(texto.length).fill(false);
      partes.forEach((p) => { let j = base.indexOf(p); while (j !== -1) { for (let k = j; k < j + p.length; k++) marcas[k] = true; j = base.indexOf(p, j + p.length); } });
      for (; i < texto.length; i++) out += marcas[i] && !marcas[i - 1] ? '<mark>' + esc(texto[i]) : !marcas[i] && marcas[i - 1] ? '</mark>' + esc(texto[i]) : esc(texto[i]);
      return out + (marcas[texto.length - 1] ? '</mark>' : '');
    }
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    function destacar() {
      lista.querySelectorAll('li[data-k]').forEach((li) => li.classList.toggle('ativo', +li.dataset.k === ativo));
      const li = lista.querySelector(`li[data-k="${ativo}"]`);
      if (li) { li.scrollIntoView({ block: 'nearest' }); inp.setAttribute('aria-activedescendant', li.id); }
    }
    function escolher(k) {
      const it = itens[k]; if (!it || it.o.disabled) return;
      sel.selectedIndex = it.i;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      mostrarValor(); fechar();
    }

    inp.addEventListener('focus', () => { inp.select(); filtrar(''); abrir(); });
    inp.addEventListener('click', () => { if (lista.hidden) { filtrar(''); abrir(); } });
    inp.addEventListener('input', () => { filtrar(inp.value); abrir(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (lista.hidden) { filtrar(''); abrir(); } else { ativo = Math.min(itens.length - 1, ativo + 1); destacar(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ativo = Math.max(0, ativo - 1); destacar(); }
      else if (e.key === 'Enter') { if (!lista.hidden) { e.preventDefault(); escolher(ativo); } }
      else if (e.key === 'Escape') { if (!lista.hidden) { e.preventDefault(); e.stopPropagation(); mostrarValor(); fechar(); } }
      else if (e.key === 'Tab') { if (!lista.hidden && inp.value !== rotulo() && ativo >= 0) escolher(ativo); else { mostrarValor(); fechar(); } }
    });
    lista.addEventListener('pointerdown', (e) => e.preventDefault()); // não perde o foco ao tocar na lista
    lista.addEventListener('click', (e) => { const li = e.target.closest('li[data-k]'); if (li) escolher(+li.dataset.k); });
    inp.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== inp) { mostrarValor(); fechar(); } }, 120));
    // se o código trocar as opções ou o valor do select, o campo acompanha
    new MutationObserver(() => { if (document.activeElement !== inp) mostrarValor(); }).observe(sel, { childList: true, subtree: true, attributes: true });
    sel.addEventListener('change', () => { if (document.activeElement !== inp) mostrarValor(); });
    mostrarValor();
  }

  function varrer(raiz) {
    (raiz || document).querySelectorAll('select:not([data-combo="feito"]):not([data-combo="nao"])').forEach((s) => {
      if (s.options.length > LIMITE || s.dataset.combo === 'sim') melhorar(s);
    });
  }
  // telas se redesenham o tempo todo: toda vez que aparece um select novo, ele é melhorado
  new MutationObserver(() => varrer()).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('DOMContentLoaded', () => varrer());
  window.KVCombo = { melhorar, varrer };
})();

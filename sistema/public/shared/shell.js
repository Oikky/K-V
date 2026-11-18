/* Menu lateral, tema e navegação (voltar desfaz o último passo). Igual aos rascunhos, sem a barra de variações. */
(function () {
  const TEMA_KEY = 'kv-tema';
  try { const t = localStorage.getItem(TEMA_KEY); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  // sem href = tela ainda não passou dos rascunhos pro sistema
  const ITENS = [
    { id: 'painel', nome: 'Painel', icone: 'layout-dashboard', href: 'painel.html' },
    { id: 'orcamentos', nome: 'Orçamentos', icone: 'plane', href: 'orcamentos.html' },
    { id: 'contas', nome: 'Contas de pontos', icone: 'wallet', href: 'contas.html', soDono: true },
    { id: 'clientes', nome: 'Clientes', icone: 'users', href: 'clientes.html', soDono: true },
    { id: 'agenda', nome: 'Agenda', icone: 'calendar-days', href: 'agenda.html', soDono: true },
    { id: 'financeiro', nome: 'Financeiro', icone: 'chart-column', href: 'financeiro.html', soDono: true },
    { id: 'ponto', nome: 'Ponto', icone: 'timer', href: 'ponto.html', hrefDono: 'folha.html' },
    { id: 'config', nome: 'Configurações', icone: 'settings', href: 'programas.html', soDono: true },
  ];

  // Monta a tela: o menu fica sempre o mesmo (só muda o item ativo) e a área da tela é trocada por uma nova.
  // A tela de antes some aqui, no instante em que a nova já tem o que mostrar.
  function montar(ativo, { dono = false } = {}) {
    const itens = ITENS.filter((i) => dono || (!i.soDono && i.id !== 'painel')).map((i) => ({ ...i, href: dono && i.hrefDono ? i.hrefDono : i.href }));
    const admin = !!window.KVAdmin, eu = window.KVEu || null, vendo = !!(eu && eu.admin);
    let shell = document.querySelector('.shell');
    if (!shell) { shell = document.createElement('div'); shell.className = 'shell'; document.body.prepend(shell); }
    const assinatura = JSON.stringify([itens.map((i) => i.id + i.href), admin, eu && [eu.email, eu.foto], (window.KVEquipe || []).map((u) => u.email + u.foto)]);
    if (shell.dataset.assinatura !== assinatura) {
      shell.dataset.assinatura = assinatura;
      shell.innerHTML = `<nav class="rail" aria-label="Menu">
          <div class="marca">K<b>&amp;</b>V</div>
          <div class="cab-m"><span class="logo"><img src="shared/logo.png" alt=""><span class="txt"><b>K<i>&amp;</i>V</b><small>Easy Traveling</small></span></span><button class="bt-menu" type="button" data-menu-acao></button></div>
          ${itens.map((i) => `<a href="${i.href || '#'}" data-item="${i.id}" ${i.href ? '' : 'aria-disabled="true"'} aria-label="${i.nome}">
            <i data-lucide="${i.icone}"></i><span class="dica">${i.nome}${i.href ? '' : ' (em breve)'}</span></a>`).join('')}
          <a href="#" class="baixo" id="tema" aria-label="Trocar tema"><i data-lucide="sun-moon"></i><span class="dica">Trocar tema</span></a>
          ${eu ? `<a href="#" id="perfil" class="${vendo ? 'vendo' : ''}" aria-label="${vendo ? `Vendo como ${esc(eu.nome)}` : 'Seu perfil'}">${avatar(eu)}<span class="dica">${vendo ? `Vendo como ${esc(eu.nome)} · trocar` : esc(eu.nome)}</span></a>` : ''}
        </nav><main class="area" id="app"></main>
        <button class="bt-menu abre-menu" type="button" data-menu-acao="cheio" aria-label="Mostrar o menu (Ctrl+B)" title="Mostrar o menu (Ctrl+B)" aria-keyshortcuts="Control+B"><i data-lucide="panel-left-open"></i></button>
        ${vendo ? `<button class="vendo-faixa" type="button" data-voltar-eu>${avatar(eu)}<span>Vendo como <b>${esc(primeiro(eu.nome))}</b></span><span class="sair">Voltar pra mim</span></button>` : ''}
        <dialog class="janela perfil-janela" aria-label="Perfil"></dialog>`;
      shell.querySelectorAll('[aria-disabled="true"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
      shell.querySelector('#tema').addEventListener('click', (e) => { e.preventDefault(); trocarTema(); });
      const pf = shell.querySelector('#perfil');
      if (pf) pf.addEventListener('click', (e) => { e.preventDefault(); irPara({ perfil: 1 }); sincPerfil(); });
      const vf = shell.querySelector('[data-voltar-eu]');
      if (vf) vf.addEventListener('click', () => verComo(''));
      document.body.classList.toggle('vendo-como', vendo);
      shell.querySelectorAll('[data-menu-acao]').forEach((bt) => bt.addEventListener('click', () => modoMenu(bt.dataset.menuAcao || PROX[modoAtual()])));
      modoMenu(modoAtual());
    }
    shell.querySelectorAll('.rail [data-item]').forEach((a) => { if (a.dataset.item === ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const velho = shell.querySelector('#app'), novo = document.createElement('main');
    novo.className = 'area'; novo.id = 'app';
    velho.replaceWith(novo);
    if (window.KVRota) KVRota.aplicarCss();
    if (window.lucide) lucide.createIcons();
    return novo;
  }

  // ---------- menu: cheio → só ícones → escondido → cheio (fica lembrado neste computador) ----------
  const MENU_KEY = 'kv-menu', PROX = { cheio: 'icones', icones: 'fora', fora: 'cheio' };
  const ROT = { cheio: ['panel-left-close', 'Diminuir o menu'], icones: ['panel-left-dashed', 'Esconder o menu (Ctrl+B)'] };
  const modoAtual = () => document.documentElement.dataset.menuModo || 'cheio';
  try { document.documentElement.dataset.menuModo = localStorage.getItem(MENU_KEY) || 'cheio'; } catch (e) { document.documentElement.dataset.menuModo = 'cheio'; }
  function modoMenu(m) {
    document.documentElement.dataset.menuModo = m;
    try { localStorage.setItem(MENU_KEY, m); } catch (e) {}
    const b = document.querySelector('.rail [data-menu-acao]');
    if (b && ROT[m]) { b.innerHTML = `<i data-lucide="${ROT[m][0]}"></i>`; b.setAttribute('aria-label', ROT[m][1]); b.title = ROT[m][1]; if (window.lucide) lucide.createIcons(); }
    if (m === 'fora') { const ab = document.querySelector('.abre-menu'); if (ab && b && b.contains(document.activeElement)) ab.focus(); }
  }
  // Ctrl+B mostra/esconde (volta pro modo de antes de esconder); ligado antes de qualquer tela, então vale sempre
  let antesDeEsconder = 'cheio';
  addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'b' || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const m = modoAtual();
    if (m === 'fora') modoMenu(antesDeEsconder); else { antesDeEsconder = m; modoMenu('fora'); }
  });

  // ---------- perfil: foto no canto; o admin troca de pessoa por aqui ----------
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const primeiro = (n) => String(n || '').trim().split(/\s+/)[0];
  const PAPEL = { dono: 'Dono', admin: 'Admin', pesquisador: 'Pesquisador' };
  const papelDe = (u) => PAPEL[u.papel] + (u.papel !== 'pesquisador' && u.pesquisa ? ' · pesquisa' : '');
  // foto do Google; sem foto (ou se ela não carregar), a inicial do nome
  function avatar(u, tam = '') {
    const ini = esc(primeiro(u.nome).slice(0, 1).toUpperCase() || '?');
    return `<span class="avatar ${tam}" aria-hidden="true">${ini}${u.foto ? `<img src="${esc(u.foto)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()">` : ''}</span>`;
  }

  // o admin usa o sistema como outra pessoa da equipe ('' = ele mesmo); vale só neste navegador
  const VER_KEY = 'kv-ver-como';
  function verComo(email) {
    if (email === undefined) { try { const v = localStorage.getItem(VER_KEY) || ''; return v.includes('@') ? v : ''; } catch (e) { return ''; } }
    try { if (email) localStorage.setItem(VER_KEY, email); else localStorage.removeItem(VER_KEY); } catch (e) {}
    KVApi.esquecer();
    const alvo = (window.KVEquipe || []).find((u) => u.email === email);
    aviso(alvo ? `Agora você está vendo como ${primeiro(alvo.nome)}` : 'Voltou pra sua conta');
    KVRota.trocar('orcamentos.html');
    const dlg = document.querySelector('.perfil-janela');
    if (dlg && dlg.open) { dlg.onclose = null; dlg.close(); }
  }

  function desenharPerfil(dlg) {
    const eu = window.KVEu; if (!eu) return;
    const real = eu.admin || eu, equipe = window.KVEquipe;
    const linha = (u) => {
      const atual = u.email === eu.email, sou = u.email === real.email;
      return `<li><button type="button" class="pessoa-op" data-como="${esc(sou ? '' : u.email)}" ${atual ? 'aria-current="true"' : ''}>
        ${avatar(u, 'm')}<span class="txt"><b>${esc(u.nome)}${sou ? ' <span class="voce">(você)</span>' : ''}</b><span>${papelDe(u)}</span></span>
        ${atual ? '<i data-lucide="check"></i>' : ''}</button></li>`;
    };
    dlg.innerHTML = `<header><div class="perfil-eu">${avatar(real, 'g')}<div><b>${esc(real.nome)}</b><span>${esc(real.email)}</span></div></div>
        <button class="btn icone" type="button" data-fechar aria-label="Fechar" style="margin-left:auto"><i data-lucide="x"></i></button></header>
      <div class="corpo">
        ${equipe ? `<p class="perfil-tit">Ver o sistema como</p>
          <p class="perfil-sub">Igual a entrar na conta da pessoa: o que você gravar sai no nome dela (o histórico anota que foi você).</p>
          <ul class="perfil-lista">${equipe.map(linha).join('')}</ul>` : `<p class="perfil-sub">${papelDe(eu)}</p>`}
      </div>
      <footer><a class="btn" href="extensao.html" data-ext-j><i data-lucide="puzzle"></i>Extensão do Chrome</a><button class="btn" type="button" data-tema-j><i data-lucide="sun-moon"></i>Trocar tema</button></footer>`;
    dlg.querySelector('[data-fechar]').onclick = () => dlg.close();
    dlg.querySelector('[data-tema-j]').onclick = trocarTema;
    dlg.querySelector('[data-ext-j]').onclick = () => { dlg.onclose = null; dlg.close(); };
    dlg.querySelectorAll('[data-como]').forEach((b) => { b.onclick = () => (b.hasAttribute('aria-current') ? dlg.close() : verComo(b.dataset.como)); });
    if (window.lucide) lucide.createIcons();
  }
  function sincPerfil() {
    const dlg = document.querySelector('.perfil-janela'); if (!dlg) return;
    const quer = param('perfil') === '1';
    if (quer && !dlg.open) {
      desenharPerfil(dlg); dlg.showModal();
      // fechar (X, Esc, tocar fora) desfaz o passo do histórico
      dlg.onclose = () => { if (param('perfil') === '1') desfazer({ perfil: 1 }, () => {}); };
      dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); };
    } else if (!quer && dlg.open) { dlg.onclose = null; dlg.close(); }
  }
  addEventListener('popstate', sincPerfil);
  function trocarTema() {
    const novo = document.documentElement.dataset.theme === 'claro' ? 'escuro' : 'claro';
    document.documentElement.dataset.theme = novo;
    try { localStorage.setItem(TEMA_KEY, novo); } catch (err) {}
  }

  // Toda troca de vista, filtro ou janela vira um passo no histórico: o voltar do celular e do mouse desfaz o último passo.
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

  let avisoTimer = null;
  // aviso no rodapé. Com { desfazer: async () => {...} } ganha o botão "Desfazer" e fica mais tempo (8 s);
  // passar o mouse ou o dedo segura o aviso na tela.
  function aviso(texto, { erro = false, desfazer = null, rotulo = 'Desfazer' } = {}) {
    let el = document.querySelector('.recado');
    if (!el) { el = document.createElement('div'); el.setAttribute('role', 'status'); document.body.append(el); }
    el.className = 'recado' + (erro ? ' erro' : '') + (desfazer ? ' com-acao' : '');
    el.textContent = '';
    const t = document.createElement('span'); t.textContent = texto; el.append(t);
    const tempo = erro ? 6000 : desfazer ? 8000 : 3000;
    const sumir = () => { clearTimeout(avisoTimer); avisoTimer = setTimeout(() => el.remove(), tempo); };
    if (desfazer) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn pequeno'; b.textContent = rotulo;
      b.onclick = async () => {
        clearTimeout(avisoTimer);
        try { await desfazer(); el.remove(); } catch (e) { aviso(e.message, { erro: true }); }
      };
      el.append(b);
      el.onpointerenter = () => clearTimeout(avisoTimer); el.onpointerleave = sumir;
    } else { el.onpointerenter = el.onpointerleave = null; }
    sumir();
  }

  // pergunta antes de algo que mexe no trabalho de outra pessoa: KVShell.confirmar({ titulo, texto, sim }) → true/false
  function confirmar({ titulo, texto = '', sim = 'Sim', icone = 'check' }) {
    return new Promise((ok) => {
      const d = document.createElement('dialog'); d.className = 'janela'; d.style.width = 'min(440px, calc(100vw - 32px))';
      d.innerHTML = `<header><div style="flex:1"><h2>${titulo}</h2></div></header>
        ${texto ? `<div class="corpo"><p style="margin:0 0 12px;line-height:1.55;color:var(--text-2)">${texto}</p></div>` : ''}
        <footer><button class="btn" type="button" data-nao>Cancelar</button><button class="btn primario" type="button" data-sim><i data-lucide="${icone}"></i>${sim}</button></footer>`;
      let r = false;
      d.querySelector('[data-nao]').onclick = () => d.close();
      d.querySelector('[data-sim]').onclick = () => { r = true; d.close(); };
      d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
      d.onclose = () => { d.remove(); ok(r); };
      document.body.append(d); d.showModal(); if (window.lucide) lucide.createIcons();
      d.querySelector('[data-sim]').focus();
    });
  }

  window.KVShell = { montar, confirmar, verComo, irPara, desfazer, aoVoltar, param, aviso, icones: () => window.lucide && lucide.createIcons() };
})();

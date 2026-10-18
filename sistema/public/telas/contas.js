/* Tela: Lista de contas de pontos. Endereço: /contas.html
   Lista de contas (rodada 5 dos rascunhos), lendo do banco: "Por titular" (padrão) ou "Tabela". A tabela abre em titular A–Z e, no mesmo titular,
     programa A–Z. Filtros em lista de seleção; clicar no nome das colunas ordena por várias delas, na ordem dos cliques. Sem valor em R$. Só o dono.
   O estilo desta tela está em telas/contas.css. */
KVTelas['contas'] = function () {
  let app = null, contas = [];
  const { fmt, esc } = KV;
  const P = (id) => KV.programa(id);
  const estado = { busca: '' };
  const COLUNAS = [
    { id: 'titular', nome: 'Titular', valor: (c) => c.titular, texto: true },
    { id: 'programa', nome: 'Programa', valor: (c) => P(c.programaId).nome, texto: true },
    { id: 'saldo', nome: 'Saldo', valor: (c) => c.saldo, dir: true },
    { id: 'vence', nome: 'Vence em 60 dias', valor: (c) => KV.vencendo(c).pontos },
    { id: 'ben', nome: 'Beneficiários', valor: (c) => { const b = KV.beneficiarios(c); return b ? b.usados / b.limite : -1; } },
    { id: 'clube', nome: 'Clube', valor: (c) => c.clube || 0 },
  ];
  function lerUrl() {
    estado.vista = KVShell.param('vista') || 'titular';
    estado.ordem = KVShell.param('ordem') || 'pontos';
    estado.prog = KVShell.param('prog') || 'todos';
    estado.situacao = KVShell.param('situacao') || 'todas';
    // ordem por várias colunas, na ordem em que foram clicadas: ?ord=programa:asc,saldo:desc
    estado.ord = (KVShell.param('ord') || '').split(',').filter(Boolean).map((t) => { const [col, dir] = t.split(':'); return { col, dir }; }).filter((o) => COLUNAS.some((c) => c.id === o.col));
  }
  function vagas(c, comBarra = true) {
    const b = KV.beneficiarios(c);
    if (!b) return '<span class="faint">só transfere</span>';
    const cls = b.livres === 0 ? 'danger' : b.livres <= 2 ? 'warn' : '';
    return `<span class="num" style="${cls ? `color:var(--${cls})` : 'color:var(--text-2)'}">${b.usados}/${b.limite}</span>${comBarra ? `<div class="barra ${cls}"><i style="width:${b.usados / b.limite * 100}%"></i></div>` : ''}`;
  }
  function venc(c) {
    const v = KV.vencendo(c);
    return v.pontos ? `<span class="chip warn"><i data-lucide="hourglass"></i>${fmt.pts(v.pontos)} em ${KV.diasAte(v.primeiro)}d</span>` : '';
  }
  const passo = (mud) => { KVShell.irPara(mud); lerUrl(); desenhar(); };

  // cada coluna clicada entra no fim da fila de ordenação (1, 2, 3...).
  // 1º clique: texto A→Z, números maior→menor; 2º: inverte; 3º: sai da fila
  const gravarOrdem = (ord) => passo({ ord: ord.length ? ord.map((o) => o.col + ':' + o.dir).join(',') : null });
  function cliqueColuna(id) {
    const col = COLUNAS.find((c) => c.id === id);
    const primeiro = col.texto ? 'asc' : 'desc';
    const ord = estado.ord.map((o) => ({ ...o }));
    const i = ord.findIndex((o) => o.col === id);
    if (i < 0) ord.push({ col: id, dir: primeiro });
    else if (ord[i].dir === primeiro) ord[i].dir = primeiro === 'asc' ? 'desc' : 'asc';
    else ord.splice(i, 1);
    gravarOrdem(ord);
  }
  // ordem padrão: titular A–Z e, no mesmo titular, programa A–Z (as contas da pessoa ficam juntas)
  const az = (a, b) => a.titular.localeCompare(b.titular, 'pt-BR') || P(a.programaId).nome.localeCompare(P(b.programaId).nome, 'pt-BR');
  function ordenar(lista) {
    const regras = estado.ord.map((o) => ({ col: COLUNAS.find((c) => c.id === o.col), s: o.dir === 'asc' ? 1 : -1 }));
    return lista.sort((a, b) => {
      for (const { col, s } of regras) {
        const x = col.valor(a), y = col.valor(b);
        const d = (col.texto ? String(x).localeCompare(String(y), 'pt-BR') : x - y) * s;
        if (d) return d;
      }
      return az(a, b);
    });
  }
  const sel = (id, rotulo, opcoes, atual, padrao) => `<label class="sel ${atual !== padrao ? 'ativo' : ''}"><span class="escondido">${rotulo}</span>
    <select id="${id}" data-combo="nao">${opcoes.map(([v, t]) => `<option value="${v}" ${v === atual ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;

  function desenhar() {
    const titulares = KV.titulares().map((t) => { const cs = contas.filter((c) => c.titularId === t.id); return { nome: t.nome, contas: cs, pontos: cs.reduce((s, c) => s + c.saldo, 0) }; });
    const comAviso = new Set(KV.alertas().map((a) => a.conta));
    const tabela = estado.vista === 'tabela';
    app.innerHTML = `<div class="topo"><div><h1>Contas de pontos</h1><div class="muted">${titulares.length} titulares · ${contas.length} contas</div></div>
        <div class="acoes"><a class="btn" href="entrada.html"><i data-lucide="plus"></i>Entrada</a>
        <a class="btn primario" href="nova-conta.html"><i data-lucide="wallet"></i>Nova conta</a></div></div>
      <div class="filtros">
        <div class="seg" role="group" aria-label="Como ver">
          <button data-vista="titular" aria-pressed="${!tabela}"><i data-lucide="users"></i>Por titular</button>
          <button data-vista="tabela" aria-pressed="${tabela}"><i data-lucide="table"></i>Tabela</button></div>
        ${!tabela ? sel('ordem', 'Ordenar', [['pontos', 'Mais pontos primeiro'], ['programas', 'Mais programas primeiro']], estado.ordem, 'pontos')
        : sel('prog', 'Programa', [['todos', `Programa: todos`], ...KV.programas().map((p) => [p.id, `${p.nome} (${contas.filter((c) => c.programaId === p.id).length})`])], estado.prog, 'todos')
          + sel('situacao', 'Situação', [['todas', 'Situação: todas'], ['aviso', `Só com aviso (${comAviso.size})`], ['semvaga', 'Sem vaga de beneficiário'], ['vencendo', 'Com pontos vencendo']], estado.situacao, 'todas')}
        ${tabela && estado.ord.length ? `<button class="pilula" data-limpar-ordem><i data-lucide="x"></i>Ordem: ${estado.ord.map((o, i) => `${i + 1}. ${COLUNAS.find((c) => c.id === o.col).nome}`).join(' · ')}</button>` : ''}
        <div class="busca-wrap"><i data-lucide="search"></i><input class="busca" placeholder="Buscar titular" value="${esc(estado.busca)}" aria-label="Buscar titular"></div>
      </div><div id="lista"></div>`;

    const busca = (t) => !estado.busca || t.toLowerCase().includes(estado.busca.toLowerCase());
    const lista = app.querySelector('#lista');
    if (!tabela) {
      const ordenados = titulares.filter((t) => busca(t.nome)).sort((a, b) => estado.ordem === 'programas' ? (b.contas.length - a.contas.length) || (b.pontos - a.pontos) : b.pontos - a.pontos);
      lista.innerHTML = `<div class="grade-tit">${ordenados.map((t) => `<section class="tit">
        <header><div class="av">${esc(fmt.iniciais(t.nome))}</div><div><h3>${esc(t.nome)}</h3><div class="faint" style="font-size:13px">${t.contas.length} programa${t.contas.length > 1 ? 's' : ''}</div></div>
          <div class="tot">no total<b class="num">${fmt.pts(t.pontos)}</b></div></header>
        ${t.contas.sort((a, b) => b.saldo - a.saldo).map((c) => `<a class="linha-conta" href="conta.html?id=${c.id}"><span class="prog" data-p="${c.programaId}">${P(c.programaId).nome}</span>
          <span class="s num">${fmt.pts(c.saldo)} pts</span><span class="det">${KV.beneficiarios(c) ? 'Vagas ' + vagas(c) : vagas(c)} ${venc(c)}</span></a>`).join('')}
      </section>`).join('') || '<p class="muted">Nenhum titular com esse nome.</p>'}</div>`;
    } else {
      const passa = (c) => (estado.prog === 'todos' || c.programaId === estado.prog) && busca(c.titular) && (
        estado.situacao === 'todas' || (estado.situacao === 'aviso' && comAviso.has(c)) ||
        (estado.situacao === 'semvaga' && KV.beneficiarios(c) && KV.beneficiarios(c).livres === 0) || (estado.situacao === 'vencendo' && KV.vencendo(c).pontos > 0));
      const linhas = ordenar(contas.filter(passa));
      const th = (c) => { const i = estado.ord.findIndex((o) => o.col === c.id); const o = estado.ord[i];
        const sort = o && i === 0 ? (o.dir === 'asc' ? 'ascending' : 'descending') : null;
        return `<th class="ord ${c.dir ? 'dir' : ''} ${o ? 'ativa' : ''}" ${sort ? `aria-sort="${sort}"` : ''}><button data-col="${c.id}" title="Clique pra ordenar; clique em outra coluna pra somar">${c.nome}<i class="seta" data-lucide="${o && o.dir === 'asc' ? 'arrow-up' : 'arrow-down'}"></i>${o && estado.ord.length > 1 ? `<span class="prio" aria-label="prioridade ${i + 1}">${i + 1}</span>` : ''}</button></th>`; };
      lista.innerHTML = `<div class="tabela-wrap"><table>
        <thead><tr>${COLUNAS.map(th).join('')}</tr></thead>
        <tbody>${linhas.map((c) => `<tr class="clicavel" onclick="KVRota.ir('conta.html?id=${c.id}')">
          <td data-c="titular"><b>${esc(c.titular)}</b></td><td data-c="programa"><span class="prog" data-p="${c.programaId}">${P(c.programaId).nome}</span></td>
          <td data-c="saldo" class="dir num"><b>${fmt.pts(c.saldo)}</b></td>
          <td data-c="vence">${venc(c) || '<span class="faint">—</span>'}</td>
          <td data-c="ben"><div style="display:inline-flex;gap:10px;align-items:center">${vagas(c)}</div></td>
          <td data-c="clube" class="muted num">${c.clube ? fmt.pts(c.clube) + '/mês' : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nenhuma conta com esse filtro.</td></tr>'}</tbody></table></div>`;
    }

    app.querySelectorAll('[data-vista]').forEach((b) => b.onclick = () => { if (b.dataset.vista !== estado.vista) passo({ vista: b.dataset.vista }); });
    app.querySelectorAll('[data-col]').forEach((b) => b.onclick = () => cliqueColuna(b.dataset.col));
    const lo = app.querySelector('[data-limpar-ordem]'); if (lo) lo.onclick = () => gravarOrdem([]);
    const on = (id, fn) => { const e = app.querySelector('#' + id); if (e) e.onchange = () => fn(e.value); };
    on('ordem', (v) => passo({ ordem: v }));
    on('prog', (v) => passo({ prog: v === 'todos' ? null : v }));
    on('situacao', (v) => passo({ situacao: v === 'todas' ? null : v }));
    const bu = app.querySelector('.busca'); bu.oninput = (e) => { estado.busca = e.target.value; const pos = e.target.selectionStart; desenhar(); const n = app.querySelector('.busca'); n.focus(); n.setSelectionRange(pos, pos); };
    KVShell.icones();
  }
  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const est = await KV.carregar();
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      contas = KV.contas();
      document.querySelector('.carregando').remove();
      app = KVShell.montar('contas', { dono: true });
      lerUrl(); desenhar();
      KVShell.aoVoltar(() => { lerUrl(); desenhar(); });
    } catch (e) { const c = document.querySelector('.carregando'); if (c) c.textContent = e.message; }
  })();
};

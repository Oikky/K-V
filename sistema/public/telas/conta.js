/* Tela: Uma conta: extrato e beneficiários. Endereço: /conta.html
   Conta (rodada 3 dos rascunhos), lendo e gravando no banco: extrato + coluna lateral, beneficiários em bolinhas.
     Clicar nas bolinhas abre a lista e o cadastro manual numa janela; o voltar do celular/mouse fecha a janela. Sem valor em R$. Só o dono.
   O estilo desta tela está em telas/conta.css. */
KVTelas['conta'] = function () {
  let app = null, c = null, p = null, custo = null;
  const { fmt, esc } = KV;
  const params = new URLSearchParams(location.search);
  let mensagem = '';
  async function recarregar() { c = KV.adaptar(await KVApi.conta(params.get('id'))); p = KV.programa(c.programaId); custo = c.custo_real; }
  let extratoTodo = false;

  const progNome = (id) => (KV.programa(id) || {}).nome || id;
  function descricao(m) {
    if (m.tipo === 'clube') return `Clube ${fmt.pts(m.pontos)}`;
    if (m.tipo === 'transferencia' && m.lado === 'entrada') return `Transferência da ${m.par_programa ? `${progNome(m.par_programa)} de ${m.par_titular}` : m.origem || 'outro programa'}${m.bonus_pct ? `, bônus de ${m.bonus_pct}%` : ''}`;
    if (m.tipo === 'transferencia') return `Transferência para ${m.par_programa ? `${progNome(m.par_programa)} de ${m.par_titular}` : 'outro programa'}`;
    if (m.tipo === 'emissao') return `Emissão ${(m.obs || '').replace(/\s*\([A-Z0-9]+\)$/, '')}`;
    if (m.tipo === 'ajuste') return `Ajuste${m.obs ? `: ${m.obs}` : ''}`;
    return ((m.lado === 'entrada' ? KV.entradaTipos : KV.saidaTipos)[m.tipo] || { nome: m.tipo }).nome;
  }
  function detalhe(m) {
    if (m.tipo === 'emissao') return [m.passageiros, m.localizador].filter(Boolean).join(' · ');
    if (m.custo) return `Custo ${fmt.brl(m.custo)}`;
    if (m.lado === 'entrada' && m.vence) return `Vence em ${fmt.data(m.vence)}`;
    return m.lado === 'saida' && m.tipo !== 'ajuste' ? m.obs || '' : '';
  }
  const linhaMov = (m) => `<div class="mov"><span class="d num">${fmt.dataCurta(m.data)}</span><span><b>${esc(descricao(m))}</b></span>
    <span class="q num ${m.lado === 'entrada' ? 'mais' : ''}">${m.lado === 'entrada' ? '+' : '−'}${fmt.pts(m.pontos)}</span>
    <span class="x"><span>${esc(detalhe(m))}</span><span class="num faint">saldo ${fmt.pts(m.saldo_depois)}</span></span></div>`;

  function bolinhas(b) {
    // da mais antiga pra mais nova: quem passou do limite é sempre quem entrou por último
    const ordem = [...b.lista].sort((x, y) => x.ultima.localeCompare(y.ultima));
    return `<div class="vagas-grade">${Array.from({ length: Math.max(b.limite, b.lista.length) }, (_, i) => { const x = ordem[i];
      return `<span class="vaga ${x ? (x.manual ? 'manual' : 'usada') : ''} ${i >= b.limite ? 'estourou' : ''}" title="${x ? esc(x.nome) : 'vaga livre'}${i >= b.limite ? ' (acima do limite)' : ''}">${x ? esc(fmt.iniciais(x.nome)) : ''}</span>`; }).join('')}</div>`;
  }
  function resumoVagas(b) {
    const cor = b.livres === 0 ? 'var(--danger)' : b.livres <= 2 ? 'var(--warn)' : 'var(--text)';
    return `<b style="color:${cor}">${b.livres} vaga${b.livres === 1 ? '' : 's'} livre${b.livres === 1 ? '' : 's'}</b>`;
  }
  function blocoBenef() {
    const b = KV.beneficiarios(c);
    if (!b) return `<div class="card"><h2>Beneficiários</h2><p class="muted" style="margin:6px 0 0">A Livelo não emite passagem, só transfere. Não tem limite de beneficiários.</p></div>`;
    return `<div class="card"><h2>Beneficiários <small class="num">${b.usados} de ${b.limite}</small></h2>
      <button class="vagas-btn" id="abrir" aria-haspopup="dialog">${bolinhas(b)}
        <div class="vagas-resumo">${resumoVagas(b)}<span style="display:inline-flex;gap:4px;align-items:center">Ver pessoas<i data-lucide="chevron-right"></i></span></div></button>
      <div class="regra">${esc(b.regra)}. O titular não conta.</div></div>`;
  }

  // janela de beneficiários: ?ben=lista mostra as pessoas; ?ben=novo mostra o cadastro (na mesma janela)
  const janela = document.createElement('dialog');
  janela.className = 'janela';
  janela.setAttribute('aria-labelledby', 'jt');
  document.body.append(janela);
  janela.addEventListener('cancel', (e) => { e.preventDefault(); KVShell.param('ben') === 'novo' ? history.back() : fecharJanela(); }); // Esc
  janela.addEventListener('click', (e) => { if (e.target === janela) fecharJanela(); }); // clique fora
  function fecharJanela() {
    // se estava no cadastro, sai dos dois passos (cadastro e lista) de uma vez
    if (KVShell.param('ben') === 'novo' && history.state && history.state.kv) { history.go(-2); return; }
    KVShell.desfazer({ ben: 1 }, sincronizar);
  }

  function desenharJanela(modo) {
    const b = KV.beneficiarios(c);
    if (modo === 'novo') {
      janela.innerHTML = `<header><button class="btn icone" data-voltar aria-label="Voltar pra lista"><i data-lucide="arrow-left"></i></button>
          <div style="flex:1"><h2 id="jt">Adicionar beneficiário</h2><div class="sub">${esc(c.titular)} · ${p.nome}</div></div></header>
        <form class="novo-ben" id="novo">
          ${b.livres === 0 ? `<div class="aviso danger">A conta está sem vaga (${b.usados}/${b.limite}). Dá pra registrar mesmo assim, mas vai passar do limite.</div>` : ''}
          <div class="campo"><label for="bnome">Nome</label><input id="bnome" required placeholder="Nome completo" autocomplete="off"></div>
          <div class="campo"><label for="bcpf">CPF</label><input id="bcpf" required inputmode="numeric" placeholder="000.000.000-00" autocomplete="off"></div>
          <div class="campo"><label for="bdata">Desde quando</label><input id="bdata" type="date" value="${KV.hoje}"><span class="ajuda">Data da emissão ou do cadastro no programa. Define quando a vaga volta.</span></div>
        </form>
        <footer><button class="btn" data-voltar>Voltar pra lista</button><button class="btn primario" type="submit" form="novo"><i data-lucide="user-plus"></i>Adicionar</button></footer>`;
      janela.querySelectorAll('[data-voltar]').forEach((x) => x.onclick = () => history.back());
      janela.querySelector('#bcpf').addEventListener('input', (e) => { e.target.value = KVPessoaForm.mascaraCpf(e.target.value); });
      janela.querySelector('#novo').onsubmit = async (e) => {
        e.preventDefault();
        const novo = { nome: janela.querySelector('#bnome').value.trim(), cpf: janela.querySelector('#bcpf').value.replace(/\D/g, ''), data: janela.querySelector('#bdata').value };
        const semVaga = KV.beneficiarios(c).livres === 0;
        const bt = janela.querySelector('button[type=submit]'); bt.disabled = true;
        try { await KVApi.acao('benef.adicionar', { conta: c.id, ...novo }); await recarregar(); }
        catch (err) { KVShell.aviso(err.message, { erro: true }); bt.disabled = false; return; }
        mensagem = semVaga ? `<div class="aviso danger">${esc(novo.nome)} entrou acima do limite. O sistema avisa, mas não bloqueia.</div>`
          : `<div class="aviso ok">${esc(novo.nome)} entrou como beneficiário.</div>`;
        history.back(); // volta pra lista, que já mostra a pessoa nova
      };
      setTimeout(() => janela.querySelector('#bnome').focus(), 30);
    } else {
      janela.innerHTML = `<header><div style="flex:1"><h2 id="jt">Beneficiários</h2><div class="sub">${esc(c.titular)} · ${p.nome} · ${b.usados} de ${b.limite}</div></div>
          <button class="btn icone" data-fechar aria-label="Fechar"><i data-lucide="x"></i></button></header>
        <div class="corpo">${mensagem}${bolinhas(b)}<div class="vagas-resumo" style="margin-bottom:6px">${resumoVagas(b)}</div>
          <div class="regra" style="margin-bottom:10px">${esc(b.regra)}. O titular não conta.</div>
          ${b.lista.map((x) => `<div class="ben"><span>${esc(x.nome)}${x.manual ? '<span class="tag-manual">registrado à mão</span>' : ''}<br><span class="faint num" style="font-size:12.5px">${fmt.cpf(x.cpf)}</span></span>
            <span class="l">${x.liberaEm ? `libera em<br><span class="num">${fmt.data(x.liberaEm)}</span>` : 'só por troca manual'}</span></div>`).join('') || '<p class="faint">Ninguém voou com esta conta ainda.</p>'}</div>
        <footer><span class="faint" style="font-size:13px">O voltar do celular ou do mouse fecha</span><button class="btn primario" data-novo><i data-lucide="user-plus"></i>Adicionar beneficiário</button></footer>`;
      janela.querySelector('[data-fechar]').onclick = fecharJanela;
      janela.querySelector('[data-novo]').onclick = () => { mensagem = ''; KVShell.irPara({ ben: 'novo' }); sincronizar(); };
    }
    KVShell.icones();
  }

  // a URL manda: desenha a página e abre/fecha a janela conforme ?ben= e ?extrato=
  function sincronizar() {
    extratoTodo = KVShell.param('extrato') === 'todo';
    desenhar();
    const modo = KVShell.param('ben');
    if (modo === 'lista' || modo === 'novo') { desenharJanela(modo); if (!janela.open) janela.showModal(); }
    else if (janela.open) { janela.close(); mensagem = ''; }
  }
  KVShell.aoVoltar(() => { if (app) sincronizar(); });

  function desenhar() {
    const v = KV.vencendo(c);
    const movs = [...c.movimentos].reverse();
    app.innerHTML = `<a class="voltar" href="contas.html"><i data-lucide="arrow-left"></i>Contas de pontos</a>
      <div class="topo"><div><h1>${esc(c.titular)}</h1><div class="muted"><span class="prog" data-p="${c.programaId}">${p.nome}</span>${c.categoria ? ` · categoria ${c.categoria}` : ''}${c.clube ? ` · clube de ${fmt.pts(c.clube)}/mês` : ''}</div></div>
      <div class="acoes"><select class="trocar" aria-label="Ver outra conta" onchange="KVRota.ir('?id='+this.value)">
        ${KV.contas().map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.titular)} · ${KV.programa(x.programaId).nome}</option>`).join('')}</select>
        <a class="btn" href="saida.html?conta=${c.id}"><i data-lucide="minus"></i>Saída</a><a class="btn primario" href="entrada.html?conta=${c.id}"><i data-lucide="plus"></i>Entrada</a></div></div>
      <div class="extrato">
        <section class="card"><div style="display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap;margin-bottom:14px">
          <div><div class="muted" style="font-size:13px">Saldo</div><div class="saldo-grande num">${fmt.pts(c.saldo)}<small>pts</small></div></div>
          ${v.pontos ? `<span class="chip warn"><i data-lucide="hourglass"></i>${fmt.pts(v.pontos)} vencem em ${KV.diasAte(v.primeiro)} dias</span>` : ''}</div>
          <h2 style="margin:18px 0 4px">Extrato</h2>${movs.length ? '' : '<p class="faint">Nenhuma movimentação ainda.</p>'}${(extratoTodo ? movs : movs.slice(0, 8)).map(linhaMov).join('')}
          ${movs.length > 8 ? `<button class="btn" id="todo" style="margin-top:12px">${extratoTodo ? 'Mostrar só as últimas' : `Ver as ${movs.length} movimentações`}</button>` : ''}</section>
        <aside class="lado">${blocoBenef()}
          <div class="card"><h2>Vencimentos <small>próximos lotes</small></h2>
            ${c.lotes.length ? '' : '<p class="faint" style="margin:6px 0 0">Sem pontos guardados.</p>'}${c.lotes.slice(0, 5).map((l) => { const d = l.vence ? KV.diasAte(l.vence) : 9999; return `<div class="ben"><span>${fmt.pts(l.resta)} pts<br><span class="faint" style="font-size:12.5px">${esc(l.origem)} de ${fmt.data(l.data)}</span></span>
              <span class="l" style="${d <= 60 ? 'color:var(--warn);font-weight:700' : ''}">${l.vence ? fmt.data(l.vence) : 'sem data'}${d <= 60 ? `<br>em ${d} dias` : ''}</span></div>`; }).join('')}</div>
          <div class="card"><h2>Valor da milha</h2><dl class="dados">
            <dt>Usado na cotação</dt><dd class="num">${p.valorMilha ? fmt.milha(p.valorMilha) : '—'}</dd>
            <dt>Custo real desta conta</dt><dd class="num">${custo ? fmt.milha(custo) : '—'}</dd></dl></div>
        </aside></div>`;

    const abrir = app.querySelector('#abrir');
    if (abrir) abrir.onclick = () => { mensagem = ''; KVShell.irPara({ ben: 'lista' }); sincronizar(); };
    const todo = app.querySelector('#todo');
    if (todo) todo.onclick = () => { if (extratoTodo) KVShell.desfazer({ extrato: 1 }, sincronizar); else { KVShell.irPara({ extrato: 'todo' }); sincronizar(); } };
    KVShell.icones();
  }
  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const est = await KV.carregar();
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      if (!params.get('id') && KV.contas()[0]) params.set('id', KV.contas()[0].id);
      await recarregar();
      document.querySelector('.carregando').remove();
      app = KVShell.montar('contas', { dono: true });
      sincronizar();
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.innerHTML = `${esc(e.message)} <a href="contas.html" style="color:var(--orange)">Voltar pras contas</a>`; }
  })();
};

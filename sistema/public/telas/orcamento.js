/* Tela: Pesquisa de voos de um orçamento. Endereço: /orcamento.html
   Orçamento: a pesquisa de voos (rodada 8b dos rascunhos), lendo e gravando no banco.
     Topo com a rota grande; opções em cartões (a de menor custo em laranja, pro dono); filtros por trecho e dia;
     "Nova opção" abre um painel lateral que fica aberto pra lançar várias seguidas. Quem pesquisa não vê custo em R$.
   O estilo desta tela está em telas/orcamento.css. */
KVTelas['orcamento'] = function () {
  const O = KVOrc, { esc, fmt } = KVOrc;
  const id = Number(KVShell.param('id'));
  let est = null, eu = null, dono = false, o = null, app = null;
  let ultimaNova = null, salvasAgora = 0, rascunho = null, ocupado = false;

  const trechoSel = () => Math.min(o.trechos.length - 1, +(KVShell.param('t') || 0));
  const opsDo = (ti) => o.opcoes.filter((x) => x.trecho === ti);
  const eDinheiro = (s) => O.site(s).forma === 'dinheiro';
  const pessoas = () => O.total(o);
  const podeLancar = () => dono || (o.responsavel === eu.email && o.etapa === 'pesquisa');
  // quem pode pegar orçamento; quem já está com ele aparece mesmo que não pesquise (ex.: o dono pegou)
  const pesquisadores = () => est.usuarios.filter((u) => ((u.papel === 'pesquisador' || u.pesquisa) && u.ativo !== 0) || u.email === o.responsavel);
  const reais = (c) => c == null ? '' : (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function foraDoPedido(op) {
    const p = o.pedido || '', l = [];
    if (p.includes('Só voo direto') && op.escalas > 0) l.push('não é direto');
    if (p.includes('Até 1 escala') && op.escalas > 1) l.push('mais de 1 escala');
    if (p.includes('Com bagagem') && !op.bagagem) l.push('sem mala');
    if (p.includes('Só pontos') && eDinheiro(op.site)) l.push('em dinheiro');
    if (p.includes('Saída de manhã') && +op.sai.slice(0, 2) >= 12) l.push('sai à tarde');
    return l;
  }

  // grava no banco e traz o orçamento de novo (a tela sempre mostra o que está salvo)
  async function fazer(acao, dados) {
    if (ocupado) return null;
    ocupado = true;
    try { const r = await KVApi.acao(acao, dados); o = await KVApi.orcamento(id); return r; }
    catch (e) { KVShell.aviso(e.message, { erro: true }); try { o = await KVApi.orcamento(id); } catch (_) {} return null; }
    finally { ocupado = false; }
  }

  // ---------- topo: a rota grande e poucas coisas ----------
  function topo() {
    const cidades = [o.trechos[0].de, ...o.trechos.map((t) => t.para)].map(O.cidadeCurta);
    const feitos = o.conferencia.filter((c) => c.feito).length;
    let acoes = '';
    if (dono) acoes = `<label class="sel-pilula solta"><span class="escondido">Pesquisador</span><select id="passar">${[['', 'Na fila'], ...pesquisadores().map((u) => [u.email, `${u.nome.split(' ')[0]} pesquisa`])].map(([v, t]) => `<option value="${esc(v)}" ${(o.responsavel || '') === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="sel-pilula solta"><span class="escondido">Etapa</span><select id="etapa">${O.etapas.map((e) => `<option value="${e.id}" ${e.id === o.etapa ? 'selected' : ''}>${e.nome}</option>`).join('')}</select></label>
        ${o.contato.whatsapp ? `<a class="btn redondo" href="https://wa.me/${o.contato.whatsapp.length <= 11 ? '55' : ''}${o.contato.whatsapp}" target="_blank" rel="noopener" title="Abrir a conversa no WhatsApp" aria-label="WhatsApp"><i data-lucide="message-circle"></i></a>` : ''}
        ${o.etapa === 'novo' && eu.pesquisa ? '<button class="btn" data-pegar><i data-lucide="hand"></i>Pegar</button>' : ''}
        ${o.etapa === 'pesquisa' && o.responsavel === eu.email ? '<button class="btn" data-pesquisado><i data-lucide="check-check"></i>Marcar como pesquisado</button>' : ''}
        ${['pesquisado', 'enviado'].includes(o.etapa) ? `<a class="btn primario" href="proposta.html?id=${o.id}"><i data-lucide="send"></i>${o.etapa === 'pesquisado' ? 'Montar proposta' : 'Proposta'}</a>` : ''}`;
    else if (o.etapa === 'novo') acoes = '<button class="btn primario" data-pegar><i data-lucide="hand"></i>Pegar</button>';
    else if (o.etapa === 'pesquisa' && o.responsavel === eu.email) acoes = '<button class="btn primario" data-pesquisado><i data-lucide="check-check"></i>Marcar como pesquisado</button>';
    else acoes = `<span class="etiqueta">${O.etapa(o.etapa).nome}</span>`;
    return `<a class="voltar" href="orcamentos.html"><i data-lucide="arrow-left"></i>Orçamentos</a>${dono ? O.trilha(o, 'pesquisa') : ''}
      <div class="topo-orc"><span class="quem">${esc(dono ? o.contato.nome : o.contato.nome.split(' ')[0])} · #${o.id}${dono && o.pessoaId ? ' · <span style="color:var(--orange)">é cliente</span>' : ''}</span>
        <h1 style="--n:${cidades.join(' → ').length}">${cidades.map(esc).join(' <span class="seta">→</span> ')}</h1>
        <div class="kpis"><span class="kpi"><b>${O.dataCurta(o.trechos[0].data)}</b><span>${o.trechos.length > 1 ? `a ${O.dataCurta(o.trechos[o.trechos.length - 1].data)}` : 'só ida'}</span></span>
          <span class="kpi"><b>${pessoas()}</b><span>${pessoas() > 1 ? 'pessoas' : 'pessoa'}</span></span><span class="kpi ${dono && o.etapa === 'pesquisado' ? 'destaque' : ''}"><b>${o.opcoes.length}</b><span>opções</span></span></div>
        <div class="linha-acoes">${o.pedido ? `<span class="pedido-pilula"><i data-lucide="message-square-quote"></i>${esc(o.pedido)}</span>` : ''}
          <button class="btn" data-conf><i data-lucide="list-checks"></i>Conferência ${feitos}/${o.conferencia.length}</button>
          <span class="acoes">${acoes}</span></div></div>`;
  }

  // ---------- opções: filtro por trecho e por dia, cartões ----------
  function filtros() {
    const ti = trechoSel(), dia = KVShell.param('dia');
    const dias = [...new Set(opsDo(ti).map((x) => x.data))].sort();
    const nDia = (d) => opsDo(ti).filter((x) => x.data === d).length;
    const cab = `<div class="secao"><h2>Opções de voo</h2><span class="n">${opsDo(ti).length} neste trecho</span>${podeLancar() ? `<button class="btn primario" data-nova style="margin-left:auto"><i data-lucide="plus"></i>Nova opção</button>` : ''}</div>`;
    const varios = o.trechos.length > 1, temDias = dias.length > 1;
    return cab + (varios ? `<div class="fa-abas" role="tablist" aria-label="Trecho">${o.trechos.map((t, i) => `<button role="tab" data-t="${i}" aria-pressed="${i === ti}"><small>Trecho ${i + 1} · ${O.dataCurta(t.data)}</small><b>${t.de} → ${t.para}</b><span>${opsDo(i).length} opções</span></button>`).join('')}</div>` : '')
      + (temDias ? `<div class="fa-dias"><button class="dia-c todos" data-dia="" aria-pressed="${!dia}">Todos</button>${dias.map((d) => `<button class="dia-c ${d === o.trechos[ti].data ? 'pedido' : ''}" data-dia="${d}" aria-pressed="${d === dia}"><small>${O.diaCurto(d)}</small><b>${d.slice(8)}</b><i>${nDia(d)}</i></button>`).join('')}</div>` : '');
  }
  let menuAberto = null, confirmarApagar = null, editando = null;
  function menuOp(op) {
    const it = (attrs, icone, texto, cls = '') => `<button role="menuitem" class="${cls}" ${attrs}><i data-lucide="${icone}"></i>${texto}</button>`;
    if (confirmarApagar === op.id) return `<div class="menu-orc" role="menu"><p>Apagar a opção ${esc(op.site)} das ${op.sai}?</p>${it(`data-del="${op.id}"`, 'trash-2', 'Sim, apagar', 'perigo')}${it('data-cancela', 'x', 'Não')}</div>`;
    return `<div class="menu-orc" role="menu">${op.link ? it(`data-link="${esc(op.link)}"`, 'external-link', 'Abrir o link do preço') : ''}${podeLancar() ? it(`data-editar-op="${op.id}"`, 'pencil', 'Editar') + it(`data-dup="${op.id}"`, 'copy', 'Repetir com outros dados') + it(`data-pede-del="${op.id}"`, 'trash-2', 'Apagar', 'perigo') : ''}</div>`;
  }
  function cartaoOp(op, cheio) {
    const fora = foraDoPedido(op);
    return `<article class="cartao-ref op ${cheio ? 'cheio' : ''} ${op.id === ultimaNova ? 'nova' : ''}">
      <span class="canto"><button data-menu="${op.id}" aria-haspopup="menu" aria-expanded="${menuAberto === op.id}" aria-label="Ações da opção"><i data-lucide="menu"></i></button></span>${menuAberto === op.id ? menuOp(op) : ''}
      <span class="site" data-s="${esc(op.site)}">${esc(op.site)}${cheio ? ' · menor custo' : ''}</span>
      <span class="hora">${op.sai} → ${op.chega.replace(' +1', '')}${op.chega.includes('+1') ? '<small>+1</small>' : ''}</span>
      <span class="pq">${[`${O.diaCurto(op.data)} ${O.dataCurta(op.data)}`, op.voo, op.voo && op.cia !== op.voo.split(' ')[0] && op.cia].filter(Boolean).map(esc).join(' · ')}</span>
      <div class="rodape tags-op"><span class="etiqueta">${op.escalas ? `${op.escalas} escala${op.escalas > 1 ? 's' : ''}` : 'direto'}</span>${op.bagagem ? '<span class="etiqueta"><i data-lucide="luggage"></i>mala</span>' : ''}${fora.map((f) => `<span class="etiqueta warn">${f}</span>`).join('')}</div>
      <div class="pe-op"><div class="valor">${eDinheiro(op.site) ? `<b>${fmt.brl(op.preco)}</b><span>em dinheiro, por pessoa</span>` : `<b>${fmt.pts(op.milhas)} <small>pts</small></b><span>+ ${fmt.brl(op.taxa)} de taxa, por pessoa</span>`}${dono ? `<span class="custo">custo total ${fmt.brl(O.custo(op, o))}</span>` : ''}</div>
        </div></article>`;
  }
  function opcoes() {
    const dia = KVShell.param('dia');
    const l = opsDo(trechoSel()).filter((x) => !dia || x.data === dia)
      .sort(dono ? (a, b) => O.custoPessoa(a) - O.custoPessoa(b) : (a, b) => a.data.localeCompare(b.data) || (a.milhas || 1e9) - (b.milhas || 1e9));
    return l.length ? `<div class="grade-ref">${l.map((op, i) => cartaoOp(op, dono && i === 0)).join('')}</div>` : `<div class="vazio">Nenhuma opção${dia ? ' nesse dia' : ' neste trecho'} ainda.${podeLancar() ? ' Toque em "Nova opção".' : ''}</div>`;
  }

  // etiquetas que não cabem numa linha: andam devagar de um lado pro outro; arrastar ou rolar para no ponto escolhido
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ligarRolos() {
    app.querySelectorAll('.tags-op').forEach((r) => {
      const cabe = r.scrollWidth <= r.clientWidth + 2;
      r.classList.toggle('nao-cabe', !cabe);
      if (cabe) return;
      let pos = null, dir = 1, pausa = 1500, ultimo = null, parado = false, x0 = 0, s0 = 0, apertado = false;
      const passo = (t) => {
        if (!r.isConnected || parado) return;
        const dt = ultimo == null ? 16 : Math.min(64, t - ultimo); ultimo = t;
        if (pausa > 0) pausa -= dt; else { pos = (pos ?? r.scrollLeft) + dir * dt * 0.03; r.scrollLeft = pos; const fim = r.scrollWidth - r.clientWidth; if ((dir > 0 && pos >= fim) || (dir < 0 && pos <= 0)) { pos = Math.max(0, Math.min(fim, pos)); dir *= -1; pausa = 1500; } }
        requestAnimationFrame(passo);
      };
      if (!calmo) requestAnimationFrame(passo);
      r.addEventListener('pointerdown', (e) => { apertado = true; x0 = e.clientX; s0 = r.scrollLeft; r.setPointerCapture(e.pointerId); });
      r.addEventListener('pointermove', (e) => { if (!apertado) return; const dx = e.clientX - x0; if (Math.abs(dx) > 4) parado = true; if (parado) r.scrollLeft = s0 - dx; });
      r.addEventListener('pointerup', () => { apertado = false; });
      r.addEventListener('wheel', () => { parado = true; }, { passive: true });
    });
  }
  // pedido que veio pelo bot do Telegram: o que o dono disse, o que falta perguntar e observações
  function doBot() {
    if (o.origem !== 'telegram' && !o.faltando.length && !o.observacao) return '';
    return `<div class="bot-orc">${o.origem === 'telegram' ? `<span class="bot-cab"><i data-lucide="${o.audio ? 'mic' : 'send'}"></i>Anotado pelo bot do Telegram${o.audio ? ', a partir de um áudio' : ''}</span>
      ${o.textoOriginal ? `<p class="bot-txt">“${esc(o.textoOriginal)}”</p>` : ''}` : ''}
      ${o.observacao ? `<p class="bot-obs"><b>Obs.:</b> ${esc(o.observacao)}</p>` : ''}
      ${o.faltando.length ? `<div class="aviso warn">Falta perguntar ao cliente: ${o.faltando.map(esc).join('; ')}</div>` : ''}</div>`;
  }
  function render() {
    app.innerHTML = topo() + doBot() + filtros() + opcoes();
    document.title = `#${o.id} ${O.destino(o)} · K&V`;
    KVShell.icones();
    ligarRolos();
    ultimaNova = null;
  }

  // ---------- janelas: conferência, nova opção (lateral), marcar como pesquisado ----------
  const dlg = document.createElement('dialog'); dlg.className = 'janela'; document.body.append(dlg);
  const fecharJanela = () => KVShell.desfazer({ janela: 1 }, sincJanela);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); tentarFechar(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) tentarFechar(); });
  // painel de opção com alteração não salva: antes de fechar, pergunta se quer salvar
  let inicial = null;
  const sujo = () => dlg.classList.contains('lateral') && inicial != null && JSON.stringify(lerCampos()) !== inicial;
  const marcarLimpo = () => { inicial = JSON.stringify(lerCampos()); };
  const conf = document.createElement('dialog'); conf.className = 'janela'; conf.style.width = 'min(520px, calc(100vw - 32px))'; document.body.append(conf);
  function tentarFechar() {
    if (!sujo()) { fecharJanela(); return; }
    conf.innerHTML = `<header><div style="flex:1"><h2>Salvar antes de sair?</h2><div class="sub">Você mexeu ${editando ? 'nesta opção' : 'na nova opção'} e ainda não salvou.</div></div></header>
      <footer style="justify-content:flex-end"><button class="btn" data-c="continuar">Continuar editando</button><button class="btn" data-c="descartar">Sair sem salvar</button><button class="btn primario" data-c="salvar"><i data-lucide="check"></i>Salvar</button></footer>`;
    conf.querySelectorAll('[data-c]').forEach((b) => b.onclick = async () => {
      conf.close();
      if (b.dataset.c === 'descartar') { inicial = null; rascunho = rascunho && { site: rascunho.site, data: rascunho.data }; fecharJanela(); }
      if (b.dataset.c === 'salvar') { const eraEdicao = !!editando; const ok = await salvarOp(); if (ok && !eraEdicao) { inicial = null; fecharJanela(); } }
      if (b.dataset.c === 'continuar') { const f = dlg.querySelector('[data-f="sai"]'); if (f) f.focus(); }
    });
    conf.showModal(); KVShell.icones(); conf.querySelector('[data-c="salvar"]').focus();
  }
  conf.addEventListener('cancel', (e) => { e.preventDefault(); conf.close(); });
  const cab = (t, sub) => `<header><div style="flex:1"><h2>${t}</h2><div class="sub">${sub}</div></div><button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>`;
  const lerNum = (t) => { const n = +String(t || '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); return isFinite(n) && n > 0 ? n : null; };
  const hora = (t) => { const mais = /\+/.test(t); const d = String(t || '').replace(/\D/g, '').slice(0, 4); if (d.length < 3) return null; const h = d.length === 3 ? '0' + d[0] : d.slice(0, 2), m = d.slice(-2); if (+h > 23 || +m > 59) return null; return `${h}:${m}${mais ? ' +1' : ''}`; };

  function formOp() {
    const t = o.trechos[trechoSel()], dias = O.janelaDias(t), r = rascunho || {};
    const s = r.site || 'Smiles', din = eDinheiro(s);
    return `<div class="form-op">
      <div class="duas"><div class="campo"><label for="f-site">Site</label><select id="f-site" data-f="site">${O.sites.map((x) => `<option ${x.id === s ? 'selected' : ''}>${x.id}</option>`).join('')}</select></div>
        <div class="campo"><label for="f-dia">Dia</label><select id="f-dia" data-f="data">${dias.map((d) => `<option value="${d}" ${d === (r.data || KVShell.param('dia') || t.data) ? 'selected' : ''}>${O.diaCurto(d)} ${O.dataCurta(d)}${d === t.data ? ' (pedido)' : ''}</option>`).join('')}</select></div></div>
      <div class="duas"><div class="campo"><label for="f-sai">Sai</label><input id="f-sai" data-f="sai" inputmode="numeric" placeholder="07:40" value="${esc(r.sai || '')}"></div><div class="campo"><label for="f-chega">Chega</label><input id="f-chega" data-f="chega" placeholder="19:10 ou 06:10+" value="${esc(r.chega || '')}"></div></div>
      <div class="duas"><div class="campo"><label for="f-voo">Voo</label><input id="f-voo" data-f="voo" placeholder="LA 8084" value="${esc(r.voo || '')}"></div>
        <div class="campo"><label for="f-esc">Escalas</label><select id="f-esc" data-f="escalas">${[[0, 'Direto'], [1, '1 escala'], [2, '2 ou mais']].map(([v, n]) => `<option value="${v}" ${+(r.escalas || 0) === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
      ${din ? `<div class="campo"><label for="f-preco">Preço em dinheiro, por pessoa</label><input id="f-preco" data-f="preco" inputmode="decimal" placeholder="R$" value="${esc(r.preco || '')}"></div>`
        : `<div class="duas"><div class="campo"><label for="f-mil">Milhas por pessoa</label><input id="f-mil" data-f="milhas" inputmode="numeric" placeholder="45 = 45.000" value="${esc(r.milhas || '')}"></div><div class="campo"><label for="f-taxa">Taxa por pessoa</label><input id="f-taxa" data-f="taxa" inputmode="decimal" placeholder="R$" value="${esc(r.taxa || '')}"></div></div>`}
      <label style="display:flex;gap:10px;align-items:center;font-size:15px;cursor:pointer"><input type="checkbox" data-f="bagagem" ${r.bagagem ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--orange)">Com mala despachada</label>
      <div class="campo"><label for="f-link">Link do preço</label><input id="f-link" data-f="link" placeholder="Colar link" value="${esc(r.link || '')}"></div>
      <span class="lanc">${editando ? 'Enter salva a alteração.' : 'Enter salva e deixa o painel aberto pra próxima. Site e dia continuam.'}</span></div>`;
  }
  function lerCampos() { const v = {}; dlg.querySelectorAll('[data-f]').forEach((el) => { v[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; }); return v; }
  async function salvarOp() {
    const v = lerCampos(), din = eDinheiro(v.site), erros = [];
    const sai = hora(v.sai), chega = hora(v.chega);
    let milhas = lerNum(v.milhas); if (milhas && milhas < 1000) milhas *= 1000;
    // taxa pode ser zero (emissão sem taxa); só não pode ficar vazia
    const taxa = String(v.taxa || '').trim() === '0' ? 0 : O.lerReais(v.taxa), preco = O.lerReais(v.preco);
    if (!sai) erros.push('sai'); if (!chega) erros.push('chega');
    if (din && !preco) erros.push('preco'); if (!din && !milhas) erros.push('milhas'); if (!din && taxa == null) erros.push('taxa');
    dlg.querySelectorAll('[data-f]').forEach((el) => el.classList.toggle('erro', erros.includes(el.dataset.f)));
    if (erros.length) { dlg.querySelector(`[data-f="${erros[0]}"]`).focus(); return false; }
    const voo = v.voo.trim().toUpperCase();
    const dados = { orcamento: o.id, trecho: trechoSel(), site: v.site, data: v.data, sai, chega, voo, cia: voo.split(' ')[0] || v.site, escalas: +v.escalas, bagagem: v.bagagem,
      milhas: din ? null : Math.round(milhas), taxa: din ? null : taxa, preco: din ? preco : null, link: v.link.trim() };
    const botao = dlg.querySelector('[data-salvar]'); if (botao) botao.disabled = true;
    if (editando) {
      const r = await fazer('op.salvar', { ...dados, id: editando });
      if (botao) botao.disabled = false;
      if (!r) return false;
      ultimaNova = editando; editando = null; rascunho = null; inicial = null; fecharJanela(); render(); return true;
    }
    const r = await fazer('op.salvar', dados);
    if (!r) { if (botao) botao.disabled = false; return false; }
    ultimaNova = r.id; salvasAgora++;
    rascunho = { site: v.site, data: v.data };
    render(); abrirNova(); marcarLimpo();
    dlg.querySelector('[data-salvas]').innerHTML = `<i data-lucide="check" style="width:16px;height:16px"></i>${salvasAgora} ${salvasAgora > 1 ? 'salvas' : 'salva'} agora · ${esc(v.site)} ${sai}`;
    KVShell.icones();
    dlg.querySelector('[data-f="sai"]').focus();
    return true;
  }
  function abrirNova() {
    const t = o.trechos[trechoSel()];
    dlg.className = 'janela lateral';
    dlg.innerHTML = cab(editando ? 'Editar opção' : 'Nova opção', `${t.de} → ${t.para} · ${O.fmtPax(o.passageiros)}`) + `<div class="corpo">${formOp()}</div>
      <footer><span class="salvas" data-salvas></span><button class="btn primario" data-salvar><i data-lucide="check"></i>${editando ? 'Salvar alteração' : 'Salvar'} <kbd>Enter</kbd></button></footer>`;
    dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = tentarFechar);
    dlg.querySelector('[data-salvar]').onclick = salvarOp;
    dlg.querySelector('[data-f="site"]').onchange = () => { rascunho = lerCampos(); abrirNova(); KVShell.icones(); dlg.querySelector('[data-f="site"]').focus(); };
    dlg.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('input', () => { rascunho = lerCampos(); }));
    dlg.onkeydown = (e) => { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); salvarOp(); } };
  }
  const paraForm = (op) => ({ site: op.site, data: op.data, voo: op.voo, sai: op.sai, chega: op.chega.replace(' +1', '+'), escalas: op.escalas, bagagem: op.bagagem,
    milhas: op.milhas ? op.milhas / 1000 : '', taxa: reais(op.taxa), preco: reais(op.preco), link: op.link });
  function sincJanela() {
    const j = KVShell.param('janela');
    if (j === 'nova' && podeLancar()) {
      if (!dlg.open || !dlg.classList.contains('lateral')) { abrirNova(); marcarLimpo(); if (!dlg.open) dlg.showModal(); KVShell.icones(); dlg.querySelector(rascunho && rascunho.sai ? '[data-f="data"]' : '[data-f="sai"]').focus(); }
      return;
    }
    dlg.onkeydown = null;
    editando = null; // fechou o painel sem salvar: a próxima vez é opção nova
    dlg.className = 'janela';
    if (j === 'conf') {
      const pode = podeLancar();
      dlg.innerHTML = cab('Lista de conferência', 'Lembra, não trava') + `<div class="corpo"><div class="conf-lista">${o.conferencia.map((c) => `<label class="${c.feito ? 'feito' : ''}"><input type="checkbox" data-c="${c.ordem}" ${c.feito ? 'checked' : ''} ${pode ? '' : 'disabled'}><span>${esc(c.texto)}</span></label>`).join('')}</div>
        ${dono ? '<div style="display:flex;gap:8px;margin:12px 0 16px"><input id="novo-item" placeholder="Outro item, ex.: só Latam" aria-label="Outro item" style="flex:1;height:42px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2);padding:0 12px;font-size:16px;min-width:0"><button class="btn" data-add><i data-lucide="plus"></i>Pôr</button></div>' : '<div style="height:12px"></div>'}</div>
        <footer><span></span><button class="btn primario" data-x>Pronto</button></footer>`;
      dlg.querySelectorAll('[data-c]').forEach((i) => i.onchange = async () => {
        i.closest('label').classList.toggle('feito', i.checked);
        if (await fazer('conf.marcar', { orcamento: o.id, ordem: +i.dataset.c, feito: i.checked })) render(); else { render(); sincJanela(); }
      });
      const add = dlg.querySelector('[data-add]');
      if (add) {
        const por = async () => { const v = dlg.querySelector('#novo-item').value.trim(); if (v && await fazer('conf.adicionar', { orcamento: o.id, texto: v })) { render(); sincJanela(); dlg.querySelector('#novo-item').focus(); } };
        add.onclick = por; dlg.querySelector('#novo-item').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); por(); } };
      }
    } else if (j === 'pesquisado') {
      const falta = o.conferencia.filter((c) => !c.feito), semOp = o.trechos.map((t, i) => ({ t, i })).filter(({ i }) => !opsDo(i).length), tudo = !falta.length && !semOp.length;
      dlg.innerHTML = cab('Marcar como pesquisado?', 'Vai pro dono revisar e montar a proposta') + `<div class="corpo" style="display:grid;gap:10px;padding-bottom:14px">
        ${tudo ? '<div class="aviso ok">Tudo conferido e todos os trechos têm opção.</div>' : ''}
        ${semOp.map(({ t }) => `<div class="aviso danger">${t.de} → ${t.para} está sem nenhuma opção.</div>`).join('')}
        ${falta.length ? `<div class="aviso warn">Falta conferir:<ul style="margin:6px 0 0;padding-left:18px">${falta.map((c) => `<li>${esc(c.texto)}</li>`).join('')}</ul></div>` : ''}</div>
        <footer><button class="btn" data-x>${tudo ? 'Cancelar' : 'Voltar e conferir'}</button><button class="btn primario" data-ok><i data-lucide="check-check"></i>${tudo ? 'Marcar como pesquisado' : 'Marcar mesmo assim'}</button></footer>`;
      dlg.querySelector('[data-ok]').onclick = async (e) => { e.currentTarget.disabled = true; if (await fazer('orc.pesquisado', { id: o.id })) { fecharJanela(); render(); KVShell.aviso('Pronto: foi pro dono revisar'); } else e.currentTarget.disabled = false; };
    } else { if (dlg.open) dlg.close(); return; }
    dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fecharJanela);
    if (!dlg.open) dlg.showModal();
    KVShell.icones();
  }

  // ---------- ações ----------
  function ligarEventos() {
    // menu das 3 barras nas opções
    app.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-menu]');
      if (m) { e.stopImmediatePropagation(); const mid = +m.dataset.menu; menuAberto = menuAberto === mid ? null : mid; confirmarApagar = null; render(); const pri = app.querySelector('.menu-orc button'); if (pri) pri.focus(); return; }
      const l = e.target.closest('[data-link]'); if (l) { e.stopImmediatePropagation(); window.open(l.dataset.link, '_blank', 'noopener'); menuAberto = null; render(); return; }
      const pd = e.target.closest('[data-pede-del]'); if (pd) { e.stopImmediatePropagation(); confirmarApagar = +pd.dataset.pedeDel; render(); return; }
      if (e.target.closest('[data-cancela]')) { e.stopImmediatePropagation(); confirmarApagar = null; render(); return; }
      const ed = e.target.closest('[data-editar-op]');
      if (ed) { e.stopImmediatePropagation(); const op = o.opcoes.find((x) => x.id === +ed.dataset.editarOp); editando = op.id; menuAberto = null;
        rascunho = paraForm(op); render(); KVShell.irPara({ janela: 'nova' }); sincJanela(); return; }
      if (e.target.closest('[data-dup], [data-del]')) { menuAberto = confirmarApagar = null; editando = null; return; }
      if (menuAberto && !e.target.closest('.menu-orc')) { menuAberto = confirmarApagar = null; render(); }
    }, true);
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuAberto && !dlg.open) { const mid = menuAberto; menuAberto = confirmarApagar = null; render(); const b = app.querySelector(`[data-menu="${mid}"]`); if (b) b.focus(); } });
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.t != null) { if (+b.dataset.t !== trechoSel()) { rascunho = null; KVShell.irPara({ t: b.dataset.t, dia: null }); render(); } }
      else if (b.dataset.dia != null) { if (b.dataset.dia !== (KVShell.param('dia') || '')) { KVShell.irPara({ dia: b.dataset.dia || null }); render(); } }
      else if (b.hasAttribute('data-nova')) { salvasAgora = 0; editando = null; rascunho = rascunho && { site: rascunho.site, data: rascunho.data }; KVShell.irPara({ janela: 'nova' }); sincJanela(); }
      else if (b.dataset.dup) { const op = o.opcoes.find((x) => x.id === +b.dataset.dup); rascunho = paraForm(op); salvasAgora = 0; KVShell.irPara({ janela: 'nova' }); sincJanela(); }
      else if (b.dataset.del) { if (await fazer('op.apagar', { orcamento: o.id, id: +b.dataset.del })) KVShell.aviso('Opção apagada'); render(); }
      else if (b.hasAttribute('data-conf')) { KVShell.irPara({ janela: 'conf' }); sincJanela(); }
      else if (b.hasAttribute('data-pesquisado')) { KVShell.irPara({ janela: 'pesquisado' }); sincJanela(); }
      else if (b.hasAttribute('data-pegar')) { b.disabled = true; await fazer('orc.pegar', { id: o.id }); render(); }
    });
    app.addEventListener('change', async (e) => {
      if (e.target.id === 'passar') { await fazer('orc.passar', { id: o.id, email: e.target.value || null }); render(); }
      if (e.target.id === 'etapa') { await fazer('orc.etapa', { id: o.id, etapa: e.target.value }); render(); }
    });
    // atalho: N abre "Nova opção" (quando não está digitando)
    addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.target.closest('input, textarea, select') && !dlg.open && podeLancar()) { e.preventDefault(); app.querySelector('[data-nova]').click(); } });
  }

  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      [est, o] = await Promise.all([KVApi.estado(), KVApi.orcamento(id)]);
      eu = est.eu; dono = eu.papel === 'dono' || eu.papel === 'admin';
      O.usarProgramas(est.programas);
      document.querySelector('.carregando').remove();
      app = KVShell.montar('orcamentos', { dono });
      ligarEventos();
      render(); sincJanela();
      KVShell.aoVoltar(() => { render(); sincJanela(); });
      // quando volta pra aba, traz o que outra pessoa pode ter lançado
      document.addEventListener('visibilitychange', async () => { if (!document.hidden && !dlg.open && !ocupado) { try { o = await KVApi.orcamento(id); render(); } catch (_) {} } });
    } catch (e) {
      const c = document.querySelector('.carregando');
      if (c) c.innerHTML = `${esc(e.message)} <a href="orcamentos.html" style="color:var(--orange)">Voltar pros orçamentos</a>`;
    }
  })();
};

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
          <button class="btn" data-resumo><i data-lucide="file-text"></i>Resumo escrito</button>
          <span class="acoes">${acoes}</span></div></div>`;
  }

  // ---------- opções: filtro por trecho e por dia, cartões ----------
  function filtros() {
    const ti = trechoSel(), dia = KVShell.param('dia');
    const dias = [...new Set(opsDo(ti).map((x) => x.data))].sort();
    const nDia = (d) => opsDo(ti).filter((x) => x.data === d).length;
    const cab = `<div class="secao"><h2>Opções de voo</h2><span class="n">${opsDo(ti).length} neste trecho</span></div>`;
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
      <span class="hora">${op.sai} → ${op.chega.replace(/ \+\d$/, '')}${/\+\d$/.test(op.chega) ? `<small>${op.chega.slice(-2)}</small>` : ''}</span>
      <span class="pq">${[`${O.diaCurto(op.data)} ${O.dataCurta(op.data)}`, op.voo, op.voo && op.cia !== op.voo.split(' ')[0] && op.cia].filter(Boolean).map(esc).join(' · ')}</span>
      <div class="rodape tags-op"><span class="etiqueta">${op.escalas ? `${op.escalas} escala${op.escalas > 1 ? 's' : ''}` : 'direto'}</span>${op.bagagem ? `<span class="etiqueta"><i data-lucide="luggage"></i>${op.bagagem > 1 ? `${op.bagagem} malas` : 'mala'}</span>` : ''}${op.destaque ? `<span class="etiqueta">${esc(op.destaque)}</span>` : ''}${fora.map((f) => `<span class="etiqueta warn">${f}</span>`).join('')}</div>
      <div class="pe-op"><div class="valor">${eDinheiro(op.site) ? `<b>${fmt.brl(op.preco)}</b><span>em dinheiro, por pessoa</span>` : `<b>${fmt.pts(op.milhas)} <small>pts</small></b><span>+ ${fmt.brl(op.taxa)} de taxa, por pessoa</span>`}${dono ? `<span class="custo">custo total ${fmt.brl(O.custo(op, o))}</span>` : ''}</div>
        </div></article>`;
  }
  function opcoes() {
    const dia = KVShell.param('dia');
    const l = opsDo(trechoSel()).filter((x) => !dia || x.data === dia)
      .sort(dono ? (a, b) => O.custoPessoa(a) - O.custoPessoa(b) : (a, b) => a.data.localeCompare(b.data) || (a.milhas || 1e9) - (b.milhas || 1e9));
    // o lugar do próximo cartão, tracejado: tocar nele lança mais um voo (igual à "Outra combinação" da proposta)
    const t = o.trechos[trechoSel()];
    const mais = podeLancar() ? `<button class="nova-op" data-nova><span class="mais"><i data-lucide="plus"></i></span>${l.length ? 'Mais um voo' : 'Lançar o primeiro voo'}<span class="sub">${esc(t.de)} → ${esc(t.para)}<kbd>N</kbd></span></button>` : '';
    if (!l.length && !mais) return `<div class="vazio">Nenhuma opção${dia ? ' nesse dia' : ' neste trecho'} ainda.</div>`;
    return `<div class="grade-ref">${l.map((op, i) => cartaoOp(op, dono && i === 0)).join('')}${mais}</div>`;
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

  // os campos da página de voo do documento antigo, na ordem em que aparecem no resumo escrito
  const DESTAQUES = ['‼️Opção mais barata‼️', '‼️Opção a noite‼️', '‼️Outra opção de volta‼️', '‼️Volta indisponível em milhas‼️', '‼️Voo indisponível‼️', '‼️Taxa total ida e volta‼️'];
  const campo = (id, rotulo, html, cls = '') => `<div class="campo ${cls}"><label for="${id}">${rotulo}</label>${html}</div>`;
  const entrada = (f, attrs, valor) => `<input id="f-${f}" data-f="${f}" ${attrs} value="${esc(valor ?? '')}">`;
  function formOp() {
    const t = o.trechos[trechoSel()], dias = O.janelaDias(t), r = rascunho || {};
    const s = r.site || 'Smiles', din = eDinheiro(s);
    const dia = r.data || KVShell.param('dia') || t.data, depois = +(r.depois || 0);
    const escalas = r.escalasOnde || [];
    const depoisDe = (n) => { const d = new Date(dia + 'T12:00:00'); d.setDate(d.getDate() + n); return O.dataCurta(O.isoDia(d)); };
    return `<div class="form-op">
      <h3 class="form-grupo">Voo</h3>
      <div class="duas">${campo('f-site', 'Site', `<select id="f-site" data-f="site">${O.sites.map((x) => `<option ${x.id === s ? 'selected' : ''}>${x.id}</option>`).join('')}</select>`)}
        ${campo('f-data', 'Dia', `<select id="f-data" data-f="data">${dias.map((d) => `<option value="${d}" ${d === dia ? 'selected' : ''}>${O.diaCurto(d)} ${O.dataCurta(d)}${d === t.data ? ' (pedido)' : ''}</option>`).join('')}</select>`)}</div>
      <div class="duas">${campo('f-cia', 'Companhia aérea', entrada('cia', 'placeholder="Latam, GOL, Azul…" list="l-cias" autocomplete="off"', r.cia))}${campo('f-voo', 'Voo', entrada('voo', 'placeholder="LA 8084"', r.voo))}</div>
      <datalist id="l-cias">${['Latam', 'GOL', 'Azul', 'TAP', 'KLM', 'Air France', 'Iberia', 'American', 'Delta', 'United', 'Copa', 'Avianca'].map((c) => `<option value="${c}">`).join('')}</datalist>
      <div class="duas">${campo('f-de', 'Sai de', entrada('de', `placeholder="${t.de}" maxlength="3" autocapitalize="characters"`, r.de || t.de))}${campo('f-para', 'Chega em', entrada('para', `placeholder="${t.para}" maxlength="3" autocapitalize="characters"`, r.para || t.para))}</div>
      <div class="duas">${campo('f-sai', 'Horário de saída', entrada('sai', 'inputmode="numeric" placeholder="07:40"', r.sai))}${campo('f-chega', 'Horário de chegada', entrada('chega', 'inputmode="numeric" placeholder="19:10"', r.chega))}</div>
      <div class="duas">${campo('f-depois', 'Chega no dia', `<select id="f-depois" data-f="depois">${[0, 1, 2, 3].map((n) => `<option value="${n}" ${n === depois ? 'selected' : ''}>${n ? `${depoisDe(n)} (+${n})` : 'Mesmo dia'}</option>`).join('')}</select>`)}
        ${campo('f-duracao', 'Tempo de viagem', entrada('duracao', 'placeholder="7h10m"', r.duracao))}</div>
      <h3 class="form-grupo">Escalas <span>${escalas.length ? `${escalas.length} escala${escalas.length > 1 ? 's' : ''}` : 'voo direto'}</span></h3>
      ${escalas.map(([l, tm], i) => `<div class="esc-linha">${campo(`f-el${i}`, `Escala ${i + 1}`, `<input id="f-el${i}" data-esc="${i}" data-q="l" placeholder="CGH ou São Paulo CGH" value="${esc(l)}">`)}
        ${campo(`f-et${i}`, 'Tempo', `<input id="f-et${i}" data-esc="${i}" data-q="t" placeholder="1h30m" value="${esc(tm)}">`)}
        <button type="button" class="btn icone" data-tira-esc="${i}" aria-label="Tirar a escala ${i + 1}"><i data-lucide="x"></i></button></div>`).join('')}
      ${escalas.length < 3 ? '<button type="button" class="btn" data-poe-esc><i data-lucide="plus"></i>Escala</button>' : ''}
      <h3 class="form-grupo">Malas</h3>
      <div class="duas">${campo('f-mao', 'Mala de mão', `<select id="f-mao" data-f="malaMao">${[['1', 'Inclusa'], ['0', 'Não inclusa'], ['', 'Não sei']].map(([v, n]) => `<option value="${v}" ${String(r.malaMao ?? '1') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`)}
        ${campo('f-bagagem', 'Mala despachada', `<select id="f-bagagem" data-f="bagagem">${[0, 1, 2, 3].map((n) => `<option value="${n}" ${+(r.bagagem || 0) === n ? 'selected' : ''}>${n ? `${n} inclusa${n > 1 ? 's' : ''}` : 'Não inclusa'}</option>`).join('')}</select>`)}</div>
      <h3 class="form-grupo">Valores, por pessoa</h3>
      ${din ? campo('f-preco', 'Preço em dinheiro', entrada('preco', 'inputmode="decimal" placeholder="R$"', r.preco))
        : `<div class="duas">${campo('f-milhas', 'Milhas', entrada('milhas', 'inputmode="numeric" placeholder="45 = 45.000"', r.milhas))}${campo('f-taxa', 'Taxa', entrada('taxa', 'inputmode="decimal" placeholder="R$"', r.taxa))}</div>
        ${campo('f-mmala', 'Milhas com mala despachada', entrada('milhasMala', 'inputmode="numeric" placeholder="Se o site cobra a mala à parte"', r.milhasMala))}`}
      <h3 class="form-grupo">Anotações</h3>
      ${campo('f-destaque', 'Destaque', entrada('destaque', 'list="l-destaques" placeholder="‼️Opção mais barata‼️" autocomplete="off"', r.destaque))}
      <datalist id="l-destaques">${DESTAQUES.map((d) => `<option value="${d}">`).join('')}</datalist>
      ${campo('f-obs', 'Observações', `<textarea id="f-obs" data-f="obs" rows="3" placeholder="Ex.: taxa total pra 4 pessoas">${esc(r.obs || '')}</textarea>`)}
      ${campo('f-link', 'Link do preço', entrada('link', 'placeholder="Colar link"', r.link))}
      <span class="lanc">${editando ? 'Enter salva a alteração.' : 'Enter salva e deixa o painel aberto pra próxima. Site e dia continuam.'}</span></div>`;
  }
  function lerCampos() {
    const v = {};
    dlg.querySelectorAll('[data-f]').forEach((el) => { v[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; });
    v.escalasOnde = [...dlg.querySelectorAll('[data-esc][data-q="l"]')].map((el) => [el.value, (dlg.querySelector(`[data-esc="${el.dataset.esc}"][data-q="t"]`) || {}).value || '']);
    return v;
  }
  // "0215", "215" ou "2:15" → "2h15m"; o que já vem escrito ("2h", "16 hrs 41 min") fica como está
  const tempo = (t) => { const x = String(t || '').trim(); const m = /^(\d{1,2})[:h]?(\d{2})$/.exec(x); return m ? `${+m[1]}h${m[2]}m` : x; };
  // "cgh" → "São Paulo CGH"; texto livre fica como está
  const lugarEscala = (l) => { const x = String(l || '').trim(); if (!/^[a-z]{3}$/i.test(x)) return x; const c = x.toUpperCase(), n = O.cidadeCurta(c); return n === c ? c : `${n} ${c}`; };
  async function salvarOp() {
    const v = lerCampos(), din = eDinheiro(v.site), erros = [];
    const sai = hora(v.sai), chegaH = hora(v.chega);
    // "06:10+" no horário ainda vale como dia seguinte
    const depois = Math.max(+v.depois || 0, chegaH && chegaH.endsWith('+1') ? 1 : 0);
    const chega = chegaH && `${chegaH.replace(' +1', '')}${depois ? ` +${depois}` : ''}`;
    let milhasMala = lerNum(v.milhasMala); if (milhasMala && milhasMala < 1000) milhasMala *= 1000;
    const de = String(v.de || '').trim().toUpperCase(), para = String(v.para || '').trim().toUpperCase();
    let milhas = lerNum(v.milhas); if (milhas && milhas < 1000) milhas *= 1000;
    // taxa pode ser zero (emissão sem taxa); só não pode ficar vazia
    const taxa = String(v.taxa || '').trim() === '0' ? 0 : O.lerReais(v.taxa), preco = O.lerReais(v.preco);
    if (!sai) erros.push('sai'); if (!chega) erros.push('chega');
    if (de && !/^[A-Z]{3}$/.test(de)) erros.push('de'); if (para && !/^[A-Z]{3}$/.test(para)) erros.push('para');
    if (din && !preco) erros.push('preco'); if (!din && !milhas) erros.push('milhas'); if (!din && taxa == null) erros.push('taxa');
    dlg.querySelectorAll('[data-f]').forEach((el) => el.classList.toggle('erro', erros.includes(el.dataset.f)));
    if (erros.length) { dlg.querySelector(`[data-f="${erros[0]}"]`).focus(); return false; }
    const voo = v.voo.trim().toUpperCase();
    const t = o.trechos[trechoSel()];
    const escalasOnde = v.escalasOnde.map(([l, tm]) => [lugarEscala(l), tempo(tm)]).filter(([l]) => l);
    const dados = { orcamento: o.id, trecho: trechoSel(), site: v.site, data: v.data, sai, chega, voo, cia: v.cia.trim() || voo.split(' ')[0] || v.site,
      escalas: escalasOnde.length, escalasOnde, bagagem: +v.bagagem || 0,
      milhas: din ? null : Math.round(milhas), taxa: din ? null : taxa, preco: din ? preco : null, link: v.link.trim(),
      // aeroporto igual ao do trecho não precisa ficar guardado na opção
      de: de && de !== t.de ? de : null, para: para && para !== t.para ? para : null,
      duracao: tempo(v.duracao) || null, milhasMala: din || !milhasMala ? null : Math.round(milhasMala),
      malaMao: v.malaMao === '' ? null : v.malaMao === '1', destaque: v.destaque.trim() || null, obs: v.obs.trim() };
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
    rascunho = { site: v.site, data: v.data, malaMao: v.malaMao };
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
    dlg.querySelectorAll('[data-f], [data-esc]').forEach((el) => el.addEventListener('input', () => { rascunho = lerCampos(); }));
    // dia diferente muda as datas do "Chega no dia"
    dlg.querySelector('[data-f="data"]').addEventListener('change', () => { rascunho = lerCampos(); abrirNova(); KVShell.icones(); dlg.querySelector('[data-f="data"]').focus(); });
    const poe = dlg.querySelector('[data-poe-esc]');
    if (poe) poe.onclick = () => { rascunho = lerCampos(); rascunho.escalasOnde.push(['', '']); abrirNova(); KVShell.icones(); dlg.querySelector(`[data-esc="${rascunho.escalasOnde.length - 1}"][data-q="l"]`).focus(); };
    dlg.querySelectorAll('[data-tira-esc]').forEach((b) => b.onclick = () => { rascunho = lerCampos(); rascunho.escalasOnde.splice(+b.dataset.tiraEsc, 1); abrirNova(); KVShell.icones(); const p2 = dlg.querySelector('[data-poe-esc]'); if (p2) p2.focus(); });
    // Enter salva (no campo de observações, pula linha)
    dlg.onkeydown = (e) => { if (e.key === 'Enter' && !['BUTTON', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); salvarOp(); } };
  }
  const paraForm = (op) => ({ site: op.site, data: op.data, cia: op.cia === op.site ? '' : op.cia, voo: op.voo, de: op.de || '', para: op.para || '', sai: op.sai,
    chega: op.chega.replace(/ \+\d$/, ''), depois: (/ \+(\d)$/.exec(op.chega) || [])[1] || 0, duracao: op.duracao || '',
    escalasOnde: op.escalasOnde || Array.from({ length: op.escalas }, () => ['', '']), bagagem: op.bagagem, malaMao: op.mala_mao == null ? '' : String(op.mala_mao),
    milhas: op.milhas ? op.milhas / 1000 : '', taxa: reais(op.taxa), preco: reais(op.preco), milhasMala: op.milhas_mala ? op.milhas_mala / 1000 : '',
    destaque: op.destaque || '', obs: op.obs || '', link: op.link });
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
    } else if (j === 'resumo') {
      // resumo escrito: o texto pro WhatsApp, montado com o que está lançado; a prévia mostra o negrito como o WhatsApp mostra
      dlg.classList.add('resumo');
      const txt = KVResumo.resumo(o, { comValor: dono });
      const previa = esc(txt).replace(/\*([^*\n]+)\*/g, '<b>$1</b>');
      dlg.innerHTML = cab('Resumo escrito', 'Montado com as opções lançadas, pra colar no WhatsApp') + `<div class="corpo"><div class="resumo-txt">${previa}</div>
        ${o.opcoes.length ? '' : '<p class="resumo-nota">Ainda não tem nenhuma opção lançada; quando tiver, ela entra aqui.</p>'}</div>
        <footer><span class="resumo-nota">${dono ? '' : 'Sem o valor em R$: ele sai no resumo do dono.'}</span><button class="btn primario" data-copiar><i data-lucide="copy"></i>Copiar</button></footer>`;
      dlg.querySelector('[data-copiar]').onclick = async (e) => {
        const b = e.currentTarget;
        try { await navigator.clipboard.writeText(txt); b.innerHTML = '<i data-lucide="check"></i>Copiado'; KVShell.icones(); }
        catch (_) { KVShell.aviso('Não deu pra copiar sozinho; selecione o texto e copie', { erro: true }); }
      };
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
      else if (b.hasAttribute('data-resumo')) { KVShell.irPara({ janela: 'resumo' }); sincJanela(); }
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

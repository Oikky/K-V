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
  // sem "pegar" (2026-11-19): quem pesquisa lança em qualquer orçamento que ainda está na pesquisa
  // a pesquisa pronta também, pra quem está com ela, se o dono liberou em Configurações › Empresa
  const podeLancar = () => dono || ['novo', 'pesquisa'].includes(o.etapa) || (o.etapa === 'pesquisado' && o.responsavel === eu.email && est.podeCriar);
  // quem mais está com este orçamento aberto agora (a tela avisa o servidor a cada 30 s)
  let outrosAqui = [];
  const aquiHtml = () => (outrosAqui.length ? `<span class="etiqueta ok"><i data-lucide="eye"></i>${esc(outrosAqui.map((n) => n.split(' ')[0]).join(' e '))} ${outrosAqui.length > 1 ? 'estão' : 'está'} aqui agora</span>` : '');
  // quem pode pegar orçamento; quem já está com ele aparece mesmo que não pesquise (ex.: o dono pegou)
  const nomeDe = (email) => { const u = est.usuarios.find((x) => x.email === email); return u ? u.nome.split(' ')[0] : 'outra pessoa'; };
  const pesquisadores = () => est.usuarios.filter((u) => ((u.papel === 'pesquisador' || u.pesquisa) && u.ativo !== 0) || u.email === o.responsavel);
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

  // ---------- barra de cima da janela: conferência, resumo e o que dá pra fazer agora ----------
  function topo() {
    const feitos = o.conferencia.filter((c) => c.feito).length;
    let acoes = '';
    if (dono) acoes = `<label class="sel-pilula solta"><span class="escondido">Pesquisador</span><select id="passar">${[['', 'Na fila'], ...pesquisadores().map((u) => [u.email, `${u.nome.split(' ')[0]} pesquisa`])].map(([v, t]) => `<option value="${esc(v)}" ${(o.responsavel || '') === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="sel-pilula solta"><span class="escondido">Etapa</span><select id="etapa">${O.etapas.map((e) => `<option value="${e.id}" ${e.id === o.etapa ? 'selected' : ''}>${e.nome}</option>`).join('')}</select></label>
        ${o.etapa === 'pesquisa' && eu.pesquisa ? '<button class="btn primario" data-pesquisado><i data-lucide="check-check"></i>Marcar como pesquisado</button>' : ''}`;
    else if (o.etapa === 'pesquisa') acoes = '<button class="btn primario" data-pesquisado><i data-lucide="check-check"></i>Marcar como pesquisado</button>';
    acoes = `<span data-aqui>${aquiHtml()}</span>${acoes}`;
    // todos editam o pedido e falam com o cliente (2026-11-14)
    return `<div class="pq-barra">
        <button class="btn" data-conf><i data-lucide="list-checks"></i>Conferência ${feitos}/${o.conferencia.length}</button>
        <button class="btn" data-resumo><i data-lucide="file-text"></i>Resumo escrito</button>
        <a class="btn" href="novo-orcamento.html?editar=${o.id}"><i data-lucide="pencil"></i>Editar pedido</a>
        ${o.contato.whatsapp ? `<a class="btn redondo" href="https://wa.me/${o.contato.whatsapp.length <= 11 ? '55' : ''}${o.contato.whatsapp}" target="_blank" rel="noopener" title="Abrir a conversa no WhatsApp" aria-label="WhatsApp"><i data-lucide="message-circle"></i></a>` : ''}
        <span class="acoes">${acoes}</span></div>`;
  }

  // ---------- à esquerda: os trechos (a pílula laranja vai até o escolhido) e o que o cliente pediu ----------
  function trechos() {
    const ti = trechoSel(), varios = O.roteiros(o).length > 1;
    return `<aside class="pq-lado">
      <div class="trs" role="tablist" aria-label="Trechos" aria-orientation="vertical"><span class="ind" aria-hidden="true"></span>${o.trechos.map((t, i) => { const n = opsDo(i).length;
        return `<button class="tr4" role="tab" aria-selected="${i === ti}" data-t="${i}"><span class="i ${n ? 'ok' : ''}">${i + 1}</span><b>${esc(t.de)} → ${esc(t.para)}</b><span class="n">${n || '—'}</span>
          <small>${varios ? esc(KVProp.nomeTrecho(o, i, true)) + ' · ' : ''}${O.diaCurto(t.data)} ${O.dataCurta(t.data)}${t.outrasDatas.length ? ` · também ${esc(O.diasTexto(t.outrasDatas))}` : ''}</small></button>`; }).join('')}</div>
      <p class="pq-info">${O.etapa(o.etapa).nome} · ${!o.responsavel ? 'sem voo' : `${o.opcoes.length ? 'último voo' : 'pra'} ${esc(o.responsavel === eu.email ? 'você' : nomeDe(o.responsavel))}`} · ${O.fmtPax(o.passageiros)} · ${O.idade(o.criadoEm)}${dono && o.pessoaId ? ' · <span style="color:var(--orange)">é cliente</span>' : ''}</p>
      ${o.pedido ? `<div class="ped"><b>Pedido especial</b>${esc(o.pedido)}</div>` : ''}
      ${doBot()}
      <div class="pq-sky">${KVSky.html(o, podeLancar())}</div></aside>`;
  }

  // ---------- filtro de dias: a fita de dias, com o mês em cada dia e o ano contornando os dias dele ----------
  // os dias de um trecho podem se espalhar por um mês ou mais e virar o ano (dez/2026 e jan/2027 não se misturam)
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesDe = (iso) => +iso.slice(5, 7) - 1;
  const somaDia = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return O.isoDia(d); };
  // milhas curtas: 51.000 → 51k, 129.500 → 130k
  const kMil = (n) => `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: n >= 100000 ? 0 : 1 })}k`;
  // o mais barato: pro dono, pelo custo; pra quem pesquisa, pelas milhas (ou o preço em dinheiro)
  const peso = (x) => (dono ? O.custoPessoa(x) : x.milhas != null ? x.milhas : x.preco);
  const maisBarata = (l) => [...l].sort((a, b) => peso(a) - peso(b))[0];
  const curto = (x) => (x.milhas != null ? kMil(x.milhas) : `R$${Math.round(x.preco / 100)}`);
  function filtroDias(ti, dias) {
    const dia = KVShell.param('dia'), pedidos = [o.trechos[ti].data, ...o.trechos[ti].outrasDatas];
    const n = (d) => opsDo(ti).filter((x) => x.data === d).length;
    // antes do "Todos", o botão da linha do tempo de todos os trechos
    const abre = o.trechos.length > 1 ? '<button class="cal-abre" data-abre-cal aria-label="Linha do tempo de todos os trechos" title="Todos os trechos"><i data-lucide="calendar-range"></i></button>' : '';
    const todos = dias.length > 1 ? `<button class="dia-c todos" data-dia="" aria-pressed="${!dia}">Todos</button>` : '';
    const chip = (d) => `<button class="dia-c ${pedidos.includes(d) ? 'pedido' : ''}" data-dia="${d}" aria-pressed="${d === dia}" aria-label="${O.diaCurto(d)} ${+d.slice(8)} de ${MESES[mesDe(d)]} de ${d.slice(0, 4)}: ${n(d)} opções"><small>${O.diaCurto(d)}</small><b>${d.slice(8)}</b><em>${MESES[mesDe(d)]}</em><i>${n(d)}</i></button>`;
    const anos = [...new Set(dias.map((d) => d.slice(0, 4)))];
    const fita = dias.length > 1 ? anos.map((a) => `<div class="fd-ano"><span class="fd-ano-n">${a}</span>${dias.filter((d) => d.startsWith(a)).map(chip).join('')}</div>`).join('') : '';
    return `<div class="fa-dias">${abre}${todos}${fita}</div>`;
  }

  // ---------- linha do tempo de todos os trechos (abre no botão antes do "Todos") ----------
  // os dias em colunas, um trecho por linha, cada trecho com sua cor e número (as cores fogem das dos sites)
  const marcaT = (ti) => `<span class="tmarca t${ti % 4}">${ti + 1}</span>`;
  function linhaDoTempo() {
    const ti = trechoSel(), dia = KVShell.param('dia');
    const datas = [...new Set(o.opcoes.map((x) => x.data))].sort();
    if (!datas.length) return '<p class="vazio">Ainda não tem nenhum voo lançado.</p>';
    const cols = [];
    for (let d = datas[0]; d <= datas[datas.length - 1]; d = somaDia(d, 1)) cols.push(d);
    // dias seguidos sem nenhum voo viram uma coluna estreita "…"
    const vazio = (d) => !datas.includes(d);
    const mostra = cols.filter((d, k) => !vazio(d) || !(vazio(cols[k - 1] || datas[0]) && vazio(cols[k + 1] || datas[0])));
    const celulas = [];
    mostra.forEach((d, k) => { if (k && somaDia(mostra[k - 1], 1) !== d) celulas.push(null); celulas.push(d); });
    // o mês aparece onde ele começa (pulando os "…"); o ano junto, no começo e quando vira
    let ultimo = null;
    const cab = celulas.map((d) => {
      if (!d) return '<span class="tl-pulo">…</span>';
      const novoMes = !ultimo || ultimo.slice(0, 7) !== d.slice(0, 7), novoAno = !ultimo || ultimo.slice(0, 4) !== d.slice(0, 4);
      ultimo = d;
      return `<span class="tl-dia ${novoMes ? 'novo-mes' : ''} ${d === dia ? 'sel' : ''}">${novoMes ? `<em>${MESES[mesDe(d)]}${novoAno ? ` ${d.slice(0, 4)}` : ''}</em>` : ''}<small>${O.diaCurto(d).slice(0, 1)}</small><b>${+d.slice(8)}</b></span>`;
    }).join('');
    const linhas = o.trechos.map((t, i) => `<div class="tl-linha ${i === ti ? 'atual' : ''}"><span class="tl-rot">${marcaT(i)}<b>${esc(t.de)} → ${esc(t.para)}</b></span>${celulas.map((d) => {
      if (!d) return '<span class="tl-pulo"></span>';
      const ops = o.opcoes.filter((x) => x.trecho === i && x.data === d);
      return ops.length ? `<button class="tl-c t${i % 4} ${d === dia && i === ti ? 'sel' : ''}" data-ir="${i}|${d}" aria-label="Trecho ${i + 1}, ${+d.slice(8)} de ${MESES[mesDe(d)]}: ${ops.length} opções, a partir de ${curto(maisBarata(ops))}">${curto(maisBarata(ops))}${ops.length > 1 ? `<i>${ops.length}</i>` : ''}</button>` : '<span class="tl-c vazio"></span>';
    }).join('')}</div>`).join('');
    // colunas: o rótulo do trecho, um dia por coluna e uma estreita onde pulou dias sem voo
    return `<div class="tl" style="--tpl:${celulas.map((d) => (d ? 'var(--c)' : '18px')).join(' ')}"><div class="tl-grade"><div class="tl-linha cab"><span class="tl-rot"></span>${cab}</div>${linhas}</div></div>`;
  }

  let menuAberto = null, confirmarApagar = null, editando = null;
  const vooAberto = () => +KVShell.param('voo') || null;
  const nomePor = (email) => { const u = est.usuarios.find((x) => x.email === email); return u ? u.nome.split(' ')[0] : email || ''; };
  // o detalhe do voo: as linhas entram em cascata e embaixo fica o que dá pra fazer com ele
  function detalheOp(op) {
    const fora = foraDoPedido(op), onde = (op.escalasOnde || []).filter((e) => e[0]).map((e) => (e[1] ? `${e[0]} (${e[1]})` : e[0])).join(', ');
    const linhas = [
      ['Dia e horário', `${O.diaCurto(op.data)} ${O.dataCurta(op.data)} · ${op.sai} → ${esc(op.chega)}${op.duracao ? ` · ${esc(op.duracao)}` : ''}`],
      ['Voo', [op.voo, op.cia, op.cabine].filter(Boolean).map(esc).join(' · ')],
      ['Escalas', `${op.escalas ? `${op.escalas} escala${op.escalas > 1 ? 's' : ''}` : 'direto'}${onde ? ` · ${esc(onde)}` : ''}`],
      ['Bagagem', op.bagagem ? `${op.bagagem > 1 ? `${op.bagagem} malas` : '1 mala'}${op.milhas_mala ? ` (+ ${fmt.pts(op.milhas_mala)} pts)` : ''}` : 'sem mala despachada'],
      eDinheiro(op.site) ? ['Preço', `${fmt.brl(op.preco)} por pessoa`] : ['Milhas e taxa', `${fmt.pts(op.milhas)} pts + ${O.taxaTxt(op.taxa)} por pessoa`],
      dono ? ['Custo total', fmt.brl(O.custo(op, o))] : null,
      fora.length ? ['Fora do pedido', `<span class="warn-t">${fora.join(' · ')}</span>`] : null,
      op.destaque ? ['Destaque', esc(op.destaque)] : null,
      op.obs ? ['Obs.', esc(op.obs)] : null,
      ['Site', `${esc(op.site)}${op.link ? ` · <button class="link-b" type="button" data-link="${esc(op.link)}">abrir o preço no site</button>` : ''}`],
      op.criada_por ? ['Lançado por', esc(nomePor(op.criada_por))] : null,
    ].filter((l) => l && l[1]);
    const acoes = confirmarApagar === op.id
      ? `<span class="pergunta">Apagar este voo?</span><button class="btn perigo" data-del="${op.id}"><i data-lucide="trash-2"></i>Sim, apagar</button><button class="btn" data-cancela>Não</button>`
      : podeLancar() ? `<button class="btn" data-editar-op="${op.id}"><i data-lucide="pencil"></i>Editar</button>${o.trechos.length > 1 ? `<button class="btn" data-mover-op="${op.id}"><i data-lucide="move-right"></i>Mover pra outro trecho</button>` : ''}<button class="btn" data-dup="${op.id}"><i data-lucide="copy"></i>Repetir com outros dados</button><button class="btn perigo fim" data-pede-del="${op.id}"><i data-lucide="trash-2"></i>Apagar</button>` : '';
    return `<dl class="linhas">${linhas.map(([r, v], i) => `<dt style="--i:${i}">${r}</dt><dd style="--i:${i}">${v}</dd>`).join('')}</dl>${acoes ? `<div class="acoes-v" style="--i:${linhas.length}">${acoes}</div>` : ''}`;
  }
  function cartaoOp(op, melhor) {
    const on = vooAberto() === op.id, dinheiro = eDinheiro(op.site);
    return `<div class="v4c ${on ? 'aberto' : ''} ${op.id === ultimaNova ? 'nova' : ''}" data-k="${op.id}">
      <button class="v4 ${melhor ? 'menor' : ''}" data-voo="${op.id}" aria-expanded="${on}">
        <span class="site" data-s="${esc(op.site)}">${esc(op.site)}</span>
        <span class="h">${O.diaCurto(op.data)} ${O.dataCurta(op.data)} · ${op.sai} → ${esc(op.chega.replace(/ \+\d$/, ''))}${/\+\d$/.test(op.chega) ? `<small>${op.chega.slice(-2)}</small>` : ''}</span>
        <span class="p">${dinheiro ? fmt.brl(op.preco) : `${fmt.pts(op.milhas)} <small class="u">pts</small>`}<small>${dinheiro ? 'em dinheiro' : `+ ${O.taxaTxt(op.taxa)}`}</small></span>
        <span class="m">${op.escalas ? `${op.escalas} escala${op.escalas > 1 ? 's' : ''}` : 'direto'} · ${op.bagagem ? (op.bagagem > 1 ? `${op.bagagem} malas` : '1 mala') : 'sem mala'}${op.voo ? ` · ${esc(op.voo)}` : ''}${melhor ? `<span class="melhor">${dono ? 'menor custo' : 'menos milhas'}</span>` : ''}${foraDoPedido(op).length ? '<span class="fora">fora do pedido</span>' : ''}</span>
        <span class="chev"><i data-lucide="chevron-down"></i></span></button>
      <div class="det-wrap" ${on ? '' : 'inert'}><div><div class="det">${detalheOp(op)}</div></div></div></div>`;
  }
  function opcoes() {
    const ti = trechoSel(), t = o.trechos[ti], dia = KVShell.param('dia'), n = opsDo(ti).length;
    const dias = [...new Set(opsDo(ti).map((x) => x.data))].sort();
    const l = opsDo(ti).filter((x) => !dia || x.data === dia)
      .sort(dono ? (a, b) => O.custoPessoa(a) - O.custoPessoa(b) : (a, b) => a.data.localeCompare(b.data) || (a.milhas || 1e9) - (b.milhas || 1e9));
    const melhor = l.length > 1 ? maisBarata(l) : null;
    const mais = podeLancar() ? `<button class="lancar" data-nova><i data-lucide="plus"></i>${n ? 'Lançar outro voo' : 'Lançar o primeiro voo'} em ${esc(t.de)} → ${esc(t.para)}<kbd>N</kbd></button>` : '';
    return `<h3>${esc(t.de)} → ${esc(t.para)}<small>${O.diaCurto(t.data)} ${O.dataCurta(t.data)} · ${n} ${n === 1 ? 'voo' : 'voos'}</small></h3>
      ${dias.length > 1 || (o.trechos.length > 1 && o.opcoes.length) ? filtroDias(ti, dias) : ''}
      ${l.length ? l.map((op) => cartaoOp(op, op === melhor)).join('') : `<p class="vazio-t">Nenhum voo${dia ? ' nesse dia' : ' neste trecho'} ainda.</p>`}${mais}`;
  }

  // ---------- pílula laranja dos trechos: desliza até o escolhido ----------
  const calmo = matchMedia('(prefers-reduced-motion: reduce)');
  // o endereço sem o voo aberto, como estava no último desenho: voltar que só fecha o voo não redesenha
  const semVoo = () => { const p = new URLSearchParams(location.search); p.delete('voo'); return p.toString(); };
  let desenhado = '';
  function moverInd(sem) {
    const ind = app.querySelector('.trs .ind'), b = app.querySelector('.tr4[aria-selected="true"]'); if (!ind || !b) return;
    if (sem) ind.style.transition = 'none';
    ind.style.transform = `translateY(${b.offsetTop}px)`; ind.style.height = b.offsetHeight + 'px';
    if (sem) { void ind.offsetWidth; ind.style.transition = ''; }
  }
  // troca o trecho sem redesenhar a esquerda: a pílula anda e os voos entram vindo do lado pra onde a pessoa foi
  function trocarTrecho(n) {
    const antes = trechoSel();
    const p = new URLSearchParams(location.search); p.set('t', n); p.delete('dia'); p.delete('voo');
    history.replaceState(history.state, '', '?' + p); desenhado = semVoo();
    app.querySelectorAll('[data-t]').forEach((b) => b.setAttribute('aria-selected', +b.dataset.t === n));
    moverInd();
    const lado = app.querySelector('.pq-voos');
    lado.innerHTML = opcoes(); lado.scrollTop = 0;
    lado.style.setProperty('--dir', n > antes ? 1 : -1);
    lado.classList.remove('entra'); void lado.offsetWidth; lado.classList.add('entra');
    KVShell.icones();
  }
  // abre/fecha o detalhe do voo sem redesenhar, pra animação correr (e poder ser interrompida)
  function syncVoo() {
    const v = vooAberto();
    app.querySelectorAll('.v4c').forEach((c) => {
      const on = +c.dataset.k === v;
      c.classList.toggle('aberto', on); c.querySelector('.v4').setAttribute('aria-expanded', on); c.querySelector('.det-wrap').inert = !on;
    });
    const c = v && app.querySelector(`.v4c[data-k="${v}"]`);
    if (c) setTimeout(() => c.scrollIntoView({ block: 'nearest', behavior: calmo.matches ? 'auto' : 'smooth' }), 300);
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
    const lado = app.querySelector('.pq-voos'), st = lado ? lado.scrollTop : 0;
    app.innerHTML = topo() + `<div class="pq-meio">${trechos()}<div class="pq-voos" role="tabpanel">${opcoes()}</div></div>`;
    app.querySelector('.pq-voos').scrollTop = st;
    // a pílula mede o trecho escolhido; mede de novo quando o tamanho muda (estilo chegando, letra carregando, janela mudando)
    new ResizeObserver(() => moverInd(true)).observe(app.querySelector('.trs'));
    document.title = `#${o.id} ${O.destino(o)} · K&V`;
    KVShell.icones();
    ultimaNova = null; desenhado = semVoo();
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

  // o formulário da opção é o mesmo da barra da extensão: shared/opcao-form.js
  function formOp() {
    const t = o.trechos[trechoSel()];
    return `<div class="form-op">${KVOpcao.html(t, rascunho || {}, { dia: KVShell.param('dia') })}
      <span class="lanc">${editando ? 'Enter salva a alteração.' : 'Enter salva e deixa o painel aberto pra próxima. Site e dia continuam.'}</span></div>`;
  }
  const lerCampos = () => KVOpcao.ler(dlg);
  async function salvarOp() {
    const v = lerCampos(), t = o.trechos[trechoSel()];
    const { erros, dados: d } = KVOpcao.montar(v, t);
    dlg.querySelectorAll('[data-f]').forEach((el) => el.classList.toggle('erro', erros.includes(el.dataset.f)));
    if (erros.length) { dlg.querySelector(`[data-f="${erros[0]}"]`).focus(); return false; }
    const dados = { orcamento: o.id, trecho: trechoSel(), ...d }, sai = d.sai;
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
  const paraForm = KVOpcao.deOpcao;
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
    } else if (j === 'cal') {
      dlg.classList.add('calj');
      const desenha = () => {
        dlg.innerHTML = cab('Todos os trechos', 'Toque num voo pra abrir aquele trecho naquele dia') + `<div class="corpo">${linhaDoTempo()}</div>
          <footer><span></span><button class="btn" data-x>Fechar</button></footer>`;
        dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fecharJanela);
        // tocar num voo do calendário: fecha e abre aquele trecho naquele dia
        dlg.querySelectorAll('[data-ir]').forEach((b) => b.onclick = () => { const [t, d] = b.dataset.ir.split('|'); dlg.close(); rascunho = null; KVShell.irPara({ t, dia: d, mes: null, janela: null }); render(); });
        // linha do tempo: já abre no dia escolhido, ou no primeiro voo do trecho aberto
        // (depois que a janela abre, senão ainda não tem tamanho)
        requestAnimationFrame(() => { const tl = dlg.querySelector('.tl'), sel = tl && tl.querySelector('button.tl-c.sel, .tl-linha.atual button.tl-c');
          if (sel) tl.scrollLeft = Math.max(0, sel.offsetLeft - tl.querySelector('.tl-rot').offsetWidth - 60); });
      };
      desenha();
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
    } else if (j === 'mover' && podeLancar()) {
      // a opção vai pra outro trecho (ida ↔ volta, ou outro roteiro)
      const op = o.opcoes.find((x) => x.id === +KVShell.param('op')); if (!op) { fecharJanela(); return; }
      const nome = (i) => (o.trechos.length > 1 ? KVProp.nomeTrecho(o, i, true) : 'Trecho 1');
      dlg.innerHTML = cab('Mover pra outro trecho', `${esc(op.site)} · ${O.dataCurta(op.data)} · ${op.sai} → ${op.chega} · hoje em ${esc(nome(op.trecho))}`) + `<div class="corpo" style="display:grid;gap:8px;padding-bottom:14px">
        ${o.trechos.map((t, i) => `<button class="mover-l" data-pra="${i}" aria-pressed="${i === op.trecho}" ${i === op.trecho ? 'disabled' : ''}>
          <span><small>${esc(nome(i))}${i === op.trecho ? ' · onde está' : ''}</small><b>${esc(t.de)} → ${esc(t.para)}</b><small>${O.dataCurta(t.data)} · ${opsDo(i).length} opções</small></span>${i === op.trecho ? '<i data-lucide="check"></i>' : '<i data-lucide="arrow-right"></i>'}</button>`).join('')}</div>`;
      dlg.querySelectorAll('[data-pra]').forEach((b) => b.onclick = async () => {
        dlg.querySelectorAll('[data-pra]').forEach((x) => { x.disabled = true; });
        const pra = +b.dataset.pra;
        if (await fazer('op.mover', { orcamento: o.id, id: op.id, trecho: pra })) { fecharJanela(); render(); KVShell.aviso(`Opção movida pra ${nome(pra)}`); }
        else { fecharJanela(); render(); }
      });
    } else if (j === 'pesquisado') {
      const falta = o.conferencia.filter((c) => !c.feito), semOp = o.trechos.map((t, i) => ({ t, i })).filter(({ i }) => !opsDo(i).length), tudo = !falta.length && !semOp.length;
      dlg.innerHTML = cab('Marcar como pesquisado?', 'Vai pro dono revisar e montar a proposta') + `<div class="corpo" style="display:grid;gap:10px;padding-bottom:14px">
        ${tudo ? '<div class="aviso ok">Tudo conferido e todos os trechos têm opção.</div>' : ''}
        ${semOp.map(({ t }) => `<div class="aviso danger">${t.de} → ${t.para} está sem nenhuma opção.</div>`).join('')}
        ${falta.length ? `<div class="aviso warn">Falta conferir:<ul style="margin:6px 0 0;padding-left:18px">${falta.map((c) => `<li>${esc(c.texto)}</li>`).join('')}</ul></div>` : ''}</div>
        <footer><button class="btn" data-x>${tudo ? 'Cancelar' : 'Voltar e conferir'}</button><button class="btn primario" data-ok><i data-lucide="check-check"></i>${tudo ? 'Marcar como pesquisado' : 'Marcar mesmo assim'}</button></footer>`;
      dlg.querySelector('[data-ok]').onclick = async (e) => { e.currentTarget.disabled = true; if (await fazer('orc.pesquisado', { id: o.id })) { fecharJanela(); render(); KVShell.janelaCab(o); KVShell.aviso('Pronto: foi pro dono revisar'); } else e.currentTarget.disabled = false; };
    } else { if (dlg.open) dlg.close(); return; }
    dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fecharJanela);
    if (!dlg.open) dlg.showModal();
    KVShell.icones();
  }

  // ---------- ações ----------
  function ligarEventos() {
    KVSky.ligar(app, () => o, (e) => KVShell.aviso(e.message, { erro: true }));
    // o que fica no detalhe do voo aberto
    app.addEventListener('click', async (e) => {
      const v = e.target.closest('[data-voo]');
      if (v) { e.stopImmediatePropagation(); const k = +v.dataset.voo, aberto = vooAberto(); confirmarApagar = null;
        if (aberto === k) { KVShell.desfazer({ voo: 1 }, syncVoo); return; }
        if (aberto) { const p = new URLSearchParams(location.search); p.set('voo', k); history.replaceState(history.state, '', '?' + p); }
        else KVShell.irPara({ voo: k });
        syncVoo(); return; }
      const l = e.target.closest('[data-link]'); if (l) { e.stopImmediatePropagation(); window.open(l.dataset.link, '_blank', 'noopener'); return; }
      const pd = e.target.closest('[data-pede-del]'); if (pd) { e.stopImmediatePropagation(); confirmarApagar = +pd.dataset.pedeDel; render(); return; }
      if (e.target.closest('[data-cancela]')) { e.stopImmediatePropagation(); confirmarApagar = null; render(); return; }
      const ed = e.target.closest('[data-editar-op]');
      if (ed) { e.stopImmediatePropagation(); const op = o.opcoes.find((x) => x.id === +ed.dataset.editarOp); editando = op.id; menuAberto = null;
        rascunho = paraForm(op); render(); KVShell.irPara({ janela: 'nova' }); sincJanela(); return; }
      const mv = e.target.closest('[data-mover-op]');
      if (mv) { e.stopImmediatePropagation(); menuAberto = null; render(); KVShell.irPara({ janela: 'mover', op: mv.dataset.moverOp }); sincJanela(); return; }
      if (e.target.closest('[data-dup], [data-del]')) { confirmarApagar = null; editando = null; }
    }, true);
    // Esc fecha o voo aberto antes de fechar a janela
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && vooAberto() && !dlg.open && !conf.open) { e.preventDefault(); KVShell.desfazer({ voo: 1 }, syncVoo); } });
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.t != null) { const n = +b.dataset.t; if (n === trechoSel()) return; rascunho = null; if (vooAberto()) { KVShell.desfazer({ voo: 1 }, () => {}); setTimeout(() => trocarTrecho(n), 0); } else trocarTrecho(n); }
      else if (b.dataset.dia != null) { if (b.dataset.dia !== (KVShell.param('dia') || '')) { KVShell.irPara({ dia: b.dataset.dia || null }); render(); } }
      else if (b.hasAttribute('data-abre-cal')) { KVShell.irPara({ janela: 'cal' }); sincJanela(); }
      else if (b.hasAttribute('data-nova')) { salvasAgora = 0; editando = null; rascunho = rascunho && { site: rascunho.site, data: rascunho.data }; KVShell.irPara({ janela: 'nova' }); sincJanela(); }
      else if (b.dataset.dup) { const op = o.opcoes.find((x) => x.id === +b.dataset.dup); rascunho = paraForm(op); salvasAgora = 0; KVShell.irPara({ janela: 'nova' }); sincJanela(); }
      else if (b.dataset.del) { if (await fazer('op.apagar', { orcamento: o.id, id: +b.dataset.del })) { KVShell.aviso('Voo apagado'); KVShell.desfazer({ voo: 1 }, () => {}); } render(); }
      else if (b.hasAttribute('data-resumo')) { KVShell.irPara({ janela: 'resumo' }); sincJanela(); }
      else if (b.hasAttribute('data-conf')) { KVShell.irPara({ janela: 'conf' }); sincJanela(); }
      else if (b.hasAttribute('data-pesquisado')) { KVShell.irPara({ janela: 'pesquisado' }); sincJanela(); }
    });
    app.addEventListener('change', async (e) => {
      if (e.target.id === 'passar') { await fazer('orc.passar', { id: o.id, email: e.target.value || null }); render(); }
      if (e.target.id === 'etapa') { await fazer('orc.etapa', { id: o.id, etapa: e.target.value }); render(); KVShell.janelaCab(o); }
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
      app = KVShell.montar('orcamentos', { dono, janela: { o, aba: 'pesquisa' } });
      ligarEventos();
      render(); sincJanela();
      KVShell.aoVoltar(() => { if (semVoo() === desenhado) syncVoo(); else render(); sincJanela(); });
      // quando volta pra aba, traz o que outra pessoa pode ter lançado
      document.addEventListener('visibilitychange', async () => { if (!document.hidden && !dlg.open && !ocupado) { try { o = await KVApi.orcamento(id); render(); } catch (_) {} } });
      // avisa que está aqui (só na pesquisa e com a aba visível) e mostra quem mais está
      const avisar = async () => {
        if (document.hidden || !['novo', 'pesquisa'].includes(o.etapa)) return;
        try { outrosAqui = (await KVApi.presenca(o.id)).outros; const el = app.querySelector('[data-aqui]'); if (el) { el.innerHTML = aquiHtml(); KVShell.icones(); } } catch (_) {}
      };
      avisar(); setInterval(avisar, 30000);
    } catch (e) {
      const c = document.querySelector('.carregando');
      if (c) c.innerHTML = `${esc(e.message)} <a href="orcamentos.html" style="color:var(--orange)">Voltar pros orçamentos</a>`;
    }
  })();
};

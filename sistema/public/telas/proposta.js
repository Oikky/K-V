/* Tela: Proposta (combinações e mensagem). Endereço: /proposta.html
   Proposta (rodada 9 dos rascunhos), lendo e gravando no banco: o dono monta de 1 a 3 combinações (uma opção de voo por trecho).
     O que importa pra ele são as milhas: o preço pro cliente sai de milhas × valor da milha + taxa. O valor da milha vem das
     configurações e pode mudar em cada combinação; o preço também pode ser digitado livre. Tudo se salva sozinho. Só o dono.
   O estilo desta tela está em telas/proposta.css. */
KVTelas['proposta'] = function () {
  const O = KVOrc, P = KVProp, { esc, fmt } = KVOrc;
  const id = Number(KVShell.param('id'));
  let o = null, app = null;
  let editandoMsg = false, menuAberto = null, confirmarApagar = null, renomeando = null, copiado = false;
  const editavel = () => ['pesquisado', 'enviado'].includes(o.etapa);
  const lerNum = (t) => { const n = +String(t || '').replace(/[^\d,]/g, '').replace(',', '.'); return isFinite(n) && n > 0 ? n : null; };
  const numCampo = (c) => c == null ? '' : (c / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const hora = (x) => `${x.sai} → ${x.chega.replace(/ \+\d$/, '')}${/\+\d$/.test(x.chega) ? `<sup>${x.chega.slice(-2)}</sup>` : ''}`;
  const detalhe = (x) => [x.escalas ? `${x.escalas} escala${x.escalas > 1 ? 's' : ''}` : 'direto', x.bagagem && 'mala'].filter(Boolean).join(' · ');
  const valorOp = (x) => O.site(x.site).forma === 'dinheiro' ? fmt.brl(x.preco) : `${fmt.pts(x.milhas)} pts + ${fmt.brl(x.taxa)}`;
  const teto = () => P.teto(o);
  const venda = (c) => P.venda(o, c);
  // cada combinação tem uma chave na tela (a nova ainda não tem id no banco)
  let nK = 0;
  const chavear = (c) => { c._k = c.id ? 'c' + c.id : 'n' + (++nK); return c; };
  const comboK = (k) => o.combos.find((x) => x._k === k);

  // ---------- salvar sozinho: um instante depois de cada mudança, uma gravação por vez ----------
  let timer = null, salvando = null, sujo = false;
  function marcarSujo() { sujo = true; clearTimeout(timer); timer = setTimeout(salvar, 700); estadoSalvo('Salvando…'); }
  function estadoSalvo(t) { const el = app && app.querySelector('[data-salvo]'); if (el) el.textContent = t; }
  async function salvar() {
    clearTimeout(timer);
    if (salvando) { await salvando; if (!sujo) return; }
    if (!sujo || !editavel()) return;
    sujo = false;
    const envio = o.combos;
    salvando = KVApi.acao('prop.salvar', { orcamento: o.id, combos: envio.map((c) => ({ id: c.id, nome: c.nome, escolha: c.escolha, milha: c.milha, livre: c.livre, parcelado: c.parcelado, vezes: c.vezes })) }, { quieto: true })
      .then((r) => { envio.forEach((c, i) => { c.id = r.ids[i]; }); if (!sujo) estadoSalvo('Tudo salvo'); })
      .catch(async (e) => { KVShell.aviso(e.message, { erro: true }); await recarregar(); render(); })
      .finally(() => { salvando = null; });
    await salvando;
    if (sujo) return salvar();
  }
  addEventListener('beforeunload', (e) => { if (sujo || salvando) { salvar(); e.preventDefault(); } });
  async function recarregar() { o = await KVApi.orcamento(id); o.combos.forEach(chavear); }
  async function fazer(acao, dados) {
    await salvar();
    try { const r = await KVApi.acao(acao, dados); await recarregar(); return r; }
    catch (e) { KVShell.aviso(e.message, { erro: true }); await recarregar(); return null; }
  }

  // ---------- resumo de cima: milhas na mais econômica, quantas opções, o Skyscanner e "Tudo salvo" ----------
  function resumo() {
    const menos = o.combos.length ? Math.min(...o.combos.map((c) => P.milhasCombo(o, c))) : 0;
    const t = teto();
    return `<div class="resumo">${menos ? `<span><b>${fmt.pts(menos)}</b> milhas na mais econômica</span>` : ''}
        <span><b>${o.opcoes.length}</b> opções pesquisadas</span>${t.valor ? `<span><b>${fmt.brl(t.valor).replace(',00', '')}</b> em dinheiro</span>` : ''}
        ${editavel() ? '<span class="salvo" data-salvo>Tudo salvo</span>' : ''}</div>
      <div class="sky-wrap">${KVSky.html(o, editavel())}</div>`;
  }

  // ---------- combinações: comparativo, os rótulos ficam uma vez só na coluna da esquerda ----------
  function menuCombo(c) {
    const it = (attrs, icone, texto, cls = '') => `<button role="menuitem" class="${cls}" ${attrs}><i data-lucide="${icone}"></i>${texto}</button>`;
    if (confirmarApagar === c._k) return `<div class="menu-orc" role="menu"><p>Tirar "${esc(c.nome)}" da proposta?</p>${it(`data-del="${c._k}"`, 'trash-2', 'Sim, tirar', 'perigo')}${it('data-cancela', 'x', 'Não')}</div>`;
    return `<div class="menu-orc" role="menu">${it(`data-renomear="${c._k}"`, 'pencil', 'Renomear')}${o.combos.length < 3 ? it(`data-dup="${c._k}"`, 'copy', 'Duplicar') : ''}${o.combos.length > 1 && o.aceita !== c.id ? it(`data-pede-del="${c._k}"`, 'trash-2', 'Tirar da proposta', 'perigo') : ''}</div>`;
  }
  const vm = (v) => (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  // um voo por trecho; clicar abre as outras opções do trecho embaixo dele (com roteiros, também as do mesmo trecho dos outros)
  const trocaAberta = () => KVShell.param('tr');
  // dia curto, sem o ano: "qua 10/03"
  const diaM = (d) => `${P.diaSem(d)} ${d.slice(8)}/${d.slice(5, 7)}`;
  function trechoCel(c, x, mist) {
    if (!x) return '<div class="trv vazio-cel"></div>';
    const k = `${c._k}:${x.trecho}`, on = trocaAberta() === k, base = O.custo(x, o);
    const tit = `<small>${diaM(x.data)} · <span class="sitio" data-s="${esc(x.site)}">${esc(x.site)}</span>${mist || O.roteiros(o).length > 1 ? ` · ${esc(o.trechos[x.trecho].de)} → ${esc(o.trechos[x.trecho].para)}` : ''}</small><b>${hora(x)}</b><small>${detalhe(x)} · ${valorOp(x)}</small>`;
    if (!editavel()) return `<div class="trv"><div class="tr-l">${tit}</div></div>`;
    const eqs = P.equivalentes(o, x.trecho);
    const outras = eqs.flatMap((t) => P.opsDo(o, t)).filter((y) => y.id !== x.id).sort((a, b) => O.custoPessoa(a) - O.custoPessoa(b));
    return `<div class="trv ${on ? 'aberto' : ''}" data-tr="${k}"><button class="tr-l" data-troca="${k}" aria-expanded="${on}" aria-label="Trocar a ${esc(P.nomeTrecho(o, x.trecho, mist).toLowerCase())} de ${esc(c.nome)}">${tit}<span class="troca"><i data-lucide="arrow-left-right"></i></span></button>
      <div class="alts-w" ${on ? '' : 'inert'}><div><div class="alts"><span class="mini">${outras.length ? 'Trocar por' : 'Não tem outra opção neste trecho'}</span>${outras.map((y, i) => { const d = O.custo(y, o) - base;
        return `<button class="alt" style="--i:${Math.min(i, 8)}" data-escolher="${c._k}:${y.id}"><b>${diaM(y.data)} · ${hora(y)}</b><span class="dif ${d < 0 ? 'menos' : ''}">${d < 0 ? '−' : '+'} ${fmt.brl(Math.abs(d))}</span>
          <small>${eqs.length > 1 ? `Roteiro ${O.letra(P.rotDoTrecho(o, y.trecho))} · ` : ''}<span class="sitio" data-s="${esc(y.site)}">${esc(y.site)}</span> · ${detalhe(y)} · ${valorOp(y)}</small></button>`; }).join('')}</div></div></div></div>`;
  }
  // milhas por programa, com o valor da milha desta combinação (− e + de 0,0005, ou digitado)
  function milhasCel(c) {
    const gs = P.porPrograma(o, c);
    if (!gs.length) return '<div class="mil"><span class="faint">sem milhas</span></div>';
    return `<div class="mil">${gs.map((g) => { const k = `${c._k}|${g.programa}`, nome = esc(P.progNome(g.programa)), mudou = g.valor !== g.padrao;
      return `<div class="ml"><span class="prog" data-p="${g.programa}">${nome}</span><span class="q">${fmt.pts(g.milhas)}<small>mi</small></span>
        ${editavel() ? `<span class="stp ${mudou ? 'mudou' : ''}"><button data-vm="${k}" data-passo="-500" aria-label="Diminuir valor da milha ${nome}"><i data-lucide="minus"></i></button><input data-vmi="${k}" inputmode="decimal" autocomplete="off" value="${vm(g.valor)}" aria-label="Valor da milha ${nome}" title="${mudou ? `padrão ${vm(g.padrao)}` : 'padrão das configurações'}"><button data-vm="${k}" data-passo="500" aria-label="Aumentar valor da milha ${nome}"><i data-lucide="plus"></i></button></span>`
          : `<span class="stp"><span>R$ ${vm(g.valor)}</span></span>`}
        <span class="eq" data-eq="${k}">${fmt.brl(g.reais)}${mudou && editavel() ? ` · <button class="link" data-vm-padrao="${k}">padrão</button>` : ''}</span></div>`; }).join('')}</div>`;
  }
  // preço à vista: começa no calculado (milhas × valor da milha + taxas) e o dono digita o que vai cobrar por cima
  const calcTxt = (c) => { if (c.livre == null) return 'calculado pelas milhas'; const calc = P.precoCalc(o, c), d = c.livre - calc;
    return `${d >= 0 ? '+' : '−'} ${fmt.brl(Math.abs(d))} do calculado${editavel() ? ` · <button class="link" data-calc="${c._k}">voltar pra ${fmt.brl(calc)}</button>` : ''}`; };
  function ppHtml(c) {
    const pp = Math.round(venda(c) / Math.max(1, O.pagantes(o))), t = P.tetoCombo(o, c).valor;
    const r = P.rotDaCombo(o, c), s = r < 0 ? {} : KVSky.de(o, r), d = s.valor ? pp - s.valor : 0;
    return `<b>${fmt.brl(pp)} <small>por pessoa</small></b>${s.valor ? `<span class="${d > 0 ? 'acima' : 'abaixo'}">${d ? `${d > 0 ? '+' : '−'} ${fmt.brl(Math.abs(d))}` : 'igual ao'} vs. Skyscanner</span>` : ''}${t && venda(c) > t ? '<span class="acima">acima do preço em dinheiro</span>' : ''}`;
  }
  const precoCel = (c) => `<div class="preco"><label class="caixa v-in ${c.livre != null ? 'livre' : ''}"><span>R$</span><input data-venda="${c._k}" inputmode="decimal" autocomplete="off" value="${numCampo(venda(c))}" aria-label="Preço à vista de ${esc(c.nome)}" ${editavel() ? '' : 'readonly'}></label>
      <small class="calc" data-calcl="${c._k}">${calcTxt(c)}</small><span class="pp" data-pp="${c._k}">${ppHtml(c)}</span></div>`;
  // parcelado: outro preço, digitado à mão, com o número de vezes; vai na mensagem como "em até 10x de ..."
  const parcCel = (c) => { const ed = editavel(); if (!ed && !c.parcelado) return '<div class="parc"><small>não oferece parcelado</small></div>';
    return `<div class="parc"><label class="caixa"><span>R$</span><input data-parc="${c._k}" inputmode="decimal" autocomplete="off" placeholder="parcelado" value="${numCampo(c.parcelado)}" aria-label="Valor total parcelado de ${esc(c.nome)}" ${ed ? '' : 'readonly'}></label>
      <select data-vezes="${c._k}" data-combo="nao" aria-label="Vezes" ${ed ? "" : "disabled"}>${Array.from({ length: 11 }, (_, i) => i + 2).map((n) => `<option value="${n}" ${n === c.vezes ? 'selected' : ''}>${n}x</option>`).join('')}</select>
      <small data-pinfo="${c._k}">${parcInfo(c)}</small></div>`; };
  function parcInfo(c) {
    if (!c.parcelado) return 'Vazio = não oferece parcelado';
    const v = venda(c), dif = c.parcelado - v, pct = Math.round((dif / v) * 1000) / 10;
    return `${c.vezes}x de ${fmt.brl(Math.round(c.parcelado / c.vezes))} · ${dif >= 0 ? '+' : '−'} ${fmt.brl(Math.abs(dif))} (${dif >= 0 ? '+' : '−'}${String(Math.abs(pct)).replace('.', ',')}%)`;
  }
  function colunaCombo(c, i, n) {
    const ops = P.opsDaCombo(o, c), mist = P.rotDaCombo(o, c) < 0, aceitaEsta = o.aceita != null && o.aceita === c.id;
    const titulo = renomeando === c._k ? `<input data-nome="${c._k}" value="${esc(c.nome)}" aria-label="Nome da combinação" maxlength="28">` : `<b>${esc(c.nome)}</b>`;
    return `<article class="cb ${aceitaEsta ? 'aceita' : ''}" data-cb="${c._k}"><header><span class="nro">${i + 1}</span>${titulo}${aceitaEsta ? '<span class="etiqueta ok">aceita</span>' : ''}
        ${editavel() ? `<button class="bt-mais" data-menu="${c._k}" aria-haspopup="menu" aria-expanded="${menuAberto === c._k}" aria-label="Ações de ${esc(c.nome)}"><i data-lucide="ellipsis"></i></button>${menuAberto === c._k ? menuCombo(c) : ''}` : ''}</header>
      ${Array.from({ length: n }, (_, k) => trechoCel(c, ops[k], mist)).join('')}${milhasCel(c)}${precoCel(c)}${parcCel(c)}</article>`;
  }
  // um comparativo por roteiro (A, B…) e um pras misturadas; cada um com as linhas: trechos, milhas, à vista, parcelado
  function grupo(lista, r, titulo) {
    const rs = O.roteiros(o), idx = r >= 0 ? rs[r] : null;
    const n = idx ? idx.length : Math.max(1, ...lista.map(([c]) => P.opsDaCombo(o, c).length));
    const pode = r >= 0 && editavel() && lista.length < 3 && idx.every((ti) => P.opsDo(o, ti).length);
    if (!lista.length && !pode) return `<section class="grupo">${titulo}<div class="vazio">Falta opção de voo em algum trecho${rs.length > 1 ? ' deste roteiro' : ''}. <a href="orcamento.html?id=${o.id}" data-trocar style="color:var(--orange)">Voltar pra pesquisa</a></div></section>`;
    const rotT = (k) => idx ? `<b>${esc(P.nomeTrecho(o, idx[k]))}</b><small>${esc(o.trechos[idx[k]].de)} → ${esc(o.trechos[idx[k]].para)}</small>` : `<b>Trecho ${k + 1}</b>`;
    const rot = ['', ...Array.from({ length: n }, (_, k) => rotT(k)), '<b>Milhas</b><small>e valor da milha</small>', '<b>À vista</b><small>Pix ou dinheiro</small>', '<b>Parcelado</b><small>no cartão</small>'];
    return `<section class="grupo">${titulo}<div class="combos g2" style="--nl:${n + 4};--nc:${Math.max(2, lista.length + (pode ? 1 : 0))}"><div class="rotulos">${rot.map((x) => `<span>${x}</span>`).join('')}</div>
      ${lista.map(([c, i]) => colunaCombo(c, i, n)).join('')}${pode ? `<button class="nova" data-nova="${r}"><i data-lucide="plus"></i>Outra combinação<small>até 3</small></button>` : ''}</div></section>`;
  }
  function combos() {
    const rs = O.roteiros(o), com = (f) => o.combos.map((c, i) => [c, i]).filter(([c]) => f(P.rotDaCombo(o, c)));
    if (rs.length === 1) return grupo(com((r) => r === 0), 0, '');
    const mistas = com((r) => r < 0);
    return rs.map((idx, r) => grupo(com((x) => x === r), r, `<h3 class="rot-cab"><span class="rot-letra">${O.letra(r)}</span>${O.cidades(o, idx).map(esc).join(' → ')}</h3>`)).join('')
      + (mistas.length ? grupo(mistas, -1, '<h3 class="rot-cab"><span class="rot-letra"><i data-lucide="shuffle"></i></span>Misturando os roteiros</h3>') : '');
  }

  // ---------- mensagem ----------
  const formatar = (txt) => esc(txt).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/_([^_\n]+)_/g, '<em>$1</em>');
  function lado() {
    const copiar = `<button class="btn" data-copiar><i data-lucide="${copiado ? 'check' : 'copy'}"></i>${copiado ? 'Copiada' : 'Copiar mensagem'}</button>`;
    const zap = o.contato.whatsapp ? `<a class="btn" href="https://wa.me/${o.contato.whatsapp.length <= 11 ? '55' : ''}${o.contato.whatsapp}?text=${encodeURIComponent(P.texto(o))}" target="_blank" rel="noopener"><i data-lucide="message-circle"></i>Abrir no WhatsApp</a>` : '';
    if (o.etapa === 'pesquisado') return `${copiar}${zap}
      <button class="btn primario" data-enviar ${o.combos.length ? '' : 'disabled'}><i data-lucide="send"></i>Marcar como enviada</button>`;
    if (o.etapa === 'enviado') return `<div class="estado">Enviada ${O.idade(o.enviadaEm)}. Esperando a resposta de ${esc(o.contato.nome.split(' ')[0])}.<br><span class="faint">Se ela pedir outra coisa, dá pra mudar aqui e copiar de novo.</span></div>${copiar}
      <a class="btn primario" href="fechamento.html?id=${o.id}"><i data-lucide="handshake"></i>Ela aceitou</a>
      <button class="btn fantasma" data-perdeu><i data-lucide="circle-x"></i>Desistiu</button>`;
    if (o.etapa === 'perdido') return `<div class="estado">Perdido: ${esc(o.motivo || '')}.</div><button class="btn" data-reabrir><i data-lucide="rotate-ccw"></i>Reabrir</button>`;
    const a = P.aceita(o);
    return `<div class="estado">${a ? `Fechado com a opção "${esc(a.nome)}".` : O.etapa(o.etapa).nome}</div><a class="btn primario" href="emissao.html?id=${o.id}"><i data-lucide="ticket"></i>${o.etapa === 'fechado' ? 'Emitir' : 'Ver emissão'}</a>`;
  }
  // o dono pode mudar o texto à mão; depois disso as combinações não mexem mais nele, até voltar pro automático
  const msgCaixa = () => editandoMsg
    ? `<textarea class="msg msg-edit" data-msg-edit aria-label="Texto da mensagem" rows="${P.texto(o).split('\n').length + 2}">${esc(P.texto(o))}</textarea>`
    : `<div class="msg" data-msg>${formatar(P.texto(o))}</div>`;
  const msgBotoes = () => `<div class="msg-acoes">${editandoMsg ? '<button class="btn" data-msg-pronto><i data-lucide="check"></i>Pronto</button>' : '<button class="btn fantasma" data-msg-editar><i data-lucide="pencil"></i>Editar o texto</button>'}
    ${o.mensagem ? '<span class="faint">Editada à mão: mudar as combinações não muda o texto.</span><button class="btn fantasma" data-msg-auto><i data-lucide="rotate-ccw"></i>Voltar pro texto automático</button>' : ''}</div>`;
  const mensagemHtml = () => `<aside class="msg-l"><h3>Mensagem <small>vai só o preço, sem milhas</small></h3>
    <div data-msg-caixa>${msgCaixa()}</div><div data-msg-botoes>${msgBotoes()}</div><div class="lado" data-lado>${lado()}</div></aside>`;
  const redesenharMsg = () => { app.querySelector('[data-msg-caixa]').innerHTML = msgCaixa(); app.querySelector('[data-msg-botoes]').innerHTML = msgBotoes(); copiado = false; app.querySelector('[data-lado]').innerHTML = lado(); KVShell.icones(); };
  // grava o texto um instante depois de parar de digitar
  let timerMsg = null;
  const salvarMsg = () => { clearTimeout(timerMsg); timerMsg = null; return KVApi.acao('prop.mensagem', { id: o.id, texto: o.mensagem || null }).catch((e) => KVShell.aviso(e.message, { erro: true })); };

  function render() {
    if (['novo', 'pesquisa'].includes(o.etapa)) {
      app.innerHTML = `<div class="vazio">Esse orçamento ainda está em pesquisa. <a href="orcamento.html?id=${o.id}" data-trocar style="color:var(--orange)">Ver a pesquisa</a></div>`;
      KVShell.icones(); return;
    }
    const st = app.scrollTop;
    app.innerHTML = `<div class="prop">${resumo()}<div class="prop-combos">${combos()}</div>${mensagemHtml()}</div>`;
    app.scrollTop = st; desenhado = semTr();
    document.title = `Proposta #${o.id} ${O.destino(o)} · K&V`;
    KVShell.icones();
    const r = app.querySelector('[data-nome]'); if (r) { r.focus(); r.select(); }
    if (sujo || salvando) estadoSalvo('Salvando…');
  }
  // digitar o valor da milha ou o preço atualiza as contas e a mensagem sem redesenhar a tela (o cursor fica onde está)
  function atualizarPreco(c, { campo = true } = {}) {
    const v = app.querySelector(`[data-venda="${c._k}"]`);
    if (v) { v.closest('.caixa').classList.toggle('livre', c.livre != null); if (campo && document.activeElement !== v) v.value = numCampo(venda(c)); }
    app.querySelector(`[data-calcl="${c._k}"]`).innerHTML = calcTxt(c);
    app.querySelector(`[data-pp="${c._k}"]`).innerHTML = ppHtml(c);
    const pi = app.querySelector(`[data-pinfo="${c._k}"]`); if (pi) pi.textContent = parcInfo(c);
    const m = app.querySelector('[data-msg]'); if (m) m.innerHTML = formatar(P.texto(o));
    copiado = false; app.querySelector('[data-lado]').innerHTML = lado(); KVShell.icones();
    marcarSujo();
  }

  // ---------- trocar voo: abre embaixo do próprio voo, sem redesenhar (a animação corre e pode ser interrompida) ----------
  const semTr = () => { const p = new URLSearchParams(location.search); p.delete('tr'); return p.toString(); };
  let desenhado = '';
  function syncTroca() {
    app.querySelectorAll('[data-tr]').forEach((el) => { const on = el.dataset.tr === trocaAberta(); el.classList.toggle('aberto', on); el.querySelector('.tr-l').setAttribute('aria-expanded', on); el.querySelector('.alts-w').inert = !on; });
  }
  // valor da milha: − e + mudam e redesenham; digitar muda as contas sem perder o cursor
  const progK = (k) => k.split('|')[1], comboDe = (k) => comboK(k.split('|')[0]);
  function milhasMudou(c, foco) { marcarSujo(); render(); const f = foco && app.querySelector(foco); if (f) f.focus(); }

  // ---------- janela: desistiu ----------
  const dlg = document.createElement('dialog'); dlg.className = 'janela'; document.body.append(dlg);
  const fechar = () => KVShell.desfazer({ janela: 1 }, sinc);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); fechar(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fechar(); });
  const cab = (t, sub) => `<header><div style="flex:1"><h2>${t}</h2><div class="sub">${sub}</div></div><button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>`;
  function sinc() {
    const j = KVShell.param('janela');
    if (j === 'perdeu' && o.etapa === 'enviado') {
      dlg.className = 'janela';
      dlg.innerHTML = cab('Ela desistiu?', 'O orçamento vai pro arquivo, mas fica guardado') + `<div class="corpo" style="display:grid;gap:8px;padding-bottom:14px">
        ${['Achou mais barato em outro lugar', 'Desistiu da viagem', 'Não respondeu mais', 'Mudou as datas'].map((m, i) => `<label class="item-op" style="grid-template-columns:auto 1fr;cursor:pointer"><input type="radio" name="motivo" value="${m}" ${i ? '' : 'checked'} style="width:18px;height:18px;accent-color:var(--orange)"><span style="font-weight:600">${m}</span></label>`).join('')}</div>
        <footer><button class="btn" data-x>Cancelar</button><button class="btn primario" data-ok-perdeu><i data-lucide="archive"></i>Marcar como perdido</button></footer>`;
      dlg.querySelector('[data-ok-perdeu]').onclick = async (e) => { e.currentTarget.disabled = true; await fazer('orc.perder', { id: o.id, motivo: dlg.querySelector('[name=motivo]:checked').value }); fechar(); render(); };
    } else { if (dlg.open) dlg.close(); return; }
    dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fechar);
    if (!dlg.open) dlg.showModal();
    KVShell.icones();
  }

  // ---------- ações ----------
  function ligarEventos() {
    KVSky.ligar(app, () => o, (e) => KVShell.aviso(e.message, { erro: true }), () => app.querySelectorAll('[data-pp]').forEach((el) => { const c = comboK(el.dataset.pp); if (c) el.innerHTML = ppHtml(c); }));
    app.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-menu]');
      if (m) { menuAberto = menuAberto === m.dataset.menu ? null : m.dataset.menu; confirmarApagar = null; render(); const p = app.querySelector('.menu-orc button'); if (p) p.focus(); return; }
      const b = e.target.closest('button');
      if (menuAberto && !e.target.closest('.menu-orc')) { menuAberto = confirmarApagar = null; render(); if (!b) return; }
      if (!b || b.disabled) return;
      if (b.dataset.troca) { const k = b.dataset.troca;
        if (trocaAberta() === k) KVShell.desfazer({ tr: 1 }, syncTroca);
        else if (trocaAberta()) { const p = new URLSearchParams(location.search); p.set('tr', k); history.replaceState(history.state, '', '?' + p); syncTroca(); }
        else { KVShell.irPara({ tr: k }); syncTroca(); } }
      else if (b.dataset.escolher) { const [ck, oid] = b.dataset.escolher.split(':'), c = comboK(ck), x = P.op(o, +oid);
        P.equivalentes(o, x.trecho).forEach((k) => { c.escolha[k] = null; }); c.escolha[x.trecho] = x.id;
        // a numeração segue a ordem da mensagem (A, B..., misturadas)
        o.combos.sort((a, b2) => P.ordemRot(o, a) - P.ordemRot(o, b2));
        marcarSujo(); KVShell.desfazer({ tr: 1 }, () => {}); render(); }
      else if (b.dataset.vm) { const c = comboDe(b.dataset.vm), p = progK(b.dataset.vm); c.milha[p] = Math.max(500, P.valorMilha(c, p) + +b.dataset.passo); if (c.milha[p] === O.valorMilhaPadrao(p)) delete c.milha[p]; milhasMudou(c, `[data-vm="${b.dataset.vm}"][data-passo="${b.dataset.passo}"]`); }
      else if (b.dataset.vmPadrao) { const c = comboDe(b.dataset.vmPadrao); delete c.milha[progK(b.dataset.vmPadrao)]; milhasMudou(c, `[data-vmi="${b.dataset.vmPadrao}"]`); }
      else if (b.dataset.calc) { const c = comboK(b.dataset.calc); c.livre = null; atualizarPreco(c); }
      else if (b.dataset.renomear) { renomeando = b.dataset.renomear; menuAberto = null; render(); }
      else if (b.dataset.dup) { const base = comboK(b.dataset.dup); o.combos.splice(o.combos.indexOf(base) + 1, 0, chavear(P.novaCombo({ nome: `${base.nome} (cópia)`.slice(0, 28), escolha: [...base.escolha], milha: { ...base.milha }, livre: base.livre, parcelado: base.parcelado, vezes: base.vezes }))); menuAberto = null; marcarSujo(); render(); }
      else if (b.dataset.pedeDel) { confirmarApagar = b.dataset.pedeDel; render(); }
      else if (b.hasAttribute('data-cancela')) { confirmarApagar = null; render(); }
      else if (b.dataset.del) { o.combos = o.combos.filter((c) => c._k !== b.dataset.del); menuAberto = confirmarApagar = null; marcarSujo(); render(); }
      else if (b.dataset.nova != null) {
        // a nova entra depois da última do mesmo roteiro (a mensagem numera nessa ordem)
        const r = +b.dataset.nova || 0, base = P.sugerir(o, 1, r)[0] || o.combos.find((x) => P.rotDaCombo(o, x) === r); if (!base) return;
        const c = chavear(P.novaCombo({ nome: `Opção ${o.combos.length + 1}`, escolha: [...base.escolha] }));
        const depois = o.combos.reduce((k, x, i) => (P.ordemRot(o, x) <= r ? i + 1 : k), 0);
        o.combos.splice(depois, 0, c); renomeando = c._k; marcarSujo(); render();
      }
      else if (b.hasAttribute('data-copiar')) { const txt = P.texto(o); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).catch(() => {}); copiado = true; app.querySelector('[data-lado]').innerHTML = lado(); KVShell.icones(); }
      else if (b.hasAttribute('data-msg-editar')) { editandoMsg = true; redesenharMsg(); const t = app.querySelector('[data-msg-edit]'); t.focus(); t.setSelectionRange(0, 0); }
      else if (b.hasAttribute('data-msg-pronto')) { editandoMsg = false; if (timerMsg) await salvarMsg(); redesenharMsg(); }
      else if (b.hasAttribute('data-msg-auto')) { o.mensagem = null; editandoMsg = false; redesenharMsg(); await salvarMsg(); }
      else if (b.hasAttribute('data-enviar')) { b.disabled = true; if (await fazer('prop.enviar', { id: o.id })) KVShell.aviso('Marcada como enviada'); render(); }
      else if (b.hasAttribute('data-perdeu')) { KVShell.irPara({ janela: 'perdeu' }); sinc(); }
      else if (b.hasAttribute('data-reabrir')) { b.disabled = true; await fazer('orc.reabrir', { id: o.id }); render(); }
    });
    app.addEventListener('change', (e) => {
      if (e.target.dataset.vezes) { const c = comboK(e.target.dataset.vezes); c.vezes = +e.target.value; atualizarPreco(c); }
    });
    app.addEventListener('input', (e) => {
      if (e.target.hasAttribute('data-msg-edit')) {
        // igual ao automático = não está editada
        o.mensagem = e.target.value === P.mensagem(o) ? null : e.target.value;
        clearTimeout(timerMsg); timerMsg = setTimeout(salvarMsg, 800);
        copiado = false; app.querySelector('[data-lado]').innerHTML = lado(); KVShell.icones(); return;
      }
      if (e.target.dataset.parc) { const c = comboK(e.target.dataset.parc); c.parcelado = O.lerReais(e.target.value); atualizarPreco(c); return; }
      if (e.target.dataset.vmi) { const k = e.target.dataset.vmi, c = comboDe(k), n = lerNum(e.target.value.replace('.', ','));
        if (!(n && n < 1)) return;
        c.milha[progK(k)] = Math.round(n * 1e6);
        const g = P.porPrograma(o, c).find((x) => x.programa === progK(k)); app.querySelector(`[data-eq="${k}"]`).textContent = fmt.brl(g.reais);
        atualizarPreco(c); return; }
      const k = e.target.dataset.venda; if (!k) return;
      // digitou o mesmo do calculado = não é preço livre
      const c = comboK(k), v = O.lerReais(e.target.value); c.livre = v == null || v === P.precoCalc(o, c) ? null : v; atualizarPreco(c, { campo: false });
    });
    app.addEventListener('focusout', (e) => {
      if (e.target.dataset.venda) { const c = comboK(e.target.dataset.venda); e.target.value = numCampo(venda(c)); }
      if (e.target.dataset.vmi) { const k = e.target.dataset.vmi; e.target.value = vm(P.valorMilha(comboDe(k), progK(k))); }
      if (e.target.dataset.parc) { const c = comboK(e.target.dataset.parc); e.target.value = numCampo(c.parcelado); }
      if (e.target.dataset.nome) { const c = comboK(e.target.dataset.nome); const n = e.target.value.trim(); if (n && n !== c.nome) { c.nome = n; marcarSujo(); } renomeando = null; setTimeout(render); }
    });
    app.addEventListener('keydown', (e) => {
      if (e.target.dataset.nome && (e.key === 'Enter' || e.key === 'Escape')) { if (e.key === 'Escape') e.target.value = comboK(e.target.dataset.nome).nome; e.target.blur(); }
      // Enter no preço vai pro preço da próxima combinação
      if (e.target.dataset.vmi && e.key === 'Enter') { e.preventDefault(); milhasMudou(comboDe(e.target.dataset.vmi), `[data-vmi="${e.target.dataset.vmi}"]`); }
      if (e.target.dataset.venda && e.key === 'Enter') { const l = [...app.querySelectorAll('[data-venda]')]; const n = l[l.indexOf(e.target) + 1]; if (n) n.focus(); else e.target.blur(); }
    });
    // Esc fecha o menu ou a troca aberta antes de fechar a janela
    addEventListener('keydown', (e) => { if (e.key !== 'Escape' || dlg.open) return;
      if (menuAberto) { e.preventDefault(); menuAberto = confirmarApagar = null; render(); }
      else if (trocaAberta()) { e.preventDefault(); KVShell.desfazer({ tr: 1 }, syncTroca); } });
  }

  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const [est] = await Promise.all([KVApi.estado(), recarregar()]);
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar(`orcamento.html?id=${id}`); return; }
      P.usarProgramas(est.programas);
      document.querySelector('.carregando').remove();
      app = KVShell.montar('orcamentos', { dono: true, janela: { o, aba: 'proposta' } });
      ligarEventos();
      // primeira vez na proposta: o sistema já sugere 2 combinações e guarda
      if (o.etapa === 'pesquisado' && !o.combos.length) { o.combos = P.sugerir(o, 2).map(chavear); if (o.combos.length) marcarSujo(); }
      render(); sinc();
      KVShell.aoVoltar(() => { if (semTr() === desenhado) syncTroca(); else render(); sinc(); });
    } catch (e) {
      const c = document.querySelector('.carregando');
      if (c) c.innerHTML = `${esc(e.message)} <a href="orcamentos.html" style="color:var(--orange)">Voltar pros orçamentos</a>`;
    }
  })();
};

/* Tela: Proposta (combinações e mensagem). Endereço: /proposta.html
   Proposta (rodada 9 dos rascunhos), lendo e gravando no banco: o dono monta de 1 a 3 combinações (uma opção de voo por trecho).
     O que importa pra ele são as milhas: o preço pro cliente sai de milhas × valor da milha + taxa. O valor da milha vem das
     configurações e pode mudar em cada combinação; o preço também pode ser digitado livre. Tudo se salva sozinho. Só o dono.
   O estilo desta tela está em telas/proposta.css. */
KVTelas['proposta'] = function () {
  const O = KVOrc, P = KVProp, { esc, fmt } = KVOrc;
  const id = Number(KVShell.param('id'));
  let o = null, app = null;
  let livreAberto = null, editandoMsg = false, menuAberto = null, confirmarApagar = null, renomeando = null, copiado = false, filtroTroca = 'todas';
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

  // ---------- topo ----------
  function topo() {
    const cidades = O.cidades(o);
    const menos = o.combos.length ? Math.min(...o.combos.map((c) => P.milhasCombo(o, c))) : 0;
    const t = teto();
    return `<a class="voltar" href="orcamentos.html"><i data-lucide="arrow-left"></i>Orçamentos</a>${O.trilha(o, 'proposta')}
      <div class="topo-orc"><span class="quem">${esc(o.contato.nome)} · #${o.id} · ${O.fmtPax(o.passageiros)}</span>
        <h1 style="--n:${cidades.join(' → ').length}">${cidades.map(esc).join(' <span class="seta">→</span> ')}</h1>
        <div class="kpis">${menos ? `<span class="kpi"><b>${fmt.pts(menos)}</b><span>milhas na mais econômica</span></span>` : ''}
          <span class="kpi"><b>${t.valor ? fmt.brl(t.valor).replace(',00', '') : '—'}</b><span>${t.valor ? 'em dinheiro' : 'sem preço em dinheiro'}</span></span>
          <span class="kpi"><b>${o.opcoes.length}</b><span>opções pesquisadas</span></span></div></div>`;
  }

  // ---------- combinações ----------
  function menuCombo(c) {
    const it = (attrs, icone, texto, cls = '') => `<button role="menuitem" class="${cls}" ${attrs}><i data-lucide="${icone}"></i>${texto}</button>`;
    if (confirmarApagar === c._k) return `<div class="menu-orc" role="menu"><p>Tirar "${esc(c.nome)}" da proposta?</p>${it(`data-del="${c._k}"`, 'trash-2', 'Sim, tirar', 'perigo')}${it('data-cancela', 'x', 'Não')}</div>`;
    return `<div class="menu-orc" role="menu">${it(`data-renomear="${c._k}"`, 'pencil', 'Renomear')}${o.combos.length < 3 ? it(`data-dup="${c._k}"`, 'copy', 'Duplicar') : ''}${o.combos.length > 1 && o.aceita !== c.id ? it(`data-pede-del="${c._k}"`, 'trash-2', 'Tirar da proposta', 'perigo') : ''}</div>`;
  }
  const vm = (v) => (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  // no cartão: só o resumo das milhas por programa e o botão que abre a janela de valores
  function resumoMilhas(c) {
    const gs = P.porPrograma(o, c);
    if (!gs.length) return '';
    return gs.map((g) => `<div class="pl-top"><span class="prog" data-p="${g.programa}">${esc(P.progNome(g.programa))}</span><b class="mil">${fmt.pts(g.milhas)}</b><small>milhas</small></div>
        <span class="pl-vm">R$ ${vm(g.valor)} por milha${g.valor !== g.padrao ? ' <span class="etiqueta">mudou</span>' : ''}</span>`).join('')
      + (editavel() ? `<button class="btn pequeno" data-milhas="${c._k}"><i data-lucide="sliders-horizontal"></i>Alterar valor das milhas</button>` : '');
  }
  // na janela: − e + de 0,0005 (ou digitado) pra cada programa, com o valor em R$ e o preço da combinação na hora
  function blocoMilhas(c) {
    return P.porPrograma(o, c).map((g) => {
      const k = `${c._k}|${g.programa}`, mudou = g.valor !== g.padrao, nome = esc(P.progNome(g.programa));
      return `<div class="prog-l"><div class="pl-top"><span class="prog" data-p="${g.programa}">${nome}</span><b class="mil">${fmt.pts(g.milhas)}</b><small>milhas</small></div>
        <div class="vm"><button class="btn icone" data-vm="${k}" data-passo="-500" aria-label="Diminuir valor da milha ${nome}"><i data-lucide="minus"></i></button>
          <label class="vm-in"><span>R$</span><input data-vmi="${k}" inputmode="decimal" autocomplete="off" value="${vm(g.valor)}" aria-label="Valor da milha ${nome}"></label>
          <button class="btn icone" data-vm="${k}" data-passo="500" aria-label="Aumentar valor da milha ${nome}"><i data-lucide="plus"></i></button></div>
        <div class="vm-pe"><span class="padrao">${mudou ? `padrão ${vm(g.padrao)} · <button class="link" data-vm-padrao="${k}">voltar pro padrão</button>` : 'padrão das configurações'}</span><b data-eq="${k}">${fmt.brl(g.reais)}</b></div></div>`;
    }).join('');
  }
  function precoHtml(c) {
    const calc = P.precoCalc(o, c);
    const linhas = `${P.taxas(o, c) ? `<div class="linha-custo"><span>Taxas</span><b>${fmt.brl(P.taxas(o, c))}</b></div>` : ''}${P.dinheiro(o, c) ? `<div class="linha-custo"><span>Trechos em dinheiro</span><b>${fmt.brl(P.dinheiro(o, c))}</b></div>` : ''}`;
    if (c.livre != null || livreAberto === c._k) return `${linhas}<div class="venda"><label for="v-${c._k}">À vista, Pix ou dinheiro (digitado)</label>
        <div class="caixa"><span>R$</span><input id="v-${c._k}" data-venda="${c._k}" inputmode="decimal" autocomplete="off" placeholder="${numCampo(calc)}" value="${numCampo(c.livre)}" ${editavel() ? '' : 'readonly'}></div>
        ${editavel() ? `<button class="link" data-calc="${c._k}">Voltar pro calculado: <span data-calcv="${c._k}">${fmt.brl(calc)}</span></button>` : ''}</div>
      <div class="resultado" data-res="${c._k}">${resultado(c)}</div>`;
    return `${linhas}<div class="preco-f"><span class="rot">À vista, Pix ou dinheiro</span><b data-pf="${c._k}">${fmt.brl(calc)}</b>
        ${editavel() ? `<button class="link" data-livre="${c._k}">Digitar outro valor</button>` : ''}</div>
      <div class="resultado" data-res="${c._k}">${resultado(c)}</div>`;
  }
  // parcelado: outro preço, digitado à mão, com o número de vezes; vai na mensagem como "em até 10x de ..."
  function parceladoHtml(c) {
    const ed = editavel();
    if (!ed && !c.parcelado) return '';
    return `<div class="parc"><label class="rot" for="p-${c._k}">Parcelado</label>
      <div class="parc-linha"><div class="caixa pq-caixa"><span>R$</span><input id="p-${c._k}" data-parc="${c._k}" inputmode="decimal" autocomplete="off" placeholder="valor total parcelado" value="${numCampo(c.parcelado)}" ${ed ? '' : 'readonly'}></div>
        <label class="sel-pilula vezes"><span class="escondido">Vezes</span><select data-vezes="${c._k}" data-combo="nao" ${ed ? '' : 'disabled'}>${Array.from({ length: 11 }, (_, i) => i + 2).map((n) => `<option value="${n}" ${n === c.vezes ? 'selected' : ''}>em ${n}x</option>`).join('')}</select></label></div>
      <span class="parc-info" data-pinfo="${c._k}">${parcInfo(c)}</span></div>`;
  }
  function parcInfo(c) {
    if (!c.parcelado) return 'Valor total no cartão. Vazio = não oferece parcelado.';
    const v = venda(c), dif = c.parcelado - v, pct = Math.round((dif / v) * 1000) / 10;
    return `${c.vezes}x de ${fmt.brl(Math.round(c.parcelado / c.vezes))} · ${dif >= 0 ? '+' : '−'} ${fmt.brl(Math.abs(dif))} do à vista (${dif >= 0 ? '+' : '−'}${String(Math.abs(pct)).replace('.', ',')}%)`;
  }
  function resultado(c) {
    const t = P.teto(o, P.rotDaCombo(o, c)).valor, calc = P.precoCalc(o, c), dif = c.livre != null ? c.livre - calc : 0;
    const avisos = [t && venda(c) > t && '<span class="etiqueta warn">acima do preço em dinheiro</span>', Math.abs(dif) >= 100 && `<span class="etiqueta">${dif > 0 ? '+' : '−'} ${fmt.brl(Math.abs(dif))} do calculado</span>`].filter(Boolean).join('');
    return `${avisos}<span class="pp">${fmt.brl(Math.round(venda(c) / Math.max(1, O.pagantes(o))))} por pessoa</span>`;
  }
  function cartaoCombo(c, i) {
    const ops = P.opsDaCombo(o, c);
    const titulo = renomeando === c._k ? `<input data-nome="${c._k}" value="${esc(c.nome)}" aria-label="Nome da combinação" maxlength="28">` : `<span>${esc(c.nome)}</span>`;
    const aceitaEsta = o.aceita != null && o.aceita === c.id;
    return `<article class="cartao-ref combina ${aceitaEsta ? 'aceita' : ''}" data-cb="${c._k}">
      ${editavel() ? `<span class="canto"><button data-menu="${c._k}" aria-haspopup="menu" aria-expanded="${menuAberto === c._k}" aria-label="Ações da combinação"><i data-lucide="menu"></i></button></span>${menuAberto === c._k ? menuCombo(c) : ''}` : ''}
      <div class="grande"><span class="nro" aria-label="Opção ${i + 1}">${i + 1}</span>${titulo}${aceitaEsta ? '<span class="etiqueta ok">aceita</span>' : ''}</div>
      ${ops.map((x) => { const tag = editavel() ? 'button' : 'div';
        return `<${tag} class="tr" ${editavel() ? `data-trocar="${c._k}" data-t="${x.trecho}" aria-label="Trocar ${P.nomeTrecho(o, x.trecho)}"` : ''}><span><small>${P.nomeTrecho(o, x.trecho)} · ${P.diaSem(x.data)} ${O.dataCurta(x.data)} · <span class="sitio" data-s="${esc(x.site)}">${esc(x.site)}</span></small><b>${hora(x)}</b><small>${detalhe(x)} · ${valorOp(x)}</small></span>${editavel() ? '<span class="troca"><i data-lucide="arrow-left-right"></i></span>' : ''}</${tag}>`; }).join('')}
      <div class="pe"><div class="milhas-res">${resumoMilhas(c)}</div><div class="preco-bloco" data-preco="${c._k}">${precoHtml(c)}</div>${parceladoHtml(c)}</div></article>`;
  }
  // com roteiros, uma coluna por roteiro, cada uma com as combinações dele (até 3 por roteiro)
  function combos() {
    const rs = O.roteiros(o), cab = `<div class="secao"><h2>O que vai pro cliente</h2><span class="n">${o.combos.length} ${o.combos.length > 1 ? 'combinações' : 'combinação'}</span>${editavel() ? '<span class="faint" data-salvo style="margin-left:auto;font-size:13px">Tudo salvo</span>' : ''}</div>`;
    const grade = (r) => {
      const meus = o.combos.map((c, i) => [c, i]).filter(([c]) => P.rotDaCombo(o, c) === r);
      const pode = editavel() && meus.length < 3 && rs[r].every((ti) => P.opsDo(o, ti).length);
      if (!meus.length && !pode) return `<div class="vazio">Falta opção de voo em algum trecho${rs.length > 1 ? ' deste roteiro' : ''}. <a href="orcamento.html?id=${o.id}" style="color:var(--orange)">Voltar pra pesquisa</a></div>`;
      return `<div class="grade-ref" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))">${meus.map(([c, i]) => cartaoCombo(c, i)).join('')}
        ${pode ? `<button class="nova-combo" data-nova="${r}"><span class="mais"><i data-lucide="plus"></i></span>Outra combinação<span class="faint" style="font-weight:600;font-size:13px">até 3</span></button>` : ''}</div>`;
    };
    if (rs.length === 1) return cab + grade(0);
    return cab + `<div class="roteiros">${rs.map((idx, r) => `<section class="roteiro-col"><h3 class="rot-cab"><span class="rot-letra">${O.letra(r)}</span>${O.cidades(o, idx).map(esc).join(' → ')}</h3>${grade(r)}</section>`).join('')}</div>`;
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
  const mensagemHtml = () => `<div class="secao"><h2>Mensagem</h2><span class="n">vai só o preço, sem milhas</span></div>
    <div class="msg-wrap"><div><div data-msg-caixa>${msgCaixa()}</div><div data-msg-botoes>${msgBotoes()}</div></div><div class="lado" data-lado>${lado()}</div></div>`;
  const redesenharMsg = () => { app.querySelector('[data-msg-caixa]').innerHTML = msgCaixa(); app.querySelector('[data-msg-botoes]').innerHTML = msgBotoes(); copiado = false; app.querySelector('[data-lado]').innerHTML = lado(); KVShell.icones(); };
  // grava o texto um instante depois de parar de digitar
  let timerMsg = null;
  const salvarMsg = () => { clearTimeout(timerMsg); timerMsg = null; return KVApi.acao('prop.mensagem', { id: o.id, texto: o.mensagem || null }).catch((e) => KVShell.aviso(e.message, { erro: true })); };

  function render() {
    if (['novo', 'pesquisa'].includes(o.etapa)) {
      app.innerHTML = `<a class="voltar" href="orcamentos.html"><i data-lucide="arrow-left"></i>Orçamentos</a>${O.trilha(o, 'proposta')}
        <div class="vazio">Esse orçamento ainda está em pesquisa. <a href="orcamento.html?id=${o.id}" style="color:var(--orange)">Ver a pesquisa</a></div>`;
      KVShell.icones(); return;
    }
    app.innerHTML = topo() + combos() + mensagemHtml();
    document.title = `Proposta #${o.id} ${O.destino(o)} · K&V`;
    KVShell.icones();
    const r = app.querySelector('[data-nome]'); if (r) { r.focus(); r.select(); }
    if (sujo || salvando) estadoSalvo('Salvando…');
  }
  // digitar o valor da milha ou o preço atualiza as contas e a mensagem sem redesenhar a tela (o cursor fica onde está)
  function atualizarPreco(c) {
    const pf = app.querySelector(`[data-pf="${c._k}"]`); if (pf) pf.textContent = fmt.brl(P.precoCalc(o, c));
    const cv = app.querySelector(`[data-calcv="${c._k}"]`); if (cv) cv.textContent = fmt.brl(P.precoCalc(o, c));
    app.querySelector(`[data-res="${c._k}"]`).innerHTML = resultado(c);
    const pi = app.querySelector(`[data-pinfo="${c._k}"]`); if (pi) pi.textContent = parcInfo(c);
    const m = app.querySelector('[data-msg]'); if (m) m.innerHTML = formatar(P.texto(o));
    copiado = false; app.querySelector('[data-lado]').innerHTML = lado(); KVShell.icones();
    marcarSujo();
  }

  // ---------- janelas: trocar voo, valor das milhas, desistiu ----------
  const dlg = document.createElement('dialog'); dlg.className = 'janela'; document.body.append(dlg);
  const fechar = () => KVShell.desfazer({ janela: 1, c: 1, t: 1 }, sinc);
  const progK = (k) => k.split('|')[1], comboDe = (k) => comboK(k.split('|')[0]);
  function milhasMudou(c, foco) {
    marcarSujo(); render();
    if (KVShell.param('janela') === 'milhas') { janelaMilhas(c); dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fechar); KVShell.icones(); const f = foco && dlg.querySelector(foco); if (f) f.focus(); }
  }
  dlg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.vm) { const c = comboDe(b.dataset.vm), p = progK(b.dataset.vm); c.milha[p] = Math.max(500, P.valorMilha(c, p) + +b.dataset.passo); if (c.milha[p] === O.valorMilhaPadrao(p)) delete c.milha[p]; milhasMudou(c, `[data-vm="${b.dataset.vm}"][data-passo="${b.dataset.passo}"]`); }
    else if (b.dataset.vmPadrao) { const c = comboDe(b.dataset.vmPadrao); delete c.milha[progK(b.dataset.vmPadrao)]; milhasMudou(c, `[data-vmi="${b.dataset.vmPadrao}"]`); }
  });
  dlg.addEventListener('input', (e) => {
    const k = e.target.dataset.vmi; if (!k) return;
    const c = comboDe(k), n = lerNum(e.target.value.replace('.', ','));
    if (!(n && n < 1)) return;
    c.milha[progK(k)] = Math.round(n * 1e6);
    const g = P.porPrograma(o, c).find((x) => x.programa === progK(k));
    dlg.querySelector(`[data-eq="${k}"]`).textContent = fmt.brl(g.reais);
    dlg.querySelector('[data-pj]').textContent = fmt.brl(P.precoCalc(o, c));
    atualizarPreco(c);
  });
  dlg.addEventListener('focusout', (e) => { const k = e.target.dataset.vmi; if (k) e.target.value = vm(P.valorMilha(comboDe(k), progK(k))); });
  dlg.addEventListener('keydown', (e) => { if (e.target.dataset.vmi && e.key === 'Enter') { e.preventDefault(); milhasMudou(comboDe(e.target.dataset.vmi)); } });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); fechar(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fechar(); });
  const cab = (t, sub) => `<header><div style="flex:1"><h2>${t}</h2><div class="sub">${sub}</div></div><button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>`;
  const FILTROS_TROCA = [['todas', 'Todas'], ['direto', 'Diretas'], ['mala', 'Com mala'], ['pontos', 'Em pontos'], ['dinheiro', 'Em dinheiro']];
  const passaFiltro = (x) => ({ todas: true, direto: x.escalas === 0, mala: x.bagagem, pontos: O.site(x.site).forma === 'pontos', dinheiro: O.site(x.site).forma === 'dinheiro' })[filtroTroca];
  function painelTroca(c, ti) {
    const atual = P.op(o, c.escolha[ti]), base = O.custo(atual, o);
    const l = P.opsDo(o, ti).filter(passaFiltro).sort((a, b) => O.custoPessoa(a) - O.custoPessoa(b));
    const t = o.trechos[ti];
    dlg.className = 'janela lateral';
    dlg.innerHTML = cab(`Trocar a ${P.nomeTrecho(o, ti).toLowerCase()}`, `${esc(c.nome)} · ${t.de} → ${t.para} · ${P.opsDo(o, ti).length} opções`) + `<div class="corpo">
      <div class="filtro-op">${FILTROS_TROCA.map(([k, n]) => `<button class="pilula" data-ft="${k}" aria-pressed="${filtroTroca === k}">${n}</button>`).join('')}</div>
      <div class="lista-op">${l.length ? l.map((x) => { const d = O.custo(x, o) - base;
        return `<button class="item-op" data-escolher="${x.id}" aria-pressed="${x.id === atual.id}"><b>${hora(x)}</b>
          <small>${P.diaSem(x.data)} ${O.dataCurta(x.data)} · <span class="sitio" data-s="${esc(x.site)}">${esc(x.site)}</span> · ${detalhe(x)}</small>
          <span class="dif">${x.id === atual.id ? '<strong>escolhida</strong>' : `<strong class="${d < 0 ? 'menos' : ''}">${d < 0 ? '−' : '+'} ${fmt.brl(Math.abs(d))}</strong>`}<span>${valorOp(x)}</span></span></button>`; }).join('') : '<div class="faint" style="padding:12px 2px">Nenhuma opção com esse filtro.</div>'}</div></div>`;
    dlg.querySelectorAll('[data-ft]').forEach((b) => b.onclick = () => { filtroTroca = b.dataset.ft; painelTroca(c, ti); KVShell.icones(); });
    dlg.querySelectorAll('[data-escolher]').forEach((b) => b.onclick = () => { c.escolha[ti] = +b.dataset.escolher; marcarSujo(); fechar(); render(); });
  }
  function janelaMilhas(c) {
    dlg.className = 'janela';
    dlg.innerHTML = cab('Valor das milhas', `${esc(c.nome)} · só nesta combinação`) + `<div class="corpo"><div class="milhas-j">${blocoMilhas(c)}</div>
        <div class="preco-j"><span>Preço pro cliente</span><b data-pj>${fmt.brl(P.precoCalc(o, c))}</b>${c.livre != null ? '<small>Você digitou um preço livre nesta combinação; ele continua valendo.</small>' : ''}</div></div>
      <footer><span></span><button class="btn primario" data-x><i data-lucide="check"></i>Pronto</button></footer>`;
  }
  function sinc() {
    const j = KVShell.param('janela');
    if (j === 'milhas' && editavel()) { const c = comboK(KVShell.param('c')); if (!c) return; janelaMilhas(c); }
    else if (j === 'trocar' && editavel()) { const c = comboK(KVShell.param('c')); if (!c) return; painelTroca(c, +KVShell.param('t')); }
    else if (j === 'perdeu' && o.etapa === 'enviado') {
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
    app.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-menu]');
      if (m) { menuAberto = menuAberto === m.dataset.menu ? null : m.dataset.menu; confirmarApagar = null; render(); const p = app.querySelector('.menu-orc button'); if (p) p.focus(); return; }
      const b = e.target.closest('button');
      if (menuAberto && !e.target.closest('.menu-orc')) { menuAberto = confirmarApagar = null; render(); if (!b) return; }
      if (!b || b.disabled) return;
      if (b.dataset.milhas) { KVShell.irPara({ janela: 'milhas', c: b.dataset.milhas }); sinc(); }
      else if (b.dataset.livre) { livreAberto = b.dataset.livre; render(); app.querySelector(`[data-venda="${b.dataset.livre}"]`).focus(); }
      else if (b.dataset.calc) { const c = comboK(b.dataset.calc); c.livre = null; livreAberto = null; marcarSujo(); render(); }
      else if (b.dataset.renomear) { renomeando = b.dataset.renomear; menuAberto = null; render(); }
      else if (b.dataset.dup) { const base = comboK(b.dataset.dup); o.combos.splice(o.combos.indexOf(base) + 1, 0, chavear(P.novaCombo({ nome: `${base.nome} (cópia)`.slice(0, 28), escolha: [...base.escolha], milha: { ...base.milha }, livre: base.livre, parcelado: base.parcelado, vezes: base.vezes }))); menuAberto = null; marcarSujo(); render(); }
      else if (b.dataset.pedeDel) { confirmarApagar = b.dataset.pedeDel; render(); }
      else if (b.hasAttribute('data-cancela')) { confirmarApagar = null; render(); }
      else if (b.dataset.del) { o.combos = o.combos.filter((c) => c._k !== b.dataset.del); menuAberto = confirmarApagar = null; marcarSujo(); render(); }
      else if (b.dataset.nova != null) {
        // a nova entra depois da última do mesmo roteiro (a mensagem numera nessa ordem)
        const r = +b.dataset.nova || 0, base = P.sugerir(o, 1, r)[0] || o.combos.find((x) => P.rotDaCombo(o, x) === r); if (!base) return;
        const c = chavear(P.novaCombo({ nome: `Opção ${o.combos.length + 1}`, escolha: [...base.escolha] }));
        const depois = o.combos.reduce((k, x, i) => (P.rotDaCombo(o, x) <= r ? i + 1 : k), 0);
        o.combos.splice(depois, 0, c); renomeando = c._k; marcarSujo(); render();
      }
      else if (b.dataset.trocar) { filtroTroca = 'todas'; KVShell.irPara({ janela: 'trocar', c: b.dataset.trocar, t: b.dataset.t }); sinc(); }
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
      const k = e.target.dataset.venda; if (!k) return;
      const c = comboK(k); c.livre = O.lerReais(e.target.value); atualizarPreco(c);
    });
    app.addEventListener('focusout', (e) => {
      if (e.target.dataset.venda) { const c = comboK(e.target.dataset.venda); if (c.livre == null && livreAberto === c._k) { livreAberto = null; setTimeout(render); } else e.target.value = numCampo(c.livre); }
      if (e.target.dataset.parc) { const c = comboK(e.target.dataset.parc); e.target.value = numCampo(c.parcelado); }
      if (e.target.dataset.nome) { const c = comboK(e.target.dataset.nome); const n = e.target.value.trim(); if (n && n !== c.nome) { c.nome = n; marcarSujo(); } renomeando = null; setTimeout(render); }
    });
    app.addEventListener('keydown', (e) => {
      if (e.target.dataset.nome && (e.key === 'Enter' || e.key === 'Escape')) { if (e.key === 'Escape') e.target.value = comboK(e.target.dataset.nome).nome; e.target.blur(); }
      // Enter no preço vai pro preço da próxima combinação
      if (e.target.dataset.venda && e.key === 'Enter') { const l = [...app.querySelectorAll('[data-venda]')]; const n = l[l.indexOf(e.target) + 1]; if (n) n.focus(); else e.target.blur(); }
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuAberto && !dlg.open) { menuAberto = confirmarApagar = null; render(); } });
  }

  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const [est] = await Promise.all([KVApi.estado(), recarregar()]);
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar(`orcamento.html?id=${id}`); return; }
      P.usarProgramas(est.programas);
      document.querySelector('.carregando').remove();
      app = KVShell.montar('orcamentos', { dono: true });
      ligarEventos();
      // primeira vez na proposta: o sistema já sugere 2 combinações e guarda
      if (o.etapa === 'pesquisado' && !o.combos.length) { o.combos = P.sugerir(o, 2).map(chavear); if (o.combos.length) marcarSujo(); }
      render(); sinc();
      KVShell.aoVoltar(() => { render(); sinc(); });
    } catch (e) {
      const c = document.querySelector('.carregando');
      if (c) c.innerHTML = `${esc(e.message)} <a href="orcamentos.html" style="color:var(--orange)">Voltar pros orçamentos</a>`;
    }
  })();
};

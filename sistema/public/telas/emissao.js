/* Tela: Emissão (um registro por voo). Endereço: /emissao.html
   Emissão (rodada 9 dos rascunhos), lendo e gravando no banco: um cartão por voo da combinação aceita. Em pontos, o dono escolhe
     de qual conta sai (o sistema sugere a que tem saldo, não estoura o limite de beneficiários e usa pontos que vencem antes) e digita
     o localizador. Registrar gera sozinho a saída na conta. Com todos os voos emitidos, o orçamento vai pra Emitido. Só o dono.
   O estilo desta tela está em telas/emissao.css. */
KVTelas['emissao'] = function () {
  const O = KVOrc, P = KVProp, { esc, fmt } = KVOrc;
  const id = Number(KVShell.param('id'));
  let o = null, app = null, contas = [], escolhas = {}, buscaConta = '', menuAberto = null, confirmar = null;
  const tira = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const hora = (x) => `${x.sai} → ${x.chega.replace(/ \+\d$/, '')}${/\+\d$/.test(x.chega) ? `<sup>${x.chega.slice(-2)}</sup>` : ''}`;
  const iniciais = (n) => n.split(' ').filter((x) => x.length > 2).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  const hoje = O.isoDia(new Date());
  const diasAte = (s) => Math.round((new Date(s + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 864e5);
  const opDo = (ti) => P.op(o, P.aceita(o).escolha[ti]);
  const emPontos = (ti) => O.site(opDo(ti).site).forma === 'pontos';
  const emissao = (ti) => o.emissoes.find((e) => e.trecho === ti);
  const escolha = (ti) => (escolhas[ti] = escolhas[ti] || { contaId: null, localizador: '', obs: '', sugerida: false, cartao: undefined, pago: null });
  // o que vai pro cartão da K&V: a taxa (em pontos) ou a passagem inteira (em dinheiro), pra todos os pagantes
  const valorCartao = (ti) => { const x = opDo(ti), pag = O.pagantes(o); return (emPontos(ti) ? x.taxa || 0 : x.preco || 0) * pag; };
  const reais = (c) => (c ? (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
  const nomeCartao = (id) => { const c = KV.cartao(id); return c ? `${c.nome}${c.final ? ` · ${c.final}` : ''}` : 'outro cartão'; };
  const contaDe = (cid) => contas.find((c) => c.id === cid);

  // pra cada conta do programa: saldo depois, CPFs novos (ocupam vaga) e se estoura o limite. Avisa, não bloqueia.
  function contasPara(ti) {
    const x = opDo(ti), prog = O.site(x.site).programa;
    if (!prog) return [];
    const precisa = x.milhas * O.pagantes(o), pax = o.passageirosLista;
    return contas.filter((c) => c.programa_id === prog && c.ativa).map((c) => {
      // outros voos deste orçamento já marcados pra mesma conta e ainda não emitidos também contam
      const reservado = P.trechosVoo(o).reduce((s, k) => s + (k !== ti && !emissao(k) && escolha(k).contaId === c.id ? opDo(k).milhas * O.pagantes(o) : 0), 0);
      const b = c.beneficiarios, ja = new Set(b ? b.lista.map((y) => y.pessoa_id) : []);
      const novos = pax.filter((p) => !ja.has(p.id) && p.id !== c.titular_id);
      const sobra = c.saldo - reservado - precisa;
      return { conta: c, precisa, sobra, novos, vagas: b, estoura: b ? novos.length > b.livres : false, falta: sobra < 0, vencendo: c.vencendo.pontos ? c.vencendo : null };
    }).sort((a, b) => (a.falta - b.falta) || (a.estoura - b.estoura) || (a.novos.length - b.novos.length)
      || ((b.vencendo ? 1 : 0) - (a.vencendo ? 1 : 0)) || (a.sobra - b.sobra));
  }
  // sugestão: a primeira da lista ordenada (tem saldo, não estoura vaga, menos CPFs novos, pontos vencendo primeiro)
  function sugerirContas() {
    P.trechosVoo(o).forEach((ti) => { if (emPontos(ti) && !emissao(ti) && !escolha(ti).contaId) { const s = contasPara(ti)[0]; if (s) { escolha(ti).contaId = s.conta.id; escolha(ti).sugerida = true; } } });
  }

  // ---------- topo ----------
  function topo() {
    const cidades = O.cidades(o, P.trechosVoo(o));
    const feitos = o.emissoes.length, nVoos = P.trechosVoo(o).length;
    const s = P.situacao(o);
    const pax = o.passageirosLista;
    const falta = O.total(o) - pax.length;
    return `<a class="voltar" href="orcamentos.html"><i data-lucide="arrow-left"></i>Orçamentos</a>${O.trilha(o, 'emissao')}
      ${KVShell.param('fechou') && o.etapa === 'fechado' ? `<div class="aviso ok aviso-acoes" style="margin-bottom:14px"><span>Orçamento fechado. Agora é emitir cada voo.</span>${o.emissoes.length ? '' : '<span class="acoes"><button class="btn pequeno" data-reabrir><i data-lucide="undo-2"></i>Desfazer fechamento</button></span>'}</div>` : ''}
      <div class="topo-orc"><span class="quem">${esc(o.contato.nome)} · #${o.id} · ${esc(P.aceita(o).nome)}</span>
        <h1 style="--n:${cidades.join(' → ').length}">${cidades.map(esc).join(' <span class="seta">→</span> ')}</h1>
        <div class="kpis"><span class="kpi ${feitos < nVoos ? 'destaque' : ''}"><b>${feitos}/${nVoos}</b><span>voos emitidos</span></span>
          <span class="kpi"><b>${fmt.brl(P.valorFinal(o) || 0).replace(',00', '')}</b><span>venda${o.receb.forma === 'parcelado' && P.aceita(o).parcelado ? ' parcelada' : ''}</span></span>
          ${s ? `<span class="kpi"><b>${s.falta ? fmt.brl(s.falta).replace(',00', '') : '<i data-lucide="check" style="width:30px;height:30px;stroke-width:3;color:var(--ok)"></i>'}</b><span>${s.falta ? 'a receber' : 'recebido'}</span></span>` : ''}</div>
        <div class="pax">${pax.map((p) => `<span class="etiqueta"><span class="ava">${esc(iniciais(p.nome))}</span>${esc(p.nome.split(' ').slice(0, 2).join(' '))}</span>`).join('')}
          ${falta > 0 ? `<a class="etiqueta warn" href="fechamento.html?id=${o.id}" style="text-decoration:none">Faltam ${falta} passageiro${falta > 1 ? 's' : ''} →</a>` : ''}</div></div>`;
  }

  // ---------- um cartão por voo ----------
  function chipsConta(info) {
    const l = [];
    if (info.falta) l.push(`<span class="etiqueta danger">faltam ${fmt.pts(-info.sobra)} pts</span>`);
    if (info.vagas) {
      if (!info.novos.length) l.push('<span class="etiqueta ok"><i data-lucide="check"></i>todos já são beneficiários</span>');
      else if (info.estoura) l.push(`<span class="etiqueta warn">${info.novos.length} CPF${info.novos.length > 1 ? 's' : ''} novo${info.novos.length > 1 ? 's' : ''}, só ${info.vagas.livres} vaga${info.vagas.livres === 1 ? '' : 's'}</span>`);
      else l.push(`<span class="etiqueta">${info.novos.length} CPF${info.novos.length > 1 ? 's' : ''} novo${info.novos.length > 1 ? 's' : ''} · ${info.vagas.livres} vagas</span>`);
    }
    if (info.vencendo) l.push(`<span class="etiqueta teal">${fmt.pts(info.vencendo.pontos)} vencem em ${diasAte(info.vencendo.primeiro)} dias</span>`);
    return l.join('');
  }
  function cartaoVoo(ti) {
    const x = opDo(ti), t = o.trechos[ti], e = emissao(ti), es = escolha(ti), pts = emPontos(ti), pag = O.pagantes(o);
    const cab = `<div class="cab"><span class="pq">${P.nomeTrecho(o, ti)} · ${P.diaSem(x.data)} ${O.dataCurta(x.data)} · ${t.de} → ${t.para} · <span class="sitio" data-s="${esc(x.site)}">${esc(x.site)}</span></span>
      <span class="hora">${hora(x)}</span><span class="pq">${[x.voo, x.escalas ? `${x.escalas} escala${x.escalas > 1 ? 's' : ''}` : 'direto', x.bagagem && 'com mala'].filter(Boolean).map(esc).join(' · ')}</span></div>`;
    const gasto = pts ? `<div class="gasto"><b>${fmt.pts(x.milhas * pag)} pts</b><span>+ ${fmt.brl(x.taxa * pag)} de taxa · ${pag} ${pag > 1 ? 'pagantes' : 'pagante'}</span></div>`
      : `<div class="gasto"><b>${fmt.brl(x.preco * pag)}</b><span>em dinheiro · ${pag} ${pag > 1 ? 'pagantes' : 'pagante'}</span></div>`;
    if (e) {
      const c = e.conta_id && contaDe(e.conta_id);
      const canto = `<span class="canto"><button data-menu="${e.id}" aria-haspopup="menu" aria-expanded="${menuAberto === e.id}" aria-label="Corrigir ou desfazer esta emissão"><i data-lucide="menu"></i></button></span>${menuAberto === e.id ? menuEmissao(e, c) : ''}`;
      const situ = e.cancelada ? `<span class="etiqueta danger"><i data-lucide="x"></i>Cancelada</span>` : '<span class="etiqueta ok"><i data-lucide="check"></i>Emitido</span>';
      return `<article class="cartao-ref voo feito ${e.cancelada ? 'cancelada' : ''}">${canto}${cab}${gasto}
        <div class="feito-linha">${situ}<span class="locz">${esc(e.localizador)}</span>
          ${e.cartao_id ? `<span class="pq" style="flex-basis:100%">${e.conta_id ? 'Taxa' : 'Passagem'} no cartão ${esc(nomeCartao(e.cartao_id))}: ${fmt.brl(e.pago)}</span>` : ''}
          <span class="pq" style="flex-basis:100%">${e.conta_id ? `Saiu da conta de ${esc(c ? c.titular : 'outra pessoa')}${c ? ` (${esc(c.programa)})` : ''}` : 'Comprado em dinheiro'}</span>
          ${e.cancelada ? `<span class="pq" style="flex-basis:100%">${e.devolvido ? `Devolvido ao cliente: ${fmt.brl(e.devolvido)}` : 'Nada devolvido ao cliente'}${e.cancelada_obs ? ` · ${esc(e.cancelada_obs)}` : ''}</span>` : ''}
          ${e.obs ? `<span class="obs-voo">${esc(e.obs)}</span>` : ''}</div></article>`;
    }
    if (o.etapa !== 'fechado') return `<article class="cartao-ref voo">${cab}${gasto}<div class="feito-linha"><span class="etiqueta">${O.etapa(o.etapa).nome}</span></div></article>`;
    let conta = '';
    if (pts) {
      const info = contasPara(ti).find((i) => i.conta.id === es.contaId);
      conta = info ? `<button class="conta-bt" data-conta="${ti}"><span class="rot">Sai da conta${es.sugerida ? ' · sugerida' : ''}</span><b>${esc(info.conta.titular)} · <span class="prog" data-p="${info.conta.programa_id}">${esc(info.conta.programa)}</span></b>
          <span class="saldo">${fmt.pts(info.conta.saldo)} → sobram ${fmt.pts(Math.max(0, info.sobra))} pts</span><i data-lucide="chevron-right" class="ir"></i></button><div class="chips">${chipsConta(info)}</div>`
        : `<button class="conta-bt" data-conta="${ti}"><span class="rot">Sai da conta</span><b>${contasPara(ti).length ? 'Escolher a conta' : `Nenhuma conta ${esc(P.progNome(O.site(x.site).programa))} cadastrada`}</b><i data-lucide="chevron-right" class="ir"></i></button>`;
    }
    const pagoCom = KV.cartoes().length ? `<div class="pago-com"><div class="campo"><label for="cartao-${ti}">${pts ? 'Taxa paga com' : 'Passagem paga com'}</label><select id="cartao-${ti}" data-cartao="${ti}" data-combo="nao">${KV.opcoesCartao(es.cartao)}</select></div>
      <div class="campo"><label for="pago-${ti}">Valor no cartão</label><div class="caixa"><span>R$</span><input id="pago-${ti}" data-pago="${ti}" inputmode="decimal" autocomplete="off" value="${reais(es.pago ?? valorCartao(ti))}"></div></div></div>` : '';
    return `<article class="cartao-ref voo">${cab}${gasto}${conta}${pagoCom}
      <div class="campo"><label for="obs-${ti}">Observação (opcional)</label><input id="obs-${ti}" data-obs="${ti}" maxlength="2000" autocomplete="off" placeholder="ex.: assento marcado, pago com o cartão X" value="${esc(es.obs)}"></div>
      <div class="loc"><div class="campo"><label for="loc-${ti}">Localizador</label><input id="loc-${ti}" data-loc="${ti}" maxlength="8" autocomplete="off" spellcheck="false" placeholder="ABC123" value="${esc(es.localizador)}"></div>
        <button class="btn primario" data-emitir="${ti}"><i data-lucide="ticket-check"></i>Registrar</button></div></article>`;
  }
  // ---------- menu do voo emitido: corrigir, lancei errado, passagem cancelada ----------
  function menuEmissao(e, c) {
    const it = (attrs, icone, texto, cls = '') => `<button role="menuitem" class="${cls}" ${attrs}><i data-lucide="${icone}"></i>${texto}</button>`;
    if (confirmar === e.id) return `<div class="menu-orc confirma" role="menu"><p>Desfazer esta emissão?<br><span>${e.pontos ? `Os ${fmt.pts(e.pontos)} pts voltam pra conta${c ? ` de ${esc(c.titular)}` : ''} e` : 'O registro some e'} o voo fica pra emitir de novo.</span></p>
      ${it(`data-desfazer="${e.id}"`, 'undo-2', 'Sim, desfazer', 'perigo')}${it('data-nao', 'x', 'Não')}</div>`;
    return `<div class="menu-orc" role="menu">${it(`data-corrigir="${e.id}"`, 'pencil', 'Corrigir localizador ou observação')}
      ${e.cancelada ? '' : `${it(`data-pede-desfazer="${e.id}"`, 'undo-2', 'Lancei errado: desfazer')}${it(`data-cancelar="${e.id}"`, 'ban', 'A passagem foi cancelada', 'perigo')}`}</div>`;
  }

  function fim() {
    if (o.etapa !== 'emitido' && o.etapa !== 'cancelado') return '';
    if (o.etapa === 'cancelado') return `<div class="fim cancelado"><i data-lucide="ban" style="color:var(--danger);width:24px;height:24px"></i><span><b>Viagem cancelada.</b><br><span class="muted" style="font-size:13.5px">Todas as passagens foram canceladas.</span></span></div>`;
    return `<div class="fim"><i data-lucide="circle-check-big" style="color:var(--ok);width:24px;height:24px"></i><span><b>Tudo emitido.</b><br><span class="muted" style="font-size:13.5px">As saídas de pontos já estão nas contas.</span></span>
      <span class="acoes"><button class="btn" disabled title="Vem depois, a partir do modelo atual" style="opacity:.55"><i data-lucide="file-text"></i>Recibo (em breve)</button></span></div>`;
  }
  function render() {
    const y = scrollY;
    if (!P.aceita(o) || !['fechado', 'emitido', 'cancelado'].includes(o.etapa)) {
      app.innerHTML = `<a class="voltar" href="orcamentos.html"><i data-lucide="arrow-left"></i>Orçamentos</a>${O.trilha(o, 'emissao')}<div class="vazio">Feche o orçamento antes de emitir. <a href="fechamento.html?id=${o.id}" style="color:var(--orange)">Ir pro fechamento</a></div>`;
      KVShell.icones(); return;
    }
    app.innerHTML = topo() + `<div class="secao"><h2>Voos</h2><span class="n">um registro por voo</span></div><div class="grade-ref" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))">${P.trechosVoo(o).map((i) => cartaoVoo(i)).join('')}</div>` + fim();
    document.title = `Emissão #${o.id} ${O.destino(o)} · K&V`;
    KVShell.icones();
    scrollTo(0, y);
  }

  // ---------- janela: escolher a conta ----------
  const dlg = document.createElement('dialog'); dlg.className = 'janela lateral'; document.body.append(dlg);
  const fechar = () => KVShell.desfazer({ janela: 1, t: 1, e: 1 }, sinc);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); fechar(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fechar(); });
  function listaContas(ti) {
    const todas = contasPara(ti), sug = todas[0];
    const l = todas.filter((i) => !buscaConta || tira(i.conta.titular).includes(tira(buscaConta)));
    if (!todas.length) return '<div class="faint" style="padding:12px 2px">Nenhuma conta desse programa cadastrada ainda.</div>';
    return l.length ? l.map((i) => `<button class="item-c" data-escolher="${i.conta.id}" aria-pressed="${escolha(ti).contaId === i.conta.id}">
      <span class="l1"><b>${esc(i.conta.titular)}</b>${i === sug ? '<span class="sug">sugerida</span>' : ''}</span>
      <span class="saldo">${fmt.pts(i.conta.saldo)} pts${i.falta ? '' : ` → sobram ${fmt.pts(i.sobra)}`}</span><span class="chips">${chipsConta(i)}</span></button>`).join('') : '<div class="faint" style="padding:12px 2px">Nenhuma conta com esse nome.</div>';
  }
  // corrigir a emissão, ou registrar que a passagem foi cancelada
  function janelaEmissao(tipo, eid) {
    const e = o.emissoes.find((x) => x.id === eid);
    if (!e) { fechar(); return; }
    const t = o.trechos[e.trecho], c = e.conta_id && contaDe(e.conta_id);
    const titulo = tipo === 'corrigir' ? 'Corrigir a emissão' : 'A passagem foi cancelada';
    const sub = `${P.nomeTrecho(o, e.trecho)} · ${t.de} → ${t.para} · ${esc(e.localizador)}${c ? ` · conta de ${esc(c.titular)}` : ''}`;
    const corpo = tipo === 'corrigir'
      ? `<div class="campo"><label for="j-loc">Localizador</label><input id="j-loc" class="loc-grande" maxlength="8" autocomplete="off" spellcheck="false" value="${esc(e.localizador)}"></div>
         ${KV.cartoes().length ? `<div class="pago-com"><div class="campo"><label for="j-cartao">Pago com</label><select id="j-cartao" data-combo="nao">${KV.opcoesCartao(e.cartao_id || null)}</select></div>
         <div class="campo"><label for="j-pago">Valor no cartão</label><div class="caixa"><span>R$</span><input id="j-pago" inputmode="decimal" autocomplete="off" value="${reais(e.pago || valorCartao(e.trecho))}"></div></div></div>` : ''}
         <div class="campo"><label for="j-obs">Observação</label><textarea id="j-obs" rows="3" maxlength="2000" placeholder="Opcional">${esc(e.obs || '')}</textarea></div>
         <p class="faint" style="font-size:13px;margin:0">Pra trocar a conta ou os pontos, use "Lancei errado: desfazer" e emita de novo.</p>`
      : `${e.pontos ? `<div class="campo"><label for="j-pts">Pontos que o programa devolveu</label><input id="j-pts" inputmode="numeric" autocomplete="off" value="${fmt.pts(e.pontos)}">
           <span class="ajuda">Saíram ${fmt.pts(e.pontos)} pts. Se o programa cobrou taxa em pontos, ponha só o que voltou (0 se nada voltou). Entra na conta como estorno.</span></div>` : ''}
         <div class="campo"><label for="j-dev">Quanto a K&V devolveu ao cliente</label><div class="caixa"><span>R$</span><input id="j-dev" inputmode="decimal" autocomplete="off" placeholder="0"></div></div>
         ${e.pontos ? `<label class="check"><input type="checkbox" id="j-cpf" checked><span>Os passageiros continuam ocupando vaga de beneficiário nessa conta<small>Na maioria dos programas, o CPF usado não volta com o cancelamento.</small></span></label>` : ''}
         <div class="campo"><label for="j-obs">Observação</label><textarea id="j-obs" rows="3" maxlength="2000" placeholder="ex.: cliente desistiu, multa de R$ 300"></textarea></div>`;
    dlg.innerHTML = `<header><div style="flex:1"><h2>${titulo}</h2><div class="sub">${sub}</div></div><button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>
      <form class="form-j" novalidate><div class="corpo">${corpo}</div>
        <footer><button type="button" class="btn" data-x>Voltar</button><button class="btn primario${tipo === 'cancelar' ? ' perigo' : ''}" type="submit"><i data-lucide="${tipo === 'corrigir' ? 'check' : 'ban'}"></i>${tipo === 'corrigir' ? 'Salvar correção' : 'Registrar cancelamento'}</button></footer></form>`;
    dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fechar);
    const loc = dlg.querySelector('#j-loc');
    if (loc) loc.oninput = () => { loc.value = loc.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    dlg.querySelector('form').onsubmit = async (ev) => {
      ev.preventDefault();
      const obs = dlg.querySelector('#j-obs').value;
      try {
        if (tipo === 'corrigir') {
          if (loc.value.length < 5) { loc.focus(); KVShell.aviso('O localizador tem de 5 a 8 letras e números', { erro: true }); return; }
          const jc = dlg.querySelector('#j-cartao'), cartao = jc && jc.value ? +jc.value : null;
          await KVApi.acao('emi.corrigir', { id: e.id, localizador: loc.value, obs, ...(jc ? { cartao, pago: cartao ? O.lerReais(dlg.querySelector('#j-pago').value) || 0 : 0 } : {}) });
          fechar(); await carregar(); render(); KVShell.aviso('Emissão corrigida');
        } else {
          const ptsEl = dlg.querySelector('#j-pts'), cpf = dlg.querySelector('#j-cpf');
          const estorno = ptsEl ? Number(ptsEl.value.replace(/\D/g, '') || 0) : 0;
          const r = await KVApi.acao('emi.cancelar', { id: e.id, estorno, devolvido: O.lerReais(dlg.querySelector('#j-dev').value) || 0, manterCpf: cpf ? cpf.checked : false, obs });
          fechar(); await carregar(); render();
          KVShell.aviso(r.tudoCancelado ? 'Cancelamento registrado. A viagem foi pra Cancelado.' : 'Cancelamento registrado');
        }
      } catch (err) { KVShell.aviso(err.message, { erro: true }); }
    };
    if (!dlg.open) dlg.showModal();
    KVShell.icones();
    (loc || dlg.querySelector('input, textarea')).focus();
  }

  function sinc() {
    const j = KVShell.param('janela');
    if (j === 'corrigir' || j === 'cancelar') return janelaEmissao(j, +KVShell.param('e'));
    if (j !== 'conta' || o.etapa !== 'fechado') { if (dlg.open) dlg.close(); return; }
    const ti = +KVShell.param('t'), x = opDo(ti);
    dlg.innerHTML = `<header><div style="flex:1"><h2>De qual conta sai?</h2><div class="sub">${esc(P.progNome(O.site(x.site).programa))} · precisa de ${fmt.pts(x.milhas * O.pagantes(o))} pts · ${o.passageirosLista.length} de ${O.total(o)} passageiros cadastrados</div></div><button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>
      <div class="corpo"><div class="busca-wrap busca-c"><i data-lucide="search"></i><input class="busca" style="width:100%" type="search" placeholder="Titular" aria-label="Buscar titular" value="${esc(buscaConta)}"></div><div class="lista-c" data-lista>${listaContas(ti)}</div></div>`;
    const ligar = () => dlg.querySelectorAll('[data-escolher]').forEach((b) => b.onclick = () => { escolha(ti).contaId = +b.dataset.escolher; escolha(ti).sugerida = false; fechar(); render(); });
    dlg.querySelector('.busca').oninput = (e) => { buscaConta = e.target.value; dlg.querySelector('[data-lista]').innerHTML = listaContas(ti); KVShell.icones(); ligar(); };
    ligar();
    dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fechar);
    if (!dlg.open) dlg.showModal();
    KVShell.icones();
  }

  // ---------- ações ----------
  async function carregar() {
    o = await KVApi.orcamento(id);
    const a = P.aceita(o);
    const progs = a ? [...new Set(P.opsDaCombo(o, a).map((x) => O.site(x.site).programa).filter(Boolean))] : [];
    contas = (await Promise.all(progs.map((p) => KVApi.contas(p)))).flat();
    sugerirContas();
  }
  function ligarEventos() {
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      // menu do voo emitido: abre/fecha; tocar fora fecha
      if (b && b.dataset.menu) { menuAberto = menuAberto === +b.dataset.menu ? null : +b.dataset.menu; confirmar = null; render(); const p = app.querySelector('.menu-orc button'); if (p) p.focus(); return; }
      if (menuAberto && !e.target.closest('.menu-orc')) { menuAberto = confirmar = null; render(); if (!b) return; }
      if (!b || b.disabled) return;
      if (b.dataset.corrigir || b.dataset.cancelar) { menuAberto = null; render(); KVShell.irPara({ janela: b.dataset.corrigir ? 'corrigir' : 'cancelar', e: b.dataset.corrigir || b.dataset.cancelar }); sinc(); }
      else if (b.dataset.pedeDesfazer) { confirmar = +b.dataset.pedeDesfazer; render(); const p = app.querySelector('[data-desfazer]'); if (p) p.focus(); }
      else if (b.hasAttribute('data-nao')) { menuAberto = confirmar = null; render(); }
      else if (b.dataset.desfazer) {
        try { await KVApi.acao('emi.desfazer', { id: +b.dataset.desfazer }); menuAberto = confirmar = null; await carregar(); render(); KVShell.aviso('Emissão desfeita. Os pontos voltaram pra conta.'); }
        catch (err) { KVShell.aviso(err.message, { erro: true }); }
      }
      else if (b.hasAttribute('data-reabrir')) {
        try { await KVApi.acao('fech.reabrir', { id: o.id }); KVRota.trocar(`fechamento.html?id=${o.id}`); KVShell.aviso('Fechamento desfeito. O que estava marcado continua lá.'); }
        catch (err) { KVShell.aviso(err.message, { erro: true }); }
      }
      else if (b.dataset.conta) { buscaConta = ''; KVShell.irPara({ janela: 'conta', t: b.dataset.conta }); sinc(); }
      else if (b.dataset.emitir) {
        const ti = +b.dataset.emitir, inp = app.querySelector(`[data-loc="${ti}"]`), loc = inp.value.trim().toUpperCase();
        if (loc.length < 5) { inp.style.borderColor = 'var(--danger)'; inp.focus(); return; }
        b.disabled = true;
        try {
          const sc = app.querySelector(`[data-cartao="${ti}"]`), cartao = sc && sc.value ? +sc.value : null;
          const pago = cartao ? O.lerReais(app.querySelector(`[data-pago="${ti}"]`).value) || 0 : 0;
          KV.lembrarCartao(cartao);
          const r = await KVApi.acao('emi.registrar', { orcamento: o.id, trecho: ti, conta: emPontos(ti) ? escolha(ti).contaId : null, localizador: loc, obs: escolha(ti).obs, cartao, pago });
          delete escolhas[ti];
          await carregar(); render();
          KVShell.aviso(r.tudo ? 'Tudo emitido' : 'Voo registrado', { desfazer: async () => { await KVApi.acao('emi.desfazer', { id: r.id }); await carregar(); render(); KVShell.aviso('Emissão desfeita. Os pontos voltaram pra conta.'); } });
        } catch (err) { KVShell.aviso(err.message, { erro: true }); b.disabled = false; }
      }
    });
    app.addEventListener('input', (e) => { if (e.target.dataset.cartao) escolha(+e.target.dataset.cartao).cartao = e.target.value ? +e.target.value : null; if (e.target.dataset.pago) escolha(+e.target.dataset.pago).pago = O.lerReais(e.target.value) || 0; if (e.target.dataset.obs) escolha(+e.target.dataset.obs).obs = e.target.value; if (e.target.dataset.loc) { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); escolha(+e.target.dataset.loc).localizador = e.target.value; e.target.style.borderColor = ''; } });
    app.addEventListener('keydown', (e) => { if (e.target.dataset.loc && e.key === 'Enter') app.querySelector(`[data-emitir="${e.target.dataset.loc}"]`).click(); });
  }

  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const est = await KVApi.estado();
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar(`orcamento.html?id=${id}`); return; }
      P.usarProgramas(est.programas);
      KV.usarCartoes(est.cartoes);
      await carregar();
      document.querySelector('.carregando').remove();
      app = KVShell.montar('orcamentos', { dono: true });
      ligarEventos();
      render(); sinc();
      KVShell.aoVoltar(() => { render(); sinc(); });
    } catch (e) {
      const c = document.querySelector('.carregando');
      if (c) c.innerHTML = `${esc(e.message)} <a href="orcamentos.html" style="color:var(--orange)">Voltar pros orçamentos</a>`;
    }
  })();
};

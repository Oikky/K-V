/* Tela: Emissão (um registro por voo). Endereço: /emissao.html
   Emissão (rodada 9 dos rascunhos), lendo e gravando no banco: um cartão por voo da combinação aceita. Em pontos, o dono escolhe
     de qual conta sai (o sistema sugere a que tem saldo, não estoura o limite de beneficiários e usa pontos que vencem antes) e digita
     o localizador. Registrar gera sozinho a saída na conta. Com todos os voos emitidos, o orçamento vai pra Emitido. Só o dono.
   O estilo desta tela está em telas/emissao.css. */
KVTelas['emissao'] = function () {
  const O = KVOrc, P = KVProp, { esc, fmt } = KVOrc;
  const id = Number(KVShell.param('id'));
  let o = null, app = null, contas = [], escolhas = {}, buscaConta = '';
  const tira = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const hora = (x) => `${x.sai} → ${x.chega.replace(' +1', '')}${x.chega.includes('+1') ? '<sup>+1</sup>' : ''}`;
  const iniciais = (n) => n.split(' ').filter((x) => x.length > 2).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  const hoje = O.isoDia(new Date());
  const diasAte = (s) => Math.round((new Date(s + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 864e5);
  const opDo = (ti) => P.op(o, P.aceita(o).escolha[ti]);
  const emPontos = (ti) => O.site(opDo(ti).site).forma === 'pontos';
  const emissao = (ti) => o.emissoes.find((e) => e.trecho === ti);
  const escolha = (ti) => (escolhas[ti] = escolhas[ti] || { contaId: null, localizador: '', sugerida: false });
  const contaDe = (cid) => contas.find((c) => c.id === cid);

  // pra cada conta do programa: saldo depois, CPFs novos (ocupam vaga) e se estoura o limite. Avisa, não bloqueia.
  function contasPara(ti) {
    const x = opDo(ti), prog = O.site(x.site).programa;
    if (!prog) return [];
    const precisa = x.milhas * O.pagantes(o), pax = o.passageirosLista;
    return contas.filter((c) => c.programa_id === prog && c.ativa).map((c) => {
      // outros voos deste orçamento já marcados pra mesma conta e ainda não emitidos também contam
      const reservado = o.trechos.reduce((s, _, k) => s + (k !== ti && !emissao(k) && escolha(k).contaId === c.id ? opDo(k).milhas * O.pagantes(o) : 0), 0);
      const b = c.beneficiarios, ja = new Set(b ? b.lista.map((y) => y.pessoa_id) : []);
      const novos = pax.filter((p) => !ja.has(p.id) && p.id !== c.titular_id);
      const sobra = c.saldo - reservado - precisa;
      return { conta: c, precisa, sobra, novos, vagas: b, estoura: b ? novos.length > b.livres : false, falta: sobra < 0, vencendo: c.vencendo.pontos ? c.vencendo : null };
    }).sort((a, b) => (a.falta - b.falta) || (a.estoura - b.estoura) || (a.novos.length - b.novos.length)
      || ((b.vencendo ? 1 : 0) - (a.vencendo ? 1 : 0)) || (a.sobra - b.sobra));
  }
  // sugestão: a primeira da lista ordenada (tem saldo, não estoura vaga, menos CPFs novos, pontos vencendo primeiro)
  function sugerirContas() {
    o.trechos.forEach((t, ti) => { if (emPontos(ti) && !emissao(ti) && !escolha(ti).contaId) { const s = contasPara(ti)[0]; if (s) { escolha(ti).contaId = s.conta.id; escolha(ti).sugerida = true; } } });
  }

  // ---------- topo ----------
  function topo() {
    const cidades = [o.trechos[0].de, ...o.trechos.map((t) => t.para)].map(O.cidadeCurta);
    const feitos = o.emissoes.length;
    const s = P.situacao(o);
    const pax = o.passageirosLista;
    const falta = O.total(o) - pax.length;
    return `<a class="voltar" href="orcamentos.html"><i data-lucide="arrow-left"></i>Orçamentos</a>${O.trilha(o, 'emissao')}
      ${KVShell.param('fechou') ? '<div class="aviso ok" style="margin-bottom:14px">Orçamento fechado. Agora é emitir cada voo.</div>' : ''}
      <div class="topo-orc"><span class="quem">${esc(o.contato.nome)} · #${o.id} · ${esc(P.aceita(o).nome)}</span>
        <h1 style="--n:${cidades.join(' → ').length}">${cidades.map(esc).join(' <span class="seta">→</span> ')}</h1>
        <div class="kpis"><span class="kpi ${feitos < o.trechos.length ? 'destaque' : ''}"><b>${feitos}/${o.trechos.length}</b><span>voos emitidos</span></span>
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
      return `<article class="cartao-ref voo feito">${cab}${gasto}
        <div class="feito-linha"><span class="etiqueta ok"><i data-lucide="check"></i>Emitido</span><span class="locz">${esc(e.localizador)}</span>
          <span class="pq" style="flex-basis:100%">${e.conta_id ? `Saiu da conta de ${esc(c ? c.titular : 'outra pessoa')}${c ? ` (${esc(c.programa)})` : ''}` : 'Comprado em dinheiro'}</span></div></article>`;
    }
    if (o.etapa !== 'fechado') return `<article class="cartao-ref voo">${cab}${gasto}<div class="feito-linha"><span class="etiqueta">${O.etapa(o.etapa).nome}</span></div></article>`;
    let conta = '';
    if (pts) {
      const info = contasPara(ti).find((i) => i.conta.id === es.contaId);
      conta = info ? `<button class="conta-bt" data-conta="${ti}"><span class="rot">Sai da conta${es.sugerida ? ' · sugerida' : ''}</span><b>${esc(info.conta.titular)} · <span class="prog" data-p="${info.conta.programa_id}">${esc(info.conta.programa)}</span></b>
          <span class="saldo">${fmt.pts(info.conta.saldo)} → sobram ${fmt.pts(Math.max(0, info.sobra))} pts</span><i data-lucide="chevron-right" class="ir"></i></button><div class="chips">${chipsConta(info)}</div>`
        : `<button class="conta-bt" data-conta="${ti}"><span class="rot">Sai da conta</span><b>${contasPara(ti).length ? 'Escolher a conta' : `Nenhuma conta ${esc(P.progNome(O.site(x.site).programa))} cadastrada`}</b><i data-lucide="chevron-right" class="ir"></i></button>`;
    }
    return `<article class="cartao-ref voo">${cab}${gasto}${conta}
      <div class="loc"><div class="campo"><label for="loc-${ti}">Localizador</label><input id="loc-${ti}" data-loc="${ti}" maxlength="8" autocomplete="off" spellcheck="false" placeholder="ABC123" value="${esc(es.localizador)}"></div>
        <button class="btn primario" data-emitir="${ti}"><i data-lucide="ticket-check"></i>Registrar</button></div></article>`;
  }
  function fim() {
    if (o.etapa !== 'emitido') return '';
    return `<div class="fim"><i data-lucide="circle-check-big" style="color:var(--ok);width:24px;height:24px"></i><span><b>Tudo emitido.</b><br><span class="muted" style="font-size:13.5px">As saídas de pontos já estão nas contas.</span></span>
      <span class="acoes"><button class="btn" disabled title="Vem depois, a partir do modelo atual" style="opacity:.55"><i data-lucide="file-text"></i>Recibo (em breve)</button></span></div>`;
  }
  function render() {
    const y = scrollY;
    if (!P.aceita(o) || !['fechado', 'emitido', 'cancelado'].includes(o.etapa)) {
      app.innerHTML = `<a class="voltar" href="orcamentos.html"><i data-lucide="arrow-left"></i>Orçamentos</a>${O.trilha(o, 'emissao')}<div class="vazio">Feche o orçamento antes de emitir. <a href="fechamento.html?id=${o.id}" style="color:var(--orange)">Ir pro fechamento</a></div>`;
      KVShell.icones(); return;
    }
    app.innerHTML = topo() + `<div class="secao"><h2>Voos</h2><span class="n">um registro por voo</span></div><div class="grade-ref" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))">${o.trechos.map((_, i) => cartaoVoo(i)).join('')}</div>` + fim();
    document.title = `Emissão #${o.id} ${O.destino(o)} · K&V`;
    KVShell.icones();
    scrollTo(0, y);
  }

  // ---------- janela: escolher a conta ----------
  const dlg = document.createElement('dialog'); dlg.className = 'janela lateral'; document.body.append(dlg);
  const fechar = () => KVShell.desfazer({ janela: 1, t: 1 }, sinc);
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
  function sinc() {
    if (KVShell.param('janela') !== 'conta' || o.etapa !== 'fechado') { if (dlg.open) dlg.close(); return; }
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
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.conta) { buscaConta = ''; KVShell.irPara({ janela: 'conta', t: b.dataset.conta }); sinc(); }
      else if (b.dataset.emitir) {
        const ti = +b.dataset.emitir, inp = app.querySelector(`[data-loc="${ti}"]`), loc = inp.value.trim().toUpperCase();
        if (loc.length < 5) { inp.style.borderColor = 'var(--danger)'; inp.focus(); return; }
        b.disabled = true;
        try {
          const r = await KVApi.acao('emi.registrar', { orcamento: o.id, trecho: ti, conta: emPontos(ti) ? escolha(ti).contaId : null, localizador: loc });
          delete escolhas[ti];
          await carregar(); render();
          KVShell.aviso(r.tudo ? 'Tudo emitido' : 'Voo registrado');
        } catch (err) { KVShell.aviso(err.message, { erro: true }); b.disabled = false; }
      }
    });
    app.addEventListener('input', (e) => { if (e.target.dataset.loc) { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); escolha(+e.target.dataset.loc).localizador = e.target.value; e.target.style.borderColor = ''; } });
    app.addEventListener('keydown', (e) => { if (e.target.dataset.loc && e.key === 'Enter') app.querySelector(`[data-emitir="${e.target.dataset.loc}"]`).click(); });
  }

  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const est = await KVApi.estado();
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar(`orcamento.html?id=${id}`); return; }
      P.usarProgramas(est.programas);
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

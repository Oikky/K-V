/* Tela: Agenda. Endereço: /agenda.html?f=voos|dinheiro|pontos
   Tudo o que tem data, num lugar só, dia a dia: voos (revisão, check-in, dia do voo), dinheiro (cliente que paga,
   fatura dos cartões, folha) e pontos (lotes que vencem, vagas de beneficiário que voltam). Só o dono.
   O que já passou da data e ainda está pendente fica em cima; quem deve sem data marcada, embaixo.
   O estilo desta tela está em telas/agenda.css. */
KVTelas['agenda'] = function () {
  let app = null, gastos = [];
  const PS = KV.pessoas, PT = KV.ponto, O = KVOrc, C = KVCartoes, { esc } = O;
  const brl = (c) => O.fmt.brl(c);
  const pts = (n) => n.toLocaleString('pt-BR');
  const DIAS = 60;
  const HOJE = PS.hoje;
  const soma = (dia, n) => { const d = new Date(dia + 'T12:00:00'); d.setDate(d.getDate() + n); return KV.isoDia(d); };
  const ATE = soma(HOJE, DIAS);
  const noPeriodo = (d) => d >= HOJE && d <= ATE;
  const TIPOS = {
    voo: { nome: 'Voos', icone: 'plane' },
    dinheiro: { nome: 'Dinheiro', icone: 'banknote' },
    pontos: { nome: 'Pontos', icone: 'coins' },
  };
  const filtro = () => TIPOS[KVShell.param('f')] ? KVShell.param('f') : 'tudo';
  const primeiro = (n) => (n || '').split(' ')[0];

  // ---------- os compromissos: { dia, tipo, titulo, sub, valor, href, forte } ----------
  function compromissos() {
    const l = [];
    // voos: revisão 7 dias antes, check-in 2 dias antes e o dia (mesma suposição do painel)
    PS.viagens().filter((v) => v.etapa !== 'Cancelado').forEach((v) => {
      const cli = PS.pessoa(v.clienteId), quem = `${cli ? cli.nome : '—'}${v.passageiros.length > 1 ? ` + ${v.passageiros.length - 1}` : ''}`;
      v.trechos.forEach((t, i) => {
        const em = v.raw.emissoes.find((e) => e.trecho === i && !e.cancelada), rota = `${t.de} → ${t.para}`;
        const href = `${em ? 'fechamento' : 'emissao'}.html?id=${v.id}`;
        l.push({ dia: t.data, tipo: 'voo', titulo: `Voo ${rota}`, sub: `${quem}${em ? ` · ${em.localizador}` : ' · falta emitir'}`, href, forte: true, icone: 'plane-takeoff' });
        l.push({ dia: soma(t.data, -2), tipo: 'voo', titulo: `Check-in abre · ${rota}`, sub: `voo ${O.dataCurta(t.data)} · ${quem}`, href, icone: 'ticket' });
        l.push({ dia: soma(t.data, -7), tipo: 'voo', titulo: `Revisar horário · ${rota}`, sub: `voo ${O.dataCurta(t.data)} · ${quem}`, href, icone: 'search-check' });
      });
    });
    // cliente que paga: na data prevista; sem data vai pro fim
    PS.viagens().forEach((v) => {
      const falta = PS.aReceber(v); if (!falta) return;
      const cli = PS.pessoa(v.clienteId);
      l.push({ dia: v.raw.receb.previsto || null, tipo: 'dinheiro', titulo: `Receber de ${cli ? cli.nome : '—'}`, sub: `${v.destino} · ${v.recebido ? `já entrou ${brl(v.recebido)}` : 'nada recebido ainda'}`, valor: falta, entra: true, href: `fechamento.html?id=${v.id}`, icone: 'hand-coins', pendente: true });
    });
    // faturas dos cartões que vencem no período
    KV.cartoes().forEach((c) => C.faturas(c, gastos).filter((f) => f.total > 0).forEach((f) => {
      l.push({ dia: f.vence, tipo: 'dinheiro', titulo: `Fatura ${c.nome}${c.final ? ` · ${c.final}` : ''}`, sub: `${f.itens.length} ${f.itens.length === 1 ? 'lançamento' : 'lançamentos'} · ${f.fecha < HOJE ? 'fechou' : 'fecha'} ${O.dataCurta(f.fecha)}`, valor: f.total, href: `financeiro.html?janela=cartao&c=${c.id}`, icone: 'credit-card' });
    }));
    // folha: semana fechada sem pagamento conta a partir da segunda seguinte
    PT.aPagar().forEach((s) => {
      const p = PT.pesquisador(s.pid) || {}, seg = s.inicio;
      l.push({ dia: soma(seg, 7), tipo: 'dinheiro', titulo: `Pagar ${primeiro(p.nome)}`, sub: `semana de ${O.dataCurta(seg)} · ${PT.fmt.dur(s.minutos)}`, valor: Math.round(s.ganho * 100), href: 'folha.html', icone: 'timer', pendente: true });
    });
    // pontos: lotes que vencem e vagas de beneficiário que voltam
    KV.contas().forEach((c) => {
      const conta = `${primeiro(c.titular)} · ${c.programa}`;
      c.lotes.filter((x) => x.vence && x.resta > 0).forEach((x) => l.push({ dia: x.vence, tipo: 'pontos', titulo: `${pts(x.resta)} pts vencem`, sub: conta, href: `conta.html?id=${c.id}`, icone: 'hourglass' }));
      const b = KV.beneficiarios(c);
      if (b && c.regra === 'janela') b.lista.filter((x) => x.ultima).forEach((x) => l.push({ dia: soma(x.ultima, 365), tipo: 'pontos', titulo: `Vaga volta: ${x.nome}`, sub: `beneficiário · ${conta}`, href: `conta.html?id=${c.id}`, icone: 'user-round-check' }));
    });
    // Smiles e outros por ano: as vagas zeram em 1º de janeiro
    const virada = `${+HOJE.slice(0, 4) + 1}-01-01`;
    KV.programas().filter((p) => p.regra === 'ano').forEach((p) => l.push({ dia: virada, tipo: 'pontos', titulo: `Vagas da ${p.nome} zeram`, sub: 'todas as contas voltam a ter as vagas de beneficiário', href: `contas.html`, icone: 'rotate-ccw' }));
    return l;
  }

  // ---------- desenho ----------
  const NOME_DIA = (d) => {
    const n = PS.diasAte(d), sem = new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' });
    return n === 0 ? `Hoje · ${sem}` : n === 1 ? `Amanhã · ${sem}` : sem[0].toUpperCase() + sem.slice(1);
  };
  const item = (x) => `<li><a class="ag-item ${x.forte ? 'forte' : ''}" href="${x.href}" data-t="${x.tipo}">
      <span class="ag-ic" aria-hidden="true"><i data-lucide="${x.icone}"></i></span>
      <span class="ag-txt"><b>${esc(x.titulo)}</b><small>${esc(x.sub)}</small></span>
      ${x.valor != null ? `<span class="ag-valor ${x.entra ? 'entra' : ''}">${x.entra ? '+ ' : ''}${brl(x.valor)}</span>` : ''}</a></li>`;

  function render() {
    const f = filtro(), todos = compromissos();
    const passa = (x) => f === 'tudo' || x.tipo === f;
    const lista = todos.filter(passa);
    const atrasados = lista.filter((x) => x.pendente && x.dia && x.dia < HOJE).sort((a, b) => a.dia.localeCompare(b.dia));
    const semData = lista.filter((x) => !x.dia);
    const futuros = lista.filter((x) => x.dia && noPeriodo(x.dia)).sort((a, b) => a.dia.localeCompare(b.dia) || (b.forte ? 1 : 0) - (a.forte ? 1 : 0));
    const dias = [...new Set(futuros.map((x) => x.dia))];
    const conta = (t) => todos.filter((x) => x.dia && noPeriodo(x.dia) && (t === 'tudo' || x.tipo === t)).length;
    const semana = futuros.filter((x) => PS.diasAte(x.dia) <= 7);
    const entra = futuros.filter((x) => x.entra && PS.diasAte(x.dia) <= 30).reduce((s, x) => s + x.valor, 0);
    const sai = futuros.filter((x) => x.tipo === 'dinheiro' && !x.entra && PS.diasAte(x.dia) <= 30).reduce((s, x) => s + x.valor, 0);

    app.innerHTML = `<div class="cab-ag"><div><h1>Agenda</h1><div class="muted ag-sub">próximos ${DIAS} dias</div></div>
        <div class="kpis"><span class="kpi destaque"><b>${semana.length}</b><span>nesta semana</span></span>
          <span class="kpi"><b>${O.fmt.brl(entra).replace(/,\d+$/, '')}</b><span>entra em 30 dias</span></span>
          <span class="kpi"><b>${O.fmt.brl(sai).replace(/,\d+$/, '')}</b><span>sai em 30 dias</span></span></div></div>
      <div class="pilulas rolar ag-filtros">${[['tudo', 'Tudo'], ...Object.entries(TIPOS).map(([k, t]) => [k, t.nome])].map(([k, n]) => `<button class="pilula" data-f="${k}" aria-pressed="${k === f}">${n} <span class="cont">${conta(k)}</span></button>`).join('')}</div>
      ${atrasados.length ? `<section class="ag-dia atrasado"><h2><i data-lucide="alert-circle"></i>Passou da data</h2><ul>${atrasados.map((x) => item({ ...x, sub: `${O.dataCurta(x.dia)} · ${x.sub}` })).join('')}</ul></section>` : ''}
      ${dias.length ? dias.map((d) => `<section class="ag-dia ${d === HOJE ? 'hoje' : ''}"><h2><span class="ag-data">${O.dataCurta(d)}</span>${NOME_DIA(d)}</h2>
          <ul>${futuros.filter((x) => x.dia === d).map(item).join('')}</ul></section>`).join('') : '<div class="vazio">Nada marcado nos próximos dias.</div>'}
      ${semData.length ? `<section class="ag-dia"><h2>A receber sem data</h2><p class="ag-nota">Marque no fechamento quando o dinheiro entra pra aparecer no dia certo.</p><ul>${semData.map(item).join('')}</ul></section>` : ''}`;
    KVShell.icones();
  }

  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const [est, , , fin] = await Promise.all([PS.carregar(), KV.carregar(), PT.carregar(), KVApi.financeiro()]);
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      gastos = fin.gastos;
      document.querySelector('.carregando').remove();
      app = KVShell.montar('agenda', { dono: true });
      app.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { KVShell.irPara({ f: b.dataset.f === 'tudo' ? null : b.dataset.f }); render(); } });
      render();
      KVShell.aoVoltar(render);
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.textContent = e.message; }
  })();
};

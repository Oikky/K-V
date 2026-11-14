/* Tela: Painel. Endereço: /painel.html
   O que espera o dono hoje: o que precisa dele (revisar, emitir, pagar a folha, contas com aviso), os próximos voos
   com os lembretes (revisão, check-in, dia do voo) e um resumo do mês que leva ao financeiro.
   Primeira versão pra ter uma ideia; sem rascunho aprovado ainda. Só o dono.
   O estilo desta tela está em telas/painel.css. */
KVTelas['painel'] = function () {
  let app = null, orcs = [];
  const PS = KV.pessoas, PT = KV.ponto, O = KVOrc, { esc } = O;
  const brl = (c) => (Math.round(c / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const DIAS = 30;
  // shortcut: revisão 7 dias antes e check-in 2 dias antes valem pra todas as companhias; ajustar por companhia quando o dono disser os prazos.
  const lembrete = (d) => d === 0 ? { texto: 'Voa hoje', cls: 'hoje' } : d <= 2 ? { texto: 'Check-in aberto', cls: 'warn' } : d <= 7 ? { texto: 'Revisar horário', cls: '' } : null;
  const diaSem = (s) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const quando = (d) => d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`;
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  // cada trecho dos próximos 30 dias das viagens fechadas ou emitidas
  function proximosVoos() {
    return PS.viagens().filter((v) => v.etapa !== 'Cancelado').flatMap((v) => v.trechos.map((t, i) => {
      const em = v.raw.emissoes.find((e) => e.trecho === i && !e.cancelada);
      return { v, t, dias: PS.diasAte(t.data), localizador: em ? em.localizador : null };
    })).filter((x) => x.dias >= 0 && x.dias <= DIAS).sort((a, b) => a.t.data.localeCompare(b.t.data));
  }

  function cartoes() {
    const lista = [];
    const revisar = orcs.filter((o) => o.etapa === 'pesquisado');
    if (revisar.length) lista.push({ rot: 'Pra revisar', grande: plural(revisar.length, 'orçamento pesquisado', 'orçamentos pesquisados'), sub: 'Montar a proposta e mandar pro cliente', href: 'orcamentos.html', cheio: true });
    const emitir = orcs.filter((o) => o.etapa === 'fechado');
    if (emitir.length) lista.push({ rot: 'Falta emitir', grande: plural(emitir.length, 'viagem fechada', 'viagens fechadas'), sub: emitir.slice(0, 3).map((o) => o.contato.nome.split(' ')[0]).join(', '), href: emitir.length === 1 ? `emissao.html?id=${emitir[0].id}` : 'orcamentos.html?f=fechado' });
    const pagar = PT.aPagar();
    if (pagar.length) lista.push({ rot: 'Folha', grande: `${plural(pagar.length, 'semana', 'semanas')} a pagar`, sub: PT.brl(pagar.reduce((s, x) => s + x.ganho, 0)), href: 'folha.html' });
    KV.alertas().slice(0, 2).forEach((a) => lista.push({ rot: a.tipo === 'vencendo' ? 'Pontos vencendo' : 'Vagas de beneficiário', grande: a.texto, sub: `${a.conta.titular} · ${a.conta.programa}`, href: `conta.html?id=${a.conta.id}` }));
    if (!lista.length) return '<div class="vazio">Nada esperando você agora.</div>';
    // o primeiro fica em laranja só se for pra revisar (é o que espera o dono)
    return `<div class="grade-ref pn-grade">${lista.map((c) => `<a class="cartao-ref pn-cartao ${c.cheio ? 'cheio' : ''}" href="${c.href}">
      <span class="canto" aria-hidden="true"><span class="pn-seta"><i data-lucide="arrow-up-right"></i></span></span>
      <span class="rot">${esc(c.rot)}</span><span class="grande">${esc(c.grande)}</span><span class="pq">${esc(c.sub)}</span></a>`).join('')}</div>`;
  }

  function voosHtml(voos) {
    if (!voos.length) return '<div class="vazio">Nenhum voo nos próximos 30 dias.</div>';
    return `<ul class="pn-voos">${voos.map(({ v, t, dias, localizador }) => {
      const l = lembrete(dias), cli = PS.pessoa(v.clienteId), pax = v.passageiros.length;
      const [, mm, dd] = t.data.split('-');
      return `<li><a href="${v.etapa === 'Fechado' ? 'emissao' : 'fechamento'}.html?id=${v.id}" class="pn-voo ${l && l.cls === 'hoje' ? 'hoje' : ''}">
        <span class="pn-data"><b>${dd}/${mm}</b><small>${diaSem(t.data)} · ${quando(dias)}</small></span>
        <span class="pn-rota"><b>${esc(t.de)} <i data-lucide="arrow-right"></i> ${esc(t.para)}</b><small>${esc(O.cidadeCurta(t.para))} · ${esc(cli ? cli.nome : '—')}${pax > 1 ? ` + ${pax - 1}` : ''}</small></span>
        <span class="pn-fim">${v.etapa === 'Fechado' && !localizador ? '<span class="etiqueta warn">Falta emitir</span>' : localizador ? `<span class="pn-loc">${esc(localizador)}</span>` : ''}
          ${l ? `<span class="etiqueta ${l.cls}">${l.texto}</span>` : ''}</span></a></li>`;
    }).join('')}</ul>`;
  }

  function mesHtml() {
    const m = PS.hoje.slice(0, 7);
    const vs = PS.viagens().filter((v) => v.etapa !== 'Cancelado' && (v.fechadoEm || '').slice(0, 7) === m);
    const venda = vs.reduce((s, v) => s + v.venda, 0), lucro = vs.reduce((s, v) => s + PS.lucro(v), 0);
    const deve = PS.viagens().reduce((s, v) => s + PS.aReceber(v), 0);
    return `<a class="pn-mes" href="financeiro.html">
      <span><small>Vendas no mês</small><b>${brl(venda)}</b></span><span><small>Lucro</small><b>${brl(lucro)}</b></span><span><small>A receber</small><b>${brl(deve)}</b></span>
      <span class="pn-ir">Financeiro <i data-lucide="arrow-right"></i></span></a>`;
  }

  function render() {
    const voos = proximosVoos(), semana = voos.filter((x) => x.dias <= 7).length;
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    app.innerHTML = `<div class="cab-pn"><div><h1>Painel</h1><div class="muted pn-hoje">${hoje}</div></div>
        <div class="kpis"><span class="kpi destaque"><b>${orcs.filter((o) => o.etapa === 'pesquisado').length}</b><span>pra revisar</span></span>
          <span class="kpi"><b>${orcs.filter((o) => O.etapa(o.etapa).aberta && o.etapa !== 'fechado').length}</b><span>abertos</span></span>
          <span class="kpi"><b>${semana}</b><span>voos em 7 dias</span></span></div></div>
      <div class="secao"><h2>Precisa de você</h2></div>
      ${cartoes()}
      <div class="secao"><h2>Próximos voos</h2><span class="n">${plural(voos.length, 'trecho', 'trechos')} em ${DIAS} dias</span></div>
      ${voosHtml(voos)}
      <div class="secao"><h2>Este mês</h2></div>
      ${mesHtml()}`;
    KVShell.icones();
  }

  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const [est, , , lista] = await Promise.all([PS.carregar(), KV.carregar(), PT.carregar(), KVApi.orcamentos()]);
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      orcs = lista;
      document.querySelector('.carregando').remove();
      app = KVShell.montar('painel', { dono: true });
      render();
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.textContent = e.message; }
  })();
};

/* Tela: Financeiro. Endereço: /financeiro.html?mes=AAAA-MM
   Visão do mês pro dono (CONTEXT.md, "Visão financeira"): vendas, lucro, a receber, taxa de fechamento,
   custos de pontos, folha e pontos em estoque. Primeira versão pra ter uma ideia; sem rascunho aprovado ainda.
   Sem "resultado" somando tudo: a pergunta 11 pro dono continua aberta.
   O estilo desta tela está em telas/financeiro.css. */
KVTelas['financeiro'] = function () {
  let app = null, custos = [], orcs = [];
  const PS = KV.pessoas, PT = KV.ponto, O = KVOrc, { esc } = O;
  const brl = (c) => O.fmt.brl(c);
  // valor grande sem centavos: R$ 12.340
  const brlCurto = (c) => (Math.round(c / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const pts = (n) => n.toLocaleString('pt-BR');
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomeMes = (m) => { const [a, mm] = m.split('-'); return `${MESES[+mm - 1]} ${a}`; };
  const curto = (m) => MESES[+m.split('-')[1] - 1].slice(0, 3);
  const somaMes = (m, n) => { const [a, mm] = m.split('-').map(Number); const d = new Date(a, mm - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const ESTE = PS.hoje.slice(0, 7);
  const mes = () => /^\d{4}-\d{2}$/.test(KVShell.param('mes') || '') ? KVShell.param('mes') : ESTE;

  // ---------- contas do mês ----------
  const vendasDe = (m) => PS.viagens().filter((v) => v.etapa !== 'Cancelado' && (v.fechadoEm || '').slice(0, 7) === m);
  const total = (l, f) => l.reduce((s, x) => s + f(x), 0);
  function resumo(m) {
    const vs = vendasDe(m);
    return { vendas: vs, venda: total(vs, (v) => v.venda), lucro: total(vs, PS.lucro) };
  }
  // orçamentos criados no mês que já tiveram desfecho: quantos fecharam a cada 10
  function taxa(m) {
    const doMes = orcs.filter((o) => (o.criadoEm || '').slice(0, 7) === m);
    const fechou = doMes.filter((o) => ['fechado', 'emitido', 'cancelado'].includes(o.etapa)).length;
    const perdeu = doMes.filter((o) => o.etapa === 'perdido').length;
    return { fechou, decididos: fechou + perdeu, abertos: doMes.length - fechou - perdeu };
  }
  // folha: horas cronometradas no mês × valor da hora (pago ou não)
  const folha = (m) => Math.round(100 * PT.pesquisadores.reduce((s, p) => s + PT.trechos(p.id).filter((t) => KV.isoDia(t.inicio).slice(0, 7) === m).reduce((x, t) => x + PT.ganhoTrecho(t), 0), 0));
  const TIPOS = { clube: 'Clubes', compra: 'Compra de pontos', transferencia: 'Transferências' };
  function custosDe(m) {
    const porTipo = {};
    custos.filter((c) => c.mes === m).forEach((c) => { porTipo[c.tipo] = (porTipo[c.tipo] || 0) + c.custo; });
    return Object.entries(porTipo).map(([tipo, valor]) => ({ nome: TIPOS[tipo] || tipo, valor })).sort((a, b) => b.valor - a.valor);
  }
  const aReceber = () => {
    const porCliente = new Map();
    PS.viagens().forEach((v) => { const d = PS.aReceber(v); if (d > 0 && v.clienteId) porCliente.set(v.clienteId, (porCliente.get(v.clienteId) || 0) + d); });
    return [...porCliente.entries()].map(([id, valor]) => ({ pessoa: PS.pessoa(id), valor })).filter((x) => x.pessoa).sort((a, b) => b.valor - a.valor);
  };
  function estoque() {
    const porProg = new Map();
    KV.contas().forEach((c) => { if (c.saldo > 0) porProg.set(c.programaId, (porProg.get(c.programaId) || 0) + c.saldo); });
    return [...porProg.entries()].map(([id, milhas]) => { const p = KV.programa(id) || { nome: id, valorMilha: 0 }; return { id, nome: p.nome, milhas, reais: Math.round(milhas * (p.valorMilha || 0) / 1e4) }; })
      .sort((a, b) => b.reais - a.reais || b.milhas - a.milhas);
  }

  // ---------- desenho ----------
  function grafico(m) {
    const lista = Array.from({ length: 6 }, (_, i) => somaMes(m, i - 5)).map((x) => ({ mes: x, ...resumo(x) }));
    const max = Math.max(1, ...lista.map((x) => x.venda));
    return `<div class="fin-graf" role="group" aria-label="Vendas dos últimos 6 meses">${lista.map((x) => `
      <button class="fin-barra" data-mes="${x.mes}" aria-pressed="${x.mes === m}" aria-label="${nomeMes(x.mes)}: vendas ${brl(x.venda)}, lucro ${brl(x.lucro)}" ${x.mes > ESTE ? 'disabled' : ''}>
        <span class="fin-valor">${x.venda ? brlCurto(x.venda) : '—'}</span>
        <span class="fin-trilho"><i style="height:${Math.max(x.venda ? 4 : 0, Math.round(x.venda / max * 100))}%"></i></span>
        <span class="fin-mes">${curto(x.mes)}</span>
        <span class="fin-dica" role="tooltip">${nomeMes(x.mes)}<br>Vendas ${brl(x.venda)}<br>Lucro ${brl(x.lucro)}</span>
      </button>`).join('')}</div>`;
  }
  const linha = (nome, valor, extra = '') => `<li><span>${nome}${extra}</span><b>${valor}</b></li>`;

  function render() {
    const m = mes(), r = resumo(m), t = taxa(m), f = folha(m), cs = custosDe(m), ar = aReceber(), est = estoque();
    const devem = total(ar, (x) => x.valor);
    const dez = t.decididos ? Math.round(t.fechou / t.decididos * 10) : null;
    app.innerHTML = `<div class="cab-fin"><h1>Financeiro</h1>
        <div class="fin-mesnav"><button class="btn redondo" data-mes="${somaMes(m, -1)}" aria-label="Mês anterior"><i data-lucide="chevron-left"></i></button>
          <b>${nomeMes(m)}</b>
          <button class="btn redondo" data-mes="${somaMes(m, 1)}" aria-label="Próximo mês" ${m >= ESTE ? 'disabled' : ''}><i data-lucide="chevron-right"></i></button></div></div>
      <div class="kpis fin-kpis">
        <span class="kpi"><b>${brlCurto(r.venda)}</b><span>vendas · ${r.vendas.length}</span></span>
        <span class="kpi destaque"><b>${brlCurto(r.lucro)}</b><span>lucro</span></span>
        <span class="kpi"><b>${brlCurto(devem)}</b><span>a receber</span></span>
        <span class="kpi"><b>${dez == null ? '—' : `${dez}<small>/10</small>`}</b><span>${t.decididos ? `fecham (${t.fechou} de ${t.decididos})` : 'fecham a cada 10'}</span></span>
      </div>
      ${grafico(m)}
      <div class="fin-grade">
        <section class="fin-bloco"><h2>Custos de ${MESES[+m.split('-')[1] - 1]}</h2>
          <ul class="fin-lista">${cs.map((c) => linha(c.nome, brl(c.valor))).join('')}${linha('Folha dos pesquisadores', brl(f), m === ESTE ? ' <small>até agora</small>' : '')}</ul>
          <p class="fin-nota">Total ${brl(total(cs, (c) => c.valor) + f)}. Taxas e trechos em dinheiro já saem do lucro de cada venda.</p></section>
        <section class="fin-bloco"><h2>A receber</h2>
          ${ar.length ? `<ul class="fin-lista">${ar.slice(0, 6).map((x) => `<li><a href="pessoa.html?id=${x.pessoa.id}">${esc(x.pessoa.nome)}</a><b>${brl(x.valor)}</b></li>`).join('')}</ul>
            ${ar.length > 6 ? `<a class="fin-mais" href="clientes.html?filtro=receber">Ver os ${ar.length} clientes</a>` : ''}` : '<p class="fin-nota">Ninguém devendo.</p>'}</section>
        <section class="fin-bloco"><h2>Pontos em estoque</h2>
          ${est.length ? `<ul class="fin-lista">${est.map((x) => `<li><span class="prog" data-p="${esc(x.id)}">${esc(x.nome)}</span><span class="fin-dupla"><b>${pts(x.milhas)}</b>${x.reais ? `<small>${brlCurto(x.reais)}</small>` : ''}</span></li>`).join('')}</ul>
            <p class="fin-nota">Em R$ pelo valor da milha das configurações.</p>` : '<p class="fin-nota">Nenhuma conta com saldo.</p>'}</section>
      </div>
      <div class="secao"><h2>Vendas de ${MESES[+m.split('-')[1] - 1]}</h2><span class="n">${r.vendas.length}</span></div>
      ${r.vendas.length ? `<div class="tabela-wrap"><table class="fin-tab"><thead><tr><th>Cliente</th><th>Destino</th><th>Forma</th><th class="dir">Venda</th><th class="dir">Custo</th><th class="dir">Lucro</th><th>Pagamento</th></tr></thead><tbody>
        ${r.vendas.sort((a, b) => b.venda - a.venda).map((v) => { const s = PS.situacao(v), l = PS.lucro(v); return `<tr class="clicavel" data-ir="fechamento.html?id=${v.id}">
          <td>${esc((PS.pessoa(v.clienteId) || { nome: '—' }).nome)}</td><td>${esc(v.destino)}</td><td>${v.programa ? `<span class="prog" data-p="${esc(v.programa)}">${esc(v.forma)}</span>` : esc(v.forma)}</td>
          <td class="dir">${brl(v.venda)}</td><td class="dir muted">${brl(PS.custo(v))}</td><td class="dir ${l < 0 ? 'neg' : ''}">${brl(l)}</td>
          <td><span class="etiqueta ${s === 'pago' ? 'ok' : s === 'parte' ? 'warn' : ''}">${{ pago: 'Pago', parte: 'Pago em parte', receber: 'A receber' }[s] || s}</span></td></tr>`; }).join('')}
        </tbody></table></div>
        <p class="fin-nota">Custo = milhas × custo real da milha do programa (o que se pagou nos pontos; sem custo anotado, o valor da milha) + taxas + dinheiro. A venda conta no mês em que fechou.</p>`
      : '<div class="vazio">Nenhuma venda fechada neste mês.</div>'}`;
    KVShell.icones();
  }

  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const [est, , , fin, lista] = await Promise.all([PS.carregar(), KV.carregar(), PT.carregar(), KVApi.financeiro(), KVApi.orcamentos()]);
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      custos = fin.custos; orcs = lista;
      document.querySelector('.carregando').remove();
      app = KVShell.montar('financeiro', { dono: true });
      app.addEventListener('click', (e) => {
        const b = e.target.closest('[data-mes]');
        if (b) { KVShell.irPara({ mes: b.dataset.mes === ESTE ? null : b.dataset.mes }); render(); return; }
        const tr = e.target.closest('tr[data-ir]');
        if (tr && !e.target.closest('a')) KVRota.trocar(tr.dataset.ir);
      });
      render();
      KVShell.aoVoltar(render);
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.textContent = e.message; }
  })();
};

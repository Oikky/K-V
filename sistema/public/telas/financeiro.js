/* Tela: Financeiro. Endereço: /financeiro.html?mes=AAAA-MM
   Visão do mês pro dono (CONTEXT.md, "Visão financeira"): vendas, lucro, a receber, taxa de fechamento,
   custos de pontos, folha e pontos em estoque. Primeira versão pra ter uma ideia; sem rascunho aprovado ainda.
   Sem "resultado" somando tudo: a pergunta 11 pro dono continua aberta.
   O estilo desta tela está em telas/financeiro.css. */
KVTelas['financeiro'] = function () {
  let app = null, custos = [], orcs = [], gastos = [];
  const C = KVCartoes;
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

  // ---------- cartões de crédito ----------
  const dm = (s) => { const [, m, d] = s.split('-'); return `${d}/${m}`; };
  const nomeC = (c) => `${c.nome}${c.final ? ` · ${c.final}` : ''}`;
  function cartoesHtml() {
    const cs = KV.cartoes().filter((c) => c.ativo);
    const cab = `<div class="secao"><h2>Cartões</h2><span class="n">${cs.length}</span><button class="btn pequeno" data-novo-cartao style="margin-left:auto"><i data-lucide="plus"></i>Novo cartão</button></div>`;
    if (!cs.length) return cab + '<div class="vazio">Nenhum cartão cadastrado. Cadastre os cartões da K&V pra ver as faturas e o que foi pago em cada um.</div>';
    return cab + `<div class="grade-ref fin-cartoes">${cs.map((c) => {
      const ab = C.aberta(c, gastos, PS.hoje), fs = C.faturas(c, gastos), prox = fs.find((f) => f.mes > ab.mes);
      const usado = C.usado(c, gastos, PS.hoje), pct = c.limite ? Math.min(100, Math.round(usado / c.limite * 100)) : 0;
      return `<article class="cartao-ref fin-cartao" data-cartao="${c.id}" tabindex="0" role="button" aria-label="Faturas do ${esc(nomeC(c))}">
        <span class="canto" aria-hidden="true"><span class="fin-seta"><i data-lucide="arrow-up-right"></i></span></span>
        <span class="rot"><i data-lucide="credit-card"></i>${esc(nomeC(c))}</span>
        <span class="fin-fat"><small>Fatura de ${MESES[+ab.mes.split('-')[1] - 1]} · aberta</small><b>${brl(ab.total)}</b><small>fecha ${dm(ab.fecha)} · vence ${dm(ab.vence)}</small></span>
        ${c.limite ? `<span class="fin-limite"><span class="barra ${pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : ''}"><i style="width:${pct}%"></i></span><small>${brlCurto(Math.max(0, c.limite - usado))} livres de ${brlCurto(c.limite)}</small></span>` : ''}
        ${prox ? `<span class="pq">Depois: ${brl(prox.total)} em ${MESES[+prox.mes.split('-')[1] - 1]}</span>` : ''}
      </article>`; }).join('')}</div>`;
  }
  const NOMES_GASTO = { compra: 'Compra de pontos', clube: 'Clube', transferencia: 'Transferência', taxa: 'Taxa de embarque', passagem: 'Passagem' };
  const descGasto = (p) => p.origem === 'emi' ? `${NOMES_GASTO[p.tipo]} · ${esc(p.quem || '')} (#${p.orcamento_id})` : `${NOMES_GASTO[p.tipo] || p.tipo} · ${esc(p.quem.split(' ')[0])}${p.programa ? ` · ${esc((KV.programa(p.programa) || { nome: p.programa }).nome)}` : ''}`;

  const dlg = document.createElement('dialog'); dlg.className = 'janela lateral'; document.body.append(dlg);
  const fechar = () => KVShell.desfazer({ janela: 1, c: 1 }, sinc);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); fechar(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fechar(); });
  const abrirJ = (janela, c) => { KVShell.irPara({ janela, c }); sinc(); };

  function sinc() {
    const j = KVShell.param('janela'), c = KV.cartao(KVShell.param('c'));
    if (j === 'cartao' && c) janelaFaturas(c);
    else if (j === 'cartao-form') janelaForm(c || null);
    else { if (dlg.open) dlg.close(); return; }
    dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fechar);
    if (!dlg.open) dlg.showModal();
    KVShell.icones();
  }
  // faturas do cartão: das 2 últimas que já venceram em diante, cada uma com o que caiu nela
  function janelaFaturas(c) {
    const ab = C.aberta(c, gastos, PS.hoje);
    const fs = C.faturas(c, gastos);
    const passadas = fs.filter((f) => f.mes < ab.mes).slice(-2), futuras = fs.filter((f) => f.mes > ab.mes);
    const lista = [...passadas, ab, ...futuras];
    dlg.innerHTML = `<header><div style="flex:1"><h2>${esc(nomeC(c))}</h2><div class="sub">fecha dia ${c.fecha} · vence dia ${c.vence}${c.limite ? ` · limite ${brlCurto(c.limite)}` : ''}</div></div>
      <button class="btn pequeno" data-editar-cartao="${c.id}"><i data-lucide="pencil"></i>Editar</button><button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>
      <div class="corpo fin-faturas">${lista.map((f) => `<section class="fin-fatura ${f.mes === ab.mes ? 'atual' : ''}">
        <div class="ff-cab"><span><b>${MESES[+f.mes.split('-')[1] - 1]}</b> ${f.mes.slice(0, 4)}<small>${f.mes === ab.mes ? 'aberta · ' : f.vence < PS.hoje ? 'já venceu · ' : 'próxima · '}vence ${dm(f.vence)}</small></span><b>${brl(f.total)}</b></div>
        ${f.itens.length ? `<ul>${f.itens.map((p) => `<li><span>${dm(p.data)} · ${descGasto(p)}${p.de > 1 ? ` <small>${p.n}/${p.de}</small>` : ''}</span><b>${brl(p.valorParcela)}</b></li>`).join('')}</ul>` : '<p class="fin-nota">Nada lançado nesse cartão ainda.</p>'}
      </section>`).join('')}
      <p class="fin-nota">Entra aqui o que foi lançado com este cartão: compras e clubes de pontos (na entrada de pontos) e taxas ou passagens (na emissão).</p></div>`;
    dlg.querySelector('[data-editar-cartao]').onclick = () => { KVShell.irPara({ janela: 'cartao-form', c: c.id }); sinc(); };
  }
  function janelaForm(c) {
    const v = c || { nome: '', final: '', fecha: '', vence: '', limite: null, ativo: 1 };
    dlg.innerHTML = `<header><div style="flex:1"><h2>${c ? 'Editar cartão' : 'Novo cartão'}</h2><div class="sub">O dia em que a fatura fecha decide em qual fatura cai cada gasto.</div></div><button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>
      <form class="form-j" novalidate><div class="corpo">
        <div class="campo"><label for="c-nome">Nome</label><input id="c-nome" maxlength="60" autocomplete="off" placeholder="ex.: Nubank do dono" value="${esc(v.nome)}"></div>
        <div class="fin-form-2">
          <div class="campo"><label for="c-final">Final</label><input id="c-final" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="4321" value="${esc(v.final)}"></div>
          <div class="campo"><label for="c-limite">Limite (opcional)</label><div class="caixa"><span>R$</span><input id="c-limite" inputmode="decimal" autocomplete="off" placeholder="0" value="${v.limite ? (v.limite / 100).toLocaleString('pt-BR') : ''}"></div></div>
          <div class="campo"><label for="c-fecha">Fatura fecha dia</label><input id="c-fecha" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="3" value="${v.fecha}"></div>
          <div class="campo"><label for="c-vence">Fatura vence dia</label><input id="c-vence" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="10" value="${v.vence}"></div>
        </div>
        ${c ? `<label class="check"><input type="checkbox" id="c-ativo" ${v.ativo ? 'checked' : ''}><span>Cartão em uso<small>Desmarque se a K&V parou de usar. Os gastos antigos continuam aparecendo.</small></span></label>` : ''}
      </div><footer><button type="button" class="btn" data-x>Voltar</button><button class="btn primario" type="submit"><i data-lucide="check"></i>${c ? 'Salvar' : 'Cadastrar cartão'}</button></footer></form>`;
    dlg.querySelector('form').onsubmit = async (ev) => {
      ev.preventDefault();
      const q = (id) => dlg.querySelector('#' + id);
      const dados = { nome: q('c-nome').value, final: q('c-final').value, fecha: +q('c-fecha').value, vence: +q('c-vence').value, limite: O.lerReais(q('c-limite').value) };
      if (c) { dados.id = c.id; dados.ativo = q('c-ativo').checked; }
      try {
        await KVApi.acao('cartao.salvar', dados);
        await KV.carregar();
        KVShell.aviso(c ? 'Cartão salvo' : 'Cartão cadastrado');
        // volta pra lista (desfaz o passo do formulário) e redesenha
        KVShell.desfazer({ janela: 1, c: 1 }, () => { render(); sinc(); });
      } catch (err) { KVShell.aviso(err.message, { erro: true }); }
    };
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
      ${cartoesHtml()}
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
      custos = fin.custos; gastos = fin.gastos; orcs = lista;
      document.querySelector('.carregando').remove();
      app = KVShell.montar('financeiro', { dono: true });
      app.addEventListener('click', (e) => {
        if (e.target.closest('[data-novo-cartao]')) { abrirJ('cartao-form', null); return; }
        const ca = e.target.closest('[data-cartao]');
        if (ca) { abrirJ('cartao', ca.dataset.cartao); return; }
        const b = e.target.closest('[data-mes]');
        if (b) { KVShell.irPara({ mes: b.dataset.mes === ESTE ? null : b.dataset.mes }); render(); return; }
        const tr = e.target.closest('tr[data-ir]');
        if (tr && !e.target.closest('a')) KVRota.trocar(tr.dataset.ir);
      });
      app.addEventListener('keydown', (e) => { const ca = e.target.closest('[data-cartao]'); if (ca && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirJ('cartao', ca.dataset.cartao); } });
      render();
      sinc();
      KVShell.aoVoltar(() => { render(); sinc(); });
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.textContent = e.message; }
  })();
};

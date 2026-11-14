/* Cartões de crédito da K&V: em qual fatura cai cada gasto e quanto tem em cada fatura.
   Regra: gasto antes do dia em que o cartão fecha entra na fatura que fecha nesse mês; no dia ou depois, na do mês seguinte.
   A fatura vence no mesmo mês em que fecha se o dia de vencer for depois do dia de fechar; senão, no mês seguinte.
   Parcelado: cada parcela cai na fatura de um mês, a partir da primeira. Datas em AAAA-MM-DD; dinheiro em centavos. */
(function () {
  const pad = (n) => String(n).padStart(2, '0');
  // dia D do mês (ano, mês 1-12 + n), sem passar do último dia do mês (dia 31 em fevereiro vira 28/29)
  const diaDoMes = (a, m, d) => { const x = new Date(Date.UTC(a, m - 1, 1)); const ultimo = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate(); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(Math.min(d, ultimo))}`; };

  // a fatura em que cai a parcela i (0 = primeira) de um gasto feito no dia `data`
  function fatura(cartao, data, i = 0) {
    const [a, m, d] = data.split('-').map(Number);
    const mesFecha = m + (d >= cartao.fecha ? 1 : 0) + i;
    const fecha = diaDoMes(a, mesFecha, cartao.fecha);
    const vence = diaDoMes(a, mesFecha + (cartao.vence > cartao.fecha ? 0 : 1), cartao.vence);
    return { mes: vence.slice(0, 7), fecha, vence };
  }

  // gastos → parcelas, cada uma com a fatura onde cai. A última parcela leva o que sobra da divisão.
  function parcelas(cartao, gastos) {
    return gastos.filter((g) => g.cartao_id === cartao.id).flatMap((g) => {
      const n = g.parcelas || 1, base = Math.floor(g.valor / n);
      return Array.from({ length: n }, (_, i) => ({ ...g, n: i + 1, de: n, valorParcela: i === n - 1 ? g.valor - base * (n - 1) : base, ...fatura(cartao, g.data, i) }));
    });
  }
  // faturas do cartão, da mais antiga pra mais nova: { mes, fecha, vence, total, itens }
  function faturas(cartao, gastos) {
    const por = new Map();
    parcelas(cartao, gastos).forEach((p) => {
      const f = por.get(p.mes) || { mes: p.mes, fecha: p.fecha, vence: p.vence, total: 0, itens: [] };
      f.total += p.valorParcela; f.itens.push(p); por.set(p.mes, f);
    });
    return [...por.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  }
  // a fatura que ainda está aberta hoje (a primeira que fecha depois de hoje), mesmo se não tiver gasto
  function aberta(cartao, gastos, hoje) {
    const f = fatura(cartao, hoje);
    return faturas(cartao, gastos).find((x) => x.mes === f.mes) || { ...f, total: 0, itens: [] };
  }
  // quanto do limite está usado: tudo o que vence de hoje em diante
  const usado = (cartao, gastos, hoje) => faturas(cartao, gastos).filter((f) => f.vence >= hoje).reduce((s, f) => s + f.total, 0);

  window.KVCartoes = { fatura, parcelas, faturas, aberta, usado };

  // conferência rápida da regra (roda uma vez ao carregar; erro aparece no console)
  const c = { id: 1, fecha: 3, vence: 10 }, c2 = { id: 2, fecha: 25, vence: 5 };
  const conf = [
    [fatura(c, '2026-11-02').vence, '2026-11-10'], [fatura(c, '2026-11-03').vence, '2026-12-10'],
    [fatura(c, '2026-12-20', 1).vence, '2027-02-10'], [fatura(c2, '2026-11-24').vence, '2026-12-05'],
    [fatura({ id: 3, fecha: 31, vence: 7 }, '2027-02-10').fecha, '2027-02-28'],
    [faturas(c, [{ cartao_id: 1, data: '2026-11-01', valor: 1000, parcelas: 3 }]).map((f) => f.total).join(), '333,333,334'],
  ];
  conf.forEach(([tem, quer], i) => { if (tem !== quer) console.error(`KVCartoes: conferência ${i} deu ${tem}, esperado ${quer}`); });
})();

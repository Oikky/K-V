/* Ponto dos pesquisadores nas telas: carrega do servidor e entrega no mesmo formato dos rascunhos (KV.ponto).
   O pesquisador corrige o próprio ponto (o trecho fica marcado com a hora original e o dono vê);
   o dono marca a semana como paga e muda o valor da hora (vale a partir do dia da mudança).
   Os pesquisadores são identificados pelo e-mail. Dinheiro na tela em reais (o servidor guarda centavos). Precisa de api.js. */
(function () {
  const JORNADA = 240; // minutos de referência por dia (4h)
  const agora = () => new Date();
  const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const inicioDoDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const segunda = (d) => { const x = inicioDoDia(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const pad = (n) => String(n).padStart(2, '0');
  const isoDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let pesquisadores = [], trechos = {}, pagamentos = [];

  async function carregar() {
    const d = await KVApi.ponto();
    pesquisadores = d.pesquisadores.map((p) => ({ id: p.email, nome: p.nome, valores: p.valores.map((v) => ({ desde: v.desde, valor: v.valor / 100 })) }));
    trechos = Object.fromEntries(pesquisadores.map((p) => [p.id, []]));
    d.trechos.forEach((t) => {
      (trechos[t.email] ||= []).push({
        id: t.id, pid: t.email, inicio: new Date(t.inicio), fim: t.fim ? new Date(t.fim) : null, manual: t.manual,
        original: t.original_inicio ? { inicio: new Date(t.original_inicio), fim: t.original_fim ? new Date(t.original_fim) : null } : null,
        corrigidoEm: t.corrigido_em ? new Date(t.corrigido_em) : null,
      });
    });
    pagamentos = d.pagamentos.map((p) => ({ pid: p.email, semana: p.semana, valor: p.valor / 100, data: p.data }));
  }

  // ---------- contas (iguais às dos rascunhos) ----------
  const pesquisador = (pid) => pesquisadores.find((p) => p.id === pid);
  const valorHora = (pid, quando = agora()) => {
    const p = pesquisador(pid); if (!p || !p.valores.length) return 0;
    const vs = p.valores.filter((v) => new Date(v.desde + 'T00:00') <= quando);
    return (vs[vs.length - 1] || p.valores[0]).valor;
  };
  const fimEfetivo = (t) => t.fim || agora();
  const minutosEntre = (a, b) => Math.max(0, (b - a) / 60000);
  const duracao = (t) => minutosEntre(t.inicio, fimEfetivo(t));
  const ganhoTrecho = (t) => duracao(t) / 60 * valorHora(t.pid, t.inicio);
  const lista = (pid) => trechos[pid] || [];

  function dia(pid, data) {
    const ini = inicioDoDia(data), fim = addDias(ini, 1);
    const ts = lista(pid).filter((t) => t.inicio < fim && fimEfetivo(t) > ini);
    let minutos = 0, ganho = 0;
    ts.forEach((t) => {
      const m = minutosEntre(new Date(Math.max(t.inicio, ini)), new Date(Math.min(fimEfetivo(t), fim)));
      minutos += m; ganho += m / 60 * valorHora(pid, t.inicio);
    });
    const hojeIso = isoDia(agora());
    return { data: isoDia(ini), date: ini, trechos: ts, minutos, ganho, hoje: isoDia(ini) === hojeIso, futuro: isoDia(ini) > hojeIso };
  }

  function semana(pid, offset = 0) {
    const ini = addDias(segunda(agora()), offset * 7);
    const dias = Array.from({ length: 7 }, (_, i) => dia(pid, addDias(ini, i)));
    const minutos = dias.reduce((s, d) => s + d.minutos, 0);
    const ganho = dias.reduce((s, d) => s + d.ganho, 0);
    let previsao = null, minutosPrevistos = null;
    if (offset === 0) {
      const hoje = dias.find((d) => d.hoje);
      const resta = Math.max(0, JORNADA - hoje.minutos) + dias.filter((d) => d.futuro).length * JORNADA;
      minutosPrevistos = minutos + resta;
      previsao = ganho + resta / 60 * valorHora(pid);
    }
    const inicio = isoDia(ini), fim = isoDia(addDias(ini, 6));
    const correcoes = lista(pid).filter((t) => (t.original || t.manual) && isoDia(t.inicio) >= inicio && isoDia(t.inicio) <= fim);
    return {
      pid, offset, inicio, fim, dias, minutos, ganho, previsao, minutosPrevistos, correcoes,
      atual: offset === 0, pagamento: pagamentos.find((p) => p.pid === pid && p.semana === inicio) || null,
    };
  }

  const fmtPonto = {
    dur: (min) => { const m = Math.floor(min); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${pad(r)}min` : `${h}h`) : `${r}min`; },
    durCurta: (min) => { const m = Math.floor(min); const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${r ? pad(r) : ''}` : `${r}min`; },
    relogio: (min) => { const s = Math.floor(min * 60); return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; },
    hora: (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    diaSemana: (d) => ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d.getDay()],
    diaCurto: (d) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()],
    dataCurta: (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
    isoDia, inicioDoDia, addDias,
    // "14/10 14:02" ou só "14:02" se for no mesmo dia de referência
    quando: (d, ref) => (ref && isoDia(d) === isoDia(ref) ? '' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} `) + `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
  // grava no servidor e recarrega tudo (a tela sempre mostra o que está salvo)
  const gravar = async (acao, dados) => { const r = await KVApi.acao(acao, dados); await carregar(); return r; };

  window.KV = window.KV || {};
  window.KV.fmt = { brl: (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) };
  window.KV.ponto = {
    carregar, agora, jornada: JORNADA, get pesquisadores() { return pesquisadores; }, pesquisador, valorHora, dia, semana, duracao, ganhoTrecho, fmt: fmtPonto,
    trechos: lista,
    trecho: (pid, id) => lista(pid).find((t) => t.id === +id),
    rodando: (pid) => lista(pid).find((t) => !t.fim) || null,
    semanas: (pid, n = 5) => Array.from({ length: n }, (_, i) => semana(pid, -i)),
    iniciar: () => gravar('ponto.iniciar'),
    pausar: () => gravar('ponto.pausar'),
    corrigir: (pid, id, inicio, fim) => gravar('ponto.corrigir', { id: +id, inicio: inicio.toISOString(), fim: fim.toISOString() }),
    lancar: (pid, inicio, fim) => gravar('ponto.lancar', { inicio: inicio.toISOString(), fim: fim.toISOString() }),
    sobrepoe: (pid, id, inicio, fim) => lista(pid).filter((t) => t.id !== +id && t.inicio < fim && fimEfetivo(t) > inicio),
    marcarPago: (pid, semanaIni, valor, data) => gravar('ponto.pagar', { email: pid, semana: semanaIni, valor: Math.round(valor * 100), data }),
    desfazerPago: (pid, semanaIni) => gravar('ponto.despagar', { email: pid, semana: semanaIni }),
    definirValor: (pid, valor) => gravar('ponto.valorHora', { email: pid, valor: Math.round(valor * 100) }),
    // semanas fechadas com horas e sem pagamento
    aPagar: () => pesquisadores.flatMap((p) => [1, 2, 3, 4].map((i) => semana(p.id, -i))).filter((s) => s.minutos > 0 && !s.pagamento),
  };
})();

/* RASCUNHO DESCARTÁVEL: dados fictícios do ponto dos pesquisadores.
   Todo acesso passa por KV.ponto (como em dados.js), pra trocar por um backend depois.
   Regras combinadas em 2026-10-16:
   - o pesquisador corrige o próprio ponto; o trecho fica marcado com a hora original e o dono vê;
   - o dono marca a semana como paga (data e valor) e o pesquisador vê "Paga em ...".
   Cenários pra testar: ?cenario=esqueceu (cronômetro ligado desde ontem). */
(function () {
  const cenario = new URLSearchParams(location.search).get('cenario') || 'normal';
  // "agora" fictício que anda junto com o relógio de verdade: quinta, 15/10/2026, 15:20
  const BASE = new Date('2026-10-15T15:20:00');
  const carregou = Date.now();
  const agora = () => new Date(BASE.getTime() + (Date.now() - carregou));
  const JORNADA = 240; // minutos de referência por dia (4h)

  let semente = 41016;
  const rnd = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const addMin = (d, n) => new Date(d.getTime() + n * 60000);
  const inicioDoDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const segunda = (d) => { const x = inicioDoDia(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const pad = (n) => String(n).padStart(2, '0');
  const isoDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const em = (dia, h, m) => { const x = inicioDoDia(dia); x.setHours(h, m, 0, 0); return x; };

  const pesquisadores = [
    { id: 'p1', nome: 'Ana Ribeiro', valores: [{ desde: '2026-01-01', valor: 4.16 }] },
    { id: 'p2', nome: 'Lucas Ferreira', valores: [{ desde: '2026-01-01', valor: 4.16 }, { desde: '2026-09-01', valor: 4.5 }] },
  ];
  const trechos = { p1: [], p2: [] };
  const pagamentos = [];
  let nT = 0;
  const novo = (pid, inicio, fim, extra) => { const t = { id: 't' + (++nT), pid, inicio, fim, ...extra }; trechos[pid].push(t); return t; };

  // ---------- geração: 5 semanas, de segunda 14/09 até ontem ----------
  const SEG0 = segunda(BASE);
  const HOJE0 = inicioDoDia(BASE);
  pesquisadores.forEach((p, pi) => {
    for (let w = -4; w <= 0; w++) {
      for (let dia = 0; dia < 7; dia++) {
        const data = addDias(SEG0, w * 7 + dia);
        if (data >= HOJE0 || rnd() < 0.3) continue;
        let ini = em(data, 9 + Math.floor(rnd() * 4) + pi * 2, pick([0, 5, 10, 15, 20, 30, 40, 45, 50]));
        const blocos = rnd() < 0.55 ? 2 : 1;
        for (let b = 0; b < blocos; b++) {
          const dur = Math.round((blocos === 2 ? 70 + rnd() * 90 : 150 + rnd() * 110) / 5) * 5;
          const fim = addMin(ini, dur);
          novo(p.id, ini, fim);
          ini = addMin(fim, Math.round((40 + rnd() * 80) / 5) * 5);
        }
      }
    }
  });
  const limparDia = (pid, data) => { trechos[pid] = trechos[pid].filter((t) => isoDia(t.inicio) !== data); };

  // Ana, terça 13/10: esqueceu ligado e corrigiu no dia seguinte (o dono vê a hora original)
  limparDia('p1', '2026-10-13');
  novo('p1', new Date('2026-10-13T10:00'), new Date('2026-10-13T12:05'));
  novo('p1', new Date('2026-10-13T15:00'), new Date('2026-10-13T18:30'),
    { original: { inicio: new Date('2026-10-13T15:00'), fim: new Date('2026-10-14T01:47') }, corrigidoEm: new Date('2026-10-14T09:12') });
  // Lucas, semana passada: uma correção e um trecho lançado à mão (esqueceu de ligar)
  limparDia('p2', '2026-10-07'); limparDia('p2', '2026-10-08');
  novo('p2', new Date('2026-10-07T13:00'), new Date('2026-10-07T16:20'), { manual: true, corrigidoEm: new Date('2026-10-07T16:25') });
  novo('p2', new Date('2026-10-08T11:30'), new Date('2026-10-08T15:10'),
    { original: { inicio: new Date('2026-10-08T11:30'), fim: new Date('2026-10-08T22:58') }, corrigidoEm: new Date('2026-10-09T10:02') });

  // hoje
  if (cenario === 'esqueceu') {
    limparDia('p1', '2026-10-14');
    novo('p1', new Date('2026-10-14T14:02'), null);
  } else {
    novo('p1', new Date('2026-10-15T09:10'), new Date('2026-10-15T11:30'));
    novo('p1', new Date('2026-10-15T14:05'), null);
  }
  novo('p2', new Date('2026-10-15T10:00'), new Date('2026-10-15T12:40'));
  Object.values(trechos).forEach((l) => l.sort((a, b) => a.inicio - b.inicio));

  // ---------- contas ----------
  const pesquisador = (pid) => pesquisadores.find((p) => p.id === pid);
  const valorHora = (pid, quando = agora()) => {
    const vs = pesquisador(pid).valores.filter((v) => new Date(v.desde + 'T00:00') <= quando);
    return (vs[vs.length - 1] || pesquisador(pid).valores[0]).valor;
  };
  const fimEfetivo = (t) => t.fim || agora();
  const minutosEntre = (a, b) => Math.max(0, (b - a) / 60000);
  const duracao = (t) => minutosEntre(t.inicio, fimEfetivo(t));
  const ganhoTrecho = (t) => duracao(t) / 60 * valorHora(t.pid, t.inicio);

  function dia(pid, data) {
    const ini = inicioDoDia(data), fim = addDias(ini, 1);
    const ts = trechos[pid].filter((t) => t.inicio < fim && fimEfetivo(t) > ini);
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
    const correcoes = trechos[pid].filter((t) => (t.original || t.manual) && isoDia(t.inicio) >= inicio && isoDia(t.inicio) <= fim);
    return {
      pid, offset, inicio, fim, dias, minutos, ganho, previsao, minutosPrevistos, correcoes,
      atual: offset === 0, pagamento: pagamentos.find((p) => p.pid === pid && p.semana === inicio) || null,
    };
  }

  // semanas já fechadas: pagas, de 4 semanas atrás até a retrasada; a passada só a da Ana
  pesquisadores.forEach((p) => {
    for (let w = -4; w <= -1; w++) {
      if (w === -1 && p.id === 'p2') continue;
      const s = semana(p.id, w);
      const pagoEm = isoDia(addDias(new Date(s.fim + 'T12:00'), w === -1 ? 2 : 1));
      pagamentos.push({ pid: p.id, semana: s.inicio, valor: Math.round(s.ganho * 100) / 100, data: pagoEm });
    }
  });

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

  window.KV = window.KV || {};
  window.KV.ponto = {
    cenario, agora, jornada: JORNADA, pesquisadores, pesquisador, valorHora, dia, semana, duracao, ganhoTrecho, fmt: fmtPonto,
    trechos: (pid) => trechos[pid],
    trecho: (pid, id) => trechos[pid].find((t) => t.id === id),
    rodando: (pid) => trechos[pid].find((t) => !t.fim) || null,
    semanas: (pid, n = 5) => Array.from({ length: n }, (_, i) => semana(pid, -i)),
    iniciar: (pid) => novo(pid, agora(), null),
    pausar: (pid) => { const t = trechos[pid].find((x) => !x.fim); if (t) t.fim = agora(); return t; },
    corrigir: (pid, id, inicio, fim) => {
      const t = trechos[pid].find((x) => x.id === id);
      if (!t.original && !t.manual) t.original = { inicio: t.inicio, fim: t.fim };
      Object.assign(t, { inicio, fim, corrigidoEm: agora() });
      trechos[pid].sort((a, b) => a.inicio - b.inicio);
      return t;
    },
    lancar: (pid, inicio, fim) => { const t = novo(pid, inicio, fim, { manual: true, corrigidoEm: agora() }); trechos[pid].sort((a, b) => a.inicio - b.inicio); return t; },
    sobrepoe: (pid, id, inicio, fim) => trechos[pid].filter((t) => t.id !== id && t.inicio < fim && fimEfetivo(t) > inicio),
    marcarPago: (pid, semanaIni, valor, data) => { pagamentos.push({ pid, semana: semanaIni, valor, data }); },
    desfazerPago: (pid, semanaIni) => { const i = pagamentos.findIndex((p) => p.pid === pid && p.semana === semanaIni); if (i >= 0) pagamentos.splice(i, 1); },
    definirValor: (pid, valor) => { const p = pesquisador(pid); const hoje = isoDia(agora()); p.valores = p.valores.filter((v) => v.desde !== hoje); p.valores.push({ desde: hoje, valor }); },
    // semanas fechadas com horas e sem pagamento
    aPagar: () => pesquisadores.flatMap((p) => [1, 2, 3, 4].map((i) => semana(p.id, -i))).filter((s) => s.minutos > 0 && !s.pagamento),
  };
})();

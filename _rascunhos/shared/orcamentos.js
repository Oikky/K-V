/* RASCUNHO DESCARTÁVEL: orçamentos fictícios, com trechos, lista de conferência e opções de voo.
   Todo acesso passa por KV.orc. "Agora" = quinta, 15/10/2026, 15:20 (igual ao ponto).
   Suposições (ver PERGUNTAS-PRO-DONO.md): milhas, taxa e preço são por pessoa; bebê não entra na conta. */
(function () {
  const AGORA = new Date('2026-10-15T15:20:00');
  let semente = 81026;
  const rnd = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
  const int = (a, b) => Math.floor(a + rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const pad = (n) => String(n).padStart(2, '0');
  const isoDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const addMin = (d, n) => new Date(d.getTime() + n * 60000);
  const dia = (s) => new Date(s + 'T12:00:00');

  const AEROPORTOS = [
    ['GRU', 'São Paulo (Guarulhos)'], ['CGH', 'São Paulo (Congonhas)'], ['VCP', 'Campinas'], ['GIG', 'Rio de Janeiro (Galeão)'], ['SDU', 'Rio de Janeiro (Santos Dumont)'],
    ['BSB', 'Brasília'], ['CNF', 'Belo Horizonte (Confins)'], ['SSA', 'Salvador'], ['REC', 'Recife'], ['FOR', 'Fortaleza'], ['POA', 'Porto Alegre'], ['CWB', 'Curitiba'],
    ['FLN', 'Florianópolis'], ['GYN', 'Goiânia'], ['MAO', 'Manaus'], ['BEL', 'Belém'], ['NAT', 'Natal'], ['MCZ', 'Maceió'], ['IGU', 'Foz do Iguaçu'],
    ['LIS', 'Lisboa'], ['OPO', 'Porto'], ['MAD', 'Madri'], ['BCN', 'Barcelona'], ['CDG', 'Paris'], ['FCO', 'Roma'], ['LHR', 'Londres'], ['FRA', 'Frankfurt'], ['AMS', 'Amsterdã'],
    ['MIA', 'Miami'], ['MCO', 'Orlando'], ['JFK', 'Nova York'], ['EZE', 'Buenos Aires'], ['SCL', 'Santiago'], ['LIM', 'Lima'], ['CUN', 'Cancún'], ['PTY', 'Cidade do Panamá'], ['DXB', 'Dubai'],
  ].map(([cod, cidade]) => ({ cod, cidade, int: !['GRU', 'CGH', 'VCP', 'GIG', 'SDU', 'BSB', 'CNF', 'SSA', 'REC', 'FOR', 'POA', 'CWB', 'FLN', 'GYN', 'MAO', 'BEL', 'NAT', 'MCZ', 'IGU'].includes(cod) }));
  const aeroporto = (cod) => AEROPORTOS.find((a) => a.cod === cod) || { cod, cidade: cod, int: false };
  const cidadeCurta = (cod) => aeroporto(cod).cidade.replace(/ \(.*\)/, '');

  // site → como paga e de qual programa sai a milha
  const SITES = [
    { id: 'Smiles', forma: 'pontos', programa: 'smiles' }, { id: 'Latam', forma: 'pontos', programa: 'latam' },
    { id: 'TudoAzul', forma: 'pontos', programa: 'azul' }, { id: 'Interline', forma: 'pontos', programa: 'azul' },
    { id: 'Skyscanner', forma: 'dinheiro', programa: null },
  ];
  const site = (id) => SITES.find((s) => s.id === id);
  const CIAS = { Smiles: ['GOL', 'Air France', 'KLM', 'Aerolíneas'], Latam: ['LATAM', 'Iberia', 'American'], TudoAzul: ['Azul'], Interline: ['TAP', 'United', 'Copa'], Skyscanner: ['LATAM', 'GOL', 'Azul', 'TAP', 'Iberia', 'Copa'] };
  const SIGLA = { GOL: 'G3', 'Air France': 'AF', KLM: 'KL', 'Aerolíneas': 'AR', LATAM: 'LA', Iberia: 'IB', American: 'AA', Azul: 'AD', TAP: 'TP', United: 'UA', Copa: 'CM' };

  const PESQUISADORES = { p1: 'Ana Ribeiro', p2: 'Lucas Ferreira' };
  const ETAPAS = [
    { id: 'novo', nome: 'Novo', aberta: true }, { id: 'pesquisa', nome: 'Em pesquisa', aberta: true },
    { id: 'pesquisado', nome: 'Pesquisado', aberta: true }, { id: 'enviado', nome: 'Enviado', aberta: true },
    { id: 'fechado', nome: 'Fechado', aberta: true }, { id: 'emitido', nome: 'Emitido', aberta: false },
    { id: 'perdido', nome: 'Perdido', aberta: false }, { id: 'cancelado', nome: 'Cancelado', aberta: false },
  ];
  const CONFERENCIA_PADRAO = ['Janela de 14 dias pesquisada', 'Bagagem conferida', 'Link de cada preço', 'Pontos e dinheiro pesquisados'];

  // ---------- geração ----------
  const clientes = KV.pessoas ? KV.pessoas.lista().filter((p) => p.whatsapp) : [];
  const NOVOS = ['Rogério Antunes', 'Patrícia Lemos', 'Sandra Vieira', 'Otávio Pimentel', 'Larissa Couto', 'Márcio Dantas', 'Helena Brito', 'Caio Mendonça', 'Tânia Rocha', 'Igor Batista', 'Renan Moraes', 'Débora Faria', 'Silvio Leão', 'Aline Prestes'];
  const fone = () => `(${pick(['11', '21', '31', '41', '61', '62', '71', '81'])}) 9${int(1000, 9999)}-${int(1000, 9999)}`;
  const PEDIDOS = [['Só voo direto'], ['Só pontos'], ['Com bagagem despachada'], ['Saída de manhã'], ['Até 1 escala', 'Com bagagem despachada'], [], [], [], []];
  const ROTEIROS = [
    [['GRU', 'LIS'], ['LIS', 'GRU']], [['GRU', 'MCO'], ['MCO', 'GRU']], [['GIG', 'MIA'], ['MIA', 'GIG']], [['GRU', 'SCL'], ['SCL', 'GRU']],
    [['POA', 'EZE'], ['EZE', 'POA']], [['BSB', 'SSA'], ['SSA', 'BSB']], [['CNF', 'FOR'], ['FOR', 'CNF']], [['GRU', 'REC']],
    [['GRU', 'MAD'], ['MAD', 'CDG'], ['CDG', 'FCO'], ['FCO', 'GRU']], [['GYN', 'GIG'], ['GIG', 'GYN']], [['GRU', 'CUN'], ['CUN', 'GRU']],
    [['CWB', 'FLN']], [['GRU', 'LHR'], ['LHR', 'AMS'], ['AMS', 'GRU']], [['REC', 'LIS'], ['OPO', 'REC']],
  ];
  const PLANO = ['novo', 'novo', 'novo', 'novo', 'pesquisa', 'pesquisa', 'pesquisa', 'pesquisa', 'pesquisado', 'pesquisado', 'pesquisado',
    'enviado', 'enviado', 'enviado', 'enviado', 'fechado', 'fechado', 'emitido', 'emitido', 'emitido', 'perdido', 'perdido', 'perdido', 'cancelado'];

  const orcamentos = [];
  let nOp = 0;
  function gerarOpcoes(o, quantas) {
    o.trechos.forEach((t, ti) => {
      const intl = aeroporto(t.de).int || aeroporto(t.para).int;
      const janela = janelaDias(t);
      for (let k = 0; k < quantas; k++) {
        const s = pick(intl ? ['Smiles', 'Latam', 'Interline', 'Skyscanner', 'Smiles'] : ['Smiles', 'Latam', 'TudoAzul', 'Skyscanner']);
        const d = pick(janela);
        const sai = new Date(d + 'T00:00'); sai.setHours(int(5, 22), pick([0, 10, 15, 25, 30, 40, 45, 55]));
        const escalas = intl ? pick([0, 1, 1, 2]) : pick([0, 0, 1]);
        const dur = (intl ? int(560, 840) : int(70, 200)) + escalas * int(70, 190);
        const cia = pick(CIAS[s]);
        const op = {
          id: 'op' + (++nOp), trecho: ti, site: s, data: d, sai: `${pad(sai.getHours())}:${pad(sai.getMinutes())}`, chega: (() => { const c = addMin(sai, dur); return `${pad(c.getHours())}:${pad(c.getMinutes())}${isoDia(c) !== d ? ' +1' : ''}`; })(),
          cia, voo: `${SIGLA[cia]} ${int(100, 9899)}`, escalas, bagagem: rnd() < 0.55,
          milhas: null, taxa: null, preco: null, link: `https://exemplo.invalid/${s.toLowerCase()}/${nOp}`, obs: '',
          por: o.responsavel || 'p1', em: isoDia(AGORA),
        };
        if (site(s).forma === 'pontos') { op.milhas = Math.round((intl ? int(55, 190) : int(7, 38)) * 1000 / 500) * 500; op.taxa = intl ? int(280, 1450) + 0.9 : int(28, 95) + 0.9; }
        else op.preco = (intl ? int(2900, 9800) : int(380, 1900)) + 0.9;
        o.opcoes.push(op);
      }
    });
  }
  // janela de datas: semana do dia pedido + semana seguinte (14 dias a partir da segunda)
  function janelaDias(t) {
    if (!t.janela) return [t.data];
    const d = dia(t.data); const seg = addDias(d, -((d.getDay() + 6) % 7));
    return Array.from({ length: 14 }, (_, i) => isoDia(addDias(seg, i)));
  }

  PLANO.forEach((etapa, i) => {
    const usarCliente = clientes.length && (['enviado', 'fechado', 'emitido'].includes(etapa) ? rnd() < 0.7 : rnd() < 0.3);
    const cli = usarCliente ? clientes[i % clientes.length] : null;
    const contato = cli ? { nome: cli.nome, whatsapp: cli.whatsapp } : { nome: NOVOS[i % NOVOS.length], whatsapp: fone() };
    const roteiro = ROTEIROS[(i * 5) % ROTEIROS.length];
    const criado = addMin(AGORA, -int(30, 60 * 24 * (etapa === 'novo' ? 2 : etapa === 'pesquisa' ? 4 : 25)));
    let data = addDias(criado, int(25, 150));
    const trechos = roteiro.map(([de, para], k) => { if (k) data = addDias(data, int(3, 9)); return { de, para, data: isoDia(data), janela: rnd() < 0.8 }; });
    const pedido = pick(PEDIDOS);
    const responsavel = etapa === 'novo' ? (i === 3 ? 'p2' : null) : pick(['p1', 'p2']);
    const o = {
      id: 'o' + (101 + i), numero: 101 + i, contato, pessoaId: cli ? cli.id : null, criadoEm: criado, etapa, responsavel,
      trechos, passageiros: { adultos: pick([1, 2, 2, 2, 3, 4]), criancas: pick([0, 0, 0, 1, 2]), bebes: pick([0, 0, 0, 0, 1]) },
      pedido: pedido.join(' · '),
      conferencia: [...CONFERENCIA_PADRAO, ...pedido].map((texto, k) => ({ id: 'c' + k, texto, feito: false })),
      opcoes: [], historico: [{ quando: criado, quem: 'Dono', texto: 'Criou o orçamento' }],
    };
    if (etapa === 'novo' && responsavel) o.historico.push({ quando: addMin(criado, 5), quem: 'Dono', texto: `Passou pra ${PESQUISADORES[responsavel]}` });
    if (etapa !== 'novo') {
      o.historico.push({ quando: addMin(criado, int(10, 240)), quem: PESQUISADORES[responsavel], texto: 'Pegou o orçamento' });
      gerarOpcoes(o, etapa === 'pesquisa' ? int(1, 4) : int(4, 8));
      const feitos = etapa === 'pesquisa' ? int(0, 2) : o.conferencia.length - (rnd() < 0.25 ? 1 : 0);
      o.conferencia.forEach((c, k) => { c.feito = k < feitos; });
    }
    if (!['novo', 'pesquisa'].includes(etapa)) o.historico.push({ quando: addMin(criado, int(300, 900)), quem: PESQUISADORES[responsavel], texto: 'Marcou como pesquisado' });
    if (['enviado', 'fechado', 'emitido', 'perdido', 'cancelado'].includes(etapa)) o.historico.push({ quando: addMin(criado, int(1000, 2000)), quem: 'Dono', texto: 'Enviou a proposta' });
    if (etapa === 'perdido') { o.motivo = pick(['Achou mais barato em outro lugar', 'Desistiu da viagem', 'Não respondeu mais']); o.historico.push({ quando: addMin(criado, 4000), quem: 'Dono', texto: 'Marcou como perdido: ' + o.motivo }); }
    orcamentos.push(o);
  });
  // a mesma pessoa pedindo de novo: um contato de um orçamento perdido volta como novo
  const perdido = orcamentos.find((o) => o.etapa === 'perdido'), novo = orcamentos.find((o) => o.etapa === 'novo' && !o.pessoaId);
  if (perdido && novo) novo.contato = { ...perdido.contato };
  orcamentos.forEach((o) => o.historico.sort((a, b) => a.quando - b.quando));

  // ---------- contas ----------
  const pagantes = (o) => o.passageiros.adultos + o.passageiros.criancas;
  const valorMilha = (programa) => (KV.programa(programa) || {}).valorMilha || 0;
  // custo pra K&V (só o dono vê): milhas × valor da milha + taxa, ou preço em dinheiro; por pessoa × pagantes
  const custoPessoa = (op) => site(op.site).forma === 'pontos' ? op.milhas * valorMilha(site(op.site).programa) + op.taxa : op.preco;
  const custo = (op, o) => custoPessoa(op) * pagantes(o);
  const etapa = (id) => ETAPAS.find((e) => e.id === id);
  const idade = (d) => { const m = Math.round((AGORA - d) / 60000); if (m < 60) return `há ${m} min`; const h = Math.round(m / 60); if (h < 24) return `há ${h}h`; const dd = Math.round(h / 24); return dd === 1 ? 'ontem' : `há ${dd} dias`; };
  const fmtPax = (p) => [p.adultos && `${p.adultos} ${p.adultos > 1 ? 'adultos' : 'adulto'}`, p.criancas && `${p.criancas} ${p.criancas > 1 ? 'crianças' : 'criança'}`, p.bebes && `${p.bebes} ${p.bebes > 1 ? 'bebês' : 'bebê'}`].filter(Boolean).join(', ');
  const rota = (o) => { const cods = [o.trechos[0].de]; o.trechos.forEach((t) => { if (cods[cods.length - 1] !== t.de) cods.push('…', t.de); cods.push(t.para); }); return cods.join(' → '); };
  const destino = (o) => { const ult = o.trechos[o.trechos.length - 1]; const volta = ult.para === o.trechos[0].de; const alvo = volta && o.trechos.length > 1 ? o.trechos[o.trechos.length - 2].para : ult.para; return cidadeCurta(alvo) + (o.trechos.length > 2 ? ` e mais ${o.trechos.length - 2}` : ''); };
  const registrar = (o, quem, texto) => o.historico.push({ quando: new Date(), quem, texto });
  const soDig = (s) => String(s || '').replace(/\D/g, '');

  window.KV.orc = {
    agora: () => AGORA, aeroportos: AEROPORTOS, aeroporto, cidadeCurta, sites: SITES, site, etapas: ETAPAS, etapa, pesquisadores: PESQUISADORES,
    conferenciaPadrao: CONFERENCIA_PADRAO, janelaDias, pagantes, custo, custoPessoa, idade, fmtPax, rota, destino,
    lista: () => orcamentos, get: (id) => orcamentos.find((o) => o.id === id),
    // orçamentos antigos do mesmo WhatsApp (é por ele que se acha quem já pediu)
    anteriores: (whatsapp, excetoId) => orcamentos.filter((o) => o.id !== excetoId && soDig(o.contato.whatsapp) && soDig(o.contato.whatsapp) === soDig(whatsapp)),
    pegar: (o, pid) => { o.responsavel = pid; if (o.etapa === 'novo') o.etapa = 'pesquisa'; registrar(o, PESQUISADORES[pid], 'Pegou o orçamento'); },
    passar: (o, pid) => { o.responsavel = pid || null; registrar(o, 'Dono', pid ? `Passou pra ${PESQUISADORES[pid]}` : 'Devolveu pra fila'); },
    mudarEtapa: (o, id, quem) => { o.etapa = id; registrar(o, quem, id === 'pesquisado' ? 'Marcou como pesquisado' : `Mudou pra ${etapa(id).nome}`); },
    addOpcao: (o, op) => { const n = { id: 'op' + (++nOp), em: isoDia(AGORA), obs: '', ...op }; o.opcoes.push(n); return n; },
    removerOpcao: (o, id) => { o.opcoes = o.opcoes.filter((x) => x.id !== id); },
    criar: (dados) => { const n = orcamentos.length; const o = { id: 'o' + (101 + n), numero: 101 + n, criadoEm: new Date(), etapa: 'novo', opcoes: [], historico: [{ quando: new Date(), quem: 'Dono', texto: 'Criou o orçamento' }], ...dados }; orcamentos.push(o); return o; },
  };
})();

/* Peças dos orçamentos usadas nas telas: aeroportos, sites, etapas, rota, destino, datas, dinheiro e a trilha.
   Dinheiro chega do servidor em centavos; valor da milha em milionésimos de real. */
(function () {
  const AEROPORTOS = [
    ['GRU', 'São Paulo (Guarulhos)'], ['CGH', 'São Paulo (Congonhas)'], ['VCP', 'Campinas'], ['GIG', 'Rio de Janeiro (Galeão)'], ['SDU', 'Rio de Janeiro (Santos Dumont)'],
    ['BSB', 'Brasília'], ['CNF', 'Belo Horizonte (Confins)'], ['SSA', 'Salvador'], ['REC', 'Recife'], ['FOR', 'Fortaleza'], ['POA', 'Porto Alegre'], ['CWB', 'Curitiba'],
    ['FLN', 'Florianópolis'], ['GYN', 'Goiânia'], ['MAO', 'Manaus'], ['BEL', 'Belém'], ['NAT', 'Natal'], ['MCZ', 'Maceió'], ['IGU', 'Foz do Iguaçu'],
    ['LIS', 'Lisboa'], ['OPO', 'Porto'], ['MAD', 'Madri'], ['BCN', 'Barcelona'], ['CDG', 'Paris'], ['FCO', 'Roma'], ['LHR', 'Londres'], ['FRA', 'Frankfurt'], ['AMS', 'Amsterdã'],
    ['PLU', 'Belo Horizonte (Pampulha)'], ['JPA', 'João Pessoa'], ['AJU', 'Aracaju'], ['THE', 'Teresina'], ['SLZ', 'São Luís'], ['CGB', 'Cuiabá'], ['CGR', 'Campo Grande'],
    ['VIX', 'Vitória'], ['NVT', 'Navegantes'], ['JOI', 'Joinville'], ['LDB', 'Londrina'], ['MGF', 'Maringá'], ['UDI', 'Uberlândia'], ['IOS', 'Ilhéus'], ['BPS', 'Porto Seguro'],
    ['PMW', 'Palmas'], ['PVH', 'Porto Velho'], ['RBR', 'Rio Branco'], ['MCP', 'Macapá'], ['BVB', 'Boa Vista'], ['SJP', 'São José do Rio Preto'], ['RAO', 'Ribeirão Preto'],
    ['CXJ', 'Caxias do Sul'], ['PNZ', 'Petrolina'], ['FEN', 'Fernando de Noronha'], ['JDO', 'Juazeiro do Norte'], ['STM', 'Santarém'], ['IMP', 'Imperatriz'], ['XAP', 'Chapecó'], ['CAC', 'Cascavel'],
    ['MIA', 'Miami'], ['MCO', 'Orlando'], ['JFK', 'Nova York'], ['EZE', 'Buenos Aires'], ['SCL', 'Santiago'], ['LIM', 'Lima'], ['CUN', 'Cancún'], ['PTY', 'Cidade do Panamá'], ['DXB', 'Dubai'], ['FLL', 'Fort Lauderdale'], ['EWR', 'Newark'], ['LAX', 'Los Angeles'], ['MEX', 'Cidade do México'], ['BOG', 'Bogotá'], ['MVD', 'Montevidéu'],
    ['ASU', 'Assunção'], ['CUZ', 'Cusco'], ['PUJ', 'Punta Cana'], ['ZRH', 'Zurique'], ['MUC', 'Munique'], ['IST', 'Istambul'], ['DOH', 'Doha'], ['MXP', 'Milão'], ['ATL', 'Atlanta'],
    ['MOC', 'Montes Claros'], ['AUX', 'Araguaína'], ['RIA', 'Santa Maria'],
    ['LGA', 'Nova York (LaGuardia)'], ['BOS', 'Boston'], ['SFO', 'São Francisco'], ['ORD', 'Chicago'], ['IAD', 'Washington (Dulles)'], ['DCA', 'Washington (Reagan)'],
    ['BWI', 'Baltimore'], ['PHL', 'Filadélfia'], ['TPA', 'Tampa'], ['DFW', 'Dallas'], ['TUL', 'Tulsa'], ['MSN', 'Madison'],
    ['DUB', 'Dublin'], ['ORK', 'Cork'], ['LGW', 'Londres (Gatwick)'], ['GLA', 'Glasgow'], ['EDI', 'Edimburgo'], ['BRU', 'Bruxelas'], ['ADB', 'Esmirna'],
    ['DSS', 'Dakar'], ['NBJ', 'Luanda'], ['NRT', 'Tóquio (Narita)'], ['HND', 'Tóquio (Haneda)'],
  ].map(([cod, cidade]) => ({ cod, cidade }));
  // aeroportos do Brasil: fora daqui é voo internacional (aviso de passaporte)
  const NACIONAIS = new Set('GRU CGH VCP GIG SDU BSB CNF PLU SSA REC FOR POA CWB FLN GYN MAO BEL NAT MCZ IGU JPA AJU THE SLZ CGB CGR VIX NVT JOI LDB MGF UDI IOS BPS PMW PVH RBR MCP BVB SJP RAO CXJ PNZ FEN JDO STM IMP XAP CAC MOC AUX RIA'.split(' '));
  const aeroporto = (cod) => ({ ...(AEROPORTOS.find((a) => a.cod === cod) || { cod, cidade: cod }), int: !NACIONAIS.has(cod) });
  const cidadeCurta = (cod) => aeroporto(cod).cidade.replace(/ \(.*\)/, '');

  const ETAPAS = [
    { id: 'novo', nome: 'Novo', aberta: true }, { id: 'pesquisa', nome: 'Em pesquisa', aberta: true },
    { id: 'pesquisado', nome: 'Pesquisado', aberta: true }, { id: 'enviado', nome: 'Enviado', aberta: true },
    { id: 'fechado', nome: 'Fechado', aberta: true }, { id: 'emitido', nome: 'Emitido', aberta: false },
    { id: 'perdido', nome: 'Perdido', aberta: false }, { id: 'cancelado', nome: 'Cancelado', aberta: false },
  ];
  const etapa = (id) => ETAPAS.find((e) => e.id === id);

  const idade = (iso) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
    if (m < 1) return 'agora'; if (m < 60) return `há ${m} min`;
    const h = Math.round(m / 60); if (h < 24) return `há ${h}h`;
    const d = Math.round(h / 24); return d === 1 ? 'ontem' : `há ${d} dias`;
  };
  // dd/mm; de outro ano, dd/mm/aa
  const dataCurta = (s) => { const [a, m, d] = s.split('-'); return a === String(new Date().getFullYear()) ? `${d}/${m}` : `${d}/${m}/${a.slice(2)}`; };
  // dias pra olhar em texto curto: seguidos viram faixa e o mês vai uma vez só ("26 a 30/11", "26 e 28/11", "30/11 a 02/12")
  function diasTexto(isos) {
    const faixas = [];
    [...new Set(isos)].sort().forEach((d) => {
      const f = faixas[faixas.length - 1], prox = f && new Date(f.fim + 'T12:00:00'); if (prox) prox.setDate(prox.getDate() + 1);
      if (prox && isoDia(prox) === d) f.fim = d; else faixas.push({ ini: d, fim: d });
    });
    const dia = (x) => dataCurta(x).slice(0, 2), mes = (x) => dataCurta(x).slice(2);
    const lista = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l[0]);
    const grupos = [];
    faixas.forEach((f) => {
      // dois dias seguidos no mesmo mês ficam "26 e 27", não "26 a 27"
      const dois = f.ini !== f.fim && mes(f.ini) === mes(f.fim) && +dia(f.fim) - +dia(f.ini) === 1;
      const txts = f.ini === f.fim ? [dia(f.ini)] : dois ? [dia(f.ini), dia(f.fim)] : [`${mes(f.ini) === mes(f.fim) ? dia(f.ini) : dataCurta(f.ini)} a ${dia(f.fim)}`];
      const g = grupos[grupos.length - 1];
      if (g && g.mes === mes(f.fim)) g.l.push(...txts); else grupos.push({ mes: mes(f.fim), l: txts });
    });
    return lista(grupos.map((g) => lista(g.l) + g.mes));
  }
  // roteiros alternativos ("Lisboa, mas Porto também serve"): cada um com seus trechos; o trecho guarda a posição geral (opções e emissões apontam pra ela)
  const roteiros = (o) => { const g = []; o.trechos.forEach((t, i) => (g[t.roteiro || 0] ||= []).push(i)); return g.filter(Boolean); };
  const letra = (r) => String.fromCharCode(65 + r);
  const rotaDe = (ts) => { const cods = [ts[0].de]; ts.forEach((t) => { if (cods[cods.length - 1] !== t.de) cods.push('…', t.de); cods.push(t.para); }); return cods.join(' → '); };
  const rota = (o) => roteiros(o).map((r) => rotaDe(r.map((i) => o.trechos[i]))).join(' ou ');
  const destinoDe = (ts) => { const ult = ts[ts.length - 1]; const volta = ult.para === ts[0].de; const alvo = volta && ts.length > 1 ? ts[ts.length - 2].para : ult.para; return cidadeCurta(alvo) + (ts.length > 2 ? ` e mais ${ts.length - 2}` : ''); };
  const destino = (o) => [...new Set(roteiros(o).map((r) => destinoDe(r.map((i) => o.trechos[i]))))].join(' ou ');
  // cidades do título: as dos trechos pedidos (idx), ou a origem e os destinos de cada roteiro
  function cidades(o, idx) {
    const rs = idx ? [idx] : roteiros(o);
    if (rs.length === 1) { const ts = rs[0].map((i) => o.trechos[i]); return [ts[0].de, ...ts.map((t) => t.para)].map(cidadeCurta); }
    return [cidadeCurta(o.trechos[0].de), destino(o)];
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // site → como paga e de qual programa sai a milha (igual a src/acoes/pesquisa.js)
  const SITES = [
    { id: 'Smiles', forma: 'pontos', programa: 'smiles' }, { id: 'Latam', forma: 'pontos', programa: 'latam' },
    { id: 'TudoAzul', forma: 'pontos', programa: 'azul' }, { id: 'Interline', forma: 'pontos', programa: 'azul' },
    { id: 'Skyscanner', forma: 'dinheiro', programa: null },
  ];
  const site = (id) => SITES.find((s) => s.id === id) || { id, forma: 'dinheiro', programa: null };
  const pad = (n) => String(n).padStart(2, '0');
  const isoDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // janela de datas: semana do dia pedido + semana seguinte (14 dias a partir da segunda)
  function janelaDias(t) {
    if (!t.janela) return [t.data];
    const d = new Date(t.data + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return Array.from({ length: 14 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return isoDia(x); });
  }
  const diaCurto = (iso) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(iso + 'T12:00').getDay()];
  const pagantes = (o) => o.passageiros.adultos + o.passageiros.criancas;
  const total = (o) => o.passageiros.adultos + o.passageiros.criancas + o.passageiros.bebes;
  const fmtPax = (p) => [p.adultos && `${p.adultos} ${p.adultos > 1 ? 'adultos' : 'adulto'}`, p.criancas && `${p.criancas} ${p.criancas > 1 ? 'crianças' : 'criança'}`, p.bebes && `${p.bebes} ${p.bebes > 1 ? 'bebês' : 'bebê'}`].filter(Boolean).join(', ');

  const fmt = {
    brl: (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    pts: (n) => Math.round(n).toLocaleString('pt-BR'),
    milha: (v) => 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
    data: (s) => s.split('-').reverse().join('/'),
    fone: (d) => !d ? '' : d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d,
  };
  // "1.234,56", "1234.5", "R$ 99" → centavos (ou null)
  const lerReais = (t) => { const n = +String(t ?? '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); return isFinite(n) && n > 0 ? Math.round(n * 100) : null; };

  // valor da milha padrão de cada programa (só o dono recebe); preenchido pela tela com o estado
  let valoresMilha = {};
  const usarProgramas = (lista) => { valoresMilha = Object.fromEntries((lista || []).filter((p) => p.valor_milha != null).map((p) => [p.id, p.valor_milha])); };
  const valorMilhaPadrao = (prog) => valoresMilha[prog] || 0;
  // custo pra K&V, em centavos, por pessoa: milhas × valor da milha + taxa, ou o preço em dinheiro
  const custoPessoa = (op) => site(op.site).forma === 'pontos' ? Math.round(op.milhas * valorMilhaPadrao(site(op.site).programa) / 1e4) + op.taxa : op.preco;
  const custo = (op, o) => custoPessoa(op) * pagantes(o);

  // ---------- trilha: as quatro telas do atendimento, em ordem ----------
  const PASSOS = [
    { id: 'pesquisa', nome: 'Pesquisa', href: 'orcamento.html', desde: 'novo' },
    { id: 'proposta', nome: 'Proposta', href: 'proposta.html', desde: 'pesquisado' },
    { id: 'fechamento', nome: 'Fechamento', href: 'fechamento.html', desde: 'enviado' },
    { id: 'emissao', nome: 'Emissão', href: 'emissao.html', desde: 'fechado' },
  ];
  const ORDEM = ['novo', 'pesquisa', 'pesquisado', 'enviado', 'fechado', 'emitido'];
  const alcance = (o) => (o.etapa === 'cancelado' ? 5 : o.etapa === 'perdido' ? ORDEM.indexOf(o.antesDePerder || 'enviado') : ORDEM.indexOf(o.etapa));
  // a tela certa pra abrir o orçamento, conforme a etapa (o dono vai direto pro que falta fazer)
  const telaDa = (o) => ({ pesquisado: 'proposta.html', enviado: 'proposta.html', fechado: 'emissao.html', emitido: 'emissao.html', cancelado: 'emissao.html' })[o.etapa] || 'orcamento.html';
  function trilha(o, atual) {
    return `<nav class="trilha" aria-label="Caminho do orçamento">${PASSOS.map((p, i) => {
      const ok = alcance(o) >= ORDEM.indexOf(p.desde), feito = ({ pesquisa: 2, proposta: 3, fechamento: 4, emissao: 5 })[p.id] <= alcance(o);
      const conteudo = `<span class="bola">${feito ? '<i data-lucide="check"></i>' : i + 1}</span><span class="nome">${p.nome}</span>`;
      if (p.id === atual) return `<span class="passo atual" aria-current="step">${conteudo}</span>`;
      return ok ? `<a class="passo ${feito ? 'feito' : ''}" href="${p.href}?id=${o.id}">${conteudo}</a>` : `<span class="passo bloq" title="Ainda não chegou aqui">${conteudo}</span>`;
    }).join('<i class="liga" aria-hidden="true"></i>')}</nav>`;
  }

  window.KVOrc = { aeroportos: AEROPORTOS, aeroporto, cidadeCurta, etapas: ETAPAS, etapa, idade, dataCurta, rota, destino, esc, roteiros, letra, cidades, diasTexto,
    sites: SITES, site, internacional: (o) => o.trechos.some((t) => aeroporto(t.de).int || aeroporto(t.para).int), janelaDias, diaCurto, pagantes, total, fmtPax, fmt, lerReais, isoDia,
    usarProgramas, valorMilhaPadrao, custoPessoa, custo, trilha, telaDa };
})();

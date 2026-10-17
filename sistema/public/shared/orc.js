/* Peças dos orçamentos usadas nas telas: aeroportos, etapas, rota, destino, datas e idade. */
(function () {
  const AEROPORTOS = [
    ['GRU', 'São Paulo (Guarulhos)'], ['CGH', 'São Paulo (Congonhas)'], ['VCP', 'Campinas'], ['GIG', 'Rio de Janeiro (Galeão)'], ['SDU', 'Rio de Janeiro (Santos Dumont)'],
    ['BSB', 'Brasília'], ['CNF', 'Belo Horizonte (Confins)'], ['SSA', 'Salvador'], ['REC', 'Recife'], ['FOR', 'Fortaleza'], ['POA', 'Porto Alegre'], ['CWB', 'Curitiba'],
    ['FLN', 'Florianópolis'], ['GYN', 'Goiânia'], ['MAO', 'Manaus'], ['BEL', 'Belém'], ['NAT', 'Natal'], ['MCZ', 'Maceió'], ['IGU', 'Foz do Iguaçu'],
    ['LIS', 'Lisboa'], ['OPO', 'Porto'], ['MAD', 'Madri'], ['BCN', 'Barcelona'], ['CDG', 'Paris'], ['FCO', 'Roma'], ['LHR', 'Londres'], ['FRA', 'Frankfurt'], ['AMS', 'Amsterdã'],
    ['MIA', 'Miami'], ['MCO', 'Orlando'], ['JFK', 'Nova York'], ['EZE', 'Buenos Aires'], ['SCL', 'Santiago'], ['LIM', 'Lima'], ['CUN', 'Cancún'], ['PTY', 'Cidade do Panamá'], ['DXB', 'Dubai'],
  ].map(([cod, cidade]) => ({ cod, cidade }));
  const aeroporto = (cod) => AEROPORTOS.find((a) => a.cod === cod) || { cod, cidade: cod };
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
  const rota = (o) => { const cods = [o.trechos[0].de]; o.trechos.forEach((t) => { if (cods[cods.length - 1] !== t.de) cods.push('…', t.de); cods.push(t.para); }); return cods.join(' → '); };
  const destino = (o) => { const ult = o.trechos[o.trechos.length - 1]; const volta = ult.para === o.trechos[0].de; const alvo = volta && o.trechos.length > 1 ? o.trechos[o.trechos.length - 2].para : ult.para; return cidadeCurta(alvo) + (o.trechos.length > 2 ? ` e mais ${o.trechos.length - 2}` : ''); };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.KVOrc = { aeroporto, cidadeCurta, etapas: ETAPAS, etapa, idade, dataCurta, rota, destino, esc };
})();

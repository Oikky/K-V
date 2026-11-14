/* Contas da proposta, do fechamento e da emissão (igual aos rascunhos da rodada 9, em centavos e milionésimos).
   Preço pro cliente: milhas × valor da milha + taxas (+ trechos em dinheiro), pra viagem inteira.
   O valor da milha vem das configurações e o dono pode mudar em cada combinação; ele também pode digitar um preço livre.
   Esse é o preço à vista (Pix ou dinheiro). O parcelado é outro preço, digitado à mão, com o número de vezes (padrão 10).
   Precisa de orc.js antes. */
(function () {
  const O = KVOrc, { fmt } = KVOrc;
  const opsDo = (o, ti) => o.opcoes.filter((x) => x.trecho === ti);
  const op = (o, id) => o.opcoes.find((x) => x.id === id);
  const barata = (l) => [...l].sort((a, b) => O.custoPessoa(a) - O.custoPessoa(b))[0] || null;
  const progDe = (x) => O.site(x.site).programa;
  const VEZES_PADRAO = 10;

  let nomesProg = {};
  const usarProgramas = (lista) => { O.usarProgramas(lista); nomesProg = Object.fromEntries((lista || []).map((p) => [p.id, p.nome])); };
  const progNome = (id) => nomesProg[id] || id;

  // ---------- combinações ----------
  const FILTROS_SUGESTAO = [
    { nome: 'Mais barata', passa: () => true },
    { nome: 'Só voo direto', passa: (x) => x.escalas === 0 },
    { nome: 'Com mala', passa: (x) => x.bagagem },
    { nome: 'Em dinheiro', passa: (x) => O.site(x.site).forma === 'dinheiro' },
  ];
  const novaCombo = (dados) => ({ id: null, milha: {}, livre: null, parcelado: null, vezes: VEZES_PADRAO, ...dados });
  // sugestões que o sistema monta sozinho: a mais barata e, quando der diferente, a só de voos diretos (ou com mala)
  function sugerir(o, quantas = 2) {
    const lista = [];
    FILTROS_SUGESTAO.forEach((f) => {
      if (lista.length >= quantas) return;
      const escolha = o.trechos.map((t, ti) => { const b = barata(opsDo(o, ti).filter(f.passa)); return b ? b.id : null; });
      if (escolha.some((e) => !e)) return;
      if (lista.some((c) => c.escolha.join() === escolha.join())) return;
      lista.push(novaCombo({ nome: f.nome, escolha }));
    });
    return lista;
  }
  const opsDaCombo = (o, c) => c.escolha.map((id) => op(o, id)).filter(Boolean);
  const valorMilha = (c, prog) => (c.milha[prog] != null ? c.milha[prog] : O.valorMilhaPadrao(prog));
  // milhas por programa (todos os pagantes), com o valor em centavos pelo valor da milha da combinação
  function porPrograma(o, c) {
    const m = new Map(), pag = O.pagantes(o);
    opsDaCombo(o, c).forEach((x) => { const p = progDe(x); if (!p) return; const g = m.get(p) || { programa: p, milhas: 0 }; g.milhas += x.milhas * pag; m.set(p, g); });
    return [...m.values()].map((g) => ({ ...g, valor: valorMilha(c, g.programa), padrao: O.valorMilhaPadrao(g.programa), reais: Math.round(g.milhas * valorMilha(c, g.programa) / 1e4) }));
  }
  const taxas = (o, c) => opsDaCombo(o, c).reduce((s, x) => s + (x.taxa || 0) * O.pagantes(o), 0);
  const dinheiro = (o, c) => opsDaCombo(o, c).reduce((s, x) => s + (x.preco || 0) * O.pagantes(o), 0);
  const milhasCombo = (o, c) => porPrograma(o, c).reduce((s, g) => s + g.milhas, 0);
  const precoCalc = (o, c) => porPrograma(o, c).reduce((s, g) => s + g.reais, 0) + taxas(o, c) + dinheiro(o, c);
  // preço final à vista: o digitado, se houver, ou o calculado
  const venda = (o, c) => (c.livre != null ? c.livre : precoCalc(o, c));
  // teto: quanto a pessoa pagaria sozinha comprando em dinheiro (a mais barata em dinheiro de cada trecho)
  function teto(o) {
    const porTrecho = o.trechos.map((t, ti) => barata(opsDo(o, ti).filter((x) => O.site(x.site).forma === 'dinheiro')));
    if (porTrecho.some((x) => !x)) return { valor: null };
    return { valor: porTrecho.reduce((s, x) => s + O.custo(x, o), 0) };
  }
  const aceita = (o) => (o.combos || []).find((c) => c.id === o.aceita) || null;

  // ---------- mensagem pro WhatsApp (sem custo nem lucro) ----------
  const DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const diaSem = (iso) => DIA[new Date(iso + 'T12:00').getDay()];
  const nomeTrecho = (o, ti) => {
    const n = o.trechos.length;
    if (n === 2 && o.trechos[1].para === o.trechos[0].de) return ti === 0 ? 'Ida' : 'Volta';
    return n === 1 ? 'Ida' : `Trecho ${ti + 1}`;
  };
  // "GRU" → "São Paulo GRU"; nome já escrito na opção ("São Paulo GRU") fica como está
  const lugar = (cod) => { const c = O.cidadeCurta(cod); return c === cod ? cod : `${c} ${cod}`; };
  const dataLonga = (iso) => iso.split('-').reverse().join('/');
  const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return dataLonga(O.isoDia(d)); };
  function escalasMsg(x) {
    if (!x.escalas) return ['Voo direto'];
    const nome = `${x.escalas} escala${x.escalas > 1 ? 's' : ''}`, onde = x.escalasOnde;
    if (!onde || onde.length !== x.escalas) return [nome];
    return [`${nome}:`, ...onde.map(([l, t]) => ` - ${lugar(l)}${t ? ` (${t})` : ''}`)];
  }
  function mensagem(o, combos = o.combos || []) {
    const quem = o.contato.nome.split(' ')[0];
    const linhas = [`Oi, ${quem}! Seguem as opções pra ${O.destino(o)}:`];
    combos.forEach((c, i) => {
      linhas.push('', `*Opção ${i + 1} · ${c.nome}*`);
      opsDaCombo(o, c).forEach((x, j) => {
        const t = o.trechos[x.trecho], depois = +((/ \+(\d)$/.exec(x.chega) || [])[1] || 0);
        if (j) linhas.push('');
        linhas.push(`${nomeTrecho(o, x.trecho)} ${dataLonga(x.data)}`,
          `${lugar(x.de || t.de)} ${x.sai} → ${lugar(x.para || t.para)} ${x.chega.replace(/ \+\d$/, '')}${depois ? ` (chega ${somaDias(x.data, depois)})` : ''}`,
          ...escalasMsg(x));
        if (x.cabine) linhas.push(`Cabine ${x.cabine}`);
        if (x.mala_mao != null) linhas.push(`Mala de mão: ${x.mala_mao ? 'inclusa' : 'não inclusa'}`);
        linhas.push(`Mala despachada: ${x.bagagem ? `${x.bagagem} inclusa${x.bagagem > 1 ? 's' : ''}` : 'não inclusa'}`);
      });
      linhas.push('');
      linhas.push(`*${fmt.brl(venda(o, c))}* no Pix ou dinheiro${c.parcelado ? ` ou ${fmt.brl(c.parcelado)} em até ${c.vezes}x de ${fmt.brl(Math.round(c.parcelado / c.vezes))}` : ''}`);
    });
    linhas.push('', 'Os preços podem mudar até a emissão. Qual fica melhor pra você?');
    return linhas.join('\n');
  }

  // ---------- recebimento ----------
  const FORMAS = [{ id: 'pix', nome: 'Pix' }, { id: 'cartao', nome: 'Cartão' }, { id: 'parcelado', nome: 'Parcelado' }];
  // quanto a pessoa paga: o preço parcelado quando ela parcela (e ele existe), senão o à vista
  const valorFinal = (o) => { const c = aceita(o); if (!c) return null; return o.receb && o.receb.forma === 'parcelado' && c.parcelado ? c.parcelado : venda(o, c); };
  function situacao(o) {
    const v = valorFinal(o); if (v == null) return null;
    const r = (o.receb && o.receb.recebido) || 0;
    if (r >= v) return { id: 'pago', nome: 'Pago', cls: 'ok', falta: 0 };
    if (r > 0) return { id: 'parte', nome: 'Pago em parte', cls: 'warn', falta: v - r };
    return { id: 'receber', nome: 'A receber', cls: 'warn', falta: v };
  }

  window.KVProp = {
    usarProgramas, progNome, progDe, opsDo, op, sugerir, novaCombo, opsDaCombo, valorMilha, porPrograma, taxas, dinheiro, milhasCombo, precoCalc, venda,
    teto, aceita, mensagem, texto: (o) => o.mensagem || mensagem(o), nomeTrecho, diaSem, formas: FORMAS, valorFinal, situacao, vezesPadrao: VEZES_PADRAO,
  };
})();

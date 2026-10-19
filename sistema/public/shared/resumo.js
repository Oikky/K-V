/* Resumo escrito da pesquisa, pra colar no WhatsApp: o "Em função site" do documento antigo, montado com o que está lançado.
   Mesma ordem do documento: quem e a rota; depois um bloco por site (na ordem em que o site apareceu), com cada opção
   (trecho, companhia, data, saída, chegada, escalas, tempo, malas, milhas e valor); por último o Skyscanner.
   Linha sem dado não aparece. O valor em R$ só sai pra quem recebe o valor da milha (o dono).
   Precisa de orc.js e proposta.js antes. */
(function () {
  const O = KVOrc;
  const DIVISA = '━━━━━━━━━━━━';
  // R$ com espaço comum (o toLocaleString põe um espaço que não quebra, e no WhatsApp isso cola estranho)
  const brl = (c) => O.fmt.brl(c).replace(/\s/g, ' ');
  const nomeSite = (s) => (s === 'TudoAzul' ? 'Azul' : s);
  const lugar = (cod) => { const c = O.cidadeCurta(cod); return c === cod ? cod : `${c} ${cod}`; };
  const dataLonga = (iso) => iso.split('-').reverse().join('/');
  const maisUmDia = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 1); return O.isoDia(d).split('-').reverse().slice(0, 2).join('/'); };

  function escalas(op) {
    const n = op.escalas;
    if (!n) return 'Voo direto';
    const onde = op.escalasOnde;
    if (!onde || onde.length !== n) return `${n} escala${n > 1 ? 's' : ''}`;
    const um = ([l, t]) => (t ? `${l} (${t})` : l);
    const lista = onde.length === 1 ? um(onde[0]) : `${onde.slice(0, -1).map(um).join(', ')} e em ${um(onde[onde.length - 1])}`;
    return `${n} escala${n > 1 ? 's' : ''} em ${lista}`;
  }

  function opcao(o, op, comValor) {
    const t = o.trechos[op.trecho], prog = O.site(op.site).programa;
    const vm = prog ? O.valorMilhaPadrao(prog) : 0;
    const valor = (milhas) => brl(Math.round(milhas * vm / 1e4) + (op.taxa || 0));
    const cia = [op.cia && op.cia !== op.site ? op.cia : '', op.voo].filter(Boolean).join(' · ');
    const linhas = ['', `${KVProp.nomeTrecho(o, op.trecho)}:`];
    if (cia) linhas.push(`(${cia})`);
    linhas.push(`- ${dataLonga(op.data)}`, `- ${op.sai} - ${lugar(op.de || t.de)}`,
      `- ${op.chega.replace(' +1', '')} - ${lugar(op.para || t.para)}${op.chega.includes('+1') ? ` (chegando no dia ${maisUmDia(op.data)})` : ''}`,
      `- ${escalas(op)}`);
    if (op.duracao) linhas.push(`- Tempo de Viagem: ${op.duracao}`);
    if (op.mala_mao != null) linhas.push(`- Mala de mão: ${op.mala_mao ? 'Inclusa' : 'Não Inclusa'}`);
    if (op.bagagem) linhas.push('- Mala Despachada: inclusa');
    const comMala = op.milhas_mala && op.milhas_mala !== op.milhas;
    linhas.push(`Quantidade de Milhas: ${O.fmt.pts(op.milhas)}${comMala ? ` ou ${O.fmt.pts(op.milhas_mala)} com mala` : ''}${op.taxa ? ` + ${brl(op.taxa)}` : ''}`);
    if (comValor && vm) linhas.push(`Valor: ${valor(op.milhas)}${comMala ? ` ou ${valor(op.milhas_mala)} com mala` : ''}`);
    if (op.obs) linhas.push(op.obs);
    return linhas;
  }

  // Skyscanner: a mais barata de cada trecho, somada; sem opção lançada, o que foi anotado à mão no documento antigo
  function skyscanner(o) {
    const din = o.trechos.map((_, ti) => o.opcoes.filter((x) => x.trecho === ti && O.site(x.site).forma === 'dinheiro').sort((a, b) => a.preco - b.preco)[0]).filter(Boolean);
    // várias anotações (uma por trecho, "BOS a GRU:") começam na linha de baixo
    if (!din.length) return o.skyscanner ? [`Skyscanner:${/^[^\n]*:\n/.test(o.skyscanner) ? '\n' : ' '}${o.skyscanner}`] : [];
    const cias = [...new Set(din.map((x) => x.cia).filter((c) => c && c !== 'Skyscanner'))];
    return [`Skyscanner: ${brl(din.reduce((s, x) => s + x.preco, 0))}`,
      ...din.map((x) => `${KVProp.nomeTrecho(o, x.trecho)} ${O.dataCurta(x.data)}`),
      ...(cias.length ? [`Operado por ${cias.join('/')}`] : []),
      ...din.filter((x) => x.duracao).map((x) => `${KVProp.nomeTrecho(o, x.trecho)} ${x.duracao}`)];
  }

  function resumo(o, { comValor = true } = {}) {
    const cidades = o.trechos.length === 2 && o.trechos[1].para === o.trechos[0].de
      ? [o.trechos[0].de, o.trechos[0].para] : [o.trechos[0].de, ...o.trechos.map((t) => t.para)];
    const linhas = [`*${o.contato.nome.trim()}*`, cidades.map(lugar).join(' → ')];
    // sites na ordem em que apareceram na pesquisa; dentro do site, por trecho, dia e horário
    const pontos = o.opcoes.filter((x) => O.site(x.site).forma === 'pontos').sort((a, b) => a.id - b.id);
    const sites = [...new Set(pontos.map((x) => x.site))];
    sites.forEach((s) => {
      linhas.push('', `*${nomeSite(s)}*`);
      pontos.filter((x) => x.site === s).sort((a, b) => a.trecho - b.trecho || a.data.localeCompare(b.data) || a.sai.localeCompare(b.sai))
        .forEach((op) => linhas.push(...opcao(o, op, comValor)));
      linhas.push('', DIVISA);
    });
    const sky = skyscanner(o);
    if (sky.length) linhas.push('', ...sky);
    return linhas.join('\n');
  }

  window.KVResumo = { resumo };
})();

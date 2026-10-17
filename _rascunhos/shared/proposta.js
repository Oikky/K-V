/* RASCUNHO DESCARTÁVEL: proposta, fechamento e emissão (rodada 9). Estende KV.orc.
   Suposições (ver PERGUNTAS-PRO-DONO.md, item 13): o dono manda 2 ou 3 combinações; no fechamento marca a que a pessoa aceitou.
   Preço pro cliente (decidido em 2026-10-17): milhas × valor da milha + taxa (+ trechos em dinheiro), pra viagem inteira.
   O valor da milha vem das configurações e o dono pode mudar em cada combinação; ele também pode digitar um preço livre por cima.
   Esse é o preço à vista (Pix ou dinheiro). O parcelado é outro preço, digitado à mão, com o número de vezes (padrão 10).
   Precisa de dados.js, pessoas.js e orcamentos.js antes. */
(function () {
  const O = KV.orc, PS = KV.pessoas, { fmt } = KV;
  let semente = 9917;
  const rnd = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const localizador = () => Array.from({ length: 6 }, () => letras[Math.floor(rnd() * letras.length)]).join('');
  const dez = (n) => Math.round(n / 10) * 10;

  const opsDo = (o, ti) => o.opcoes.filter((x) => x.trecho === ti);
  const op = (o, id) => o.opcoes.find((x) => x.id === id);
  const barata = (l) => [...l].sort((a, b) => O.custoPessoa(a) - O.custoPessoa(b))[0] || null;
  const total = (o) => o.passageiros.adultos + o.passageiros.criancas + o.passageiros.bebes;

  // ---------- combinações ----------
  // sugestões que o sistema monta sozinho: a mais barata e, quando der diferente, a só de voos diretos (ou com mala)
  const FILTROS_SUGESTAO = [
    { nome: 'Mais barata', passa: () => true },
    { nome: 'Só voo direto', passa: (x) => x.escalas === 0 },
    { nome: 'Com mala', passa: (x) => x.bagagem },
    { nome: 'Em dinheiro', passa: (x) => O.site(x.site).forma === 'dinheiro' },
  ];
  let nC = 0;
  const VEZES_PADRAO = 10;
  const progDe = (x) => O.site(x.site).programa;
  // combinação: c.milha guarda o valor da milha de cada programa (começa no padrão das configurações);
  // c.livre é o preço digitado à mão. c.venda é sempre o preço final: o livre, se houver, ou o calculado.
  function criarCombo(o, dados) {
    const c = { milha: {}, livre: null, parcelado: null, vezes: VEZES_PADRAO, ...dados };
    Object.defineProperty(c, 'venda', { get: () => (c.livre != null ? c.livre : precoCalc(o, c)), enumerable: true });
    return c;
  }
  const valorMilha = (c, prog) => (c.milha[prog] != null ? c.milha[prog] : (KV.programa(prog) || {}).valorMilha || 0);
  // milhas por programa (todos os pagantes), com o valor em R$ pelo valor da milha da combinação
  function porPrograma(o, c) {
    const m = new Map(), pag = O.pagantes(o);
    opsDaCombo(o, c).forEach((x) => { const p = progDe(x); if (!p) return; const g = m.get(p) || { programa: p, milhas: 0 }; g.milhas += x.milhas * pag; m.set(p, g); });
    return [...m.values()].map((g) => ({ ...g, valor: valorMilha(c, g.programa), padrao: (KV.programa(g.programa) || {}).valorMilha, reais: g.milhas * valorMilha(c, g.programa) }));
  }
  const taxas = (o, c) => opsDaCombo(o, c).reduce((s, x) => s + (x.taxa || 0) * O.pagantes(o), 0);
  const dinheiro = (o, c) => opsDaCombo(o, c).reduce((s, x) => s + (x.preco || 0) * O.pagantes(o), 0);
  const milhasCombo = (o, c) => porPrograma(o, c).reduce((s, g) => s + g.milhas, 0);
  const precoCalc = (o, c) => porPrograma(o, c).reduce((s, g) => s + g.reais, 0) + taxas(o, c) + dinheiro(o, c);
  function sugerir(o, quantas = 2) {
    const lista = [];
    FILTROS_SUGESTAO.forEach((f) => {
      if (lista.length >= quantas) return;
      const escolha = o.trechos.map((t, ti) => { const b = barata(opsDo(o, ti).filter(f.passa)); return b ? b.id : null; });
      if (escolha.some((e) => !e)) return;
      if (lista.some((c) => c.escolha.join() === escolha.join())) return;
      lista.push(criarCombo(o, { id: 'cb' + (++nC), nome: f.nome, escolha }));
    });
    return lista;
  }
  const opsDaCombo = (o, c) => c.escolha.map((id) => op(o, id)).filter(Boolean);
  const custoCombo = (o, c) => opsDaCombo(o, c).reduce((s, x) => s + O.custo(x, o), 0);
  // teto: quanto a pessoa pagaria sozinha comprando em dinheiro (a mais barata em dinheiro de cada trecho)
  function teto(o) {
    const porTrecho = o.trechos.map((t, ti) => barata(opsDo(o, ti).filter((x) => O.site(x.site).forma === 'dinheiro')));
    if (porTrecho.some((x) => !x)) return { valor: null, faltam: porTrecho.map((x, i) => (x ? null : i)).filter((i) => i != null) };
    return { valor: porTrecho.reduce((s, x) => s + O.custo(x, o), 0), faltam: [] };
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
  function mensagem(o, combos = o.combos || []) {
    const quem = o.contato.nome.split(' ')[0];
    const linhas = [`Oi, ${quem}! Seguem as opções pra ${O.destino(o)} (${O.fmtPax(o.passageiros)}):`];
    combos.forEach((c, i) => {
      linhas.push('', `*Opção ${i + 1} · ${c.nome}*`);
      opsDaCombo(o, c).forEach((x) => {
        const t = o.trechos[x.trecho];
        linhas.push(`${nomeTrecho(o, x.trecho)} ${diaSem(x.data)} ${fmt.dataCurta(x.data)} · ${t.de} ${x.sai} → ${t.para} ${x.chega} · ${x.escalas ? `${x.escalas} escala${x.escalas > 1 ? 's' : ''}` : 'direto'}${x.bagagem ? ' · com mala' : ''}`);
      });
      linhas.push(`*${fmt.brl(c.venda)}* no Pix ou dinheiro${c.parcelado ? ` ou ${fmt.brl(c.parcelado)} em até ${c.vezes}x de ${fmt.brl(c.parcelado / c.vezes)}` : ''}`);
    });
    linhas.push('', 'Os preços podem mudar até a emissão. Qual fica melhor pra você?');
    return linhas.join('\n');
  }

  // ---------- emissão: de qual conta sair ----------
  // pra cada conta do programa: saldo depois, CPFs novos (ocupam vaga) e se estoura o limite. Avisa, não bloqueia.
  function contasPara(o, ti) {
    const x = op(o, aceita(o).escolha[ti]);
    const prog = O.site(x.site).programa;
    if (!prog) return [];
    const precisa = x.milhas * O.pagantes(o);
    const pax = (o.passageirosIds || []).map(PS.pessoa).filter(Boolean);
    return KV.contas().filter((c) => c.programaId === prog).map((c) => {
      // outros voos deste orçamento já marcados pra mesma conta e ainda não emitidos também contam
      const reservado = Object.entries(o.emissoes || {}).filter(([k, e]) => +k !== ti && e.contaId === c.id && !e.feito)
        .reduce((s, [k]) => s + op(o, aceita(o).escolha[+k]).milhas * O.pagantes(o), 0);
      const b = KV.beneficiarios(c);
      const ja = new Set(b ? b.lista.map((y) => y.cpf) : []);
      const novos = pax.filter((p) => !ja.has(p.cpf) && p.cpf !== KV.cpfTitular(c.titular));
      const v = KV.vencendo(c);
      const sobra = c.saldo - reservado - precisa;
      return { conta: c, precisa, sobra, novos, vagas: b, estoura: b ? novos.length > b.livres : false, falta: sobra < 0, vencendo: v.pontos ? v : null };
    }).sort((a, b) => (a.falta - b.falta) || (a.estoura - b.estoura) || (a.novos.length - b.novos.length)
      || ((b.vencendo ? 1 : 0) - (a.vencendo ? 1 : 0)) || (a.sobra - b.sobra));
  }
  function emitir(o, ti, { contaId, localizador: loc }) {
    const x = op(o, aceita(o).escolha[ti]);
    const e = (o.emissoes = o.emissoes || {})[ti] = { ...(o.emissoes[ti] || {}), contaId: contaId || null, localizador: loc, feito: true, em: KV.hoje };
    const t = o.trechos[ti];
    if (contaId) {
      // emissão em pontos gera sozinha a saída na conta (e o passageiro vira beneficiário)
      const c = KV.contas().find((y) => y.id === contaId), pontos = x.milhas * O.pagantes(o);
      const pax = (o.passageirosIds || []).map(PS.pessoa).map((p) => ({ nome: p.nome, cpf: p.cpf }));
      KV.lotesConsumidos(c, pontos).usados.forEach((u) => { const l = c.lotes.find((y) => y.vence === u.vence && y.resta === u.resta); if (l) l.resta -= u.usa; });
      c.lotes = c.lotes.filter((l) => l.resta > 0);
      c.saldo -= pontos;
      c.movimentos.push({ tipo: 'emissao', lado: 'saida', data: KV.hoje, pontos, passageiros: pax, rota: `${t.de} → ${t.para}`, localizador: loc, saldoDepois: c.saldo, orcamento: o.numero });
      e.pontos = pontos;
    }
    o.historico.push({ quando: new Date(), quem: 'Dono', texto: `Emitiu ${t.de} → ${t.para} (${loc})` });
    if (o.trechos.every((_, k) => o.emissoes[k] && o.emissoes[k].feito)) { o.etapa = 'emitido'; o.historico.push({ quando: new Date(), quem: 'Dono', texto: 'Tudo emitido' }); }
    return e;
  }

  // ---------- recebimento ----------
  const FORMAS = [{ id: 'pix', nome: 'Pix' }, { id: 'cartao', nome: 'Cartão' }, { id: 'parcelado', nome: 'Parcelado' }];
  // quanto a pessoa paga: o preço parcelado quando ela parcela (e ele existe), senão o à vista
  const valorFinal = (o) => { const c = aceita(o); if (!c) return null; return o.receb && o.receb.forma === 'parcelado' && c.parcelado ? c.parcelado : c.venda; };
  function situacao(o) {
    const v = valorFinal(o); if (v == null) return null;
    const r = (o.receb && o.receb.recebido) || 0;
    if (r >= v) return { id: 'pago', nome: 'Pago', cls: 'ok', falta: 0 };
    if (r > 0) return { id: 'parte', nome: 'Pago em parte', cls: 'warn', falta: v - r };
    return { id: 'receber', nome: 'A receber', cls: 'warn', falta: v };
  }

  // ---------- trilha: as quatro telas do atendimento, em ordem ----------
  const PASSOS = [
    { id: 'pesquisa', nome: 'Pesquisa', href: 'orcamento.html', desde: 'novo' },
    { id: 'proposta', nome: 'Proposta', href: 'proposta.html', desde: 'pesquisado' },
    { id: 'fechamento', nome: 'Fechamento', href: 'fechamento.html', desde: 'enviado' },
    { id: 'emissao', nome: 'Emissão', href: 'emissao.html', desde: 'fechado' },
  ];
  const ORDEM = ['novo', 'pesquisa', 'pesquisado', 'enviado', 'fechado', 'emitido'];
  const alcance = (o) => (o.etapa === 'cancelado' ? 5 : o.etapa === 'perdido' ? ORDEM.indexOf(o.antesDePerder || 'enviado') : ORDEM.indexOf(o.etapa));
  const passoLiberado = (o, p) => alcance(o) >= ORDEM.indexOf(p.desde);
  const passoFeito = (o, p) => ({ pesquisa: 2, proposta: 3, fechamento: 4, emissao: 5 })[p.id] <= alcance(o);
  // a tela certa pra abrir o orçamento, conforme a etapa (o dono vai direto pro que falta fazer)
  const telaDa = (o) => ({ pesquisado: 'proposta.html', enviado: 'proposta.html', fechado: 'emissao.html', emitido: 'emissao.html', cancelado: 'emissao.html' })[o.etapa] || 'orcamento.html';
  function trilha(o, atual) {
    return `<nav class="trilha" aria-label="Caminho do orçamento">${PASSOS.map((p, i) => {
      const ok = passoLiberado(o, p), feito = passoFeito(o, p);
      const conteudo = `<span class="bola">${feito ? '<i data-lucide="check"></i>' : i + 1}</span><span class="nome">${p.nome}</span>`;
      if (p.id === atual) return `<span class="passo atual" aria-current="step">${conteudo}</span>`;
      return ok ? `<a class="passo ${feito ? 'feito' : ''}" href="${p.href}?id=${o.id}">${conteudo}</a>` : `<span class="passo bloq" title="Ainda não chegou aqui">${conteudo}</span>`;
    }).join('<i class="liga" aria-hidden="true"></i>')}</nav>`;
  }

  // ---------- semeadura: os orçamentos que já passaram da pesquisa ganham proposta, fechamento e emissão ----------
  const livres = PS.lista().filter((p) => p.whatsapp && !O.lista().some((o) => o.pessoaId === p.id));
  O.lista().forEach((o) => {
    if (!['enviado', 'fechado', 'emitido', 'perdido', 'cancelado'].includes(o.etapa)) return;
    o.combos = sugerir(o, o.trechos.length > 2 ? 2 : pick([2, 2, 3]));
    // às vezes o dono mexeu no valor da milha, às vezes arredondou o preço à mão
    o.combos.forEach((c) => {
      porPrograma(o, c).forEach((g) => { if (rnd() < 0.4) c.milha[g.programa] = +(g.padrao + pick([0.0005, 0.001, 0.0015, -0.0005])).toFixed(4); });
      if (rnd() < 0.3) c.livre = Math.round(precoCalc(o, c) / 100) * 100;
      if (rnd() < 0.6) c.parcelado = Math.round(c.venda * 1.1 / 10) * 10;
    });
    o.enviadaEm = new Date(o.criadoEm.getTime() + 864e5);
    if (o.etapa === 'perdido') o.antesDePerder = 'enviado';
    if (!['fechado', 'emitido', 'cancelado'].includes(o.etapa)) return;
    o.aceita = o.combos[0].id;
    // quem paga: o cliente ligado ao contato, ou alguém do cadastro (aí o contato passa a ter o nome dele)
    let cli = o.pessoaId && PS.pessoa(o.pessoaId);
    if (!cli) { cli = livres.shift() || PS.lista()[0]; o.pessoaId = cli.id; o.contato = { nome: cli.nome, whatsapp: cli.whatsapp }; }
    o.clienteId = cli.id;
    const junto = PS.viajaCom(cli.id).map((v) => v.pessoa.id);
    o.passageirosIds = [cli.id, ...junto].slice(0, total(o));
    o.receb = { forma: pick(['pix', 'pix', 'cartao', 'parcelado']), parcelas: aceita(o).vezes, recebido: 0 };
    o.receb.recebido = pick([0, valorFinal(o), dez(valorFinal(o) / 2)]);
    o.historico.push({ quando: new Date(o.criadoEm.getTime() + 2 * 864e5), quem: 'Dono', texto: `Fechou: ${aceita(o).nome}` });
    if (o.etapa === 'fechado') return;
    o.emissoes = {};
    o.trechos.forEach((t, ti) => {
      const x = op(o, aceita(o).escolha[ti]);
      const c = O.site(x.site).forma === 'pontos' ? (contasPara(o, ti)[0] || {}).conta : null;
      o.emissoes[ti] = { contaId: c ? c.id : null, localizador: localizador(), feito: true, em: KV.hoje, pontos: c ? x.milhas * O.pagantes(o) : null };
    });
  });

  Object.assign(O, {
    opsDo, op, sugerir, opsDaCombo, custoCombo, teto, aceita, porPrograma, taxas, dinheiro, milhasCombo, precoCalc, valorMilha, mensagem, nomeTrecho, diaSem,
    contasPara, emitir, formas: FORMAS, situacao, valorFinal, vezesPadrao: VEZES_PADRAO, trilha, telaDa, total,
    novaCombo: (o, base) => { const c = criarCombo(o, { id: 'cb' + (++nC), nome: base ? `${base.nome} (cópia)` : `Opção ${(o.combos || []).length + 1}`, escolha: base ? [...base.escolha] : sugerir(o, 1)[0].escolha, milha: base ? { ...base.milha } : {}, livre: base ? base.livre : null }); (o.combos = o.combos || []).push(c); return c; },
    enviar: (o) => { o.etapa = 'enviado'; o.enviadaEm = new Date(); o.historico.push({ quando: new Date(), quem: 'Dono', texto: `Enviou a proposta (${o.combos.length} opções)` }); },
    fechar: (o) => { o.etapa = 'fechado'; o.historico.push({ quando: new Date(), quem: 'Dono', texto: `Fechou: ${aceita(o).nome}` }); },
    perder: (o, motivo) => { o.antesDePerder = o.etapa; o.etapa = 'perdido'; o.motivo = motivo; o.historico.push({ quando: new Date(), quem: 'Dono', texto: 'Marcou como perdido: ' + motivo }); },
  });
})();

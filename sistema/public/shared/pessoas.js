/* Clientes e passageiros nas telas: carrega do servidor e entrega no mesmo formato dos rascunhos (KV.pessoas).
   Regra: cada pessoa existe uma vez só, achada pelo CPF. A venda de cada viagem é calculada com as mesmas contas da proposta.
   Precisa de api.js, orc.js e proposta.js. */
(function () {
  const O = KVOrc, P = KVProp;
  const pad = (n) => String(n).padStart(2, '0');
  const HOJE = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
  const diasAte = (s) => Math.round((new Date(s + 'T12:00:00') - new Date(HOJE + 'T12:00:00')) / 864e5);
  const ETAPA = { emitido: 'Emitido', fechado: 'Fechado', cancelado: 'Cancelado' };

  let pessoas = [], viagens = [], contas = [], programas = [];

  // viagem do servidor → formato das telas (destino, forma de pagamento, venda, recebido)
  function adaptar(v) {
    const o = { ...v, combos: v.combo ? [v.combo] : [], aceita: v.combo ? v.combo.id : null };
    const prog = v.opcoes.map((x) => O.site(x.site).programa).find(Boolean);
    const emitidas = v.emissoes.filter((e) => !e.cancelada);
    return {
      id: v.id, clienteId: v.clienteId, fechadoEm: v.fechadoEm, raw: o, destino: O.destino(v), internacional: O.internacional(v), trechos: v.trechos,
      passageiros: v.passageirosIds, etapa: ETAPA[v.etapa], forma: prog ? P.progNome(prog) : 'Dinheiro', programa: prog,
      localizador: emitidas.length ? emitidas.map((e) => e.localizador).join(' · ') : null,
      venda: P.valorFinal(o) || 0, recebido: v.receb.recebido || 0, devolvido: v.emissoes.reduce((s, e) => s + (e.devolvido || 0), 0),
    };
  }

  async function carregar() {
    const [est, dados, cs] = await Promise.all([KVApi.estado(), KVApi.clientes(), KVApi.contas()]);
    P.usarProgramas(est.programas);
    programas = est.programas;
    pessoas = dados.pessoas;
    viagens = dados.viagens.map(adaptar);
    contas = cs;
    return est;
  }

  // ---------- consultas (iguais às dos rascunhos) ----------
  const pessoa = (id) => pessoas.find((p) => p.id === +id);
  const viagensDe = (id) => viagens.filter((v) => v.clienteId === id || v.passageiros.includes(id))
    .sort((a, b) => b.trechos[0].data.localeCompare(a.trechos[0].data));
  const ehCliente = (id) => viagens.some((v) => v.clienteId === id);
  const aReceber = (v) => v.etapa === 'Cancelado' ? 0 : Math.max(0, v.venda - v.recebido);
  const situacao = (v) => v.etapa === 'Cancelado' ? 'cancelado' : v.recebido >= v.venda ? 'pago' : v.recebido > 0 ? 'parte' : 'receber';
  const deveTotal = (id) => viagens.filter((v) => v.clienteId === id).reduce((s, v) => s + aReceber(v), 0);
  const proximo = (id) => viagensDe(id).filter((v) => v.etapa !== 'Cancelado' && diasAte(v.trechos[0].data) >= 0)
    .sort((a, b) => a.trechos[0].data.localeCompare(b.trechos[0].data))[0] || null;
  const ultima = (id) => viagensDe(id).find((v) => v.etapa !== 'Cancelado' && diasAte(v.trechos[0].data) < 0) || null;
  function viajaCom(id) {
    const cont = new Map();
    viagensDe(id).forEach((v) => {
      const voou = v.passageiros.includes(id);
      v.passageiros.forEach((o) => { if (o !== id) cont.set(o, (cont.get(o) || 0) + (voou ? 1 : 0)); });
      // quem pagou a viagem e não voou também aparece
      if (v.clienteId && v.clienteId !== id && !cont.has(v.clienteId)) cont.set(v.clienteId, 0);
    });
    return [...cont.entries()].filter(([o]) => pessoa(o)).map(([o, n]) => ({ pessoa: pessoa(o), juntos: n, pagou: viagensDe(id).some((v) => v.clienteId === o) }))
      .sort((a, b) => b.juntos - a.juntos || a.pessoa.nome.localeCompare(b.pessoa.nome, 'pt-BR'));
  }
  // contas em que a pessoa já voou (beneficiário) e contas em que ela é titular
  function pontosDe(id) {
    const beneficiario = contas.filter((c) => c.beneficiarios && c.beneficiarios.lista.some((x) => x.pessoa_id === id))
      .map((c) => ({ conta: c, ben: c.beneficiarios.lista.find((x) => x.pessoa_id === id), vagas: c.beneficiarios }));
    return { beneficiario, titular: contas.filter((c) => c.titular_id === id) };
  }
  // avisos da pessoa: passaporte que vence perto (6 meses) de um voo internacional, ou já vencido
  function avisos(id) {
    const p = pessoa(id), lista = [];
    if (p.passaporte_validade) {
      const voo = viagensDe(id).find((v) => v.internacional && v.etapa !== 'Cancelado' && diasAte(v.trechos[0].data) >= 0 && v.passageiros.includes(id));
      const vence = diasAte(p.passaporte_validade);
      if (voo) {
        const folga = Math.round((new Date(p.passaporte_validade + 'T12:00') - new Date(voo.trechos[0].data + 'T12:00')) / 864e5);
        if (folga < 180) lista.push({ tipo: folga < 0 ? 'danger' : 'warn', texto: `Passaporte vence ${O.fmt.data(p.passaporte_validade)}, ${folga < 0 ? 'antes' : `só ${folga} dias depois`} do voo pra ${voo.destino} (${O.dataCurta(voo.trechos[0].data)}). Muitos países pedem 6 meses de validade.` });
      } else if (vence < 0) lista.push({ tipo: 'faint', texto: `Passaporte vencido em ${O.fmt.data(p.passaporte_validade)}.` });
    } else if (viagensDe(id).some((v) => v.internacional && v.etapa !== 'Cancelado' && diasAte(v.trechos[0].data) >= 0 && v.passageiros.includes(id))) {
      lista.push({ tipo: 'warn', texto: 'Tem voo internacional marcado e o passaporte não está no cadastro.' });
    }
    return lista;
  }

  // custo da viagem pra K&V: milhas × custo real da milha do programa (sem custo anotado, o valor da milha das configurações)
  // + taxas + trechos em dinheiro. Precisa das contas carregadas (KV.carregar) pro custo real.
  // shortcut: viagem cancelada fica fora (venda e lucro zero), mesmo se a K&V ficou com parte do dinheiro; refinar quando o dono responder a pergunta 10.
  function custo(v) {
    if (v.etapa === 'Cancelado') return 0;
    const o = v.raw, c = o.combos[0]; if (!c) return 0;
    const pts = P.porPrograma(o, c).reduce((s, g) => s + Math.round(g.milhas * ((KV.custoRealPrograma && KV.custoRealPrograma(g.programa)) ?? g.padrao) / 1e4), 0);
    return pts + P.taxas(o, c) + P.dinheiro(o, c);
  }
  const lucro = (v) => v.etapa === 'Cancelado' ? 0 : v.venda - custo(v) - v.devolvido;

  window.KV = window.KV || {};
  window.KV.pessoas = {
    custo, lucro,
    carregar, lista: () => pessoas, pessoa, viagens: () => viagens, viagensDe, ehCliente, aReceber, situacao, deveTotal, proximo, ultima,
    viajaCom, pontos: pontosDe, avisos, diasAte, hoje: HOJE, programa: (id) => programas.find((p) => p.id === id) || { nome: id },
    clienteDesde: (id) => { const vs = viagens.filter((v) => v.clienteId === id); return vs.length ? vs.map((v) => v.trechos[0].data).sort()[0] : null; },
    atualizar: (p) => { const i = pessoas.findIndex((x) => x.id === p.id); if (i >= 0) pessoas[i] = { ...pessoas[i], ...p }; else pessoas.push(p); pessoas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); },
  };
})();

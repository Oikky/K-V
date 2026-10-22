/* Contas de pontos nas telas: carrega do servidor e entrega no mesmo formato dos rascunhos (KV.contas(), KV.beneficiarios(c)...),
   pra as telas aprovadas mudarem o mínimo. Dinheiro em centavos; valor da milha em milionésimos de real. Precisa de api.js. */
(function () {
  const pad = (n) => String(n).padStart(2, '0');
  const isoDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const HOJE = isoDia(new Date());
  const diasAte = (s) => Math.round((new Date(s + 'T12:00:00') - new Date(HOJE + 'T12:00:00')) / 864e5);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ENTRADA_TIPOS = {
    clube: { nome: 'Clube', temCusto: true }, compra: { nome: 'Compra de pontos', temCusto: true },
    transferencia: { nome: 'Transferência', temCusto: true }, cartao: { nome: 'Cartão de crédito', temCusto: false },
    bonus: { nome: 'Bônus', temCusto: false }, estorno: { nome: 'Estorno', temCusto: false }, inicial: { nome: 'Saldo do sistema antigo', temCusto: false },
  };
  const SAIDA_TIPOS = { emissao: { nome: 'Emissão' }, transferencia: { nome: 'Transferência' }, expiracao: { nome: 'Expiração' }, ajuste: { nome: 'Ajuste' } };

  let programas = [], categorias = [], contas = [];
  const programa = (id) => programas.find((p) => p.id === id);

  // conta do servidor → formato das telas
  const adaptar = (c) => ({
    ...c, programaId: c.programa_id, titularId: c.titular_id, clubeCusto: c.clube_custo,
    lotes: c.lotes.map((l) => ({ ...l, origem: l.tipo === 'transferencia' && l.origem ? `Transferência da ${l.origem}` : (ENTRADA_TIPOS[l.tipo] || {}).nome || l.tipo })),
  });

  function beneficiarios(c) {
    const b = c.beneficiarios;
    if (!b) return null;
    return { usados: b.usados, limite: b.limite, base: b.base ?? b.limite, extras: b.extras || [], livres: b.livres, regra: c.renovacao, lista: b.lista.map((x) => ({ ...x, nome: x.nome || '—', cpf: x.cpf || '' })) };
  }
  const vencendo = (c) => { const lotes = c.lotes.filter((l) => l.vence && diasAte(l.vence) <= 60); return { pontos: lotes.reduce((s, l) => s + l.resta, 0), lotes, primeiro: lotes[0] ? lotes[0].vence : null }; };
  function alertas() {
    const lista = [];
    contas.forEach((c) => {
      const b = beneficiarios(c), v = vencendo(c);
      if (v.pontos > 0) lista.push({ tipo: 'vencendo', conta: c, texto: `${fmt.pts(v.pontos)} pts vencem em ${diasAte(v.primeiro)} dias`, urgencia: 100 - diasAte(v.primeiro) });
      if (b && b.livres === 0) lista.push({ tipo: 'limite', conta: c, texto: `Sem vaga de beneficiário (${b.usados}/${b.limite})`, urgencia: 90 });
      else if (b && b.livres <= 2) lista.push({ tipo: 'quase', conta: c, texto: `Só ${b.livres} vaga${b.livres > 1 ? 's' : ''} de beneficiário`, urgencia: 60 });
    });
    return lista.sort((a, b) => b.urgencia - a.urgencia);
  }
  // pontos que uma saída consumiria, dos lotes que vencem antes
  function lotesConsumidos(c, pontos) {
    let falta = pontos; const usados = [];
    c.lotes.forEach((l) => { if (falta <= 0) return; const usa = Math.min(l.resta, falta); falta -= usa; usados.push({ ...l, usa }); });
    return { usados, falta: Math.max(0, falta) };
  }

  const fmt = {
    pts: (n) => Math.round(n).toLocaleString('pt-BR'),
    brl: (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    milha: (v) => 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
    data: (s) => s.split('-').reverse().join('/'),
    dataCurta: (s) => { const [a, m, d] = s.split('-'); return a === HOJE.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${a.slice(2)}`; },
    iniciais: (nome) => nome.split(' ').filter((p) => p.length > 2).slice(0, 2).map((p) => p[0]).join('').toUpperCase(),
    cpf: (c) => (c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c || ''),
  };
  // custo real médio do programa (milionésimos por milha), somando todas as contas
  const custoRealPrograma = (id) => { const cs = contas.filter((c) => c.programaId === id); const pts = cs.reduce((s, c) => s + (c.custo_pontos || 0), 0); return pts ? Math.round(cs.reduce((s, c) => s + (c.custo_total || 0), 0) * 1e4 / pts) : null; };
  const titulares = () => [...new Map(contas.map((c) => [c.titularId, { id: c.titularId, nome: c.titular }])).values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  // carrega o que a tela precisa: o estado (programas) e as contas
  async function carregar() {
    const [est, lista] = await Promise.all([KVApi.estado(), KVApi.contas()]);
    programas = est.programas.map((p) => ({ ...p, valorMilha: p.valor_milha }));
    categorias = est.categorias;
    contas = lista.map(adaptar);
    return est;
  }

  window.KV = Object.assign(window.KV || {}, {
    hoje: HOJE, isoDia, diasAte, esc, fmt, entradaTipos: ENTRADA_TIPOS, saidaTipos: SAIDA_TIPOS,
    carregar, adaptar, programa, programas: () => programas, categoriasAzul: () => Object.fromEntries(categorias.filter((c) => c.programa_id === 'azul').map((c) => [c.nome, c.limite])),
    contas: () => contas, custoRealPrograma, conta: (id) => contas.find((c) => c.id === +id), titulares, beneficiarios, vencendo, alertas, lotesConsumidos,
  });
})();

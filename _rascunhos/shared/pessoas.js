/* RASCUNHO DESCARTÁVEL: pessoas (clientes e passageiros) e viagens fechadas, fictícias.
   Todo acesso passa por KV.pessoas. Regra (2026-10-17): cada pessoa existe uma vez só, achada pelo CPF.
   As pessoas vêm dos passageiros das emissões das contas, então o mesmo CPF aparece como beneficiário. */
(function () {
  const HOJE = new Date(KV.hoje + 'T12:00:00');
  let semente = 1710;
  const rnd = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
  const int = (a, b) => Math.floor(a + rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const iso = (d) => d.toISOString().slice(0, 10);
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const localizador = () => Array.from({ length: 6 }, () => pick((letras + '23456789').split(''))).join('');
  const diasAte = (s) => Math.round((new Date(s + 'T12:00:00') - HOJE) / 864e5);

  // ---------- pessoas ----------
  const porCpf = new Map();
  KV.contas().forEach((c) => c.movimentos.filter((m) => m.tipo === 'emissao').forEach((m) => m.passageiros.forEach((p) => {
    if (!porCpf.has(p.cpf)) porCpf.set(p.cpf, { nome: p.nome, cpf: p.cpf });
  })));
  const base = [...porCpf.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  // uma titular de contas que também compra passagens (dois papéis separados)
  base.push({ nome: 'Juliana Prado', cpf: KV.cpfTitular('Juliana Prado') });

  const pessoas = base.map((b, i) => ({
    id: 'ps' + (i + 1), nome: b.nome, cpf: b.cpf,
    nascimento: rnd() < 0.9 ? iso(new Date(int(1955, 2012), int(0, 11), int(1, 28))) : null,
    whatsapp: null, email: null, passaporte: null, obs: '',
  }));

  // famílias: o primeiro de cada grupo é quem paga (cliente); os outros viajam com ele
  const embaralhadas = [...pessoas].sort(() => rnd() - 0.5);
  const familias = [];
  for (let i = 0; i < embaralhadas.length;) {
    const n = Math.min(int(1, 4), embaralhadas.length - i);
    familias.push(embaralhadas.slice(i, i + n)); i += n;
  }
  // alguém que viaja com duas famílias diferentes (cadastro único: a mesma pessoa nas duas)
  if (familias[1] && familias[3] && familias[1][1]) familias[3].push(familias[1][1]);

  const ddd = ['11', '21', '31', '61', '62', '71', '81', '85'];
  const dominio = ['gmail.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
  const slug = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(' ');
  familias.forEach((f) => {
    const c = f[0];
    c.whatsapp = `(${pick(ddd)}) 9${int(1000, 9999)}-${int(1000, 9999)}`;
    if (rnd() < 0.7) { const s = slug(c.nome); c.email = `${s[0]}.${s[s.length - 1]}@${pick(dominio)}`; }
  });
  pessoas.forEach((p) => {
    if (rnd() < 0.45) p.passaporte = { numero: pick(['FX', 'GA', 'YC', 'FT']) + int(100000, 999999), validade: iso(addDias(HOJE, int(-60, 2400))) };
  });
  const OBS = ['Prefere janela', 'Sempre leva mala de 23 kg', 'Paga no Pix', 'Só voa direto, tem medo de conexão', 'Pede assento na frente', 'Viaja com cachorro pequeno na cabine'];
  pessoas.forEach((p) => { if (rnd() < 0.25) p.obs = pick(OBS); });

  // ---------- viagens (orçamentos fechados) ----------
  const DESTINOS = [
    { de: 'GRU', para: 'LIS', cidade: 'Lisboa', int: true }, { de: 'GRU', para: 'MCO', cidade: 'Orlando', int: true },
    { de: 'GIG', para: 'MIA', cidade: 'Miami', int: true }, { de: 'GRU', para: 'SCL', cidade: 'Santiago', int: true },
    { de: 'POA', para: 'EZE', cidade: 'Buenos Aires', int: true }, { de: 'GRU', para: 'REC', cidade: 'Recife', int: false },
    { de: 'BSB', para: 'SSA', cidade: 'Salvador', int: false }, { de: 'CNF', para: 'FOR', cidade: 'Fortaleza', int: false },
    { de: 'GRU', para: 'FLN', cidade: 'Florianópolis', int: false }, { de: 'GYN', para: 'GIG', cidade: 'Rio de Janeiro', int: false },
  ];
  const viagens = [];
  let nV = 0;
  familias.forEach((f, fi) => {
    const n = int(1, 4);
    for (let k = 0; k < n; k++) {
      const d = pick(DESTINOS);
      const ida = addDias(HOJE, k === 0 && fi % 3 === 0 ? int(5, 70) : -int(10, 330));
      const volta = addDias(ida, int(4, 18));
      const pax = f.filter((p, i) => i === 0 ? rnd() < 0.85 : rnd() < 0.75);
      if (!pax.length) pax.push(f[0]);
      const futuro = ida > HOJE;
      const pontos = rnd() < 0.7;
      const venda = Math.round(pax.length * (d.int ? int(2600, 5200) : int(700, 1800)) / 10) * 10;
      const cancelado = !futuro && rnd() < 0.07;
      const etapa = cancelado ? 'Cancelado' : futuro && rnd() < 0.3 ? 'Fechado' : 'Emitido';
      const recebido = !futuro ? venda : pick([venda, venda, 0, Math.round(venda / 2 / 10) * 10]);
      viagens.push({
        id: 'v' + (++nV), clienteId: f[0].id, destino: d.cidade, internacional: d.int,
        trechos: [{ de: d.de, para: d.para, data: iso(ida) }, { de: d.para, para: d.de, data: iso(volta) }],
        passageiros: pax.map((p) => p.id), etapa,
        forma: pontos ? pick(['Smiles', 'Latam Pass', 'TudoAzul']) : 'Dinheiro',
        localizador: etapa === 'Fechado' ? null : localizador(), venda, recebido: cancelado ? venda : recebido,
        devolvido: cancelado ? Math.round(venda * 0.6 / 10) * 10 : 0,
      });
    }
  });
  // uma viagem internacional próxima com passaporte vencendo (pro aviso aparecer)
  const intl = viagens.find((v) => v.internacional && diasAte(v.trechos[0].data) > 0);
  if (intl) { const p = pessoas.find((x) => x.id === intl.passageiros[0]); p.passaporte = { numero: 'FX' + int(100000, 999999), validade: iso(addDias(new Date(intl.trechos[0].data + 'T12:00'), 40)) }; }

  // ---------- consultas ----------
  const pessoa = (id) => pessoas.find((p) => p.id === id);
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
      if (v.clienteId !== id && !cont.has(v.clienteId)) cont.set(v.clienteId, 0);
    });
    return [...cont.entries()].map(([o, n]) => ({ pessoa: pessoa(o), juntos: n, pagou: viagensDe(id).some((v) => v.clienteId === o) }))
      .sort((a, b) => b.juntos - a.juntos || a.pessoa.nome.localeCompare(b.pessoa.nome, 'pt-BR'));
  }
  // contas em que o CPF já voou (beneficiário) e contas em que a pessoa é titular
  function pontos(id) {
    const p = pessoa(id);
    const beneficiario = KV.contas().map((c) => ({ c, b: KV.beneficiarios(c) })).filter(({ b }) => b && b.lista.some((x) => x.cpf === p.cpf))
      .map(({ c, b }) => ({ conta: c, ben: b.lista.find((x) => x.cpf === p.cpf), vagas: b }));
    const titular = KV.contas().filter((c) => c.titular === p.nome);
    return { beneficiario, titular };
  }
  // avisos da pessoa: passaporte que vence perto (6 meses) de um voo internacional, ou já vencido
  function avisos(id) {
    const p = pessoa(id), lista = [];
    if (p.passaporte) {
      const voo = viagensDe(id).find((v) => v.internacional && v.etapa !== 'Cancelado' && diasAte(v.trechos[0].data) >= 0 && v.passageiros.includes(id));
      const vence = diasAte(p.passaporte.validade);
      if (voo) {
        const folga = Math.round((new Date(p.passaporte.validade + 'T12:00') - new Date(voo.trechos[0].data + 'T12:00')) / 864e5);
        if (folga < 180) lista.push({ tipo: folga < 0 ? 'danger' : 'warn', texto: `Passaporte vence ${KV.fmt.data(p.passaporte.validade)}, ${folga < 0 ? 'antes' : `só ${folga} dias depois`} do voo pra ${voo.destino} (${KV.fmt.dataCurta(voo.trechos[0].data)}). Muitos países pedem 6 meses de validade.` });
      } else if (vence < 0) lista.push({ tipo: 'faint', texto: `Passaporte vencido em ${KV.fmt.data(p.passaporte.validade)}.` });
    }
    return lista;
  }
  const soDigitos = (s) => String(s || '').replace(/\D/g, '');
  // o CPF salvo é mascarado (***.123.456-**); compara pelos 6 dígitos do meio
  const meio = (cpf) => { const d = soDigitos(cpf); return d.length === 11 ? d.slice(3, 9) : d.length === 6 ? d : null; };
  const acharCpf = (cpf, excetoId) => { const m = meio(cpf); return m ? pessoas.find((p) => p.id !== excetoId && meio(p.cpf) === m) || null : null; };

  window.KV.pessoas = {
    lista: () => pessoas, pessoa, viagens: () => viagens, viagensDe, ehCliente, aReceber, situacao, deveTotal, proximo, ultima,
    viajaCom, pontos, avisos, acharCpf, diasAte,
    clienteDesde: (id) => { const vs = viagens.filter((v) => v.clienteId === id); return vs.length ? vs.map((v) => v.trechos[0].data).sort()[0] : null; },
    salvar: (dados, id) => {
      if (id) { Object.assign(pessoa(id), dados); return pessoa(id); }
      const p = { id: 'ps' + (pessoas.length + 1), passaporte: null, obs: '', ...dados }; pessoas.push(p); return p;
    },
  };
})();

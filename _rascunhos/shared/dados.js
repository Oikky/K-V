/* RASCUNHO DESCARTÁVEL: dados fictícios em memória.
   Todo acesso a dados passa por window.KV. No sistema de verdade, este módulo
   vira a ponte com o backend, e as telas não mudam. */
(function () {
  const HOJE = new Date('2026-10-15T12:00:00');

  // gerador pseudoaleatório com semente fixa: os mesmos dados a cada recarga
  let semente = 20261015;
  const rnd = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
  const int = (a, b) => Math.floor(a + rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const iso = (d) => d.toISOString().slice(0, 10);
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const localizador = () => Array.from({ length: 6 }, () => pick((letras + '23456789').split(''))).join('');
  const cpfMascara = () => `***.${int(100, 999)}.${int(100, 999)}-**`;

  const PROGRAMAS = [
    { id: 'smiles', nome: 'Smiles', valorMilha: 0.016, limite: 25, regra: 'ano', renovacao: '25 CPFs por ano; zera em 1º de janeiro' },
    { id: 'latam', nome: 'Latam Pass', valorMilha: 0.0255, limite: 24, regra: 'janela', renovacao: '24 CPFs; cada um libera a vaga 12 meses após a emissão' },
    { id: 'azul', nome: 'TudoAzul', valorMilha: 0.015, limite: 5, regra: 'manual', renovacao: '5 a 8 CPFs conforme a categoria; troca manual com 30 dias de carência' },
    { id: 'livelo', nome: 'Livelo', valorMilha: 0.0, limite: null, regra: 'nenhuma', renovacao: 'Não emite passagem: só transfere pros outros programas' },
  ];
  const CATEGORIA_AZUL = { 'Básico': 5, 'Topázio': 6, 'Safira': 7, 'Diamante': 8 };

  const NOMES_TITULARES = [
    'Renata Albuquerque', 'Paulo Henrique Matos', 'Juliana Prado', 'Marcos Vinícius Lacerda',
    'Cláudia Ferraz', 'Eduardo Tavares', 'Beatriz Nogueira', 'Rafael Quintela', 'Sônia Medeiros',
    'Thiago Barreto', 'Fernanda Lins', 'Gilberto Souza Reis', 'Adriana Coutinho', 'Leandro Pires',
  ];
  const NOMES_PASSAGEIROS = [
    'Ana Carolina Rezende', 'Bruno Teixeira', 'Camila Duarte', 'Daniel Azevedo', 'Elaine Moura',
    'Fábio Cardoso', 'Gabriela Siqueira', 'Henrique Bastos', 'Isabela Fontes', 'João Pedro Arantes',
    'Karina Moreira', 'Lucas Brandão', 'Mariana Vilela', 'Nelson Paiva', 'Olívia Sampaio',
    'Pedro Lucas Amaral', 'Quésia Ribeiro', 'Ricardo Neves', 'Simone Castro', 'Tiago Monteiro',
    'Úrsula Pacheco', 'Vinícius Rocha', 'Wesley Campos', 'Yasmin Torres', 'Zélia Andrade',
    'Alice Guimarães', 'Bernardo Leal', 'Cecília Prates', 'Davi Fonseca', 'Estela Marins',
    'Felipe Aguiar', 'Giovana Peixoto', 'Hugo Salles', 'Íris Calado', 'Jorge Mattos',
  ].map((nome) => ({ nome, cpf: cpfMascara() }));
  const CPF_TITULAR = Object.fromEntries(NOMES_TITULARES.map((n) => [n, cpfMascara()]));
  const ROTAS = ['GRU → LIS', 'GIG → MIA', 'BSB → GRU', 'CNF → SDU', 'GYN → CGH', 'REC → GRU', 'POA → EZE', 'GRU → MCO', 'SSA → GIG', 'FOR → LIS', 'GRU → SCL', 'VCP → CNF'];

  const ENTRADA_TIPOS = {
    clube: { nome: 'Clube', temCusto: true },
    compra: { nome: 'Compra de pontos', temCusto: true },
    transferencia: { nome: 'Transferência', temCusto: true },
    cartao: { nome: 'Cartão de crédito', temCusto: false },
    bonus: { nome: 'Bônus', temCusto: false },
    estorno: { nome: 'Estorno', temCusto: false },
    inicial: { nome: 'Saldo do sistema antigo', temCusto: false },
  };
  const SAIDA_TIPOS = {
    emissao: { nome: 'Emissão' },
    transferencia: { nome: 'Transferência' },
    expiracao: { nome: 'Expiração' },
    ajuste: { nome: 'Ajuste' },
  };

  // ---------- geração ----------
  const contas = [];
  let nConta = 0;

  // contas "de exemplo" com situações que o dono precisa ver
  const perfis = ['cheia', 'quase', 'folga', 'folga', 'folga', 'vencendo', 'folga', 'parada'];

  NOMES_TITULARES.forEach((titular, ti) => {
    const programas = ['smiles', 'latam', 'azul', 'livelo'].filter((p, i) => i === ti % 3 || rnd() < 0.55);
    programas.forEach((programaId) => {
      const programa = PROGRAMAS.find((p) => p.id === programaId);
      const perfil = pick(perfis);
      const conta = {
        id: 'c' + (++nConta),
        titular,
        programaId,
        clube: programaId !== 'livelo' && rnd() < 0.6 ? pick([1000, 2000, 3000, 5000]) : null,
        categoria: programaId === 'azul' ? pick(['Básico', 'Básico', 'Topázio', 'Safira']) : null,
        movimentos: [],
        perfil,
      };

      const mov = [];
      // saldo trazido do sistema antigo (lote antigo, às vezes perto de vencer)
      const inicial = int(15, 140) * 1000;
      mov.push({ tipo: 'inicial', lado: 'entrada', data: addDias(HOJE, -365), pontos: inicial, custo: 0,
        vence: iso(addDias(HOJE, perfil === 'vencendo' ? int(8, 40) : int(70, 420))) });

      for (let m = 11; m >= 0; m--) {
        const base = addDias(HOJE, -m * 30 - int(0, 6));
        if (conta.clube) mov.push({ tipo: 'clube', lado: 'entrada', data: base, pontos: conta.clube,
          custo: +(conta.clube * pick([0.0168, 0.0175, 0.019])).toFixed(2), vence: iso(addDias(base, 730)) });
        if (rnd() < 0.35) mov.push({ tipo: 'cartao', lado: 'entrada', data: addDias(base, 3), pontos: int(2, 18) * 500, custo: 0, vence: iso(addDias(base, 730)) });
        if (rnd() < 0.12 && programaId !== 'livelo') mov.push({ tipo: 'compra', lado: 'entrada', data: addDias(base, 9), pontos: int(10, 40) * 1000, custo: 0, vence: iso(addDias(base, 730)) });
        if (rnd() < 0.1) mov.push({ tipo: 'bonus', lado: 'entrada', data: addDias(base, 12), pontos: int(1, 10) * 1000, custo: 0, vence: iso(addDias(base, 365)) });
        if (rnd() < 0.12 && programaId !== 'livelo') mov.push({ tipo: 'transferencia', lado: 'entrada', data: addDias(base, 15), pontos: int(20, 80) * 1000, custo: 0, origem: 'Livelo', bonusPct: pick([0, 50, 80, 100]), vence: iso(addDias(base, 730)) });
      }
      mov.forEach((m) => { if (m.tipo === 'compra') m.custo = +(m.pontos * pick([0.014, 0.0155, 0.017])).toFixed(2); });
      mov.forEach((m) => { if (m.tipo === 'transferencia') m.custo = +(m.pontos / (1 + m.bonusPct / 100) * 0.03 * 0.5).toFixed(2); });

      // emissões: quantas pessoas diferentes já usaram a conta
      if (programaId !== 'livelo') {
        const limite = programaId === 'azul' ? CATEGORIA_AZUL[conta.categoria] : programa.limite;
        const alvo = perfil === 'cheia' ? limite : perfil === 'quase' ? limite - int(1, 2) : perfil === 'parada' ? 0 : int(1, Math.max(2, Math.floor(limite / 3)));
        const pool = [...NOMES_PASSAGEIROS].sort(() => rnd() - 0.5).slice(0, alvo);
        let p = 0;
        while (p < pool.length) {
          const grupo = pool.slice(p, p + int(1, 3));
          p += grupo.length;
          const data = addDias(HOJE, -int(5, 280));
          const pontos = grupo.length * int(9, 75) * 1000;
          mov.push({ tipo: 'emissao', lado: 'saida', data, pontos, passageiros: grupo, rota: pick(ROTAS), localizador: localizador() });
        }
      }
      if (programaId === 'livelo') {
        const destino = pick(['Smiles', 'Latam Pass', 'TudoAzul']);
        mov.push({ tipo: 'transferencia', lado: 'saida', data: addDias(HOJE, -int(20, 200)), pontos: int(20, 60) * 1000, destino });
      }
      if (rnd() < 0.15) mov.push({ tipo: 'ajuste', lado: 'saida', data: addDias(HOJE, -int(5, 120)), pontos: int(1, 9) * 100, obs: 'Saldo do programa menor que o do sistema' });

      // nada no futuro: o que cairia depois de hoje vira um dia antes de hoje
      mov.forEach((m) => { if (m.data > HOJE) m.data = addDias(HOJE, -int(1, 4)); });
      mov.sort((a, b) => a.data - b.data);

      // aplica em ordem: saída só acontece se tiver saldo; pontos consumidos dos lotes que vencem antes
      let saldo = 0;
      const lotes = [];
      // antes de uma emissão sem saldo suficiente, entra uma transferência da Livelo (como acontece de verdade)
      for (let i = 0, corrente = 0; i < mov.length; i++) {
        const m = mov[i];
        if (m.lado === 'entrada') corrente += m.pontos;
        else if (m.tipo === 'emissao' && m.pontos > corrente) {
          const falta = Math.ceil((m.pontos - corrente) / 1000) * 1000 + int(1, 10) * 1000;
          mov.splice(i, 0, { tipo: 'transferencia', lado: 'entrada', data: addDias(m.data, -1), pontos: falta, origem: 'Livelo', bonusPct: 0,
            custo: +(falta * 0.0155).toFixed(2), vence: iso(addDias(m.data, 729)) });
          corrente += falta; i++; corrente -= m.pontos;
        } else corrente -= m.pontos;
      }
      mov.sort((a, b) => a.data - b.data);
      mov.forEach((m) => {
        if (m.lado === 'entrada') {
          saldo += m.pontos;
          lotes.push({ pontos: m.pontos, resta: m.pontos, vence: m.vence, origem: ENTRADA_TIPOS[m.tipo].nome, data: iso(m.data) });
        } else {
          if (m.pontos > saldo) m.pontos = Math.floor(saldo / 1000) * 1000;
          if (m.pontos <= 0) { m.descartar = true; return; }
          saldo -= m.pontos;
          let falta = m.pontos;
          lotes.filter((l) => l.resta > 0).sort((a, b) => a.vence.localeCompare(b.vence)).forEach((l) => {
            const usa = Math.min(l.resta, falta); l.resta -= usa; falta -= usa;
          });
        }
        m.saldoDepois = saldo;
      });
      conta.movimentos = mov.filter((m) => !m.descartar).map((m) => ({ ...m, data: iso(m.data) }));
      conta.lotes = lotes.filter((l) => l.resta > 0).sort((a, b) => a.vence.localeCompare(b.vence));
      conta.saldo = saldo;
      contas.push(conta);
    });
  });

  // ---------- regras ----------
  const diasAte = (dataIso) => Math.round((new Date(dataIso + 'T12:00:00') - HOJE) / 86400000);
  const programa = (id) => PROGRAMAS.find((p) => p.id === id);

  function beneficiarios(conta) {
    const p = programa(conta.programaId);
    if (p.regra === 'nenhuma') return null;
    const limite = p.regra === 'manual' ? CATEGORIA_AZUL[conta.categoria] : p.limite;
    const porCpf = new Map();
    conta.movimentos.filter((m) => m.tipo === 'emissao').forEach((m) => {
      m.passageiros.forEach((pas) => {
        const atual = porCpf.get(pas.cpf);
        if (!atual || atual.ultima < m.data) porCpf.set(pas.cpf, { ...pas, primeira: atual ? atual.primeira : m.data, ultima: m.data });
      });
    });
    // beneficiários registrados à mão (ex.: CPF já usado fora do sistema ou cadastrado direto no programa)
    (conta.manuais || []).forEach((b) => {
      if (!porCpf.has(b.cpf)) porCpf.set(b.cpf, { nome: b.nome, cpf: b.cpf, primeira: b.data, ultima: b.data, manual: true });
    });
    let lista = [...porCpf.values()];
    lista.forEach((b) => {
      if (p.regra === 'ano') b.liberaEm = '2027-01-01';
      if (p.regra === 'janela') b.liberaEm = iso(addDias(new Date(b.ultima + 'T12:00:00'), 365));
      if (p.regra === 'manual') b.liberaEm = null;
    });
    if (p.regra === 'ano') lista = lista.filter((b) => b.ultima >= '2026-01-01');
    if (p.regra === 'janela') lista = lista.filter((b) => diasAte(b.liberaEm) > 0);
    lista.sort((a, b) => b.ultima.localeCompare(a.ultima));
    return { usados: lista.length, limite, livres: Math.max(0, limite - lista.length), lista, regra: p.renovacao };
  }

  function vencendo(conta, dias = 60) {
    const lotes = conta.lotes.filter((l) => diasAte(l.vence) <= dias);
    return { pontos: lotes.reduce((s, l) => s + l.resta, 0), lotes, primeiro: lotes[0] ? lotes[0].vence : null };
  }

  function custoReal(conta) {
    const ents = conta.movimentos.filter((m) => m.lado === 'entrada' && m.tipo !== 'inicial' && m.tipo !== 'estorno');
    const pts = ents.reduce((s, m) => s + m.pontos, 0);
    const custo = ents.reduce((s, m) => s + (m.custo || 0), 0);
    return pts ? custo / pts : null;
  }

  function alertas() {
    const lista = [];
    contas.forEach((c) => {
      const b = beneficiarios(c);
      const v = vencendo(c);
      if (v.pontos > 0) lista.push({ tipo: 'vencendo', conta: c, texto: `${fmt.pts(v.pontos)} pts vencem em ${diasAte(v.primeiro)} dias`, urgencia: 100 - diasAte(v.primeiro) });
      if (b && b.livres === 0) lista.push({ tipo: 'limite', conta: c, texto: `Sem vaga de beneficiário (${b.usados}/${b.limite})`, urgencia: 90 });
      else if (b && b.livres <= 2) lista.push({ tipo: 'quase', conta: c, texto: `Só ${b.livres} vaga${b.livres > 1 ? 's' : ''} de beneficiário`, urgencia: 60 });
    });
    return lista.sort((a, b) => b.urgencia - a.urgencia);
  }

  const fmt = {
    pts: (n) => Math.round(n).toLocaleString('pt-BR'),
    brl: (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    milha: (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
    data: (s) => s.split('-').reverse().join('/'),
    dataCurta: (s) => { const [, m, d] = s.split('-'); return `${d}/${m}`; },
    mesAno: (s) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    iniciais: (nome) => nome.split(' ').filter((p) => p.length > 2).slice(0, 2).map((p) => p[0]).join(''),
  };

  window.KV = {
    hoje: iso(HOJE), programas: PROGRAMAS, categoriasAzul: CATEGORIA_AZUL,
    entradaTipos: ENTRADA_TIPOS, saidaTipos: SAIDA_TIPOS,
    titulares: NOMES_TITULARES,
    contas: () => contas,
    // sem id: abre a conta com mais coisa acontecendo (beneficiários + vencimento), boa pra avaliar o layout
    conta: (id) => contas.find((c) => c.id === id) || [...contas].sort((a, b) =>
      ((beneficiarios(b) || { usados: 0 }).usados + (vencendo(b).pontos ? 10 : 0)) - ((beneficiarios(a) || { usados: 0 }).usados + (vencendo(a).pontos ? 10 : 0)))[0],
    programa, beneficiarios, vencendo, custoReal, alertas, diasAte, fmt,
    cpfTitular: (nome) => CPF_TITULAR[nome] || '—',
    custoRealPrograma: (id) => {
      const ents = contas.filter((c) => c.programaId === id).flatMap((c) => c.movimentos).filter((m) => m.lado === 'entrada' && m.tipo !== 'inicial' && m.tipo !== 'estorno');
      const pts = ents.reduce((s2, m) => s2 + m.pontos, 0);
      return pts ? ents.reduce((s2, m) => s2 + (m.custo || 0), 0) / pts : null;
    },
    // pontos que uma saída consumiria, dos lotes que vencem antes
    lotesConsumidos: (conta, pontos) => {
      let falta = pontos; const usados = [];
      conta.lotes.forEach((l) => { if (falta <= 0) return; const usa = Math.min(l.resta, falta); falta -= usa; usados.push({ ...l, usa }); });
      return { usados, falta: Math.max(0, falta) };
    },
    adicionarBeneficiario: (contaId, b) => { const c = contas.find((x) => x.id === contaId); (c.manuais = c.manuais || []).push(b); return c; },
    valorEmReais: (c) => c.saldo * programa(c.programaId).valorMilha,
  };
})();

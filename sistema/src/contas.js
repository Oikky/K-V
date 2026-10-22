// Contas de pontos com o que é calculado (nunca digitado): saldo, lotes que ainda têm pontos, vencimentos e
// vagas de beneficiário. As regras dos programas estão em CONTEXT.md e na tabela programas.
import { hojeBR } from './acoes.js';

const todos = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;

const somaDias = (dia, n) => { const d = new Date(dia + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// filtro opcional: { programa } ou { ids: [...] }
export async function contasCompletas(env, filtro = {}) {
  const db = env.DB, hoje = hojeBR();
  let onde = '1 = 1', args = [];
  if (filtro.programa) { onde = 'c.programa_id = ?'; args = [filtro.programa]; }
  if (filtro.ids) { onde = `c.id IN (${filtro.ids.map(() => '?').join(',') || 'NULL'})`; args = filtro.ids; }
  const contas = await todos(db, `
    SELECT c.id, c.titular_id, p.nome AS titular, p.cpf AS titular_cpf, c.programa_id, c.clube, c.clube_custo, c.categoria, c.numero, c.ativa, c.obs,
           pr.nome AS programa, pr.limite, pr.regra, pr.renovacao, pr.valor_milha,
           COALESCE((SELECT SUM(CASE m.lado WHEN 'entrada' THEN m.pontos ELSE -m.pontos END) FROM movimentos m WHERE m.conta_id = c.id), 0) AS saldo,
           -- custo real: o que se pagou pelos pontos que entraram (sem saldo antigo, estorno, nem o que veio do Superhuman, que não anotava custo)
           (SELECT SUM(m.custo) FROM movimentos m WHERE m.conta_id = c.id AND m.lado = 'entrada' AND m.tipo NOT IN ('inicial', 'estorno') AND m.criado_por <> 'superhuman') AS custo_total,
           (SELECT SUM(m.pontos) FROM movimentos m WHERE m.conta_id = c.id AND m.lado = 'entrada' AND m.tipo NOT IN ('inicial', 'estorno') AND m.criado_por <> 'superhuman') AS custo_pontos
    FROM contas c JOIN pessoas p ON p.id = c.titular_id JOIN programas pr ON pr.id = c.programa_id
    WHERE ${onde} ORDER BY p.nome COLLATE NOCASE`, ...args);
  if (!contas.length) return [];
  // as mesmas contas, por subconsulta: uma lista de ids passaria do limite de 100 valores por consulta do D1
  const dasContas = `(SELECT c.id FROM contas c WHERE ${onde})`;
  const [lotes, voaram, manuais, categorias, extras] = await Promise.all([
    todos(db, `SELECT id, conta_id, vence, resta, data, tipo, origem FROM movimentos WHERE conta_id IN ${dasContas} AND lado = 'entrada' AND resta > 0
               ORDER BY conta_id, vence IS NULL, vence, data, id`, ...args),
    // quem voou por cada conta e quando foi a última vez (emissões não canceladas)
    todos(db, `SELECT e.conta_id, ep.pessoa_id, ps.nome, ps.cpf, MAX(m.data) AS ultima FROM emissoes e
               JOIN emissao_passageiros ep ON ep.emissao_id = e.id JOIN movimentos m ON m.emissao_id = e.id AND m.lado = 'saida'
               JOIN pessoas ps ON ps.id = ep.pessoa_id
               WHERE e.conta_id IN ${dasContas} AND e.cancelada = 0 GROUP BY e.conta_id, ep.pessoa_id`, ...args),
    todos(db, `SELECT b.conta_id, b.pessoa_id, ps.nome, ps.cpf, b.data AS ultima FROM beneficiarios_manuais b JOIN pessoas ps ON ps.id = b.pessoa_id
               WHERE b.conta_id IN ${dasContas}`, ...args),
    todos(db, 'SELECT programa_id, nome, limite FROM categorias'),
    // vagas a mais que o programa liberou pra conta (valem até a data, ou até alguém desligar)
    todos(db, `SELECT id, conta_id, vagas, ate, motivo, criada_em FROM vagas_extras WHERE conta_id IN ${dasContas} AND desligada_em IS NULL AND (ate IS NULL OR ate >= ?)
               ORDER BY id`, ...args, hoje),
  ]);
  const nomes = Object.fromEntries([...voaram, ...manuais].map((b) => [b.pessoa_id, { nome: b.nome, cpf: b.cpf }]));
  const ano = hoje.slice(0, 4);
  const umAnoAntes = (() => { const d = new Date(hoje + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 365); return d.toISOString().slice(0, 10); })();
  const em60 = (() => { const d = new Date(hoje + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 60); return d.toISOString().slice(0, 10); })();

  return contas.map((c) => {
    const meus = lotes.filter((l) => l.conta_id === c.id).map(({ id, vence, resta, data, tipo, origem }) => ({ id, vence, resta, data, tipo, origem }));
    const vencendo = meus.filter((l) => l.vence && l.vence <= em60);
    let beneficiarios = null;
    if (c.regra !== 'nenhuma') {
      const base = c.regra === 'manual' ? (categorias.find((k) => k.programa_id === c.programa_id && k.nome === c.categoria) || {}).limite ?? c.limite : c.limite;
      const porPessoa = new Map();
      [...voaram.map((b) => ({ ...b, manual: false })), ...manuais.map((b) => ({ ...b, manual: true }))]
        .filter((b) => b.conta_id === c.id && b.pessoa_id !== c.titular_id).forEach((b) => {
          const u = porPessoa.get(b.pessoa_id); if (!u || u.ultima < b.ultima) porPessoa.set(b.pessoa_id, { ultima: b.ultima, manual: b.manual && !(u && !u.manual) });
        });
      const minhasExtras = extras.filter((x) => x.conta_id === c.id);
      const limite = base + minhasExtras.reduce((t, x) => t + x.vagas, 0);
      let lista = [...porPessoa.entries()].map(([pessoa_id, b]) => ({ pessoa_id, ...b, ...(nomes[pessoa_id] || {}) }));
      if (c.regra === 'ano') lista = lista.filter((b) => b.ultima >= `${ano}-01-01`);
      if (c.regra === 'janela') lista = lista.filter((b) => b.ultima > umAnoAntes);
      // quando a vaga volta: 1º de janeiro (Smiles), 12 meses depois (Latam) ou só na troca manual (Azul)
      lista.forEach((b) => { b.liberaEm = c.regra === 'ano' ? `${+ano + 1}-01-01` : c.regra === 'janela' ? somaDias(b.ultima, 365) : null; });
      lista.sort((a, b) => b.ultima.localeCompare(a.ultima));
      beneficiarios = { limite, base, extras: minhasExtras, usados: lista.length, livres: Math.max(0, limite - lista.length), lista };
    }
    const { custo_total, custo_pontos } = c;
    return { ...c, custo_real: custo_pontos ? Math.round(custo_total * 1e4 / custo_pontos) : null, lotes: meus, vencendo: { pontos: vencendo.reduce((s, l) => s + l.resta, 0), primeiro: vencendo[0]?.vence || null }, beneficiarios };
  });
}

// uma conta com o extrato inteiro (o saldo depois de cada movimento é calculado aqui)
export async function contaDetalhe(env, id) {
  const [c] = await contasCompletas(env, { ids: [id] });
  if (!c) return null;
  const movs = await todos(env.DB, `
    SELECT m.id, m.lado, m.tipo, m.data, m.pontos, m.custo, m.vence, m.resta, m.bonus_pct, m.origem, m.obs, m.par_id, m.emissao_id,
           pc.programa_id AS par_programa, pp.nome AS par_titular,
           e.localizador, e.orcamento_id,
           (SELECT GROUP_CONCAT(ps.nome, ', ') FROM emissao_passageiros ep JOIN pessoas ps ON ps.id = ep.pessoa_id WHERE ep.emissao_id = m.emissao_id) AS passageiros
    FROM movimentos m
    LEFT JOIN movimentos par ON par.id = m.par_id LEFT JOIN contas pc ON pc.id = par.conta_id LEFT JOIN pessoas pp ON pp.id = pc.titular_id
    LEFT JOIN emissoes e ON e.id = m.emissao_id
    WHERE m.conta_id = ? ORDER BY m.data, m.id`, id);
  let saldo = 0;
  movs.forEach((m) => { saldo += m.lado === 'entrada' ? m.pontos : -m.pontos; m.saldo_depois = saldo; });
  return { ...c, movimentos: movs };
}

// um movimento com tudo o que explica ele: de qual voo foi (emissão), quem voou, de quais lotes saiu / quem usou o lote,
// a outra ponta da transferência, quem lançou e, se veio do documento antigo, a linha original de lá
export async function movimentoDetalhe(env, id) {
  const db = env.DB;
  const m = await db.prepare(`SELECT m.*, c.titular_id, p.nome AS titular, pr.nome AS programa, c.programa_id, u.nome AS lancado_por
    FROM movimentos m JOIN contas c ON c.id = m.conta_id JOIN pessoas p ON p.id = c.titular_id JOIN programas pr ON pr.id = c.programa_id
    LEFT JOIN usuarios u ON u.email = m.criado_por WHERE m.id = ?`).bind(id).first();
  if (!m) return null;
  const [par, lotes, usos, coda] = await Promise.all([
    m.par_id ? db.prepare(`SELECT m.id, m.conta_id, m.pontos, m.lado, p.nome AS titular, pr.nome AS programa FROM movimentos m JOIN contas c ON c.id = m.conta_id
      JOIN pessoas p ON p.id = c.titular_id JOIN programas pr ON pr.id = c.programa_id WHERE m.id = ?`).bind(m.par_id).first() : null,
    // saída: de quais lotes saiu
    m.lado === 'saida' ? todos(db, `SELECT l.id, l.tipo, l.data, l.vence, l.origem, c.pontos FROM consumos c JOIN movimentos l ON l.id = c.lote_id
      WHERE c.saida_id = ? ORDER BY l.vence, l.data`, id) : [],
    // entrada: quem usou os pontos deste lote
    m.lado === 'entrada' ? todos(db, `SELECT s.id, s.tipo, s.data, s.obs, s.emissao_id, c.pontos FROM consumos c JOIN movimentos s ON s.id = c.saida_id
      WHERE c.lote_id = ? ORDER BY s.data, s.id`, id) : [],
    m.coda_id ? db.prepare("SELECT tabela, dados FROM superhuman WHERE coda_id = ? AND tabela IN ('Entrada', 'Saída')").bind(m.coda_id).first() : null,
  ]);
  let emissao = null;
  if (m.emissao_id) {
    const e = await db.prepare(`SELECT e.*, o.contato_nome, o.combo_aceita, o.etapa FROM emissoes e JOIN orcamentos o ON o.id = e.orcamento_id WHERE e.id = ?`).bind(m.emissao_id).first();
    if (e) {
      const [trecho, passageiros, combo] = await Promise.all([
        db.prepare('SELECT de, para, data FROM trechos WHERE orcamento_id = ? AND ordem = ?').bind(e.orcamento_id, e.trecho).first(),
        todos(db, 'SELECT ps.id, ps.nome, ps.cpf FROM emissao_passageiros ep JOIN pessoas ps ON ps.id = ep.pessoa_id WHERE ep.emissao_id = ? ORDER BY ps.nome', e.id),
        e.combo_aceita ? db.prepare('SELECT escolha FROM combos WHERE id = ?').bind(e.combo_aceita).first() : null,
      ]);
      const opId = combo ? JSON.parse(combo.escolha)[e.trecho] : null;
      const voo = opId ? await db.prepare('SELECT site, cia, voo, data, sai, chega, de, para, escalas, duracao FROM opcoes WHERE id = ?').bind(opId).first() : null;
      emissao = { id: e.id, orcamento_id: e.orcamento_id, contato: e.contato_nome, etapa: e.etapa, trecho: e.trecho, localizador: e.localizador, obs: e.obs,
        cancelada: !!e.cancelada, cancelada_em: e.cancelada_em, cancelada_obs: e.cancelada_obs, devolvido: e.devolvido, em: e.em, rota: trecho, voo, passageiros };
    }
  }
  return { ...m, par, lotes, usos, emissao, coda: coda ? { tabela: coda.tabela, dados: JSON.parse(coda.dados) } : null };
}

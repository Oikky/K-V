// Contas de pontos com o que é calculado (nunca digitado): saldo, lotes que ainda têm pontos, vencimentos e
// vagas de beneficiário. As regras dos programas estão em CONTEXT.md e na tabela programas.
import { hojeBR } from './acoes.js';

const todos = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;

// filtro opcional: { programa } ou { ids: [...] }
export async function contasCompletas(env, filtro = {}) {
  const db = env.DB, hoje = hojeBR();
  let onde = '1 = 1', args = [];
  if (filtro.programa) { onde = 'c.programa_id = ?'; args = [filtro.programa]; }
  if (filtro.ids) { onde = `c.id IN (${filtro.ids.map(() => '?').join(',') || 'NULL'})`; args = filtro.ids; }
  const contas = await todos(db, `
    SELECT c.id, c.titular_id, p.nome AS titular, p.cpf AS titular_cpf, c.programa_id, c.clube, c.categoria, c.ativa,
           pr.nome AS programa, pr.limite, pr.regra,
           COALESCE((SELECT SUM(CASE m.lado WHEN 'entrada' THEN m.pontos ELSE -m.pontos END) FROM movimentos m WHERE m.conta_id = c.id), 0) AS saldo
    FROM contas c JOIN pessoas p ON p.id = c.titular_id JOIN programas pr ON pr.id = c.programa_id
    WHERE ${onde} ORDER BY p.nome COLLATE NOCASE`, ...args);
  if (!contas.length) return [];
  const ids = contas.map((c) => c.id), marcas = ids.map(() => '?').join(',');
  const [lotes, voaram, manuais, categorias] = await Promise.all([
    todos(db, `SELECT id, conta_id, vence, resta, data FROM movimentos WHERE conta_id IN (${marcas}) AND lado = 'entrada' AND resta > 0
               ORDER BY conta_id, vence IS NULL, vence, data, id`, ...ids),
    // quem voou por cada conta e quando foi a última vez (emissões não canceladas)
    todos(db, `SELECT e.conta_id, ep.pessoa_id, MAX(m.data) AS ultima FROM emissoes e
               JOIN emissao_passageiros ep ON ep.emissao_id = e.id JOIN movimentos m ON m.emissao_id = e.id AND m.lado = 'saida'
               WHERE e.conta_id IN (${marcas}) AND e.cancelada = 0 GROUP BY e.conta_id, ep.pessoa_id`, ...ids),
    todos(db, `SELECT conta_id, pessoa_id, data AS ultima FROM beneficiarios_manuais WHERE conta_id IN (${marcas})`, ...ids),
    todos(db, 'SELECT programa_id, nome, limite FROM categorias'),
  ]);
  const ano = hoje.slice(0, 4);
  const umAnoAntes = (() => { const d = new Date(hoje + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 365); return d.toISOString().slice(0, 10); })();
  const em60 = (() => { const d = new Date(hoje + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 60); return d.toISOString().slice(0, 10); })();

  return contas.map((c) => {
    const meus = lotes.filter((l) => l.conta_id === c.id).map(({ id, vence, resta, data }) => ({ id, vence, resta, data }));
    const vencendo = meus.filter((l) => l.vence && l.vence <= em60);
    let beneficiarios = null;
    if (c.regra !== 'nenhuma') {
      const limite = c.regra === 'manual' ? (categorias.find((k) => k.programa_id === c.programa_id && k.nome === c.categoria) || {}).limite ?? c.limite : c.limite;
      const porPessoa = new Map();
      [...voaram, ...manuais].filter((b) => b.conta_id === c.id && b.pessoa_id !== c.titular_id).forEach((b) => {
        const u = porPessoa.get(b.pessoa_id); if (!u || u < b.ultima) porPessoa.set(b.pessoa_id, b.ultima);
      });
      let lista = [...porPessoa.entries()].map(([pessoa_id, ultima]) => ({ pessoa_id, ultima }));
      if (c.regra === 'ano') lista = lista.filter((b) => b.ultima >= `${ano}-01-01`);
      if (c.regra === 'janela') lista = lista.filter((b) => b.ultima > umAnoAntes);
      beneficiarios = { limite, usados: lista.length, livres: Math.max(0, limite - lista.length), lista };
    }
    return { ...c, lotes: meus, vencendo: { pontos: vencendo.reduce((s, l) => s + l.resta, 0), primeiro: vencendo[0]?.vence || null }, beneficiarios };
  });
}

// Leituras do cadastro de pessoas (só o dono): a lista toda e com quem alguém costuma viajar.
const todos = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;

export const listarPessoas = (env) => todos(env.DB, `SELECT id, nome, cpf, nascimento, whatsapp, email, passaporte_numero, passaporte_validade, obs
  FROM pessoas ORDER BY nome COLLATE NOCASE`);

// quem viajou junto com a pessoa (ou pagou viagens dela), do mais frequente pro menos
export async function viajaCom(env, id) {
  return todos(env.DB, `
    WITH dela AS (
      SELECT o.id FROM orcamentos o WHERE o.cliente_id = ?1
      UNION SELECT op.orcamento_id FROM orcamento_passageiros op WHERE op.pessoa_id = ?1)
    SELECT pessoa_id AS id, SUM(n) AS juntos FROM (
      SELECT op.pessoa_id, 1 AS n FROM orcamento_passageiros op WHERE op.orcamento_id IN (SELECT id FROM dela) AND op.pessoa_id <> ?1
      UNION ALL SELECT o.cliente_id, 0 FROM orcamentos o WHERE o.id IN (SELECT id FROM dela) AND o.cliente_id IS NOT NULL AND o.cliente_id <> ?1)
    GROUP BY pessoa_id ORDER BY juntos DESC`, id);
}

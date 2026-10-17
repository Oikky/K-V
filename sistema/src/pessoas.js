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

// Clientes: todas as pessoas e as viagens fechadas (fechado, emitido, cancelado) com o que a tela precisa pra calcular
// a venda (combinação aceita e as opções dela), quem voou, quem pagou, recebimento e localizadores.
export async function clientes(env) {
  const db = env.DB;
  const [pessoas, orcs] = await Promise.all([
    listarPessoas(env),
    todos(db, `SELECT id, cliente_id, etapa, adultos, criancas, bebes, combo_aceita, receb_forma, receb_parcelas, receb_recebido, criado_em
               FROM orcamentos WHERE etapa IN ('fechado', 'emitido', 'cancelado') AND combo_aceita IS NOT NULL`),
  ]);
  if (!orcs.length) return { pessoas, viagens: [] };
  const ids = orcs.map((o) => o.id), m = ids.map(() => '?').join(',');
  const [trechos, combos, pax, emissoes] = await Promise.all([
    todos(db, `SELECT orcamento_id, de, para, data FROM trechos WHERE orcamento_id IN (${m}) ORDER BY orcamento_id, ordem`, ...ids),
    todos(db, `SELECT id, orcamento_id, nome, escolha, milha, livre, parcelado, vezes FROM combos WHERE id IN (${orcs.map(() => '?').join(',')})`, ...orcs.map((o) => o.combo_aceita)),
    todos(db, `SELECT orcamento_id, pessoa_id FROM orcamento_passageiros WHERE orcamento_id IN (${m}) ORDER BY orcamento_id, ordem`, ...ids),
    todos(db, `SELECT e.orcamento_id, e.trecho, e.localizador, e.cancelada, e.devolvido, c.programa_id FROM emissoes e LEFT JOIN contas c ON c.id = e.conta_id
               WHERE e.orcamento_id IN (${m}) ORDER BY e.orcamento_id, e.trecho`, ...ids),
  ]);
  const escolhas = [...new Set(combos.flatMap((c) => JSON.parse(c.escolha)))];
  const opcoes = escolhas.length ? await todos(db, `SELECT id, trecho, site, data, milhas, taxa, preco FROM opcoes WHERE id IN (${escolhas.map(() => '?').join(',')})`, ...escolhas) : [];
  const viagens = orcs.map((o) => {
    const c = combos.find((x) => x.id === o.combo_aceita);
    return {
      id: o.id, clienteId: o.cliente_id, etapa: o.etapa, criadoEm: o.criado_em,
      passageiros: { adultos: o.adultos, criancas: o.criancas, bebes: o.bebes },
      trechos: trechos.filter((t) => t.orcamento_id === o.id).map(({ de, para, data }) => ({ de, para, data })),
      passageirosIds: pax.filter((p) => p.orcamento_id === o.id).map((p) => p.pessoa_id),
      combo: c ? { ...c, escolha: JSON.parse(c.escolha), milha: JSON.parse(c.milha || '{}') } : null,
      opcoes: c ? opcoes.filter((x) => JSON.parse(c.escolha).includes(x.id)) : [],
      receb: { forma: o.receb_forma, parcelas: o.receb_parcelas, recebido: o.receb_recebido },
      emissoes: emissoes.filter((e) => e.orcamento_id === o.id).map(({ trecho, localizador, cancelada, devolvido, programa_id }) => ({ trecho, localizador, cancelada: !!cancelada, devolvido, programa_id })),
    };
  });
  return { pessoas, viagens };
}

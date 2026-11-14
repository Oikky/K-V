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
    todos(db, `SELECT id, cliente_id, etapa, adultos, criancas, bebes, combo_aceita, receb_forma, receb_parcelas, receb_recebido, receb_previsto, criado_em,
               -- quando fechou (o financeiro conta a venda nesse mês); os importados não têm o evento e usam a criação
               (SELECT MIN(e.quando) FROM eventos e WHERE e.entidade = 'orcamento' AND e.entidade_id = CAST(o.id AS TEXT) AND e.acao = 'fech.salvar' AND e.texto LIKE 'Fechou%') AS fechado_em
               FROM orcamentos o WHERE etapa IN ('fechado', 'emitido', 'cancelado') AND combo_aceita IS NOT NULL`),
  ]);
  if (!orcs.length) return { pessoas, viagens: [] };
  // as viagens fechadas por subconsulta: uma lista de ids passaria do limite de 100 valores por consulta do D1
  const fechadas = "(SELECT id FROM orcamentos WHERE etapa IN ('fechado', 'emitido', 'cancelado') AND combo_aceita IS NOT NULL)";
  const aceitas = "(SELECT combo_aceita FROM orcamentos WHERE etapa IN ('fechado', 'emitido', 'cancelado') AND combo_aceita IS NOT NULL)";
  const [trechos, combos, pax, emissoes, opcoes] = await Promise.all([
    todos(db, `SELECT orcamento_id, ordem, de, para, data FROM trechos WHERE orcamento_id IN ${fechadas} ORDER BY orcamento_id, ordem`),
    todos(db, `SELECT id, orcamento_id, nome, escolha, milha, livre, parcelado, vezes FROM combos WHERE id IN ${aceitas}`),
    todos(db, `SELECT orcamento_id, pessoa_id FROM orcamento_passageiros WHERE orcamento_id IN ${fechadas} ORDER BY orcamento_id, ordem`),
    todos(db, `SELECT e.orcamento_id, e.trecho, e.localizador, e.cancelada, e.devolvido, c.programa_id FROM emissoes e LEFT JOIN contas c ON c.id = e.conta_id
               WHERE e.orcamento_id IN ${fechadas} ORDER BY e.orcamento_id, e.trecho`),
    // as opções escolhidas nas combinações aceitas (a escolha é uma lista JSON de ids)
    todos(db, `SELECT id, trecho, site, data, milhas, taxa, preco FROM opcoes
               WHERE id IN (SELECT j.value FROM combos c, json_each(c.escolha) j WHERE c.id IN ${aceitas})`),
  ]);
  const viagens = orcs.map((o) => {
    const c = combos.find((x) => x.id === o.combo_aceita);
    return {
      id: o.id, clienteId: o.cliente_id, etapa: o.etapa, criadoEm: o.criado_em, fechadoEm: o.fechado_em || o.criado_em,
      passageiros: { adultos: o.adultos, criancas: o.criancas, bebes: o.bebes },
      // só os trechos do roteiro aceito; ordem = posição do trecho (as emissões apontam pra ela)
      trechos: trechos.filter((t) => t.orcamento_id === o.id && (!c || JSON.parse(c.escolha)[t.ordem] != null)).map(({ ordem, de, para, data }) => ({ ordem, de, para, data })),
      passageirosIds: pax.filter((p) => p.orcamento_id === o.id).map((p) => p.pessoa_id),
      combo: c ? { ...c, escolha: JSON.parse(c.escolha), milha: JSON.parse(c.milha || '{}') } : null,
      opcoes: c ? opcoes.filter((x) => JSON.parse(c.escolha).includes(x.id)) : [],
      receb: { forma: o.receb_forma, parcelas: o.receb_parcelas, recebido: o.receb_recebido, previsto: o.receb_previsto },
      emissoes: emissoes.filter((e) => e.orcamento_id === o.id).map(({ trecho, localizador, cancelada, devolvido, programa_id }) => ({ trecho, localizador, cancelada: !!cancelada, devolvido, programa_id })),
    };
  });
  return { pessoas, viagens };
}

// Financeiro (só o dono): o que se pagou por pontos (clube, compra, transferência), por mês e tipo.
// Vendas, recebimentos e folha a tela tira de /api/clientes e /api/ponto, com as mesmas contas das outras telas.
export const custosPontos = (env) => todos(env.DB, `SELECT substr(m.data, 1, 7) AS mes, m.tipo, c.programa_id AS programa, SUM(m.custo) AS custo, SUM(m.pontos) AS pontos
  FROM movimentos m JOIN contas c ON c.id = m.conta_id
  WHERE m.lado = 'entrada' AND m.custo > 0 GROUP BY mes, m.tipo, c.programa_id ORDER BY mes`);

// tudo o que foi pago nos cartões: entradas de pontos com custo e emissões (taxa ou passagem em dinheiro)
export const gastosCartao = (env) => todos(env.DB, `
  SELECT 'mov' AS origem, m.id, m.cartao_id, m.data, m.custo AS valor, m.parcelas, m.tipo, p.nome AS quem, c.programa_id AS programa, NULL AS orcamento_id
    FROM movimentos m JOIN contas c ON c.id = m.conta_id JOIN pessoas p ON p.id = c.titular_id
    WHERE m.cartao_id IS NOT NULL AND m.custo > 0
  UNION ALL
  SELECT 'emi', e.id, e.cartao_id, COALESCE((SELECT s.data FROM movimentos s WHERE s.emissao_id = e.id AND s.lado = 'saida'), substr(e.em, 1, 10)), e.pago, 1,
         CASE WHEN e.conta_id IS NULL THEN 'passagem' ELSE 'taxa' END, t.de || ' → ' || t.para, NULL, e.orcamento_id
    FROM emissoes e LEFT JOIN trechos t ON t.orcamento_id = e.orcamento_id AND t.ordem = e.trecho
    WHERE e.cartao_id IS NOT NULL AND e.pago > 0 AND e.cancelada = 0
  ORDER BY 4`);

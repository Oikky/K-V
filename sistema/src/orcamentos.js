// Lista da fila de orçamentos. O dono vê todos; quem pesquisa vê só o que está na fila ou em pesquisa
// (o corte é feito aqui, antes de sair do servidor). O WhatsApp todos veem (2026-11-14: todos editam o pedido).
import { ehDono } from './acoes.js';

const todos = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;

export async function listarOrcamentos(env, usuario) {
  const db = env.DB, dono = ehDono(usuario);
  const filtro = dono ? '' : "WHERE o.etapa IN ('novo', 'pesquisa')";
  // as duas leituras saem juntas
  const [linhas, trechos] = await Promise.all([todos(db, `
    SELECT o.id, o.contato_nome, o.contato_whatsapp, o.etapa, o.responsavel, o.adultos, o.criancas, o.bebes,
           o.pedido, o.observacao, o.faltando, o.origem, o.audio, o.criado_em,
           (SELECT COUNT(*) FROM opcoes p WHERE p.orcamento_id = o.id) AS n_opcoes,
           (SELECT COUNT(*) FROM conferencia c WHERE c.orcamento_id = o.id) AS n_conf,
           (SELECT COUNT(*) FROM conferencia c WHERE c.orcamento_id = o.id AND c.feito = 1) AS n_feitos,
           (SELECT MAX(e.quando) FROM eventos e WHERE e.entidade = 'orcamento' AND e.entidade_id = CAST(o.id AS TEXT)
              AND e.texto = 'Marcou como pesquisado') AS pesquisado_em
    FROM orcamentos o ${filtro} ORDER BY o.id`),
  todos(db, `SELECT t.orcamento_id, t.de, t.para, t.data, t.janela, t.outras_datas, t.roteiro FROM trechos t
    JOIN orcamentos o ON o.id = t.orcamento_id ${filtro} ORDER BY t.orcamento_id, t.ordem`)]);
  const porOrc = {};
  for (const t of trechos) (porOrc[t.orcamento_id] ||= []).push({ de: t.de, para: t.para, data: t.data, janela: !!t.janela, outrasDatas: JSON.parse(t.outras_datas || '[]'), roteiro: t.roteiro });

  return linhas.map((o) => ({
    id: o.id,
    contato: { nome: o.contato_nome, whatsapp: o.contato_whatsapp },
    etapa: o.etapa,
    responsavel: o.responsavel,
    passageiros: { adultos: o.adultos, criancas: o.criancas, bebes: o.bebes },
    pedido: o.pedido,
    observacao: o.observacao,
    faltando: JSON.parse(o.faltando || '[]'),
    origem: o.origem,
    audio: !!o.audio,
    criadoEm: o.criado_em,
    pesquisadoEm: o.pesquisado_em,
    nOpcoes: o.n_opcoes,
    conferencia: { feitos: o.n_feitos, total: o.n_conf },
    trechos: porOrc[o.id] || [],
  }));
}

// Um orçamento inteiro (tela de pesquisa, proposta, fechamento e emissão).
// Quem pesquisa abre o que está na fila, em pesquisa (dele ou de outra pessoa, pra poder assumir) ou com ele; nunca recebe combinações nem recebimento.
export async function abrirOrcamento(env, usuario, id) {
  const db = env.DB, dono = ehDono(usuario);
  const o = Number.isInteger(id) ? await db.prepare('SELECT * FROM orcamentos WHERE id = ?').bind(id).first() : null;
  if (!o) return null;
  if (!dono && !['novo', 'pesquisa'].includes(o.etapa) && o.responsavel !== usuario.email) return null;
  const [trechos, conferencia, opcoes] = await Promise.all([
    todos(db, 'SELECT de, para, data, janela, outras_datas, roteiro FROM trechos WHERE orcamento_id = ? ORDER BY ordem', id),
    todos(db, 'SELECT ordem, texto, feito FROM conferencia WHERE orcamento_id = ? ORDER BY ordem', id),
    todos(db, `SELECT id, trecho, site, data, sai, chega, cia, voo, escalas, bagagem, milhas, taxa, preco, link, obs, criada_por,
                      de, para, duracao, escalas_onde, milhas_mala, mala_mao, destaque, cabine
               FROM opcoes WHERE orcamento_id = ? ORDER BY id`, id),
  ]);
  const base = {
    id: o.id, etapa: o.etapa, responsavel: o.responsavel, antesDePerder: o.antes_de_perder, motivo: o.motivo,
    contato: { nome: o.contato_nome, whatsapp: o.contato_whatsapp },
    pessoaId: dono ? o.pessoa_id : null,
    passageiros: { adultos: o.adultos, criancas: o.criancas, bebes: o.bebes },
    pedido: o.pedido, observacao: o.observacao, skyscanner: o.skyscanner || '', sky: JSON.parse(o.sky || '[]'), faltando: JSON.parse(o.faltando || '[]'),
    origem: o.origem, textoOriginal: o.texto_original, audio: !!o.audio, criadoEm: o.criado_em,
    trechos: trechos.map((t) => ({ de: t.de, para: t.para, data: t.data, janela: !!t.janela, outrasDatas: JSON.parse(t.outras_datas || '[]'), roteiro: t.roteiro })),
    conferencia: conferencia.map((c) => ({ ...c, feito: !!c.feito })),
    opcoes: opcoes.map((p) => ({ ...p, escalasOnde: p.escalas_onde ? JSON.parse(p.escalas_onde) : null, escalas_onde: undefined })),
  };
  if (!dono) return base;

  const [combos, pax, emissoes, emPax, historico] = await Promise.all([
    todos(db, 'SELECT id, ordem, nome, escolha, milha, livre, parcelado, vezes FROM combos WHERE orcamento_id = ? ORDER BY ordem', id),
    todos(db, `SELECT p.id, p.nome, p.cpf, p.nascimento, p.whatsapp, p.passaporte_numero, p.passaporte_validade
               FROM orcamento_passageiros op JOIN pessoas p ON p.id = op.pessoa_id WHERE op.orcamento_id = ? ORDER BY op.ordem`, id),
    todos(db, 'SELECT id, trecho, conta_id, pontos, localizador, cancelada, cancelada_em, cancelada_obs, devolvido, obs, cartao_id, pago, em FROM emissoes WHERE orcamento_id = ? ORDER BY trecho', id),
    todos(db, 'SELECT ep.emissao_id, ep.pessoa_id FROM emissao_passageiros ep JOIN emissoes e ON e.id = ep.emissao_id WHERE e.orcamento_id = ?', id),
    todos(db, `SELECT e.quando, e.quem, COALESCE(u.nome, CASE e.quem WHEN 'bot' THEN 'Bot do Telegram' ELSE e.quem END) AS nome, e.texto
               FROM eventos e LEFT JOIN usuarios u ON u.email = e.quem
               WHERE e.entidade = 'orcamento' AND e.entidade_id = ? ORDER BY e.id`, String(id)),
  ]);
  const cliente = o.cliente_id ? await db.prepare('SELECT id, nome, cpf, whatsapp FROM pessoas WHERE id = ?').bind(o.cliente_id).first() : null;
  return {
    ...base,
    clienteId: o.cliente_id, cliente,
    enviadaEm: o.enviada_em, aceita: o.combo_aceita, mensagem: o.mensagem || null,
    receb: { forma: o.receb_forma, parcelas: o.receb_parcelas, recebido: o.receb_recebido, previsto: o.receb_previsto },
    combos: combos.map((c) => ({ ...c, escolha: JSON.parse(c.escolha), milha: JSON.parse(c.milha || '{}') })),
    passageirosLista: pax,
    emissoes: emissoes.map((e) => ({ ...e, cancelada: !!e.cancelada, passageiros: emPax.filter((x) => x.emissao_id === e.id).map((x) => x.pessoa_id) })),
    historico,
  };
}

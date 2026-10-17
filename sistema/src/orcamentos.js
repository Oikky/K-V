// Lista da fila de orçamentos. O dono vê todos; quem pesquisa vê só o que está na fila ou em pesquisa,
// sem o WhatsApp do contato (o corte é feito aqui, antes de sair do servidor).
import { ehDono } from './acoes.js';

const todos = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;

export async function listarOrcamentos(env, usuario) {
  const db = env.DB, dono = ehDono(usuario);
  const filtro = dono ? '' : "WHERE o.etapa IN ('novo', 'pesquisa')";
  const linhas = await todos(db, `
    SELECT o.id, o.contato_nome, o.contato_whatsapp, o.etapa, o.responsavel, o.adultos, o.criancas, o.bebes,
           o.pedido, o.observacao, o.faltando, o.origem, o.audio, o.criado_em,
           (SELECT COUNT(*) FROM opcoes p WHERE p.orcamento_id = o.id) AS n_opcoes,
           (SELECT COUNT(*) FROM conferencia c WHERE c.orcamento_id = o.id) AS n_conf,
           (SELECT COUNT(*) FROM conferencia c WHERE c.orcamento_id = o.id AND c.feito = 1) AS n_feitos,
           (SELECT MAX(e.quando) FROM eventos e WHERE e.entidade = 'orcamento' AND e.entidade_id = CAST(o.id AS TEXT)
              AND e.texto = 'Marcou como pesquisado') AS pesquisado_em
    FROM orcamentos o ${filtro} ORDER BY o.id`);
  const trechos = await todos(db, `SELECT t.orcamento_id, t.de, t.para, t.data, t.janela FROM trechos t
    JOIN orcamentos o ON o.id = t.orcamento_id ${filtro} ORDER BY t.orcamento_id, t.ordem`);
  const porOrc = {};
  for (const t of trechos) (porOrc[t.orcamento_id] ||= []).push({ de: t.de, para: t.para, data: t.data, janela: !!t.janela });

  return linhas.map((o) => ({
    id: o.id,
    contato: { nome: o.contato_nome, ...(dono ? { whatsapp: o.contato_whatsapp } : {}) },
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

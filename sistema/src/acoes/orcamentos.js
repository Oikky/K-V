// Ações dos orçamentos: criar (bot e, depois, a tela de novo orçamento), pegar, mudar a etapa, duplicar e apagar.
import { acao, Recusa } from '../acoes.js';

export const CONFERENCIA_PADRAO = ['Janela de 14 dias pesquisada', 'Bagagem conferida', 'Link de cada preço', 'Pontos e dinheiro pesquisados'];

const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const ehIata = (s) => /^[A-Z]{3}$/.test(s);
const inteiro = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

// dados: { contato: {nome, whatsapp}, trechos: [{de, para, data, janela}], passageiros: {adultos, criancas, bebes},
//          especiais: [], observacao, faltando: [], origem, textoOriginal, audio, chat }
acao('orc.criar', ['dono'], (ctx, d) => criar(ctx, d));

async function criar({ db, usuario, quando }, d) {
  const nome = String(d.contato?.nome || '').trim();
  const whatsapp = soDigitos(d.contato?.whatsapp);
  if (!nome) throw new Recusa('Falta o nome de quem pediu');
  const trechos = (d.trechos || []).map((t) => ({ de: String(t.de || '').toUpperCase(), para: String(t.para || '').toUpperCase(), data: t.data, janela: t.janela !== false }));
  if (!trechos.length) throw new Recusa('Falta pelo menos um trecho');
  if (trechos.some((t) => !ehIata(t.de) || !ehIata(t.para) || !ehData(t.data))) throw new Recusa('Trecho com aeroporto ou data inválidos');
  const p = d.passageiros || {};
  const [adultos, criancas, bebes] = [p.adultos ?? 1, p.criancas ?? 0, p.bebes ?? 0];
  if (!inteiro(adultos, 0, 30) || !inteiro(criancas, 0, 30) || !inteiro(bebes, 0, 30) || adultos + criancas + bebes === 0) throw new Recusa('Número de passageiros inválido');
  const especiais = (d.especiais || []).map((e) => String(e).trim()).filter(Boolean);
  const faltando = (d.faltando || []).map((e) => String(e).trim()).filter(Boolean);

  // ligação com o cadastro: a pessoa escolhida na tela, ou o mesmo WhatsApp de alguém já cadastrado
  const pessoa = Number.isInteger(d.pessoaId) ? await db.prepare('SELECT id FROM pessoas WHERE id = ?').bind(d.pessoaId).first()
    : whatsapp ? await db.prepare('SELECT id FROM pessoas WHERE whatsapp = ?').bind(whatsapp).first() : null;
  // quem pesquisa (opcional): vai direto pra essa pessoa em vez de ficar na fila
  let responsavel = null;
  if (d.responsavel) {
    const u = await db.prepare("SELECT email FROM usuarios WHERE email = ? AND ativo = 1 AND (papel = 'pesquisador' OR pesquisa = 1)").bind(d.responsavel).first();
    if (!u) throw new Recusa('Essa pessoa não pesquisa voos');
    responsavel = u.email;
  }
  // lista de conferência: a que a tela mandou, ou a padrão + o pedido especial
  const conferencia = Array.isArray(d.conferencia)
    ? d.conferencia.map((e) => String(e).trim().slice(0, 200)).filter(Boolean)
    : [...CONFERENCIA_PADRAO, ...especiais];
  // o número nunca se repete, nem de orçamento apagado (o histórico dele continua nos eventos)
  const { id: ultimo } = await db.prepare(`SELECT MAX(COALESCE((SELECT MAX(id) FROM orcamentos), 0),
    COALESCE((SELECT MAX(CAST(entidade_id AS INTEGER)) FROM eventos WHERE entidade = 'orcamento'), 0)) AS id`).first();
  const id = ultimo + 1;

  const comandos = [
    db.prepare(`INSERT INTO orcamentos (id, contato_nome, contato_whatsapp, pessoa_id, responsavel, adultos, criancas, bebes, pedido, observacao, faltando,
                origem, texto_original, audio, origem_chat, criado_em, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, nome, whatsapp, pessoa ? pessoa.id : null, responsavel, adultos, criancas, bebes, especiais.join(' · '), String(d.observacao || '').trim(),
        JSON.stringify(faltando), d.origem === 'telegram' ? 'telegram' : 'manual', d.textoOriginal || null, d.audio ? 1 : 0, d.chat || null, quando, usuario.email),
    ...trechos.map((t, i) => db.prepare('INSERT INTO trechos (orcamento_id, ordem, de, para, data, janela) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, i, t.de, t.para, t.data, t.janela ? 1 : 0)),
    ...conferencia.map((texto, i) => db.prepare('INSERT INTO conferencia (orcamento_id, ordem, texto) VALUES (?, ?, ?)')
      .bind(id, i, texto)),
  ];
  const texto = d.origem === 'telegram'
    ? (d.audio ? 'Anotou o pedido a partir de um áudio' : 'Anotou o pedido a partir de uma mensagem')
    : 'Criou o orçamento';
  const eventos = [{ entidade: 'orcamento', id, texto, depois: { contato: nome, trechos } }];
  if (responsavel) eventos.push({ entidade: 'orcamento', id, texto: `Passou pra ${(await db.prepare('SELECT nome FROM usuarios WHERE email = ?').bind(responsavel).first()).nome}` });
  return { resultado: { id }, comandos, eventos };
}

// apaga um orçamento que acabou de chegar pelo bot e ainda ninguém mexeu (o /desfazer do Telegram)
acao('orc.desfazerBot', ['dono'], async ({ db }, { id }) => {
  const o = await db.prepare("SELECT id, contato_nome, etapa, responsavel FROM orcamentos WHERE id = ? AND origem = 'telegram'").bind(id).first();
  if (!o) throw new Recusa('Orçamento não encontrado');
  if (o.etapa !== 'novo' || o.responsavel) throw new Recusa('Alguém já começou esse orçamento; apague pelo sistema');
  const tem = await db.prepare('SELECT 1 FROM opcoes WHERE orcamento_id = ? LIMIT 1').bind(id).first();
  if (tem) throw new Recusa('Esse orçamento já tem opções de voo; apague pelo sistema');
  return {
    resultado: { id, nome: o.contato_nome },
    comandos: ['conferencia', 'trechos'].map((t) => db.prepare(`DELETE FROM ${t} WHERE orcamento_id = ?`).bind(id))
      .concat(db.prepare('DELETE FROM orcamentos WHERE id = ?').bind(id)),
    eventos: [{ entidade: 'orcamento', id, texto: 'Apagou pelo /desfazer do bot', antes: o }],
  };
});

const ETAPAS = { novo: 'Novo', pesquisa: 'Em pesquisa', pesquisado: 'Pesquisado', enviado: 'Enviado', fechado: 'Fechado', emitido: 'Emitido', perdido: 'Perdido', cancelado: 'Cancelado' };

async function orcamento(db, id) {
  const o = Number.isInteger(id) ? await db.prepare('SELECT * FROM orcamentos WHERE id = ?').bind(id).first() : null;
  if (!o) throw new Recusa('Orçamento não encontrado', 404);
  return o;
}

// quem pesquisa pega um orçamento novo da fila (ou um que o dono passou pra ele)
acao('orc.pegar', ['dono', 'pesquisa'], async ({ db, usuario }, { id }) => {
  const o = await orcamento(db, id);
  if (o.responsavel && o.responsavel !== usuario.email) {
    const quem = await db.prepare('SELECT nome FROM usuarios WHERE email = ?').bind(o.responsavel).first();
    throw new Recusa(`${quem ? quem.nome : 'Outra pessoa'} já pegou esse orçamento`, 409);
  }
  if (!['novo', 'pesquisa'].includes(o.etapa)) throw new Recusa('Esse orçamento já saiu da pesquisa', 409);
  return {
    resultado: { id },
    // o "AND" protege de duas pessoas pegarem no mesmo instante: só a primeira gravação vale
    comandos: [db.prepare("UPDATE orcamentos SET responsavel = ?1, etapa = 'pesquisa' WHERE id = ?2 AND (responsavel IS NULL OR responsavel = ?1)").bind(usuario.email, id)],
    eventos: [{ entidade: 'orcamento', id, texto: 'Pegou o orçamento', antes: { etapa: o.etapa, responsavel: o.responsavel } }],
  };
});

// o dono troca a etapa direto no cartão
acao('orc.etapa', ['dono'], async ({ db }, { id, etapa }) => {
  const o = await orcamento(db, id);
  if (!ETAPAS[etapa]) throw new Recusa('Etapa inválida');
  if (etapa === o.etapa) return { resultado: { id } };
  const perder = ['perdido', 'cancelado'].includes(etapa);
  return {
    resultado: { id },
    comandos: [db.prepare('UPDATE orcamentos SET etapa = ?, antes_de_perder = ? WHERE id = ?')
      .bind(etapa, perder ? (o.antes_de_perder || o.etapa) : null, id)],
    eventos: [{ entidade: 'orcamento', id, texto: etapa === 'pesquisado' ? 'Marcou como pesquisado' : `Mudou pra ${ETAPAS[etapa]}`, antes: { etapa: o.etapa }, depois: { etapa } }],
  };
});

// novo orçamento com o mesmo contato, trechos, passageiros e pedido (sem opções, sem responsável)
acao('orc.duplicar', ['dono'], async (ctx, { id }) => {
  const o = await orcamento(ctx.db, id);
  const trechos = (await ctx.db.prepare('SELECT de, para, data, janela FROM trechos WHERE orcamento_id = ? ORDER BY ordem').bind(id).all()).results;
  const r = await criar(ctx, {
    contato: { nome: o.contato_nome, whatsapp: o.contato_whatsapp },
    trechos: trechos.map((t) => ({ ...t, janela: !!t.janela })),
    passageiros: { adultos: o.adultos, criancas: o.criancas, bebes: o.bebes },
    especiais: o.pedido ? o.pedido.split(' · ') : [],
    observacao: o.observacao,
  });
  r.eventos[0].texto = `Duplicou o #${id}`;
  return r;
});

// apaga de vez (o histórico fica nos eventos). Emitido não se apaga: tem pontos e passageiros ligados.
acao('orc.apagar', ['dono'], async ({ db }, { id }) => {
  const o = await orcamento(db, id);
  const emitiu = await db.prepare('SELECT 1 FROM emissoes WHERE orcamento_id = ? LIMIT 1').bind(id).first();
  if (emitiu) throw new Recusa('Esse orçamento tem voo emitido; não dá pra apagar', 409);
  return {
    resultado: { id },
    comandos: ['conferencia', 'trechos', 'opcoes', 'combos', 'orcamento_passageiros']
      .map((t) => db.prepare(`DELETE FROM ${t} WHERE orcamento_id = ?`).bind(id))
      .concat(db.prepare('DELETE FROM orcamentos WHERE id = ?').bind(id)),
    eventos: [{ entidade: 'orcamento', id, texto: 'Apagou o orçamento', antes: o }],
  };
});

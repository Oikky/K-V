// Ações dos orçamentos: criar e editar (tela e bot), pegar, mudar a etapa, duplicar e apagar.
import { acao, Recusa, ehDono } from '../acoes.js';

export const CONFERENCIA_PADRAO = ['Todos os dias pedidos pesquisados', 'Bagagem conferida', 'Link de cada preço', 'Pontos e dinheiro pesquisados'];

const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
// lugar do trecho: sigla de aeroporto (vira maiúscula) ou qualquer nome digitado à mão
const lugar = (s) => { const x = String(s || '').trim().replace(/\s+/g, ' ').slice(0, 60); return /^[a-z]{3}$/i.test(x) ? x.toUpperCase() : x; };
const inteiro = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

// dados: { contato: {nome, whatsapp}, trechos: [{de, para, data, janela, outrasDatas, roteiro}], passageiros: {adultos, criancas, bebes},
//          especiais: [], observacao, faltando: [], origem, textoOriginal, audio, chat }
// quem pesquisa só cria se o dono ligou isso em Configurações › Empresa
acao('orc.criar', ['dono', 'pesquisa'], async (ctx, d) => {
  if (!ehDono(ctx.usuario) && !(await pesquisaCria(ctx.db))) throw new Recusa('Só o dono cria orçamentos', 403);
  return criar(ctx, d);
});
export const pesquisaCria = async (db) => { const e = await db.prepare('SELECT dados FROM empresa WHERE id = 1').first(); return !!(e && JSON.parse(e.dados).pesquisaCria); };

// o pedido validado (o mesmo pra criar e pra editar)
function lerPedido(d) {
  const nome = String(d.contato?.nome || '').trim();
  const whatsapp = soDigitos(d.contato?.whatsapp);
  if (!nome) throw new Recusa('Falta o nome de quem pediu');
  const trechos = (d.trechos || []).map((t) => ({ de: lugar(t.de), para: lugar(t.para), data: t.data, janela: t.janela !== false, roteiro: t.roteiro ?? 0,
    // outros dias pedidos pro mesmo trecho ("dia 30 e 31"), sem repetir o dia principal
    outrasDatas: [...new Set(Array.isArray(t.outrasDatas) ? t.outrasDatas : [])].filter((x) => x !== t.data).sort() }));
  if (!trechos.length) throw new Recusa('Falta pelo menos um trecho');
  if (trechos.some((t) => !t.de || !t.para || !ehData(t.data) || t.outrasDatas.length > 31 || !t.outrasDatas.every(ehData))) throw new Recusa('Trecho com aeroporto ou data inválidos');
  // roteiros em ordem (todos os trechos do A, depois os do B...), sem pular letra
  if (trechos.some((t, i) => !inteiro(t.roteiro, 0, 4) || (i ? ![trechos[i - 1].roteiro, trechos[i - 1].roteiro + 1].includes(t.roteiro) : t.roteiro !== 0))) throw new Recusa('Roteiros fora de ordem');
  const p = d.passageiros || {};
  const [adultos, criancas, bebes] = [p.adultos ?? 1, p.criancas ?? 0, p.bebes ?? 0];
  if (!inteiro(adultos, 0, 30) || !inteiro(criancas, 0, 30) || !inteiro(bebes, 0, 30) || adultos + criancas + bebes === 0) throw new Recusa('Número de passageiros inválido');
  const especiais = (d.especiais || []).map((e) => String(e).trim()).filter(Boolean);
  const faltando = (d.faltando || []).map((e) => String(e).trim()).filter(Boolean);
  return { nome, whatsapp, trechos, adultos, criancas, bebes, especiais, faltando, observacao: String(d.observacao || '').trim() };
}

async function criar({ db, usuario, quando }, d) {
  const { nome, whatsapp, trechos, adultos, criancas, bebes, especiais, faltando } = lerPedido(d);
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
    ...trechos.map((t, i) => db.prepare('INSERT INTO trechos (orcamento_id, ordem, de, para, data, janela, outras_datas, roteiro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, i, t.de, t.para, t.data, t.janela ? 1 : 0, t.outrasDatas.length ? JSON.stringify(t.outrasDatas) : null, t.roteiro)),
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

// muda o pedido: quem pediu, WhatsApp, trechos, passageiros, pedido especial, observação e o que falta perguntar.
// Todos editam (decisão de 2026-11-14); quem pesquisa, qualquer um ainda na pesquisa (2026-11-19) ou o que ele pesquisou.
acao('orc.editar', ['dono', 'pesquisa'], async ({ db, usuario }, d) => {
  const o = await orcamento(db, d.id);
  if (!ehDono(usuario) && !['novo', 'pesquisa'].includes(o.etapa) && o.responsavel !== usuario.email) throw new Recusa('Esse orçamento já saiu da pesquisa', 403);
  const n = lerPedido(d);
  const id = o.id;
  const antigos = (await db.prepare('SELECT de, para, data, janela, outras_datas, roteiro FROM trechos WHERE orcamento_id = ? ORDER BY ordem').bind(id).all()).results;
  // o bot não conhece roteiros: mudar pelo bot juntaria tudo num roteiro só
  if (d.trechos.every((t) => t.roteiro == null) && antigos.some((t) => t.roteiro)) throw new Recusa('Esse orçamento tem roteiros alternativos: mude pelo sistema', 409);
  // opções, combinações e emissões apontam pro trecho pela posição: mudar a quantidade (ou os roteiros) não pode deixar nada sem trecho
  if (n.trechos.length !== antigos.length || n.trechos.some((t, i) => t.roteiro !== antigos[i].roteiro)) {
    const [combo, emi, op] = await Promise.all([
      db.prepare('SELECT 1 FROM combos WHERE orcamento_id = ? LIMIT 1').bind(id).first(),
      db.prepare('SELECT 1 FROM emissoes WHERE orcamento_id = ? LIMIT 1').bind(id).first(),
      db.prepare('SELECT MAX(trecho) AS t FROM opcoes WHERE orcamento_id = ?').bind(id).first(),
    ]);
    if (emi) throw new Recusa('Tem voo emitido: não dá pra mudar a quantidade de trechos', 409);
    if (combo) throw new Recusa('A proposta já tem combinações: apague elas antes de mudar a quantidade de trechos', 409);
    if (op && op.t != null && op.t >= n.trechos.length) throw new Recusa(`O trecho ${op.t + 1} tem opções lançadas: apague elas antes de tirar o trecho`, 409);
  }
  // pedido especial novo entra na conferência; o que saiu do pedido sai dela, se ainda não foi feito
  const velhos = o.pedido ? o.pedido.split(' · ') : [];
  const entram = n.especiais.filter((e) => !velhos.includes(e)), saem = velhos.filter((e) => !n.especiais.includes(e));
  const { m } = await db.prepare('SELECT COALESCE(MAX(ordem), -1) AS m FROM conferencia WHERE orcamento_id = ?').bind(id).first();
  const antes = { contato: o.contato_nome, whatsapp: o.contato_whatsapp, trechos: antigos, adultos: o.adultos, criancas: o.criancas, bebes: o.bebes,
    pedido: o.pedido, observacao: o.observacao, faltando: o.faltando };
  return {
    resultado: { id },
    comandos: [
      db.prepare('UPDATE orcamentos SET contato_nome = ?, contato_whatsapp = ?, adultos = ?, criancas = ?, bebes = ?, pedido = ?, observacao = ?, faltando = ? WHERE id = ?')
        .bind(n.nome, n.whatsapp, n.adultos, n.criancas, n.bebes, n.especiais.join(' · '), n.observacao, JSON.stringify(n.faltando), id),
      db.prepare('DELETE FROM trechos WHERE orcamento_id = ?').bind(id),
      ...n.trechos.map((t, i) => db.prepare('INSERT INTO trechos (orcamento_id, ordem, de, para, data, janela, outras_datas, roteiro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, i, t.de, t.para, t.data, t.janela ? 1 : 0, t.outrasDatas.length ? JSON.stringify(t.outrasDatas) : null, t.roteiro)),
      ...saem.map((t) => db.prepare('DELETE FROM conferencia WHERE orcamento_id = ? AND texto = ? AND feito = 0').bind(id, t)),
      ...entram.map((t, i) => db.prepare('INSERT INTO conferencia (orcamento_id, ordem, texto) VALUES (?, ?, ?)').bind(id, m + 1 + i, t)),
    ],
    eventos: [{ entidade: 'orcamento', id, texto: d.texto || 'Editou o pedido', antes, depois: n }],
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
  const trechos = (await ctx.db.prepare('SELECT de, para, data, janela, outras_datas, roteiro FROM trechos WHERE orcamento_id = ? ORDER BY ordem').bind(id).all()).results;
  const r = await criar(ctx, {
    contato: { nome: o.contato_nome, whatsapp: o.contato_whatsapp },
    trechos: trechos.map((t) => ({ de: t.de, para: t.para, data: t.data, janela: !!t.janela, outrasDatas: JSON.parse(t.outras_datas || '[]'), roteiro: t.roteiro })),
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

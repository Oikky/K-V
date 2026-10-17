// Ações dos orçamentos. Por enquanto só criar (usada pelo bot e, depois, pela tela de novo orçamento).
import { acao, Recusa } from '../acoes.js';

export const CONFERENCIA_PADRAO = ['Janela de 14 dias pesquisada', 'Bagagem conferida', 'Link de cada preço', 'Pontos e dinheiro pesquisados'];

const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const ehIata = (s) => /^[A-Z]{3}$/.test(s);
const inteiro = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

// dados: { contato: {nome, whatsapp}, trechos: [{de, para, data, janela}], passageiros: {adultos, criancas, bebes},
//          especiais: [], observacao, faltando: [], origem, textoOriginal, audio, chat }
acao('orc.criar', ['dono'], async ({ db, usuario, quando }, d) => {
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

  // ligação com o cadastro: o mesmo WhatsApp de alguém já cadastrado
  const pessoa = whatsapp ? await db.prepare('SELECT id FROM pessoas WHERE whatsapp = ?').bind(whatsapp).first() : null;
  // o número nunca se repete, nem de orçamento apagado (o histórico dele continua nos eventos)
  const { id: ultimo } = await db.prepare(`SELECT MAX(COALESCE((SELECT MAX(id) FROM orcamentos), 0),
    COALESCE((SELECT MAX(CAST(entidade_id AS INTEGER)) FROM eventos WHERE entidade = 'orcamento'), 0)) AS id`).first();
  const id = ultimo + 1;

  const comandos = [
    db.prepare(`INSERT INTO orcamentos (id, contato_nome, contato_whatsapp, pessoa_id, adultos, criancas, bebes, pedido, observacao, faltando,
                origem, texto_original, audio, origem_chat, criado_em, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, nome, whatsapp, pessoa ? pessoa.id : null, adultos, criancas, bebes, especiais.join(' · '), String(d.observacao || '').trim(),
        JSON.stringify(faltando), d.origem === 'telegram' ? 'telegram' : 'manual', d.textoOriginal || null, d.audio ? 1 : 0, d.chat || null, quando, usuario.email),
    ...trechos.map((t, i) => db.prepare('INSERT INTO trechos (orcamento_id, ordem, de, para, data, janela) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, i, t.de, t.para, t.data, t.janela ? 1 : 0)),
    ...[...CONFERENCIA_PADRAO, ...especiais].map((texto, i) => db.prepare('INSERT INTO conferencia (orcamento_id, ordem, texto) VALUES (?, ?, ?)')
      .bind(id, i, texto)),
  ];
  const texto = d.origem === 'telegram'
    ? (d.audio ? 'Anotou o pedido a partir de um áudio' : 'Anotou o pedido a partir de uma mensagem')
    : 'Criou o orçamento';
  return { resultado: { id }, comandos, eventos: [{ entidade: 'orcamento', id, texto, depois: { contato: nome, trechos } }] };
});

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

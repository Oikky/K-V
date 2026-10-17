// Worker do bot do Telegram (kv-bot). Fica fora do login do Access, porque quem chama é o Telegram;
// em troca, toda chamada precisa trazer a senha secreta (TELEGRAM_SECRET) que o Telegram manda no cabeçalho.
// Fluxo: o dono manda o pedido em texto ou áudio → o áudio vira texto (Whisper) → a Claude monta o orçamento →
// o bot mostra o resumo com Confirmar/Cancelar → só no Confirmar o orçamento entra na fila como Novo.
import { executar, Recusa, agora } from '../acoes.js';
import '../acoes/orcamentos.js';
import { transcrever, interpretar } from './ia.js';

const BOT = { email: 'bot', nome: 'Bot do Telegram', papel: 'dono' };
const ESPERA_MIN = 15; // quanto tempo um pedido sem o nome do cliente espera o complemento

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname !== '/telegram' || req.method !== 'POST') return new Response('Não existe', { status: 404 });
    if (!env.TELEGRAM_SECRET || req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_SECRET) {
      return new Response('Não autorizado', { status: 401 });
    }
    const upd = await req.json().catch(() => null);
    if (!upd || !Number.isInteger(upd.update_id)) return new Response('ok');
    // o Telegram pode repetir a mesma atualização: só a primeira é tratada
    const r = await env.DB.prepare('INSERT OR IGNORE INTO idempotencia (chave, quando, resultado) VALUES (?, ?, ?)')
      .bind(`tg:${upd.update_id}`, agora(), 'null').run();
    if (!r.meta.changes) return new Response('ok');
    // responde na hora; o trabalho (áudio, Claude) continua depois
    ctx.waitUntil(tratar(env, upd).catch((e) => console.error('bot', e)));
    return new Response('ok');
  },
};

// ---------- Telegram ----------
async function tg(env, metodo, params) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${metodo}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram ${metodo}: ${j.description}`);
  return j.result;
}
const responder = (env, chat_id, text, extra = {}) =>
  tg(env, 'sendMessage', { chat_id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...extra });
const h = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chatsLiberados = (env) => new Set(String(env.KV_CHATS || '').split(',').map((c) => c.trim()).filter(Boolean));

const AJUDA = 'Oi! Sou o bot da K&amp;V. Me mande o pedido do cliente, escrito ou em áudio, do jeito que você falaria. '
  + 'Ex.: "A Maria Souza, (11) 91234-5678, quer ir pra Lisboa dia 12/11 com o marido, volta dia 26, só voo direto."\n\n'
  + 'O nome do cliente é obrigatório: sem ele eu pergunto antes. O WhatsApp é opcional.\n\n'
  + 'Eu mostro o resumo e o pedido só entra na fila quando você tocar em <b>Confirmar</b>.\n/desfazer apaga o último que entrou.';

async function tratar(env, upd) {
  if (upd.callback_query) return botao(env, upd.callback_query);
  const msg = upd.message;
  if (!msg) return;
  const chat = msg.chat.id;
  const grupo = ['group', 'supergroup'].includes(msg.chat.type);
  let texto = String(msg.text || msg.caption || '').trim();
  const liberado = chatsLiberados(env).has(String(chat));

  // avisos do próprio Telegram (alguém entrou, saiu, mudou o nome): só dá boas-vindas a quem entra
  if (msg.new_chat_members) { if (liberado) await responder(env, chat, AJUDA); return; }
  if (['left_chat_member', 'new_chat_title', 'new_chat_photo', 'pinned_message', 'group_chat_created'].some((k) => k in msg)) return;

  texto = texto.replace(/@\w+bot\b/gi, '').trim();
  if (/^\/(start|ajuda)/.test(texto)) {
    const extra = liberado ? (grupo ? '\n\nNeste grupo eu leio todas as mensagens e áudios: é só mandar o pedido.' : '')
      : `\n\nNúmero deste ${grupo ? 'grupo' : 'chat'}: <code>${chat}</code> (falta liberar)`;
    return responder(env, chat, AJUDA + extra);
  }
  if (!liberado) { if (!grupo) await responder(env, chat, 'Este bot é só pra equipe da K&amp;V.'); return; }
  if (/^\/desfazer/.test(texto)) return desfazer(env, chat);

  const voz = msg.voice || msg.audio;
  if (voz) {
    await tg(env, 'sendChatAction', { chat_id: chat, action: 'typing' });
    const arq = await tg(env, 'getFile', { file_id: voz.file_id });
    const audio = await (await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${arq.file_path}`)).arrayBuffer();
    texto = await transcrever(env, audio);
    if (!texto) return responder(env, chat, 'Não consegui entender o áudio. Pode mandar de novo ou escrever?');
    await responder(env, chat, `Entendi assim: "${h(texto)}"`);
  }
  if (!texto) return responder(env, chat, 'Me mande o pedido em texto ou áudio.');

  // pedido que ficou esperando o nome do cliente: a mensagem nova completa o anterior
  const quem = `${chat}:${msg.from?.id || 0}`;
  const antes = await env.DB.prepare("SELECT dados FROM bot_pendentes WHERE chat_id = ? AND situacao = 'faltando' AND expira > ?").bind(quem, agora()).first();
  let veioDeAudio = !!voz;
  if (antes) {
    const a = JSON.parse(antes.dados);
    texto = `${a.texto}\n${texto}`;
    veioDeAudio = veioDeAudio || a.audio;
    await env.DB.prepare('DELETE FROM bot_pendentes WHERE chat_id = ?').bind(quem).run();
  }

  await tg(env, 'sendChatAction', { chat_id: chat, action: 'typing' });
  const p = await interpretar(env, texto);
  if (p.erro) return responder(env, chat, p.erro);
  if (!p.e_pedido_de_viagem || !p.trechos.length) {
    return responder(env, chat, 'Não entendi isso como um pedido de viagem. Me diga pra onde, quando e quantas pessoas.');
  }

  // o nome é obrigatório (o WhatsApp não, decidido em 2026-10-17): sem ele o pedido espera o complemento
  if (!String(p.nome_contato || '').trim()) {
    const expira = new Date(Date.now() + ESPERA_MIN * 60e3).toISOString();
    await env.DB.prepare("INSERT OR REPLACE INTO bot_pendentes (chat_id, dados, situacao, expira) VALUES (?, ?, 'faltando', ?)")
      .bind(quem, JSON.stringify({ texto, audio: veioDeAudio }), expira).run();
    return responder(env, chat, 'Entendi o pedido, mas falta o nome do cliente. Me manda que eu completo. Ex.: "Maria Souza"');
  }

  // tudo certo: mostra o resumo e espera o Confirmar
  const dados = {
    contato: { nome: p.nome_contato.trim(), whatsapp: p.whatsapp || '' },
    trechos: p.trechos.map((t) => ({ de: t.de.toUpperCase(), para: t.para.toUpperCase(), data: t.data, janela: t.data_flexivel })),
    passageiros: { adultos: Math.max(p.adultos, 0), criancas: Math.max(p.criancas, 0), bebes: Math.max(p.bebes, 0) },
    especiais: p.pedidos_especiais, observacao: p.observacao, faltando: p.faltando,
    origem: 'telegram', textoOriginal: texto, audio: veioDeAudio, chat: String(chat),
  };
  const chave = `c:${crypto.randomUUID().slice(0, 12)}`;
  await env.DB.prepare("INSERT INTO bot_pendentes (chat_id, dados, situacao, expira) VALUES (?, ?, 'confirmar', ?)")
    .bind(chave, JSON.stringify(dados), new Date(Date.now() + 7 * 864e5).toISOString()).run();
  await responder(env, chat, resumo(dados), {
    reply_markup: { inline_keyboard: [[{ text: 'Confirmar', callback_data: `ok|${chave}` }, { text: 'Cancelar', callback_data: `nao|${chave}` }]] },
  });
}

// toque em Confirmar ou Cancelar
async function botao(env, cb) {
  const [qual, chave] = String(cb.data || '').split('|');
  const chat = cb.message?.chat?.id;
  if (!chatsLiberados(env).has(String(chat))) return tg(env, 'answerCallbackQuery', { callback_query_id: cb.id });
  const p = await env.DB.prepare("SELECT dados FROM bot_pendentes WHERE chat_id = ? AND situacao = 'confirmar'").bind(chave).first();
  const editar = (text) => tg(env, 'editMessageText', {
    chat_id: chat, message_id: cb.message.message_id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
  });
  if (!p) {
    await tg(env, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Esse pedido já foi resolvido.' });
    return;
  }
  const dados = JSON.parse(p.dados);
  if (qual === 'nao') {
    await env.DB.prepare('DELETE FROM bot_pendentes WHERE chat_id = ?').bind(chave).run();
    await tg(env, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Cancelado' });
    return editar(`${resumo(dados)}\n\n<b>Cancelado.</b> Não entrou na fila.`);
  }
  try {
    // a chave é a do pedido: dois toques no Confirmar criam um orçamento só
    const { id } = await executar(env, BOT, { acao: 'orc.criar', dados, chave: `bot-${chave}` });
    await env.DB.prepare('DELETE FROM bot_pendentes WHERE chat_id = ?').bind(chave).run();
    await tg(env, 'answerCallbackQuery', { callback_query_id: cb.id, text: `Anotado: orçamento nº ${id}` });
    const link = env.SISTEMA_URL ? `\n<a href="${h(env.SISTEMA_URL)}">Abrir o sistema</a>` : '';
    return editar(`${resumo(dados)}\n\n<b>Anotado: orçamento nº ${id}</b>, na fila como Novo.${link}\nErrou? Mande /desfazer.`);
  } catch (e) {
    const texto = e instanceof Recusa ? e.message : 'Deu um erro ao gravar. Tenta de novo.';
    if (!(e instanceof Recusa)) console.error('confirmar', e);
    return tg(env, 'answerCallbackQuery', { callback_query_id: cb.id, text: texto, show_alert: true });
  }
}

async function desfazer(env, chat) {
  const o = await env.DB.prepare("SELECT id FROM orcamentos WHERE origem = 'telegram' AND origem_chat = ? ORDER BY id DESC LIMIT 1")
    .bind(String(chat)).first();
  if (!o) return responder(env, chat, 'Não tem nada deste chat pra desfazer.');
  try {
    const r = await executar(env, BOT, { acao: 'orc.desfazerBot', dados: { id: o.id }, chave: `desfazer-${o.id}` });
    return responder(env, chat, `Apaguei o orçamento nº ${r.id} (${h(r.nome)}).`);
  } catch (e) {
    if (e instanceof Recusa) return responder(env, chat, h(e.message));
    throw e;
  }
}

// ---------- resumo do pedido ----------
const dataBr = (iso) => { const [, m, d] = String(iso).split('-'); return d && m ? `${d}/${m}` : iso; };
function resumo(o) {
  const { adultos, criancas, bebes } = o.passageiros;
  const pessoas = [adultos && `${adultos} adulto${adultos > 1 ? 's' : ''}`, criancas && `${criancas} criança${criancas > 1 ? 's' : ''}`,
    bebes && `${bebes} bebê${bebes > 1 ? 's' : ''}`].filter(Boolean).join(', ');
  const zap = String(o.contato.whatsapp || '').replace(/\D/g, '');
  const linhas = [`<b>${h(o.contato.nome)}</b>${zap ? ` · ${h(o.contato.whatsapp)}` : ''}`];
  o.trechos.forEach((t) => linhas.push(h(`${t.de} → ${t.para}  ${dataBr(t.data)}${t.janela ? '' : ' (data fixa)'}`)));
  linhas.push(pessoas || 'passageiros a confirmar');
  if (o.especiais?.length) linhas.push(h(`Pedido: ${o.especiais.join(' · ')}`));
  if (o.observacao) linhas.push(h(`Obs.: ${o.observacao}`));
  if (o.faltando?.length) linhas.push('', h(`Falta perguntar: ${o.faltando.join('; ')}`));
  return linhas.join('\n');
}

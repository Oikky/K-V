// Emissão: um registro por voo da combinação aceita. Em pontos, a saída entra sozinha na conta escolhida,
// gastando primeiro os lotes que vencem antes, e os passageiros passam a contar como beneficiários dela.
// Com todos os voos emitidos, o orçamento vai pra Emitido.
import { acao, Recusa, hojeBR } from '../acoes.js';
import { SITES } from './pesquisa.js';
import { contasCompletas } from '../contas.js';

acao('emi.registrar', ['dono'], async (ctx, d) => {
  const { db, env, usuario, quando } = ctx;
  const o = Number.isInteger(d.orcamento) ? await db.prepare('SELECT * FROM orcamentos WHERE id = ?').bind(d.orcamento).first() : null;
  if (!o) throw new Recusa('Orçamento não encontrado', 404);
  if (o.etapa !== 'fechado') throw new Recusa(o.etapa === 'emitido' ? 'Tudo já foi emitido' : 'Feche o orçamento antes de emitir', 409);
  const trechos = (await db.prepare('SELECT ordem, de, para FROM trechos WHERE orcamento_id = ? ORDER BY ordem').bind(o.id).all()).results;
  const t = trechos.find((x) => x.ordem === d.trecho);
  if (!t) throw new Recusa('Trecho inválido');
  const combo = await db.prepare('SELECT escolha FROM combos WHERE id = ?').bind(o.combo_aceita).first();
  if (!combo) throw new Recusa('Falta a combinação aceita');
  const op = await db.prepare('SELECT * FROM opcoes WHERE id = ?').bind(JSON.parse(combo.escolha)[d.trecho]).first();
  const loc = String(d.localizador || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (loc.length < 5 || loc.length > 8) throw new Recusa('Localizador inválido');
  const ja = await db.prepare('SELECT localizador FROM emissoes WHERE orcamento_id = ? AND trecho = ?').bind(o.id, d.trecho).first();
  if (ja) throw new Recusa(`Esse voo já foi emitido (${ja.localizador})`, 409);
  const pax = (await db.prepare('SELECT pessoa_id FROM orcamento_passageiros WHERE orcamento_id = ? ORDER BY ordem').bind(o.id).all()).results.map((p) => p.pessoa_id);

  const programa = SITES[op.site];
  const pagantes = o.adultos + o.criancas;
  let conta = null, pontos = null;
  const comandos = [];
  const { id: ultE } = await db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM emissoes').first();
  const emissaoId = ultE + 1;
  if (programa) {
    [conta] = Number.isInteger(d.conta) ? await contasCompletas(env, { ids: [d.conta] }) : [];
    if (!conta) throw new Recusa('Escolha de qual conta saem os pontos');
    if (conta.programa_id !== programa) throw new Recusa('Essa conta é de outro programa');
    pontos = op.milhas * pagantes;
    if (conta.saldo < pontos) throw new Recusa(`A conta só tem ${conta.saldo.toLocaleString('pt-BR')} pts; precisa de ${pontos.toLocaleString('pt-BR')}`, 409);
    // gasta primeiro o que vence antes
    let falta = pontos;
    for (const l of conta.lotes) {
      if (falta <= 0) break;
      const usa = Math.min(l.resta, falta); falta -= usa;
      comandos.push(db.prepare('UPDATE movimentos SET resta = resta - ? WHERE id = ?').bind(usa, l.id));
    }
    const { id: ultM } = await db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM movimentos').first();
    comandos.push(db.prepare(`INSERT INTO movimentos (id, conta_id, lado, tipo, data, pontos, emissao_id, obs, criado_em, criado_por)
      VALUES (?, ?, 'saida', 'emissao', ?, ?, ?, ?, ?, ?)`).bind(ultM + 1, conta.id, hojeBR(), pontos, emissaoId, `#${o.id} ${t.de} → ${t.para} (${loc})`, quando, usuario.email));
  }
  // a emissão vem antes da saída (a saída aponta pra ela)
  comandos.unshift(
    db.prepare('INSERT INTO emissoes (id, orcamento_id, trecho, conta_id, pontos, localizador, em, por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(emissaoId, o.id, d.trecho, conta ? conta.id : null, pontos, loc, quando, usuario.email),
    ...pax.map((p) => db.prepare('INSERT INTO emissao_passageiros (emissao_id, pessoa_id) VALUES (?, ?)').bind(emissaoId, p)),
  );
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM emissoes WHERE orcamento_id = ?').bind(o.id).first();
  const tudo = n + 1 === trechos.length;
  if (tudo) comandos.push(db.prepare("UPDATE orcamentos SET etapa = 'emitido' WHERE id = ?").bind(o.id));
  const eventos = [{ entidade: 'orcamento', id: o.id, texto: `Emitiu ${t.de} → ${t.para} (${loc})${conta ? ` pela conta de ${conta.titular}` : ''}` }];
  if (conta) eventos.push({ entidade: 'conta', id: conta.id, texto: `Emissão #${o.id} ${t.de} → ${t.para}: −${pontos.toLocaleString('pt-BR')} pts` });
  if (tudo) eventos.push({ entidade: 'orcamento', id: o.id, texto: 'Tudo emitido' });
  return { resultado: { id: emissaoId, tudo }, comandos, eventos };
});

// Gastar e devolver pontos dos lotes. Cada entrada é um lote com vencimento e guarda quanto resta;
// as saídas gastam primeiro o que vence antes, e a tabela consumos anota de qual lote saiu cada pedaço.
// Assim, desfazer uma saída devolve os pontos exatamente pros mesmos lotes.

// gasta `pontos` da conta (de um lote escolhido primeiro, na expiração). conta.lotes vem de contasCompletas.
// Os comandos incluem o registro em consumos, que aponta pra saída: rodar depois do INSERT da saída.
export function gastar(db, conta, pontos, saidaId, loteId = null) {
  const lotes = loteId ? [...conta.lotes.filter((l) => l.id === loteId), ...conta.lotes.filter((l) => l.id !== loteId)] : conta.lotes;
  let falta = pontos;
  const usos = [];
  for (const l of lotes) { if (falta <= 0) break; const usa = Math.min(l.resta, falta); if (!usa) continue; falta -= usa; usos.push({ id: l.id, usa }); }
  return {
    usos,
    comandos: usos.flatMap((u) => [
      db.prepare('UPDATE movimentos SET resta = resta - ? WHERE id = ?').bind(u.usa, u.id),
      db.prepare('INSERT INTO consumos (saida_id, lote_id, pontos) VALUES (?, ?, ?) ON CONFLICT(saida_id, lote_id) DO UPDATE SET pontos = pontos + excluded.pontos').bind(saidaId, u.id, u.usa),
    ]),
  };
}

// devolve `qtd` pontos de uma saída pros lotes (todos, se qtd vier vazio). Na devolução parcial, volta primeiro
// pro lote que vence depois (o último que foi gasto). Saída antiga, sem registro em consumos: enche de novo os
// lotes da conta que estão gastos, do que vence antes pro que vence depois.
export async function devolver(db, saida, qtd = saida.pontos) {
  const comandos = [];
  const reg = (await db.prepare(`SELECT c.lote_id, c.pontos FROM consumos c JOIN movimentos l ON l.id = c.lote_id
    WHERE c.saida_id = ? ORDER BY l.vence DESC, l.data DESC, l.id DESC`).bind(saida.id).all()).results;
  let falta = qtd;
  if (reg.length) {
    for (const r of reg) {
      if (falta <= 0) break;
      const volta = Math.min(r.pontos, falta); falta -= volta;
      comandos.push(db.prepare('UPDATE movimentos SET resta = resta + ? WHERE id = ?').bind(volta, r.lote_id));
      comandos.push(volta === r.pontos
        ? db.prepare('DELETE FROM consumos WHERE saida_id = ? AND lote_id = ?').bind(saida.id, r.lote_id)
        : db.prepare('UPDATE consumos SET pontos = pontos - ? WHERE saida_id = ? AND lote_id = ?').bind(volta, saida.id, r.lote_id));
    }
  }
  if (falta > 0) {
    const gastos = (await db.prepare(`SELECT id, pontos - resta AS cabe FROM movimentos WHERE conta_id = ? AND lado = 'entrada' AND resta < pontos
      ORDER BY vence IS NULL, vence, data, id`).bind(saida.conta_id).all()).results;
    for (const l of gastos) {
      if (falta <= 0) break;
      const volta = Math.min(l.cabe, falta); falta -= volta;
      comandos.push(db.prepare('UPDATE movimentos SET resta = resta + ? WHERE id = ?').bind(volta, l.id));
    }
    // o que sobrar era "dívida" (saída maior que as entradas): o saldo é a soma, então já volta sozinho
  }
  return comandos;
}

// próximo id de uma tabela, já contando os que este lote vai criar
export async function proximos(db, tabela) {
  const { id } = await db.prepare(`SELECT COALESCE(MAX(id), 0) AS id FROM ${tabela}`).first();
  let n = id;
  return () => ++n;
}

// Ações das contas de pontos. O saldo nunca é digitado: é a soma das entradas menos as saídas.
// Cada entrada é um lote com vencimento e guarda quanto ainda resta; as saídas gastam primeiro o que vence antes.
import { acao, Recusa, hojeBR } from '../acoes.js';
import { contasCompletas } from '../contas.js';
import { gastar, devolver, proximos } from '../pontos.js';
import { cpfValido } from './pessoas.js';
import { parcelasValidas } from './cartoes.js';

const ENTRADAS = ['clube', 'compra', 'transferencia', 'cartao', 'bonus', 'estorno', 'inicial'];
const COM_CUSTO = ['clube', 'compra', 'transferencia'];
const SAIDAS = ['transferencia', 'expiracao', 'ajuste'];
export const OBS_MAX = 2000;
const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const inteiro = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const pts = (n) => n.toLocaleString('pt-BR');
const somaMeses = (dia, n) => { const d = new Date(dia + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

// confere e monta uma entrada (lote). l: { conta, tipo, data, pontos, custo, vence, origem, bonus_pct, obs, cartao, parcelas }
// cartoes: ids dos cartões cadastrados (o cartão só vale em entrada com custo)
function validarEntrada(l, cartoes = new Set()) {
  if (!ENTRADAS.includes(l.tipo)) throw new Recusa('Tipo de entrada inválido');
  if (!ehData(l.data)) throw new Recusa('Data inválida');
  if (!inteiro(l.pontos, 1, 100_000_000)) throw new Recusa('Pontos inválidos');
  const custo = COM_CUSTO.includes(l.tipo) ? (l.custo ?? 0) : 0;
  if (!inteiro(custo, 0, 100_000_000)) throw new Recusa('Custo inválido');
  const vence = l.vence && ehData(l.vence) ? l.vence : somaMeses(l.data, 24);
  const bonus = l.tipo === 'transferencia' && l.bonus_pct != null ? l.bonus_pct : null;
  if (bonus != null && !inteiro(bonus, 0, 1000)) throw new Recusa('Bônus inválido');
  const cartao = custo > 0 && l.cartao != null ? l.cartao : null;
  if (cartao != null && !cartoes.has(cartao)) throw new Recusa('Cartão não encontrado; recarregue a página');
  const parcelas = cartao != null ? parcelasValidas(l.parcelas) : 1;
  return { tipo: l.tipo, data: l.data, pontos: l.pontos, custo, cartao, parcelas, vence, bonus, origem: l.tipo === 'transferencia' ? String(l.origem || '').slice(0, 40) || null : null, obs: String(l.obs || '').trim().slice(0, OBS_MAX) };
}
const insertEntrada = (db, id, contaId, e, quando, email, parId = null) => db.prepare(`INSERT INTO movimentos
  (id, conta_id, lado, tipo, data, pontos, custo, cartao_id, parcelas, vence, resta, bonus_pct, origem, par_id, obs, criado_em, criado_por)
  VALUES (?, ?, 'entrada', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, contaId, e.tipo, e.data, e.pontos, e.custo, e.cartao ?? null, e.parcelas ?? 1, e.vence, e.pontos, e.bonus, e.origem, parId, e.obs, quando, email);

// uma ou várias entradas de uma vez (ex.: todos os clubes do mês)
acao('mov.entradas', ['dono'], async ({ db, env, usuario, quando }, { linhas }) => {
  if (!Array.isArray(linhas) || !linhas.length || linhas.length > 200) throw new Recusa('Nenhuma entrada pra registrar');
  const ids = [...new Set(linhas.map((l) => l.conta))];
  if (!ids.every(Number.isInteger)) throw new Recusa('Conta inválida');
  const contas = await contasCompletas(env, { ids });
  if (contas.length !== ids.length) throw new Recusa('Conta não encontrada');
  const novoId = await proximos(db, 'movimentos');
  const cartoes = new Set((await db.prepare('SELECT id FROM cartoes').all()).results.map((x) => x.id));
  const comandos = [], eventos = [], criados = [];
  linhas.forEach((l) => {
    const e = validarEntrada(l, cartoes), c = contas.find((x) => x.id === l.conta), id = novoId();
    criados.push(id);
    comandos.push(insertEntrada(db, id, c.id, e, quando, usuario.email));
    eventos.push({ entidade: 'conta', id: c.id, texto: `Entrada: +${pts(e.pontos)} pts (${e.tipo})`, depois: e });
  });
  return { resultado: { n: linhas.length, ids: criados }, comandos, eventos };
});

// saída: transferência (vira entrada na conta de destino), expiração ou ajuste. A emissão nasce no atendimento.
acao('mov.saida', ['dono'], async ({ db, env, usuario, quando }, d) => {
  if (!SAIDAS.includes(d.tipo)) throw new Recusa('Tipo de saída inválido');
  if (!inteiro(d.pontos, 1, 100_000_000)) throw new Recusa('Pontos inválidos');
  const data = d.data && ehData(d.data) ? d.data : hojeBR();
  const ids = [d.conta, ...(d.tipo === 'transferencia' ? [d.destino] : [])];
  if (!ids.every(Number.isInteger)) throw new Recusa('Conta inválida');
  if (d.tipo === 'transferencia' && d.destino === d.conta) throw new Recusa('Escolha outra conta de destino');
  const contas = await contasCompletas(env, { ids });
  const c = contas.find((x) => x.id === d.conta), dest = contas.find((x) => x.id === d.destino);
  if (!c || (d.tipo === 'transferencia' && !dest)) throw new Recusa('Conta não encontrada');
  if (dest && dest.programa_id === 'livelo') throw new Recusa('A Livelo só envia pontos; não recebe');

  const novoId = await proximos(db, 'movimentos');
  const saidaId = novoId();
  const g = gastar(db, c, d.pontos, saidaId, Number.isInteger(d.lote) ? d.lote : null);
  const obs = String(d.obs || '').trim().slice(0, OBS_MAX);
  const comandos = [...g.comandos];
  const eventos = [];
  if (d.tipo === 'transferencia') {
    const bonus = d.bonus_pct ?? 0;
    if (!inteiro(bonus, 0, 1000)) throw new Recusa('Bônus inválido');
    const chegam = Math.round(d.pontos * (1 + bonus / 100));
    // o custo dos pontos que saíram vai junto pro lote novo (assim o custo real da conta de destino fica certo)
    const custosLotes = g.usos.length ? (await db.prepare(`SELECT id, custo, pontos FROM movimentos WHERE id IN (${g.usos.map(() => '?').join(',')})`).bind(...g.usos.map((u) => u.id)).all()).results : [];
    const custo = Math.round(g.usos.reduce((s, u) => { const l = custosLotes.find((x) => x.id === u.id); return s + (l && l.pontos ? u.usa * l.custo / l.pontos : 0); }, 0)) + (d.custo_extra ?? 0);
    const entradaId = novoId();
    // as duas pontas se apontam (par_id); a saída nasce sem o par e ganha depois que a entrada existe
    comandos.unshift(db.prepare(`INSERT INTO movimentos (id, conta_id, lado, tipo, data, pontos, obs, criado_em, criado_por)
      VALUES (?, ?, 'saida', 'transferencia', ?, ?, ?, ?, ?)`).bind(saidaId, c.id, data, d.pontos, obs, quando, usuario.email));
    comandos.push(insertEntrada(db, entradaId, dest.id, { tipo: 'transferencia', data, pontos: chegam, custo, vence: d.vence && ehData(d.vence) ? d.vence : somaMeses(data, 24), bonus, origem: c.programa, obs }, quando, usuario.email, saidaId));
    comandos.push(db.prepare('UPDATE movimentos SET par_id = ? WHERE id = ?').bind(entradaId, saidaId));
    eventos.push({ entidade: 'conta', id: c.id, texto: `Transferiu ${pts(d.pontos)} pts pra ${dest.programa} de ${dest.titular}` });
    eventos.push({ entidade: 'conta', id: dest.id, texto: `Recebeu ${pts(chegam)} pts da ${c.programa} de ${c.titular}${bonus ? ` (bônus de ${bonus}%)` : ''}` });
    return { resultado: { id: saidaId, chegam }, comandos, eventos };
  }
  comandos.unshift(db.prepare(`INSERT INTO movimentos (id, conta_id, lado, tipo, data, pontos, obs, criado_em, criado_por)
    VALUES (?, ?, 'saida', ?, ?, ?, ?, ?, ?)`).bind(saidaId, c.id, d.tipo, data, d.pontos, obs, quando, usuario.email));
  eventos.push({ entidade: 'conta', id: c.id, texto: `${d.tipo === 'expiracao' ? 'Expiraram' : 'Ajuste:'} −${pts(d.pontos)} pts${obs ? ` (${obs})` : ''}` });
  return { resultado: { id: saidaId }, comandos, eventos };
});

// acha a pessoa pelo CPF ou cadastra (cadastro único). Devolve { id, comandos }
async function pessoaPorCpf(db, nome, cpf, quando) {
  cpf = soDigitos(cpf);
  if (!cpfValido(cpf)) throw new Recusa('CPF inválido; confira os números');
  const ja = await db.prepare('SELECT id FROM pessoas WHERE cpf = ?').bind(cpf).first();
  if (ja) return { id: ja.id, comandos: [] };
  nome = String(nome || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (nome.split(' ').length < 2) throw new Recusa('Falta o nome completo');
  const { id: ult } = await db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM pessoas').first();
  return { id: ult + 1, nome, comandos: [db.prepare('INSERT INTO pessoas (id, nome, cpf, criada_em) VALUES (?, ?, ?, ?)').bind(ult + 1, nome, cpf, quando)] };
}

// beneficiário registrado à mão: CPF que já voou antes do sistema, ou cadastrado direto no programa
acao('benef.adicionar', ['dono'], async ({ db, quando }, { conta, pessoa, nome, cpf, data }) => {
  const c = Number.isInteger(conta) ? await db.prepare('SELECT id, titular_id FROM contas WHERE id = ?').bind(conta).first() : null;
  if (!c) throw new Recusa('Conta não encontrada', 404);
  if (!ehData(data)) throw new Recusa('Data inválida');
  const p = Number.isInteger(pessoa) ? { id: pessoa, comandos: [] } : await pessoaPorCpf(db, nome, cpf, quando);
  if (p.id === c.titular_id) throw new Recusa('O titular não conta como beneficiário');
  return {
    resultado: { pessoa: p.id },
    comandos: [...p.comandos, db.prepare('INSERT INTO beneficiarios_manuais (conta_id, pessoa_id, data) VALUES (?, ?, ?) ON CONFLICT(conta_id, pessoa_id) DO UPDATE SET data = excluded.data').bind(c.id, p.id, data)],
    eventos: [{ entidade: 'conta', id: c.id, texto: `Registrou beneficiário à mão${p.nome ? `: ${p.nome}` : ''}` }],
  };
});

// conta nova: titular do cadastro (ou novo, pelo CPF), programa, clube e o saldo de hoje (vira o primeiro lote)
acao('conta.criar', ['dono'], async ({ db, usuario, quando }, d) => {
  const prog = await db.prepare('SELECT id, nome FROM programas WHERE id = ?').bind(d.programa).first();
  if (!prog) throw new Recusa('Programa inválido');
  const t = Number.isInteger(d.titular) ? { id: d.titular, comandos: [] } : await pessoaPorCpf(db, d.titular?.nome, d.titular?.cpf, quando);
  if (Number.isInteger(d.titular) && !(await db.prepare('SELECT 1 FROM pessoas WHERE id = ?').bind(d.titular).first())) throw new Recusa('Titular não encontrado');
  const ja = await db.prepare('SELECT 1 FROM contas WHERE titular_id = ? AND programa_id = ?').bind(t.id, prog.id).first();
  if (ja) throw new Recusa('Esse titular já tem conta nesse programa', 409);
  let categoria = null;
  if (prog.id === 'azul') {
    const cat = await db.prepare("SELECT nome FROM categorias WHERE programa_id = 'azul' AND nome = ?").bind(d.categoria || 'Básico').first();
    if (!cat) throw new Recusa('Categoria inválida');
    categoria = cat.nome;
  }
  const clube = prog.id !== 'livelo' && d.clube != null ? d.clube : null;
  if (clube != null && !inteiro(clube, 1, 1_000_000)) throw new Recusa('Pontos do clube inválidos');
  const clubeCusto = clube != null && d.clube_custo != null ? d.clube_custo : null;
  if (clubeCusto != null && !inteiro(clubeCusto, 0, 10_000_000)) throw new Recusa('Mensalidade inválida');
  const saldo = d.saldo ?? 0;
  if (!inteiro(saldo, 0, 100_000_000)) throw new Recusa('Saldo inválido');
  const { id: ult } = await db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM contas').first();
  const id = ult + 1;
  const comandos = [...t.comandos, db.prepare(`INSERT INTO contas (id, titular_id, programa_id, clube, clube_custo, categoria, numero, criada_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, t.id, prog.id, clube, clubeCusto, categoria, String(d.numero || '').trim().slice(0, 40) || null, quando)];
  if (saldo) {
    const hoje = hojeBR(), novoId = await proximos(db, 'movimentos');
    comandos.push(insertEntrada(db, novoId(), id, { tipo: 'inicial', data: hoje, pontos: saldo, custo: 0, vence: d.vence && ehData(d.vence) ? d.vence : somaMeses(hoje, 24), bonus: null, origem: null, obs: 'Saldo do sistema antigo' }, quando, usuario.email));
  }
  return { resultado: { id }, comandos, eventos: [{ entidade: 'conta', id, texto: `Criou a conta ${prog.nome}${saldo ? ` com ${pts(saldo)} pts` : ''}` }] };
});

// altera clube, categoria, número ou desativa
acao('conta.editar', ['dono'], async ({ db }, d) => {
  const c = Number.isInteger(d.id) ? await db.prepare('SELECT * FROM contas WHERE id = ?').bind(d.id).first() : null;
  if (!c) throw new Recusa('Conta não encontrada', 404);
  const clube = c.programa_id !== 'livelo' && d.clube != null ? d.clube : null;
  if (clube != null && !inteiro(clube, 1, 1_000_000)) throw new Recusa('Pontos do clube inválidos');
  const clubeCusto = clube != null && d.clube_custo != null ? d.clube_custo : null;
  let categoria = c.categoria;
  if (c.programa_id === 'azul' && d.categoria) {
    const cat = await db.prepare("SELECT nome FROM categorias WHERE programa_id = 'azul' AND nome = ?").bind(d.categoria).first();
    if (!cat) throw new Recusa('Categoria inválida');
    categoria = cat.nome;
  }
  const depois = { clube, clube_custo: clubeCusto, categoria, numero: String(d.numero || '').trim().slice(0, 40) || null, ativa: d.ativa === false ? 0 : 1 };
  return {
    resultado: { id: c.id },
    comandos: [db.prepare('UPDATE contas SET clube = ?, clube_custo = ?, categoria = ?, numero = ?, ativa = ? WHERE id = ?').bind(...Object.values(depois), c.id)],
    eventos: [{ entidade: 'conta', id: c.id, texto: 'Alterou os dados da conta', antes: c, depois }],
  };
});

// configurações dos programas: valor da milha (milionésimos), limite de CPFs e como as vagas voltam; níveis da Azul
const REGRAS = { ano: 'zera em 1º de janeiro', janela: 'cada um libera a vaga 12 meses após a emissão', manual: 'troca manual com 30 dias de carência' };
acao('config.programas', ['dono'], async ({ db }, { programas = [], niveis = {} }) => {
  const atuais = (await db.prepare('SELECT * FROM programas').all()).results;
  const comandos = [], eventos = [];
  for (const p of programas) {
    const a = atuais.find((x) => x.id === p.id);
    if (!a || a.regra === 'nenhuma') throw new Recusa('Programa inválido');
    if (!inteiro(p.valor_milha, 1, 1_000_000)) throw new Recusa('Valor da milha inválido');
    if (!inteiro(p.limite, 1, 100)) throw new Recusa('Limite de CPFs inválido');
    if (!REGRAS[p.regra]) throw new Recusa('Regra inválida');
    if (a.valor_milha === p.valor_milha && a.limite === p.limite && a.regra === p.regra) continue;
    const renovacao = p.id === 'azul' ? `${p.limite} a 8 CPFs conforme a categoria; ${REGRAS[p.regra]}` : `${p.limite} CPFs; ${REGRAS[p.regra]}`;
    comandos.push(db.prepare('UPDATE programas SET valor_milha = ?, limite = ?, regra = ?, renovacao = ? WHERE id = ?').bind(p.valor_milha, p.limite, p.regra, renovacao, p.id));
    eventos.push({ entidade: 'programa', id: p.id, texto: `Configurações de ${a.nome}`, antes: { valor_milha: a.valor_milha, limite: a.limite, regra: a.regra }, depois: p });
  }
  for (const [nome, limite] of Object.entries(niveis)) {
    if (!inteiro(limite, 1, 100)) throw new Recusa('Limite do nível inválido');
    comandos.push(db.prepare("UPDATE categorias SET limite = ? WHERE programa_id = 'azul' AND nome = ?").bind(limite, nome));
  }
  if (Object.keys(niveis).length) eventos.push({ entidade: 'programa', id: 'azul', texto: 'Níveis da Azul', depois: niveis });
  return { resultado: { ok: true }, comandos, eventos };
});

// ---------- corrigir e apagar entrada/saída ----------
const NOMES_MOV = { clube: 'clube', compra: 'compra', transferencia: 'transferência', cartao: 'cartão', bonus: 'bônus', estorno: 'estorno', inicial: 'saldo inicial', expiracao: 'expiração', ajuste: 'ajuste', emissao: 'emissão' };
async function movimento(db, id) {
  const m = Number.isInteger(id) ? await db.prepare('SELECT * FROM movimentos WHERE id = ?').bind(id).first() : null;
  if (!m) throw new Recusa('Movimento não encontrado (talvez já tenha sido apagado)', 404);
  return m;
}
const intocado = (e) => e.resta === e.pontos;
const jaUsou = (e) => `Já saíram ${pts(e.pontos - e.resta)} pts desse lote. Apague antes as saídas que usaram ele, ou corrija só a observação.`;

// apaga uma entrada ou saída. A saída devolve os pontos pros lotes de onde saíram; a transferência apaga as duas pontas.
acao('mov.apagar', ['dono'], async ({ db }, { id }) => {
  const m = await movimento(db, id);
  if (m.emissao_id && m.lado === 'saida') throw new Recusa('Essa saída é de uma emissão: desfaça pela tela da emissão do orçamento', 409);
  const par = m.par_id ? await movimento(db, m.par_id) : null;
  const saida = m.lado === 'saida' ? m : par && par.lado === 'saida' ? par : null;
  const entrada = m.lado === 'entrada' ? m : par && par.lado === 'entrada' ? par : null;
  if (entrada && !intocado(entrada)) throw new Recusa(par ? `Os pontos que chegaram na outra conta já foram usados. ${jaUsou(entrada)}` : jaUsou(entrada), 409);
  const comandos = [];
  if (par) comandos.push(db.prepare('UPDATE movimentos SET par_id = NULL WHERE id IN (?, ?)').bind(m.id, par.id));
  if (saida) comandos.push(...(await devolver(db, saida)), db.prepare('DELETE FROM consumos WHERE saida_id = ?').bind(saida.id));
  if (entrada) comandos.push(db.prepare('DELETE FROM consumos WHERE lote_id = ?').bind(entrada.id));
  [saida, entrada].filter(Boolean).forEach((x) => comandos.push(db.prepare('DELETE FROM movimentos WHERE id = ?').bind(x.id)));
  const sinal = (x) => `${x.lado === 'entrada' ? '+' : '−'}${pts(x.pontos)} pts`;
  const eventos = [m, par].filter(Boolean).map((x) => ({ entidade: 'conta', id: x.conta_id, texto: `Apagou ${x.lado === 'entrada' ? 'a entrada' : 'a saída'} de ${NOMES_MOV[x.tipo] || x.tipo} (${sinal(x)})`, antes: x }));
  return { resultado: { conta: m.conta_id, apagados: [m, par].filter(Boolean).map((x) => x.id) }, comandos, eventos };
});

// corrige um movimento. Observação e data sempre; pontos, custo e vencimento só onde não bagunça o resto
// (entrada que não veio de transferência; saída de expiração ou ajuste).
acao('mov.editar', ['dono'], async ({ db, env }, d) => {
  const m = await movimento(db, d.id);
  const muda = {}, comandos = [];
  if (d.obs != null) muda.obs = String(d.obs).trim().slice(0, OBS_MAX);
  if (d.data != null) { if (!ehData(d.data)) throw new Recusa('Data inválida'); muda.data = d.data; }
  // emissão sem registro de emissão = veio do documento antigo: corrige como uma saída comum
  const livre = m.lado === 'entrada' ? !m.par_id : ['expiracao', 'ajuste'].includes(m.tipo) || (m.tipo === 'emissao' && !m.emissao_id);
  if (d.pontos != null && d.pontos !== m.pontos) {
    if (!livre) throw new Recusa(m.emissao_id ? 'Os pontos de uma emissão se corrigem desfazendo a emissão' : 'Numa transferência, apague e lance de novo pra mudar os pontos', 409);
    if (!inteiro(d.pontos, 1, 100_000_000)) throw new Recusa('Pontos inválidos');
    if (m.lado === 'entrada') {
      const usado = m.pontos - m.resta;
      if (d.pontos < usado) throw new Recusa(`Já saíram ${pts(usado)} pts desse lote; ele não pode ficar com menos que isso`, 409);
      muda.pontos = d.pontos; muda.resta = d.pontos - usado;
    } else {
      muda.pontos = d.pontos;
      if (d.pontos > m.pontos) { const [c] = await contasCompletas(env, { ids: [m.conta_id] }); comandos.push(...gastar(db, c, d.pontos - m.pontos, m.id).comandos); }
      else comandos.push(...(await devolver(db, m, m.pontos - d.pontos)));
    }
  }
  if (m.lado === 'entrada' && !m.par_id) {
    if (d.custo != null && COM_CUSTO.includes(m.tipo)) { if (!inteiro(d.custo, 0, 100_000_000)) throw new Recusa('Custo inválido'); muda.custo = d.custo; }
    if (d.vence != null) { if (!ehData(d.vence)) throw new Recusa('Vencimento inválido'); muda.vence = d.vence; }
  }
  // cartão e parcelas: em qualquer entrada com custo (inclusive as antigas, pra completar o que foi pago em cartão)
  if (m.lado === 'entrada' && d.cartao !== undefined && COM_CUSTO.includes(m.tipo)) {
    if (d.cartao != null && !(await db.prepare('SELECT 1 FROM cartoes WHERE id = ?').bind(d.cartao).first())) throw new Recusa('Cartão não encontrado; recarregue a página');
    muda.cartao_id = d.cartao ?? null;
    muda.parcelas = d.cartao != null ? parcelasValidas(d.parcelas) : 1;
  }
  const campos = Object.keys(muda).filter((k) => muda[k] !== m[k]);
  if (!campos.length) return { resultado: { id: m.id } };
  comandos.unshift(db.prepare(`UPDATE movimentos SET ${campos.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...campos.map((k) => muda[k]), m.id));
  // transferência: a data é a mesma nas duas pontas
  if (m.par_id && campos.includes('data')) comandos.push(db.prepare('UPDATE movimentos SET data = ? WHERE id = ?').bind(muda.data, m.par_id));
  const antes = Object.fromEntries(campos.map((k) => [k, m[k]])), depois = Object.fromEntries(campos.map((k) => [k, muda[k]]));
  const oQue = campos.filter((k) => k !== 'resta').map((k) => ({ obs: 'observação', data: 'data', pontos: 'pontos', custo: 'custo', vence: 'vencimento', cartao_id: 'cartão', parcelas: 'parcelas' }[k])).join(', ');
  return { resultado: { id: m.id, antes }, comandos, eventos: [{ entidade: 'conta', id: m.conta_id, texto: `Corrigiu ${m.lado === 'entrada' ? 'a entrada' : 'a saída'} de ${NOMES_MOV[m.tipo] || m.tipo}: ${oQue}`, antes, depois }] };
});

// ---------- vaga extra de beneficiário ----------
// o programa liberou mais CPFs pra uma conta: soma no limite enquanto valer (até a data, ou até alguém desligar)
acao('vaga.adicionar', ['dono'], async ({ db, usuario, quando }, { conta, vagas, ate, motivo }) => {
  const c = Number.isInteger(conta) ? await db.prepare('SELECT id FROM contas WHERE id = ?').bind(conta).first() : null;
  if (!c) throw new Recusa('Conta não encontrada', 404);
  if (!inteiro(vagas, 1, 50)) throw new Recusa('Quantidade de vagas inválida');
  if (ate != null && ate !== '' && (!ehData(ate) || ate < hojeBR())) throw new Recusa('A data final já passou');
  const novoId = await proximos(db, 'vagas_extras'), id = novoId();
  motivo = String(motivo || '').trim().slice(0, 200);
  return {
    resultado: { id },
    comandos: [db.prepare('INSERT INTO vagas_extras (id, conta_id, vagas, ate, motivo, criada_em, criada_por) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, c.id, vagas, ate || null, motivo, quando, usuario.email)],
    eventos: [{ entidade: 'conta', id: c.id, texto: `+${vagas} vaga${vagas > 1 ? 's' : ''} extra de beneficiário${ate ? ` até ${ate.split('-').reverse().join('/')}` : ''}${motivo ? ` (${motivo})` : ''}` }],
  };
});
acao('vaga.desligar', ['dono'], async ({ db, quando }, { id }) => {
  const v = Number.isInteger(id) ? await db.prepare('SELECT * FROM vagas_extras WHERE id = ?').bind(id).first() : null;
  if (!v) throw new Recusa('Vaga extra não encontrada', 404);
  if (v.desligada_em) return { resultado: { id } };
  return {
    resultado: { id, conta: v.conta_id },
    comandos: [db.prepare('UPDATE vagas_extras SET desligada_em = ? WHERE id = ?').bind(quando, id)],
    eventos: [{ entidade: 'conta', id: v.conta_id, texto: `Tirou ${v.vagas} vaga${v.vagas > 1 ? 's' : ''} extra de beneficiário`, antes: v }],
  };
});
acao('vaga.religar', ['dono'], async ({ db }, { id }) => {
  const v = Number.isInteger(id) ? await db.prepare('SELECT * FROM vagas_extras WHERE id = ?').bind(id).first() : null;
  if (!v) throw new Recusa('Vaga extra não encontrada', 404);
  return { resultado: { id }, comandos: [db.prepare('UPDATE vagas_extras SET desligada_em = NULL WHERE id = ?').bind(id)], eventos: [{ entidade: 'conta', id: v.conta_id, texto: 'Voltou a vaga extra de beneficiário' }] };
});

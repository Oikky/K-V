// Importa o documento antigo (Superhuman Docs, ex-Coda) pro banco do sistema.
// Uso: node scripts/importar-superhuman.mjs <pasta com os JSON baixados> --local | --remote [--so-sql]
// Os JSON (dado real) ficam fora do repositório. Pode rodar de novo até a virada: apaga o que importou antes e importa outra vez.
// No documento antigo nada é apagado nem alterado: ele só é lido.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [pasta, onde, ...resto] = process.argv.slice(2);
if (!pasta || !['--local', '--remote'].includes(onde)) { console.error('Uso: node scripts/importar-superhuman.mjs <pasta> --local | --remote [--so-sql]'); process.exit(1); }
const soSql = resto.includes('--so-sql');
const WRANGLER = ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'kv', onde];
const POR = 'superhuman'; // criado_por das linhas importadas

// ---------- leitura ----------
const tabelas = {};
for (const f of readdirSync(pasta).filter((f) => f.endsWith('.json') && !f.startsWith('_'))) {
  const t = JSON.parse(readFileSync(join(pasta, f), 'utf8'));
  tabelas[t.nome] = t;
}
const linhas = (nome) => (tabelas[nome] ? tabelas[nome].linhas : []);

// valor "rico" do documento → texto simples; vínculo com outra linha → { id, nome }
function limpa(v) {
  if (v == null || v === '') return null;
  if (Array.isArray(v)) { const a = v.map(limpa).filter((x) => x != null); return a.length ? a : null; }
  if (typeof v === 'object') {
    if (v.additionalType === 'row') return { id: v.rowId, nome: v.name };
    if (v['@type'] === 'MonetaryAmount') return v.amount;
    if (v['@type'] === 'ImageObject') return v.url || '[imagem]';
    if (v['@type'] === 'WebPage') return v.url;
    if (v['@type'] === 'Person') return v.email || v.name;
    if (v.formatType === 'button') return null;
    return JSON.stringify(v);
  }
  if (typeof v === 'string') { const s = v.replace(/^```([\s\S]*)```$/, '$1').trim(); return s === '' ? null : s; }
  return v;
}
const limpas = (nome) => linhas(nome).map((l) => { const o = {}; for (const [k, v] of Object.entries(l)) { const x = limpa(v); if (x != null) o[k] = x; } return o; });
const nomeDe = (x) => (x == null ? null : Array.isArray(x) ? nomeDe(x[0]) : typeof x === 'object' ? x.nome : String(x));
const idDe = (x) => (x == null ? null : Array.isArray(x) ? idDe(x[0]) : typeof x === 'object' ? x.id : null);

// ---------- ajudantes ----------
const diaBR = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
const dia = (s, reserva) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : reserva ? diaBR(reserva) : null);
const hora = (s) => { const m = /T(\d{2}):(\d{2})/.exec(s || ''); return m ? `${m[1]}:${m[2]}` : null; };
const somaMeses = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };
const chave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const espacos = (s) => String(s || '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
const inteiro = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : null; };
const centavos = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100));
const iata = (s) => { const m = String(s || '').match(/\b[A-Z]{3}\b/g); return m ? m[m.length - 1] : null; };
const maisComum = (arr) => { const m = new Map(); arr.filter(Boolean).forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };

const relatorio = [];
const avisa = (t) => relatorio.push(t);

// ---------- banco: o que já existe ----------
function consulta(sql) {
  const saida = execFileSync(process.execPath, [...WRANGLER, '--json', '--command', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const j = JSON.parse(saida);
  return (Array.isArray(j) ? j : [j]).map((r) => r.results);
}
const TABS = ['pessoas', 'contas', 'movimentos', 'orcamentos', 'opcoes', 'ponto'];
const [maximos] = consulta(`SELECT ${TABS.map((t) => `(SELECT COALESCE(MAX(id), 0) FROM ${t} WHERE id NOT IN (SELECT id FROM importado WHERE tabela = '${t}')) AS ${t}`).join(', ')}`);
const [presos] = consulta(`SELECT
  (SELECT COUNT(*) FROM movimentos WHERE conta_id IN (SELECT id FROM importado WHERE tabela = 'contas') AND id NOT IN (SELECT id FROM importado WHERE tabela = 'movimentos')) AS movimentos,
  (SELECT COUNT(*) FROM opcoes WHERE orcamento_id IN (SELECT id FROM importado WHERE tabela = 'orcamentos') AND id NOT IN (SELECT id FROM importado WHERE tabela = 'opcoes')) AS opcoes,
  (SELECT COUNT(*) FROM combos WHERE orcamento_id IN (SELECT id FROM importado WHERE tabela = 'orcamentos')) AS combos,
  (SELECT COUNT(*) FROM emissoes WHERE orcamento_id IN (SELECT id FROM importado WHERE tabela = 'orcamentos')) AS emissoes,
  (SELECT COUNT(*) FROM orcamento_passageiros WHERE pessoa_id IN (SELECT id FROM importado WHERE tabela = 'pessoas')) AS passageiros,
  (SELECT COUNT(*) FROM orcamentos WHERE id NOT IN (SELECT id FROM importado WHERE tabela = 'orcamentos') AND (pessoa_id IN (SELECT id FROM importado WHERE tabela = 'pessoas') OR cliente_id IN (SELECT id FROM importado WHERE tabela = 'pessoas'))) AS orcamentos`);
const travas = Object.entries(presos[0] || {}).filter(([, n]) => n > 0);
if (travas.length) {
  console.error('Parei: a equipe já mexeu no sistema em cima do que foi importado (' + travas.map(([t, n]) => `${n} em ${t}`).join(', ') + ').');
  console.error('Importar de novo apagaria isso. Depois da virada, a importação não roda mais.');
  process.exit(1);
}
// e-mail em minúsculas → como está gravado (o ponto e o responsável precisam bater com a tabela usuarios)
const emails = new Map(consulta('SELECT email FROM usuarios')[0].map((u) => [u.email.toLowerCase(), u.email]));
const seq = Object.fromEntries(TABS.map((t) => [t, maximos[0][t]]));
const novo = (t) => ++seq[t];

// ---------- montagem ----------
const ins = {}; // tabela → [linhas]
const poe = (t, linha) => (ins[t] ||= []).push(linha);
const importado = [];
// a própria linha vai pra lista (sem cópia): o que mudar nela depois (o que resta de um lote) também vai pro banco
const cria = (t, linha) => { linha.id = novo(t); poe(t, linha); importado.push({ tabela: t, id: linha.id }); return linha.id; };

// pessoas: titulares e beneficiários, uma por nome
const pessoaPorNome = new Map();
function pessoa(nome, criadaEm) {
  const n = espacos(nome); const k = chave(n);
  if (!k) return null;
  if (!pessoaPorNome.has(k)) pessoaPorNome.set(k, cria('pessoas', { nome: n, cpf: null, obs: 'Veio do Superhuman Docs', criada_em: criadaEm || new Date().toISOString() }));
  return pessoaPorNome.get(k);
}

// ---------- contas de pontos ----------
const PROG = [
  { id: 'smiles', site: 'Smiles', conta: 'Conta S', info: 'Info S', cartao: 'Cartão S', saldo: 'SMILES' },
  { id: 'latam', site: 'Latam', conta: 'Conta L', info: 'Info L', cartao: 'Cartão L', saldo: 'LATAM' },
  { id: 'azul', site: 'Azul', conta: 'Conta A', info: 'Info A', cartao: 'Cartão A', saldo: 'AZUL' },
  { id: 'livelo', site: 'Livelo', conta: 'Conta Livelo', info: 'Info Livelo', cartao: 'Cartão Livelo', saldo: 'LIVELO' },
];
const progDoSite = (s) => PROG.find((p) => chave(p.site) === chave(nomeDe(s)));

const titulares = limpas('Contas');
const entradas = limpas('Entrada'), saidas = limpas('Saída'), benef = limpas('Beneficiários');
const contaDe = new Map(); // "Nome|programa" → id
const vagasAzul = new Map();
benef.filter((b) => !b.Pessoa && chave(b.Empresa) === 'azul' && b['Máximo de Vagas']).forEach((b) => vagasAzul.set(chave(nomeDe(b.Conta)), b['Máximo de Vagas']));

for (const t of titulares) {
  const titular = pessoa(t.Nome, t.criado);
  for (const p of PROG) {
    const movs = [...entradas, ...saidas].filter((m) => chave(nomeDe(m.Conta)) === chave(t.Nome) && progDoSite(m.Site) === p);
    const tem = t[p.conta] === 'Tem Conta';
    if (!tem && !movs.length) continue;
    if (!tem) avisa(`Conta ${p.site} de ${t.Nome}: marcada "Não Tem", mas tem movimentos; importei mesmo assim.`);
    const info = t[p.info];
    const clubes = entradas.filter((m) => chave(nomeDe(m.Conta)) === chave(t.Nome) && progDoSite(m.Site) === p && /clube/i.test(m['Informações'] || '') && !/b[oô]nus/i.test(m['Informações'] || ''))
      .sort((a, b) => dia(b.Data, b.criado).localeCompare(dia(a.Data, a.criado)));
    const obs = [
      info && !['.', 'n/a', 'Clube'].includes(info) ? `Situação no Superhuman: ${info}` : null,
      info === 'Clube' && !clubes.length ? 'Clube (sem valor anotado)' : null,
      t[p.cartao] ? `Cartão: ${t[p.cartao]}` : null,
      p.id === 'azul' && vagasAzul.get(chave(t.Nome)) ? `Vagas no Superhuman: ${vagasAzul.get(chave(t.Nome))}` : null,
    ].filter(Boolean).join(' · ');
    const id = cria('contas', { titular_id: titular, programa_id: p.id, clube: info === 'Clube' && clubes.length ? inteiro(clubes[0].Pontos) : null, categoria: null, ativa: 1, criada_em: t.criado, obs });
    contaDe.set(`${chave(t.Nome)}|${p.id}`, { id, saldo: inteiro(t[p.saldo]) || 0, nome: t.Nome, prog: p.site });
  }
}

// tipo da entrada pelo texto que a pessoa escreveu
function tipoEntrada(txt) {
  const s = chave(txt);
  if (/estorno|reembolso|cancel/.test(s)) return 'estorno';
  if (/^b[oô]?nus/.test(s) || /^bonus/.test(s)) return 'bonus';
  if (/transfer|tranfer/.test(s)) return 'transferencia';
  if (/compra/.test(s)) return 'compra';
  if (/clube/.test(s)) return 'clube';
  if (/acumulo|cartao|cartão|\bbb\b|santander|banco/.test(s)) return 'cartao';
  if (/bonus/.test(s)) return 'bonus';
  return 'inicial';
}
const origemDe = (txt) => { const s = chave(txt); return /livelo/.test(s) ? 'Livelo' : /esfera|santander/.test(s) ? 'Esfera' : null; };
function tipoSaida(txt) {
  const s = chave(txt);
  if (!s) return 'ajuste';
  if (/^transfer|^tranfer/.test(s)) return 'transferencia';
  if (/expir/.test(s)) return 'expiracao';
  return 'emissao';
}
// emissão: "Nome · GRU a MCZ (LOC)" no lugar do texto inteiro (o texto inteiro fica na cópia do documento)
function resumoEmissao(txt) {
  const ls = espacos(txt).split('\n').map((l) => l.trim()).filter(Boolean);
  const rota = ls.find((l) => /\b[A-Z]{3}\b.*\b a \b.*\b[A-Z]{3}\b/i.test(l) || /\b[A-Z]{3}\s*(a|-|→|>)\s*[A-Z]{3}\b/i.test(l));
  const loc = /loc(?:alizador)?\s*:?\s*([A-Z0-9]{5,8})\b/i.exec(txt || '');
  return `${[ls[0], rota && rota !== ls[0] ? rota : null].filter(Boolean).join(' · ')}${loc ? ` (${loc[1].toUpperCase()})` : ''}`;
}

// movimentos por conta, em ordem de data; as saídas gastam primeiro o lote que vence antes
let semConta = 0, semPontos = 0;
const porConta = new Map();
for (const [lado, lista] of [['entrada', entradas], ['saida', saidas]]) {
  for (const m of lista) {
    const p = progDoSite(m.Site), c = p && contaDe.get(`${chave(nomeDe(m.Conta))}|${p.id}`);
    if (!c) { if (m.Site || m.Conta || m.Pontos) semConta++; continue; }
    const pontos = inteiro(m.Pontos);
    if (!(pontos > 0)) { semPontos++; continue; }
    (porConta.get(c.id) || porConta.set(c.id, []).get(c.id)).push({ lado, m, pontos, data: dia(m.Data, m.criado) });
  }
}
if (semConta) avisa(`${semConta} movimento(s) sem conta ou sem programa ficaram só na cópia do documento.`);
if (semPontos) avisa(`${semPontos} movimento(s) sem pontos (vazio ou zero) ficaram só na cópia do documento.`);

for (const [contaId, movs] of porConta) {
  movs.sort((a, b) => a.data.localeCompare(b.data) || (a.lado === 'entrada' ? -1 : 1) || a.m.criado.localeCompare(b.m.criado));
  const lotes = []; let divida = 0;
  for (const x of movs) {
    const txt = x.m['Informações'] || '';
    if (x.lado === 'entrada') {
      const tipo = tipoEntrada(txt);
      const lote = { conta_id: contaId, lado: 'entrada', tipo, data: x.data, pontos: x.pontos, custo: 0, vence: somaMeses(x.data, 24), resta: x.pontos,
        origem: tipo === 'transferencia' ? origemDe(txt) : null, obs: espacos(txt), criado_em: x.m.criado, criado_por: POR };
      // saída que veio antes da entrada no documento (mesma data, ordem trocada): desconta deste lote
      const usa = Math.min(divida, lote.resta); lote.resta -= usa; divida -= usa;
      cria('movimentos', lote);
      lotes.push(lote);
    } else {
      const tipo = tipoSaida(txt);
      cria('movimentos', { conta_id: contaId, lado: 'saida', tipo, data: x.data, pontos: x.pontos, custo: 0, vence: null, resta: null, origem: null,
        obs: tipo === 'emissao' ? resumoEmissao(txt) : tipo === 'ajuste' ? 'Sem descrição no Superhuman' : espacos(txt).split('\n')[0],
        criado_em: x.m.criado, criado_por: POR });
      let falta = x.pontos;
      for (const l of [...lotes].sort((a, b) => a.vence.localeCompare(b.vence))) { if (falta <= 0) break; const usa = Math.min(l.resta, falta); l.resta -= usa; falta -= usa; }
      divida += falta;
    }
  }
  const c = [...contaDe.values()].find((v) => v.id === contaId);
  const saldo = lotes.reduce((s, l) => s + l.resta, 0) - divida;
  if (saldo !== c.saldo) avisa(`Saldo diferente: ${c.prog} de ${c.nome} (documento ${c.saldo}, importado ${saldo}).`);
  if (divida) avisa(`${c.prog} de ${c.nome}: saídas maiores que as entradas em ${divida} pontos.`);
}

// beneficiários (Livelo não emite, então não tem)
const vistos = new Set();
for (const b of benef.filter((b) => b.Pessoa)) {
  const p = progDoSite(b.Empresa); if (!p || p.id === 'livelo') continue;
  const c = contaDe.get(`${chave(nomeDe(b.Conta))}|${p.id}`);
  if (!c) { avisa(`Beneficiário ${b.Pessoa} na ${p.site} de ${nomeDe(b.Conta)}: essa conta não existe; ficou só na cópia.`); continue; }
  const pid = pessoa(b.Pessoa, b.criado), k = `${c.id}|${pid}`;
  if (vistos.has(k)) continue; vistos.add(k);
  poe('beneficiarios_manuais', { conta_id: c.id, pessoa_id: pid, data: diaBR(b.criado) });
}

// ---------- ponto ----------
let pontoFora = 0;
for (const t of limpas('Tempos').sort((a, b) => String(a.Inicio).localeCompare(String(b.Inicio)))) {
  const email = String(t['Created by'] || '').toLowerCase();
  if (!emails.has(email) || !t.Inicio) { pontoFora++; continue; }
  const rodando = t.Rodando === true || t.Rodando === 'true';
  if (!t.Fim && !rodando) { pontoFora++; continue; }
  cria('ponto', { email: emails.get(email), inicio: new Date(t.Inicio).toISOString(), fim: t.Fim ? new Date(t.Fim).toISOString() : null, manual: 0 });
}
if (pontoFora) avisa(`${pontoFora} registro(s) de ponto sem e-mail da equipe ou sem hora ficaram só na cópia.`);

// ---------- orçamentos ----------
// vínculos com outras tabelas (site, companhia, trechos) viram o nome; só a pasta da viagem fica como vínculo, pra ligar as opções
const nomeOuLista = (v) => (Array.isArray(v) ? v.map(nomeDe).join(', ') : v && typeof v === 'object' ? v.nome : v);
const ORC = limpas('Orçamento BASE NEW').map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === 'Viagem(Pasta)' ? v : nomeOuLista(v)])));
const pastas = ORC.filter((o) => o.Viagem).sort((a, b) => a.criado.localeCompare(b.criado));
const filhasDe = new Map();
for (const o of ORC.filter((o) => o['Viagem(Pasta)'])) { const pid = idDe(o['Viagem(Pasta)']); (filhasDe.get(pid) || filhasDe.set(pid, []).get(pid)).push(o); }
const recente = (iso) => iso >= '2026-10-12';
const TEMPO_ESCALA = ['Tempo da Escala 1', 'Tempo da Escala 2', 'Tempo da escala 3'];
const SITE = { smiles: 'Smiles', latam: 'Latam', azul: 'TudoAzul', interline: 'Interline', skyscanner: 'Skyscanner' };
let opcoesFora = 0;
for (const pz of pastas) {
  const filhas = (filhasDe.get(pz._id) || []).sort((a, b) => a.criado.localeCompare(b.criado));
  // "Jandira (3 pessoas e pet)": o nome vai pro cartão e o que está entre parênteses vai pro pedido
  const viagem = espacos(pz.Viagem), parenteses = /^(.*?)\s*\((.*)\)?\s*$/.exec(viagem);
  const nome = (parenteses && parenteses[1]) || viagem, detalhe = parenteses ? parenteses[2].replace(/\)\s*$/, '').trim() : '';
  const pessoasN = /(\d+)\s*(pessoas?|adultos?|pax)/i.exec(viagem);
  const ultimo = [pz.criado, ...filhas.map((f) => f.criado)].sort().pop();
  const quem = emails.get(maisComum(filhas.map((f) => String(f.Column || '').toLowerCase()).filter((e) => emails.has(e)))) || null;
  // trechos: ida (0) e volta (1), pelo que foi pesquisado; sem opções, pelo que está na pasta
  const grupos = ['Ida', 'Volta'].map((iv) => filhas.filter((f) => (f['Ida/Volta'] || 'Ida') === iv)).filter((g) => g.length);
  let trechos = grupos.map((g) => ({ de: maisComum(g.map((f) => iata(f.Origem))), para: maisComum(g.map((f) => iata(f.Destino))), data: g.map((f) => dia(f.Data)).filter(Boolean).sort()[0], filhas: g }));
  if (!trechos.length) {
    trechos = [{ de: iata(pz.Origem), para: iata(pz.Destino), data: null, filhas: [] }];
    if (pz.Trechos === 'Ida e Volta') trechos.push({ de: iata(pz.Destino), para: iata(pz.Origem), data: null, filhas: [] });
  }
  const etapa = recente(ultimo) ? 'pesquisado' : 'perdido';
  const observacao = [
    pz['Observações'], pz['Data Ida Orçamento'] && `Datas de ida pedidas: ${pz['Data Ida Orçamento'].replace(/\n/g, ', ')}`,
    pz['Data Volta Orçamento'] && `Datas de volta pedidas: ${pz['Data Volta Orçamento'].replace(/\n/g, ', ')}`,
    pz.Skyscanner && `Skyscanner:\n${pz.Skyscanner}`, pz['Em função site'] && `Anotações:\n${pz['Em função site']}`,
  ].filter(Boolean).map(espacos).join('\n\n');
  const orcId = cria('orcamentos', {
    contato_nome: nome, contato_whatsapp: '', etapa, antes_de_perder: etapa === 'perdido' ? 'pesquisado' : null,
    motivo: etapa === 'perdido' ? 'Veio do Superhuman Docs sem desfecho anotado' : null, responsavel: quem,
    adultos: pessoasN ? Math.max(1, Math.min(9, +pessoasN[1])) : 1, criancas: 0, bebes: 0,
    pedido: [detalhe, pz['Voo Direto'] === true || pz['Voo Direto'] === 'true' ? 'Só voo direto' : ''].filter(Boolean).join(' · '), observacao, faltando: '[]', origem: 'superhuman', audio: 0,
    criado_em: pz.criado, criado_por: POR,
  });
  trechos.forEach((t, i) => poe('trechos', { orcamento_id: orcId, ordem: i, de: t.de || '???', para: t.para || '???', data: t.data || diaBR(pz.criado), janela: 0 }));
  trechos.forEach((t, i) => t.filhas.forEach((f) => {
    const site = SITE[chave(f.Site)] || (f.Site ? String(f.Site) : 'Skyscanner');
    const sai = hora(f['Horário de Saída 24HRS']), chega = hora(f['Horário de Chegada 24HRS']);
    if (!sai || !chega) { opcoesFora++; return; }
    const d = dia(f.Data) || t.data || diaBR(f.criado), dChega = dia(f['Data de Chegada']);
    const escalas = ['Escala 1', 'Escala 2', 'Escala 3'].filter((k) => f[k]);
    const mala = String(f['Mala Despachada'] || '');
    const pontos = site !== 'Skyscanner';
    poe('opcoes', { id: null, orcamento_id: orcId, trecho: i, site, data: d, sai,
      chega: `${chega}${dChega && dChega > d ? ' +1' : ''}`, cia: f['CIA Aérea'] || '', voo: '',
      escalas: escalas.length, bagagem: /^\s*[1-9]/.test(mala) && !/n[aã]o/i.test(mala) ? 1 : 0,
      milhas: pontos ? inteiro(f['Quantidade de Milhas']) : null, taxa: pontos ? centavos(f.Taxa) ?? 0 : null,
      preco: pontos ? null : centavos(f.Taxa) ?? 0, link: '',
      obs: [escalas.map((k, n) => [f[k], f[TEMPO_ESCALA[n]]].filter(Boolean).join(' ')).join(', '),
        f['Tempo de Viagem'] && `Duração ${f['Tempo de Viagem']}`, f['Valor com Mala'] && `Com mala: ${Number(f['Valor com Mala']).toLocaleString('pt-BR')} milhas`,
        f['Observações'], f['Observação Data']].filter(Boolean).map(espacos).join(' · '),
      criada_em: f.criado, criada_por: String(f.Column || POR).toLowerCase() });
  }));
}
// ids das opções em ordem de criação
(ins.opcoes || []).sort((a, b) => a.criada_em.localeCompare(b.criada_em)).forEach((o) => { o.id = novo('opcoes'); importado.push({ tabela: 'opcoes', id: o.id }); });
if (opcoesFora) avisa(`${opcoesFora} opção(ões) de voo sem horário ficaram só na cópia.`);
const idsPastas = new Set(pastas.map((p) => p._id));
const semPasta = ORC.filter((o) => !o.Viagem && !idsPastas.has(idDe(o['Viagem(Pasta)']))).length;
if (semPasta) avisa(`${semPasta} linha(s) de orçamento sem pasta de viagem ficaram só na cópia.`);

// ---------- SQL ----------
const val = (v) => {
  if (v == null) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') throw new Error('Valor que não é texto indo pro banco: ' + JSON.stringify(v).slice(0, 120));
  return `'${String(v).replace(/'/g, "''")}'`;
};
const sql = ['PRAGMA defer_foreign_keys = true;'];
// apaga o que a importação anterior criou (dos filhos pros pais)
const doImportado = (t) => `(SELECT id FROM importado WHERE tabela = '${t}')`;
sql.push(
  `DELETE FROM beneficiarios_manuais WHERE conta_id IN ${doImportado('contas')};`,
  `DELETE FROM movimentos WHERE id IN ${doImportado('movimentos')};`,
  `DELETE FROM contas WHERE id IN ${doImportado('contas')};`,
  `DELETE FROM opcoes WHERE id IN ${doImportado('opcoes')};`,
  `DELETE FROM trechos WHERE orcamento_id IN ${doImportado('orcamentos')};`,
  `DELETE FROM conferencia WHERE orcamento_id IN ${doImportado('orcamentos')};`,
  `DELETE FROM orcamentos WHERE id IN ${doImportado('orcamentos')};`,
  `DELETE FROM ponto WHERE id IN ${doImportado('ponto')};`,
  `DELETE FROM pessoas WHERE id IN ${doImportado('pessoas')};`,
  'DELETE FROM importado;', 'DELETE FROM superhuman;',
);
function inserir(t, lista) {
  if (!lista || !lista.length) return;
  const cols = Object.keys(lista[0]);
  for (let i = 0; i < lista.length; i += 40) {
    sql.push(`INSERT INTO ${t} (${cols.join(', ')}) VALUES\n${lista.slice(i, i + 40).map((l) => `(${cols.map((c) => val(l[c])).join(', ')})`).join(',\n')};`);
  }
}
for (const t of ['pessoas', 'contas', 'movimentos', 'beneficiarios_manuais', 'orcamentos', 'trechos', 'opcoes', 'ponto']) inserir(t, ins[t]);
inserir('importado', importado);
// cópia de todas as linhas do documento
const copia = [];
for (const t of Object.values(tabelas)) for (const l of t.linhas) {
  const o = {}; for (const [k, v] of Object.entries(l)) { if (k === '_id') continue; const x = limpa(v); if (x != null) o[k] = x; }
  copia.push({ tabela: t.nome, coda_id: l._id, dados: JSON.stringify(o) });
}
inserir('superhuman', copia);
sql.push(`INSERT INTO eventos (quando, quem, acao, entidade, entidade_id, texto) VALUES (${val(new Date().toISOString())}, 'importacao', 'importar.superhuman', 'sistema', 'superhuman', ${val(`Importou o Superhuman Docs: ${importado.length} linhas`)});`);

const arquivo = join(tmpdir(), `kv-importar-superhuman-${onde.slice(2)}.sql`);
writeFileSync(arquivo, sql.join('\n'));

// ---------- resumo ----------
const conta = (t) => (ins[t] || []).length;
console.log(`Pessoas ${conta('pessoas')} · contas ${conta('contas')} · movimentos ${conta('movimentos')} · beneficiários ${conta('beneficiarios_manuais')}`);
console.log(`Orçamentos ${conta('orcamentos')} (${(ins.orcamentos || []).filter((o) => o.etapa === 'pesquisado').length} pra revisar, o resto no arquivo) · trechos ${conta('trechos')} · opções ${conta('opcoes')}`);
console.log(`Ponto ${conta('ponto')} · cópia do documento ${copia.length} linhas`);
relatorio.forEach((r) => console.log('  - ' + r));
console.log(`SQL: ${arquivo}`);
if (soSql) process.exit(0);
execFileSync(process.execPath, [...WRANGLER, '--file', arquivo, ...(onde === '--remote' ? ['-y'] : [])], { stdio: 'inherit' });

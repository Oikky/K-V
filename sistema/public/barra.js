/* Barra da pesquisa (dentro da extensão do Chrome): quem está usando, o cronômetro, os orçamentos em pesquisa com a pessoa
   e o formulário da opção de voo, preenchido à mão (o mesmo da tela de pesquisa: shared/opcao-form.js).
   Redesign v2, versão A (rascunho _rascunhos/v2/extensao.html?ver=a): lista com o cartão do quadro (trilho dos trechos),
   trechos numa pílula que desliza, voos abrindo embaixo deles mesmos e o formulário numa folha que sobe de baixo.
   Da aba aberta ao lado, a barra só usa o endereço: escolhe o site sozinha e oferece o endereço como link do preço. */
(function () {
  const O = KVOrc, esc = O.esc;
  const app = document.getElementById('barra');
  const naExtensao = window.parent !== window;
  // versão mínima da extensão que a barra precisa (versao.json, gerado por "npm run extensao"); a instalada abaixo dela = aviso pra atualizar
  let EXT_VERSAO = null;
  fetch('/extensao/versao.json', { cache: 'no-store' }).then((r) => r.json()).then((v) => { EXT_VERSAO = v.minima || v.versao; desenhar(); }).catch(() => {});
  try { const t = localStorage.getItem('kv-tema'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  let est = null, eu = null, dono = false, lista = [], orc = null, trecho = 0;
  let aba = { url: '', titulo: '', versao: null };
  let form = null, recado = null, salvando = false;
  let editando = null, editBase = null; // id da opção já lançada que está aberta no formulário
  let folha = false, vooAberto = null, apagando = null, busca = ''; // folha = o formulário aberto (sobe de baixo)
  const lembrar = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  const lembrado = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  // ---------- conversa com a extensão ----------
  const ORIGEM_EXT = /^chrome-extension:\/\//;
  const pedir = (tipo, dados = {}) => naExtensao && window.parent.postMessage({ kv: true, tipo, ...dados }, '*');
  addEventListener('message', (e) => {
    if (!ORIGEM_EXT.test(e.origin) || !e.data || !e.data.kv) return;
    const d = e.data;
    if (d.tipo === 'aba') {
      const mudouSite = siteDaUrl(d.url) !== siteDaUrl(aba.url);
      sincronizar();
      aba = { url: d.url || '', titulo: d.titulo || '', versao: d.versao || aba.versao };
      if (form && mudouSite && siteDaUrl(aba.url) && !form.travadoSite) form.site = siteDaUrl(aba.url);
      desenhar();
    } else if (d.tipo === 'erro') {
      sincronizar(); recado = { erro: true, texto: d.texto }; desenhar();
    }
  });

  const pad = (n) => String(n).padStart(2, '0');

  function siteDaUrl(u) {
    const h = (() => { try { return new URL(u).hostname; } catch (e) { return ''; } })();
    if (/smiles\.com/.test(h)) return 'Smiles';
    if (/latam/.test(h)) return 'Latam';
    if (/voeazul|tudoazul/.test(h)) return 'TudoAzul';
    return null;
  }

  // ---------- dados ----------
  async function carregar() {
    est = await KVApi.estado(); eu = est.eu; dono = eu.papel === 'dono' || eu.papel === 'admin';
    await carregarPonto().catch(() => { ponto = null; });
    // sem "pegar" (2026-11-19): todo mundo vê tudo que ainda está na pesquisa (novos e em pesquisa)
    lista = (await KVApi.orcamentos()).filter((o) => ['novo', 'pesquisa'].includes(o.etapa));
    const lemb = +lembrado('kv-barra-orc');
    if (lemb && lista.some((o) => o.id === lemb)) await abrir(lemb, { manterForm: true });
    else { orc = null; desenhar(); }
  }
  // com um orçamento aberto, avisa o servidor a cada 30 s e mostra quem mais está nele
  let outrosAqui = [];
  async function avisarPresenca() {
    if (!orc || document.hidden) return;
    try { outrosAqui = (await KVApi.presenca(orc.id)).outros; const el = app.querySelector('[data-aqui]'); if (el) { el.innerHTML = aquiHtml(outrosAqui); if (window.lucide) lucide.createIcons(); } } catch (e) {}
  }
  setInterval(avisarPresenca, 30000);
  async function abrir(id, { manterForm = false } = {}) {
    orc = await KVApi.orcamento(id); outrosAqui = []; avisarPresenca();
    lembrar('kv-barra-orc', id);
    if (!manterForm || !form) { trecho = Math.min(+lembrado('kv-barra-trecho') || 0, orc.trechos.length - 1); novoForm(); restaurarRascunho(); }
    desenhar();
  }
  function novoForm(manter = {}) {
    const t = orc.trechos[trecho];
    form = { site: siteDaUrl(aba.url) || (form && form.site) || 'Smiles', data: t.data, ...manter };
    editando = null; editBase = null;
  }

  // ---------- rascunho: nada do que foi digitado se perde ----------
  // Cada orçamento e trecho guarda o formulário neste navegador a cada mudança (inclusive a edição de uma opção já lançada).
  // Fechar a barra, trocar de orçamento, a internet cair na hora de salvar: ao voltar, está tudo lá. Só some depois de salvo.
  const chaveRasc = () => orc && `kv-barra-rasc:${orc.id}:${trecho}`;
  // o que conta pra saber se o formulário mudou (normalizado: aeroporto igual ao do trecho, "mesmo dia" etc. não contam)
  const CAMPOS_SIG = ['site', 'data', 'cia', 'voo', 'de', 'para', 'sai', 'chega', 'depois', 'duracao', 'bagagem', 'malaMao', 'cabine', 'milhas', 'taxa', 'preco', 'milhasMala', 'destaque', 'obs', 'link'];
  function assinatura(f) {
    const t = orc.trechos[trecho];
    return JSON.stringify([CAMPOS_SIG.map((k) => {
      let v = String(f[k] ?? '').trim();
      if (k === 'de' || k === 'para') { v = v.toUpperCase(); if (v === t[k]) v = ''; }
      if (k === 'depois' || k === 'bagagem') v = String(+v || 0);
      if (k === 'malaMao' && f[k] == null) v = '1';
      if (k === 'cia' && v === f.site) v = '';
      return v;
    }), (f.escalasOnde || []).filter(([l, tm]) => String(l).trim() || String(tm).trim())]);
  }
  const temConteudo = (f) => ['sai', 'chega', 'cia', 'voo', 'duracao', 'milhas', 'taxa', 'preco', 'milhasMala', 'destaque', 'obs'].some((k) => String(f[k] || '').trim())
    || (f.escalasOnde || []).some(([l, tm]) => String(l).trim() || String(tm).trim());
  // tem coisa no formulário que ainda não foi salva? (opção nova com algo preenchido, ou edição com algo alterado)
  const sujo = () => !!form && (editando ? assinatura(form) !== editBase : temConteudo(form));
  let rascTimer = null;
  function salvarRascunho() {
    clearTimeout(rascTimer);
    rascTimer = setTimeout(() => {
      if (!form || !orc) return;
      lembrar(chaveRasc(), sujo() ? JSON.stringify({ form, editando, editBase, em: Date.now() }) : null);
    }, 250);
  }
  function restaurarRascunho() {
    try {
      const r = JSON.parse(lembrado(chaveRasc()) || 'null');
      if (!r || Date.now() - r.em > 14 * 864e5) return false;
      // a opção em edição pode ter sido apagada no sistema: aí o rascunho volta como opção nova
      const existe = r.editando && (orc.opcoes || []).some((x) => x.id === r.editando);
      form = r.form; editando = existe ? r.editando : null; editBase = existe ? r.editBase : null;
      recado = { texto: editando ? 'Edição recuperada: estava aqui do jeito que você deixou.' : 'Rascunho recuperado: estava aqui do jeito que você deixou.' };
      return true;
    } catch (e) { return false; }
  }
  const apagarRascunho = () => { clearTimeout(rascTimer); lembrar(chaveRasc(), null); };

  // ---------- cronômetro (o mesmo do Ponto: fica no servidor, fechar a barra não para nem perde nada) ----------
  let ponto = null, mexendoPonto = false;
  const fazPesquisa = () => eu && (eu.papel === 'pesquisador' || !!eu.pesquisa);
  async function carregarPonto() {
    if (!fazPesquisa()) { ponto = null; return; }
    const d = await KVApi.ponto();
    const p = (d.pesquisadores || []).find((x) => x.email === eu.email);
    const vs = p ? p.valores : [];
    ponto = { trechos: d.trechos.filter((t) => t.email === eu.email), valor: vs.length ? vs[vs.length - 1].valor : 0 };
  }
  function contas() {
    const agora = Date.now(), ini = new Date(); ini.setHours(0, 0, 0, 0);
    let ms = 0, rod = null;
    for (const t of ponto.trechos) {
      const a = Date.parse(t.inicio), b = t.fim ? Date.parse(t.fim) : agora;
      if (!t.fim) rod = t;
      ms += Math.max(0, b - Math.max(a, ini.getTime()));
    }
    return { ms, rod, ganho: Math.round(ms / 36e5 * ponto.valor), ligadoMs: rod ? agora - Date.parse(rod.inicio) : 0 };
  }
  setInterval(() => {
    if (!ponto) return;
    const c = contas();
    app.querySelectorAll('[data-cron-t]').forEach((el) => { el.textContent = relogioCurto(c.ms); });
    app.querySelectorAll('[data-cron-g]').forEach((el) => { el.textContent = O.fmt.brl(c.ganho); });
  }, 1000);
  async function alternarPonto() {
    if (mexendoPonto || !ponto) return;
    mexendoPonto = true; sincronizar(); desenhar();
    try { await KVApi.acao(contas().rod ? 'ponto.pausar' : 'ponto.iniciar'); await carregarPonto(); }
    catch (e) { recado = { erro: true, texto: 'O cronômetro não mudou: ' + e.message }; try { await carregarPonto(); } catch (_) {} }
    mexendoPonto = false; desenhar();
  }
  const relogioCurto = (ms) => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 60)}h ${pad(m % 60)}min`; };
  function cron() {
    if (!ponto) return '';
    const c = contas(), lig = !!c.rod;
    return `<div class="cron ${lig ? 'lig' : ''}" title="Hoje: ${O.fmt.brl(c.ganho)}"><span><b data-cron-t>${relogioCurto(c.ms)}</b> <small>hoje</small></span>
      <button type="button" data-ponto ${mexendoPonto ? 'disabled' : ''} aria-label="${lig ? 'Pausar' : 'Começar'} o cronômetro">${icone(lig ? 'pause' : 'play')}</button></div>`;
  }
  // esqueceu o cronômetro ligado: aviso embaixo do topo
  function cronEsqueceu() {
    if (!ponto) return '';
    const c = contas();
    return c.ligadoMs > 10 * 36e5 ? `<a class="cron-esq" href="/ponto.html" target="_blank">${icone('alarm-clock')}Ligado há ${Math.floor(c.ligadoMs / 36e5)}h. Esqueceu? Corrigir</a>` : '';
  }

  // só o admin: usar a barra como outra pessoa da equipe (igual ao "ver como" do sistema; esta escolha fica só na barra)
  function verComo() {
    if (!est || !est.equipe) return '';
    const real = eu.admin ? eu.admin.email : eu.email;
    return `<label class="b-vercomo">${icone('eye')}<span>Ver como</span><select data-ver-como>${est.equipe.map((u) => `<option value="${esc(u.email === real ? '' : u.email)}" ${u.email === eu.email ? 'selected' : ''}>${esc(u.nome)}${u.email === real ? ' (você)' : ''}</option>`).join('')}</select></label>`;
  }

  // ---------- peças ----------
  const icone = (n) => `<i data-lucide="${n}"></i>`;
  function avatar(u) {
    const ini = esc((u.nome || '?').trim().charAt(0).toUpperCase());
    return `<span class="avatar" aria-hidden="true">${ini}${u.foto ? `<img src="${esc(u.foto)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
  }
  const PAPEL = { dono: 'Dono', admin: 'Admin', pesquisador: 'Pesquisador' };
  const maisVelha = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); return false; };
  function avisos() {
    const velha = naExtensao && aba.versao && EXT_VERSAO && maisVelha(aba.versao, EXT_VERSAO);
    return `${velha ? `<a class="b-aviso" href="/extensao.html" target="_blank">${icone('download')}<span>Atualize a extensão: a instalada é a ${esc(aba.versao)} e a barra precisa da ${esc(EXT_VERSAO)} ou mais nova. Toque pra ver como.</span></a>` : ''}
`;
  }
  const quem = () => `<div class="quem"><b>${esc(eu.nome)}</b><span>${PAPEL[eu.papel] || ''}</span></div>`;
  const topo = () => `<header class="b-topo">${avatar(eu)}${quem()}${cron()}${recarregar()}</header>${cronEsqueceu()}${avisos()}`;
  const recarregar = () => `<button class="btn icone fantasma" type="button" data-recarregar aria-label="Atualizar">${icone('refresh-cw')}</button>`;
  const recadoHtml = () => (recado ? `<p class="b-recado ${recado.erro ? 'erro' : recado.ok ? 'ok' : ''}" role="status">${esc(recado.texto)}</p>` : '');
  const opResumo = (x) => `${esc(x.site)} ${O.dataCurta(x.data)} · ${esc(x.sai)} → ${esc(x.chega)}`;
  const opsDo = (ti) => (orc.opcoes || []).filter((x) => x.trecho === ti);
  const nomeDe = (email) => ((est.usuarios || []).find((u) => u.email === email) || {}).nome || email || '';

  // ---------- lista: o cartão do quadro (trilho = um traço por trecho; azul = já tem voo) ----------
  const tira = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const casa = (o) => { const q = tira(busca.trim()); return !q || tira(`${o.contato.nome} ${O.destino(o)} ${O.rota(o)}`).includes(q) || String(o.id) === q; };
  function cartao(o) {
    const n = o.trechos.length, com = o.trechos.filter((t) => t.nVoos).length, d1 = o.trechos[0].data, d2 = o.trechos[n - 1].data;
    return `<button type="button" class="ca" data-abrir="${o.id}"><span class="l1"><b>${esc(o.contato.nome || 'sem nome')}</b><small>#${o.id} · ${O.idade(o.criadoEm)}</small></span>
      <span class="rota">${esc(O.rota(o))}</span><span class="sub">${esc(O.destino(o))} · ${O.dataCurta(d1)}${d1 !== d2 ? ` – ${O.dataCurta(d2)}` : ''} · ${esc(O.fmtPax(o.passageiros))}</span>
      <span class="trilho">${o.trechos.map((t) => `<i class="${t.nVoos ? 'ok' : ''}"></i>`).join('')}</span>
      <span class="trilho-t"><span>${com} de ${n} ${n > 1 ? 'trechos' : 'trecho'} com voo</span><span>${ultimo(o)}</span></span>${rodapeLista(o)}</button>`;
  }
  const quemE = (email) => (email === eu.email ? 'você' : esc(nomeDe(email).split(' ')[0]));
  // parado há dias: o tempo já está na etiqueta de baixo, então aqui vai só o nome
  const ultimo = (o) => (o.ultimoVooEm ? `último: ${o.ultimoVooPor === eu.email ? 'você' : esc(String(o.ultimoVooNome || '').split(' ')[0])}${O.parado(o) ? '' : ` · ${O.idade(o.ultimoVooEm)}`}` : o.responsavel ? `pra ${quemE(o.responsavel)}` : '');
  const aquiHtml = (nomes) => (nomes.length ? `<span class="etiqueta ok">${icone('eye')}${esc(nomes.map((x) => x.split(' ')[0]).join(' e '))} ${nomes.length > 1 ? 'estão' : 'está'} aqui agora</span>` : '');
  function rodapeLista(o) {
    const p = O.parado(o), r = aquiHtml(o.agora) + (p ? `<span class="etiqueta ${p.cor}">${icone('hourglass')}${p.texto}</span>` : '');
    return r ? `<span class="rodape">${r}</span>` : '';
  }
  function telaLista() {
    // "seus": os que você lançou o último voo (ou que o dono passou pra você); o resto, parados há mais tempo primeiro
    const l = lista.filter(casa), meu = (o) => (o.ultimoVooEm ? o.ultimoVooPor : o.responsavel) === eu.email, desde = (o) => o.ultimoVooEm || o.criadoEm;
    const com = l.filter(meu), outros = l.filter((o) => !meu(o)).sort((a, b) => desde(a).localeCompare(desde(b)));
    return `${topo()}${recadoHtml()}<label class="b-busca">${icone("search")}<input type="search" data-busca placeholder="Buscar nome, cidade ou nº" aria-label="Buscar orçamento" value="${esc(busca)}"></label>
      ${com.length ? `<h2 class="grupo-t"><span class="ic">${icone('search')}</span>Você pesquisou por último <span class="n">${com.length}</span></h2>${com.map(cartao).join('')}` : ''}
      <h2 class="grupo-t"><span class="ic teal">${icone('inbox')}</span>Pra pesquisar <span class="n">${outros.length}</span></h2>
      ${outros.length ? outros.map(cartao).join('') : '<p class="b-vazio">Nada esperando pesquisa agora.</p>'}`;
  }

  // ---------- um orçamento: trechos em pílula, voos em acordeão; o formulário sobe numa folha ----------
  const nota = () => { const n = [orc.pedido, orc.observacao].filter(Boolean).join(' · '); return n ? `<details class="b-nota"><summary>${icone('message-square-text')}<span>${esc(n)}</span></summary></details>` : ''; };
  const trechosA = () => (orc.trechos.length > 1 ? `<div class="trs" role="tablist" aria-label="Trechos"><span class="ind" data-ind></span>${orc.trechos.map((x, i) => { const n = opsDo(i).length;
    return `<button type="button" class="tr" role="tab" aria-selected="${i === trecho}" data-trecho="${i}"><b>${esc(x.de)} → ${esc(x.para)}</b><small>${n ? `<span class="ok">${n} ${n > 1 ? 'voos' : 'voo'}</span>` : 'sem voo'}${O.roteiros(orc).length > 1 ? ` · ${O.letra(x.roteiro || 0)}` : ''}</small></button>`; }).join('')}</div>` : '');
  const valor = (x) => (x.milhas ? `${O.fmt.pts(x.milhas)} mi<small>+ ${O.fmt.brl(x.taxa)}</small>` : `${O.fmt.brl(x.preco)}<small>dinheiro</small>`);
  function vooHtml(x) {
    const on = vooAberto === x.id, malas = x.bagagem ? `${x.bagagem} mala${x.bagagem > 1 ? 's' : ''}` : 'sem mala';
    const linhas = [['Dia', `${O.diaCurto(x.data)} ${O.dataCurta(x.data)}`], ['Voo', [x.voo, x.cia].filter(Boolean).map(esc).join(' · ') || '—'], ['Horário', `${esc(x.sai)} → ${esc(x.chega)}`], ['Tempo', esc(x.duracao || '—')],
      ['Escalas e malas', `${x.escalas ? `${x.escalas} escala${x.escalas > 1 ? 's' : ''}` : 'direto'} · ${malas}`], ['Por pessoa', x.milhas ? `${O.fmt.pts(x.milhas)} milhas + ${O.fmt.brl(x.taxa)}` : O.fmt.brl(x.preco)]];
    const acoes = apagando === x.id
      ? `<span class="pergunta">Apagar este voo?</span><button type="button" class="bt perigo" data-apagar-sim="${x.id}">${icone('trash-2')}Apagar</button><button type="button" class="bt" data-apagar-nao>Não</button>`
      : `<button type="button" class="bt" data-editar="${x.id}">${icone('pencil')}Editar</button><button type="button" class="bt" data-dup="${x.id}">${icone('copy')}Repetir</button><button type="button" class="bt perigo fim" data-apagar="${x.id}" aria-label="Apagar">${icone('trash-2')}</button>`;
    return `<div class="v4c ${on ? 'aberto' : ''} ${x.id === novoId ? 'novo' : ''}" data-v="${x.id}">
      <button type="button" class="v4" data-voo="${x.id}" aria-expanded="${on}"><span class="sitec" data-s="${esc(x.site)}">${esc(x.site.slice(0, 2).toUpperCase())}</span><span class="h">${esc(x.sai)} → ${esc(x.chega)}</span><span class="m">${esc(x.site)} · ${O.dataCurta(x.data)} · ${x.escalas ? `${x.escalas} esc.` : 'direto'} · ${malas}</span><span class="p">${valor(x)}</span><span class="chev">${icone('chevron-down')}</span></button>
      <div class="det-wrap" ${on ? '' : 'inert'}><div><div class="det"><dl>${linhas.map(([a, b], i) => `<dt style="--i:${i}">${a}</dt><dd style="--i:${i}">${b}</dd>`).join('')}</dl>
        <div class="acoes" style="--i:6">${acoes}</div></div></div></div></div>`;
  }
  function voosHtml() {
    const t = orc.trechos[trecho], ops = opsDo(trecho).slice().sort((a, b) => a.data.localeCompare(b.data) || a.sai.localeCompare(b.sai));
    return `<div class="tr-cab"><b>${esc(t.de)} → ${esc(t.para)}</b><small>${[t.data, ...(t.outrasDatas || [])].map((x) => `${O.diaCurto(x)} ${O.dataCurta(x)}`).join(' e ')}${t.outrasDatas && t.outrasDatas.length ? ' · olhar esses dias' : t.janela ? ' · janela de 14 dias' : ''}</small></div>
      ${ops.length ? ops.map(vooHtml).join('') : '<p class="falta">Nenhum voo neste trecho ainda.</p>'}
      <button type="button" class="lancar" data-nova>${icone('plus')}Lançar voo neste trecho</button>`;
  }
  const campos = () => KVOpcao.html(orc.trechos[trecho], form)
    + (naExtensao && aba.url && /^https:/.test(aba.url) && form.link !== aba.url ? `<button type="button" class="b-usar" data-usar-aba>${icone('link')}Usar o endereço da aba aberta como link</button>` : '');
  function folhaHtml() {
    const t = orc.trechos[trecho], ed = editando && (orc.opcoes || []).find((x) => x.id === editando);
    return `<div class="veu-p ${folha ? 'on' : ''}" data-fechar-folha></div>
      <section class="folha ${folha ? 'on' : ''}" role="dialog" aria-modal="true" aria-labelledby="folha-t" ${folha ? '' : 'inert'}><div class="puxa"></div>
        <header><div class="t"><b id="folha-t">${ed ? 'Editar voo' : 'Lançar voo'}</b><small>#${orc.id} · ${esc(t.de)} → ${esc(t.para)}${ed ? ` · ${opResumo(ed)}` : ''}</small></div><button type="button" class="ico" data-fechar-folha aria-label="Fechar">${icone('x')}</button></header>
        <form class="corpo b-form form-op ${ed ? 'em-edicao' : ''}" id="b-form" autocomplete="off">${folha ? recadoHtml() + campos() : ''}<button type="submit" hidden></button></form>
        <footer><button type="button" class="bt" data-fechar-folha>Cancelar</button><button type="button" class="bt pri" data-lancar ${salvando ? 'disabled' : ''}>${icone(salvando ? 'loader' : ed ? 'check' : 'plus')}${salvando ? 'Salvando…' : ed ? 'Salvar alteração' : `Lançar no #${orc.id}`}</button></footer></section>`;
  }
  function telaOrc() {
    return `<div class="rolo">${topo()}
      <div class="o-cab"><button type="button" class="ico" data-voltar aria-label="Voltar pra lista">${icone('arrow-left')}</button>
        <div class="t"><span class="id">#${orc.id} · ${esc(orc.contato.nome || 'sem nome')} · ${esc(O.fmtPax(orc.passageiros))}</span><h2>${esc(O.rota(orc))}</h2></div>
        <a class="ico" href="/orcamento.html?id=${orc.id}" target="_blank" aria-label="Abrir no sistema" title="Abrir no sistema">${icone('external-link')}</a></div>
      <div class="faixas"><div data-aqui>${aquiHtml(outrosAqui)}</div>${nota()}${KVSky.html(orc)}</div>${trechosA()}
      ${folha ? '' : recadoHtml()}<div class="voos" data-voos>${voosHtml()}</div></div>${folhaHtml()}`;
  }

  // guarda o que a pessoa digitou antes de mexer no estado (a tela é redesenhada inteira)
  function sincronizar() {
    const raiz = app.querySelector('#b-form');
    if (form && raiz) Object.assign(form, KVOpcao.ler(raiz));
  }
  function desenhar() {
    if (!eu) return;
    const foco = document.activeElement && document.activeElement.id, ini = foco && document.activeElement.selectionStart;
    const rolo = app.querySelector('.rolo'), st = rolo ? rolo.scrollTop : 0;
    app.innerHTML = orc ? telaOrc().replace('<div class="rolo">', `<div class="rolo">${verComo()}`) : `<div class="rolo">${verComo()}${telaLista()}</div>`;
    const novo = app.querySelector('.rolo'); if (novo) novo.scrollTop = st;
    if (window.lucide) lucide.createIcons();
    moverInd(false); novoId = null;
    // redesenhar não tira o cursor do campo em que a pessoa estava
    if (foco) { const el = document.getElementById(foco); if (el) { el.focus(); try { if (ini != null) el.setSelectionRange(ini, ini); } catch (e) {} } }
  }

  // ---------- A: a pílula laranja vai até o trecho escolhido; os voos entram vindo do lado pra onde a pessoa foi ----------
  let novoId = null;
  function moverInd(animar = true) {
    const ind = app.querySelector('[data-ind]'), b = app.querySelector('.tr[aria-selected="true"]'); if (!ind || !b) return;
    if (!animar) ind.style.transition = 'none';
    ind.style.width = b.offsetWidth + 'px'; ind.style.transform = `translateX(${b.offsetLeft}px)`;
    if (!animar) { void ind.offsetWidth; ind.style.transition = ''; }
  }
  function trocarTrecho(n) {
    const dir = n > trecho ? 1 : -1;
    trecho = n; lembrar('kv-barra-trecho', trecho); vooAberto = null; apagando = null; recado = null;
    app.querySelectorAll('.tr').forEach((b) => b.setAttribute('aria-selected', +b.dataset.trecho === n));
    moverInd();
    const vs = app.querySelector('[data-voos]'); vs.innerHTML = voosHtml(); vs.style.setProperty('--dir', dir);
    vs.classList.remove('entra'); void vs.offsetWidth; vs.classList.add('entra');
    if (window.lucide) lucide.createIcons();
  }
  // abre/fecha o detalhe do voo sem redesenhar, pra animação correr
  function syncVoo() {
    app.querySelectorAll('.v4c').forEach((c) => { const on = +c.dataset.v === vooAberto; c.classList.toggle('aberto', on); c.querySelector('.v4').setAttribute('aria-expanded', on); c.querySelector('.det-wrap').inert = !on; });
    const c = vooAberto && app.querySelector(`.v4c[data-v="${vooAberto}"]`);
    if (c) setTimeout(() => c.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }), 300);
  }
  // a folha sobe animada; trocar o que tem dentro dela (site, dia) redesenha sem animar de novo
  function abrirFolha() {
    recado = null; folha = true; desenhar();
    const fl = app.querySelector('.folha'), veu = app.querySelector('.veu-p');
    fl.classList.remove('on'); veu.classList.remove('on'); void fl.offsetWidth;
    requestAnimationFrame(() => { fl.classList.add('on'); veu.classList.add('on'); setTimeout(() => { const el = fl.querySelector('[data-f="sai"]'); if (el) el.focus(); }, 300); });
  }
  function fecharFolha() {
    sincronizar(); salvarRascunho();
    const fl = app.querySelector('.folha'), veu = app.querySelector('.veu-p');
    folha = false;
    if (fl) { fl.classList.remove('on'); veu.classList.remove('on'); fl.inert = true; }
    setTimeout(() => { if (!folha) desenhar(); }, 380);
  }

  // ---------- editar uma opção já lançada ----------
  // Antes de trocar o que está no formulário, se tem coisa preenchida ou alterada que não foi salva, pergunta.
  const conf = document.createElement('dialog'); conf.className = 'janela b-conf'; document.body.append(conf);
  conf.addEventListener('cancel', (e) => { e.preventDefault(); conf.close(); });
  function perguntar(depois, { oQue }) {
    if (!sujo()) return depois();
    const ed = editando && (orc.opcoes || []).find((x) => x.id === editando);
    conf.innerHTML = `<header><div style="flex:1"><h2>Salvar antes?</h2><div class="sub">${ed ? `Você alterou a opção ${opResumo(ed)} e ainda não salvou.` : 'Tem um voo preenchido aqui que ainda não foi lançado.'} ${oQue}</div></div></header>
      <footer><button class="btn" data-c="continuar">Continuar aqui</button><button class="btn" data-c="descartar">${ed ? 'Descartar alteração' : 'Descartar'}</button>
        <button class="btn primario" data-c="salvar">${icone('check')}${ed ? 'Salvar' : 'Lançar'}</button></footer>`;
    conf.querySelectorAll('[data-c]').forEach((b) => { b.onclick = async () => {
      conf.close();
      if (b.dataset.c === 'continuar') { const f = app.querySelector('[data-f="sai"]'); if (f) f.focus(); return; }
      if (b.dataset.c === 'descartar') { apagarRascunho(); return depois(); }
      if (await gravar()) { const r = recado; depois(); if (r && r.ok) { recado = r; desenhar(); } }
    }; });
    if (window.lucide) lucide.createIcons();
    conf.showModal(); conf.querySelector('[data-c="salvar"]').focus();
  }
  function editar(id) {
    const op = (orc.opcoes || []).find((x) => x.id === id); if (!op) return;
    apagarRascunho();
    form = { ...KVOpcao.deOpcao(op), travadoSite: true }; editando = id; editBase = assinatura(form);
    salvarRascunho(); abrirFolha();
  }
  function voltarPraNova() {
    const manter = { site: form.site, data: form.data, malaMao: form.malaMao };
    apagarRascunho(); form = null; novoForm(manter); recado = null; fecharFolha();
  }

  // ---------- cliques ----------
  app.addEventListener('click', async (e) => {
    const b = e.target.closest('button, a'); if (!b) return;
    if (b.dataset.ponto != null) return alternarPonto();
    if (b.dataset.recarregar != null) { sincronizar(); KVApi.esquecer(); recado = null; return carregar().catch(erro); }
    if (b.dataset.abrir) { recado = null; vooAberto = null; folha = false; return abrir(+b.dataset.abrir).catch(erro); }
    if (b.dataset.voltar != null) { sincronizar(); salvarRascunho(); orc = null; form = null; recado = null; folha = false; vooAberto = null; lembrar('kv-barra-orc', null); return desenhar(); }
    if (b.dataset.trecho) { const n = +b.dataset.trecho; if (n === trecho) return; sincronizar(); salvarRascunho(); trocarTrecho(n); novoForm({ site: form.site }); restaurarRascunho(); recado = null; return; }
    if (b.dataset.voo) { const k = +b.dataset.voo; vooAberto = vooAberto === k ? null : k; apagando = null; return syncVoo(); }
    if (b.dataset.nova != null) { sincronizar(); if (editando && !sujo()) voltarPraNovaQuieto(); return abrirFolha(); }
    if (b.dataset.fecharFolha != null) { sincronizar(); if (editando) return perguntar(voltarPraNova, { oQue: 'Quer salvar antes de sair da edição?' }); return fecharFolha(); }
    if (b.dataset.lancar != null) return gravar();
    if (b.dataset.editar) { sincronizar(); const id = +b.dataset.editar; return perguntar(() => editar(id), { oQue: 'Quer salvar antes de abrir a outra?' }); }
    if (b.dataset.dup) { sincronizar(); const op = (orc.opcoes || []).find((x) => x.id === +b.dataset.dup); return perguntar(() => { apagarRascunho(); form = { ...KVOpcao.deOpcao(op), travadoSite: true }; editando = null; editBase = null; salvarRascunho(); abrirFolha(); }, { oQue: 'Quer salvar antes de repetir o outro voo?' }); }
    if (b.dataset.apagar) { apagando = +b.dataset.apagar; desenhar(); return; }
    if (b.dataset.apagarNao != null) { apagando = null; desenhar(); return; }
    if (b.dataset.apagarSim) {
      const id = +b.dataset.apagarSim; b.disabled = true;
      try { await KVApi.acao('op.apagar', { orcamento: orc.id, id }); orc = await KVApi.orcamento(orc.id); recado = { ok: true, texto: 'Voo apagado.' }; }
      catch (err) { recado = { erro: true, texto: 'Não apagou: ' + err.message }; }
      apagando = null; vooAberto = null; return desenhar();
    }
    if (b.dataset.usarAba != null) { sincronizar(); form.link = aba.url; salvarRascunho(); return desenhar(); }
    if (b.dataset.poeEsc != null) {
      sincronizar(); form.escalasOnde = [...(form.escalasOnde || []), ['', '']]; salvarRascunho(); desenhar();
      const el = app.querySelector(`[data-esc="${form.escalasOnde.length - 1}"][data-q="l"]`); if (el) el.focus(); return;
    }
    if (b.dataset.tiraEsc != null) { sincronizar(); form.escalasOnde.splice(+b.dataset.tiraEsc, 1); salvarRascunho(); return desenhar(); }
  });
  app.addEventListener('change', (e) => {
    const f = e.target.dataset && e.target.dataset.f;
    if (e.target.dataset && e.target.dataset.verComo != null) {
      sincronizar(); salvarRascunho();
      lembrar('kv-ver-como', e.target.value || null);
      KVApi.esquecer(); orc = null; form = null; recado = null; lembrar('kv-barra-orc', null);
      app.innerHTML = '<p class="carregando">Carregando…</p>';
      return carregar().catch(erro);
    }
    if (f) { sincronizar(); salvarRascunho(); }
    if (f === 'site') { form.travadoSite = true; desenhar(); }
    if (f === 'data') desenhar(); // o "Chega no dia" acompanha o dia escolhido
  });
  app.addEventListener('input', (e) => {
    if (e.target.dataset && e.target.dataset.busca != null) { busca = e.target.value; const pos = e.target.selectionStart; desenhar(); const n = app.querySelector('[data-busca]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
    if (!e.target.dataset || (e.target.dataset.f == null && e.target.dataset.esc == null)) return;
    sincronizar(); salvarRascunho();
  });

  // ---------- lançar ou salvar a alteração (a conferência e o formato são os da tela de pesquisa: KVOpcao.montar) ----------
  async function gravar() {
    if (salvando) return false;
    sincronizar();
    const { erros, dados } = KVOpcao.montar(form, orc.trechos[trecho]);
    app.querySelectorAll('[data-f]').forEach((el) => el.classList.toggle('erro', erros.includes(el.dataset.f)));
    if (erros.length) { app.querySelector(`[data-f="${erros[0]}"]`).focus(); return false; }
    const eraEdicao = editando;
    salvando = true; salvarRascunho(); desenhar();
    let ok = false;
    try {
      await KVApi.acao('op.salvar', { orcamento: orc.id, trecho, ...dados, ...(eraEdicao ? { id: eraEdicao } : {}) });
      recado = { ok: true, texto: eraEdicao ? `Alteração salva: ${dados.site} ${dados.sai} → ${dados.chega}.` : `Lançada: ${dados.site} ${dados.sai} → ${dados.chega}. Site e dia continuam pra próxima.` };
      const manter = { site: form.site, data: form.data, malaMao: form.malaMao };
      apagarRascunho();
      const antes = new Set((orc.opcoes || []).map((x) => x.id));
      orc = await KVApi.orcamento(orc.id);
      const nova = (orc.opcoes || []).find((x) => !antes.has(x.id));
      novoId = eraEdicao || (nova && nova.id); if (eraEdicao) { vooAberto = eraEdicao; folha = false; }
      form = null; novoForm(manter);
      ok = true;
    } catch (err) { recado = { erro: true, texto: `Não ${eraEdicao ? 'salvou' : 'lançou'} (${err.message}). Os campos continuam salvos aqui: é só tentar de novo.` }; }
    salvando = false;
    desenhar();
    const prim = folha && app.querySelector('[data-f="sai"]'); if (prim && ok) prim.focus();
    return ok;
  }
  KVSky.ligar(app, () => orc, (e) => { recado = { erro: true, texto: e.message }; desenhar(); });
  app.addEventListener('submit', (e) => { e.preventDefault(); gravar(); });

  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || (conf && conf.open)) return;
    if (folha) { e.preventDefault(); sincronizar(); if (editando) perguntar(voltarPraNova, { oQue: 'Quer salvar antes de sair da edição?' }); else fecharFolha(); }
    else if (vooAberto) { e.preventDefault(); vooAberto = null; syncVoo(); }
  });
  // Enter no formulário lança (no campo de observações, pula linha)
  app.addEventListener('keydown', (e) => { if (e.key === 'Enter' && folha && e.target.closest('#b-form') && !['BUTTON', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); gravar(); } });
  const voltarPraNovaQuieto = () => { const manter = { site: form.site, data: form.data, malaMao: form.malaMao }; apagarRascunho(); form = null; novoForm(manter); };

  function erro(e) { app.innerHTML = `<p class="b-recado erro">${esc(e.message || 'Erro ao carregar.')}</p><button class="btn" type="button" data-recarregar>Tentar de novo</button>`; }

  pedir('oi');
  carregar().catch(erro);
  // voltou pra barra depois de mexer no sistema em outra aba: confere se mudou algo
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !salvando) { KVApi.esquecer(); carregar().catch(() => {}); } });
})();

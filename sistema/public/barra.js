/* Barra da pesquisa (dentro da extensão do Chrome): quem está usando, o cronômetro, os orçamentos em pesquisa com a pessoa
   e o formulário da opção de voo, preenchido à mão (o mesmo da tela de pesquisa: shared/opcao-form.js).
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
    if (/skyscanner/.test(h)) return 'Skyscanner';
    return null;
  }

  // ---------- dados ----------
  async function carregar() {
    est = await KVApi.estado(); eu = est.eu; dono = eu.papel === 'dono' || eu.papel === 'admin';
    await carregarPonto().catch(() => { ponto = null; });
    lista = (await KVApi.orcamentos()).filter((o) => o.etapa === 'pesquisa' && (dono || o.responsavel === eu.email));
    const lemb = +lembrado('kv-barra-orc');
    if (lemb && lista.some((o) => o.id === lemb)) await abrir(lemb, { manterForm: true });
    else { orc = null; desenhar(); }
  }
  async function abrir(id, { manterForm = false } = {}) {
    orc = await KVApi.orcamento(id);
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
  const relogio = (ms) => { const s = Math.floor(ms / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
  setInterval(() => {
    if (!ponto) return;
    const c = contas();
    app.querySelectorAll('[data-cron-t]').forEach((el) => { el.textContent = relogio(c.ms); });
    app.querySelectorAll('[data-cron-g]').forEach((el) => { el.textContent = O.fmt.brl(c.ganho); });
  }, 1000);
  async function alternarPonto() {
    if (mexendoPonto || !ponto) return;
    mexendoPonto = true; sincronizar(); desenhar();
    try { await KVApi.acao(contas().rod ? 'ponto.pausar' : 'ponto.iniciar'); await carregarPonto(); }
    catch (e) { recado = { erro: true, texto: 'O cronômetro não mudou: ' + e.message }; try { await carregarPonto(); } catch (_) {} }
    mexendoPonto = false; desenhar();
  }
  function cron() {
    if (!ponto) return '';
    const c = contas(), lig = !!c.rod, esqueceu = c.ligadoMs > 10 * 36e5;
    const aviso = esqueceu ? `<a class="cron-esq" href="/ponto.html" target="_blank">${icone('alarm-clock')}Ligado há ${Math.floor(c.ligadoMs / 36e5)}h. Esqueceu? Corrigir</a>` : '';
    return `<section class="cron-cartao ${lig ? 'lig' : ''}"><div class="cron-info"><span class="cron-est"><i class="pulso"></i>${lig ? 'Trabalhando' : 'Pausado'}</span>
        <b class="cron-t" data-cron-t>${relogio(c.ms)}</b><span class="cron-sub">hoje · <b data-cron-g>${O.fmt.brl(c.ganho)}</b></span></div>
      <button type="button" class="cron-bt" data-ponto ${mexendoPonto ? 'disabled' : ''} aria-label="${lig ? 'Pausar' : 'Começar'} o cronômetro">${icone(lig ? 'pause' : 'play')}</button></section>${aviso}`;
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
  const recarregar = () => `<button class="btn icone fantasma" type="button" data-recarregar aria-label="Atualizar">${icone('refresh-cw')}</button>`;
  const recadoHtml = () => (recado ? `<p class="b-recado ${recado.erro ? 'erro' : recado.ok ? 'ok' : ''}" role="status">${esc(recado.texto)}</p>` : '');
  const nota = () => { const n = [orc.pedido, orc.observacao].filter(Boolean).join(' · '); return n ? `<details class="b-nota"><summary>${icone('message-square-text')}<span>${esc(n)}</span></summary></details>` : ''; };
  const trechos = () => (orc.trechos.length > 1 ? `<div class="b-trechos" role="tablist">${orc.trechos.map((x, i) => `<button type="button" role="tab" aria-selected="${i === trecho}" data-trecho="${i}">${x.de} → ${x.para}<small>${O.roteiros(orc).length > 1 ? `Roteiro ${O.letra(x.roteiro || 0)}` : `Trecho ${i + 1}`}</small></button>`).join('')}</div>` : '');
  const campos = () => KVOpcao.html(orc.trechos[trecho], form)
    + (naExtensao && aba.url && /^https:/.test(aba.url) && form.link !== aba.url ? `<button type="button" class="b-usar" data-usar-aba>Usar o endereço da aba aberta como link</button>` : '');
  const opResumo = (x) => `${esc(x.site)} ${O.dataCurta(x.data)} · ${esc(x.sai)} → ${esc(x.chega)}`;
  function lancadas() {
    const ops = (orc.opcoes || []).filter((x) => x.trecho === trecho);
    return { n: ops.length, html: ops.length ? `<ul class="b-ops">${ops.slice().reverse().map((x) => `<li ${x.id === editando ? 'class="editando"' : ''}>
        <div class="op-txt"><b>${esc(x.site)}</b><span class="q">${O.dataCurta(x.data)} · ${esc(x.sai)} → ${esc(x.chega)}${x.escalas ? ` · ${x.escalas} esc.` : ''}</span>
          <span class="v">${x.milhas ? `${O.fmt.pts(x.milhas)} mi + ${O.fmt.brl(x.taxa)}` : O.fmt.brl(x.preco)}</span></div>
        ${x.id === editando ? '<span class="op-ed">editando</span>' : `<button type="button" class="btn pequeno" data-editar="${x.id}">${icone('pencil')}Editar</button>`}</li>`).join('')}</ul>` : '<p class="b-vazio">Nenhuma ainda.</p>' };
  }
  const abrirNoSistema = () => `<a class="btn pequeno" href="/orcamento.html?id=${orc.id}" target="_blank">${icone('external-link')}Abrir no sistema</a>`;
  const voltar = () => `<button class="btn icone fantasma" type="button" data-voltar aria-label="Voltar pra lista">${icone('arrow-left')}</button>`;
  const rotaTxt = () => { const t = orc.trechos[trecho]; return `${t.de} → ${t.para}`; };

  // ---------- lista de orçamentos ----------
  function telaLista() {
    const com = lista.filter((o) => o.responsavel === eu.email), outros = lista.filter((o) => o.responsavel !== eu.email);
    const item = (o, extra = '') => `<li><button type="button" class="b-orc" data-abrir="${o.id}">
        <span class="rota">${esc(O.rota(o))}</span>
        <span class="sub">#${o.id} · ${esc(o.contato.nome || 'sem nome')} · ${esc(O.fmtPax(o.passageiros))}</span>
        <span class="sub">${o.trechos.map((t) => [t.data, ...(t.outrasDatas || [])].map(O.dataCurta).join(' e ')).join(' · ')} · ${o.nOpcoes} ${o.nOpcoes === 1 ? 'opção' : 'opções'}${extra}</span></button></li>`;
    const nomeDe = (email) => ((est.usuarios || []).find((u) => u.email === email) || {}).nome || email;
    return `<header class="b-topo">${avatar(eu)}${quem()}${recarregar()}</header>${cron()}${avisos()}${recadoHtml()}
      <h2 class="b-tit">Em pesquisa com você <span class="n">${com.length}</span></h2>
      ${com.length ? `<ul class="b-lista">${com.map((o) => item(o)).join('')}</ul>` : `<p class="b-vazio">Nada em pesquisa com você. Pegue um orçamento na fila do sistema.</p>
        <a class="btn" href="/orcamentos.html" target="_blank">${icone('external-link')}Abrir a fila</a>`}
      ${dono && outros.length ? `<h2 class="b-tit">Com a equipe <span class="n">${outros.length}</span></h2><ul class="b-lista">${outros.map((o) => item(o, ` · com ${esc(nomeDe(o.responsavel).split(' ')[0])}`)).join('')}</ul>` : ''}`;
  }

  // ---------- um orçamento: cronômetro, formulário e as opções já lançadas (com Editar) ----------
  function telaOrc() {
    const l = lancadas(), t = orc.trechos[trecho], ed = editando && (orc.opcoes || []).find((x) => x.id === editando);
    return `<header class="b-topo">${avatar(eu)}${quem()}${recarregar()}</header>${cron()}${avisos()}
      <div class="a-orc">${voltar()}<div><span class="a-id">#${orc.id} · ${esc(orc.contato.nome || 'sem nome')} · ${esc(O.fmtPax(orc.passageiros))}</span>
        <b class="a-rota">${rotaTxt()}</b><span class="a-dia">${[t.data, ...(t.outrasDatas || [])].map((x) => `${O.diaCurto(x)} ${O.dataCurta(x)}`).join(' e ')}${t.outrasDatas && t.outrasDatas.length ? ' · olhar esses dias' : t.janela ? ' · janela de 14 dias' : ''}</span></div></div>
      ${trechos()}${nota()}
      ${recadoHtml()}
      ${ed ? `<div class="b-editando">${icone('pencil')}<span>Editando <b>${opResumo(ed)}</b></span><button type="button" class="btn pequeno fantasma" data-cancelar-edicao>Cancelar</button></div>` : ''}
      <form class="b-form form-op ${ed ? 'em-edicao' : ''}" id="b-form" autocomplete="off">${campos()}
        <button class="btn primario largo" type="submit" data-lancar ${salvando ? 'disabled' : ''}>${icone(salvando ? 'loader' : ed ? 'check' : 'plus')}${salvando ? 'Salvando…' : ed ? 'Salvar alteração' : `Lançar no #${orc.id}`}</button></form>
      <section class="b-bloco"><h3>Já lançadas neste trecho · ${l.n}</h3>${l.html}${abrirNoSistema()}</section>`;
  }

  // guarda o que a pessoa digitou antes de mexer no estado (a tela é redesenhada inteira)
  function sincronizar() {
    const raiz = app.querySelector('#b-form');
    if (form && raiz) Object.assign(form, KVOpcao.ler(raiz));
  }
  function desenhar() {
    if (!eu) return;
    const foco = document.activeElement && document.activeElement.id, ini = foco && document.activeElement.selectionStart;
    app.innerHTML = verComo() + (orc ? telaOrc() : telaLista());
    if (window.lucide) lucide.createIcons();
    // redesenhar não tira o cursor do campo em que a pessoa estava
    if (foco) { const el = document.getElementById(foco); if (el) { el.focus(); try { if (ini != null) el.setSelectionRange(ini, ini); } catch (e) {} } }
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
    recado = null; salvarRascunho(); desenhar();
    const alvo = app.querySelector('.b-editando'); if (alvo) alvo.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  function voltarPraNova() {
    const manter = { site: form.site, data: form.data, malaMao: form.malaMao };
    apagarRascunho(); form = null; novoForm(manter); recado = null; desenhar();
  }

  // ---------- cliques ----------
  app.addEventListener('click', async (e) => {
    const b = e.target.closest('button, a'); if (!b) return;
    if (b.dataset.ponto != null) return alternarPonto();
    if (b.dataset.recarregar != null) { sincronizar(); KVApi.esquecer(); recado = null; return carregar().catch(erro); }
    if (b.dataset.abrir) { recado = null; return abrir(+b.dataset.abrir).catch(erro); }
    if (b.dataset.voltar != null) { sincronizar(); salvarRascunho(); orc = null; form = null; recado = null; lembrar('kv-barra-orc', null); return desenhar(); }
    if (b.dataset.trecho) { sincronizar(); salvarRascunho(); trecho = +b.dataset.trecho; lembrar('kv-barra-trecho', trecho); recado = null; novoForm({ site: form.site }); restaurarRascunho(); return desenhar(); }
    if (b.dataset.editar) { sincronizar(); const id = +b.dataset.editar; return perguntar(() => editar(id), { oQue: 'Quer salvar antes de abrir a outra?' }); }
    if (b.dataset.cancelarEdicao != null) { sincronizar(); return perguntar(voltarPraNova, { oQue: 'Quer salvar antes de sair da edição?' }); }
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
      orc = await KVApi.orcamento(orc.id);
      form = null; novoForm(manter);
      ok = true;
    } catch (err) { recado = { erro: true, texto: `Não ${eraEdicao ? 'salvou' : 'lançou'} (${err.message}). Os campos continuam salvos aqui: é só tentar de novo.` }; }
    salvando = false;
    desenhar();
    const prim = app.querySelector('[data-f="sai"]'); if (prim && ok) prim.focus();
    return ok;
  }
  app.addEventListener('submit', (e) => { e.preventDefault(); gravar(); });

  function erro(e) { app.innerHTML = `<p class="b-recado erro">${esc(e.message || 'Erro ao carregar.')}</p><button class="btn" type="button" data-recarregar>Tentar de novo</button>`; }

  pedir('oi');
  carregar().catch(erro);
  // voltou pra barra depois de mexer no sistema em outra aba: confere se mudou algo
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !salvando) { KVApi.esquecer(); carregar().catch(() => {}); } });
})();

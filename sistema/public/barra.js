/* Barra da pesquisa (dentro da extensão do Chrome). Três jeitos de lançar uma opção, do mais rápido pro mais garantido:
   A) "Buscar em": abre a busca do site já preenchida (rota, dia e passageiros), pelo endereço da busca.
   B) "Capturar voo": a pessoa clica no voo na página do site; o texto vem pra cá e vira horário, milhas e taxa.
   C) O formulário: sempre aberto. A captura só preenche; o que ela não achar a pessoa completa à mão.
   Os endereços de busca (BUSCA) e a leitura do texto (ler) ficam aqui no sistema: se um site mudar, corrige e publica,
   sem reinstalar a extensão. */
(function () {
  const O = KVOrc, esc = O.esc;
  const app = document.getElementById('barra');
  const naExtensao = window.parent !== window;
  // versão atual da extensão (gerada do manifest por "npm run extensao"); a instalada mais velha = aviso pra atualizar
  let EXT_VERSAO = null;
  fetch('/extensao/versao.json', { cache: 'no-store' }).then((r) => r.json()).then((v) => { EXT_VERSAO = v.versao; desenhar(); }).catch(() => {});
  try { const t = localStorage.getItem('kv-tema'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  let est = null, eu = null, dono = false, lista = [], orc = null, trecho = 0;
  let aba = { url: '', titulo: '', versao: null };
  let capturando = false, form = null, veio = {}, recado = null, salvando = false;
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
    } else if (d.tipo === 'capturado') {
      sincronizar(); capturando = false;
      if (d.cancelado) { desenhar(); return; }
      aplicarCaptura(d.texto || '', d.url || aba.url);
    } else if (d.tipo === 'erro') {
      sincronizar(); capturando = false; recado = { erro: true, texto: d.texto }; desenhar();
    }
  });

  // ---------- A) endereço da busca de cada site (um trecho só ida) ----------
  const pad = (n) => String(n).padStart(2, '0');
  const BUSCA = {
    Smiles: (t, dia, p) => {
      const [a, m, d] = dia.split('-').map(Number);
      return `https://www.smiles.com.br/mfe/emissao-passagem/?adults=${p.adultos}&children=${p.criancas}&infants=${p.bebes}&cabin=ALL`
        + `&departureDate=${Date.UTC(a, m - 1, d, 15)}&returnDate=&isFlexibleDateChecked=false&searchType=g3&segments=1&tripType=2`
        + `&originAirport=${t.de}&originAirportIsAny=false&destinationAirport=${t.para}&destinAirportIsAny=false&novo-resultado-voos=true`;
    },
    Latam: (t, dia, p) => `https://www.latamairlines.com/br/pt/oferta-voos?origin=${t.de}&outbound=${dia}T15%3A00%3A00.000Z&destination=${t.para}`
      + `&inbound=null&adt=${p.adultos}&teen=0&chd=${p.criancas}&inf=${p.bebes}&trip=OW&cabin=Economy&redemption=true&sort=RECOMMENDED`,
    TudoAzul: (t, dia, p) => {
      const [a, m, d] = dia.split('-');
      return `https://www.voeazul.com.br/br/pt/home/selecao-voo?c[0].ds=${t.de}&c[0].std=${m}/${d}/${a}&c[0].as=${t.para}`
        + `&p[0].t=ADT&p[0].c=${p.adultos}&p[0].cp=false&p[1].t=CHD&p[1].c=${p.criancas}&p[1].cp=false&p[2].t=INF&p[2].c=${p.bebes}&p[2].cp=false&f.dl=3&f.dr=3&cc=PTS`;
    },
    Skyscanner: (t, dia, p) => {
      const kids = [...Array(p.criancas).fill(8), ...Array(p.bebes).fill(1)].join('%7C');
      return `https://www.skyscanner.com.br/transporte/passagens-aereas/${t.de.toLowerCase()}/${t.para.toLowerCase()}/${dia.slice(2).replace(/-/g, '')}/`
        + `?adultsv2=${p.adultos}&childrenv2=${kids}&cabinclass=economy&rtn=0`;
    },
  };
  const NOME_BUSCA = { Smiles: 'Smiles', Latam: 'Latam', TudoAzul: 'Azul', Skyscanner: 'Skyscanner' };

  function siteDaUrl(u) {
    const h = (() => { try { return new URL(u).hostname; } catch (e) { return ''; } })();
    if (/smiles\.com/.test(h)) return 'Smiles';
    if (/latam/.test(h)) return 'Latam';
    if (/voeazul|tudoazul/.test(h)) return 'TudoAzul';
    if (/skyscanner/.test(h)) return 'Skyscanner';
    return null;
  }

  // ---------- B) o texto do voo vira campos ----------
  const MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  const reais = (t) => O.lerReais(t);
  function ler(textoBruto, dias) {
    const s = String(textoBruto).replace(/ | /g, ' ');
    const r = {};
    const hs = [...s.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)].map((m) => `${pad(m[1])}:${m[2]}`);
    if (hs[0]) r.sai = hs[0];
    if (hs[1]) r.chega = hs[1] + (/\+\s?1(?!\d)|\+1 ?dia|dia seguinte|next day/i.test(s) ? ' +1' : '');
    // milhas: "32.000 milhas", "32 mil milhas", "32.000 pts"
    const mm = s.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+(?:,\d+)?)\s*(mil\s+)?(milhas|pontos|pts|miles)\b/i);
    if (mm) { let n = +mm[1].replace(/[.\s]/g, '').replace(',', '.'); if (mm[2] || n < 1000) n *= 1000; r.milhas = Math.round(n); }
    // dinheiro: com milhas, o R$ (o primeiro depois das milhas, ou o primeiro de todos) é a taxa; sem milhas é o preço
    const rs = [...s.matchAll(/R\$\s?([\d.]+(?:,\d{1,2})?)/g)].map((m) => ({ v: reais(m[1]), i: m.index }));
    if (mm) { const t = rs.find((x) => x.i > mm.index) || rs[0]; if (t && t.v != null) r.taxa = t.v; }
    else if (rs[0] && rs[0].v) r.preco = rs[0].v;
    if (/\b(direto|sem (escalas?|paradas?|conex[õo]es)|nonstop)\b/i.test(s)) r.escalas = 0;
    else { const e = s.match(/(\d)\s*(paradas?|escalas?|conex[õo]es|conexão|stops?)\b/i); if (e) r.escalas = Math.min(2, +e[1]); }
    const voos = [...s.matchAll(/\b(LA|JJ|G3|AD|TP|AA|UA|DL|AF|KL|IB|UX|CM|AV|AR|LH|BA|EK|QR|TK|ET|AM|H2|JA|2Z)\s?-?(\d{2,4})\b/g)].map((m) => `${m[1]} ${m[2]}`);
    if (voos.length) r.voo = [...new Set(voos)].join(' / ').slice(0, 20);
    if (/(bagagem|mala) (despachada|inclu[íi]da)|1 bagagem|23\s?kg/i.test(s) && !/sem (bagagem|mala)/i.test(s)) r.bagagem = true;
    // dia: "10/12" ou "10 dez" que esteja na janela de datas do trecho
    const dd = s.match(/\b(\d{1,2})\/(\d{1,2})\b/) || s.match(/\b(\d{1,2})\s*(?:de\s*)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i);
    if (dd) {
      const d = pad(dd[1]), m = pad(MESES[String(dd[2]).toLowerCase()] || dd[2]);
      const achado = dias.find((x) => x.endsWith(`-${m}-${d}`));
      if (achado) r.data = achado;
    }
    return r;
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
    form = { site: siteDaUrl(aba.url) || (form && form.site) || 'Smiles', data: t.data, sai: '', chega: '', voo: '', escalas: 0, milhas: '', taxa: '', preco: '', bagagem: false, link: '', ...manter };
    veio = {};
  }

  function aplicarCaptura(texto, url) {
    if (!orc) return;
    const dias = O.janelaDias(orc.trechos[trecho]);
    const r = ler(texto, dias);
    const site = siteDaUrl(url) || form.site;
    novoForm({ site, data: r.data || form.data });
    const milMostrar = (n) => (n % 1000 === 0 ? String(n / 1000) : String(n));
    const reaisMostrar = (c) => (c / 100).toFixed(2).replace('.', ',');
    if (r.sai) { form.sai = r.sai; veio.sai = 1; }
    if (r.chega) { form.chega = r.chega; veio.chega = 1; }
    if (r.voo) { form.voo = r.voo; veio.voo = 1; }
    if (r.escalas != null) { form.escalas = r.escalas; veio.escalas = 1; }
    if (r.milhas) { form.milhas = milMostrar(r.milhas); veio.milhas = 1; }
    if (r.taxa != null) { form.taxa = reaisMostrar(r.taxa); veio.taxa = 1; }
    if (r.preco) { form.preco = reaisMostrar(r.preco); veio.preco = 1; }
    if (r.bagagem) { form.bagagem = true; veio.bagagem = 1; }
    if (r.data) veio.data = 1;
    if (/^https:/.test(url)) { form.link = url; veio.link = 1; }
    const din = O.site(site).forma === 'dinheiro';
    const faltam = [!form.sai && 'saída', !form.chega && 'chegada', din ? !form.preco && 'preço' : (!form.milhas && 'milhas'), !din && !form.taxa && 'taxa'].filter(Boolean);
    recado = faltam.length ? { texto: `Não achei: ${faltam.join(', ')}. Complete à mão e confira o resto.` } : { ok: true, texto: 'Confira os campos em laranja e lance.' };
    salvarRascunho();
    desenhar();
    const prim = app.querySelector(faltam.length ? '.campo input:not([data-veio])' : '[data-lancar]');
    if (prim) prim.focus();
  }

  // ---------- rascunho: nada do que foi digitado ou capturado se perde ----------
  // Cada orçamento e trecho guarda o formulário neste navegador a cada mudança. Fechar a barra, trocar de orçamento,
  // a internet cair na hora de lançar: ao voltar, está tudo lá. Só some depois de lançado com sucesso.
  const chaveRasc = () => orc && `kv-barra-rasc:${orc.id}:${trecho}`;
  let rascTimer = null;
  function salvarRascunho() {
    clearTimeout(rascTimer);
    rascTimer = setTimeout(() => {
      if (!form || !orc) return;
      const vazio = !['sai', 'chega', 'voo', 'milhas', 'taxa', 'preco'].some((k) => String(form[k] || '').trim());
      lembrar(chaveRasc(), vazio ? null : JSON.stringify({ form, veio, em: Date.now() }));
    }, 250);
  }
  function restaurarRascunho() {
    try {
      const r = JSON.parse(lembrado(chaveRasc()) || 'null');
      if (!r || Date.now() - r.em > 14 * 864e5) return false;
      form = r.form; veio = r.veio || {};
      recado = { texto: 'Rascunho recuperado: estava aqui do jeito que você deixou.' };
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
  // três jeitos de mostrar, um por versão
  function cron(estilo) {
    if (!ponto) return '';
    const c = contas(), lig = !!c.rod, esqueceu = c.ligadoMs > 10 * 36e5;
    const botao = (cls) => `<button type="button" class="${cls}" data-ponto ${mexendoPonto ? 'disabled' : ''} aria-label="${lig ? 'Pausar' : 'Começar'} o cronômetro">${icone(lig ? 'pause' : 'play')}${cls.includes('com-texto') ? (lig ? 'Pausar' : 'Começar') : ''}</button>`;
    const aviso = esqueceu ? `<a class="cron-esq" href="/ponto.html" target="_blank">${icone('alarm-clock')}Ligado há ${Math.floor(c.ligadoMs / 36e5)}h. Esqueceu? Corrigir</a>` : '';
    if (estilo === 'cartao') return `<section class="cron-cartao ${lig ? 'lig' : ''}"><div class="cron-info"><span class="cron-est"><i class="pulso"></i>${lig ? 'Trabalhando' : 'Pausado'}</span>
        <b class="cron-t" data-cron-t>${relogio(c.ms)}</b><span class="cron-sub">hoje · <b data-cron-g>${O.fmt.brl(c.ganho)}</b></span></div>${botao('cron-bt')}</section>${aviso}`;
    if (estilo === 'faixa') return `<div class="cron-faixa ${lig ? 'lig' : ''}"><i class="pulso"></i><b data-cron-t>${relogio(c.ms)}</b><span data-cron-g>${O.fmt.brl(c.ganho)}</span>${botao('cron-bt pequeno com-texto')}</div>${aviso}`;
    return `<div class="cron-chip ${lig ? 'lig' : ''}">${botao('cron-bt mini')}<b data-cron-t>${relogio(c.ms)}</b></div>`;
  }

  // ---------- versões (enquanto o usuário escolhe; depois fica só a escolhida) ----------
  const VERSOES = { A: 'Cockpit', B: 'Passo a passo', C: 'Formulário primeiro' };
  let versao = VERSOES[lembrado('kv-barra-versao')] ? lembrado('kv-barra-versao') : 'A';
  // só o admin: usar a barra como outra pessoa da equipe (igual ao "ver como" do sistema; esta escolha fica só na barra)
  function verComo() {
    if (!est || !est.equipe) return '';
    const real = eu.admin ? eu.admin.email : eu.email;
    return `<label class="b-vercomo">${icone('eye')}<span>Ver como</span><select data-ver-como>${est.equipe.map((u) => `<option value="${esc(u.email === real ? '' : u.email)}" ${u.email === eu.email ? 'selected' : ''}>${esc(u.nome)}${u.email === real ? ' (você)' : ''}</option>`).join('')}</select></label>`;
  }
  const seletorVersao = () => verComo() + `<nav class="b-versoes" aria-label="Versão da barra">${Object.entries(VERSOES).map(([k, n]) => `<button type="button" data-versao="${k}" aria-pressed="${k === versao}" title="${n}">${k}<small>${n}</small></button>`).join('')}</nav>`;

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
    return `${velha ? `<a class="b-aviso" href="/extensao.html" target="_blank">${icone('download')}Tem versão nova da extensão. Toque pra atualizar.</a>` : ''}
      ${!naExtensao ? `<p class="b-aviso calmo">${icone('info')}Aberto fora da extensão: dá pra lançar, mas não pra capturar nem abrir a busca.</p>` : ''}`;
  }
  const quem = () => `<div class="quem"><b>${esc(eu.nome)}</b><span>${PAPEL[eu.papel] || ''}</span></div>`;
  const recarregar = () => `<button class="btn icone fantasma" type="button" data-recarregar aria-label="Atualizar">${icone('refresh-cw')}</button>`;
  const recadoHtml = () => (recado ? `<p class="b-recado ${recado.erro ? 'erro' : recado.ok ? 'ok' : ''}" role="status">${esc(recado.texto)}</p>` : '');
  const nota = () => { const n = [orc.pedido, orc.observacao].filter(Boolean).join(' · '); return n ? `<details class="b-nota"><summary>${icone('message-square-text')}<span>${esc(n)}</span></summary></details>` : ''; };
  const trechos = () => (orc.trechos.length > 1 ? `<div class="b-trechos" role="tablist">${orc.trechos.map((x, i) => `<button type="button" role="tab" aria-selected="${i === trecho}" data-trecho="${i}">${x.de} → ${x.para}<small>${O.dataCurta(x.data)}</small></button>`).join('')}</div>` : '');
  const sites = (cls = 'btn pequeno') => Object.keys(BUSCA).map((s) => `<button type="button" class="${cls}" data-buscar="${s}" ${naExtensao ? '' : 'disabled'}>${NOME_BUSCA[s]}${icone('arrow-up-right')}</button>`).join('');
  const captura = (cls = 'btn primario largo') => (capturando
    ? `<div class="b-captura"><p>${icone('mouse-pointer-click')}<span>Clique no voo na página ao lado.</span></p>
        <div class="linha"><button class="btn pequeno" type="button" data-maior>${icone('maximize-2')}Pegar mais</button><button class="btn pequeno" type="button" data-menor>${icone('minimize-2')}Menos</button>
        <button class="btn pequeno fantasma" type="button" data-cancelar style="margin-left:auto">Cancelar</button></div></div>`
    : `<button class="${cls}" type="button" data-capturar ${naExtensao ? '' : 'disabled'}>${icone('scan-line')}<span>${cls.includes('c-cap') ? 'Capturar' : 'Capturar voo da página'}</span></button>`);
  function campos() {
    const t = orc.trechos[trecho], dias = O.janelaDias(t), din = O.site(form.site).forma === 'dinheiro';
    const v = (k) => esc(form[k] == null ? '' : form[k]), marca = (k) => (veio[k] ? 'data-veio' : '');
    return `<div class="duas"><div class="campo"><label for="b-site">Site</label><select id="b-site" data-f="site">${O.sites.map((x) => `<option ${x.id === form.site ? 'selected' : ''}>${x.id}</option>`).join('')}</select></div>
        <div class="campo"><label for="b-dia">Dia</label><select id="b-dia" data-f="data" ${marca('data')}>${dias.map((d) => `<option value="${d}" ${d === form.data ? 'selected' : ''}>${O.diaCurto(d)} ${O.dataCurta(d)}${d === t.data ? ' ★' : ''}</option>`).join('')}</select></div></div>
      <div class="duas"><div class="campo"><label for="b-sai">Sai</label><input id="b-sai" data-f="sai" inputmode="numeric" placeholder="07:40" value="${v('sai')}" ${marca('sai')}></div>
        <div class="campo"><label for="b-chega">Chega</label><input id="b-chega" data-f="chega" placeholder="19:10 ou 06:10+" value="${v('chega')}" ${marca('chega')}></div></div>
      <div class="duas"><div class="campo"><label for="b-voo">Voo</label><input id="b-voo" data-f="voo" placeholder="LA 8084" value="${v('voo')}" ${marca('voo')}></div>
        <div class="campo"><label for="b-esc">Escalas</label><select id="b-esc" data-f="escalas" ${marca('escalas')}>${[[0, 'Direto'], [1, '1 escala'], [2, '2 ou mais']].map(([x, n]) => `<option value="${x}" ${+form.escalas === x ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
      ${din ? `<div class="campo"><label for="b-preco">Preço por pessoa</label><input id="b-preco" data-f="preco" inputmode="decimal" placeholder="R$" value="${v('preco')}" ${marca('preco')}></div>`
        : `<div class="duas"><div class="campo"><label for="b-mil">Milhas por pessoa</label><input id="b-mil" data-f="milhas" inputmode="numeric" placeholder="45 = 45.000" value="${v('milhas')}" ${marca('milhas')}></div>
          <div class="campo"><label for="b-taxa">Taxa por pessoa</label><input id="b-taxa" data-f="taxa" inputmode="decimal" placeholder="R$" value="${v('taxa')}" ${marca('taxa')}></div></div>`}
      <label class="b-check" ${marca('bagagem')}><input type="checkbox" data-f="bagagem" ${form.bagagem ? 'checked' : ''}>Com mala despachada</label>
      <div class="campo"><label for="b-link">Link do preço</label><input id="b-link" data-f="link" placeholder="Colar link" value="${v('link')}" ${marca('link')}>
        ${naExtensao && aba.url && /^https:/.test(aba.url) && form.link !== aba.url ? `<button type="button" class="b-usar" data-usar-aba>Usar o endereço da aba aberta</button>` : ''}</div>`;
  }
  const lancar = (cls = 'btn primario largo', curto = false) => `<button class="${cls}" type="submit" form="b-form" data-lancar ${salvando ? 'disabled' : ''}>${icone(salvando ? 'loader' : 'plus')}${salvando ? 'Lançando…' : curto ? 'Lançar' : `Lançar no #${orc.id}`}</button>`;
  function lancadas() {
    const ops = (orc.opcoes || []).filter((x) => x.trecho === trecho);
    return { n: ops.length, html: ops.length ? `<ul class="b-ops">${ops.slice().reverse().map((x) => `<li><b>${esc(x.site)}</b><span class="q">${O.dataCurta(x.data)} · ${esc(x.sai)} → ${esc(x.chega)}${x.escalas ? ` · ${x.escalas} esc.` : ''}</span>
        <span class="v">${x.milhas ? `${O.fmt.pts(x.milhas)} mi + ${O.fmt.brl(x.taxa)}` : O.fmt.brl(x.preco)}</span></li>`).join('')}</ul>` : '<p class="b-vazio">Nenhuma ainda.</p>' };
  }
  const abrirNoSistema = () => `<a class="btn pequeno" href="/orcamento.html?id=${orc.id}" target="_blank">${icone('external-link')}Abrir no sistema</a>`;
  const voltar = () => `<button class="btn icone fantasma" type="button" data-voltar aria-label="Voltar pra lista">${icone('arrow-left')}</button>`;
  const rotaTxt = () => { const t = orc.trechos[trecho]; return `${t.de} → ${t.para}`; };

  // ---------- lista de orçamentos (igual nas versões, muda só o cronômetro) ----------
  function telaLista() {
    const com = lista.filter((o) => o.responsavel === eu.email), outros = lista.filter((o) => o.responsavel !== eu.email);
    const item = (o, extra = '') => `<li><button type="button" class="b-orc" data-abrir="${o.id}">
        <span class="rota">${esc(O.rota(o))}</span>
        <span class="sub">#${o.id} · ${esc(o.contato.nome || 'sem nome')} · ${esc(O.fmtPax(o.passageiros))}</span>
        <span class="sub">${o.trechos.map((t) => O.dataCurta(t.data)).join(' · ')} · ${o.nOpcoes} ${o.nOpcoes === 1 ? 'opção' : 'opções'}${extra}</span></button></li>`;
    const nomeDe = (email) => ((est.usuarios || []).find((u) => u.email === email) || {}).nome || email;
    const estiloCron = { A: 'cartao', B: 'faixa', C: 'faixa' }[versao];
    return `<header class="b-topo">${avatar(eu)}${quem()}${recarregar()}</header>${cron(estiloCron)}${avisos()}${recadoHtml()}
      <h2 class="b-tit">Em pesquisa com você <span class="n">${com.length}</span></h2>
      ${com.length ? `<ul class="b-lista">${com.map((o) => item(o)).join('')}</ul>` : `<p class="b-vazio">Nada em pesquisa com você. Pegue um orçamento na fila do sistema.</p>
        <a class="btn" href="/orcamentos.html" target="_blank">${icone('external-link')}Abrir a fila</a>`}
      ${dono && outros.length ? `<h2 class="b-tit">Com a equipe <span class="n">${outros.length}</span></h2><ul class="b-lista">${outros.map((o) => item(o, ` · com ${esc(nomeDe(o.responsavel).split(' ')[0])}`)).join('')}</ul>` : ''}`;
  }

  // ---------- A) Cockpit: cronômetro grande, a captura é o cartão laranja, formulário logo abaixo ----------
  function versaoA() {
    const l = lancadas(), t = orc.trechos[trecho];
    return `<header class="b-topo">${avatar(eu)}${quem()}${recarregar()}</header>${cron('cartao')}${avisos()}
      <div class="a-orc">${voltar()}<div><span class="a-id">#${orc.id} · ${esc(orc.contato.nome || 'sem nome')} · ${esc(O.fmtPax(orc.passageiros))}</span>
        <b class="a-rota">${rotaTxt()}</b><span class="a-dia">${O.diaCurto(t.data)} ${O.dataCurta(t.data)}${t.janela ? ' · janela de 14 dias' : ''}</span></div></div>
      ${trechos()}${nota()}
      <section class="a-destaque">${captura('a-capturar')}<div class="a-buscar"><span>Abrir busca de ${O.dataCurta(form.data)}</span><div class="b-sites">${sites('a-site')}</div></div></section>
      ${recadoHtml()}
      <form class="b-form" id="b-form" autocomplete="off">${campos()}${lancar()}</form>
      <section class="b-bloco"><h3>Já lançadas neste trecho · ${l.n}</h3>${l.html}${abrirNoSistema()}</section>`;
  }

  // ---------- B) Passo a passo: 1 buscar, 2 capturar, 3 conferir e lançar ----------
  function versaoB() {
    const l = lancadas(), capturou = Object.keys(veio).length > 0;
    const passo = (n, titulo, corpo, feito) => `<section class="b-passo ${feito ? 'feito' : ''}"><span class="b-num">${feito ? icone('check') : n}</span><div class="b-passo-corpo"><h3>${titulo}</h3>${corpo}</div></section>`;
    return `${cron('faixa')}
      <header class="b-topo">${voltar()}<div class="quem"><b>${rotaTxt()} <small>#${orc.id}</small></b><span>${esc(orc.contato.nome || 'sem nome')} · ${esc(O.fmtPax(orc.passageiros))}</span></div>${avatar(eu)}</header>
      ${avisos()}${trechos()}${nota()}
      ${passo(1, `Buscar ${O.diaCurto(form.data)} ${O.dataCurta(form.data)}`, `<div class="b-sites">${sites()}</div>`, false)}
      ${passo(2, 'Capturar o voo', captura('btn primario largo'), capturou)}
      ${passo(3, 'Conferir e lançar', `${recadoHtml()}<form class="b-form" id="b-form" autocomplete="off">${campos()}${lancar()}</form>`, false)}
      <details class="b-bloco b-dobra"><summary><h3>Já lançadas neste trecho · ${l.n}</h3>${icone('chevron-down')}</summary>${l.html}${abrirNoSistema()}</details>`;
  }

  // ---------- C) Formulário primeiro: topo fixo compacto, botões grudados embaixo ----------
  function versaoC() {
    const l = lancadas();
    return `<header class="c-topo">${voltar()}<div class="quem"><b>${rotaTxt()}</b><span>#${orc.id} · ${esc(orc.contato.nome || 'sem nome')} · ${esc(O.fmtPax(orc.passageiros))}</span></div>${cron('chip')}</header>
      ${avisos()}${trechos()}${nota()}
      <div class="c-sites"><span>Buscar ${O.dataCurta(form.data)}</span>${sites('c-site')}</div>
      ${recadoHtml()}
      ${capturando ? captura() : ''}
      <form class="b-form c-form" id="b-form" autocomplete="off">${campos()}</form>
      <details class="b-bloco b-dobra"><summary><h3>Já lançadas neste trecho · ${l.n}</h3>${icone('chevron-down')}</summary>${l.html}${abrirNoSistema()}</details>
      <div class="c-barra">${capturando ? '' : captura('btn c-cap')}${lancar('btn primario c-lancar', true)}</div>`;
  }

  // guarda o que a pessoa digitou antes de mexer no estado (a tela é redesenhada inteira)
  function sincronizar() {
    if (form) app.querySelectorAll('[data-f]').forEach((el) => { form[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; });
  }
  function desenhar() {
    if (!eu) return;
    const foco = document.activeElement && document.activeElement.id, ini = foco && document.activeElement.selectionStart;
    app.className = `pesq v-${versao}`;
    app.innerHTML = seletorVersao() + (orc ? { A: versaoA, B: versaoB, C: versaoC }[versao]() : telaLista());
    if (window.lucide) lucide.createIcons();
    // redesenhar não tira o cursor do campo em que a pessoa estava
    if (foco) { const el = document.getElementById(foco); if (el) { el.focus(); try { if (ini != null) el.setSelectionRange(ini, ini); } catch (e) {} } }
  }

  // ---------- cliques ----------
  app.addEventListener('click', async (e) => {
    const b = e.target.closest('button, a'); if (!b) return;
    if (b.dataset.ponto != null) return alternarPonto();
    if (b.dataset.versao) { sincronizar(); versao = b.dataset.versao; lembrar('kv-barra-versao', versao); return desenhar(); }
    if (b.dataset.recarregar != null) { sincronizar(); KVApi.esquecer(); recado = null; return carregar().catch(erro); }
    if (b.dataset.abrir) { recado = null; return abrir(+b.dataset.abrir).catch(erro); }
    if (b.dataset.voltar != null) { orc = null; form = null; recado = null; lembrar('kv-barra-orc', null); return desenhar(); }
    if (b.dataset.trecho) { sincronizar(); salvarRascunho(); trecho = +b.dataset.trecho; lembrar('kv-barra-trecho', trecho); recado = null; novoForm({ site: form.site }); restaurarRascunho(); return desenhar(); }
    if (b.dataset.buscar) { sincronizar(); return pedir('abrir', { url: BUSCA[b.dataset.buscar](orc.trechos[trecho], form.data, orc.passageiros) }); }
    if (b.dataset.capturar != null) { sincronizar(); capturando = true; recado = null; desenhar(); return pedir('capturar'); }
    if (b.dataset.cancelar != null) { sincronizar(); capturando = false; desenhar(); return pedir('cancelar'); }
    if (b.dataset.maior != null) return pedir('maior');
    if (b.dataset.menor != null) return pedir('menor');
    if (b.dataset.usarAba != null) { sincronizar(); form.link = aba.url; veio.link = 1; return desenhar(); }
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
    if (f === 'data') desenhar(); // o "Buscar dd/mm em" acompanha o dia escolhido
  });
  app.addEventListener('input', (e) => {
    if (!e.target.dataset || !e.target.dataset.f) return;
    if (e.target.hasAttribute('data-veio')) { e.target.removeAttribute('data-veio'); delete veio[e.target.dataset.f]; }
    sincronizar(); salvarRascunho();
  });

  // ---------- C) lançar ----------
  const hora = (t) => { const mais = /\+/.test(t); const d = String(t || '').replace(/\D/g, '').slice(0, 4); if (d.length < 3) return null; const h = d.length === 3 ? '0' + d[0] : d.slice(0, 2), m = d.slice(-2); if (+h > 23 || +m > 59) return null; return `${h}:${m}${mais ? ' +1' : ''}`; };
  const lerNum = (t) => { const n = +String(t || '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); return isFinite(n) && n > 0 ? n : null; };
  app.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (salvando) return;
    sincronizar();
    const din = O.site(form.site).forma === 'dinheiro', erros = [];
    const sai = hora(form.sai), chega = hora(form.chega);
    let milhas = lerNum(form.milhas); if (milhas && milhas < 1000) milhas *= 1000;
    const taxa = String(form.taxa || '').trim() === '0' ? 0 : O.lerReais(form.taxa), preco = O.lerReais(form.preco);
    if (!sai) erros.push('sai'); if (!chega) erros.push('chega');
    if (din && !preco) erros.push('preco'); if (!din && !milhas) erros.push('milhas'); if (!din && taxa == null) erros.push('taxa');
    app.querySelectorAll('[data-f]').forEach((el) => el.classList.toggle('erro', erros.includes(el.dataset.f)));
    if (erros.length) { app.querySelector(`[data-f="${erros[0]}"]`).focus(); return; }
    const voo = String(form.voo || '').trim().toUpperCase();
    salvando = true; salvarRascunho(); desenhar();
    try {
      await KVApi.acao('op.salvar', { orcamento: orc.id, trecho, site: form.site, data: form.data, sai, chega, voo, cia: voo.split(' ')[0] || form.site,
        escalas: +form.escalas, bagagem: !!form.bagagem, milhas: din ? null : Math.round(milhas), taxa: din ? null : taxa, preco: din ? preco : null, link: String(form.link || '').trim() });
      recado = { ok: true, texto: `Lançada: ${form.site} ${sai} → ${chega}. Pode capturar a próxima.` };
      const site = form.site, data = form.data;
      apagarRascunho();
      orc = await KVApi.orcamento(orc.id);
      form = null; novoForm({ site, data }); // site e dia continuam pra próxima
    } catch (err) { recado = { erro: true, texto: `Não lançou (${err.message}). Os campos continuam salvos aqui: é só tentar de novo.` }; }
    salvando = false;
    desenhar();
  });

  function erro(e) { app.innerHTML = `<p class="b-recado erro">${esc(e.message || 'Erro ao carregar.')}</p><button class="btn" type="button" data-recarregar>Tentar de novo</button>`; }

  pedir('oi');
  carregar().catch(erro);
  // voltou pra barra depois de mexer no sistema em outra aba: confere se mudou algo
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !capturando && !salvando) { KVApi.esquecer(); carregar().catch(() => {}); } });
})();

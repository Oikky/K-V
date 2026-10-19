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
    lista = (await KVApi.orcamentos()).filter((o) => o.etapa === 'pesquisa' && (dono || o.responsavel === eu.email));
    const lemb = +lembrado('kv-barra-orc');
    if (lemb && lista.some((o) => o.id === lemb)) await abrir(lemb, { manterForm: true });
    else { orc = null; desenhar(); }
  }
  async function abrir(id, { manterForm = false } = {}) {
    orc = await KVApi.orcamento(id);
    lembrar('kv-barra-orc', id);
    if (!manterForm || !form) { trecho = Math.min(+lembrado('kv-barra-trecho') || 0, orc.trechos.length - 1); novoForm(); }
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
    desenhar();
    const prim = app.querySelector(faltam.length ? '.campo input:not([data-veio])' : '[data-lancar]');
    if (prim) prim.focus();
  }

  // ---------- tela ----------
  const icone = (n) => `<i data-lucide="${n}"></i>`;
  function avatar(u) {
    const ini = esc((u.nome || '?').trim().charAt(0).toUpperCase());
    return `<span class="avatar" aria-hidden="true">${ini}${u.foto ? `<img src="${esc(u.foto)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
  }
  const PAPEL = { dono: 'Dono', admin: 'Admin', pesquisador: 'Pesquisador' };

  const maisVelha = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); return false; };
  function topo() {
    const velha = naExtensao && aba.versao && EXT_VERSAO && maisVelha(aba.versao, EXT_VERSAO);
    return `<header class="b-topo">${avatar(eu)}<div class="quem"><b>${esc(eu.nome)}</b><span>${PAPEL[eu.papel] || ''}${eu.admin ? ` · vendo como (você é ${esc(eu.admin.nome)})` : ''}</span></div>
      <button class="btn icone fantasma" type="button" data-recarregar aria-label="Atualizar">${icone('refresh-cw')}</button></header>
      ${velha ? `<a class="b-aviso" href="/extensao.html" target="_blank">${icone('download')}Tem versão nova da extensão. Toque pra atualizar.</a>` : ''}
      ${!naExtensao ? `<p class="b-aviso calmo">${icone('info')}Aberto fora da extensão: dá pra lançar, mas não pra capturar nem abrir a busca.</p>` : ''}`;
  }

  function telaLista() {
    const com = lista.filter((o) => o.responsavel === eu.email), outros = lista.filter((o) => o.responsavel !== eu.email);
    const item = (o) => `<li><button type="button" class="b-orc" data-abrir="${o.id}">
        <span class="rota">${esc(O.rota(o))}</span>
        <span class="sub">#${o.id} · ${esc(o.contato.nome || 'sem nome')} · ${esc(O.fmtPax(o.passageiros))}</span>
        <span class="sub">${o.trechos.map((t) => O.dataCurta(t.data)).join(' · ')} · ${o.nOpcoes} ${o.nOpcoes === 1 ? 'opção' : 'opções'}</span></button></li>`;
    const nomeDe = (email) => ((est.usuarios || []).find((u) => u.email === email) || {}).nome || email;
    return `${topo()}
      <h2 class="b-tit">Em pesquisa com você</h2>
      ${com.length ? `<ul class="b-lista">${com.map(item).join('')}</ul>` : `<p class="b-vazio">Nada em pesquisa com você. Pegue um orçamento na fila do sistema.</p>
        <a class="btn" href="/orcamentos.html" target="_blank">${icone('external-link')}Abrir a fila</a>`}
      ${dono && outros.length ? `<h2 class="b-tit">Com a equipe</h2><ul class="b-lista">${outros.map((o) => item(o).replace('</button>', `<span class="sub quem-pesq">com ${esc(nomeDe(o.responsavel))}</span></button>`)).join('')}</ul>` : ''}`;
  }

  function telaOrc() {
    const o = orc, t = o.trechos[trecho], p = o.passageiros, dias = O.janelaDias(t);
    const din = O.site(form.site).forma === 'dinheiro';
    const ops = (o.opcoes || []).filter((x) => x.trecho === trecho);
    const v = (k) => esc(form[k] == null ? '' : form[k]), marca = (k) => (veio[k] ? 'data-veio' : '');
    const nota = [o.pedido, o.observacao].filter(Boolean).join(' · ');
    return `${topo()}
      <div class="b-cab"><button class="btn icone fantasma" type="button" data-voltar aria-label="Voltar pra lista">${icone('arrow-left')}</button>
        <div><b>#${o.id} · ${esc(o.contato.nome || 'sem nome')}</b><span>${esc(O.fmtPax(p))}</span></div></div>
      ${nota ? `<details class="b-nota"><summary>${icone('message-square-text')}<span>${esc(nota)}</span></summary></details>` : ''}
      ${o.trechos.length > 1 ? `<div class="b-trechos" role="tablist">${o.trechos.map((x, i) => `<button type="button" role="tab" aria-selected="${i === trecho}" data-trecho="${i}">${x.de} → ${x.para}<small>${O.dataCurta(x.data)}</small></button>`).join('')}</div>`
        : `<p class="b-rota">${t.de} → ${t.para} <small>${O.diaCurto(t.data)} ${O.dataCurta(t.data)}${t.janela ? ' · janela de 14 dias' : ''}</small></p>`}

      <section class="b-bloco"><h3>Buscar ${O.dataCurta(form.data)} em</h3>
        <div class="b-sites">${Object.keys(BUSCA).map((s) => `<button type="button" class="btn pequeno" data-buscar="${s}" ${naExtensao ? '' : 'disabled'}>${NOME_BUSCA[s]}</button>`).join('')}</div></section>

      <section class="b-bloco">
        ${capturando ? `<div class="b-captura"><p>${icone('mouse-pointer-click')}<span>Clique no voo na página ao lado.</span></p>
            <div class="linha"><button class="btn pequeno" type="button" data-maior>${icone('maximize-2')}Pegar mais</button><button class="btn pequeno" type="button" data-menor>${icone('minimize-2')}Menos</button>
            <button class="btn pequeno fantasma" type="button" data-cancelar style="margin-left:auto">Cancelar</button></div></div>`
          : `<button class="btn primario largo" type="button" data-capturar ${naExtensao ? '' : 'disabled'}>${icone('scan-line')}Capturar voo da página</button>`}
        ${recado ? `<p class="b-recado ${recado.erro ? 'erro' : recado.ok ? 'ok' : ''}">${esc(recado.texto)}</p>` : ''}
      </section>

      <form class="b-form" data-form autocomplete="off">
        <div class="duas"><div class="campo"><label for="b-site">Site</label><select id="b-site" data-f="site">${O.sites.map((x) => `<option ${x.id === form.site ? 'selected' : ''}>${x.id}</option>`).join('')}</select></div>
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
          ${naExtensao && aba.url && /^https:/.test(aba.url) && form.link !== aba.url ? `<button type="button" class="b-usar" data-usar-aba>Usar o endereço da aba aberta</button>` : ''}</div>
        <button class="btn primario largo" type="submit" data-lancar ${salvando ? 'disabled' : ''}>${icone('plus')}Lançar no #${o.id}</button>
      </form>

      <section class="b-bloco"><h3>Já lançadas neste trecho · ${ops.length}</h3>
        ${ops.length ? `<ul class="b-ops">${ops.slice().reverse().map((x) => `<li><b>${esc(x.site)}</b> ${O.dataCurta(x.data)} · ${esc(x.sai)} → ${esc(x.chega)}${x.escalas ? ` · ${x.escalas} esc.` : ''}
            <span>${x.milhas ? `${O.fmt.pts(x.milhas)} mi + ${O.fmt.brl(x.taxa)}` : O.fmt.brl(x.preco)}</span></li>`).join('')}</ul>`
          : '<p class="b-vazio">Nenhuma ainda.</p>'}
        <a class="btn pequeno" href="/orcamento.html?id=${o.id}" target="_blank">${icone('external-link')}Abrir no sistema</a></section>`;
  }

  // guarda o que a pessoa digitou antes de mexer no estado (a tela é redesenhada inteira)
  function sincronizar() {
    if (form) app.querySelectorAll('[data-f]').forEach((el) => { form[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; });
  }
  function desenhar() {
    if (!eu) return;
    app.innerHTML = orc ? telaOrc() : telaLista();
    if (window.lucide) lucide.createIcons();
  }

  // ---------- cliques ----------
  app.addEventListener('click', async (e) => {
    const b = e.target.closest('button, a'); if (!b) return;
    if (b.dataset.recarregar != null) { sincronizar(); KVApi.esquecer(); recado = null; return carregar().catch(erro); }
    if (b.dataset.abrir) { recado = null; return abrir(+b.dataset.abrir).catch(erro); }
    if (b.dataset.voltar != null) { orc = null; form = null; recado = null; lembrar('kv-barra-orc', null); return desenhar(); }
    if (b.dataset.trecho) { sincronizar(); trecho = +b.dataset.trecho; lembrar('kv-barra-trecho', trecho); novoForm({ site: form.site }); recado = null; return desenhar(); }
    if (b.dataset.buscar) { sincronizar(); return pedir('abrir', { url: BUSCA[b.dataset.buscar](orc.trechos[trecho], form.data, orc.passageiros) }); }
    if (b.dataset.capturar != null) { sincronizar(); capturando = true; recado = null; desenhar(); return pedir('capturar'); }
    if (b.dataset.cancelar != null) { sincronizar(); capturando = false; desenhar(); return pedir('cancelar'); }
    if (b.dataset.maior != null) return pedir('maior');
    if (b.dataset.menor != null) return pedir('menor');
    if (b.dataset.usarAba != null) { sincronizar(); form.link = aba.url; veio.link = 1; return desenhar(); }
  });
  app.addEventListener('change', (e) => {
    const f = e.target.dataset && e.target.dataset.f;
    if (f === 'site') { sincronizar(); form.travadoSite = true; desenhar(); }
    if (f === 'data') { sincronizar(); desenhar(); } // o "Buscar dd/mm em" acompanha o dia escolhido
  });
  app.addEventListener('input', (e) => { if (e.target.hasAttribute('data-veio')) { e.target.removeAttribute('data-veio'); } });

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
    salvando = true;
    try {
      await KVApi.acao('op.salvar', { orcamento: orc.id, trecho, site: form.site, data: form.data, sai, chega, voo, cia: voo.split(' ')[0] || form.site,
        escalas: +form.escalas, bagagem: !!form.bagagem, milhas: din ? null : Math.round(milhas), taxa: din ? null : taxa, preco: din ? preco : null, link: String(form.link || '').trim() });
      recado = { ok: true, texto: `Lançada: ${form.site} ${sai} → ${chega}. Pode capturar a próxima.` };
      const site = form.site, data = form.data;
      orc = await KVApi.orcamento(orc.id);
      form = null; novoForm({ site, data }); // site e dia continuam pra próxima
    } catch (err) { recado = { erro: true, texto: err.message }; }
    salvando = false;
    desenhar();
  });

  function erro(e) { app.innerHTML = `<p class="b-recado erro">${esc(e.message || 'Erro ao carregar.')}</p><button class="btn" type="button" data-recarregar>Tentar de novo</button>`; }

  pedir('oi');
  carregar().catch(erro);
  // voltou pra barra depois de mexer no sistema em outra aba: confere se mudou algo
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !capturando && !salvando) { KVApi.esquecer(); carregar().catch(() => {}); } });
})();

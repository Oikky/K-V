/* Formulário de uma opção de voo: os campos da página de voo do documento antigo, na ordem em que aparecem no resumo escrito.
   Usado na tela de pesquisa (telas/orcamento.js) e na barra da extensão (barra.js), pra as duas ficarem sempre iguais.
   KVOpcao.html(trecho, valores, { dia }) desenha; KVOpcao.ler(raiz) pega o que está nos campos;
   KVOpcao.montar(valores, trecho) confere e devolve { erros, dados } no formato da ação op.salvar (sem orcamento e trecho). */
(function () {
  const O = KVOrc, esc = O.esc;
  const DESTAQUES = ['‼️Opção mais barata‼️', '‼️Opção a noite‼️', '‼️Outra opção de volta‼️', '‼️Volta indisponível em milhas‼️', '‼️Voo indisponível‼️', '‼️Taxa total ida e volta‼️'];
  const CIAS = ['Latam', 'GOL', 'Azul', 'TAP', 'KLM', 'Air France', 'Iberia', 'American', 'Delta', 'United', 'Copa', 'Avianca'];
  const eDinheiro = (s) => O.site(s).forma === 'dinheiro';
  const campo = (id, rotulo, html, cls = '') => `<div class="campo ${cls}"><label for="${id}">${rotulo}</label>${html}</div>`;
  const entrada = (f, attrs, valor) => `<input id="f-${f}" data-f="${f}" ${attrs} value="${esc(valor ?? '')}">`;

  function html(t, r = {}, { dia: diaPadrao } = {}) {
    const dias = O.janelaDias(t), s = r.site || 'Smiles', din = eDinheiro(s);
    const dia = r.data || diaPadrao || t.data, depois = +(r.depois || 0);
    const escalas = r.escalasOnde || [];
    const depoisDe = (n) => { const d = new Date(dia + 'T12:00:00'); d.setDate(d.getDate() + n); return O.dataCurta(O.isoDia(d)); };
    return `<h3 class="form-grupo">Voo</h3>
      <div class="duas">${campo('f-site', 'Site', `<select id="f-site" data-f="site">${O.sites.map((x) => `<option ${x.id === s ? 'selected' : ''}>${x.id}</option>`).join('')}</select>`)}
        ${campo('f-data', 'Dia', `<select id="f-data" data-f="data">${dias.map((d) => `<option value="${d}" ${d === dia ? 'selected' : ''}>${O.diaCurto(d)} ${O.dataCurta(d)}${d === t.data ? ' (pedido)' : ''}</option>`).join('')}</select>`)}</div>
      <div class="duas">${campo('f-cia', 'Companhia aérea', entrada('cia', 'placeholder="Latam, GOL, Azul…" list="l-cias" autocomplete="off"', r.cia))}${campo('f-voo', 'Voo', entrada('voo', 'placeholder="LA 8084"', r.voo))}</div>
      <datalist id="l-cias">${CIAS.map((c) => `<option value="${c}">`).join('')}</datalist>
      <div class="duas">${campo('f-de', 'Sai de', entrada('de', `placeholder="${t.de}" maxlength="3" autocapitalize="characters"`, r.de || t.de))}${campo('f-para', 'Chega em', entrada('para', `placeholder="${t.para}" maxlength="3" autocapitalize="characters"`, r.para || t.para))}</div>
      <div class="duas">${campo('f-sai', 'Horário de saída', entrada('sai', 'inputmode="numeric" placeholder="07:40"', r.sai))}${campo('f-chega', 'Horário de chegada', entrada('chega', 'inputmode="numeric" placeholder="19:10"', r.chega))}</div>
      <div class="duas">${campo('f-depois', 'Chega no dia', `<select id="f-depois" data-f="depois">${[0, 1, 2, 3].map((n) => `<option value="${n}" ${n === depois ? 'selected' : ''}>${n ? `${depoisDe(n)} (+${n})` : 'Mesmo dia'}</option>`).join('')}</select>`)}
        ${campo('f-duracao', 'Tempo de viagem', entrada('duracao', 'placeholder="7h10m"', r.duracao))}</div>
      <h3 class="form-grupo">Escalas <span>${escalas.length ? `${escalas.length} escala${escalas.length > 1 ? 's' : ''}` : 'voo direto'}</span></h3>
      ${escalas.map(([l, tm], i) => `<div class="esc-linha">${campo(`f-el${i}`, `Escala ${i + 1}`, `<input id="f-el${i}" data-esc="${i}" data-q="l" placeholder="CGH ou São Paulo CGH" value="${esc(l)}">`)}
        ${campo(`f-et${i}`, 'Tempo', `<input id="f-et${i}" data-esc="${i}" data-q="t" placeholder="1h30m" value="${esc(tm)}">`)}
        <button type="button" class="btn icone" data-tira-esc="${i}" aria-label="Tirar a escala ${i + 1}"><i data-lucide="x"></i></button></div>`).join('')}
      ${escalas.length < 3 ? '<button type="button" class="btn" data-poe-esc><i data-lucide="plus"></i>Escala</button>' : ''}
      <h3 class="form-grupo">Malas</h3>
      <div class="duas">${campo('f-mao', 'Mala de mão', `<select id="f-mao" data-f="malaMao">${[['1', 'Inclusa'], ['0', 'Não inclusa'], ['', 'Não sei']].map(([v, n]) => `<option value="${v}" ${String(r.malaMao ?? '1') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`)}
        ${campo('f-bagagem', 'Mala despachada', `<select id="f-bagagem" data-f="bagagem">${[0, 1, 2, 3].map((n) => `<option value="${n}" ${+(r.bagagem || 0) === n ? 'selected' : ''}>${n ? `${n} inclusa${n > 1 ? 's' : ''}` : 'Não inclusa'}</option>`).join('')}</select>`)}</div>
      <h3 class="form-grupo">Valores, por pessoa</h3>
      ${din ? campo('f-preco', 'Preço em dinheiro', entrada('preco', 'inputmode="decimal" placeholder="R$"', r.preco))
        : `<div class="duas">${campo('f-milhas', 'Milhas', entrada('milhas', 'inputmode="numeric" placeholder="45 = 45.000"', r.milhas))}${campo('f-taxa', 'Taxa', entrada('taxa', 'inputmode="decimal" placeholder="R$"', r.taxa))}</div>
        ${campo('f-mmala', 'Milhas com mala despachada', entrada('milhasMala', 'inputmode="numeric" placeholder="Se o site cobra a mala à parte"', r.milhasMala))}`}
      <h3 class="form-grupo">Anotações</h3>
      ${campo('f-destaque', 'Destaque', entrada('destaque', 'list="l-destaques" placeholder="‼️Opção mais barata‼️" autocomplete="off"', r.destaque))}
      <datalist id="l-destaques">${DESTAQUES.map((d) => `<option value="${d}">`).join('')}</datalist>
      ${campo('f-obs', 'Observações', `<textarea id="f-obs" data-f="obs" rows="3" placeholder="Ex.: taxa total pra 4 pessoas">${esc(r.obs || '')}</textarea>`)}
      ${campo('f-link', 'Link do preço', entrada('link', 'placeholder="Colar link"', r.link))}`;
  }

  function ler(raiz) {
    const v = {};
    raiz.querySelectorAll('[data-f]').forEach((el) => { v[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; });
    v.escalasOnde = [...raiz.querySelectorAll('[data-esc][data-q="l"]')].map((el) => [el.value, (raiz.querySelector(`[data-esc="${el.dataset.esc}"][data-q="t"]`) || {}).value || '']);
    return v;
  }

  const lerNum = (t) => { const n = +String(t || '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); return isFinite(n) && n > 0 ? n : null; };
  const hora = (t) => { const mais = /\+/.test(t); const d = String(t || '').replace(/\D/g, '').slice(0, 4); if (d.length < 3) return null; const h = d.length === 3 ? '0' + d[0] : d.slice(0, 2), m = d.slice(-2); if (+h > 23 || +m > 59) return null; return `${h}:${m}${mais ? ' +1' : ''}`; };
  // "0215", "215" ou "2:15" → "2h15m"; o que já vem escrito ("2h", "16 hrs 41 min") fica como está
  const tempo = (t) => { const x = String(t || '').trim(); const m = /^(\d{1,2})[:h]?(\d{2})$/.exec(x); return m ? `${+m[1]}h${m[2]}m` : x; };
  // "cgh" → "São Paulo CGH"; texto livre fica como está
  const lugarEscala = (l) => { const x = String(l || '').trim(); if (!/^[a-z]{3}$/i.test(x)) return x; const c = x.toUpperCase(), n = O.cidadeCurta(c); return n === c ? c : `${n} ${c}`; };

  function montar(v, t) {
    const din = eDinheiro(v.site), erros = [];
    const sai = hora(v.sai), chegaH = hora(v.chega);
    // "06:10+" no horário ainda vale como dia seguinte
    const depois = Math.max(+v.depois || 0, chegaH && chegaH.endsWith('+1') ? 1 : 0);
    const chega = chegaH && `${chegaH.replace(' +1', '')}${depois ? ` +${depois}` : ''}`;
    let milhasMala = lerNum(v.milhasMala); if (milhasMala && milhasMala < 1000) milhasMala *= 1000;
    const de = String(v.de || '').trim().toUpperCase(), para = String(v.para || '').trim().toUpperCase();
    let milhas = lerNum(v.milhas); if (milhas && milhas < 1000) milhas *= 1000;
    // taxa pode ser zero (emissão sem taxa); só não pode ficar vazia
    const taxa = String(v.taxa || '').trim() === '0' ? 0 : O.lerReais(v.taxa), preco = O.lerReais(v.preco);
    if (!sai) erros.push('sai'); if (!chega) erros.push('chega');
    if (de && !/^[A-Z]{3}$/.test(de)) erros.push('de'); if (para && !/^[A-Z]{3}$/.test(para)) erros.push('para');
    if (din && !preco) erros.push('preco'); if (!din && !milhas) erros.push('milhas'); if (!din && taxa == null) erros.push('taxa');
    if (erros.length) return { erros };
    const voo = String(v.voo || '').trim().toUpperCase();
    const escalasOnde = (v.escalasOnde || []).map(([l, tm]) => [lugarEscala(l), tempo(tm)]).filter(([l]) => l);
    return { erros, dados: { site: v.site, data: v.data, sai, chega, voo, cia: String(v.cia || '').trim() || voo.split(' ')[0] || v.site,
      escalas: escalasOnde.length, escalasOnde, bagagem: +v.bagagem || 0,
      milhas: din ? null : Math.round(milhas), taxa: din ? null : taxa, preco: din ? preco : null, link: String(v.link || '').trim(),
      // aeroporto igual ao do trecho não precisa ficar guardado na opção
      de: de && de !== t.de ? de : null, para: para && para !== t.para ? para : null,
      duracao: tempo(v.duracao) || null, milhasMala: din || !milhasMala ? null : Math.round(milhasMala),
      malaMao: v.malaMao === '' ? null : v.malaMao === '1', destaque: String(v.destaque || '').trim() || null, obs: String(v.obs || '').trim() } };
  }

  window.KVOpcao = { html, ler, montar, DESTAQUES, eDinheiro };
})();

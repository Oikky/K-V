/* Folha do recibo K&V, tirada do recibo-kv (github.com/Oikky/recibo-kv) sem mudar o desenho: CSS, molde, funções de cada bloco e config padrão.
   Os dados da empresa (CNPJ, telefone, Instagram, e-mail) e a logo NÃO ficam aqui (o repositório é público): vêm do banco,
   em Configurações › Empresa, e entram com KVRecibo.empresa({ tel, ig, cnpj, gmail, logo }).
   Uso: KVRecibo.montar(el, D, celular) desenha (o bloco de pagamento pode ser trocado, via KVRecibo.pagamento); KVRecibo.pdf(D, celular) baixa o PDF igual ao "Exportar PDF" do recibo-kv. */
(function () {
let D = null;
const CFG_DEFAULT = {
  nome: 'K&V  Easy Traveling', slogan: '✨ "Viaje hoje, viaje barato, viaje sempre" ✨',
  tel: '', ig: '', cnpj: '',
  rodape: 'Recibo gerado pela K&V Easy Traveling', gmail: '',
  primary: '#193F72', slogan_color: '#4a5a50', slogan_border: '#b0a898',
  cnpj_color: '#193F72', loc: '#193F72', trecho_primary: '#193F72',
  trecho_titulo: '#193F72', bag_bg: '#fdf0e0', bag_accent: '#EA9940',
  info_bg: '#e5eeec', info_border: '#6CA3A2', bagesp_bg: '#e0dbd0',
  bagesp_border: '#193F72', hosp_titulo: '#193F72', hosp_conf: '#193F72',
  valor_bg: '#193F72', pag_titulo: '#193F72', rodape_color: '#7a8a80',
  nome_size: 20, slogan_size: 10, tel_size: 10, cnpj_size: 12,
  loc_size: 22, trecho_titulo_size: 14, trecho_val_size: 12,
  bagesp_size: 11, bag_size: 12, hosp_val_size: 12, info_size: 12,
  valor_size: 24, pag_size: 12, rodape_size: 10, logo_size: 88,
  vis_nome: true, vis_slogan: true, vis_tel: true, vis_cnpj: true,
  vis_loc: true, vis_trechos: true, vis_bagesp: true, vis_baggeral: true,
  vis_hosp: true, vis_info: true, vis_valor: true, vis_pag: true, vis_rodape: true,
  icons: { logo: null, wa: null, ig: null, gm: null }
};
let DEFAULT_LOGO = ''; // vem do banco (KVRecibo.empresa)
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function adjustColor(hex, amount) {
  try {
    let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    r = Math.max(0,Math.min(255,r+amount)); g = Math.max(0,Math.min(255,g+amount)); b = Math.max(0,Math.min(255,b+amount));
    return '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  } catch { return hex; }
}
function htmlPassageiros(cfg) {
  const nomes = D.passageiros.filter(p => p.trim());
  if (!nomes.length) return '';
  return `<div class="bloco bloco-pass"><div class="bloco-titulo">👤 ${nomes.length>1?'Passageiros':'Passageiro'}</div><p>${nomes.map(esc).join('<br>')}</p></div>`;
}
function htmlLocalizador(cfg) {
  if (!cfg.vis_loc || (!D.locGeral && !D.ciaGeral)) return '';
  let h = `<div class="bloco bloco-loc" style="padding:16px 20px;background:${cfg.loc}!important;border-color:${cfg.loc}!important;"><div style="display:flex;justify-content:space-between;align-items:center;">`;
  if (D.locGeral) h += `<div style="display:flex;flex-direction:column;gap:3px;"><span style="font-size:10px;color:rgba(255,255,255,.5);letter-spacing:.08em;font-weight:600;">LOCALIZADOR</span><span style="font-size:${cfg.loc_size}px;font-weight:700;color:#fff;font-family:monospace;letter-spacing:.05em;">${esc(D.locGeral)}</span></div>`;
  if (D.ciaGeral) h += `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;"><span style="font-size:10px;color:rgba(255,255,255,.5);letter-spacing:.08em;font-weight:600;">CIA AÉREA</span><span style="font-size:16px;font-weight:700;color:#fff;">${esc(D.ciaGeral)}</span></div>`;
  return h + `</div></div>`;
}
function htmlTrechos(cfg) {
  if (!cfg.vis_trechos || !D.trechos.length) return '';
  return D.trechos.map((t, i) => {
    let h = `<div class="trecho">`;
    h += `<div class="trecho-titulo" style="font-size:${cfg.trecho_titulo_size}px;color:${cfg.trecho_titulo};border-bottom-color:${cfg.trecho_titulo};">✈️ Trecho ${i + 1}</div>`;
    if (t.locEsp || t.ciaEsp) {
      h += `<div class="loc-cia-row">`;
      if (t.locEsp) h += `<div class="loc-esp-bloco" style="background:${cfg.loc};"><span class="loc-esp-label">LOCALIZADOR</span><span class="loc-esp-val">${esc(t.locEsp)}</span></div>`;
      if (t.ciaEsp) h += `<div class="cia-bloco" style="border-color:${cfg.loc};"><span class="cia-label" style="color:${cfg.loc};">CIA AÉREA</span><span class="cia-val" style="color:${cfg.loc};">${esc(t.ciaEsp)}</span></div>`;
      h += `</div>`;
    }
    h += `<div class="trecho-cols">`;
    h += `<div class="tcol"><div class="tcol-header" style="color:${cfg.trecho_primary};border-bottom-color:${cfg.trecho_primary};">Partida</div>`;
    if (t.partida)     h += `<div class="trow"><div class="trow-label">Local</div><div class="trow-val" style="font-size:${cfg.trecho_val_size}px;">${esc(t.partida)}</div></div>`;
    if (t.dataPartida) h += `<div class="trow"><div class="trow-label">Data</div><div class="trow-val" style="font-size:${cfg.trecho_val_size}px;">${esc(t.dataPartida)}</div></div>`;
    if (t.horaPartida) h += `<div class="trow"><div class="trow-label">Hora</div><div class="trow-val" style="font-size:${cfg.trecho_val_size}px;">${esc(t.horaPartida)}</div></div>`;
    h += `</div><div class="tcol"><div class="tcol-header" style="color:${cfg.trecho_primary};border-bottom-color:${cfg.trecho_primary};">Destino</div>`;
    if (t.destino)     h += `<div class="trow"><div class="trow-label">Local</div><div class="trow-val" style="font-size:${cfg.trecho_val_size}px;">${esc(t.destino)}</div></div>`;
    if (t.dataChegada) h += `<div class="trow"><div class="trow-label">Data</div><div class="trow-val" style="font-size:${cfg.trecho_val_size}px;">${esc(t.dataChegada)}</div></div>`;
    if (t.horaChegada) h += `<div class="trow"><div class="trow-label">Hora</div><div class="trow-val" style="font-size:${cfg.trecho_val_size}px;">${esc(t.horaChegada)}</div></div>`;
    h += `</div></div>`;
    const temBottom = t.paradas.length || t.duracaoTotal || (cfg.vis_bagesp && t.bagEsp.length);
    if (temBottom) {
      h += `<div class="trecho-bottom">`;
      if (t.paradas.length) {
        const temDur = t.paradas.some(p => p.includes(' - '));
        if (temDur) {
          h += `<div class="tbot-header"><span class="tbot-header-label" style="color:${cfg.trecho_primary};">Paradas</span><span class="tbot-header-label" style="color:${cfg.trecho_primary};">Duração</span></div>`;
          t.paradas.forEach(p => { const pts = p.split(/\s*-\s*(?=\d)/); h += `<div class="tbot-parada-row"><span class="tbot-parada-local">${esc(pts[0]?.trim()||p)}</span><span class="tbot-parada-dur">${esc(pts[1]?.trim()||'')}</span></div>`; });
        } else { h += `<div class="tbot-item"><div class="tbot-label">Paradas</div><div class="tbot-val">${t.paradas.map(esc).join(' · ')}</div></div>`; }
      }
      if (t.duracaoTotal) h += `<div class="tbot-total"><span class="tbot-total-label">Duração Total</span><span class="tbot-total-val" style="color:${cfg.trecho_primary};">${esc(t.duracaoTotal)}</span></div>`;
      if (cfg.vis_bagesp && t.bagEsp.length) {
        h += `<div class="bag-esp" style="margin-top:8px;background:${cfg.bagesp_bg};border-left-color:${cfg.bagesp_border};"><div class="bag-esp-titulo" style="color:${cfg.bagesp_border};">🧳 Bagagem</div><ul>`;
        h += t.bagEsp.map(b => `<li style="font-size:${cfg.bagesp_size}px;">${esc(b)}</li>`).join('');
        h += `</ul></div>`;
      }
      h += `</div>`;
    }
    return h + `</div>`;
  }).join('');
}
function htmlBagGeral(cfg) {
  if (!cfg.vis_baggeral || !D.bagGeral.length) return '';
  const bagTextColor = adjustColor(cfg.bag_accent, -30);
  return `<div class="bloco bloco-bag" style="background:${cfg.bag_bg}!important;border-color:${cfg.bag_accent}!important;"><div class="bloco-titulo" style="color:${bagTextColor}!important;">🧳 Franquia de Bagagens: (por passageiro)</div><ul>${D.bagGeral.map(b=>`<li style="font-size:${cfg.bag_size}px;">${esc(b)}</li>`).join('')}</ul></div>`;
}
function htmlHospedagens(cfg) {
  if (!cfg.vis_hosp || !(D.hospedagens||[]).length) return '';
  return D.hospedagens.map((h, i) => {
    const titulo = D.hospedagens.length>1 ? `🏨 Hospedagem ${i+1}` : '🏨 Hospedagem';
    let s = `<div class="hospedagem"><div class="hosp-titulo" style="color:${cfg.hosp_titulo};">${titulo}</div>`;
    if (h.codigo) s += `<div class="hosp-conf" style="border-left:3px solid ${cfg.hosp_conf};"><span class="hosp-conf-label" style="color:${cfg.hosp_conf};">CONFIRMAÇÃO</span><span class="hosp-conf-val" style="color:${cfg.hosp_conf};">${esc(h.codigo)}</span></div>`;
    s += `<div class="hosp-grid">`;
    if (h.local)  s += `<div class="hosp-item hosp-full"><div class="hosp-label">Local</div><div class="hosp-val" style="font-size:${cfg.hosp_val_size}px;">${esc(h.local)}</div></div>`;
    if (h.cidade) s += `<div class="hosp-item hosp-full"><div class="hosp-label">Cidade</div><div class="hosp-val" style="font-size:${cfg.hosp_val_size}px;">${esc(h.cidade)}</div></div>`;
    s += `</div>`;
    if (h.entrada || h.saida) {
      s += `<div class="hosp-datas"><div class="hosp-item">`;
      if (h.entrada)     s += `<div class="hosp-label">Entrada</div><div class="hosp-val" style="font-size:${cfg.hosp_val_size}px;">${esc(h.entrada)}</div>`;
      if (h.horaEntrada) s += `<div class="hosp-label" style="margin-top:3px;">Hora</div><div class="hosp-val" style="font-size:${cfg.hosp_val_size}px;">${esc(h.horaEntrada)}</div>`;
      s += `</div><div class="hosp-item">`;
      if (h.saida)     s += `<div class="hosp-label">Saída</div><div class="hosp-val" style="font-size:${cfg.hosp_val_size}px;">${esc(h.saida)}</div>`;
      if (h.horaSaida) s += `<div class="hosp-label" style="margin-top:3px;">Hora</div><div class="hosp-val" style="font-size:${cfg.hosp_val_size}px;">${esc(h.horaSaida)}</div>`;
      s += `</div></div>`;
    }
    if (h.incluso) s += `<div class="hosp-incluso"><div class="hosp-incluso-titulo">✓ Incluso</div><p>${esc(h.incluso)}</p></div>`;
    return s + `</div>`;
  }).join('');
}
function htmlInfo(cfg) {
  if (!cfg.vis_info || !D.informacoes) return '';
  return `<div class="bloco bloco-info" style="background:${cfg.info_bg}!important;border-color:${cfg.info_border}!important;"><div class="bloco-titulo">📋 Informações</div><p style="font-size:${cfg.info_size}px;">${esc(D.informacoes)}</p></div>`;
}
function htmlValor(cfg) {
  if (!cfg.vis_valor || !D.valor) return '';
  return `<div class="bloco bloco-valor" style="background:${cfg.valor_bg}!important;border-color:${cfg.valor_bg}!important;"><div class="bloco-titulo">💰 Valor à Pagar</div><div class="valor-num" style="font-size:${cfg.valor_size}px;">${esc(D.valor)}</div></div>`;
}
function htmlPagamento(cfg) {
  if (!cfg.vis_pag || !D.pagamento.length) return '';
  return `<div class="bloco bloco-pag"><div class="bloco-titulo" style="color:${cfg.pag_titulo};">💳 Pagamento</div><p style="font-size:${cfg.pag_size}px;">${D.pagamento.map(esc).join('\n')}</p></div>`;
}
const CSS = '#recibo {\n  width: 680px; background: #ECE7DC; color: #12212E;\n  font-family: \'Sora\', sans-serif; font-size: 13px;\n  padding: 32px 36px; border-radius: 10px;\n  box-shadow: 0 8px 40px rgba(0,0,0,.5);\n  -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;\n}#recibo .rec-header {\n  display: flex; align-items: flex-end; justify-content: space-between;\n  margin-bottom: 20px; padding-bottom: 16px;\n  border-bottom: 3px solid var(--r-primary, #193F72);\n}#recibo .rec-logo-area { display: flex; align-items: center; gap: 16px; }#recibo #logo-img-wrap img, #recibo #logo-img-wrap .logo-ph {\n  width: 88px; height: 88px; object-fit: cover; border-radius: 8px; display: block;\n}#recibo #logo-img-wrap .logo-ph {\n  background: linear-gradient(135deg, #193F72 60%, #EA9940 100%);\n  display: flex; align-items: center; justify-content: center;\n  color: #fff; font-size: 10px; font-weight: 700; text-align: center; line-height: 1.4;\n}#recibo .rec-company h1 { font-size: 20px; font-weight: 700; color: var(--r-primary, #193F72); }#recibo .rec-slogan { font-size: 10px; color: #4a5a50; margin-top: 3px; border: .5px solid #b0a898; border-radius: 4px; padding: 3px 8px; display: inline-block; }#recibo .rec-cnpj { text-align: right; font-size: 11px; color: #4a5a50; align-self: flex-end; }#recibo .rec-cnpj strong { color: var(--r-primary, #193F72); font-size: 12px; display: block; }#recibo .bloco { border: 1px solid #b8b0a0; border-radius: 8px; padding: 11px 15px; margin-bottom: 12px; background: #f5f0e8; break-inside: avoid; page-break-inside: avoid; }#recibo .bloco-titulo { font-weight: 700; font-size: 13px; color: var(--r-primary, #193F72); margin-bottom: 5px; display: flex; align-items: center; gap: 6px; }#recibo .bloco p { color: #2a3a35; font-size: 12px; line-height: 1.8; }#recibo .bloco-pass p { font-size: 13px; font-weight: 500; }#recibo .bloco-loc { background: var(--r-loc-bg, #193F72) !important; border-color: var(--r-loc-bg, #193F72) !important; }#recibo .bloco-loc .bloco-titulo { color: rgba(255,255,255,.7) !important; font-size: 11px !important; font-weight: 500 !important; }#recibo .bloco-loc p { color: #fff !important; font-size: 14px !important; font-weight: 700 !important; }#recibo .trecho { background: #f5f0e8; border: 1px solid #b8b0a0; border-radius: 8px; padding: 12px 15px; margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; }#recibo .trecho-titulo { font-weight: 700; font-size: 14px; color: var(--r-primary, #193F72); display: flex; align-items: center; gap: 6px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #c8c0b0; }#recibo .loc-cia-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }#recibo .loc-esp-bloco { background: var(--r-loc-bg, #193F72); border-radius: 6px; padding: 7px 12px; display: inline-flex; align-items: center; gap: 8px; }#recibo .loc-esp-label { font-size: 10px; color: rgba(255,255,255,.6); font-weight: 500; }#recibo .loc-esp-val { font-size: 13px; color: #fff; font-weight: 700; }#recibo .cia-bloco { border: 1px solid var(--r-loc-bg, #193F72); border-radius: 6px; padding: 7px 12px; display: inline-flex; align-items: center; gap: 8px; }#recibo .cia-label { font-size: 10px; color: var(--r-loc-bg, #193F72); font-weight: 500; }#recibo .cia-val { font-size: 13px; color: var(--r-loc-bg, #193F72); font-weight: 700; }#recibo .trecho-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 10px; }#recibo .tcol { display: flex; flex-direction: column; gap: 5px; }#recibo .tcol-header { font-size: 10px; font-weight: 700; color: var(--r-primary, #193F72); text-transform: uppercase; letter-spacing: .06em; padding-bottom: 4px; border-bottom: 2px solid var(--r-primary, #193F72); margin-bottom: 3px; }#recibo .trow { display: flex; flex-direction: column; }#recibo .trow-label { font-size: 10px; color: #6a7a70; }#recibo .trow-val { font-size: 12px; color: #12212E; font-weight: 600; }#recibo .trecho-bottom { display: flex; flex-direction: column; gap: 0; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e8eef5; }#recibo .tbot-header { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; padding: 4px 0 6px; border-bottom: 1px solid #b8b0a0; margin-bottom: 4px; }#recibo .tbot-header-label { font-size: 10px; font-weight: 700; color: #193F72; text-transform: uppercase; letter-spacing: .06em; }#recibo .tbot-parada-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; padding: 3px 0; }#recibo .tbot-parada-row + .tbot-parada-row { border-top: .5px solid #c8c0b0; }#recibo .tbot-parada-local { font-size: 12px; color: #12212E; font-weight: 500; }#recibo .tbot-parada-dur { font-size: 12px; color: #4a5a50; }#recibo .tbot-total { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #b8b0a0; }#recibo .tbot-total-label { font-size: 10px; color: #6a7a70; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }#recibo .tbot-total-val { font-size: 13px; color: #193F72; font-weight: 700; }#recibo .tbot-item { display: flex; flex-direction: column; gap: 2px; padding: 4px 0; }#recibo .tbot-label { font-size: 10px; color: #6a7a70; }#recibo .tbot-val { font-size: 12px; color: #12212E; font-weight: 600; }#recibo .bag-esp { padding: 8px 11px; background: var(--r-bag-esp-bg, #e0dbd0); border-radius: 6px; border-left: 3px solid var(--r-bag-esp-border, #193F72); }#recibo .bag-esp-titulo { font-size: 10px; font-weight: 700; color: var(--r-bag-esp-border, #193F72); margin-bottom: 4px; }#recibo .bag-esp ul { list-style: none; }#recibo .bag-esp li { font-size: 11px; color: #2a3a35; line-height: 1.75; }#recibo .bag-esp li::before { content: "✓ "; color: var(--r-bag-esp-border, #193F72); font-weight: 700; }#recibo .bloco-bag { background: var(--r-bag-bg, #fdf0e0) !important; border-color: var(--r-bag-border, #EA9940) !important; }#recibo .bloco-bag .bloco-titulo { color: var(--r-bag-text, #b06010) !important; }#recibo .bloco-bag ul { list-style: none; }#recibo .bloco-bag li { font-size: 12px; color: #2a3a35; line-height: 1.85; }#recibo .bloco-bag li::before { content: "✓ "; color: var(--r-bag-text, #b06010); font-weight: 700; }#recibo .bloco-info { background: var(--r-info-bg, #e5eeec) !important; border-color: var(--r-info-border, #6CA3A2) !important; }#recibo .bloco-info .bloco-titulo { color: var(--r-primary, #193F72) !important; }#recibo .bloco-info p { white-space: pre-wrap; font-size: 12px; color: #2a3a35; line-height: 1.75; }#recibo .bloco-valor { background: var(--r-primary, #193F72) !important; border-color: var(--r-primary, #193F72) !important; display: flex; justify-content: space-between; align-items: center; }#recibo .bloco-valor .bloco-titulo { color: rgba(255,255,255,.7) !important; margin-bottom: 0; font-size: 11px !important; font-weight: 500 !important; }#recibo .valor-num { font-size: 24px; font-weight: 700; color: #fff; }#recibo .hospedagem { background: #f5f0e8; border: 1px solid #b8b0a0; border-radius: 8px; padding: 12px 15px; margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; }#recibo .hosp-titulo { font-weight: 700; font-size: 13px; color: #193F72; display: flex; align-items: center; gap: 6px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #c8c0b0; }#recibo .hosp-conf { display: inline-flex; align-items: center; gap: 8px; background: #e8e0d0; border-radius: 6px; padding: 5px 12px; margin-bottom: 10px; }#recibo .hosp-conf-label { font-size: 10px; color: #193F72; font-weight: 600; letter-spacing: .06em; opacity: .7; }#recibo .hosp-conf-val { font-size: 13px; color: #193F72; font-weight: 700; letter-spacing: .05em; }#recibo .hosp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 6px; }#recibo .hosp-item { display: flex; flex-direction: column; }#recibo .hosp-full { grid-column: 1/-1; }#recibo .hosp-datas { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 16px; margin-bottom: 6px; }#recibo .hosp-label { font-size: 10px; color: #6a7a70; margin-bottom: 1px; }#recibo .hosp-val { font-size: 12px; color: #12212E; font-weight: 600; }#recibo .hosp-incluso { margin-top: 8px; padding: 7px 10px; background: var(--r-bag-bg, #fdf0e0); border-radius: 5px; border-left: 3px solid var(--r-bag-border, #EA9940); }#recibo .hosp-incluso-titulo { font-size: 10px; font-weight: 700; color: var(--r-bag-text, #b06010); margin-bottom: 3px; }#recibo .hosp-incluso p { font-size: 11px; color: #2a3a35; line-height: 1.7; white-space: pre-wrap; }#recibo .bloco-pag .bloco-titulo { color: var(--r-primary, #193F72); }#recibo .bloco-pag p { font-size: 12px; color: #2a3a35; white-space: pre-wrap; }#recibo .rec-footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #b8b0a0; font-size: 10px; color: #7a8a80; display: flex; justify-content: space-between; align-items: center; }#recibo.modo-celular { width: 390px !important; padding: 20px 16px !important; font-size: 14px !important; }#recibo.modo-celular .rec-header { flex-direction: column; align-items: flex-start; gap: 12px; }#recibo.modo-celular #logo-img-wrap img, #recibo.modo-celular #logo-img-wrap .logo-ph { width: 52px; height: 52px; }#recibo.modo-celular .rec-company h1 { font-size: 16px; }#recibo.modo-celular .rec-cnpj { text-align: left; margin-top: 4px; }#recibo.modo-celular .trecho-cols { grid-template-columns: 1fr; gap: 12px; }#recibo.modo-celular .valor-num { font-size: 22px; }\n\n\n';
const MOLDE = '<div id="recibo">\n  <div class="rec-header">\n    <div class="rec-logo-area">\n      <div id="logo-img-wrap"><div class="logo-ph">K&V<br>Viagens</div></div>\n      <div class="rec-company" id="r-company-stack">\n        <h1 id="r-nome" style="font-size:20px;">K&amp;V&nbsp; Easy Traveling</h1>\n        <div class="rec-slogan" id="r-slogan">✨ "Viaje hoje, viaje barato, viaje sempre" ✨</div>\n        <div id="r-tel-row" style="display:flex;align-items:center;gap:12px;margin-top:4px;font-size:10px;">\n          <span style="display:flex;align-items:center;gap:4px;">\n            <span id="icon-wa-el">\n              <svg width="13" height="13" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#25D366"/><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#fff"/></svg>\n            </span>\n            <span id="r-tel-num"></span>\n          </span>\n          <span style="display:flex;align-items:center;gap:4px;">\n            <span id="icon-ig-el">\n              <svg width="12" height="12" viewBox="0 0 24 24"><defs><radialGradient id="ig-g" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="#fdf497"/><stop offset="5%" stop-color="#fdf497"/><stop offset="45%" stop-color="#fd5949"/><stop offset="60%" stop-color="#d6249f"/><stop offset="90%" stop-color="#285AEB"/></radialGradient></defs><rect width="24" height="24" rx="5.5" fill="url(#ig-g)"/><rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="17.5" cy="6.5" r="1" fill="#fff"/></svg>\n            </span>\n            <span id="r-ig-handle"></span>\n          </span>\n        </div>\n      </div>\n    </div>\n    <div class="rec-cnpj" id="r-cnpj-wrap">CNPJ:<strong id="r-cnpj" style="font-size:12px;"></strong></div>\n  </div>\n  <div id="r-corpo"></div>\n  <div class="rec-footer" id="r-rodape-el">\n    <span id="r-rodape">Recibo gerado pela K&amp;V Easy Traveling</span>\n    <span style="display:flex;align-items:center;gap:5px;">\n      <span id="icon-gm-el">\n        <svg id="footer-gmail-icon" width="14" height="11" viewBox="52 42 88 66" xmlns="http://www.w3.org/2000/svg"><path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/><path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"/><path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/><path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/><path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/></svg>\n      </span>\n      <span id="r-gmail"></span>\n    </span>\n  </div>\n</div>\n</div>';
if (!document.getElementById('kv-recibo-css')) { const s = document.createElement('style'); s.id = 'kv-recibo-css'; s.textContent = CSS; document.head.append(s); }
// mesma coisa que o applyAll + update de hoje, com a config padrão e a ordem padrão dos blocos
function aplicar(r, cfg) {
  r.style.setProperty('--r-primary', cfg.primary); r.style.setProperty('--r-loc-bg', cfg.loc);
  r.style.setProperty('--r-bag-bg', cfg.bag_bg); r.style.setProperty('--r-bag-border', cfg.bag_accent); r.style.setProperty('--r-bag-text', adjustColor(cfg.bag_accent, -30));
  r.style.setProperty('--r-info-bg', cfg.info_bg); r.style.setProperty('--r-info-border', cfg.info_border);
  r.style.setProperty('--r-bag-esp-bg', cfg.bagesp_bg); r.style.setProperty('--r-bag-esp-border', cfg.bagesp_border);
  const q = (s) => r.querySelector(s);
  Object.assign(q('#r-nome').style, { fontSize: cfg.nome_size + 'px', color: cfg.primary }); q('#r-nome').textContent = cfg.nome;
  Object.assign(q('#r-slogan').style, { fontSize: cfg.slogan_size + 'px', color: cfg.slogan_color, borderColor: cfg.slogan_border, display: 'inline-block' }); q('#r-slogan').textContent = cfg.slogan;
  q('#r-tel-num').textContent = cfg.tel; q('#r-ig-handle').textContent = cfg.ig; q('#r-tel-row').style.fontSize = cfg.tel_size + 'px';
  q('#r-cnpj').textContent = cfg.cnpj; Object.assign(q('#r-cnpj').style, { color: cfg.cnpj_color, fontSize: cfg.cnpj_size + 'px' });
  Object.assign(q('#r-rodape-el').style, { fontSize: cfg.rodape_size + 'px', color: cfg.rodape_color }); q('#r-rodape').textContent = cfg.rodape; q('#r-gmail').textContent = cfg.gmail;
  if (DEFAULT_LOGO) q('#logo-img-wrap').innerHTML = `<img src="${DEFAULT_LOGO}" style="width:${cfg.logo_size}px;height:${cfg.logo_size}px;">`;
  // valor e pagamento: o sistema pode trocar esses dois blocos por um bloco só (KVRecibo.pagamento), com os dados do recebimento (D.pag)
  const pag = window.KVRecibo.pagamento && D.pag ? [() => window.KVRecibo.pagamento(D, cfg)] : [htmlValor, htmlPagamento];
  q('#r-corpo').innerHTML = [htmlPassageiros, htmlLocalizador, htmlTrechos, htmlBagGeral, htmlHospedagens, htmlInfo, ...pag].map((f) => f(cfg)).join('');
}
function montar(el, dados, celular) {
  D = dados; el.innerHTML = MOLDE; const r = el.querySelector('#recibo');
  r.classList.toggle('modo-celular', !!celular); aplicar(r, CFG_DEFAULT); return r;
}
// igual ao exportarPDF de hoje (escala 2, largura 210 mm ou 103 mm no celular, altura que couber, nome com os localizadores);
// desenha uma cópia fora da tela, sem a redução da prévia
async function pdf(dados, celular) {
  const fora = document.createElement('div'); fora.style.cssText = 'position:fixed;left:-10000px;top:0;';
  document.body.append(fora);
  try {
    const recibo = montar(fora, dados, celular);
    await document.fonts.ready;
    const canvas = await html2canvas(recibo, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const pxToMm = 0.264583, larguraMm = celular ? 103 : 210;
    const alturaCanvas = canvas.height / 2, larguraCanvas = canvas.width / 2;
    const alturaMm = alturaCanvas * pxToMm * (larguraMm / (larguraCanvas * pxToMm));
    const doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: [larguraMm, alturaMm] });
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, larguraMm, alturaMm);
    const partes = ['Recibo K&V']; if (D.locGeral) partes.push(D.locGeral.trim()); D.trechos.forEach((t) => { if (t.locEsp) partes.push(t.locEsp.trim()); });
    doc.save(`${partes.join(' - ').replace(/[\/\\:*?"<>|]/g, '').trim()}.pdf`);
  } finally { fora.remove(); }
}
// dados da empresa que vêm do banco: entram por cima da config padrão
function empresa(e) {
  e = e || {};
  ['tel', 'ig', 'cnpj', 'gmail'].forEach((k) => { CFG_DEFAULT[k] = e[k] || ''; });
  DEFAULT_LOGO = e.logo || '';
}
window.KVRecibo = Object.assign(window.KVRecibo || {}, { montar, pdf, empresa });
})();

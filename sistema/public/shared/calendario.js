/* Calendário em popup pra escolher os dias de um trecho (parecido com o da Smiles): dois meses lado a lado (um no celular).
   Arrastar de um dia a outro marca o período (de/até); tocar num dia marca ou tira só ele. Dá pra misturar os dois.
   KVCalendario.abrir({ dias, min, titulo, sub, max, aoPronto(dias) }): dias = ['AAAA-MM-DD', ...]; aoPronto recebe a lista nova, em ordem.
   Precisa de orc.js antes. */
(function () {
  const O = KVOrc, { esc } = KVOrc;
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const mais = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return O.isoDia(d); };
  const entre = (a, b) => { const [i, f] = a <= b ? [a, b] : [b, a], l = []; for (let d = i; d <= f; d = mais(d, 1)) l.push(d); return l; };

  let dlg = null;
  function abrir({ dias = [], min = '', titulo = 'Dias', sub = '', max = 32, aoPronto }) {
    if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'janela cal-dlg'; dlg.setAttribute('aria-label', 'Escolher os dias'); document.body.append(dlg); }
    let sel = new Set(dias), aviso = '';
    const base = (dias.slice().sort()[0] || O.isoDia(new Date())).slice(0, 7) + '-01';
    let mes0 = base < (min || '').slice(0, 7) + '-01' ? (min.slice(0, 7) + '-01') : base;
    const mesMais = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + n, 1); return O.isoDia(d); };

    const classe = (d) => {
      if (!sel.has(d)) return '';
      const a = sel.has(mais(d, -1)), p = sel.has(mais(d, 1));
      return a && p ? 'sel meio' : a ? 'sel fim' : p ? 'sel ini' : 'sel so';
    };
    function mesHtml(m1) {
      const d0 = new Date(m1 + 'T12:00:00'), vazios = d0.getDay(), n = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
      const cel = Array.from({ length: vazios }, () => '<span></span>').join('') + Array.from({ length: n }, (_, k) => {
        const d = `${m1.slice(0, 8)}${String(k + 1).padStart(2, '0')}`, off = min && d < min, hoje = d === O.isoDia(new Date());
        return `<button type="button" class="cal-d ${classe(d)} ${hoje ? 'hoje' : ''}" data-d="${d}" ${off ? 'disabled' : ''} aria-pressed="${sel.has(d)}" aria-label="${k + 1} de ${MESES[d0.getMonth()].toLowerCase()}"><span>${k + 1}</span></button>`;
      }).join('');
      return `<section class="cal-mes"><h3>${MESES[d0.getMonth()]} <span>${d0.getFullYear()}</span></h3>
        <div class="cal-sem">${SEMANA.map((s) => `<span>${s}</span>`).join('')}</div><div class="cal-grade">${cel}</div></section>`;
    }
    const resumo = () => (sel.size ? `<b>${esc(O.diasTexto([...sel]))}</b> · ${sel.size} ${sel.size > 1 ? 'dias' : 'dia'}` : '<span class="faint">Nenhum dia marcado</span>');
    function desenhar() {
      const podeVoltar = !min || mesMais(mes0, -1) >= min.slice(0, 7) + '-01' || mesMais(mes0, -1).slice(0, 7) === min.slice(0, 7);
      dlg.innerHTML = `<header><div style="flex:1"><h2>${esc(titulo)}</h2><div class="sub">${esc(sub) || 'Arraste pra marcar um período; toque num dia pra marcar ou tirar só ele'}</div></div>
          <button type="button" class="btn icone" data-cal="fechar" aria-label="Fechar">✕</button></header>
        <div class="corpo"><div class="cal-nav"><button type="button" class="btn icone fantasma" data-cal="ant" aria-label="Mês anterior" ${podeVoltar ? '' : 'disabled'}>‹</button><button type="button" class="btn icone fantasma" data-cal="prox" aria-label="Próximo mês">›</button></div>
          <div class="cal-meses">${mesHtml(mes0)}${mesHtml(mesMais(mes0, 1))}</div></div>
        <footer><span class="cal-res" data-res>${aviso ? `<span style="color:var(--danger)">${esc(aviso)}</span>` : resumo()}</span>
          <span style="display:flex;gap:8px"><button type="button" class="btn" data-cal="limpar" ${sel.size ? '' : 'disabled'}>Limpar</button><button type="button" class="btn primario" data-cal="pronto">Pronto</button></span></footer>`;
    }
    // só troca as classes (sem redesenhar), pra não perder o arrasto no meio
    function pintar() {
      dlg.querySelectorAll('[data-d]').forEach((b) => { const d = b.dataset.d; b.className = `cal-d ${classe(d)} ${d === O.isoDia(new Date()) ? 'hoje' : ''}`; b.setAttribute('aria-pressed', sel.has(d)); });
      const r = dlg.querySelector('[data-res]'); if (r) r.innerHTML = aviso ? `<span style="color:var(--danger)">${esc(aviso)}</span>` : resumo();
      const l = dlg.querySelector('[data-cal="limpar"]'); if (l) l.disabled = !sel.size;
    }
    const tentar = (novo) => { if (novo.size > max) { aviso = `No máximo ${max} dias por trecho.`; return false; } sel = novo; aviso = ''; return true; };

    // arrastar: do dia onde apertou até onde está o dedo/mouse; sem mexer, é um toque (marca ou tira o dia)
    let arrasto = null;
    const diaEm = (e) => { const el = document.elementFromPoint(e.clientX, e.clientY); const b = el && el.closest('[data-d]'); return b && !b.disabled && dlg.contains(b) ? b.dataset.d : null; };
    let noFundo = false;
    dlg.onpointerdown = (e) => {
      noFundo = e.target === dlg;
      const b = e.target.closest('[data-d]'); if (!b || b.disabled || e.button > 0) return;
      e.preventDefault(); try { dlg.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
      arrasto = { ini: b.dataset.d, atual: b.dataset.d, antes: new Set(sel), mexeu: false };
    };
    dlg.onpointermove = (e) => {
      if (!arrasto) return; const d = diaEm(e); if (!d || d === arrasto.atual) return;
      arrasto.atual = d; arrasto.mexeu = true;
      const novo = new Set(arrasto.antes); entre(arrasto.ini, d).filter((x) => !min || x >= min).forEach((x) => novo.add(x));
      if (!tentar(novo)) sel = arrasto.antes;
      pintar();
    };
    const soltar = () => {
      if (!arrasto) return; const a = arrasto; arrasto = null;
      if (!a.mexeu) { const novo = new Set(a.antes); novo.has(a.ini) ? novo.delete(a.ini) : novo.add(a.ini); tentar(novo); }
      pintar();
    };
    dlg.onpointerup = soltar; dlg.onpointercancel = () => { if (arrasto) { sel = arrasto.antes; arrasto = null; pintar(); } };
    dlg.onclick = (e) => {
      // fora do popup só fecha se o clique começou fora (o fim de um arrasto também chega aqui)
      if (e.target === dlg) { if (noFundo) dlg.close(); noFundo = false; return; }
      // teclado (Enter/Espaço num dia) chega como clique sem ponteiro
      const b = e.target.closest('[data-d]');
      if (b && e.detail === 0 && !b.disabled) { const novo = new Set(sel); novo.has(b.dataset.d) ? novo.delete(b.dataset.d) : novo.add(b.dataset.d); tentar(novo); pintar(); return; }
      const c = e.target.closest('[data-cal]'); if (!c) return;
      if (c.dataset.cal === 'fechar') dlg.close();
      if (c.dataset.cal === 'ant' || c.dataset.cal === 'prox') { mes0 = mesMais(mes0, c.dataset.cal === 'ant' ? -1 : 1); desenhar(); dlg.querySelector(`[data-cal="${c.dataset.cal}"]`).focus(); }
      if (c.dataset.cal === 'limpar') { sel = new Set(); aviso = ''; pintar(); }
      if (c.dataset.cal === 'pronto') { dlg.close(); aoPronto([...sel].sort()); }
    };
    desenhar(); dlg.showModal();
    const foco = dlg.querySelector('.cal-d.sel') || dlg.querySelector('.cal-d:not([disabled])'); if (foco) foco.focus();
  }

  window.KVCalendario = { abrir };
})();

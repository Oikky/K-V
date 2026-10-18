/* Tela: Ponto do pesquisador (cronômetro). Endereço: /ponto.html
   Ponto do pesquisador (rodada 6 dos rascunhos, A), gravando no banco: cronômetro ao lado da semana em barras,
     com a jornada de 4h tracejada e a previsão nos dias que faltam. Corrigir um trecho guarda a hora original (o dono vê).
   O estilo desta tela está em telas/ponto.css. */
KVTelas['ponto'] = function () {
  let app = null, pid = null, eu = null;
  const P = KV.ponto, F = P.fmt, brl = KV.ponto.brl;
  let ignorouAviso = false, ocupado = false;
  // grava no servidor; se der erro, avisa e redesenha com o que está salvo
  async function fazer(fn) {
    if (ocupado) return; ocupado = true;
    try { await fn(); } catch (e) { KVShell.aviso(e.message, { erro: true }); try { await P.carregar(); } catch (_) {} }
    finally { ocupado = false; render(); }
  }
  const LONGO = 10 * 60; // a partir de 10h ligado, pergunta se esqueceu


  // ---------- estado da tela (vira passo no histórico: voltar desfaz) ----------
  const semanaSel = () => Math.min(0, +(KVShell.param('semana') || 0));
  const diaSel = (s) => { const d = KVShell.param('dia'); return s.dias.find((x) => x.data === d) || s.dias.find((x) => x.hoje) || [...s.dias].reverse().find((x) => x.minutos) || s.dias[0]; };

  // ---------- valores que mudam a cada segundo ----------
  function vivos() {
    const s = P.semana(pid, 0), hoje = s.dias.find((d) => d.hoje), r = P.rodando(pid);
    const v = {
      'hoje-relogio': F.relogio(hoje.minutos), 'hoje-dur': F.dur(hoje.minutos), 'hoje-durc': F.durCurta(hoje.minutos), 'hoje-ganho': brl(hoje.ganho),
      'semana-ganho': brl(s.ganho), 'semana-dur': F.dur(s.minutos), previsao: brl(s.previsao), 'previsao-dur': F.dur(s.minutosPrevistos),
      rail: r ? F.durCurta(P.duracao(r)).replace('min', 'm') : '',
    };
    if (r) { v['trecho-dur'] = F.dur(P.duracao(r)); v['trecho-ganho'] = brl(P.ganhoTrecho(r)); v['trecho-longo'] = F.dur(P.duracao(r)); }
    return { v, s, hoje, r };
  }
  function tick() {
    const { v, s, hoje, r } = vivos();
    document.querySelectorAll('[data-vivo]').forEach((el) => { if (v[el.dataset.vivo] != null) el.textContent = v[el.dataset.vivo]; });
    document.querySelectorAll('[data-relogio]').forEach((el) => { const [hm, ss] = splitRelogio(hoje.minutos); el.innerHTML = `${hm}<span class="segs">:${ss}</span>`; });
    // barra e bloco de hoje crescem com o tempo
    if (r) {
      document.querySelectorAll('[data-barra-hoje]').forEach((el) => el.style.height = alt(hoje.minutos, +el.dataset.escala) + '%');
    }
    if (r && P.duracao(r) >= LONGO && !ignorouAviso && !document.querySelector('.esqueceu')) render();
  }
  const splitRelogio = (min) => { const t = F.relogio(min); return [t.slice(0, -3), t.slice(-2)]; };


  // ---------- peças ----------
  const alt = (min, escala) => Math.min(100, min / escala * 100);
  function relogio({ classe = '', mini = false } = {}) {
    const r = P.rodando(pid), { hoje } = vivos();
    const [hm, ss] = splitRelogio(hoje.minutos);
    const estado = r ? `Trabalhando desde ${F.quando(r.inicio, P.agora())}` : 'Pausado';
    const botao = r
      ? `<button class="btn grande pausar" data-alternar><i data-lucide="pause"></i>Pausar</button>`
      : `<button class="btn grande primario" data-alternar><i data-lucide="play"></i>${hoje.minutos ? 'Voltar a trabalhar' : 'Começar a trabalhar'}</button>`;
    const corpo = `<div class="rel-estado"><span class="pulso"></span>${estado}</div>
      <div class="rel-tempo" data-relogio aria-label="Horas de hoje">${hm}<span class="segs">:${ss}</span></div>`;
    if (mini) return { corpo: `<div class="relogio-mini ${r ? 'rodando' : ''}">${corpo}<div class="rel-sub">hoje · <b data-vivo="hoje-ganho">${brl(hoje.ganho)}</b></div></div>`, botao };
    return `<section class="card relogio ${r ? 'rodando' : ''} ${classe}">${corpo}
      <div class="rel-sub">Hoje você já ganhou <b data-vivo="hoje-ganho">${brl(hoje.ganho)}</b></div>${botao}</section>`;
  }

  function ganhos(s) {
    if (!s.atual) return `<div class="ganhos"><div class="ganho"><div class="rot">Ganho na semana</div><div class="val">${brl(s.ganho)}</div><div class="det">${F.dur(s.minutos)}</div></div>
      <div class="ganho"><div class="rot">Pagamento</div><div class="val" style="font-size:20px;padding-top:4px">${s.pagamento ? `<span class="chip ok">Paga em ${F.dataCurta(new Date(s.pagamento.data + 'T12:00'))}</span>` : '<span class="chip warn">A receber</span>'}</div><div class="det">${s.pagamento ? brl(s.pagamento.valor) : 'o dono ainda vai marcar'}</div></div></div>`;
    return `<div class="ganhos">
      <div class="ganho"><div class="rot">Ganho até agora</div><div class="val" data-vivo="semana-ganho">${brl(s.ganho)}</div><div class="det" data-vivo="semana-dur">${F.dur(s.minutos)}</div></div>
      <div class="ganho previsto"><div class="rot">Até domingo, fazendo ${P.jornada / 60}h por dia</div><div class="val" data-vivo="previsao">${brl(s.previsao)}</div><div class="det"><span data-vivo="previsao-dur">${F.dur(s.minutosPrevistos)}</span> no total · é o máximo, não uma promessa</div></div></div>`;
  }

  function marcaCorrecao(t) {
    if (t.manual) return `<span class="chip teal"><i data-lucide="pencil-line" style="width:13px;height:13px"></i>lançado à mão</span>`;
    if (t.original) return `<span class="chip teal"><i data-lucide="pencil" style="width:13px;height:13px"></i>corrigido</span> <span>antes: ${F.quando(t.original.inicio, t.inicio)} → ${t.original.fim ? F.quando(t.original.fim, t.inicio) : 'ligado'}</span>`;
    return '';
  }
  function trechoLinha(t, ref) {
    const vivo = !t.fim;
    const obs = marcaCorrecao(t);
    return `<div class="trecho ${vivo ? 'ao-vivo' : ''}">
      <div class="horas">${vivo ? '<span class="pulso"></span>' : ''}${F.quando(t.inicio, ref)} <span class="seta">→</span> ${vivo ? 'agora' : F.quando(t.fim, ref)}</div>
      <div class="dur" ${vivo ? 'data-vivo="trecho-dur"' : ''}>${F.dur(P.duracao(t))}</div>
      <div class="din" ${vivo ? 'data-vivo="trecho-ganho"' : ''}>${brl(P.ganhoTrecho(t))}</div>
      <button class="btn pequeno fantasma" data-corrigir="${t.id}" aria-label="Corrigir trecho"><i data-lucide="pencil"></i><span class="esconde-cel">Corrigir</span></button>
      ${obs ? `<div class="obs">${obs}</div>` : ''}</div>`;
  }

  function semanasAnteriores(sel) {
    return `<section class="card"><div class="card-topo"><h2>Semanas</h2></div><div class="semanas">
      ${P.semanas(pid, 5).map((s) => {
        const ini = new Date(s.inicio + 'T12:00'), fim = new Date(s.fim + 'T12:00');
        const chip = s.atual ? '<span class="chip">em andamento</span>' : s.pagamento ? `<span class="chip ok">Paga em ${F.dataCurta(new Date(s.pagamento.data + 'T12:00'))}</span>` : s.minutos ? '<span class="chip warn">A receber</span>' : '<span class="chip">sem horas</span>';
        return `<button class="semana-linha" data-ir-semana="${s.offset}" aria-current="${s.offset === sel}">
          <span class="qual">${s.atual ? 'Esta semana' : s.offset === -1 ? 'Semana passada' : `${F.dataCurta(ini)} a ${F.dataCurta(fim)}`}${s.offset >= -1 ? `<small>${F.dataCurta(ini)} a ${F.dataCurta(fim)}</small>` : ''}</span>
          <span class="num h muted">${F.dur(s.minutos)}</span><span class="num"><b>${brl(s.pagamento ? s.pagamento.valor : s.ganho)}</b></span>${chip}</button>`;
      }).join('')}</div></section>`;
  }
  const tituloSemana = (s) => { const i = new Date(s.inicio + 'T12:00'), f = new Date(s.fim + 'T12:00'); return `${s.atual ? 'Esta semana' : s.offset === -1 ? 'Semana passada' : 'Semana'} · ${F.dataCurta(i)} a ${F.dataCurta(f)}`; };
  const navSemana = (s) => `<span class="nav-semana"><button class="btn icone" data-ir-semana="${s.offset - 1}" ${s.offset <= -4 ? 'disabled' : ''} aria-label="Semana anterior"><i data-lucide="chevron-left"></i></button><button class="btn icone" data-ir-semana="${s.offset + 1}" ${s.atual ? 'disabled' : ''} aria-label="Próxima semana"><i data-lucide="chevron-right"></i></button></span>`;

  function avisoEsqueceu() {
    const r = P.rodando(pid);
    if (!r || P.duracao(r) < LONGO || ignorouAviso) return '';
    const ontem = F.isoDia(r.inicio) !== F.isoDia(P.agora());
    return `<div class="esqueceu" role="alert"><i data-lucide="alarm-clock"></i>
      <div class="txt">O cronômetro está ligado desde <b>${ontem ? 'ontem, ' : ''}${F.hora(r.inicio)}</b>, há <b data-vivo="trecho-longo">${F.dur(P.duracao(r))}</b>. Esqueceu de pausar?</div>
      <div class="acoes"><button class="btn primario" data-corrigir="${r.id}"><i data-lucide="pencil"></i>Corrigir a hora que parei</button><button class="btn" data-ainda>Ainda estou trabalhando</button></div></div>`;
  }

  const topo = () => `<div class="topo"><div><h1>Ponto</h1><div class="muted">${eu.nome.replace(/</g, '&lt;')} · ${P.valorHora(pid) ? `${brl(P.valorHora(pid))} por hora` : 'o dono ainda vai definir o valor da hora'}</div></div>${dono ? '<div class="acoes"><a class="btn" href="folha.html"><i data-lucide="users"></i>Folha</a></div>' : ''}</div>`;

  // ---------- variações ----------
  const variantes = {
    // A: cronômetro fixo ao lado; a semana em barras com a jornada de 4h tracejada e a previsão nos dias que faltam
    A() {
      const s = P.semana(pid, semanaSel()), d = diaSel(s);
      const escala = Math.max(6 * 60, ...s.dias.map((x) => x.minutos));
      const barras = s.dias.map((x) => {
        const fant = s.atual && (x.hoje || x.futuro);
        return `<button class="col ${x.hoje ? 'hoje' : ''} ${x.futuro ? 'vazio' : ''}" ${x.futuro ? 'disabled' : `data-dia="${x.data}"`} aria-pressed="${x.data === d.data}" aria-label="${F.diaSemana(x.date)}: ${F.dur(x.minutos)}">
          <span class="val" ${x.hoje ? 'data-vivo="hoje-durc"' : ''}>${x.futuro ? '' : x.minutos ? F.durCurta(x.minutos) : '—'}</span>
          <span class="trilho">${fant ? `<i class="fant" style="height:${alt(P.jornada, escala)}%"></i>` : ''}<i class="fill" ${x.hoje ? `data-barra-hoje data-escala="${escala}"` : ''} style="height:${alt(x.minutos, escala)}%"></i></span>
          <span class="rot">${F.diaCurto(x.date)}<b>${x.date.getDate()}</b></span></button>`;
      }).join('');
      app.innerHTML = topo() + avisoEsqueceu() + `<div class="a-grid">${relogio()}
        <div class="a-dir">
          <section class="card"><div class="card-topo"><h2>${tituloSemana(s)}</h2><div class="acoes">${navSemana(s)}</div></div>
            ${ganhos(s)}
            <div class="barras"><div class="ref"><i style="bottom:${alt(P.jornada, escala)}%"></i></div>${barras}</div>
            <div class="legenda"><span><i></i>trabalhado</span>${s.atual ? '<span><i class="l-hoje"></i>hoje</span><span><i class="l-fant"></i>jornada de 4h (previsão)</span>' : ''}</div></section>
          <section class="card"><div class="card-topo"><h2>${d.hoje ? 'Hoje' : F.diaSemana(d.date)}, ${F.dataCurta(d.date)}</h2><span class="muted num" ${d.hoje ? 'data-vivo="hoje-dur"' : ''}>${F.dur(d.minutos)}</span>
            <div class="acoes"><button class="btn pequeno" data-lancar="${d.data}"><i data-lucide="plus"></i>Esqueci de ligar</button></div></div>
            <div class="trechos">${d.trechos.length ? d.trechos.map((t) => trechoLinha(t, d.date)).join('') : '<div class="vazio-dia">Nenhum trecho nesse dia.</div>'}</div></section>
          ${semanasAnteriores(s.offset)}
        </div></div>`;
    },

  };

  // ---------- janela: corrigir um trecho ou lançar horas esquecidas ----------
  const dlg = document.createElement('dialog'); dlg.className = 'janela'; document.body.append(dlg);
  const fecharJanela = () => KVShell.desfazer({ janela: 1, trecho: 1, em: 1 }, sincJanela);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); fecharJanela(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fecharJanela(); });
  const lerData = (d, h) => (d && h ? new Date(`${d}T${h}`) : null);
  const valHora = (d) => (d ? F.hora(d) : '');

  function sincJanela() {
    const j = KVShell.param('janela');
    if (j !== 'corrigir' && j !== 'lancar') { if (dlg.open) dlg.close(); return; }
    const t = j === 'corrigir' ? P.trecho(pid, KVShell.param('trecho')) : null;
    if (j === 'corrigir' && !t) { if (dlg.open) dlg.close(); return; }
    const diaBase = t ? t.inicio : new Date(KVShell.param('em') + 'T12:00');
    const vivo = t && !t.fim;
    const titulo = vivo ? 'Que horas você parou?' : t ? 'Corrigir trecho' : 'Lançar horas esquecidas';
    const sub = t ? `${F.diaSemana(t.inicio)}, ${F.dataCurta(t.inicio)}` : `Pra quando você trabalhou sem ligar o cronômetro`;
    const dIni = F.isoDia(t ? t.inicio : diaBase), dFim = t && t.fim ? F.isoDia(t.fim) : dIni;
    dlg.innerHTML = `<header><div style="flex:1"><h2>${titulo}</h2><div class="sub">${sub}</div></div><button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>
      <div class="corpo">
        <div class="grade-hora">
          <div class="grupo">Começou</div>
          <div class="campo"><label for="di">Dia</label><input type="date" id="di" value="${dIni}" max="${F.isoDia(P.agora())}"></div>
          <div class="campo"><label for="hi">Hora</label><input type="time" id="hi" value="${t ? valHora(t.inicio) : ''}"></div>
          <div class="grupo">Parou</div>
          <div class="campo"><label for="df">Dia</label><input type="date" id="df" value="${dFim}" max="${F.isoDia(P.agora())}"></div>
          <div class="campo"><label for="hf">Hora</label><input type="time" id="hf" value="${t && t.fim ? valHora(t.fim) : ''}"></div>
        </div>
        <div class="antes-depois" data-resumo></div>
        <div class="avisos" data-avisos></div>
        <p class="faint" style="font-size:13px;margin:0 0 12px">O dono vai ver que este trecho foi ${t ? 'corrigido, com a hora original' : 'lançado à mão'}.</p>
      </div>
      <footer><button class="btn" data-x>Cancelar</button><button class="btn primario" data-salvar><i data-lucide="check"></i>${t ? 'Salvar correção' : 'Lançar horas'}</button></footer>`;
    const $ = (s) => dlg.querySelector(s);
    const atualizar = () => {
      const ini = lerData($('#di').value, $('#hi').value), fim = lerData($('#df').value, $('#hf').value);
      const avisos = [];
      let ok = !!(ini && fim);
      if (ini && fim && fim <= ini) { avisos.push(['danger', 'A hora que parou precisa ser depois da hora que começou.']); ok = false; }
      if (fim && fim > P.agora()) { avisos.push(['danger', 'A hora que parou não pode ser depois de agora.']); ok = false; }
      if (ok && (fim - ini) / 60000 > 12 * 60) avisos.push(['warn', 'Mais de 12h seguidas. Confere se está certo.']);
      if (ok) P.sobrepoe(pid, t && t.id, ini, fim).forEach((o) => avisos.push(['warn', `Esse horário passa por cima de outro trecho (${F.quando(o.inicio, ini)} → ${o.fim ? F.quando(o.fim, ini) : 'agora'}). As horas contariam duas vezes.`]));
      const min = ok ? (fim - ini) / 60000 : 0;
      const antes = t ? `<div><span class="r">Antes</span><span class="antes num">${F.quando(t.inicio, diaBase)} → ${t.fim ? F.quando(t.fim, diaBase) : 'agora'} · ${F.dur(P.duracao(t))} · ${brl(P.ganhoTrecho(t))}</span></div>` : '';
      const depois = `<div><span class="r">${t ? 'Depois' : 'Vai lançar'}</span><span class="depois num">${ok ? `${F.quando(ini, diaBase)} → ${F.quando(fim, diaBase)} · ${F.dur(min)} · ${brl(min / 60 * P.valorHora(pid, ini))}` : '<span class="faint">preencha as horas</span>'}</span></div>`;
      $('[data-resumo]').innerHTML = antes + depois;
      $('[data-avisos]').innerHTML = avisos.map(([c, m]) => `<div class="aviso ${c}">${m}</div>`).join('');
      $('[data-salvar]').disabled = !ok; $('[data-salvar]').style.opacity = ok ? 1 : .5;
      return { ok, ini, fim };
    };
    dlg.querySelectorAll('input').forEach((i) => i.addEventListener('input', atualizar));
    atualizar();
    dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fecharJanela);
    $('[data-salvar]').onclick = async (e) => {
      const { ok, ini, fim } = atualizar(); if (!ok) return;
      const b = e.currentTarget; b.disabled = true;
      try { if (t) await P.corrigir(pid, t.id, ini, fim); else await P.lancar(pid, ini, fim); fecharJanela(); render(); }
      catch (err) { KVShell.aviso(err.message, { erro: true }); b.disabled = false; }
    };
    if (!dlg.open) dlg.showModal();
    KVShell.icones();
    const foco = vivo ? $('#hf') : !t ? $('#hi') : null; if (foco) foco.focus();
  }

  // ---------- ações ----------
  function ligarEventos() {
  app.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-alternar')) { b.disabled = true; ignorouAviso = false; fazer(() => (P.rodando(pid) ? P.pausar() : P.iniciar())); }
    else if (b.dataset.corrigir) { KVShell.irPara({ janela: 'corrigir', trecho: b.dataset.corrigir }); sincJanela(); }
    else if (b.dataset.lancar) { KVShell.irPara({ janela: 'lancar', em: b.dataset.lancar }); sincJanela(); }
    else if (b.hasAttribute('data-ainda')) { ignorouAviso = true; render(); }
    else if (b.dataset.irSemana != null) { const o = +b.dataset.irSemana; if (o !== semanaSel()) { KVShell.irPara({ semana: o || null, dia: null }); render(); } }
    else if (b.dataset.dia) { if (b.dataset.dia !== KVShell.param('dia')) { KVShell.irPara({ dia: b.dataset.dia }); render(); } }
  });
  }

  function render() { variantes.A(); KVShell.icones(); tick(); }
  // escolhida na rodada 6: cronômetro ao lado da semana (A)
  let dono = false;
  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const [est] = await Promise.all([KVApi.estado(), P.carregar()]);
      dono = est.eu.papel === 'dono' || est.eu.papel === 'admin';
      pid = est.eu.email; eu = P.pesquisador(pid);
      if (!eu) { if (dono) KVRota.trocar('folha.html'); else document.querySelector('.carregando').textContent = 'Seu acesso não tem ponto.'; return; }
      document.querySelector('.carregando').remove();
      app = KVShell.montar('ponto', { dono });
      const rail = document.querySelector('.rail [data-item="ponto"]'); if (rail) rail.insertAdjacentHTML('beforeend', '<span class="rail-cron" data-vivo="rail"></span>');
      ligarEventos();
      render();
      sincJanela();
      setInterval(tick, 1000);
      KVShell.aoVoltar(() => { render(); sincJanela(); });
      // volta pra aba: traz o que mudou (ex.: o dono marcou a semana como paga)
      document.addEventListener('visibilitychange', async () => { if (!document.hidden && !dlg.open && !ocupado) { try { await P.carregar(); render(); } catch (_) {} } });
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.textContent = e.message; }
  })();
};

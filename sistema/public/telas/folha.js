/* Tela: Folha do ponto (pagamento das semanas). Endereço: /folha.html
   Folha do ponto (rodada 6 dos rascunhos, A), lendo e gravando no banco: um cartão por pesquisador, com a semana,
     as correções que ele fez e o que falta pagar. O dono marca a semana como paga e muda o valor da hora. Só o dono.
   O estilo desta tela está em telas/folha.css. */
KVTelas['folha'] = function () {
  let app = null, euPesquiso = false;
  const P = KV.ponto, F = P.fmt, brl = KV.ponto.brl;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function fazer(fn, depois) {
    try { await fn(); if (depois) depois(); } catch (e) { KVShell.aviso(e.message, { erro: true }); try { await P.carregar(); } catch (_) {} }
    render();
  }
  const pagosAgora = new Set(); // pagamentos marcados nesta visita: dá pra desfazer
  const dt = (iso) => new Date(iso + 'T12:00');
  const periodo = (s) => `${F.dataCurta(dt(s.inicio))} a ${F.dataCurta(dt(s.fim))}`;
  const nomeSemana = (s) => s.atual ? 'Esta semana' : s.offset === -1 ? 'Semana passada' : `Semana ${periodo(s)}`;
  const primeiroNome = (p) => p.nome.split(' ')[0];

  function totalAPagar() { return P.aPagar().reduce((t, s) => t + s.ganho, 0); }
  function agoraChip(pid) {
    const r = P.rodando(pid);
    return r ? `<span class="agora on"><span class="pulso"></span>Trabalhando desde ${F.quando(r.inicio, P.agora())} · <span data-vivo-trecho="${pid}">${F.dur(P.duracao(r))}</span></span>`
      : `<span class="agora"><span class="pulso"></span>Pausado</span>`;
  }
  // quanto a correção mudou: positivo = horas cortadas
  function correcaoItem(t) {
    if (t.manual) return `<div class="correcao"><i data-lucide="pencil-line"></i><span class="q">${F.diaCurto(t.inicio)} ${F.dataCurta(t.inicio)} · ${F.hora(t.inicio)} → ${F.hora(t.fim)}</span><span class="dif">+${F.dur(P.duracao(t))}</span>
      <span class="era">Lançado à mão (esqueceu de ligar) em ${F.quando(t.corrigidoEm)}</span></div>`;
    const antes = t.original.fim ? (t.original.fim - t.original.inicio) / 60000 : null;
    const dif = antes != null ? antes - P.duracao(t) : null;
    return `<div class="correcao"><i data-lucide="pencil"></i><span class="q">${F.diaCurto(t.inicio)} ${F.dataCurta(t.inicio)} · ${F.hora(t.inicio)} → ${F.quando(t.fim, t.inicio)}</span><span class="dif">${dif != null ? (dif >= 0 ? '−' : '+') + F.dur(Math.abs(dif)) : ''}</span>
      <span class="era">Estava ${F.quando(t.original.inicio, t.inicio)} → ${t.original.fim ? F.quando(t.original.fim, t.inicio) : 'ligado'} · corrigido em ${F.quando(t.corrigidoEm)}</span></div>`;
  }
  const topo = () => {
    const tot = totalAPagar();
    return `<div class="topo"><div><h1>Folha</h1><div class="muted">Ponto dos pesquisadores · semana de segunda a domingo</div></div>
      <div class="acoes">${euPesquiso ? '<a class="btn" href="ponto.html"><i data-lucide="timer"></i>Meu ponto</a>' : ''}<div class="total-pagar ${tot ? 'tem' : ''}"><div class="rot">A pagar</div><div class="val">${brl(tot)}</div></div></div></div>`;
  };

  const variantes = {
    // A: um cartão por pesquisador, com a semana, as correções e o que falta pagar (bom no celular)
    A() {
      if (!P.pesquisadores.length) { app.innerHTML = topo() + '<div class="card" style="color:var(--text-3)">Ninguém da equipe pesquisa voos ainda.</div>'; return; }
      app.innerHTML = topo() + `<div class="a-grid">${P.pesquisadores.map((p) => {
        const s = P.semana(p.id, 0);
        const aPagar = P.aPagar().filter((x) => x.pid === p.id);
        const pagas = P.semanas(p.id, 5).filter((x) => x.pagamento).slice(0, 3);
        const correcoes = [...s.correcoes, ...aPagar.flatMap((x) => x.correcoes)];
        return `<section class="card pesq">
          <div class="pesq-topo"><div><h2>${esc(p.nome)}</h2>${agoraChip(p.id)}</div>
            <div class="hora-val"><span>${P.valorHora(p.id) ? `<b>${brl(P.valorHora(p.id))}</b> por hora` : '<b style="color:var(--warn)">definir o valor da hora</b>'}</span><button class="btn icone fantasma" data-valor="${esc(p.id)}" aria-label="Mudar valor da hora de ${esc(primeiroNome(p))}"><i data-lucide="pencil"></i></button></div></div>
          <div><div class="bloco-t"><span>Esta semana · ${periodo(s)}</span><span class="faint">parcial</span></div>
            <div class="semana-num"><span class="val" data-vivo-semana="${p.id}">${brl(s.ganho)}</span><span class="det" data-vivo-semana-dur="${p.id}">${F.dur(s.minutos)}</span></div>
            <div class="dias7">${s.dias.map((d) => `<div class="${d.hoje ? 'hoje' : ''} ${d.futuro ? 'futuro' : ''} ${!d.minutos && !d.futuro ? 'zero' : ''} ${d.trechos.some((t) => t.original || t.manual) ? 'corr' : ''}">${F.diaCurto(d.date)}<b ${d.hoje ? `data-vivo-hoje="${p.id}"` : ''}>${d.futuro ? '·' : d.minutos ? F.durCurta(d.minutos) : '—'}</b></div>`).join('')}</div></div>
          ${correcoes.length ? `<div><div class="bloco-t"><span>Correções feitas por ${esc(primeiroNome(p))}</span><span class="faint">${correcoes.length}</span></div>${correcoes.map(correcaoItem).join('')}</div>` : ''}
          <div><div class="bloco-t"><span>Pagamento</span></div>
            ${aPagar.length ? aPagar.map((x) => `<div class="pagar"><div class="q"><b>${nomeSemana(x)}</b><span>${periodo(x)} · ${F.dur(x.minutos)}${x.correcoes.length ? ` · ${x.correcoes.length} correç${x.correcoes.length > 1 ? 'ões' : 'ão'}` : ''}</span></div><span class="v">${brl(x.ganho)}</span><button class="btn primario" data-pagar="${p.id}|${x.inicio}"><i data-lucide="check"></i>Marcar como pago</button></div>`).join('')
              : `<div class="em-dia"><i data-lucide="circle-check"></i>Tudo pago até ${pagas[0] ? F.dataCurta(dt(pagas[0].fim)) : '—'}</div>`}
            <div style="margin-top:10px">${pagas.map((x) => `<div class="paga"><span class="q">${periodo(x)} · ${F.dur(x.minutos)}</span><span class="num">${brl(x.pagamento.valor)}</span><span class="chip ok">Paga em ${F.dataCurta(dt(x.pagamento.data))}</span>${pagosAgora.has(p.id + '|' + x.inicio) ? `<button class="btn pequeno fantasma" data-desfazer="${p.id}|${x.inicio}">Desfazer</button>` : ''}</div>`).join('')}</div></div>
        </section>`;
      }).join('')}</div>`;
    },

  };

  // ---------- janelas: pagar, valor da hora, detalhe da semana ----------
  const dlg = document.createElement('dialog'); dlg.className = 'janela'; document.body.append(dlg);
  const fecharJanela = () => KVShell.desfazer({ janela: 1, alvo: 1 }, sincJanela);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); fecharJanela(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fecharJanela(); });
  const lerBrl = (t) => { const n = +String(t).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'); return isFinite(n) && n > 0 ? n : null; };
  const cabeca = (t, sub) => `<header><div style="flex:1"><h2>${t}</h2><div class="sub">${sub}</div></div><button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>`;

  function sincJanela() {
    const j = KVShell.param('janela'), alvo = KVShell.param('alvo') || '';
    if (j === 'pagar') {
      const [pid, ini] = alvo.split('|'); const p = P.pesquisador(pid);
      const s = P.semanas(pid, 5).find((x) => x.inicio === ini);
      if (!s || s.pagamento) { if (dlg.open) dlg.close(); return; }
      dlg.innerHTML = cabeca('Marcar como pago', `${esc(p.nome)} · ${nomeSemana(s)}`) + `<div class="corpo">
        <div class="resumo-pag"><div><span class="faint">Período</span><b>${periodo(s)}</b></div><div><span class="faint">Horas</span><b class="num">${F.dur(s.minutos)}</b></div><div><span class="faint">Calculado</span><b class="num">${brl(s.ganho)}</b></div></div>
        ${s.correcoes.length ? `<div class="aviso info" style="margin-bottom:14px">${primeiroNome(p)} fez ${s.correcoes.length} correç${s.correcoes.length > 1 ? 'ões' : 'ão'} nessa semana. Confira antes de pagar:</div>${s.correcoes.map(correcaoItem).join('')}<div style="height:14px"></div>` : ''}
        <div class="grade2"><div class="campo"><label for="pv">Valor pago</label><input id="pv" inputmode="decimal" value="${s.ganho.toFixed(2).replace('.', ',')}"></div>
          <div class="campo"><label for="pd">Dia do pagamento</label><input id="pd" type="date" value="${F.isoDia(P.agora())}"></div></div>
        <p class="faint" style="font-size:13px">${primeiroNome(p)} vai ver a semana como paga.</p></div>
        <footer><button class="btn" data-x>Cancelar</button><button class="btn primario" data-ok><i data-lucide="check"></i>Marcar como pago</button></footer>`;
      dlg.querySelector('[data-ok]').onclick = (e) => {
        const v = lerBrl(dlg.querySelector('#pv').value), d = dlg.querySelector('#pd').value;
        if (!v || !d) { dlg.querySelector('#pv').focus(); return; }
        e.currentTarget.disabled = true;
        fazer(() => P.marcarPago(pid, ini, v, d), () => { pagosAgora.add(pid + '|' + ini); fecharJanela(); });
      };
    } else if (j === 'valor') {
      const p = P.pesquisador(alvo); let v = P.valorHora(alvo);
      dlg.innerHTML = cabeca('Valor da hora', esc(p.nome)) + `<div class="corpo">
        <div class="stepper"><button class="btn icone" data-passo="-0.1" aria-label="Diminuir 10 centavos"><i data-lucide="minus"></i></button><input id="vh" inputmode="decimal" aria-label="Valor da hora" value="${v.toFixed(2).replace('.', ',')}"><button class="btn icone" data-passo="0.1" aria-label="Aumentar 10 centavos"><i data-lucide="plus"></i></button></div>
        <p class="muted" style="font-size:14px" data-ex></p>
        <p class="faint" style="font-size:13px">Vale a partir de hoje. As horas já trabalhadas continuam com o valor antigo.</p></div>
        <footer><button class="btn" data-x>Cancelar</button><button class="btn primario" data-ok><i data-lucide="check"></i>Salvar</button></footer>`;
      const inp = dlg.querySelector('#vh');
      const ex = () => { dlg.querySelector('[data-ex]').innerHTML = `4h por dia, 7 dias: até <b>${brl(v * 28)}</b> por semana.`; };
      inp.addEventListener('input', () => { const n = lerBrl(inp.value); if (n) { v = n; ex(); } });
      inp.addEventListener('blur', () => inp.value = v.toFixed(2).replace('.', ','));
      dlg.querySelectorAll('[data-passo]').forEach((b) => b.onclick = () => { v = Math.max(0.1, Math.round((v + +b.dataset.passo) * 100) / 100); inp.value = v.toFixed(2).replace('.', ','); ex(); });
      dlg.querySelector('[data-ok]').onclick = (e) => { if (!v) return; e.currentTarget.disabled = true; fazer(() => P.definirValor(alvo, v), fecharJanela); };
      ex();
    } else if (j === 'semana') {
      const [pid, off] = alvo.split('|'); const p = P.pesquisador(pid); const s = P.semana(pid, +off);
      dlg.innerHTML = cabeca(`${esc(p.nome)}`, `${nomeSemana(s)} · ${periodo(s)}`) + `<div class="corpo">
        <table class="dias-tab"><thead><tr><th>Dia</th><th>Trechos</th><th class="dir">Horas</th><th class="dir">Valor</th></tr></thead><tbody>
          ${s.dias.filter((d) => !d.futuro).map((d) => `<tr><td><b>${F.diaCurto(d.date)}</b> <span class="faint">${F.dataCurta(d.date)}</span></td>
            <td class="${d.trechos.some((t) => t.original || t.manual) ? 'corr' : ''}" style="white-space:normal">${d.trechos.map((t) => `${F.hora(t.inicio)}–${t.fim ? F.hora(t.fim) : 'agora'}`).join(', ') || '<span class="faint">—</span>'}</td>
            <td class="dir num">${d.minutos ? F.durCurta(d.minutos) : '—'}</td><td class="dir num">${d.minutos ? brl(d.ganho) : ''}</td></tr>`).join('')}
          <tr><td colspan="2"><b>Total</b></td><td class="dir num"><b>${F.dur(s.minutos)}</b></td><td class="dir num"><b>${brl(s.ganho)}</b></td></tr></tbody></table>
        ${s.correcoes.length ? `<h3 style="margin:16px 0 8px">Correções</h3>${s.correcoes.map(correcaoItem).join('')}` : ''}
        ${s.pagamento ? `<div class="aviso ok" style="margin:16px 0 8px">Paga em ${F.dataCurta(dt(s.pagamento.data))}: ${brl(s.pagamento.valor)}</div>` : ''}<div style="height:12px"></div></div>
        <footer>${s.pagamento ? `<button class="btn" data-desfazer-j>Desfazer pagamento</button>` : '<span></span>'}
          ${!s.atual && !s.pagamento ? `<button class="btn primario" data-pagar-j><i data-lucide="check"></i>Marcar como pago</button>` : '<button class="btn" data-x>Fechar</button>'}</footer>`;
      const pj = dlg.querySelector('[data-pagar-j]'); if (pj) pj.onclick = () => { KVShell.irPara({ janela: 'pagar', alvo: `${pid}|${s.inicio}` }); sincJanela(); };
      const dj = dlg.querySelector('[data-desfazer-j]'); if (dj) dj.onclick = () => fazer(() => P.desfazerPago(pid, s.inicio), sincJanela);
    } else { if (dlg.open) dlg.close(); return; }
    dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fecharJanela);
    if (!dlg.open) dlg.showModal();
    KVShell.icones();
  }

  function ligarEventos() {
  app.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && b.dataset.pagar) { e.stopPropagation(); KVShell.irPara({ janela: 'pagar', alvo: b.dataset.pagar }); sincJanela(); return; }
    if (b && b.dataset.valor) { KVShell.irPara({ janela: 'valor', alvo: b.dataset.valor }); sincJanela(); return; }
    if (b && b.dataset.desfazer) { const [pid, ini] = b.dataset.desfazer.split('|'); const k = b.dataset.desfazer; fazer(() => P.desfazerPago(pid, ini), () => pagosAgora.delete(k)); return; }
  });
  }

  // horas de quem está trabalhando andam sozinhas
  const andar = () => {
    P.pesquisadores.forEach((p) => {
      const s = P.semana(p.id, 0), r = P.rodando(p.id), hoje = s.dias.find((d) => d.hoje);
      document.querySelectorAll(`[data-vivo-semana="${p.id}"]`).forEach((el) => el.textContent = brl(s.ganho));
      document.querySelectorAll(`[data-vivo-semana-dur="${p.id}"]`).forEach((el) => el.textContent = F.dur(s.minutos));
      document.querySelectorAll(`[data-vivo-hoje="${p.id}"]`).forEach((el) => el.textContent = hoje.minutos ? F.durCurta(hoje.minutos) : '—');
      if (r) document.querySelectorAll(`[data-vivo-trecho="${p.id}"]`).forEach((el) => el.textContent = F.dur(P.duracao(r)));
    });
  };

  function render() { variantes.A(); KVShell.icones(); }
  // escolhida na rodada 6: um cartão por pesquisador (A)
  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const [est] = await Promise.all([KVApi.estado(), P.carregar()]);
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('ponto.html'); return; }
      euPesquiso = !!P.pesquisador(est.eu.email);
      document.querySelector('.carregando').remove();
      app = KVShell.montar('ponto', { dono: true });
      ligarEventos();
      render();
      sincJanela();
      setInterval(andar, 1000);
      // quem liga e pausa o cronômetro aparece sem recarregar
      setInterval(async () => { if (!document.hidden && !dlg.open) { try { await P.carregar(); render(); } catch (_) {} } }, 60000);
      KVShell.aoVoltar(() => { render(); sincJanela(); });
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.textContent = e.message; }
  })();
};

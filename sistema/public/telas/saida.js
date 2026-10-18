/* Tela: Registrar saída de pontos. Endereço: /saida.html
   Registrar saída de pontos (rodada 5 dos rascunhos, uma forma por tipo), gravando no banco.
     Transferência vira entrada na conta de destino; expiração marca um lote vencido; ajuste acerta o saldo com o do site.
     A emissão não entra aqui: ela nasce no atendimento. ?tipo=transferencia|expiracao|ajuste. Só o dono.
   O estilo desta tela está em telas/saida.css. */
KVTelas['saida'] = function () {
  let app = null, contas = [];
  const { fmt, esc } = KV;
  const nomeConta = (c) => `${esc(c.titular)} · ${KV.programa(c.programaId).nome}`;
  const opcoesConta = (sel, filtro = () => true) => contas.filter(filtro).map((c) => `<option value="${c.id}" ${c.id === +sel ? 'selected' : ''}>${nomeConta(c)} (${fmt.pts(c.saldo)})</option>`).join('');
  const num = (v) => +String(v || '').replace(/\D/g, '') || 0;
  const TIPOS = [
    { id: 'transferencia', nome: 'Transferência', icone: 'arrow-left-right', exp: 'Pontos enviados pra outro programa. Vira entrada na conta de destino.' },
    { id: 'expiracao', nome: 'Expiração', icone: 'hourglass', exp: 'Pontos que venceram sem uso.' },
    { id: 'ajuste', nome: 'Ajuste', icone: 'scale', exp: 'Correção quando o saldo do sistema não bate com o do programa.' },
  ];
  // grava, recarrega as contas e mostra o resultado embaixo do formulário
  async function gravar(alvo, acao, dados, texto, contaId, botao) {
    if (botao) botao.disabled = true;
    try {
      await KVApi.acao(acao, dados);
      await KV.carregar(); contas = KV.contas().filter((c) => c.ativa);
      variantes.B(); KVShell.icones();
      app.querySelector('#salvo').innerHTML = `<div class="card"><div class="aviso ok" style="margin:0 0 12px">${texto}</div><a class="btn primario" href="conta.html?id=${contaId}">Ver a conta</a></div>`;
    } catch (e) { KVShell.aviso(e.message, { erro: true }); if (botao) botao.disabled = false; }
  }
  function previaLotes(c, pts) {
    const r = KV.lotesConsumidos(c, pts);
    return `<div class="card"><div class="muted" style="font-size:13px;margin-bottom:6px">Saldo de ${esc(c.titular.split(' ')[0])} na ${KV.programa(c.programaId).nome}</div>
      <div class="de-para num"><span class="de">${fmt.pts(c.saldo)}</span><i data-lucide="arrow-right"></i><span style="${r.falta ? 'color:var(--danger)' : ''}">${fmt.pts(c.saldo - pts)}</span></div>
      ${r.falta ? `<div class="aviso danger" style="margin-top:12px">Faltam ${fmt.pts(r.falta)} pontos: o saldo vai ficar negativo. O sistema deixa registrar, mas confira.</div>` : ''}
      ${pts ? `<h3 style="margin:16px 0 4px">Sai destes lotes</h3><div class="faint" style="font-size:13px;margin-bottom:4px">Primeiro os que vencem antes.</div>
        ${r.usados.map((l) => `<div class="lote"><span>${fmt.pts(l.usa)} pts<br><span class="faint">${esc(l.origem)}</span></span><span class="faint num">${l.vence ? `vence ${fmt.data(l.vence)}` : ''}</span></div>`).join('')}` : ''}</div>`;
  }

  const variantes = {
    // B: cada tipo com a forma que faz sentido pra ele (abas que entram no histórico)
    B() {
      const tipo = KVShell.param('tipo') || 'transferencia';
      const cab = `<a class="voltar" href="${KVShell.param('conta') ? 'conta.html?id=' + KVShell.param('conta') : 'contas.html'}"><i data-lucide="arrow-left"></i>Voltar</a>
        <div class="topo"><h1>Registrar saída de pontos</h1></div>
        <div class="seg tipo-tabs" role="group" aria-label="Tipo de saída">${TIPOS.map((t) => `<button data-t="${t.id}" aria-pressed="${t.id === tipo}"><i data-lucide="${t.icone}"></i>${t.nome}</button>`).join('')}</div>
        <p class="muted" style="margin:-6px 0 18px">${TIPOS.find((t) => t.id === tipo).exp}</p>`;
      if (tipo === 'transferencia') {
        app.innerHTML = cab + `<div class="ponte">
          <div class="lado-p"><h3>Sai de</h3><div class="campo"><label for="orig">Conta</label><select id="orig">${opcoesConta(KVShell.param('conta') || (contas.find((c) => c.programaId === 'livelo') || contas[0] || {}).id)}</select></div>
            <div class="campo"><label for="pts">Pontos</label><input id="pts" inputmode="numeric" placeholder="ex.: 30.000"></div><div class="muted num" id="saldoO"></div></div>
          <div class="meio"><i data-lucide="arrow-right"></i></div>
          <div class="lado-p"><h3>Chega em</h3><div class="campo"><label for="dest">Conta</label><select id="dest"></select></div>
            <div class="campo"><label for="bon">Bônus (%)</label><input id="bon" inputmode="numeric" value="0"></div>
            <div><div class="faint" style="font-size:13px">Chegam</div><div class="grande num" id="chegam"></div></div></div></div>
          <div class="rodape-form" style="justify-content:flex-start"><button class="btn primario" id="ok"><i data-lucide="check"></i>Registrar transferência</button></div><div id="salvo" style="margin-top:14px;max-width:720px"></div>`;
        const $ = (id) => app.querySelector('#' + id);
        const atual = () => {
          const o = KV.conta($('orig').value); const pts = num($('pts').value);
          const d0 = $('dest').value; $('dest').innerHTML = opcoesConta(d0, (x) => x !== o && x.programaId !== 'livelo');
          $('saldoO').innerHTML = `Saldo ${fmt.pts(o.saldo)} → <b style="${o.saldo - pts < 0 ? 'color:var(--danger)' : ''}">${fmt.pts(o.saldo - pts)}</b>`;
          $('chegam').textContent = fmt.pts(Math.round(pts * (1 + num($('bon').value) / 100))) + ' pts';
        };
        app.querySelectorAll('input, select').forEach((e) => e.addEventListener('input', atual)); atual();
        $('ok').onclick = (e) => {
          const pts = num($('pts').value), d = KV.conta($('dest').value);
          if (!pts) { $('pts').focus(); return; }
          if (!d) { KVShell.aviso('Escolha a conta de destino', { erro: true }); return; }
          const chegam = Math.round(pts * (1 + num($('bon').value) / 100));
          gravar($('salvo'), 'mov.saida', { tipo: 'transferencia', conta: +$('orig').value, destino: d.id, pontos: pts, bonus_pct: num($('bon').value) },
            `Transferência registrada: chegaram ${fmt.pts(chegam)} pts na ${KV.programa(d.programaId).nome} de ${esc(d.titular)}.`, d.id, e.currentTarget);
        };
      } else if (tipo === 'expiracao') {
        const lotes = contas.flatMap((c) => c.lotes.filter((l) => l.vence && KV.diasAte(l.vence) <= 60).map((l) => ({ c, l }))).sort((a, b) => a.l.vence.localeCompare(b.l.vence));
        app.innerHTML = cab + `<div class="card" style="padding:6px 0;max-width:820px">${lotes.map(({ c, l }, i) => { const d = KV.diasAte(l.vence); return `<div class="exp-linha">
            <i data-lucide="hourglass" style="color:var(--warn)"></i><span><b>${fmt.pts(l.resta)} pts</b> · ${nomeConta(c)}<br><span class="faint" style="font-size:13px">${esc(l.origem)} · vence ${fmt.data(l.vence)}</span></span>
            <span class="chip ${d < 0 ? 'danger' : 'warn'}">${d < 0 ? `venceu há ${-d} dias` : `em ${d} dias`}</span>
            <button class="btn" data-exp="${i}">Marcar como expirado</button></div>`; }).join('') || '<p class="muted" style="padding:16px">Nenhum lote vencendo.</p>'}</div>
          <p class="faint" style="font-size:13px">Lotes vencidos ou vencendo em 60 dias, de todas as contas.</p><div id="salvo" style="margin-top:14px;max-width:820px"></div>`;
        app.querySelectorAll('[data-exp]').forEach((b) => b.onclick = (e) => { const { c, l } = lotes[+b.dataset.exp];
          gravar(app.querySelector('#salvo'), 'mov.saida', { tipo: 'expiracao', conta: c.id, pontos: l.resta, lote: l.id, data: l.vence < KV.hoje ? l.vence : KV.hoje },
            `${fmt.pts(l.resta)} pts marcados como expirados na ${KV.programa(c.programaId).nome} de ${esc(c.titular)}.`, c.id, e.currentTarget); });
      } else {
        app.innerHTML = cab + `<div class="card" style="max-width:620px"><div class="grade-campos">
          <div class="campo inteiro"><label for="conta">Conta</label><select id="conta">${opcoesConta(KVShell.param('conta') || (contas[0] || {}).id)}</select></div>
          <div class="campo"><label>Saldo no sistema</label><div class="grande num" id="sist" style="font-size:22px;padding-top:8px"></div></div>
          <div class="campo"><label for="real">Saldo no site do programa hoje</label><input id="real" inputmode="numeric" placeholder="digite o que aparece lá"></div>
          <div class="campo inteiro"><div class="aviso info" id="dif">Digite o saldo que aparece no site e o sistema calcula o ajuste.</div></div>
          <div class="campo inteiro"><label for="motivo">Motivo (opcional)</label><input id="motivo" placeholder="ex.: pontos de bônus que não lançamos"></div></div>
          <div class="rodape-form"><button class="btn primario" id="ok"><i data-lucide="check"></i>Registrar ajuste</button></div></div><div id="salvo" style="margin-top:14px;max-width:620px"></div>`;
        const $ = (id) => app.querySelector('#' + id);
        const atual = () => { const c = KV.conta($('conta').value); $('sist').textContent = fmt.pts(c.saldo); if (!$('real').value) return;
          const d = num($('real').value) - c.saldo;
          $('dif').innerHTML = d === 0 ? 'Bate certinho. Não precisa de ajuste.' : d < 0 ? `O programa tem <b class="num">${fmt.pts(-d)}</b> a menos: registra uma <b>saída</b> de ajuste.` : `O programa tem <b class="num">${fmt.pts(d)}</b> a mais: isso vira uma <b>entrada</b> (bônus), não uma saída.`; };
        app.querySelectorAll('input, select').forEach((e) => e.addEventListener('input', atual)); atual();
        $('ok').onclick = (e) => {
          const c = KV.conta($('conta').value);
          if (!$('real').value.trim()) { $('real').focus(); return; }
          const d = num($('real').value) - c.saldo, motivo = $('motivo').value.trim();
          if (!d) { KVShell.aviso('Bate certinho; não precisa de ajuste'); return; }
          // a mais no programa vira entrada de bônus; a menos, saída de ajuste
          if (d > 0) gravar(app.querySelector('#salvo'), 'mov.entradas', { linhas: [{ conta: c.id, tipo: 'bonus', data: KV.hoje, pontos: d, obs: motivo || 'Ajuste: saldo do programa maior' }] }, `Entrada de ${fmt.pts(d)} pts registrada; o saldo agora bate com o do programa.`, c.id, e.currentTarget);
          else gravar(app.querySelector('#salvo'), 'mov.saida', { tipo: 'ajuste', conta: c.id, pontos: -d, obs: motivo || 'Saldo do programa menor' }, `Ajuste de −${fmt.pts(-d)} pts registrado; o saldo agora bate com o do programa.`, c.id, e.currentTarget);
        };
      }
      app.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { if (b.dataset.t !== tipo) { KVShell.irPara({ tipo: b.dataset.t }); variantes.B(); KVShell.icones(); } });
    },

  };

  // escolhida na rodada 4: uma forma por tipo (B)
  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const est = await KV.carregar();
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      contas = KV.contas().filter((c) => c.ativa);
      document.querySelector('.carregando').remove();
      app = KVShell.montar('contas', { dono: true });
      if (!contas.length) { app.innerHTML = '<a class="voltar" href="contas.html"><i data-lucide="arrow-left"></i>Contas de pontos</a><div class="topo"><h1>Registrar saída de pontos</h1></div><p class="muted">Nenhuma conta cadastrada ainda.</p>'; KVShell.icones(); return; }
      variantes.B(); KVShell.icones();
      KVShell.aoVoltar(() => { variantes.B(); KVShell.icones(); });
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.textContent = e.message; }
  })();
};

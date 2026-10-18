/* Tela: Registrar entrada de pontos. Endereço: /entrada.html
   Registrar entrada (rodada 2 dos rascunhos), gravando no banco: formulário com prévia como padrão,
     com a opção de trocar pra "várias de uma vez" (ex.: todos os clubes do mês). ?modo=uma|varias. Só o dono.
   O estilo desta tela está em telas/entrada.css. */
KVTelas['entrada'] = function () {
  let app = null, contasEmitem = [];
  const { fmt, esc } = KV;
  const params = new URLSearchParams(location.search);
  const opcoesConta = (sel) => contasEmitem.map((c) => `<option value="${c.id}" ${c.id === +sel ? 'selected' : ''}>${esc(c.titular)} · ${KV.programa(c.programaId).nome}</option>`).join('');
  const num = (v) => +String(v || '').replace(/\D/g, '') || 0;
  const centavos = (v) => { const n = +String(v ?? '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); return isFinite(n) && n > 0 ? Math.round(n * 100) : 0; };
  // grava e mostra o resultado no lugar da prévia
  async function gravar(alvo, linhas, botao) {
    if (botao) botao.disabled = true;
    try {
      await KVApi.acao('mov.entradas', { linhas });
      const contaUnica = new Set(linhas.map((l) => l.conta)).size === 1 ? linhas[0].conta : null;
      alvo.innerHTML = `<div class="card"><div class="aviso ok" style="margin:0 0 12px">${linhas.length > 1 ? `${linhas.length} entradas registradas` : 'Entrada registrada'}: +${fmt.pts(linhas.reduce((s, l) => s + l.pontos, 0))} pts.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${contaUnica ? `<a class="btn primario" href="conta.html?id=${contaUnica}">Ver a conta</a>` : '<a class="btn primario" href="contas.html">Ver as contas</a>'}<a class="btn" href="entrada.html${params.get('modo') ? '?modo=varias' : ''}">Registrar outra</a></div></div>`;
      await KV.carregar(); contasEmitem = KV.contas();
    } catch (e) { KVShell.aviso(e.message, { erro: true }); if (botao) botao.disabled = false; }
  }
  const TIPOS = [
    { id: 'clube', icone: 'calendar-sync', exp: 'Pontos da mensalidade do clube do programa.' },
    { id: 'compra', icone: 'shopping-cart', exp: 'Pontos comprados direto no programa.' },
    { id: 'transferencia', icone: 'arrow-left-right', exp: 'Pontos vindos de outro programa, como Livelo → Smiles.' },
    { id: 'cartao', icone: 'credit-card', exp: 'Pontos gerados pelos gastos no cartão.' },
    { id: 'bonus', icone: 'gift', exp: 'Promoção do programa, sem custo.' },
    { id: 'estorno', icone: 'undo-2', exp: 'Pontos que voltaram de uma emissão cancelada.' },
  ];
  const daqui = (meses) => { const d = new Date(KV.hoje + 'T12:00:00'); d.setMonth(d.getMonth() + meses); return KV.isoDia(d); };

  const variantes = {
    // A: um formulário só, com prévia ao lado
    A() {
      if (!contasEmitem.length) { app.innerHTML = '<a class="voltar" href="contas.html"><i data-lucide="arrow-left"></i>Contas de pontos</a><div class="topo"><h1>Registrar entrada de pontos</h1></div><p class="muted">Cadastre uma conta antes. <a href="nova-conta.html" style="color:var(--orange)">Nova conta</a></p>'; return; }
      const contaId = params.get('conta') || contasEmitem[0].id;
      app.innerHTML = `<a class="voltar" href="contas.html"><i data-lucide="arrow-left"></i>Contas de pontos</a>
        <div class="topo"><h1>Registrar entrada de pontos</h1></div>
        <div class="form-dupla"><form class="card" id="f">
          <div class="grade-campos">
            <div class="campo inteiro"><label for="conta">Conta</label><select id="conta">${opcoesConta(contaId)}</select></div>
            <div class="campo"><label for="tipo">Tipo</label><select id="tipo">${TIPOS.map((t) => `<option value="${t.id}">${KV.entradaTipos[t.id].nome}</option>`).join('')}</select></div>
            <div class="campo"><label for="data">Data</label><input id="data" type="date" value="${KV.hoje}"></div>
            <div class="campo"><label for="pontos">Pontos</label><input id="pontos" inputmode="numeric" placeholder="ex.: 2.000"></div>
            <div class="campo" data-so="custo"><label for="custo">Custo (R$)</label><input id="custo" inputmode="decimal" placeholder="ex.: 35,00"></div>
            <div class="campo" data-so="transf"><label for="origem">Veio de</label><select id="origem"><option>Livelo</option><option>Esfera</option><option>Smiles</option><option>Latam Pass</option><option>TudoAzul</option><option>Outro</option></select></div>
            <div class="campo" data-so="transf"><label for="bonus">Bônus da transferência (%)</label><input id="bonus" inputmode="numeric" value="0"></div>
            <div class="campo inteiro" data-so="transf"><span class="ajuda">Transferência de uma conta que já está no sistema (ex.: a Livelo de um titular) se registra pela <a href="saida.html?tipo=transferencia" style="color:var(--orange)">saída</a>: as duas pontas entram juntas.</span></div>
            <div class="campo"><label for="vence">Vence em</label><input id="vence" type="date" value="${daqui(24)}"><span class="ajuda">Cada lote de pontos vence numa data.</span></div>
            <div class="campo inteiro"><label for="obs">Observação (opcional)</label><textarea id="obs" placeholder="ex.: campanha de outubro"></textarea></div>
          </div>
          <div class="rodape-form"><a class="btn" href="contas.html">Cancelar</a><button class="btn primario" type="submit"><i data-lucide="check"></i>Registrar entrada</button></div>
        </form><aside class="previa" id="previa"></aside></div>`;
      const $ = (id) => app.querySelector('#' + id);
      const atualizar = () => {
        const c = KV.conta($('conta').value); const p = KV.programa(c.programaId);
        const tipo = $('tipo').value; const pts = num($('pontos').value);
        const custo = centavos($('custo').value);
        app.querySelectorAll('[data-so="custo"]').forEach((e) => e.classList.toggle('oculto', !KV.entradaTipos[tipo].temCusto));
        app.querySelectorAll('[data-so="transf"]').forEach((e) => e.classList.toggle('oculto', tipo !== 'transferencia'));
        const porMilha = pts && custo && KV.entradaTipos[tipo].temCusto ? Math.round(custo * 1e4 / pts) : null;
        $('previa').innerHTML = `<div class="card"><div class="muted" style="font-size:13px;margin-bottom:6px">Saldo de ${esc(c.titular.split(' ')[0])} na ${p.nome}</div>
          <div class="de-para num"><span class="de">${fmt.pts(c.saldo)}</span><i data-lucide="arrow-right"></i><span>${fmt.pts(c.saldo + pts)}</span></div>
          ${porMilha ? `<div class="estado" style="margin-top:14px">Esta entrada saiu a <b class="num">${fmt.milha(porMilha)}</b> por milha. O valor usado nas cotações da ${p.nome} é <b class="num">${p.valorMilha ? fmt.milha(p.valorMilha) : '—'}</b>.</div>` : ''}</div>`;
        KVShell.icones();
      };
      app.querySelectorAll('input, select').forEach((e) => e.addEventListener('input', atualizar));
      $('f').onsubmit = (e) => {
        e.preventDefault();
        const tipo = $('tipo').value, pts = num($('pontos').value);
        if (!pts) { $('pontos').focus(); $('pontos').style.borderColor = 'var(--danger)'; return; }
        gravar($('previa'), [{ conta: +$('conta').value, tipo, data: $('data').value, pontos: pts, custo: KV.entradaTipos[tipo].temCusto ? centavos($('custo').value) : 0,
          ...(tipo === 'transferencia' ? { origem: $('origem').value, bonus_pct: num($('bonus').value) } : {}), vence: $('vence').value, obs: $('obs').value }], e.submitter);
      };
      atualizar();
    },

    // C: várias entradas de uma vez, como planilha (ex.: todos os clubes do mês)
    C() {
      if (!contasEmitem.length) { app.innerHTML = '<a class="voltar" href="contas.html"><i data-lucide="arrow-left"></i>Contas de pontos</a><div class="topo"><h1>Registrar entradas</h1></div><p class="muted">Cadastre uma conta antes.</p>'; poeAlternancia(); return; }
      let linhas = [{ conta: contasEmitem[0].id, tipo: 'cartao', pontos: '', custo: '', vence: daqui(24) }];
      const desenhar = () => {
        const total = linhas.reduce((s, l) => s + num(l.pontos), 0);
        const custo = linhas.reduce((s, l) => s + (KV.entradaTipos[l.tipo].temCusto ? centavos(l.custo) : 0), 0);
        app.innerHTML = `<a class="voltar" href="contas.html"><i data-lucide="arrow-left"></i>Contas de pontos</a>
          <div class="topo"><div><h1>Registrar entradas</h1><div class="muted">Várias de uma vez. Tab pula de campo; Enter na última coluna cria outra linha.</div></div>
          <div class="acoes"><button class="btn" id="clubes"><i data-lucide="calendar-sync"></i>Puxar os clubes do mês</button></div></div>
          ${linhas.length > 3 ? `<div class="aviso-lote"><i data-lucide="info"></i>${linhas.filter((l) => l.tipo === 'clube').length} clubes puxados com o valor de sempre. Confira os pontos e o custo de cada um antes de registrar.</div>` : ''}
          <div class="tabela-wrap"><table class="lote"><thead><tr><th>Conta</th><th>Tipo</th><th class="dir">Pontos</th><th class="dir">Custo (R$)</th><th>Vence em</th><th></th></tr></thead>
          <tbody>${linhas.map((l, i) => `<tr>
            <td style="min-width:240px"><select data-i="${i}" data-k="conta">${opcoesConta(l.conta)}</select></td>
            <td style="min-width:170px"><select data-i="${i}" data-k="tipo">${TIPOS.map((t) => `<option value="${t.id}" ${t.id === l.tipo ? 'selected' : ''}>${KV.entradaTipos[t.id].nome}</option>`).join('')}</select></td>
            <td><input class="num" data-i="${i}" data-k="pontos" value="${l.pontos}" inputmode="numeric" placeholder="0"></td>
            <td><input class="num" data-i="${i}" data-k="custo" value="${l.custo}" inputmode="decimal" placeholder="${KV.entradaTipos[l.tipo].temCusto ? '0,00' : 'sem custo'}" ${KV.entradaTipos[l.tipo].temCusto ? '' : 'disabled'}></td>
            <td><input data-i="${i}" data-k="vence" type="date" value="${l.vence}"></td>
            <td><button class="btn icone" data-tirar="${i}" aria-label="Tirar linha"><i data-lucide="x"></i></button></td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="2"><button class="btn" id="mais"><i data-lucide="plus"></i>Linha</button></td><td class="dir num">${fmt.pts(total)} pts</td><td class="dir num">${fmt.brl(custo)}</td><td colspan="2"></td></tr></tfoot></table></div>
          <div class="rodape-form" style="justify-content:flex-start"><button class="btn primario" id="ok"><i data-lucide="check"></i>Registrar ${linhas.length} entrada${linhas.length > 1 ? 's' : ''}</button></div>
          <div id="salvo" style="margin-top:14px"></div>`;
        app.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('change', () => { linhas[el.dataset.i][el.dataset.k] = el.value; if (el.dataset.k === 'tipo') desenhar(); }));
        app.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('input', () => { linhas[el.dataset.i][el.dataset.k] = el.value; }));
        app.querySelectorAll('[data-k="vence"]').forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); linhas.push({ ...linhas[linhas.length - 1], pontos: '', custo: '' }); desenhar(); } }));
        app.querySelectorAll('[data-tirar]').forEach((b) => b.onclick = () => { linhas.splice(+b.dataset.tirar, 1); if (!linhas.length) linhas.push({ conta: contasEmitem[0].id, tipo: 'cartao', pontos: '', custo: '', vence: daqui(24) }); desenhar(); });
        app.querySelector('#mais').onclick = () => { linhas.push({ conta: contasEmitem[0].id, tipo: 'cartao', pontos: '', custo: '', vence: daqui(24) }); desenhar(); };
        app.querySelector('#clubes').onclick = () => {
          linhas = contasEmitem.filter((c) => c.clube && c.ativa).map((c) => ({ conta: c.id, tipo: 'clube', pontos: String(c.clube), custo: c.clubeCusto ? (c.clubeCusto / 100).toFixed(2).replace('.', ',') : '', vence: daqui(24) }));
          if (!linhas.length) { KVShell.aviso('Nenhuma conta com clube cadastrado'); linhas = [{ conta: contasEmitem[0].id, tipo: 'cartao', pontos: '', custo: '', vence: daqui(24) }]; }
          desenhar();
        };
        app.querySelector('#ok').onclick = (e) => {
          const validas = linhas.filter((l) => num(l.pontos));
          if (!validas.length) { KVShell.aviso('Preencha os pontos de pelo menos uma linha', { erro: true }); return; }
          gravar(app.querySelector('#salvo'), validas.map((l) => ({ conta: +l.conta, tipo: l.tipo, data: KV.hoje, pontos: num(l.pontos), custo: KV.entradaTipos[l.tipo].temCusto ? centavos(l.custo) : 0, vence: l.vence })), e.currentTarget);
        };
        poeAlternancia();
      };
      desenhar();
    },
  };

  // alternância entre os dois jeitos de registrar (padrão: uma entrada)
  const modoAtual = () => (new URLSearchParams(location.search).get('modo') === 'varias' ? 'varias' : 'uma');
  function poeAlternancia() {
    const modo = modoAtual();
    const topo = app.querySelector('.topo');
    let acoes = topo.querySelector('.acoes');
    if (!acoes) { acoes = document.createElement('div'); acoes.className = 'acoes'; topo.append(acoes); }
    acoes.insertAdjacentHTML('afterbegin', `<div class="seg" role="group" aria-label="Jeito de registrar">
      <button data-modo="uma" aria-pressed="${modo === 'uma'}"><i data-lucide="file-plus"></i>Uma entrada</button>
      <button data-modo="varias" aria-pressed="${modo === 'varias'}"><i data-lucide="sheet"></i>Várias de uma vez</button></div>`);
    acoes.querySelectorAll('[data-modo]').forEach((b) => b.onclick = () => { if (b.dataset.modo !== modo) { KVShell.irPara({ modo: b.dataset.modo === 'uma' ? null : 'varias' }); render(); } });
    KVShell.icones();
  }
  function render() {
    if (modoAtual() === 'varias') variantes.C(); else { variantes.A(); poeAlternancia(); }
  }
  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const est = await KV.carregar();
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      contasEmitem = KV.contas().filter((c) => c.ativa);
      document.querySelector('.carregando').remove();
      app = KVShell.montar('contas', { dono: true });
      render();
      KVShell.aoVoltar(render);
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.textContent = e.message; }
  })();
};

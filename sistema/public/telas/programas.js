/* Tela: Configurações dos programas. Endereço: /programas.html
   Configurações dos programas (B da rodada 5 dos rascunhos: um programa por vez, com − e +), gravando no banco.
     O valor pode ser digitado ou arrastado. Os níveis da Azul abrem numa janela. Só o dono.
   O estilo desta tela está em telas/programas.css. */
KVTelas['programas'] = function () {
  let app = null, progs = [];
  const { fmt, esc } = KV;
  const REGRAS = { ano: 'Zera em 1º de janeiro', janela: 'Cada CPF libera 12 meses após a emissão', manual: 'Troca manual, com 30 dias de carência' };
  const MIN = 0.010, MAX = 0.035;
  // valor da milha na tela em reais (0,0160); no banco, em milionésimos (16000)
  let original = {}, valores = {}, niveis = {}, niveisOriginal = {};
  function lerDoBanco() {
    progs = KV.programas().filter((p) => p.regra !== 'nenhuma');
    original = Object.fromEntries(progs.map((p) => [p.id, { valorMilha: p.valor_milha / 1e6, limite: p.limite, regra: p.regra }]));
    valores = JSON.parse(JSON.stringify(original));
    niveisOriginal = KV.categoriasAzul(); niveis = { ...niveisOriginal };
  }
  const exemploMilhas = { smiles: 60000, latam: 45000, azul: 70000 };
  const mostra = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  // aceita "0,016", "0.016" ou "16" (milheiro: R$ 16 por mil milhas)
  const lerValor = (t) => { const n = +String(t).trim().replace(/^r\$\s*/i, '').replace(',', '.'); if (!isFinite(n) || n <= 0) return null; return n >= 1 ? n / 1000 : n; };
  const custo = (id) => { const c = KV.custoRealPrograma(id); return c ? c / 1e6 : null; };
  const pos = (v) => Math.max(0, Math.min(100, (v - MIN) / (MAX - MIN) * 100));

  function margem(id) {
    const c = custo(id); if (!c) return '';
    const d = valores[id].valorMilha - c; const pct = d / c * 100;
    return `<div class="margem">Custo real médio R$ ${mostra(c)} · <b class="${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '+' : '−'}R$ ${mostra(Math.abs(d))} (${d >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(0)}%)</b></div>`;
  }
  function exemplo(id) {
    return `<div class="exemplo">Uma emissão de <input inputmode="numeric" data-milhas="${id}" value="${fmt.pts(exemploMilhas[id])}" aria-label="Milhas do exemplo"> milhas custa
      <b class="num" data-custo-ex="${id}">${fmt.brl(Math.round(exemploMilhas[id] * valores[id].valorMilha * 100))}</b> + taxa.</div>`;
  }
  function campoValor(id) {
    return `<div class="valor-wrap"><span class="rs">R$</span><input class="valor-in num" data-valor="${id}" inputmode="decimal" value="${mostra(valores[id].valorMilha)}" aria-label="Valor da milha ${KV.programa(id).nome}"></div>`;
  }
  function regua(id) {
    const c = custo(id);
    return `<div class="regua"><input type="range" min="${MIN}" max="${MAX}" step="0.0001" value="${valores[id].valorMilha}" data-regua="${id}" aria-label="Arrastar valor da milha ${KV.programa(id).nome}">
      ${c ? `<span class="marca" style="left:calc(${pos(c)}% - 1px)" title="custo real"></span>` : ''}
      <div class="escala"><span>R$ 0,0100</span>${c ? '<span style="color:var(--teal-soft)">┃ custo real</span>' : ''}<span>R$ 0,0350</span></div></div>`;
  }
  const textoRegra = (id) => `<b>${valores[id].limite} CPFs</b>${id === 'azul' ? ' no nível básico' : ''} · ${REGRAS[valores[id].regra]}`;

  // liga campo digitado ↔ régua ↔ exemplo ↔ margem, sem redesenhar a tela (o foco não pula)
  function ligar(raiz, aoMudar) {
    const atualizarTudo = (id, deOnde) => {
      document.querySelectorAll(`[data-valor="${id}"]`).forEach((e) => { if (e !== deOnde) e.value = mostra(valores[id].valorMilha); });
      document.querySelectorAll(`[data-regua="${id}"]`).forEach((e) => { if (e !== deOnde) e.value = valores[id].valorMilha; });
      document.querySelectorAll(`[data-custo-ex="${id}"]`).forEach((e) => e.textContent = fmt.brl(Math.round(exemploMilhas[id] * valores[id].valorMilha * 100)));
      document.querySelectorAll(`[data-margem="${id}"]`).forEach((e) => e.innerHTML = margem(id));
      document.querySelectorAll(`[data-resumo-valor="${id}"]`).forEach((e) => e.textContent = 'R$ ' + mostra(valores[id].valorMilha));
      aoMudar && aoMudar();
    };
    raiz.querySelectorAll('[data-valor]').forEach((e) => {
      e.addEventListener('input', () => { const v = lerValor(e.value); if (v) { valores[e.dataset.valor].valorMilha = v; atualizarTudo(e.dataset.valor, e); } });
      e.addEventListener('blur', () => { e.value = mostra(valores[e.dataset.valor].valorMilha); });
      e.addEventListener('focus', () => e.select());
      e.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') e.blur(); });
    });
    raiz.querySelectorAll('[data-regua]').forEach((e) => e.addEventListener('input', () => { valores[e.dataset.regua].valorMilha = +(+e.value).toFixed(4); atualizarTudo(e.dataset.regua, e); }));
    raiz.querySelectorAll('[data-milhas]').forEach((e) => e.addEventListener('input', () => { exemploMilhas[e.dataset.milhas] = +e.value.replace(/\D/g, '') || 0; atualizarTudo(e.dataset.milhas, e); }));
    raiz.querySelectorAll('[data-passo]').forEach((b) => b.onclick = () => { const id = b.dataset.id; valores[id].valorMilha = Math.max(0.0001, +(valores[id].valorMilha + +b.dataset.passo).toFixed(4)); atualizarTudo(id); });
    raiz.querySelectorAll('[data-niveis]').forEach((b) => b.onclick = () => { KVShell.irPara({ janela: 'niveis' }); sincJanela(); });
    raiz.querySelectorAll('[data-regras]').forEach((b) => b.onclick = () => { KVShell.irPara({ janela: 'regras', prog: b.dataset.regras }); sincJanela(); });
    raiz.querySelectorAll('[data-limite]').forEach((e) => e.addEventListener('input', () => { valores[e.dataset.limite].limite = +e.value || 0; aoMudar && aoMudar(); }));
    raiz.querySelectorAll('[data-regra]').forEach((e) => e.addEventListener('change', () => { valores[e.dataset.regra].regra = e.value; aoMudar && aoMudar(); }));
  }

  // barra de salvar: aparece quando algo mudou
  function barraSalvar() {
    const mudou = progs.filter((p) => JSON.stringify(valores[p.id]) !== JSON.stringify(original[p.id])).length + (JSON.stringify(niveis) !== JSON.stringify(niveisOriginal) ? 1 : 0);
    let barra = app.querySelector('.barra-salvar');
    if (!mudou) { if (barra) barra.remove(); return; }
    if (!barra) {
      app.insertAdjacentHTML('beforeend', `<div class="barra-salvar"><span data-n></span><span style="display:flex;gap:8px"><button class="btn" data-desfazer>Desfazer</button><button class="btn primario" data-salvar><i data-lucide="check"></i>Salvar</button></span></div><div id="salvo"></div>`);
      barra = app.querySelector('.barra-salvar'); KVShell.icones();
      barra.querySelector('[data-desfazer]').onclick = () => { Object.assign(valores, JSON.parse(JSON.stringify(original))); Object.assign(niveis, niveisOriginal); render(); };
      barra.querySelector('[data-salvar]').onclick = async (e) => {
        const b = e.currentTarget; b.disabled = true;
        const programas = progs.filter((p) => JSON.stringify(valores[p.id]) !== JSON.stringify(original[p.id]))
          .map((p) => ({ id: p.id, valor_milha: Math.round(valores[p.id].valorMilha * 1e6), limite: valores[p.id].limite, regra: valores[p.id].regra }));
        const mudaram = Object.fromEntries(Object.entries(niveis).filter(([k, v]) => niveisOriginal[k] !== v));
        try { await KVApi.acao('config.programas', { programas, niveis: mudaram }); await KV.carregar(); lerDoBanco(); render(); KVShell.aviso('Salvo. As cotações novas usam os valores novos.'); }
        catch (err) { KVShell.aviso(err.message, { erro: true }); b.disabled = false; }
      };
    }
    barra.querySelector('[data-n]').innerHTML = `<b>${mudou} ${mudou > 1 ? 'mudanças' : 'mudança'}</b> <span class="muted">· as cotações novas usam os valores novos</span>`;
  }

  // janela: níveis da Azul, ou regras de beneficiário de um programa
  const dlg = document.createElement('dialog'); dlg.className = 'janela'; document.body.append(dlg);
  const fecharJanela = () => KVShell.desfazer({ janela: 1, prog: 1 }, sincJanela);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); fecharJanela(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fecharJanela(); });
  function sincJanela() {
    const j = KVShell.param('janela');
    if (j === 'niveis') {
      dlg.innerHTML = `<header><div style="flex:1"><h2>Níveis da TudoAzul</h2><div class="sub">Quanto mais alto o nível da conta, mais CPFs ela aceita</div></div><button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>
        <div class="corpo"><table class="niveis"><thead><tr><th>Nível</th><th class="dir">Limite de CPFs</th></tr></thead><tbody>
          ${Object.entries(niveis).map(([k, v]) => `<tr><td><b>${k}</b></td><td class="dir"><input inputmode="numeric" data-nivel="${k}" value="${v}" aria-label="Limite ${k}"></td></tr>`).join('')}</tbody></table>
          <p class="faint" style="font-size:13px">A troca de CPF na Azul é manual e tem 30 dias de carência.</p></div>
        <footer><span class="faint" style="font-size:13px">Voltar ou Esc fecha</span><button class="btn primario" data-x><i data-lucide="check"></i>Pronto</button></footer>`;
      dlg.querySelectorAll('[data-nivel]').forEach((e) => e.addEventListener('input', () => { niveis[e.dataset.nivel] = +e.value || 0; barraSalvar(); }));
    } else if (j === 'regras') {
      const id = KVShell.param('prog');
      dlg.innerHTML = `<header><div style="flex:1"><h2>Beneficiários · ${KV.programa(id).nome}</h2><div class="sub">Quantas pessoas podem voar com cada conta</div></div><button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>
        <div class="corpo" style="display:grid;gap:14px;padding-bottom:16px">
          <div class="campo"><label for="lim">Limite de CPFs por conta${id === 'azul' ? ' (nível básico)' : ''}</label><input id="lim" inputmode="numeric" data-limite="${id}" value="${valores[id].limite}"></div>
          <div class="campo"><label for="reg">Como as vagas voltam</label><select id="reg" data-regra="${id}">${Object.entries(REGRAS).map(([k, t]) => `<option value="${k}" ${k === valores[id].regra ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          ${id === 'azul' ? '<button class="btn" data-niveis-dentro style="justify-self:start"><i data-lucide="layers"></i>Ver os níveis da Azul</button>' : ''}</div>
        <footer><span class="faint" style="font-size:13px">Voltar ou Esc fecha</span><button class="btn primario" data-x><i data-lucide="check"></i>Pronto</button></footer>`;
      ligar(dlg, () => { barraSalvar(); document.querySelectorAll(`[data-texto-regra="${id}"]`).forEach((e) => e.innerHTML = textoRegra(id)); });
      const nd = dlg.querySelector('[data-niveis-dentro]'); if (nd) nd.onclick = () => { KVShell.irPara({ janela: 'niveis', prog: null }); sincJanela(); };
    }
    dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fecharJanela);
    if (j === 'niveis' || j === 'regras') { if (!dlg.open) dlg.showModal(); KVShell.icones(); } else if (dlg.open) dlg.close();
  }

  const topo = (sub) => `<div class="topo"><div><h1>Programas</h1><div class="muted">${sub}</div></div></div>`;
  const variantes = {
    // B: um programa por vez, com botões − e + pra ajuste fino (bom no celular)
    B() {
      const id = KVShell.param('aba') || 'smiles';
      app.innerHTML = topo('Um programa por vez. Use − e + pro ajuste fino, ou toque no valor e digite.') + `
        <div class="seg" role="tablist" aria-label="Configurações" style="margin:0 0 12px"><button role="tab" aria-pressed="true">Programas</button><button role="tab" data-ir="equipe.html" aria-pressed="false">Equipe</button><button role="tab" data-ir="empresa.html" aria-pressed="false">Empresa</button></div>
        <div class="seg" role="tablist" aria-label="Programa" style="margin-bottom:18px">${progs.map((p) => `<button role="tab" data-aba="${p.id}" aria-pressed="${p.id === id}">${p.nome}</button>`).join('')}</div>
        <section class="card painel-um">
          <div><div class="faint" style="font-size:13px;margin-bottom:8px">Valor da milha · ${KV.programa(id).nome}</div>
            <div class="stepper"><button class="btn icone" data-passo="-0.0005" data-id="${id}" aria-label="Diminuir"><i data-lucide="minus"></i></button>
              ${campoValor(id)}<button class="btn icone" data-passo="0.0005" data-id="${id}" aria-label="Aumentar"><i data-lucide="plus"></i></button></div>
            <div data-margem="${id}" style="text-align:center;margin-top:8px">${margem(id)}</div></div>
          ${regua(id)}${exemplo(id)}
          <h3 style="margin-top:6px">Beneficiários</h3>
          <div class="linha-regra"><div class="campo"><label for="lim">Limite de CPFs${id === 'azul' ? ' (nível básico)' : ''}</label><input id="lim" inputmode="numeric" data-limite="${id}" value="${valores[id].limite}"></div>
            <div class="campo"><label for="reg">Como as vagas voltam</label><select id="reg" data-regra="${id}">${Object.entries(REGRAS).map(([k, t]) => `<option value="${k}" ${k === valores[id].regra ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
          ${id === 'azul' ? '<button class="btn" data-niveis style="justify-self:start"><i data-lucide="layers"></i>Ver os níveis da Azul</button>' : ''}
        </section>`;
      app.querySelectorAll('[data-ir]').forEach((b) => { b.onclick = () => KVRota.ir(b.dataset.ir); });
      app.querySelectorAll('[data-aba]').forEach((b) => b.onclick = () => { if (b.dataset.aba !== id) { KVShell.irPara({ aba: b.dataset.aba }); render(); } });
      ligar(app, barraSalvar);
    },
  };

  // escolhida na rodada 5: um programa por vez, com − e + (B)
  function render() { variantes.B(); barraSalvar(); KVShell.icones(); sincJanela(); }
  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const est = await KV.carregar();
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      lerDoBanco();
      document.querySelector('.carregando').remove();
      app = KVShell.montar('config', { dono: true });
      render();
      KVShell.aoVoltar(render);
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.textContent = e.message; }
  })();
};

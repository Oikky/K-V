/* Tela: Novo orçamento. Endereço: /novo-orcamento.html
   Novo orçamento (rodada 8 dos rascunhos), gravando no banco: o dono anota o pedido que chegou pelo WhatsApp.
     Quem pediu (acha o cadastro e pedidos antigos pelo WhatsApp), trechos com janela de 14 dias, passageiros,
     pedido especial (vira item da lista de conferência) e quem pesquisa. Só o dono.
   O estilo desta tela está em telas/novo-orcamento.css. */
KVTelas['novo-orcamento'] = function () {
  const O = KVOrc, { esc, fmt } = KVOrc;
  const ESPECIAIS = ['Só voo direto', 'Até 1 escala', 'Com bagagem despachada', 'Só pontos', 'Saída de manhã'];
  const CONFERENCIA_PADRAO = ['Janela de 14 dias pesquisada', 'Bagagem conferida', 'Link de cada preço', 'Pontos e dinheiro pesquisados'];
  const hoje = O.isoDia(new Date());
  let app = null, est = null, pessoas = [], orcs = [], enviando = false;
  const st = {
    nome: '', whatsapp: '', pessoaId: null, tipo: 'ida-volta',
    trechos: [{ de: 'GRU', para: '', data: '', janela: true }, { de: '', para: 'GRU', data: '', janela: true, espelho: true }],
    pax: { adultos: 1, criancas: 0, bebes: 0 }, especiais: [], obs: '',
    padrao: CONFERENCIA_PADRAO.map((t) => ({ texto: t, on: true })), extras: [], responsavel: '',
  };
  let criado = null, erros = [];
  const mascaraFone = (v) => { const d = v.replace(/\D/g, '').slice(0, 11); if (d.length <= 2) return d.length ? `(${d}` : ''; if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`; return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`; };
  const tira = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const soDig = (s) => String(s || '').replace(/\D/g, '');
  const opAero = (sel) => `<option value="">Escolha</option>` + O.aeroportos.map((a) => `<option value="${a.cod}" ${a.cod === sel ? 'selected' : ''}>${a.cod} · ${esc(a.cidade)}</option>`).join('');
  const pesquisadores = () => est.usuarios.filter((u) => (u.papel === 'pesquisador' || u.pesquisa) && u.ativo !== 0);

  // ida e volta: a volta espelha a ida (até ser mexida)
  function espelhar() {
    if (st.tipo !== 'ida-volta') return;
    const [ida, volta] = st.trechos;
    if (volta.espelho) { volta.de = ida.para; volta.para = ida.de; }
  }

  // ---------- quem pediu: acha cliente e pedidos antigos ----------
  function achados() {
    const dig = soDig(st.whatsapp), nome = tira(st.nome.trim());
    const achadas = pessoas.filter((p) => (dig.length >= 8 && p.whatsapp && p.whatsapp.includes(dig)) || (nome.length >= 3 && tira(p.nome).includes(nome))).slice(0, 3);
    const antigos = dig.length >= 10 ? orcs.filter((o) => o.contato.whatsapp && o.contato.whatsapp === dig) : [];
    if (st.pessoaId) { const p = pessoas.find((x) => x.id === st.pessoaId); return `<div class="achado"><i data-lucide="user-check" style="color:var(--ok)"></i><span class="txt"><b>${esc(p.nome)} está no cadastro</b><span>O orçamento fica ligado a essa pessoa</span></span><button class="btn pequeno" data-desligar>Não é essa pessoa</button></div>` + antigosHtml(antigos); }
    return achadas.map((p) => `<div class="achado"><span class="txt"><b>${esc(p.nome)}</b><span>No cadastro${p.whatsapp ? ` · ${fmt.fone(p.whatsapp)}` : ''}</span></span><button class="btn pequeno" data-usar="${p.id}"><i data-lucide="check"></i>É essa pessoa</button></div>`).join('') + antigosHtml(antigos);
  }
  const antigosHtml = (l) => l.length ? `<div class="achado antigo"><i data-lucide="history" style="color:var(--warn)"></i><span class="txt"><b>Já pediu ${l.length} ${l.length > 1 ? 'vezes' : 'vez'} antes</b><span>${l.map((o) => `#${o.id} ${esc(O.destino(o))} (${O.etapa(o.etapa).nome.toLowerCase()})`).join(' · ')}</span></span></div>` : '';

  function render() {
    if (criado) return renderCriado();
    espelhar();
    const conf = [...st.padrao.filter((c) => c.on).map((c) => c.texto), ...st.especiais, ...st.extras];
    const pq = pesquisadores();
    app.innerHTML = `<a class="voltar" href="orcamentos.html"><i data-lucide="arrow-left"></i>Orçamentos</a>
      <div class="topo"><div><h1 style="font-size:34px;font-weight:600;letter-spacing:-0.02em">Novo orçamento</h1><div class="muted">O pedido que chegou no WhatsApp</div></div></div>
      <div class="form">
        <section class="card"><h2><span class="n">1</span>Quem pediu</h2>
          <div class="duas"><div class="campo ${erros.includes('nome') ? 'erro-campo' : ''}"><label for="nome">Nome</label><input id="nome" autocomplete="off" value="${esc(st.nome)}" placeholder="Como aparece no WhatsApp"></div>
            <div class="campo"><label for="zap">WhatsApp <span class="opc">opcional</span></label><input id="zap" inputmode="tel" value="${esc(st.whatsapp)}" placeholder="(11) 91234-5678"></div></div>
          <div class="achados" data-achados>${achados()}</div></section>

        <section class="card"><h2><span class="n">2</span>Viagem</h2>
          <div class="seg" role="group" aria-label="Tipo de viagem">${[['ida', 'Só ida'], ['ida-volta', 'Ida e volta'], ['varios', 'Vários trechos']].map(([k, t]) => `<button data-tipo="${k}" aria-pressed="${st.tipo === k}">${t}</button>`).join('')}</div>
          <div>${st.trechos.map((t, i) => `<div class="trecho"><span class="n">${i + 1}</span>
            <div class="campo de ${erros.includes('de' + i) ? 'erro-campo' : ''}"><label for="de${i}">De</label><select id="de${i}" data-tr="${i}" data-k="de">${opAero(t.de)}</select></div>
            <div class="campo para ${erros.includes('para' + i) ? 'erro-campo' : ''}"><label for="para${i}">Para</label><select id="para${i}" data-tr="${i}" data-k="para">${opAero(t.para)}</select></div>
            <div class="campo data ${erros.includes('data' + i) ? 'erro-campo' : ''}"><label for="dt${i}">${i === 0 ? 'Dia' : st.tipo === 'ida-volta' ? 'Volta' : 'Dia'}</label><input id="dt${i}" type="date" data-tr="${i}" data-k="data" value="${t.data}" min="${hoje}"></div>
            ${st.tipo === 'varios' && st.trechos.length > 2 ? `<button class="btn icone fantasma rem" data-rem="${i}" aria-label="Tirar trecho ${i + 1}"><i data-lucide="x"></i></button>` : '<span></span>'}
            <label class="jan"><input type="checkbox" data-tr="${i}" data-k="janela" ${t.janela ? 'checked' : ''}>Pesquisar a janela de 14 dias (semana do dia + a seguinte)</label></div>`).join('')}</div>
          ${st.tipo === 'varios' ? '<button class="btn" data-add-trecho style="justify-self:start"><i data-lucide="plus"></i>Outro trecho</button>' : ''}</section>

        <section class="card"><h2><span class="n">3</span>Passageiros</h2>
          <div class="steppers">${[['adultos', 'Adultos', '12 anos ou mais', 1], ['criancas', 'Crianças', '2 a 11 anos', 0], ['bebes', 'Bebês', 'até 2 anos', 0]].map(([k, t, s, min]) => `<div class="step"><span class="r">${t}<small>${s}</small></span>
            <span class="ctl"><button class="btn icone" data-pax="${k}" data-d="-1" ${st.pax[k] <= min ? 'disabled style="opacity:.4"' : ''} aria-label="Menos ${t.toLowerCase()}"><i data-lucide="minus"></i></button><b>${st.pax[k]}</b><button class="btn icone" data-pax="${k}" data-d="1" ${st.pax[k] >= 30 ? 'disabled' : ''} aria-label="Mais ${t.toLowerCase()}"><i data-lucide="plus"></i></button></span></div>`).join('')}</div></section>

        <section class="card"><h2><span class="n">4</span>Pedido especial</h2>
          <div class="chips-ped">${ESPECIAIS.map((e) => `<button class="pilula" data-esp="${e}" aria-pressed="${st.especiais.includes(e)}">${e}</button>`).join('')}</div>
          <div class="campo"><label for="obs">Outro detalhe do pedido <span class="opc">opcional</span></label><textarea id="obs" rows="2" placeholder="Ex.: volta pode ser por Porto; vai com cadeira de rodas">${esc(st.obs)}</textarea></div>
          <span class="faint" style="font-size:13px">O que você marcar aqui entra na lista de conferência do pesquisador e aparece como aviso nas opções que não batem.</span></section>

        <details class="card conf-det" ${st.confAberta ? 'open' : ''}><summary><h2 style="display:inline-flex"><span class="n">5</span>Lista de conferência</h2> <span class="muted" style="font-size:14px">${conf.length} itens · ajustar</span></summary>
          <div class="conf">${st.padrao.map((c, i) => `<label><input type="checkbox" data-padrao="${i}" ${c.on ? 'checked' : ''}><span>${c.texto}</span><span class="tag">padrão</span></label>`).join('')}
            ${st.especiais.map((e) => `<label><input type="checkbox" checked disabled><span>${e}</span><span class="tag">do pedido</span></label>`).join('')}
            ${st.extras.map((e, i) => `<label><input type="checkbox" checked data-extra="${i}"><span>${esc(e)}</span><span class="tag">seu</span></label>`).join('')}</div>
          <div class="conf-add"><input id="item" placeholder="Outro item, ex.: conferir Interline" aria-label="Outro item da lista"><button class="btn" data-add-item><i data-lucide="plus"></i>Pôr</button></div></details>

        <section class="card"><h2><span class="n">6</span>Quem pesquisa</h2>
          <div class="seg" role="group" aria-label="Quem pesquisa">${[['', 'Deixar na fila'], ...pq.map((u) => [u.email, u.nome.split(' ')[0]])].map(([v, t]) => `<button data-resp="${esc(v)}" aria-pressed="${st.responsavel === v}">${esc(t)}</button>`).join('')}</div>
          <span class="faint" style="font-size:13px">${st.responsavel ? `Vai direto pra ${esc((pq.find((u) => u.email === st.responsavel) || {}).nome || '').split(' ')[0]}; o resto da equipe vê que já tem responsável.` : 'Fica na fila de novos; quem pegar primeiro pesquisa.'}</span></section>
      </div>
      <div class="barra-criar"><span class="res" data-res>${resumo()}</span><button class="btn primario" data-criar><i data-lucide="plus"></i>Criar orçamento</button></div>`;
    KVShell.icones();
  }
  function resumo() {
    const t = st.trechos.filter((x) => x.de && x.para);
    const pax = O.fmtPax(st.pax);
    if (erros.length) return `<span style="color:var(--danger)">Falta preencher ${erros.includes('nome') ? 'quem pediu' : 'os trechos'}.</span>`;
    return t.length ? `<b>${t.map((x, i) => (i ? '' : x.de) + ' → ' + x.para).join(' ')}</b> · ${pax}` : `${pax} · escolha os trechos`;
  }

  function validar() {
    erros = [];
    if (st.nome.trim().length < 2) erros.push('nome');
    st.trechos.forEach((t, i) => { if (!t.de) erros.push('de' + i); if (!t.para) erros.push('para' + i); if (!t.data) erros.push('data' + i); });
    return !erros.length;
  }
  function renderCriado() {
    const o = criado, quem = pesquisadores().find((u) => u.email === st.responsavel);
    app.innerHTML = `<a class="voltar" href="orcamentos.html"><i data-lucide="arrow-left"></i>Orçamentos</a>
      <div class="form"><section class="card"><div class="aviso ok" style="font-size:15px"><b>Orçamento #${o.id} criado.</b> ${quem ? `Foi direto pra ${esc(quem.nome.split(' ')[0])}.` : 'Está na fila de novos.'}</div>
        <h2>${esc(O.destino(o))}</h2><div class="muted">${esc(o.contato.nome)} · ${O.rota(o)} · ${O.fmtPax(o.passageiros)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="novo-orcamento.html"><i data-lucide="plus"></i>Criar outro</a><a class="btn" href="orcamento.html?id=${o.id}">Abrir o orçamento</a><a class="btn primario" href="orcamentos.html">Ver a fila</a></div></section></div>`;
    KVShell.icones();
  }

  // ---------- eventos ----------
  function ligarEventos() {
    app.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'nome') { st.nome = t.value; st.pessoaId = null; app.querySelector('[data-achados]').innerHTML = achados(); KVShell.icones(); }
      if (t.id === 'zap') { t.value = mascaraFone(t.value); st.whatsapp = t.value; st.pessoaId = null; app.querySelector('[data-achados]').innerHTML = achados(); KVShell.icones(); }
      if (t.id === 'obs') st.obs = t.value;
      if (t.dataset.tr != null && t.dataset.k === 'data') { st.trechos[+t.dataset.tr].data = t.value; if (erros.length) validar(); app.querySelector('[data-res]').innerHTML = resumo(); }
    });
    app.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.tr != null) {
        const tr = st.trechos[+t.dataset.tr];
        if (t.dataset.k === 'janela') tr.janela = t.checked;
        else if (t.dataset.k === 'de' || t.dataset.k === 'para') { tr[t.dataset.k] = t.value; if (+t.dataset.tr === 1) tr.espelho = false; if (erros.length) validar(); render(); }
      }
      if (t.dataset.padrao != null) { st.padrao[+t.dataset.padrao].on = t.checked; render(); }
      if (t.dataset.extra != null && !t.checked) { st.extras.splice(+t.dataset.extra, 1); render(); }
    });
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.usar) { const p = pessoas.find((x) => x.id === +b.dataset.usar); Object.assign(st, { pessoaId: p.id, nome: p.nome, whatsapp: p.whatsapp ? mascaraFone(p.whatsapp) : st.whatsapp }); render(); }
      else if (b.hasAttribute('data-desligar')) { st.pessoaId = null; render(); }
      else if (b.dataset.tipo) {
        st.tipo = b.dataset.tipo; const t0 = st.trechos[0];
        if (st.tipo === 'ida') st.trechos = [t0];
        if (st.tipo === 'ida-volta') st.trechos = [t0, { de: t0.para, para: t0.de, data: (st.trechos[1] || {}).data || '', janela: true, espelho: true }];
        if (st.tipo === 'varios' && st.trechos.length < 2) st.trechos.push({ de: t0.para, para: '', data: '', janela: true });
        st.trechos.forEach((t) => { if (st.tipo !== 'ida-volta') delete t.espelho; });
        render();
      }
      else if (b.hasAttribute('data-add-trecho')) { const ult = st.trechos[st.trechos.length - 1]; st.trechos.push({ de: ult.para, para: '', data: '', janela: true }); render(); }
      else if (b.dataset.rem != null) { st.trechos.splice(+b.dataset.rem, 1); render(); }
      else if (b.dataset.pax) { st.pax[b.dataset.pax] += +b.dataset.d; render(); }
      else if (b.dataset.esp) { const i = st.especiais.indexOf(b.dataset.esp); i < 0 ? st.especiais.push(b.dataset.esp) : st.especiais.splice(i, 1); render(); }
      else if (b.hasAttribute('data-add-item')) { const v = app.querySelector('#item').value.trim(); if (v) { st.extras.push(v); render(); app.querySelector('#item').focus(); } }
      else if (b.dataset.resp != null) { st.responsavel = b.dataset.resp; render(); }
      else if (b.hasAttribute('data-criar')) {
        if (enviando) return;
        if (!validar()) { render(); const pri = app.querySelector('.erro-campo input, .erro-campo .combo-in'); if (pri) pri.focus(); return; }
        enviando = true; b.disabled = true;
        const dados = {
          contato: { nome: st.nome.trim(), whatsapp: soDig(st.whatsapp) }, pessoaId: st.pessoaId, responsavel: st.responsavel || null,
          trechos: st.trechos.map(({ de, para, data, janela }) => ({ de, para, data, janela })), passageiros: { ...st.pax },
          especiais: st.especiais, observacao: st.obs.trim(),
          conferencia: [...st.padrao.filter((c) => c.on).map((c) => c.texto), ...st.especiais, ...st.extras],
        };
        try { const r = await KVApi.acao('orc.criar', dados); criado = { ...dados, id: r.id }; scrollTo(0, 0); render(); }
        catch (err) { KVShell.aviso(err.message, { erro: true }); b.disabled = false; }
        finally { enviando = false; }
      }
    });
    app.addEventListener('toggle', (e) => { if (e.target.classList && e.target.classList.contains('conf-det')) st.confAberta = e.target.open; }, true);
    app.addEventListener('keydown', (e) => { if (e.target.id === 'item' && e.key === 'Enter') { e.preventDefault(); app.querySelector('[data-add-item]').click(); } });
  }

  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      est = await KVApi.estado();
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      [pessoas, orcs] = await Promise.all([KVApi.pessoas().catch(() => []), KVApi.orcamentos().catch(() => [])]);
      document.querySelector('.carregando').remove();
      app = KVShell.montar('orcamentos', { dono: true });
      ligarEventos();
      render();
    } catch (e) {
      const c = document.querySelector('.carregando'); if (c) c.textContent = e.message;
    }
  })();
};

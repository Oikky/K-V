/* Tela: Novo orçamento. Endereço: /novo-orcamento.html (e /novo-orcamento.html?editar=12 pra mudar o pedido de um orçamento)
   Novo orçamento (rodada 8 dos rascunhos), gravando no banco: o dono anota o pedido que chegou pelo WhatsApp.
     Quem pediu (acha o cadastro e pedidos antigos pelo WhatsApp), trechos com os dias escolhidos num calendário (arrastar = período, tocar = dia solto), passageiros,
     pedido especial (vira item da lista de conferência) e quem pesquisa. Criar: o dono (e quem pesquisa, se liberado em Configurações › Empresa). Editar: todos
     (o mesmo formulário, sem conferência e quem pesquisa, com o "falta perguntar").
   O estilo desta tela está em telas/novo-orcamento.css. */
KVTelas['novo-orcamento'] = function () {
  const O = KVOrc, { esc, fmt } = KVOrc;
  const ESPECIAIS = ['Só voo direto', 'Até 1 escala', 'Com bagagem despachada', 'Só pontos', 'Saída de manhã'];
  const CONFERENCIA_PADRAO = ['Todos os dias pedidos pesquisados', 'Bagagem conferida', 'Link de cada preço', 'Pontos e dinheiro pesquisados'];
  const hoje = O.isoDia(new Date());
  const editar = Number(KVShell.param('editar')) || null;
  let app = null, est = null, pessoas = [], orcs = [], enviando = false;
  const st = {
    nome: '', whatsapp: '', pessoaId: null,
    // roteiros alternativos (A, B...): cada um com o tipo de viagem e os trechos dele
    rots: [{ tipo: 'ida-volta', trechos: [{ de: 'GRU', para: '', data: '' }, { de: '', para: 'GRU', data: '', espelho: true }] }],
    pax: { adultos: 1, criancas: 0, bebes: 0 }, especiais: [], obs: '',
    padrao: CONFERENCIA_PADRAO.map((t) => ({ texto: t, on: true })), extras: [], responsavel: '', faltando: '',
  };
  // edição: o formulário começa com o que está gravado
  const tipoDe = (ts) => ts.length === 1 ? 'ida' : ts.length === 2 && ts[1].de === ts[0].para && ts[1].para === ts[0].de ? 'ida-volta' : 'varios';
  function carregar(o) {
    const rots = O.roteiros(o).map((idx) => { const trechos = idx.map((i) => { const { de, para, data, janela, outrasDatas } = o.trechos[i]; return { de, para, data, janela, outrasDatas: [...outrasDatas] }; }); return { tipo: tipoDe(trechos), trechos }; });
    Object.assign(st, { nome: o.contato.nome, whatsapp: (o.contato.whatsapp || '').length > 11 ? o.contato.whatsapp : mascaraFone(o.contato.whatsapp || ''), pessoaId: o.pessoaId || null, rots, pax: { ...o.passageiros },
      especiais: o.pedido ? o.pedido.split(' · ') : [], obs: o.observacao || '', faltando: (o.faltando || []).join('\n') });
  }
  // dias do trecho: escolhidos no calendário (shared/calendario.js); o primeiro é o "dia" e os outros vão em outrasDatas (até 31)
  const diasDe = (t) => (t.data ? [t.data, ...(t.outrasDatas || [])] : []);
  const diasBotao = (t, id, ri, i) => { const l = diasDe(t);
    return `<button type="button" id="${id}" class="dias-bt ${l.length ? '' : 'vazio'}" data-dias="${ri}|${i}" aria-haspopup="dialog" ${l.length > 1 ? `title="${esc(O.diasTexto(l))}"` : ''}>
      <span>${l.length ? `${O.diaCurto(l[0])} ${O.dataCurta(l[0])}` : 'Escolher'}</span>${l.length > 1 ? `<b>+${l.length - 1}</b>` : ''}<i data-lucide="calendar"></i></button>`; };
  let criado = null, erros = [];
  const mascaraFone = (v) => { const d = v.replace(/\D/g, '').slice(0, 11); if (d.length <= 2) return d.length ? `(${d}` : ''; if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`; return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`; };
  const tira = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const soDig = (s) => String(s || '').replace(/\D/g, '');
  // lugares digitados à mão (fora da lista de aeroportos) ficam guardados neste navegador pra próxima vez
  const LUGARES = 'kv-lugares';
  const extras = () => { try { return JSON.parse(localStorage.getItem(LUGARES)) || []; } catch { return []; } };
  const guardarLugar = (v) => { if (!v || O.aeroportos.some((a) => a.cod === v) || extras().includes(v)) return; try { localStorage.setItem(LUGARES, JSON.stringify([...extras(), v])); } catch {} };
  const opAero = (sel) => `<option value="">Escolha</option>` + O.aeroportos.map((a) => `<option value="${a.cod}" ${a.cod === sel ? 'selected' : ''}>${a.cod} · ${esc(a.cidade)}</option>`).join('')
    + [...new Set([...extras(), ...(sel && !O.aeroportos.some((a) => a.cod === sel) ? [sel] : [])])].map((v) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const pesquisadores = () => est.usuarios.filter((u) => (u.papel === 'pesquisador' || u.pesquisa) && u.ativo !== 0);

  // ida e volta: a volta espelha a ida (até ser mexida)
  function espelhar() {
    st.rots.forEach((r) => {
      if (r.tipo !== 'ida-volta') return;
      const [ida, volta] = r.trechos;
      if (volta.espelho) { volta.de = ida.para; volta.para = ida.de; }
    });
  }
  const trechoDo = (el) => st.rots[+el.dataset.r].trechos[+el.dataset.tr];
  // um roteiro: tipo de viagem e os trechos (ri = 0 pro A, 1 pro B...)
  function roteiroHtml(r, ri) {
    const id = (k, i) => `${k}${ri}_${i}`, err = (k, i) => (erros.includes(id(k, i)) ? 'erro-campo' : '');
    return `<div class="seg" role="group" aria-label="Tipo de viagem${st.rots.length > 1 ? ` do roteiro ${O.letra(ri)}` : ''}">${[['ida', 'Só ida'], ['ida-volta', 'Ida e volta'], ['varios', 'Vários trechos']].map(([k, t]) => `<button data-tipo="${k}" data-r="${ri}" aria-pressed="${r.tipo === k}">${t}</button>`).join('')}</div>
      <div>${r.trechos.map((t, i) => `<div class="trecho"><span class="n">${i + 1}</span>
        <div class="campo de ${err('de', i)}"><label for="${id('de', i)}">De</label><select id="${id('de', i)}" data-r="${ri}" data-tr="${i}" data-k="de" data-livre="sigla">${opAero(t.de)}</select></div>
        <div class="campo para ${err('para', i)}"><label for="${id('para', i)}">Para</label><select id="${id('para', i)}" data-r="${ri}" data-tr="${i}" data-k="para" data-livre="sigla">${opAero(t.para)}</select></div>
        <div class="campo data ${err('data', i)}"><label for="${id('dt', i)}">${i === 0 ? 'Dias' : r.tipo === 'ida-volta' ? 'Volta' : 'Dias'}</label>${diasBotao(t, id('dt', i), ri, i)}</div>
        ${r.tipo === 'varios' && r.trechos.length > 2 ? `<button class="btn icone fantasma rem" data-rem="${ri}|${i}" aria-label="Tirar trecho ${i + 1}"><i data-lucide="x"></i></button>` : '<span></span>'}
        ${(t.outrasDatas || []).length ? `<div class="dias-tudo faint">${esc(O.diasTexto(diasDe(t)))} · ${diasDe(t).length} dias</div>` : ''}</div>`).join('')}</div>
      ${r.tipo === 'varios' ? `<button class="btn" data-add-trecho="${ri}" style="justify-self:start"><i data-lucide="plus"></i>Outro trecho</button>` : ''}`;
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
      <div class="topo"><div><h1 style="font-size:34px;font-weight:600;letter-spacing:-0.02em">${editar ? `Editar o pedido #${editar}` : 'Novo orçamento'}</h1><div class="muted">${editar ? 'Quem pediu, trechos, passageiros e o pedido' : 'O pedido que chegou no WhatsApp'}</div></div></div>
      <div class="form">
        <section class="card"><h2><span class="n">1</span>Quem pediu</h2>
          <div class="duas"><div class="campo ${erros.includes('nome') ? 'erro-campo' : ''}"><label for="nome">Nome</label><input id="nome" autocomplete="off" value="${esc(st.nome)}" placeholder="Como aparece no WhatsApp"></div>
            <div class="campo"><label for="zap">WhatsApp <span class="opc">opcional</span></label><input id="zap" inputmode="tel" value="${esc(st.whatsapp)}" placeholder="(11) 91234-5678"></div></div>
          <div class="achados" data-achados>${achados()}</div></section>

        <section class="card"><h2><span class="n">2</span>Viagem</h2>
          ${st.rots.length > 1 ? `<div class="roteiros">${st.rots.map((r, ri) => `<section class="roteiro-col"><div class="rot-topo"><h3 class="rot-cab"><span class="rot-letra">${O.letra(ri)}</span>Roteiro ${O.letra(ri)}</h3>
            <button class="btn icone fantasma" data-tira-rot="${ri}" aria-label="Tirar o roteiro ${O.letra(ri)}"><i data-lucide="x"></i></button></div>${roteiroHtml(r, ri)}</section>`).join('')}</div>` : roteiroHtml(st.rots[0], 0)}
          ${st.rots.length < 5 ? `<button class="btn" data-add-rot style="justify-self:start"><i data-lucide="split"></i>Outro roteiro</button><span class="faint" style="font-size:13px;margin-top:-6px">${st.rots.length > 1 ? 'Todos os roteiros são pesquisados; na proposta cada um tem as combinações dele.' : 'Pra quando o cliente aceita outro destino ou outra origem, ex.: Lisboa, mas Porto também serve.'}</span>` : ''}</section>

        <section class="card"><h2><span class="n">3</span>Passageiros</h2>
          <div class="steppers">${[['adultos', 'Adultos', '12 anos ou mais', 1], ['criancas', 'Crianças', '2 a 11 anos', 0], ['bebes', 'Bebês', 'até 2 anos', 0]].map(([k, t, s, min]) => `<div class="step"><span class="r">${t}<small>${s}</small></span>
            <span class="ctl"><button class="btn icone" data-pax="${k}" data-d="-1" ${st.pax[k] <= min ? 'disabled style="opacity:.4"' : ''} aria-label="Menos ${t.toLowerCase()}"><i data-lucide="minus"></i></button><b>${st.pax[k]}</b><button class="btn icone" data-pax="${k}" data-d="1" ${st.pax[k] >= 30 ? 'disabled' : ''} aria-label="Mais ${t.toLowerCase()}"><i data-lucide="plus"></i></button></span></div>`).join('')}</div></section>

        <section class="card"><h2><span class="n">4</span>Pedido especial</h2>
          <div class="chips-ped">${[...new Set([...ESPECIAIS, ...st.especiais])].map((e) => `<button class="pilula" data-esp="${e}" aria-pressed="${st.especiais.includes(e)}">${e}</button>`).join('')}</div>
          <div class="campo"><label for="obs">Outro detalhe do pedido <span class="opc">opcional</span></label><textarea id="obs" rows="2" placeholder="Ex.: volta pode ser por Porto; vai com cadeira de rodas">${esc(st.obs)}</textarea></div>
          ${editar ? `<div class="campo"><label for="faltando">Falta perguntar ao cliente <span class="opc">um por linha</span></label><textarea id="faltando" rows="2" placeholder="Ex.: data da volta">${esc(st.faltando)}</textarea></div>` : ''}
          <span class="faint" style="font-size:13px">O que você marcar aqui entra na lista de conferência do pesquisador e aparece como aviso nas opções que não batem.</span></section>
${editar ? '' : `
        <details class="card conf-det" ${st.confAberta ? 'open' : ''}><summary><h2 style="display:inline-flex"><span class="n">5</span>Lista de conferência</h2> <span class="muted" style="font-size:14px">${conf.length} itens · ajustar</span></summary>
          <div class="conf">${st.padrao.map((c, i) => `<label><input type="checkbox" data-padrao="${i}" ${c.on ? 'checked' : ''}><span>${c.texto}</span><span class="tag">padrão</span></label>`).join('')}
            ${st.especiais.map((e) => `<label><input type="checkbox" checked disabled><span>${e}</span><span class="tag">do pedido</span></label>`).join('')}
            ${st.extras.map((e, i) => `<label><input type="checkbox" checked data-extra="${i}"><span>${esc(e)}</span><span class="tag">seu</span></label>`).join('')}</div>
          <div class="conf-add"><input id="item" placeholder="Outro item, ex.: conferir Interline" aria-label="Outro item da lista"><button class="btn" data-add-item><i data-lucide="plus"></i>Pôr</button></div></details>

        <section class="card"><h2><span class="n">6</span>Quem pesquisa</h2>
          <div class="seg" role="group" aria-label="Quem pesquisa">${[['', 'Deixar na fila'], ...pq.map((u) => [u.email, u.nome.split(' ')[0]])].map(([v, t]) => `<button data-resp="${esc(v)}" aria-pressed="${st.responsavel === v}">${esc(t)}</button>`).join('')}</div>
          <span class="faint" style="font-size:13px">${st.responsavel ? `Vai direto pra ${esc((pq.find((u) => u.email === st.responsavel) || {}).nome || '').split(' ')[0]}; o resto da equipe vê que já tem responsável.` : 'Fica na fila de novos; quem pegar primeiro pesquisa.'}</span></section>`}
      </div>
      <div class="barra-criar"><span class="res" data-res>${resumo()}</span><button class="btn primario" data-criar>${editar ? '<i data-lucide="check"></i>Salvar mudanças' : '<i data-lucide="plus"></i>Criar orçamento'}</button></div>`;
    KVShell.icones();
  }
  function resumo() {
    const rotas = st.rots.map((r) => r.trechos.filter((x) => x.de && x.para)).filter((t) => t.length);
    const pax = O.fmtPax(st.pax);
    if (erros.length) return `<span style="color:var(--danger)">Falta preencher ${erros.includes('nome') ? 'quem pediu' : 'os trechos'}.</span>`;
    return rotas.length ? `<b>${rotas.map((t) => t.map((x, i) => (i ? '' : x.de) + ' → ' + x.para).join(' ')).map(esc).join(' ou ')}</b> · ${pax}` : `${pax} · escolha os trechos`;
  }

  function validar() {
    erros = [];
    if (st.nome.trim().length < 2) erros.push('nome');
    st.rots.forEach((r, ri) => r.trechos.forEach((t, i) => { if (!t.de) erros.push(`de${ri}_${i}`); if (!t.para) erros.push(`para${ri}_${i}`); if (!t.data) erros.push(`data${ri}_${i}`); }));
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
      if (t.id === 'faltando') st.faltando = t.value;
    });
    app.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.tr != null) {
        const tr = trechoDo(t);
        if (t.dataset.k === 'de' || t.dataset.k === 'para') { tr[t.dataset.k] = t.value; guardarLugar(t.value); if (+t.dataset.tr === 1) tr.espelho = false; if (erros.length) validar(); render(); }
      }
      if (t.dataset.padrao != null) { st.padrao[+t.dataset.padrao].on = t.checked; render(); }
      if (t.dataset.extra != null && !t.checked) { st.extras.splice(+t.dataset.extra, 1); render(); }
    });
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.usar) { const p = pessoas.find((x) => x.id === +b.dataset.usar); Object.assign(st, { pessoaId: p.id, nome: p.nome, whatsapp: p.whatsapp ? mascaraFone(p.whatsapp) : st.whatsapp }); render(); }
      else if (b.hasAttribute('data-desligar')) { st.pessoaId = null; render(); }
      else if (b.dataset.tipo) {
        const r = st.rots[+b.dataset.r]; r.tipo = b.dataset.tipo; const t0 = r.trechos[0];
        if (r.tipo === 'ida') r.trechos = [t0];
        if (r.tipo === 'ida-volta') r.trechos = [t0, { de: t0.para, para: t0.de, data: (r.trechos[1] || {}).data || '', outrasDatas: [...((r.trechos[1] || {}).outrasDatas || [])], espelho: true }];
        if (r.tipo === 'varios' && r.trechos.length < 2) r.trechos.push({ de: t0.para, para: '', data: '' });
        r.trechos.forEach((t) => { if (r.tipo !== 'ida-volta') delete t.espelho; });
        render();
      }
      else if (b.dataset.addTrecho != null) { const ts = st.rots[+b.dataset.addTrecho].trechos, ult = ts[ts.length - 1]; ts.push({ de: ult.para, para: '', data: '' }); render(); }
      else if (b.dataset.rem != null) { const [ri, i] = b.dataset.rem.split('|').map(Number); st.rots[ri].trechos.splice(i, 1); render(); }
      else if (b.dataset.dias) {
        const [ri, i] = b.dataset.dias.split('|').map(Number), r = st.rots[ri], tr = r.trechos[i];
        const nome = `${tr.de || '?'} → ${tr.para || '?'}`;
        KVCalendario.abrir({ dias: diasDe(tr), min: editar ? '' : hoje, titulo: i && r.tipo === 'ida-volta' ? `Volta · ${nome}` : `Dias · ${nome}`,
          aoPronto: (l) => { tr.data = l[0] || ''; tr.outrasDatas = l.slice(1); if (erros.length) validar(); render(); app.querySelector(`[data-dias="${ri}|${i}"]`).focus(); } });
      }
      // outro roteiro começa igual ao A, só sem o destino da ida (a volta acompanha)
      else if (b.hasAttribute('data-add-rot')) {
        const a = st.rots[0], trechos = a.trechos.map((t) => ({ ...t, outrasDatas: [...(t.outrasDatas || [])] }));
        trechos[0].para = ''; if (a.tipo === 'ida-volta') trechos[1].espelho = true;
        st.rots.push({ tipo: a.tipo, trechos }); erros = []; render();
        const sel = app.querySelector(`#para${st.rots.length - 1}_0-busca`); if (sel) sel.focus();
      }
      else if (b.dataset.tiraRot != null) { st.rots.splice(+b.dataset.tiraRot, 1); erros = []; render(); }
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
          trechos: st.rots.flatMap((r, ri) => r.trechos.map((t) => ({ de: t.de, para: t.para, data: t.data, janela: !!t.janela && !(t.outrasDatas || []).length, outrasDatas: t.outrasDatas || [], roteiro: ri }))), passageiros: { ...st.pax },
          especiais: st.especiais, observacao: st.obs.trim(),
          conferencia: [...st.padrao.filter((c) => c.on).map((c) => c.texto), ...st.especiais, ...st.extras],
        };
        if (editar) dados.faltando = st.faltando.split('\n').map((x) => x.trim()).filter(Boolean);
        try {
          if (editar) { await KVApi.acao('orc.editar', { ...dados, id: editar }); KVShell.aviso('Pedido salvo'); KVRota.trocar(`orcamento.html?id=${editar}`); return; }
          const r = await KVApi.acao('orc.criar', dados); criado = { ...dados, id: r.id }; scrollTo(0, 0); render();
        }
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
      const dono = est.eu.papel === 'dono' || est.eu.papel === 'admin';
      if (!est.podeCriar && !editar) { KVRota.trocar('orcamentos.html'); return; }
      [pessoas, orcs] = await Promise.all([dono ? KVApi.pessoas().catch(() => []) : [], KVApi.orcamentos().catch(() => [])]);
      if (editar) { const o = await KVApi.orcamento(editar); if (!o) throw new Error('Orçamento não encontrado'); carregar(o); }
      document.querySelector('.carregando').remove();
      app = KVShell.montar('orcamentos', { dono });
      ligarEventos();
      render();
    } catch (e) {
      const c = document.querySelector('.carregando'); if (c) c.textContent = e.message;
    }
  })();
};

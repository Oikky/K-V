/* Tela: Fechamento (aceita, quem paga, quem voa, recebimento). Endereço: /fechamento.html
   Fechamento (rodada 9 dos rascunhos), lendo e gravando no banco: a pessoa aceitou. O dono marca qual combinação, quem paga
     (vira cliente), quem voa (cadastro único pelo CPF) e o recebimento. Tudo se salva sozinho; nada trava: dá pra fechar faltando
     passageiro e completar depois. Só o dono.
   O estilo desta tela está em telas/fechamento.css. */
KVTelas['fechamento'] = function () {
  const O = KVOrc, P = KVProp, { esc, fmt } = KVOrc;
  const id = Number(KVShell.param('id'));
  let o = null, app = null, pessoas = [], juntos = [], N = 0, preencheu = false;
  const lerNum = (t) => O.lerReais(t) || 0;
  const numCampo = (c) => (c ? (c / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '');
  const hora = (x) => `${x.sai} → ${x.chega.replace(/ \+\d$/, '')}${/\+\d$/.test(x.chega) ? `<sup>${x.chega.slice(-2)}</sup>` : ''}`;
  const fechado = () => !['pesquisado', 'enviado'].includes(o.etapa);
  const emitido = () => o.etapa === 'emitido';
  const pessoa = (pid) => pessoas.find((p) => p.id === pid);
  const iniciais = (n) => n.split(' ').filter((x) => x.length > 2).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  const cpfFmt = (c) => (c ? KVPessoaForm.mascaraCpf(c) : 'sem CPF');

  // ---------- salvar sozinho (igual à proposta) ----------
  let timer = null, salvando = null, sujo = false;
  const dados = () => ({ id: o.id, aceita: o.aceita, cliente: o.clienteId, passageiros: o.passageirosIds, forma: o.receb.forma, parcelas: o.receb.forma === 'parcelado' ? o.receb.parcelas : null, recebido: o.receb.recebido || 0 });
  function marcarSujo() { sujo = true; clearTimeout(timer); timer = setTimeout(salvar, 700); }
  async function salvar() {
    clearTimeout(timer);
    if (salvando) { await salvando; if (!sujo) return; }
    if (!sujo) return;
    sujo = false;
    salvando = KVApi.acao('fech.salvar', dados(), { quieto: true })
      .catch(async (e) => { KVShell.aviso(e.message, { erro: true }); await recarregar(); render(); })
      .finally(() => { salvando = null; });
    await salvando;
    if (sujo) return salvar();
  }
  addEventListener('beforeunload', (e) => { if (sujo || salvando) { salvar(); e.preventDefault(); } });
  async function recarregar() {
    o = await KVApi.orcamento(id);
    N = O.total(o);
    // o que dá pra preencher sozinho: a combinação, se só tem uma, e quem paga, se o contato já é cliente
    preencheu = false;
    if (o.aceita == null && o.combos.length === 1 && !fechado()) { o.aceita = o.combos[0].id; preencheu = true; }
    if (o.clienteId == null && o.pessoaId && !fechado()) { o.clienteId = o.pessoaId; preencheu = true; }
    o.passageirosIds = o.passageirosLista.map((p) => p.id);
    o.receb = { forma: o.receb.forma || 'pix', parcelas: o.receb.parcelas || (P.aceita(o) || {}).vezes || P.vezesPadrao, recebido: o.receb.recebido || 0 };
  }
  async function carregarJuntos() { juntos = o.clienteId ? await KVApi.juntos(o.clienteId).catch(() => []) : []; }

  // ---------- topo ----------
  function topo() {
    const cidades = [o.trechos[0].de, ...o.trechos.map((t) => t.para)].map(O.cidadeCurta);
    return `<a class="voltar" href="orcamentos.html"><i data-lucide="arrow-left"></i>Orçamentos</a>${O.trilha(o, 'fechamento')}
      <div class="topo-orc"><span class="quem">${esc(o.contato.nome)}${o.contato.whatsapp ? ` · ${fmt.fone(o.contato.whatsapp)}` : ''} · #${o.id}</span>
        <h1 style="--n:${cidades.join(' → ').length}">${cidades.map(esc).join(' <span class="seta">→</span> ')}</h1></div>
      ${o.etapa === 'pesquisado' ? '<div class="aviso warn" style="margin-top:12px">A proposta ainda não foi marcada como enviada. Dá pra fechar mesmo assim.</div>' : ''}
      ${fechado() ? `<div class="aviso ok aviso-acoes" style="margin-top:12px"><span>Orçamento ${o.etapa === 'cancelado' ? 'cancelado' : 'fechado'}. Passageiros e recebimento ainda podem ser completados aqui.</span>
        <span class="acoes">${o.etapa === 'fechado' && !o.emissoes.length ? '<button class="btn pequeno" data-reabrir><i data-lucide="undo-2"></i>Desfazer fechamento</button>' : ''}<a class="btn pequeno" href="emissao.html?id=${o.id}">Ir pra emissão<i data-lucide="arrow-right"></i></a></span></div>` : ''}`;
  }
  const cabSecao = (n, titulo, feito, extra = '') => `<div class="secao"><span class="passo-n ${feito ? 'ok' : ''}">${feito ? '<i data-lucide="check"></i>' : n}</span><h2>${titulo}</h2>${extra}</div>`;

  // ---------- 1 · qual ela aceitou ----------
  function aceitou() {
    if (!o.combos.length) return cabSecao(1, 'Qual ela aceitou?', false) + `<div class="vazio">A proposta ainda não tem combinação. <a href="proposta.html?id=${o.id}" style="color:var(--orange)">Montar a proposta</a></div>`;
    return cabSecao(1, 'Qual ela aceitou?', !!o.aceita) + `<div class="grade-ref" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))">${o.combos.map((c, i) => {
      const sel = o.aceita === c.id;
      return `<button class="cartao-ref escolha ${sel ? 'cheio' : ''}" data-aceita="${c.id}" aria-pressed="${sel}" ${fechado() ? 'disabled' : ''}>
        <span class="grande"><span class="nro">${i + 1}</span>${esc(c.nome)}<span class="marca">${sel ? '<i data-lucide="check"></i>' : ''}</span></span>
        ${P.opsDaCombo(o, c).map((x) => `<span class="tr"><span><small>${P.nomeTrecho(o, x.trecho)} · ${P.diaSem(x.data)} ${O.dataCurta(x.data)} · <span class="sitio" data-s="${esc(x.site)}">${esc(x.site)}</span></small><b>${hora(x)}</b></span></span>`).join('')}
        <span class="preco"><b>${fmt.brl(P.venda(o, c))}</b><span>${c.parcelado ? `ou ${fmt.brl(c.parcelado)} em ${c.vezes}x` : 'à vista'}</span></span></button>`;
    }).join('')}</div>`;
  }

  // ---------- 2 e 3 · pessoas ----------
  function linhaPessoa(p, { tirar, papel } = {}) {
    const avisos = [];
    if (O.internacional(o)) {
      if (!p.passaporte_numero || !p.passaporte_validade) avisos.push('sem passaporte no cadastro');
      else { const folga = Math.round((new Date(p.passaporte_validade + 'T12:00') - new Date(o.trechos[0].data + 'T12:00')) / 864e5); if (folga < 180) avisos.push(folga < 0 ? 'passaporte vence antes do voo' : 'passaporte vence menos de 6 meses depois'); }
    }
    return `<div class="vaga"><span class="ava">${esc(iniciais(p.nome))}</span><span class="txt"><b>${esc(p.nome)}</b>
      <span class="${avisos.length ? 'alerta' : ''}">${avisos.length ? avisos.join(' · ') : [papel, cpfFmt(p.cpf)].filter(Boolean).join(' · ')}</span></span>
      ${tirar ? `<button class="btn icone fantasma" ${tirar} aria-label="Tirar ${esc(p.nome)}"><i data-lucide="x"></i></button>` : ''}</div>`;
  }
  const opcoesPessoas = (excluir = []) => `<option value="">Buscar por nome ou CPF</option>${pessoas.filter((p) => !excluir.includes(p.id)).map((p) => `<option value="${p.id}">${esc(p.nome)} · ${cpfFmt(p.cpf)}</option>`).join('')}`;
  function quemPaga() {
    const c = o.clienteId && pessoa(o.clienteId);
    const corpo = c ? `<div class="pessoas">${linhaPessoa(c, { tirar: fechado() ? '' : 'data-tira-cliente', papel: juntos.length ? 'cliente' : 'cliente novo' })}</div>`
      : `<div class="pessoas"><div class="vaga vazia"><span class="n"><i data-lucide="user-round"></i></span><div class="campo"><select data-cliente data-combo="sim" aria-label="Quem paga">${opcoesPessoas()}</select></div>
          <button class="btn" data-nova-pessoa="cliente"><i data-lucide="user-plus"></i>Cadastrar ${esc(o.contato.nome.split(' ')[0])}</button></div></div>`;
    return cabSecao(2, 'Quem paga', !!c, '<span class="n">vira cliente</span>') + corpo;
  }
  function quemVoa() {
    const ids = o.passageirosIds, lista = ids.map(pessoa).filter(Boolean);
    const voaram = new Set(o.emissoes.flatMap((e) => e.passageiros));
    const sug = ids.length >= N ? [] : [o.clienteId, ...juntos.map((j) => j.id)].filter((x, i, a) => x && a.indexOf(x) === i && !ids.includes(x) && pessoa(x)).slice(0, 5);
    const vazias = N - lista.length;
    return cabSecao(3, 'Quem voa', lista.length >= N, `<span class="n">${lista.length} de ${N} · ${O.fmtPax(o.passageiros)}</span>`)
      + (sug.length ? `<div class="sugestoes"><span class="rot">Costumam ir:</span>${sug.map((x) => { const p = pessoa(x); return `<button class="pilula" data-add="${x}"><i data-lucide="plus" style="width:15px;height:15px"></i>${esc(p.nome.split(' ').slice(0, 2).join(' '))}${x === o.clienteId ? ' <span class="cont">quem paga</span>' : ''}</button>`; }).join('')}${sug.length > 1 && sug.length <= N - ids.length ? '<button class="pilula" data-add-todos>Todos</button>' : ''}</div>` : '')
      + `<div class="pessoas">${lista.map((p) => linhaPessoa(p, { tirar: voaram.has(p.id) ? '' : `data-tira="${p.id}"`, papel: p.id === o.clienteId ? 'quem paga' : '' })).join('')}
        ${Array.from({ length: Math.max(0, vazias) }, (_, i) => `<div class="vaga vazia"><span class="n">${lista.length + i + 1}</span><div class="campo"><select data-pax aria-label="Passageiro ${lista.length + i + 1}" data-combo="sim">${opcoesPessoas(ids)}</select></div>
          <button class="btn icone" data-nova-pessoa="pax" aria-label="Cadastrar pessoa nova" title="Pessoa nova"><i data-lucide="user-plus"></i></button></div>`).join('')}</div>`;
  }

  // ---------- 4 · recebimento ----------
  function recebimento() {
    const c = P.aceita(o), s = P.situacao(o), r = o.receb;
    return cabSecao(4, 'Recebimento', !!s && s.id === 'pago', '<span class="n">dá pra emitir antes ou depois de receber</span>') + `<div class="receb">
      <div><span class="rot">Forma</span><div class="seg">${P.formas.map((f) => `<button data-forma="${f.id}" aria-pressed="${r.forma === f.id}">${f.nome}</button>`).join('')}</div>
        ${r.forma === 'parcelado' ? `<div class="campo" style="margin-top:12px;max-width:180px"><label for="parc">Parcelas</label><select id="parc" data-parcelas data-combo="nao">${Array.from({ length: 11 }, (_, i) => i + 2).map((n) => `<option ${n === r.parcelas ? 'selected' : ''}>${n}</option>`).join('')}</select></div>` : ''}</div>
      <div><label class="rot" for="rec">Já recebeu</label><div class="caixa"><span>R$</span><input id="rec" data-recebido inputmode="decimal" placeholder="0" autocomplete="off" value="${numCampo(r.recebido)}"></div>
        <div class="rapidos"><button class="btn pequeno" data-rec="0">Nada ainda</button>${c ? `<button class="btn pequeno" data-rec="${Math.round(P.valorFinal(o) / 2)}">Metade</button><button class="btn pequeno" data-rec="${P.valorFinal(o)}">Tudo</button>` : ''}</div></div>
      <div class="situ" data-situ>${situHtml()}</div></div>`;
  }
  function situHtml() {
    const s = P.situacao(o);
    if (!s) return '<span class="rot">Situação</span><span class="faint">Escolha a combinação aceita.</span>';
    return `<span class="rot">Situação</span><span><span class="etiqueta ${s.cls}">${s.nome}</span></span>${s.falta ? `<b>${fmt.brl(s.falta)}</b><span class="faint" style="font-size:13px;font-weight:600">falta receber${o.receb.forma === 'parcelado' ? ` · ${o.receb.parcelas}x de ${fmt.brl(Math.round(P.valorFinal(o) / o.receb.parcelas))}` : ''}</span>` : ''}`;
  }

  // ---------- barra de baixo ----------
  function barra() {
    if (fechado()) return '';
    const c = P.aceita(o), falta = N - o.passageirosIds.length;
    const pend = [!c && 'escolher a combinação', !o.clienteId && 'quem paga', falta > 0 && `${falta} passageiro${falta > 1 ? 's' : ''}`].filter(Boolean);
    return `<div class="barra-acao"><span class="resumo"><b>${c ? `${esc(c.nome)} · ${fmt.brl(P.valorFinal(o))}${o.receb.forma === 'parcelado' && c.parcelado ? ' parcelado' : ''}` : 'Nenhuma combinação marcada'}</b>
      <span class="${pend.length ? 'alerta' : ''}">${pend.length ? `Falta: ${pend.join(', ')}. Dá pra completar depois.` : 'Tudo pronto pra emitir.'}</span></span>
      <button class="btn primario" data-fechar ${c ? '' : 'disabled style="opacity:.5"'}><i data-lucide="handshake"></i>Fechar orçamento</button></div>`;
  }

  function render() {
    const y = scrollY;
    if (['novo', 'pesquisa'].includes(o.etapa)) {
      app.innerHTML = `<a class="voltar" href="orcamentos.html"><i data-lucide="arrow-left"></i>Orçamentos</a>${O.trilha(o, 'fechamento')}<div class="vazio">Esse orçamento ainda está em pesquisa.</div>`;
      KVShell.icones(); return;
    }
    app.innerHTML = topo() + aceitou() + quemPaga() + quemVoa() + recebimento() + barra();
    document.title = `Fechamento #${o.id} ${O.destino(o)} · K&V`;
    KVShell.icones();
    scrollTo(0, y);
  }

  // ---------- janela: pessoa nova (o mesmo formulário da ficha, com nome e WhatsApp do contato quando é quem paga) ----------
  const dlg = document.createElement('dialog'); dlg.className = 'janela'; document.body.append(dlg);
  const fechar = () => KVShell.desfazer({ janela: 1 }, sinc);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); fechar(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fechar(); });
  async function usarPessoa(j, p) {
    if (!pessoa(p.id)) pessoas.push(p);
    pessoas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (j === 'cliente') { o.clienteId = p.id; addPax(p.id); await carregarJuntos(); }
    else addPax(p.id);
    marcarSujo(); fechar(); render();
  }
  function sinc() {
    const j = KVShell.param('janela');
    if (j === 'cliente' || j === 'pax') {
      KVPessoaForm.abrir(dlg, null, {
        pessoas, fechar, aoSalvar: (p) => usarPessoa(j, p), aoUsar: (p) => usarPessoa(j, p),
        sub: j === 'cliente' ? 'Quem paga a viagem. Fica no cadastro único, achado pelo CPF.' : 'Quem vai voar. Fica no cadastro único, achado pelo CPF.',
        inicial: j === 'cliente' ? { nome: o.contato.nome, whatsapp: o.contato.whatsapp } : {},
      });
    } else if (dlg.open) dlg.close();
  }

  // ---------- ações ----------
  const addPax = (pid) => { if (pid && !o.passageirosIds.includes(pid) && o.passageirosIds.length < N) o.passageirosIds.push(pid); };
  function ligarEventos() {
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.aceita) { o.aceita = +b.dataset.aceita; if (o.receb.forma === 'parcelado') o.receb.parcelas = P.aceita(o).vezes; marcarSujo(); render(); }
      else if (b.hasAttribute('data-tira-cliente')) { o.clienteId = null; juntos = []; marcarSujo(); render(); }
      else if (b.dataset.tira) { o.passageirosIds = o.passageirosIds.filter((x) => x !== +b.dataset.tira); marcarSujo(); render(); }
      else if (b.dataset.add) { addPax(+b.dataset.add); marcarSujo(); render(); }
      else if (b.hasAttribute('data-add-todos')) { app.querySelectorAll('[data-add]').forEach((x) => addPax(+x.dataset.add)); marcarSujo(); render(); }
      else if (b.dataset.novaPessoa) { KVShell.irPara({ janela: b.dataset.novaPessoa }); sinc(); }
      else if (b.dataset.forma) { o.receb.forma = b.dataset.forma; if (b.dataset.forma === 'parcelado' && P.aceita(o)) o.receb.parcelas = P.aceita(o).vezes; marcarSujo(); render(); }
      else if (b.dataset.rec != null) { o.receb.recebido = +b.dataset.rec; marcarSujo(); render(); }
      else if (b.hasAttribute('data-reabrir')) {
        try { const r = await KVApi.acao('fech.reabrir', { id: o.id }); await recarregar(); render(); KVShell.aviso(`Fechamento desfeito: voltou pra ${r.etapa === 'enviado' ? 'Enviado' : 'Pesquisado'}. O que estava marcado continua aqui.`); }
        catch (err) { KVShell.aviso(err.message, { erro: true }); }
      }
      else if (b.hasAttribute('data-fechar')) {
        b.disabled = true;
        await salvar();
        try { await KVApi.acao('fech.salvar', { ...dados(), fechar: true }); KVRota.ir(`emissao.html?id=${o.id}&fechou=1`); }
        catch (err) { KVShell.aviso(err.message, { erro: true }); b.disabled = false; }
      }
    });
    app.addEventListener('change', async (e) => {
      if (e.target.matches('[data-cliente]') && e.target.value) { o.clienteId = +e.target.value; if (!o.passageirosIds.length) addPax(o.clienteId); marcarSujo(); await carregarJuntos(); render(); }
      if (e.target.matches('[data-pax]') && e.target.value) { addPax(+e.target.value); marcarSujo(); render(); }
      if (e.target.matches('[data-parcelas]')) { o.receb.parcelas = +e.target.value; marcarSujo(); app.querySelector('[data-situ]').innerHTML = situHtml(); }
    });
    app.addEventListener('input', (e) => {
      if (e.target.matches('[data-recebido]')) { o.receb.recebido = lerNum(e.target.value); marcarSujo(); app.querySelector('[data-situ]').innerHTML = situHtml(); }
    });
    app.addEventListener('focusout', (e) => { if (e.target.matches('[data-recebido]')) render(); });
  }

  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const [est, lista] = await Promise.all([KVApi.estado(), KVApi.pessoas().catch(() => null), recarregar()]);
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar(`orcamento.html?id=${id}`); return; }
      pessoas = lista || [];
      P.usarProgramas(est.programas);
      await carregarJuntos();
      document.querySelector('.carregando').remove();
      app = KVShell.montar('orcamentos', { dono: true });
      ligarEventos();
      // o que o sistema já preencheu sozinho (combinação única, contato que é cliente) fica guardado
      if (preencheu) marcarSujo();
      render(); sinc();
      KVShell.aoVoltar(() => { render(); sinc(); });
    } catch (e) {
      const c = document.querySelector('.carregando');
      if (c) c.innerHTML = `${esc(e.message)} <a href="orcamentos.html" style="color:var(--orange)">Voltar pros orçamentos</a>`;
    }
  })();
};

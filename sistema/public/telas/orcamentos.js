/* Tela: Quadro de orçamentos. Endereço: /orcamentos.html
   Redesign do PC (rascunho _rascunhos/v2/quadro.html, versão D): título + quem está com o ponto ligado + "Novo orçamento",
   busca larga e 3 colunas por etapa (Novos, Em pesquisa, e a 3ª com tudo que já passou da pesquisa).
     O dono vê tudo; quem pesquisa vê a fila de novos, o que está em pesquisa e os que ele já pesquisou. A lista se atualiza sozinha (pedidos do bot).
     Não tem "pegar" (2026-11-19): qualquer um pesquisa qualquer um; o cartão mostra o último voo lançado, quem está nele agora e há quanto tempo está parado.
   O estilo desta tela está em telas/orcamentos.css. */
KVTelas['orcamentos'] = function () {
  const O = KVOrc, { esc } = KVOrc;
  let eu = null, dono = false, podeCriar = false, nomes = {}, lista = [], app = null, equipe = [], ligados = {};
  let textoBusca = '', menuAberto = null, confirmarApagar = null, mudarEtapa = null;

  const tira = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const casa = (o) => { const q = tira(textoBusca.trim()); if (!q) return true; const d = q.replace(/\D/g, '');
    return tira(o.contato.nome).includes(q) || tira(O.destino(o)).includes(q) || tira(O.rota(o)).includes(q) || String(o.id) === q || (d.length >= 3 && (o.contato.whatsapp || '').includes(d)); };
  // destaca o que foi buscado; o texto vem do banco, então tudo passa pelo esc
  const realce = (t) => { const q = tira(textoBusca.trim()); const i = q ? tira(t).indexOf(q) : -1; return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length)); };
  const iniciais = (n) => { n = n.replace(/[^\p{L} ]/gu, ''); const p = n.split(' ').filter((x) => x.length > 2); return (p.length ? p : n.split(' ')).slice(0, 2).map((x) => x[0]).join('').toUpperCase(); };
  const primeiro = (n) => n.split(' ')[0];
  const doisNomes = (n) => n.split(' ').slice(0, 2).join(' ');
  const pessoas = (o) => o.passageiros.adultos + o.passageiros.criancas + o.passageiros.bebes;
  const nomeCurto = (email) => (nomes[email] ? nomes[email].split(' ')[0] : 'outra pessoa');

  const AVANCO = { emitido: 6, fechado: 5, enviado: 4, pesquisado: 3, pesquisa: 2, novo: 1, cancelado: 0, perdido: 0 };
  const ordemFase = (o) => (AVANCO[o.etapa] === 0 ? 99 : AVANCO[o.etapa]);
  const ETAPAS_TRILHA = ['novo', 'pesquisa', 'pesquisado', 'enviado', 'fechado'];
  const pontosEtapa = (o) => { const i = ETAPAS_TRILHA.indexOf(o.etapa); return `<span class="pontos" aria-label="Etapa ${O.etapa(o.etapa).nome}">${ETAPAS_TRILHA.map((e, k) => `<i class="${k < i ? 'feito' : k === i ? 'agora' : ''}"></i>`).join('')}</span>`; };
  // o dono vai direto pra tela do que falta fazer (proposta, emissão); quem pesquisa, sempre pra pesquisa
  const link = (o) => `${dono ? O.telaDa(o) : 'orcamento.html'}?id=${o.id}`;
  const get = (id) => lista.find((o) => o.id === Number(id));

  const canto = (o) => `<span class="canto"><button data-menu="${o.id}" aria-haspopup="menu" aria-expanded="${menuAberto === o.id}" aria-label="Ações do orçamento #${o.id}"><i data-lucide="menu"></i></button></span>${menuAberto === o.id ? menuHtml(o) : ''}`;
  function menuHtml(o) {
    const it = (acao, icone, texto, cls = '', extra = '') => `<button role="menuitem" class="${cls}" data-acao="${acao}" ${extra}><i data-lucide="${icone}"></i>${texto}</button>`;
    if (confirmarApagar === o.id) return `<div class="menu-orc" role="menu"><p>Apagar o #${o.id} de ${esc(primeiro(o.contato.nome))}?</p>${it('apagar-sim', 'trash-2', 'Sim, apagar', 'perigo')}${it('apagar-nao', 'x', 'Não')}</div>`;
    if (mudarEtapa === o.id) return `<div class="menu-orc" role="menu"><p>Mudar a etapa do #${o.id}</p>${O.etapas.map((e) => it('etapa', e.id === o.etapa ? 'check' : 'dot', e.nome, '', `data-etapa="${e.id}" ${e.id === o.etapa ? 'aria-current="true"' : ''}`)).join('')}</div>`;
    return `<div class="menu-orc" role="menu">${it('abrir', 'arrow-up-right', 'Abrir')}${dono ? it('mudar-etapa', 'list-restart', 'Mudar etapa') + it('duplicar', 'copy', 'Duplicar') + (o.contato.whatsapp ? it('whatsapp', 'message-circle', 'WhatsApp') : '') + it('apagar', 'trash-2', 'Apagar', 'perigo') : ''}</div>`;
  }
  // com roteiros alternativos, vale o jeito de cada roteiro: "BSB → LIS ou BSB → OPO"
  const porRoteiro = (o) => O.roteiros(o).map((idx) => ({ ...o, trechos: idx.map((i) => o.trechos[i]) }));
  const idaEVolta = (o) => o.trechos.length === 2 && o.trechos[1].para === o.trechos[0].de && o.trechos[1].de === o.trechos[0].para;
  const siglas = (o) => porRoteiro(o).map((r) => idaEVolta(r) ? `${r.trechos[0].de} → ${r.trechos[0].para}` : O.rota(r)).join(' ou ');
  const pes = (o) => `${pessoas(o)} ${pessoas(o) > 1 ? 'pessoas' : 'pessoa'}`;
  const datas = (o) => { const d1 = o.trechos[0].data, d2 = o.trechos[o.trechos.length - 1].data; return O.dataCurta(d1) + (d1 !== d2 ? ` – ${O.dataCurta(d2)}` : ''); };
  // não tem mais "pegar": o cartão mostra quem lançou o último voo e quando (sem voo, a quem o dono passou)
  // parado há dias: o tempo já está na etiqueta de baixo, então aqui vai só o nome
  const quemE = (email) => (email === eu.email ? 'você' : esc(nomeCurto(email)));
  const comQuem = (o) => o.ultimoVooEm ? `<span title="Último voo lançado ${O.idade(o.ultimoVooEm)}">último: ${o.ultimoVooPor === eu.email ? 'você' : esc(primeiro(o.ultimoVooNome || ''))}${O.parado(o) ? '' : ` · ${O.idade(o.ultimoVooEm)}`}</span>` : o.responsavel ? `pra ${quemE(o.responsavel)}` : '';
  const falta = (o) => o.faltando.length ? `<span class="etiqueta warn" title="${esc(o.faltando.join(' · '))}"><i data-lucide="message-circle-question"></i>${o.faltando.length === 1 ? 'falta 1 resposta' : `faltam ${o.faltando.length} respostas`}</span>` : '';
  const parado = (o) => { const p = O.parado(o); return p ? `<span class="etiqueta ${p.cor}"><i data-lucide="hourglass"></i>${p.texto}</span>` : ''; };
  const aqui = (o) => o.agora.length ? `<span class="etiqueta ok"><i data-lucide="eye"></i>${esc(o.agora.map(primeiro).join(' e '))} ${o.agora.length > 1 ? 'estão' : 'está'} aqui agora</span>` : '';

  // cartão da versão C: quem pediu, siglas, e o trilho (um traço por trecho; azul = já tem voo).
  // Na 3ª coluna o trilho vira a etapa (pesquisado, enviado, fechado…). O cartão inteiro é o link.
  function cartao(o, depois) {
    const comVoo = o.trechos.filter((t) => t.nVoos).length, n = o.trechos.length;
    const pe = depois
      ? `<div class="grupos"><span class="etiqueta">${O.etapa(o.etapa).nome}</span>${pontosEtapa(o)}</div><div class="trilho-t"><span>${o.nOpcoes} ${o.nOpcoes === 1 ? 'voo' : 'voos'}</span><span>${comQuem(o)}</span></div>`
      : `<div class="trilho">${o.trechos.map((t) => `<i class="${t.nVoos ? 'ok' : ''}" title="${esc(t.de)} → ${esc(t.para)}"></i>`).join('')}</div>
        <div class="trilho-t"><span>${comVoo} de ${n} ${n > 1 ? 'trechos' : 'trecho'} com voo</span><span>${comQuem(o)}</span></div>`;
    return `<article class="cartao-ref ca" data-orc="${o.id}">${canto(o)}
      <div class="ca-quem"><span class="avc">${esc(iniciais(o.contato.nome))}</span><span><b>${realce(doisNomes(o.contato.nome))}</b><small>#${o.id} · ${O.idade(o.criadoEm)}</small></span></div>
      <a class="cobre" href="${link(o)}" aria-label="Abrir orçamento #${o.id}: ${esc(siglas(o))}"></a>
      <div class="titulo-op"><div class="rolo" data-link="${link(o)}" title="${esc(O.destino(o))}"><span class="nome">${realce(siglas(o))}</span></div><span class="sub">${realce(O.destino(o))} · ${datas(o)} · ${pes(o)}</span></div>
      ${pe}${(() => { const r = aqui(o) + parado(o) + falta(o); return r ? `<div class="rodape">${r}</div>` : ''; })()}</article>`;
  }

  const antigo = (a, b) => a.criadoEm.localeCompare(b.criadoEm);
  const COLS = () => [
    { nome: 'Novos', ic: 'inbox', cor: 'warn', passa: (o) => o.etapa === 'novo' },
    // o que está parado há mais tempo fica em cima
    { nome: 'Em pesquisa', ic: 'search', cor: 'orange', passa: (o) => o.etapa === 'pesquisa', ordem: (a, b) => (a.ultimoVooEm || a.criadoEm).localeCompare(b.ultimoVooEm || b.criadoEm) },
    { nome: dono ? 'Pesquisados em diante' : 'Pesquisados', ic: 'check', cor: 'ok', depois: true, passa: (o) => !['novo', 'pesquisa'].includes(o.etapa), ordem: (a, b) => ordemFase(a) - ordemFase(b) || antigo(a, b) },
  ];

  // quem está com o ponto ligado agora, e há quanto tempo ("Bruna 2h 14min")
  const tempo = (iso) => { const m = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 60000)); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`; };
  const equipeHtml = () => equipe.filter((u) => ligados[u.email]).map((u) => `<span class="pessoa" title="Ponto ligado desde ${new Date(ligados[u.email]).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}"><span class="av">${esc(iniciais(u.nome).slice(0, 1))}</span><b>${esc(primeiro(u.nome))}</b><span>${tempo(ligados[u.email])}</span></span>`).join('');

  function vista() {
    app.innerHTML = `<div class="topo"><h1>Orçamentos</h1><div class="time" id="equipe">${equipeHtml()}</div>
        ${podeCriar ? '<a class="btn primario novo" href="novo-orcamento.html"><i data-lucide="plus"></i>Novo orçamento</a>' : ''}</div>
      <label class="busca-g"><i data-lucide="search"></i><input class="busca" type="search" placeholder="Buscar por nome, cidade, sigla ou nº do orçamento" aria-label="Buscar orçamento" value="${esc(textoBusca)}"></label>
      ${lista.length ? '' : '<p class="vazio">Nenhum orçamento ainda. Os pedidos mandados pro bot do Telegram aparecem aqui.</p>'}
      <div class="colunas">${COLS().map((c) => {
        const l = lista.filter((o) => c.passa(o) && casa(o)).sort(c.ordem || antigo);
        return `<section class="col" data-cor="${c.cor}"><div class="col-cab"><span class="ic"><i data-lucide="${c.ic}"></i></span><h2>${c.nome}</h2><span class="n">${l.length}</span></div>
          <div class="lista">${l.length ? l.map((o) => cartao(o, c.depois)).join('') : '<p class="vazio-c">Nada aqui.</p>'}</div></section>`;
      }).join('')}</div>`;
  }

  // ---------- gravar no banco ----------
  async function fazer(id, acao, dados) {
    const card = app.querySelector(`[data-orc="${id}"]`); if (card) card.classList.add('ocupado');
    try { const r = await KVApi.acao(acao, dados); await recarregar(); return r; }
    catch (e) { KVShell.aviso(e.message, { erro: true }); await recarregar(); return null; }
  }
  const fecharMenu = () => { menuAberto = confirmarApagar = mudarEtapa = null; };

  function ligarEventos() {
    app.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-menu]');
      if (m) { e.preventDefault(); const id = Number(m.dataset.menu); const era = menuAberto; fecharMenu(); menuAberto = era === id ? null : id; render(); const pri = app.querySelector('.menu-orc button'); if (pri) pri.focus(); return; }
      const a = e.target.closest('[data-acao]');
      if (a) {
        e.preventDefault();
        const o = get(menuAberto), acao = a.dataset.acao;
        if (!o) { fecharMenu(); render(); return; }
        if (acao === 'abrir') { KVRota.ir(link(o)); return; }
        if (acao === 'whatsapp') { open(`https://wa.me/${o.contato.whatsapp.length <= 11 ? '55' : ''}${o.contato.whatsapp}`, '_blank', 'noopener'); fecharMenu(); render(); return; }
        if (acao === 'apagar') { confirmarApagar = o.id; render(); return; }
        if (acao === 'mudar-etapa') { mudarEtapa = o.id; render(); const c = app.querySelector('.menu-orc [aria-current]'); if (c) c.focus(); return; }
        if (acao === 'apagar-nao') { confirmarApagar = null; render(); return; }
        fecharMenu(); render();
        if (acao === 'etapa' && a.dataset.etapa !== o.etapa) { const r = await fazer(o.id, 'orc.etapa', { id: o.id, etapa: a.dataset.etapa }); if (r) KVShell.aviso(`#${o.id} agora está em ${O.etapa(a.dataset.etapa).nome}`); }
        if (acao === 'duplicar') { const r = await fazer(o.id, 'orc.duplicar', { id: o.id }); if (r) KVShell.aviso(`Duplicado: #${r.id}`); }
        if (acao === 'apagar-sim') { const r = await fazer(o.id, 'orc.apagar', { id: o.id }); if (r) KVShell.aviso(`#${o.id} apagado`); }
        return;
      }
      if (menuAberto && !e.target.closest('.menu-orc')) { fecharMenu(); render(); if (!e.target.closest('.cobre, .rolo')) return; }
    }, true);
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuAberto) { const id = menuAberto; fecharMenu(); render(); const b = app.querySelector(`[data-menu="${id}"]`); if (b) b.focus(); } });
    app.addEventListener('input', (e) => { if (e.target.classList.contains('busca')) { textoBusca = e.target.value; render(); } });
  }

  // ---------- títulos que não cabem: andam devagar de um lado pro outro; arrastar (ou rolar) para no ponto escolhido ----------
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ligarRolos() {
    app.querySelectorAll('.rolo').forEach((r) => {
      const cabe = r.scrollWidth <= r.clientWidth + 2;
      r.classList.toggle('cabe', cabe);
      let pos = null, dir = 1, pausa = 1500, ultimo = null, parado = false, inicioX = 0, inicioScroll = 0, moveu = false, apertado = false;
      r.addEventListener('click', (e) => { if (moveu) { e.preventDefault(); moveu = false; return; } KVRota.ir(r.dataset.link); });
      if (cabe) return;
      // anda por tempo (30px por segundo, pausa de 1,5s nas pontas), não por quadro: fica igual em qualquer tela
      const passo = (t) => {
        if (!r.isConnected || parado) return;
        const dt = ultimo == null ? 16 : Math.min(64, t - ultimo); ultimo = t;
        if (pausa > 0) pausa -= dt;
        else {
          pos = (pos ?? r.scrollLeft) + dir * dt * 0.03; r.scrollLeft = pos;
          const fim = r.scrollWidth - r.clientWidth;
          if ((dir > 0 && pos >= fim) || (dir < 0 && pos <= 0)) { pos = Math.max(0, Math.min(fim, pos)); dir *= -1; pausa = 1500; }
        }
        requestAnimationFrame(passo);
      };
      if (!calmo) requestAnimationFrame(passo);
      r.addEventListener('pointerdown', (e) => { apertado = true; moveu = false; inicioX = e.clientX; inicioScroll = r.scrollLeft; r.setPointerCapture(e.pointerId); });
      r.addEventListener('pointermove', (e) => { if (!apertado) return; const dx = e.clientX - inicioX; if (Math.abs(dx) > 4) { moveu = true; parado = true; r.classList.add('arrastando'); } if (moveu) r.scrollLeft = inicioScroll - dx; });
      r.addEventListener('pointerup', () => { apertado = false; r.classList.remove('arrastando'); });
      r.addEventListener('wheel', () => { parado = true; }, { passive: true });
    });
  }

  // redesenha sem perder o que a pessoa está digitando na busca
  function render() {
    const b = document.activeElement && document.activeElement.classList.contains('busca') ? document.activeElement : null;
    const pos = b ? b.selectionStart : 0;
    vista();
    KVShell.icones(); ligarRolos();
    if (b) { const n = app.querySelector('.busca'); n.focus(); n.setSelectionRange(pos, pos); }
  }

  // ---------- carregar e manter atualizado ----------
  let ultimoJson = '';
  async function recarregar() {
    const [l, pt] = await Promise.all([KVApi.orcamentos(), KVApi.ponto().catch(() => null)]);
    if (pt) {
      equipe = pt.pesquisadores.map(({ email, nome }) => ({ email, nome }));
      ligados = Object.fromEntries(pt.trechos.filter((t) => !t.fim).map((t) => [t.email, t.inicio]));
    }
    const j = JSON.stringify([l, equipe, ligados]);
    if (j === ultimoJson) return;
    ultimoJson = j; lista = l;
    // com o menu aberto, espera fechar pra não sumir debaixo do dedo
    if (!menuAberto) render();
  }

  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const est = await KVApi.estado();
      eu = est.eu; dono = eu.papel === 'dono' || eu.papel === 'admin'; podeCriar = est.podeCriar;
      est.usuarios.forEach((u) => { nomes[u.email] = u.nome; });
      document.querySelector('.carregando').remove();
      app = KVShell.montar('orcamentos', { dono });
      ligarEventos();
      await recarregar();
      // pedidos novos do bot entram sozinhos; com a aba escondida, para de perguntar
      setInterval(() => { if (!document.hidden) recarregar().catch(() => {}); }, 15000);
      // o tempo de cada um na pílula anda sozinho
      setInterval(() => { const el = app.querySelector('#equipe'); if (el) el.innerHTML = equipeHtml(); }, 30000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) recarregar().catch(() => {}); });
    } catch (e) {
      const c = document.querySelector('.carregando'); if (c) c.textContent = e.message;
    }
  })();
};

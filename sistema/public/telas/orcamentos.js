/* Tela: Fila de orçamentos. Endereço: /orcamentos.html
   Fila de orçamentos (rodada 8b dos rascunhos, cartão A), lendo e gravando no banco.
     O dono vê tudo; quem pesquisa vê "com você" e a fila de novos. A lista se atualiza sozinha (pedidos do bot).
   O estilo desta tela está em telas/orcamentos.css. */
KVTelas['orcamentos'] = function () {
  const O = KVOrc, { esc } = KVOrc;
  let eu = null, dono = false, nomes = {}, lista = [], app = null, equipe = [], ligados = {};
  let textoBusca = '', menuAberto = null, confirmarApagar = null;

  const tira = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const casa = (o) => { const q = tira(textoBusca.trim()); if (!q) return true; const d = q.replace(/\D/g, '');
    return tira(o.contato.nome).includes(q) || tira(O.destino(o)).includes(q) || tira(O.rota(o)).includes(q) || String(o.id) === q || (d.length >= 3 && (o.contato.whatsapp || '').includes(d)); };
  // destaca o que foi buscado; o texto vem do banco, então tudo passa pelo esc
  const realce = (t) => { const q = tira(textoBusca.trim()); const i = q ? tira(t).indexOf(q) : -1; return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length)); };
  const iniciais = (n) => { n = n.replace(/[^\p{L} ]/gu, ''); const p = n.split(' ').filter((x) => x.length > 2); return (p.length ? p : n.split(' ')).slice(0, 2).map((x) => x[0]).join('').toUpperCase(); };
  const primeiro = (n) => n.split(' ')[0];
  const doisNomes = (n) => n.split(' ').slice(0, 2).join(' ');
  const pessoas = (o) => o.passageiros.adultos + o.passageiros.criancas + o.passageiros.bebes;
  const fone = (d) => !d ? 'sem WhatsApp' : d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
  const nomeDe = (email) => nomes[email] || email || '';

  const AVANCO = { emitido: 6, fechado: 5, enviado: 4, pesquisado: 3, pesquisa: 2, novo: 1, cancelado: 0, perdido: 0 };
  const ordemFase = (o) => (AVANCO[o.etapa] === 0 ? 99 : AVANCO[o.etapa]);
  const ETAPAS_TRILHA = ['novo', 'pesquisa', 'pesquisado', 'enviado', 'fechado'];
  const pontosEtapa = (o) => { const i = ETAPAS_TRILHA.indexOf(o.etapa); return `<span class="pontos" aria-label="Etapa ${O.etapa(o.etapa).nome}">${ETAPAS_TRILHA.map((e, k) => `<i class="${k < i ? 'feito' : k === i ? 'agora' : ''}"></i>`).join('')}</span>`; };
  // o dono vai direto pra tela do que falta fazer (proposta, emissão); quem pesquisa, sempre pra pesquisa
  const link = (o) => `${dono ? O.telaDa(o) : 'orcamento.html'}?id=${o.id}`;
  const get = (id) => lista.find((o) => o.id === Number(id));

  const canto = (o) => `<span class="canto"><button data-menu="${o.id}" aria-haspopup="menu" aria-expanded="${menuAberto === o.id}" aria-label="Ações do orçamento #${o.id}"><i data-lucide="menu"></i></button></span>${menuAberto === o.id ? menuHtml(o) : ''}`;
  function menuHtml(o) {
    if (confirmarApagar === o.id) return `<div class="menu-orc" role="menu"><p>Apagar o #${o.id} de ${esc(primeiro(o.contato.nome))}?</p><button role="menuitem" class="perigo" data-acao="apagar-sim"><i data-lucide="trash-2"></i>Sim, apagar</button><button role="menuitem" data-acao="apagar-nao"><i data-lucide="x"></i>Não</button></div>`;
    const it = (acao, icone, texto, cls = '') => `<button role="menuitem" class="${cls}" data-acao="${acao}"><i data-lucide="${icone}"></i>${texto}</button>`;
    return `<div class="menu-orc" role="menu">${it('abrir', 'arrow-up-right', 'Abrir')}${dono ? it('duplicar', 'copy', 'Duplicar') + (o.contato.whatsapp ? it('whatsapp', 'message-circle', 'WhatsApp') : '') + it('apagar', 'trash-2', 'Apagar', 'perigo') : ''}</div>`;
  }
  const idaEVolta = (o) => o.trechos.length === 2 && o.trechos[1].para === o.trechos[0].de && o.trechos[1].de === o.trechos[0].para;
  const siglas = (o) => idaEVolta(o) ? `${o.trechos[0].de} → ${o.trechos[0].para}` : O.rota(o);
  const tipoViagem = (o) => idaEVolta(o) ? 'ida e volta' : o.trechos.length === 1 ? 'só ida' : `${o.trechos.length} trechos`;
  const pes = (o) => `${pessoas(o)} ${pessoas(o) > 1 ? 'pessoas' : 'pessoa'}`;
  const falta = (o) => o.faltando.length ? `<span class="etiqueta warn" title="${esc(o.faltando.join(' · '))}"><i data-lucide="message-circle-question"></i>${o.faltando.length === 1 ? 'falta 1 resposta' : `faltam ${o.faltando.length} respostas`}</span>` : '';

  // cartão A da rodada 8b: quem pediu no topo, siglas grandes, datas e etapa em bolinhas. O cartão inteiro é o link.
  function cartao(o, { cheio = false, rodape } = {}) {
    const d1 = o.trechos[0].data, d2 = o.trechos[o.trechos.length - 1].data;
    const pe = rodape ? rodape(o) : '';
    return `<article class="cartao-ref ca ${cheio ? 'cheio' : ''}" data-orc="${o.id}">${canto(o)}
      <div class="ca-quem"><span class="avc">${esc(iniciais(o.contato.nome))}</span><span><b>${realce(doisNomes(o.contato.nome))}</b><small>${dono ? fone(o.contato.whatsapp) : `#${o.id} · ${O.idade(o.criadoEm)}`}</small></span></div>
      <a class="cobre" href="${link(o)}" aria-label="Abrir orçamento #${o.id}: ${siglas(o)}"></a>
      <div class="titulo-op"><div class="rolo" data-link="${link(o)}" title="${esc(O.destino(o))}"><span class="nome">${realce(siglas(o))}</span></div><span class="sub">${realce(O.destino(o))} · ${tipoViagem(o)} · ${pes(o)}${o.nOpcoes ? ` · ${o.nOpcoes} opções` : ''}</span></div>
      <div class="grupos"><div><span class="rot">Datas</span><div class="tags"><span class="etiqueta">${O.dataCurta(d1)}</span>${d1 !== d2 ? `<span class="etiqueta">${O.dataCurta(d2)}</span>` : ''}</div></div>
        <div class="dir"><span class="rot">${O.etapa(o.etapa).nome}</span>${pontosEtapa(o)}</div></div>
      ${pe ? `<div class="rodape">${pe}</div>` : ''}</article>`;
  }

  const FILTROS = [{ id: 'todos', nome: 'Todos' }, { id: 'novo', nome: 'Novos' }, { id: 'pesquisa', nome: 'Em pesquisa' }, { id: 'enviado', nome: 'Enviados' }, { id: 'fechado', nome: 'Fechados' }, { id: 'arquivo', nome: 'Arquivo' }];
  const passa = (f, o) => f === 'todos' ? ['novo', 'pesquisa', 'enviado', 'fechado'].includes(o.etapa) : f === 'arquivo' ? !O.etapa(o.etapa).aberta : o.etapa === f;
  const buscaHtml = () => `<div class="busca-linha"><div class="busca-wrap"><i data-lucide="search"></i><input class="busca" type="search" placeholder="Nome, destino ou nº" aria-label="Buscar orçamento" value="${esc(textoBusca)}"></div></div>`;
  const antigo = (a, b) => a.criadoEm.localeCompare(b.criadoEm);

  function vistaDono() {
    const l = lista;
    const revisar = l.filter((o) => o.etapa === 'pesquisado' && casa(o)).sort(antigo);
    const f = FILTROS.some((x) => x.id === KVShell.param('f')) ? KVShell.param('f') : 'todos';
    const resto = l.filter((o) => passa(f, o) && casa(o)).sort((a, b) => ordemFase(a) - ordemFase(b) || antigo(a, b));
    const n = (id) => l.filter((o) => o.etapa === id).length;
    app.innerHTML = `<div class="cab-fila"><h1>Orçamentos</h1>
        <div class="kpis"><span class="kpi"><b>${l.filter((o) => O.etapa(o.etapa).aberta).length}</b><span>abertos</span></span><span class="kpi destaque"><b>${n('pesquisado')}</b><span>pra revisar</span></span><span class="kpi"><b>${n('enviado')}</b><span>esperando resposta</span></span><span class="kpi"><b>${n('fechado')}</b><span>fechados</span></span></div>
        <a class="btn primario" href="novo-orcamento.html"><i data-lucide="plus"></i>Novo orçamento</a></div>
      ${equipeHtml()}
      <div class="secao"><h2>Pra revisar</h2><span class="n">${revisar.length} pesquisados</span></div>
      ${revisar.length ? `<div class="grade-ref">${revisar.map((o, i) => cartao(o, { cheio: i === 0, rodape: (x) => `${quemPesquisa(x)}<span class="pq">pesquisou ${O.idade(x.pesquisadoEm || x.criadoEm)}</span>${seletorEtapa(x)}` })).join('')}</div>` : '<div class="vazio">Nada esperando você.</div>'}
      <div class="secao"><h2>Todos os orçamentos</h2><span class="n">${resto.length}</span>${buscaHtml()}</div>
      <div class="pilulas rolar" style="margin:-4px 0 18px">${FILTROS.map((x) => `<button class="pilula" data-f="${x.id}" aria-pressed="${x.id === f}">${x.nome} <span class="cont">${l.filter((o) => passa(x.id, o)).length}</span></button>`).join('')}</div>
      ${resto.length ? `<div class="grade-ref">${resto.map((o) => cartao(o, { rodape: (x) => `${falta(x)}${quemPesquisa(x)}<span class="pq">${O.idade(x.criadoEm)}</span>${seletorEtapa(x)}` })).join('')}</div>` : `<div class="vazio">${l.length ? 'Nenhum orçamento aqui.' : 'Nenhum orçamento ainda. Os pedidos mandados pro bot do Telegram aparecem aqui.'}</div>`}`;
  }
  const quemPesquisa = (o) => o.responsavel ? `<span class="quem-pq"><span class="ava" aria-hidden="true">${esc(iniciais(nomeDe(o.responsavel)))}</span>${esc(primeiro(nomeDe(o.responsavel)))}</span>` : '<span class="etiqueta">na fila</span>';

  // Equipe agora (dono e admin): cada pesquisador, se o cronômetro está ligado e os orçamentos em pesquisa com ele
  function equipeHtml() {
    if (!equipe.length) return '';
    // 'desde 14:02' hoje; 'desde 27/09 14:02' se ligou em outro dia
    const hora = (iso) => { const d = new Date(iso), h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return d.toDateString() === new Date().toDateString() ? h : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${h}`; };
    const nLigados = equipe.filter((u) => ligados[u.email]).length;
    return `<div class="secao"><h2>Equipe agora</h2><span class="n">${nLigados ? `${nLigados} com o cronômetro ligado` : 'ninguém com o cronômetro ligado'}</span></div>
      <div class="equipe">${equipe.map((u) => {
        const meus = lista.filter((o) => o.responsavel === u.email && o.etapa === 'pesquisa').sort(antigo);
        const on = ligados[u.email];
        return `<section class="membro"><div class="m-topo"><span class="avc">${esc(iniciais(u.nome))}</span>
            <span class="m-nome"><b>${esc(u.nome)}</b><small class="${on ? 'on' : ''}">${on ? `<span class="pulso"></span>Trabalhando desde ${hora(on)}` : 'Pausado'}</small></span>
            <span class="m-n" aria-label="${meus.length} em pesquisa">${meus.length}</span></div>
          ${meus.length ? `<div class="m-orcs">${meus.map((o) => `<a class="m-orc" href="${link(o)}"><span class="m-r">${esc(siglas(o))}</span>
              <span class="m-d">#${o.id} · ${esc(doisNomes(o.contato.nome))} · ${o.nOpcoes ? `${o.nOpcoes} ${o.nOpcoes === 1 ? 'opção' : 'opções'}` : 'nenhuma opção ainda'} · ${o.conferencia.feitos}/${o.conferencia.total} conferidos</span></a>`).join('')}</div>`
            : '<div class="m-vazio">Nenhum orçamento em pesquisa com ele agora.</div>'}</section>`;
      }).join('')}</div>`;
  }
  const seletorEtapa = (o) => `<label class="sel-pilula"><span class="escondido">Etapa</span><select data-etapa-de="${o.id}">${O.etapas.map((e) => `<option value="${e.id}" ${e.id === o.etapa ? 'selected' : ''}>${e.nome}</option>`).join('')}</select></label>`;

  function vistaPesquisador() {
    const l = lista;
    const meus = l.filter((o) => o.responsavel === eu.email && o.etapa === 'pesquisa' && casa(o)).sort(antigo);
    const novos = l.filter((o) => o.etapa === 'novo' && (!o.responsavel || o.responsavel === eu.email) && casa(o))
      .sort((a, b) => (b.responsavel === eu.email) - (a.responsavel === eu.email) || antigo(a, b));
    const comOutros = l.filter((o) => o.responsavel && o.responsavel !== eu.email).length;
    const conf = (o) => `<span class="etiqueta"><i data-lucide="list-checks"></i>${o.conferencia.feitos}/${o.conferencia.total} conferidos</span>`;
    app.innerHTML = `<div class="cab-fila"><h1>Orçamentos</h1>
        <div class="kpis"><span class="kpi destaque"><b>${meus.length}</b><span>com você</span></span><span class="kpi"><b>${novos.length}</b><span>na fila</span></span><span class="kpi"><b>${comOutros}</b><span>com a equipe</span></span></div></div>
      <div class="secao"><h2>Com você</h2><span class="n">${meus.length}</span>${buscaHtml()}</div>
      ${meus.length ? `<div class="grade-ref">${meus.map((o, i) => cartao(o, { cheio: i === 0, rodape: (x) => `${conf(x)}${x.pedido ? `<span class="etiqueta">${esc(x.pedido.split(' · ')[0])}</span>` : ''}` })).join('')}</div>` : '<div class="vazio">Nenhum com você. Pegue um da fila.</div>'}
      <div class="secao"><h2>Fila de novos</h2><span class="n">${novos.length}</span></div>
      ${novos.length ? `<div class="grade-ref">${novos.map((o) => cartao(o, { rodape: (x) => `${x.responsavel === eu.email ? '<span class="etiqueta warn">o dono passou pra você</span>' : `<span class="pq">${O.idade(x.criadoEm)}</span>`}<button class="btn primario" data-pegar="${x.id}" style="margin-left:auto;height:36px"><i data-lucide="hand"></i>Pegar</button>` })).join('')}</div>` : '<div class="vazio">Fila vazia.</div>'}`;
  }

  // ---------- gravar no banco ----------
  // sair = a tela vai embora logo depois (Pegar abre o orçamento): não recarrega a fila à toa
  async function fazer(id, acao, dados, { sair = false } = {}) {
    const card = app.querySelector(`[data-orc="${id}"]`); if (card) card.classList.add('ocupado');
    try { const r = await KVApi.acao(acao, dados); if (!sair) await recarregar(); return r; }
    catch (e) { KVShell.aviso(e.message, { erro: true }); await recarregar(); return null; }
  }

  function ligarEventos() {
    app.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-menu]');
      if (m) { e.preventDefault(); const id = Number(m.dataset.menu); menuAberto = menuAberto === id ? null : id; confirmarApagar = null; render(); const pri = app.querySelector('.menu-orc button'); if (pri) pri.focus(); return; }
      const a = e.target.closest('[data-acao]');
      if (a) {
        e.preventDefault();
        const o = get(menuAberto), acao = a.dataset.acao;
        if (!o) { menuAberto = null; render(); return; }
        if (acao === 'abrir') { KVRota.ir(link(o)); return; }
        if (acao === 'whatsapp') { open(`https://wa.me/${o.contato.whatsapp.length <= 11 ? '55' : ''}${o.contato.whatsapp}`, '_blank', 'noopener'); menuAberto = null; render(); return; }
        if (acao === 'apagar') { confirmarApagar = o.id; render(); return; }
        if (acao === 'apagar-nao') { confirmarApagar = null; render(); return; }
        menuAberto = confirmarApagar = null; render();
        if (acao === 'duplicar') { const r = await fazer(o.id, 'orc.duplicar', { id: o.id }); if (r) KVShell.aviso(`Duplicado: #${r.id}`); }
        if (acao === 'apagar-sim') { const r = await fazer(o.id, 'orc.apagar', { id: o.id }); if (r) KVShell.aviso(`#${o.id} apagado`); }
        return;
      }
      if (menuAberto && !e.target.closest('.menu-orc')) { menuAberto = confirmarApagar = null; render(); if (!e.target.closest('.cobre, .rolo')) return; }
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.f && b.dataset.f !== (KVShell.param('f') || 'todos')) { KVShell.irPara({ f: b.dataset.f === 'todos' ? null : b.dataset.f }); render(); }
      if (b.dataset.pegar) { const id = Number(b.dataset.pegar); if (await fazer(id, 'orc.pegar', { id }, { sair: true })) KVRota.ir(`orcamento.html?id=${id}`); }
    }, true);
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuAberto) { const id = menuAberto; menuAberto = confirmarApagar = null; render(); const b = app.querySelector(`[data-menu="${id}"]`); if (b) b.focus(); } });
    app.addEventListener('change', (e) => {
      const s = e.target.closest('[data-etapa-de]');
      if (s) { const id = Number(s.dataset.etapaDe); fazer(id, 'orc.etapa', { id, etapa: s.value }); }
    });
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
    dono ? vistaDono() : vistaPesquisador();
    KVShell.icones(); ligarRolos();
    if (b) { const n = app.querySelector('.busca'); n.focus(); n.setSelectionRange(pos, pos); }
  }

  // ---------- carregar e manter atualizado ----------
  let ultimoJson = '';
  async function recarregar() {
    const [l, pt] = await Promise.all([KVApi.orcamentos(), dono ? KVApi.ponto().catch(() => null) : null]);
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
      eu = est.eu; dono = eu.papel === 'dono' || eu.papel === 'admin';
      est.usuarios.forEach((u) => { nomes[u.email] = u.nome; });
      document.querySelector('.carregando').remove();
      app = KVShell.montar('orcamentos', { dono });
      ligarEventos();
      await recarregar();
      KVShell.aoVoltar(render);
      // pedidos novos do bot entram sozinhos; com a aba escondida, para de perguntar
      setInterval(() => { if (!document.hidden) recarregar().catch(() => {}); }, 15000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) recarregar().catch(() => {}); });
    } catch (e) {
      const c = document.querySelector('.carregando'); if (c) c.textContent = e.message;
    }
  })();
};

/* Tela: Ficha de uma pessoa. Endereço: /pessoa.html
   Ficha da pessoa (rodada 7 dos rascunhos, A), lendo do banco: viagens no meio e uma coluna lateral com dados,
     com quem viaja e as contas de pontos (ligadas pelo CPF). Só o dono.
   O estilo desta tela está em telas/pessoa.css. */
KVTelas['pessoa'] = function () {
  let app = null;
  const PS = KV.pessoas;
  const { esc } = KVOrc;
  const fmt = {
    ...KVOrc.fmt,
    dataCurta: KVOrc.dataCurta,
    mesAno: (s) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    iniciais: (n) => n.split(' ').filter((p) => p.length > 2).slice(0, 2).map((p) => p[0]).join('').toUpperCase(),
    cpf: (c) => (c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c || ''),
  };
  const id = Number(KVShell.param('id'));
  const P = (pid) => PS.programa(pid);
  const primeiro = (n) => n.split(' ')[0];
  const idade = (iso) => { const n = new Date(iso + 'T12:00'), h = new Date(PS.hoje + 'T12:00'); let a = h.getFullYear() - n.getFullYear(); if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) a--; return a; };


  // ---------- peças ----------
  function cabecalho(p) {
    const cliente = PS.ehCliente(p.id), desde = PS.clienteDesde(p.id), pts = PS.pontos(p.id);
    return `<a class="voltar" href="clientes.html"><i data-lucide="arrow-left"></i>Clientes</a>
      <div class="cab"><span class="av ${cliente ? 'cliente' : ''}">${esc(fmt.iniciais(p.nome))}</span>
        <div class="quem"><h1>${esc(p.nome)}</h1><div class="chips">
          ${cliente ? `<span class="chip laranja">Cliente desde ${fmt.mesAno(desde)}</span>` : '<span class="chip">Passageiro</span>'}
          ${pts.titular.length ? `<span class="chip teal"><i data-lucide="wallet" style="width:13px;height:13px"></i>Titular de ${pts.titular.length} ${pts.titular.length > 1 ? 'contas' : 'conta'}</span>` : ''}</div></div>
        <div class="acoes">${p.whatsapp ? `<a class="btn" href="https://wa.me/${p.whatsapp.length <= 11 ? '55' : ''}${p.whatsapp}" target="_blank" rel="noopener"><i data-lucide="message-circle"></i>WhatsApp</a>` : ''}<button class="btn" data-editar><i data-lucide="pencil"></i>Editar dados</button></div></div>`;
  }
  function resumo(p) {
    const vs = PS.viagensDe(p.id).filter((v) => v.etapa !== 'Cancelado');
    const comoCliente = PS.viagens().filter((v) => v.clienteId === p.id && v.etapa !== 'Cancelado');
    const total = comoCliente.reduce((s, v) => s + v.venda, 0), deve = PS.deveTotal(p.id);
    return `<p class="resumo"><b>${vs.length}</b> ${vs.length === 1 ? 'viagem' : 'viagens'}${comoCliente.length ? ` · <b>${fmt.brl(total)}</b> em compras` : ''}${deve ? ` · a receber <b class="deve">${fmt.brl(deve)}</b>` : ''}</p>`;
  }
  function avisos(p) {
    const l = PS.avisos(p.id);
    return l.length ? `<div class="avisos">${l.map((a) => `<div class="aviso ${a.tipo}"><i data-lucide="${a.tipo === 'faint' ? 'info' : 'triangle-alert'}"></i><span>${a.texto}</span></div>`).join('')}</div>` : '';
  }
  function recebimento(v) {
    const s = PS.situacao(v);
    if (s === 'cancelado') return `<span class="chip danger">Cancelada${v.devolvido ? ` · devolvido ${fmt.brl(v.devolvido)}` : ''}</span>`;
    if (s === 'pago') return '<span class="chip ok">Pago</span>';
    if (s === 'parte') return `<span class="chip laranja">Pago em parte · falta ${fmt.brl(PS.aReceber(v))}</span>`;
    return `<span class="chip laranja">A receber ${fmt.brl(v.venda)}</span>`;
  }
  const ETAPA = { Emitido: 'ok', Fechado: 'laranja', Cancelado: 'danger' };
  function viagem(v, p) {
    const ida = v.trechos[0], volta = v.trechos[v.trechos.length - 1];
    const passada = PS.diasAte(ida.data) < 0;
    const pagou = PS.pessoa(v.clienteId) || { id: v.clienteId, nome: 'outra pessoa' };
    const forma = v.forma === 'Dinheiro' ? 'Dinheiro' : `<span class="prog" data-p="${v.programa}">${esc(v.forma)}</span> <span class="faint">pontos</span>`;
    return `<article class="viagem ${passada ? 'passada' : ''}">
      <header><div><h3><a href="emissao.html?id=${v.id}" style="color:inherit;text-decoration:none">${esc(v.destino)}</a></h3><div class="datas">${fmt.dataCurta(ida.data)} a ${fmt.dataCurta(volta.data)}${!passada ? ` · ${PS.diasAte(ida.data) === 0 ? 'hoje' : `em ${PS.diasAte(ida.data)} dias`}` : ` · ${fmt.mesAno(ida.data)}`}${v.internacional ? ' · internacional' : ''}</div></div>
        <span class="chip ${ETAPA[v.etapa]}">${v.etapa === 'Fechado' ? 'Falta emitir' : v.etapa}</span></header>
      <div class="trechos">${v.trechos.map((t) => `<span><b>${t.de} → ${t.para}</b> ${fmt.dataCurta(t.data)}</span>`).join('')}</div>
      <div class="pax">${v.passageiros.length} ${v.passageiros.length > 1 ? 'passageiros' : 'passageiro'}: ${v.passageiros.map((x) => { const q = PS.pessoa(x); if (!q) return ''; return x === p.id ? `<span class="chip eu">${esc(primeiro(q.nome))}</span>` : `<a class="chip" href="pessoa.html?id=${x}">${esc(primeiro(q.nome))}</a>`; }).join('')}
        ${v.clienteId !== p.id ? `<span>· pago por <a href="pessoa.html?id=${pagou.id}" style="color:var(--text)">${esc(pagou.nome)}</a></span>` : ''}</div>
      <div class="rodape"><span>${forma}</span>${v.localizador ? `<span>Localizador <span class="loc">${esc(v.localizador)}</span></span>` : ''}<span>Venda <b>${fmt.brl(v.venda)}</b></span><span class="rec">${recebimento(v)}</span></div></article>`;
  }
  function viagens(p) {
    const vs = PS.viagensDe(p.id);
    if (!vs.length) return '<div class="card nada">Nenhuma viagem ainda.</div>';
    const prox = vs.filter((v) => PS.diasAte(v.trechos[0].data) >= 0).sort((a, b) => a.trechos[0].data.localeCompare(b.trechos[0].data));
    const ant = vs.filter((v) => PS.diasAte(v.trechos[0].data) < 0);
    return (prox.length ? `<div class="grupo-t">Próximas</div>${prox.map((v) => viagem(v, p)).join('')}` : '')
      + (ant.length ? `<div class="grupo-t">Anteriores</div>${ant.map((v) => viagem(v, p)).join('')}` : '');
  }
  function dados(p) {
    const pass = p.passaporte_numero ? { numero: p.passaporte_numero, validade: p.passaporte_validade } : null;
    const venceLogo = pass && pass.validade && PS.diasAte(pass.validade) < 180;
    const vazio = '<span class="faint">não informado</span>';
    return `<section class="card bloco"><h2>Dados <button class="btn pequeno fantasma" data-editar><i data-lucide="pencil"></i>Editar</button></h2>
      <dl class="dados">
        <dt>CPF</dt><dd class="num">${p.cpf ? fmt.cpf(p.cpf) : vazio}</dd>
        <dt>Nascimento</dt><dd>${p.nascimento ? `${fmt.data(p.nascimento)} <span class="faint">· ${idade(p.nascimento)} anos</span>` : vazio}</dd>
        <dt>WhatsApp</dt><dd class="num">${p.whatsapp ? fmt.fone(p.whatsapp) : vazio}</dd>
        <dt>E-mail</dt><dd>${p.email ? esc(p.email) : vazio}</dd>
        <dt>Passaporte</dt><dd>${pass ? `${esc(pass.numero)}${pass.validade ? `<br><span class="${venceLogo ? '' : 'faint'}" style="${venceLogo ? 'color:var(--warn)' : ''}">vale até ${fmt.data(pass.validade)}</span>` : ''}` : vazio}</dd>
        ${p.obs ? `<dd class="obs">${esc(p.obs)}</dd>` : ''}
      </dl></section>`;
  }
  function pessoasJunto(p) {
    const l = PS.viajaCom(p.id);
    return `<section class="card bloco"><h2>Viaja com <small>${l.length || ''}</small></h2>
      ${l.length ? l.map((c) => `<a class="linha" href="pessoa.html?id=${c.pessoa.id}"><span class="nm">${esc(c.pessoa.nome)}<small>${c.pagou ? 'pagou as viagens' : PS.ehCliente(c.pessoa.id) ? 'também é cliente' : 'passageiro'}</small></span>
        <span class="dir">${c.juntos ? `${c.juntos} ${c.juntos > 1 ? 'viagens' : 'viagem'} juntos` : 'não voou junto'}</span><i data-lucide="chevron-right" style="color:var(--text-3)"></i></a>`).join('') : '<div class="nada">Sempre viajou sozinho.</div>'}</section>`;
  }
  function pontos(p) {
    const { beneficiario, titular } = PS.pontos(p.id);
    return `<section class="card bloco"><h2>Contas de pontos</h2>
      <div class="sub-t" style="margin-top:0">Já voou com estas contas</div>
      ${beneficiario.length ? beneficiario.map(({ conta, ben, vagas }) => `<a class="linha" href="conta.html?id=${conta.id}"><span class="nm"><span class="prog" data-p="${conta.programa_id}">${esc(conta.programa)}</span><small>${esc(conta.titular)} · ${vagas.usados}/${vagas.limite} vagas</small></span>
        <span class="dir">última ${fmt.dataCurta(ben.ultima)}${ben.liberaEm ? `<br><span class="faint">vaga volta ${fmt.dataCurta(ben.liberaEm)}</span>` : ''}</span></a>`).join('') : '<div class="nada">Ainda não voou com pontos das contas. O primeiro voo ocupa uma vaga de beneficiário.</div>'}
      ${titular.length ? `<div class="sub-t">Titular destas contas</div>${titular.map((c) => `<a class="linha" href="conta.html?id=${c.id}"><span class="nm"><span class="prog" data-p="${c.programa_id}">${esc(c.programa)}</span></span><span class="dir num"><b style="color:var(--text)">${fmt.pts(c.saldo)}</b> pts</span></a>`).join('')}` : ''}
      <p class="faint" style="font-size:12.5px;margin:12px 0 0">Ligado pelo CPF. Quem já voou com uma conta não ocupa vaga nova nela.</p></section>`;
  }

  const variantes = {
    // A: viagens no meio e uma coluna lateral com dados, com quem viaja e as contas de pontos (como o detalhe da conta)
    A() {
      const p = PS.pessoa(id);
      if (!p) { app.innerHTML = '<a class="voltar" href="clientes.html"><i data-lucide="arrow-left"></i>Clientes</a><p class="muted">Pessoa não encontrada.</p>'; return; }
      app.innerHTML = cabecalho(p) + resumo(p) + avisos(p) + `<div class="a-grid"><div>${viagens(p)}</div><div class="a-lado">${dados(p)}${pessoasJunto(p)}${pontos(p)}</div></div>`;
    },
  };

  // ---------- ações ----------
  function ligarEventos() {
    app.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b && b.hasAttribute('data-editar')) { KVShell.irPara({ janela: 'editar' }); sincJanela(); }
    });
  }
  const dlg = document.createElement('dialog'); dlg.className = 'janela'; document.body.append(dlg);
  const fecharJanela = () => KVShell.desfazer({ janela: 1 }, sincJanela);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); fecharJanela(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fecharJanela(); });
  function sincJanela() {
    if (KVShell.param('janela') !== 'editar') { if (dlg.open) dlg.close(); return; }
    if (dlg.open) return;
    KVPessoaForm.abrir(dlg, PS.pessoa(id), { pessoas: PS.lista(), fechar: fecharJanela, aoSalvar: (p) => { PS.atualizar(p); fecharJanela(); render(); } });
  }

  function render() { variantes.A(); if (PS.pessoa(id)) document.title = `${PS.pessoa(id).nome} · K&V`; KVShell.icones(); }
  // escolhida na rodada 7: viagens + coluna lateral (A)
  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const est = await PS.carregar();
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      document.querySelector('.carregando').remove();
      app = KVShell.montar('clientes', { dono: true });
      ligarEventos();
      render();
      sincJanela();
      KVShell.aoVoltar(() => { render(); sincJanela(); });
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.textContent = e.message; }
  })();
};

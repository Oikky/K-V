/* Tela: Uma conta: extrato e beneficiários. Endereço: /conta.html
   Conta (rodada 3 dos rascunhos), lendo e gravando no banco: extrato + coluna lateral, beneficiários em bolinhas.
     Clicar nas bolinhas abre a lista e o cadastro manual numa janela; o voltar do celular/mouse fecha a janela. Sem valor em R$. Só o dono.
     Tocar numa linha do extrato abre o detalhe (?mov=id): de qual voo foi, quem voou, de quais lotes saiu, a observação
     (editável) e a linha original do documento antigo. Dali dá pra corrigir ou apagar.
     Vagas extras de beneficiário (?ben=extra): o programa liberou mais CPFs pra conta; valem até a data ou até tirar.
   O estilo desta tela está em telas/conta.css. */
KVTelas['conta'] = function () {
  let app = null, c = null, p = null, custo = null;
  const { fmt, esc } = KV;
  const params = new URLSearchParams(location.search);
  let mensagem = '';
  async function recarregar() { c = KV.adaptar(await KVApi.conta(params.get('id'))); p = KV.programa(c.programaId); custo = c.custo_real; }
  let extratoTodo = false;

  const progNome = (id) => (KV.programa(id) || {}).nome || id;
  const primeira = (t) => String(t || '').split('\n')[0].trim();
  // emissão que veio do documento antigo: o texto é livre; título = 1ª linha (passageiro) · linha da rota; localizador do "Loc:"
  function resumoAntigo(t) {
    const ls = String(t || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const rota = ls.find((l) => /\b[A-Z]{3}\b.*\ba\b.*\b[A-Z]{3}\b/i.test(l) || /\b[A-Z]{3}\s*(a|-|→|>)\s*[A-Z]{3}\b/i.test(l));
    return [ls[0], rota && rota !== ls[0] ? rota : null].filter(Boolean).join(' · ');
  }
  const locAntigo = (t) => { const r = /loc(?:alizador)?\s*:?\s*([A-Z0-9]{5,8})\b/i.exec(t || ''); return r ? r[1].toUpperCase() : ''; };
  const nomeTipo = (m) => ((m.lado === 'entrada' ? KV.entradaTipos : KV.saidaTipos)[m.tipo] || { nome: m.tipo }).nome;
  function descricao(m) {
    if (m.tipo === 'clube') return `Clube ${fmt.pts(m.pontos)}`;
    if (m.tipo === 'transferencia' && m.lado === 'entrada') return `Transferência da ${m.par_programa ? `${progNome(m.par_programa)} de ${m.par_titular}` : m.origem || 'outro programa'}${m.bonus_pct ? `, bônus de ${m.bonus_pct}%` : ''}`;
    if (m.tipo === 'transferencia') return `Transferência para ${m.par_programa ? `${progNome(m.par_programa)} de ${m.par_titular}` : 'outro programa'}`;
    if (m.tipo === 'emissao') return `Emissão ${m.emissao_id ? primeira(m.obs).replace(/\s*\([A-Z0-9]+\)$/, '') : resumoAntigo(m.obs)}`;
    if (m.tipo === 'ajuste') return `Ajuste${m.obs ? `: ${primeira(m.obs)}` : ''}`;
    return nomeTipo(m);
  }
  function detalhe(m) {
    if (m.tipo === 'emissao') return [m.passageiros, m.localizador || (!m.emissao_id && locAntigo(m.obs))].filter(Boolean).join(' · ');
    if (m.custo) return `Custo ${fmt.brl(m.custo)}`;
    if (m.lado === 'entrada' && m.vence) return `Vence em ${fmt.data(m.vence)}`;
    return '';
  }
  // a observação aparece numa linha (o resto no detalhe); emissão e ajuste já usam ela no título
  const obsLinha = (m) => (m.obs && !['emissao', 'ajuste'].includes(m.tipo) ? primeira(m.obs) : m.tipo === 'emissao' && m.obs && (!m.emissao_id || m.obs.includes('\n')) ? 'tem observação' : '');
  const linhaMov = (m) => `<button class="mov" data-mov="${m.id}" aria-haspopup="dialog"><span class="d num">${fmt.dataCurta(m.data)}</span><span class="t"><b>${esc(descricao(m))}</b></span>
    <span class="q num ${m.lado === 'entrada' ? 'mais' : ''}">${m.lado === 'entrada' ? '+' : '−'}${fmt.pts(m.pontos)}</span>
    <span class="x"><span>${esc(detalhe(m))}</span><span class="num faint">saldo ${fmt.pts(m.saldo_depois)}</span></span>
    ${obsLinha(m) ? `<span class="o"><i data-lucide="message-square-text"></i><span>${esc(obsLinha(m))}</span></span>` : ''}
    <i data-lucide="chevron-right" class="ir"></i></button>`;

  function bolinhas(b) {
    // da mais antiga pra mais nova: quem passou do limite é sempre quem entrou por último
    const ordem = [...b.lista].sort((x, y) => x.ultima.localeCompare(y.ultima));
    return `<div class="vagas-grade">${Array.from({ length: Math.max(b.limite, b.lista.length) }, (_, i) => { const x = ordem[i];
      return `<span class="vaga ${x ? (x.manual ? 'manual' : 'usada') : ''} ${i >= b.limite ? 'estourou' : ''} ${!x && i >= b.base && i < b.limite ? 'extra' : ''}" title="${x ? esc(x.nome) : i >= b.base ? 'vaga extra livre' : 'vaga livre'}${i >= b.limite ? ' (acima do limite)' : ''}">${x ? esc(fmt.iniciais(x.nome)) : !x && i >= b.base && i < b.limite ? '+' : ''}</span>`; }).join('')}</div>`;
  }
  function resumoVagas(b) {
    const cor = b.livres === 0 ? 'var(--danger)' : b.livres <= 2 ? 'var(--warn)' : 'var(--text)';
    return `<b style="color:${cor}">${b.livres} vaga${b.livres === 1 ? '' : 's'} livre${b.livres === 1 ? '' : 's'}</b>`;
  }
  const textoExtras = (b) => { const n = b.extras.reduce((s, x) => s + x.vagas, 0); return n ? ` (${b.base} + ${n} extra${n > 1 ? 's' : ''})` : ''; };
  function blocoBenef() {
    const b = KV.beneficiarios(c);
    if (!b) return `<div class="card"><h2>Beneficiários</h2><p class="muted" style="margin:6px 0 0">A Livelo não emite passagem, só transfere. Não tem limite de beneficiários.</p></div>`;
    return `<div class="card"><h2>Beneficiários <small class="num">${b.usados} de ${b.limite}${textoExtras(b)}</small></h2>
      <button class="vagas-btn" id="abrir" aria-haspopup="dialog">${bolinhas(b)}
        <div class="vagas-resumo">${resumoVagas(b)}<span style="display:inline-flex;gap:4px;align-items:center">Ver pessoas<i data-lucide="chevron-right"></i></span></div></button>
      <div class="regra">${esc(b.regra)}. O titular não conta.</div></div>`;
  }

  // janela de beneficiários: ?ben=lista mostra as pessoas; ?ben=novo o cadastro; ?ben=extra as vagas a mais (na mesma janela)
  const janela = document.createElement('dialog');
  janela.className = 'janela';
  janela.setAttribute('aria-labelledby', 'jt');
  document.body.append(janela);
  janela.addEventListener('cancel', (e) => { e.preventDefault(); ['novo', 'extra'].includes(KVShell.param('ben')) ? history.back() : fecharJanela(); }); // Esc
  janela.addEventListener('click', (e) => { if (e.target === janela) fecharJanela(); }); // clique fora
  function fecharJanela() {
    // se estava no cadastro, sai dos dois passos (cadastro e lista) de uma vez
    if (['novo', 'extra'].includes(KVShell.param('ben')) && history.state && history.state.kv) { history.go(-2); return; }
    KVShell.desfazer({ ben: 1 }, sincronizar);
  }

  function desenharJanela(modo) {
    const b = KV.beneficiarios(c);
    if (modo === 'novo') {
      janela.innerHTML = `<header><button class="btn icone" data-voltar aria-label="Voltar pra lista"><i data-lucide="arrow-left"></i></button>
          <div style="flex:1"><h2 id="jt">Adicionar beneficiário</h2><div class="sub">${esc(c.titular)} · ${p.nome}</div></div></header>
        <form class="novo-ben" id="novo">
          ${b.livres === 0 ? `<div class="aviso danger">A conta está sem vaga (${b.usados}/${b.limite}). Dá pra registrar mesmo assim, mas vai passar do limite. Se o programa liberou mais vagas, use "Vaga extra".</div>` : ''}
          <div class="campo"><label for="bnome">Nome</label><input id="bnome" required placeholder="Nome completo" autocomplete="off"></div>
          <div class="campo"><label for="bcpf">CPF</label><input id="bcpf" required inputmode="numeric" placeholder="000.000.000-00" autocomplete="off"></div>
          <div class="campo"><label for="bdata">Desde quando</label><input id="bdata" type="date" value="${KV.hoje}"><span class="ajuda">Data da emissão ou do cadastro no programa. Define quando a vaga volta.</span></div>
        </form>
        <footer><button class="btn" data-voltar>Voltar pra lista</button><button class="btn primario" type="submit" form="novo"><i data-lucide="user-plus"></i>Adicionar</button></footer>`;
      janela.querySelectorAll('[data-voltar]').forEach((x) => x.onclick = () => history.back());
      janela.querySelector('#bcpf').addEventListener('input', (e) => { e.target.value = KVPessoaForm.mascaraCpf(e.target.value); });
      janela.querySelector('#novo').onsubmit = async (e) => {
        e.preventDefault();
        const novo = { nome: janela.querySelector('#bnome').value.trim(), cpf: janela.querySelector('#bcpf').value.replace(/\D/g, ''), data: janela.querySelector('#bdata').value };
        const semVaga = KV.beneficiarios(c).livres === 0;
        try { await KVApi.acao('benef.adicionar', { conta: c.id, ...novo }); await recarregar(); }
        catch (err) { KVShell.aviso(err.message, { erro: true }); return; }
        mensagem = semVaga ? `<div class="aviso danger">${esc(novo.nome)} entrou acima do limite. O sistema avisa, mas não bloqueia.</div>`
          : `<div class="aviso ok">${esc(novo.nome)} entrou como beneficiário.</div>`;
        history.back(); // volta pra lista, que já mostra a pessoa nova
      };
      setTimeout(() => janela.querySelector('#bnome').focus(), 30);
    } else if (modo === 'extra') {
      janela.innerHTML = `<header><button class="btn icone" data-voltar aria-label="Voltar pra lista"><i data-lucide="arrow-left"></i></button>
          <div style="flex:1"><h2 id="jt">Vaga extra de beneficiário</h2><div class="sub">${esc(c.titular)} · ${p.nome} · hoje ${b.limite} vaga${b.limite > 1 ? 's' : ''}</div></div></header>
        <form class="novo-ben" id="extra">
          <p class="muted" style="margin:0;font-size:14px">Quando o programa libera mais CPFs pra esta conta. As vagas somam no limite enquanto valerem.</p>
          <div class="campo"><label for="xn">Quantas vagas a mais</label>
            <div class="passo-n-campo"><button type="button" class="btn icone" data-menos aria-label="Uma a menos"><i data-lucide="minus"></i></button><input id="xn" inputmode="numeric" value="1" aria-live="polite"><button type="button" class="btn icone" data-mais aria-label="Uma a mais"><i data-lucide="plus"></i></button></div></div>
          <div class="campo"><label for="xate">Vale até (opcional)</label><input id="xate" type="date" min="${KV.hoje}"><span class="ajuda">Sem data, vale até você tirar.</span></div>
          <div class="campo"><label for="xmot">Motivo (opcional)</label><input id="xmot" maxlength="200" placeholder="ex.: Smiles liberou 5 a mais no Diamante" autocomplete="off"></div>
        </form>
        <footer><button class="btn" data-voltar>Voltar pra lista</button><button class="btn primario" type="submit" form="extra"><i data-lucide="plus"></i>Somar vagas</button></footer>`;
      janela.querySelectorAll('[data-voltar]').forEach((x) => x.onclick = () => history.back());
      const n = janela.querySelector('#xn');
      const mudar = (d) => { n.value = Math.min(50, Math.max(1, (parseInt(n.value, 10) || 1) + d)); };
      janela.querySelector('[data-menos]').onclick = () => mudar(-1);
      janela.querySelector('[data-mais]').onclick = () => mudar(1);
      janela.querySelector('#extra').onsubmit = async (e) => {
        e.preventDefault();
        const vagas = parseInt(n.value, 10) || 0;
        try { await KVApi.acao('vaga.adicionar', { conta: c.id, vagas, ate: janela.querySelector('#xate').value || null, motivo: janela.querySelector('#xmot').value }); await recarregar(); }
        catch (err) { KVShell.aviso(err.message, { erro: true }); return; }
        mensagem = `<div class="aviso ok">+${vagas} vaga${vagas > 1 ? 's' : ''} extra${vagas > 1 ? 's' : ''}. A conta agora tem ${KV.beneficiarios(c).limite}.</div>`;
        history.back();
      };
    } else {
      janela.innerHTML = `<header><div style="flex:1"><h2 id="jt">Beneficiários</h2><div class="sub">${esc(c.titular)} · ${p.nome} · ${b.usados} de ${b.limite}${textoExtras(b)}</div></div>
          <button class="btn icone" data-fechar aria-label="Fechar"><i data-lucide="x"></i></button></header>
        <div class="corpo">${mensagem}${bolinhas(b)}<div class="vagas-resumo" style="margin-bottom:6px">${resumoVagas(b)}</div>
          <div class="regra" style="margin-bottom:10px">${esc(b.regra)}. O titular não conta.</div>
          ${b.extras.length ? `<div class="extras"><h3>Vagas extras</h3>${b.extras.map((x) => `<div class="ben"><span><b>+${x.vagas} vaga${x.vagas > 1 ? 's' : ''}</b>${x.motivo ? ` · ${esc(x.motivo)}` : ''}<br><span class="faint" style="font-size:12.5px">${x.ate ? `até ${fmt.data(x.ate)}` : 'até tirar'} · desde ${fmt.data(x.criada_em.slice(0, 10))}</span></span>
            <button class="btn pequeno fantasma" data-tirar-extra="${x.id}">Tirar</button></div>`).join('')}</div>` : ''}
          ${b.lista.map((x) => `<div class="ben"><span>${esc(x.nome)}${x.manual ? '<span class="tag-manual">registrado à mão</span>' : ''}<br><span class="faint num" style="font-size:12.5px">${fmt.cpf(x.cpf)}</span></span>
            <span class="l">${x.liberaEm ? `libera em<br><span class="num">${fmt.data(x.liberaEm)}</span>` : 'só por troca manual'}</span></div>`).join('') || '<p class="faint">Ninguém voou com esta conta ainda.</p>'}</div>
        <footer><button class="btn" data-extra><i data-lucide="circle-plus"></i>Vaga extra</button><button class="btn primario" data-novo><i data-lucide="user-plus"></i>Adicionar beneficiário</button></footer>`;
      janela.querySelector('[data-fechar]').onclick = fecharJanela;
      janela.querySelector('[data-novo]').onclick = () => { mensagem = ''; KVShell.irPara({ ben: 'novo' }); sincronizar(); };
      janela.querySelector('[data-extra]').onclick = () => { mensagem = ''; KVShell.irPara({ ben: 'extra' }); sincronizar(); };
      janela.querySelectorAll('[data-tirar-extra]').forEach((bt) => bt.onclick = async () => {
        const vid = +bt.dataset.tirarExtra;
        try { await KVApi.acao('vaga.desligar', { id: vid }); await recarregar(); }
        catch (err) { KVShell.aviso(err.message, { erro: true }); return; }
        mensagem = ''; desenharJanela('lista'); desenhar();
        KVShell.aviso('Vaga extra tirada', { desfazer: async () => { await KVApi.acao('vaga.religar', { id: vid }); await recarregar(); desenharJanela('lista'); desenhar(); } });
      });
    }
    KVShell.icones();
  }

  // ---------- detalhe de um movimento (?mov=id) ----------
  const det = document.createElement('dialog');
  det.className = 'janela lateral mov-det';
  det.setAttribute('aria-labelledby', 'mt');
  document.body.append(det);
  det.addEventListener('cancel', (e) => { e.preventDefault(); fecharDet(); });
  det.addEventListener('click', (e) => { if (e.target === det) fecharDet(); });
  const fecharDet = () => KVShell.desfazer({ mov: 1 }, sincronizar);
  let movAberto = null, modoDet = 'ver', carregandoMov = null;

  const quando = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`; };
  const dataCoda = (v) => { const d = new Date(v); if (isNaN(d)) return String(v); const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); return d.toLocaleDateString('pt-BR') + (h !== '00:00' ? ` ${h}` : ''); };
  const textoCoda = (v) => (v && typeof v === 'object' ? v.nome || '' : String(v ?? ''));
  const dl = (pares) => { const l = pares.filter(([, v]) => v != null && v !== ''); return l.length ? `<dl class="dados">${l.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''; };
  // o que dá pra corrigir em cada tipo (o servidor confere de novo)
  const podePontos = (m) => (m.lado === 'entrada' ? !m.par_id : ['expiracao', 'ajuste'].includes(m.tipo) || (m.tipo === 'emissao' && !m.emissao_id));
  const temCusto = (m) => m.lado === 'entrada' && !m.par_id && (KV.entradaTipos[m.tipo] || {}).temCusto;
  // saída de uma emissão feita no sistema: corrige e desfaz pela tela da emissão (a do documento antigo corrige aqui)
  const daEmissao = (m) => m.lado === 'saida' && m.tipo === 'emissao' && !!m.emissao_id;

  function blocoVoo(m) {
    const e = m.emissao;
    if (!e) return '';
    const v = e.voo, r = e.rota;
    const rota = r ? `${esc(r.de)} → ${esc(r.para)}` : '';
    return `<section class="sec"><h3>${m.lado === 'entrada' ? 'Pontos que voltaram deste voo cancelado' : 'Voo que esses pontos pagaram'}</h3>
      <div class="voo-det"><span class="rota">${rota}</span>${e.cancelada ? '<span class="etiqueta danger">cancelada</span>' : ''}
        ${v ? `<span class="hora">${esc(v.sai)} → ${esc(v.chega)}</span><span class="faint">${[fmt.data(v.data), v.cia, v.voo, v.escalas ? `${v.escalas} escala${v.escalas > 1 ? 's' : ''}` : 'direto', v.duracao].filter(Boolean).map(esc).join(' · ')}</span>` : ''}</div>
      ${dl([['Localizador', `<span class="loc-t">${esc(e.localizador)}</span>`], ['Cliente', esc(e.contato || '')], ['Passageiros', e.passageiros.map((x) => esc(x.nome)).join('<br>')],
        ['Emitido em', quando(e.em)], e.cancelada ? ['Cancelada em', quando(e.cancelada_em)] : null, e.cancelada ? ['Devolvido ao cliente', e.devolvido ? fmt.brl(e.devolvido) : 'nada'] : null].filter(Boolean))}
      ${e.obs ? `<p class="obs-txt">${esc(e.obs)}</p>` : ''}
      <a class="btn pequeno" href="emissao.html?id=${e.orcamento_id}"><i data-lucide="ticket"></i>Abrir o orçamento #${e.orcamento_id}</a></section>`;
  }
  function blocoCoda(m) {
    if (!m.coda || m.coda.tabela !== 'Saída') return '';
    const d = m.coda.dados;
    const pares = [['Passageiro', esc(textoCoda(d.Passageiro))], ['Origem e destino', esc(textoCoda(d['Origem-Destino']))], ['Companhia', esc(textoCoda(d.CIA))],
      ['Localizador', d.Localizador ? `<span class="loc-t">${esc(textoCoda(d.Localizador))}</span>` : ''], ['Ida', d['Dia/hora Ida'] ? dataCoda(d['Dia/hora Ida']) : ''],
      ['Volta', d['Dia/hora Volta'] ? dataCoda(d['Dia/hora Volta']) : ''], ['Pagamento', esc(textoCoda(d.Pagamento))]];
    const corpo = dl(pares);
    return corpo ? `<section class="sec"><h3>Do documento antigo</h3>${corpo}</section>` : '';
  }
  function blocoLotes(m) {
    if (m.lado === 'saida' && m.lotes.length) return `<section class="sec"><h3>Saiu destes lotes</h3>${m.lotes.map((l) => `<div class="ben"><span>${esc(nomeTipo({ lado: 'entrada', tipo: l.tipo }))}${l.origem ? ` da ${esc(l.origem)}` : ''} de ${fmt.data(l.data)}<br><span class="faint" style="font-size:12.5px">${l.vence ? `vence em ${fmt.data(l.vence)}` : 'sem vencimento'}</span></span><span class="l num">${fmt.pts(l.pontos)} pts</span></div>`).join('')}</section>`;
    if (m.lado === 'entrada') {
      const usado = m.pontos - (m.resta ?? m.pontos);
      return `<section class="sec"><h3>Este lote</h3>${dl([['Vence em', m.vence ? fmt.data(m.vence) : 'sem data'], ['Ainda tem', `${fmt.pts(m.resta ?? 0)} de ${fmt.pts(m.pontos)} pts`], temCusto(m) || m.custo ? ['Custo', fmt.brl(m.custo || 0)] : null, m.bonus_pct ? ['Bônus', `${m.bonus_pct}%`] : null].filter(Boolean))}
        ${m.usos.length ? `<h3 style="margin-top:14px">Usado em</h3>${m.usos.map((u) => `<div class="ben"><span>${esc(u.tipo === 'emissao' ? `Emissão ${primeira(u.obs).replace(/\s*\([A-Z0-9]+\)$/, '')}` : nomeTipo({ lado: 'saida', tipo: u.tipo }))}<br><span class="faint" style="font-size:12.5px">${fmt.data(u.data)}</span></span><span class="l num">${fmt.pts(u.pontos)} pts</span></div>`).join('')}`
          : usado ? `<p class="faint" style="font-size:13px;margin:8px 0 0">${fmt.pts(usado)} pts já foram usados (antes do sistema anotar de qual lote sai cada saída).</p>` : ''}</section>`;
    }
    return '';
  }
  function blocoPar(m) {
    if (!m.par) return '';
    return `<section class="sec"><h3>${m.lado === 'saida' ? 'Chegou em' : 'Veio de'}</h3><a class="par" href="conta.html?id=${m.par.conta_id}"><span><b>${esc(m.par.titular)}</b> · ${esc(m.par.programa)}</span><span class="num">${m.par.lado === 'entrada' ? '+' : '−'}${fmt.pts(m.par.pontos)} pts</span><i data-lucide="chevron-right"></i></a></section>`;
  }

  function desenharDet() {
    const m = movAberto;
    if (!m) {
      det.innerHTML = `<header><div style="flex:1"><h2 id="mt">Carregando…</h2></div><button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>
        <div class="corpo"><div class="esqueleto"></div><div class="esqueleto"></div><div class="esqueleto curto"></div></div>`;
      det.querySelector('[data-x]').onclick = fecharDet; KVShell.icones(); return;
    }
    const titulo = descricao({ ...m, par_programa: m.par && KV.programas().find((x) => x.nome === m.par.programa)?.id, par_titular: m.par && m.par.titular });
    const head = `<header><div style="flex:1;min-width:0"><h2 id="mt">${esc(titulo)}</h2><div class="sub">${fmt.data(m.data)} · ${esc(m.titular)} · ${esc(m.programa)}</div></div><button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>`;
    let corpo, pe;
    if (modoDet === 'editar') {
      corpo = `<form class="form-mov" id="fmov" novalidate>
        <div class="campo"><label for="md">Data</label><input id="md" type="date" value="${m.data}"></div>
        ${podePontos(m) ? `<div class="campo"><label for="mp">Pontos</label><input id="mp" inputmode="numeric" autocomplete="off" value="${fmt.pts(m.pontos)}">${m.lado === 'entrada' && m.resta < m.pontos ? `<span class="ajuda">Já saíram ${fmt.pts(m.pontos - m.resta)} pts deste lote; não dá pra pôr menos que isso.</span>` : ''}</div>`
          : `<p class="faint" style="font-size:13px;margin:0">${daEmissao(m) ? 'Pontos e conta de uma emissão se corrigem desfazendo a emissão.' : 'Numa transferência, os pontos se corrigem apagando e lançando de novo.'}</p>`}
        ${temCusto(m) ? `<div class="campo"><label for="mc">Custo</label><div class="caixa"><span>R$</span><input id="mc" inputmode="decimal" autocomplete="off" value="${m.custo ? (m.custo / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}" placeholder="0"></div></div>` : ''}
        ${m.lado === 'entrada' && !m.par_id ? `<div class="campo"><label for="mv">Vence em</label><input id="mv" type="date" value="${m.vence || ''}"></div>` : ''}
        <div class="campo"><label for="mo">Observação</label><textarea id="mo" rows="5" maxlength="2000">${esc(m.obs || '')}</textarea></div></form>`;
      pe = `<button class="btn" data-modo="ver">Voltar</button><button class="btn primario" type="submit" form="fmov"><i data-lucide="check"></i>Salvar correção</button>`;
    } else if (modoDet === 'apagar') {
      const usado = m.lado === 'entrada' && m.resta < m.pontos;
      corpo = `<div class="confirma-apagar"><i data-lucide="trash-2"></i><p><b>Apagar ${m.lado === 'entrada' ? 'esta entrada' : 'esta saída'} de ${fmt.pts(m.pontos)} pts?</b><br>
        ${usado ? `Não dá: já saíram ${fmt.pts(m.pontos - m.resta)} pts deste lote. Apague antes as saídas que usaram ele.`
          : m.par ? `É uma transferência: apaga também a ${m.par.lado === 'entrada' ? 'entrada' : 'saída'} de ${fmt.pts(m.par.pontos)} pts na conta de ${esc(m.par.titular)} (${esc(m.par.programa)}).`
          : m.lado === 'saida' ? 'Os pontos voltam pros lotes de onde saíram, com os mesmos vencimentos.' : 'O saldo da conta diminui nesse valor.'}
        <br>Fica anotado no histórico.</p></div>`;
      pe = `<button class="btn" data-modo="ver">Não, voltar</button>${usado ? '' : '<button class="btn primario perigo" data-apagar><i data-lucide="trash-2"></i>Sim, apagar</button>'}`;
    } else {
      corpo = `<div class="mov-num ${m.lado === 'entrada' ? 'mais' : ''}">${m.lado === 'entrada' ? '+' : '−'}${fmt.pts(m.pontos)}<small>pts</small></div>
        ${blocoVoo(m)}${blocoCoda(m)}
        ${daEmissao(m) ? '' : `<section class="sec"><h3><label for="mobs">Observação</label></h3><textarea id="mobs" class="obs-edit" rows="${Math.min(10, Math.max(3, String(m.obs || '').split('\n').length + 1))}" maxlength="2000" placeholder="Escreva aqui o que vale lembrar sobre este lançamento">${esc(m.obs || '')}</textarea>
          <div class="obs-pe" hidden><button class="btn pequeno" data-obs-desfaz>Descartar</button><button class="btn pequeno primario" data-obs-salva><i data-lucide="check"></i>Salvar observação</button></div></section>`}
        ${blocoLotes(m)}${blocoPar(m)}
        <p class="meta">${m.criado_por === 'superhuman' ? 'Veio do Superhuman Docs' : `Lançado por ${esc(m.lancado_por || m.criado_por)}`} em ${quando(m.criado_em)}</p>`;
      pe = daEmissao(m) ? `<span class="faint" style="font-size:13px">Pra corrigir ou desfazer, use o menu do voo na emissão.</span>${m.emissao ? `<a class="btn" href="emissao.html?id=${m.emissao.orcamento_id}">Ir pra emissão</a>` : ''}`
        : `<button class="btn fantasma perigo-t" data-modo="apagar"><i data-lucide="trash-2"></i>Apagar</button><button class="btn" data-modo="editar"><i data-lucide="pencil"></i>Corrigir</button>`;
    }
    det.innerHTML = `${head}<div class="corpo">${corpo}</div><footer>${pe}</footer>`;
    det.querySelector('[data-x]').onclick = fecharDet;
    det.querySelectorAll('[data-modo]').forEach((b) => b.onclick = () => { modoDet = b.dataset.modo; desenharDet(); });
    ligarDet(m);
    KVShell.icones();
  }

  async function gravarMov(dados, recado) {
    await KVApi.acao('mov.editar', { id: movAberto.id, ...dados });
    movAberto = await KVApi.movimento(movAberto.id);
    await recarregar(); desenhar();
    modoDet = 'ver'; desenharDet();
    if (recado) KVShell.aviso(recado);
  }
  function ligarDet(m) {
    const obs = det.querySelector('#mobs');
    if (obs) {
      const pe = det.querySelector('.obs-pe');
      obs.oninput = () => { pe.hidden = obs.value === (m.obs || ''); };
      det.querySelector('[data-obs-desfaz]').onclick = () => { obs.value = m.obs || ''; pe.hidden = true; };
      det.querySelector('[data-obs-salva]').onclick = async () => {
        const antes = m.obs || '';
        try {
          await gravarMov({ obs: obs.value }, null);
        } catch (err) { KVShell.aviso(err.message, { erro: true }); return; }
        const id = m.id;
        KVShell.aviso('Observação salva', { desfazer: async () => { await KVApi.acao('mov.editar', { id, obs: antes }); if (movAberto && movAberto.id === id) movAberto = await KVApi.movimento(id); await recarregar(); desenhar(); if (det.open) desenharDet(); } });
      };
    }
    const f = det.querySelector('#fmov');
    if (f) f.onsubmit = async (ev) => {
      ev.preventDefault();
      const v = (sel) => { const el = det.querySelector(sel); return el ? el.value : null; };
      const dados = { data: v('#md'), obs: v('#mo') };
      if (det.querySelector('#mp')) dados.pontos = Number(v('#mp').replace(/\D/g, ''));
      if (det.querySelector('#mc')) dados.custo = KVOrc.lerReais(v('#mc')) || 0;
      if (det.querySelector('#mv') && v('#mv')) dados.vence = v('#mv');
      try { await gravarMov(dados, 'Correção salva'); } catch (err) { KVShell.aviso(err.message, { erro: true }); }
    };
    const ap = det.querySelector('[data-apagar]');
    if (ap) ap.onclick = async () => {
      try { await KVApi.acao('mov.apagar', { id: m.id }); }
      catch (err) { KVShell.aviso(err.message, { erro: true }); return; }
      await recarregar();
      movAberto = null; modoDet = 'ver';
      fecharDet();
      KVShell.aviso(`${m.lado === 'entrada' ? 'Entrada' : 'Saída'} apagada${m.lado === 'saida' ? ': os pontos voltaram pros lotes' : ''}`);
    };
  }
  async function abrirMov(id) {
    if (!det.open) det.showModal();
    if (movAberto && movAberto.id === id) { desenharDet(); return; }
    movAberto = null; modoDet = 'ver'; desenharDet();
    const pedido = carregandoMov = KVApi.movimento(id);
    try { const m = await pedido; if (carregandoMov !== pedido) return; movAberto = m; desenharDet(); }
    catch (err) { KVShell.aviso(err.message, { erro: true }); fecharDet(); }
  }

  // a URL manda: desenha a página e abre/fecha as janelas conforme ?ben=, ?mov= e ?extrato=
  function sincronizar() {
    extratoTodo = KVShell.param('extrato') === 'todo';
    desenhar();
    const modo = KVShell.param('ben');
    if (['lista', 'novo', 'extra'].includes(modo)) { desenharJanela(modo); if (!janela.open) janela.showModal(); }
    else if (janela.open) { janela.close(); mensagem = ''; }
    const mov = Number(KVShell.param('mov'));
    if (mov) abrirMov(mov);
    else if (det.open) { det.close(); movAberto = null; modoDet = 'ver'; }
  }
  KVShell.aoVoltar(() => { if (app) sincronizar(); });

  function desenhar() {
    const v = KV.vencendo(c);
    const movs = [...c.movimentos].reverse();
    app.innerHTML = `<a class="voltar" href="contas.html"><i data-lucide="arrow-left"></i>Contas de pontos</a>
      <div class="topo"><div><h1>${esc(c.titular)}</h1><div class="muted"><span class="prog" data-p="${c.programaId}">${p.nome}</span>${c.categoria ? ` · categoria ${c.categoria}` : ''}${c.clube ? ` · clube de ${fmt.pts(c.clube)}/mês` : ''}</div>${c.obs ? `<div class="muted" style="margin-top:4px">${esc(c.obs)}</div>` : ''}</div>
      <div class="acoes"><select class="trocar" aria-label="Ver outra conta" onchange="KVRota.ir('?id='+this.value)">
        ${KV.contas().map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.titular)} · ${KV.programa(x.programaId).nome}</option>`).join('')}</select>
        <a class="btn" href="saida.html?conta=${c.id}"><i data-lucide="minus"></i>Saída</a><a class="btn primario" href="entrada.html?conta=${c.id}"><i data-lucide="plus"></i>Entrada</a></div></div>
      <div class="extrato">
        <section class="card"><div style="display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap;margin-bottom:14px">
          <div><div class="muted" style="font-size:13px">Saldo</div><div class="saldo-grande num">${fmt.pts(c.saldo)}<small>pts</small></div></div>
          ${v.pontos ? `<span class="chip warn"><i data-lucide="hourglass"></i>${fmt.pts(v.pontos)} vencem em ${KV.diasAte(v.primeiro)} dias</span>` : ''}</div>
          <h2 style="margin:18px 0 4px">Extrato <small class="faint" style="font:600 13px var(--font)">toque numa linha pra ver tudo</small></h2>${movs.length ? '' : '<p class="faint">Nenhuma movimentação ainda.</p>'}<div class="movs">${(extratoTodo ? movs : movs.slice(0, 8)).map(linhaMov).join('')}</div>
          ${movs.length > 8 ? `<button class="btn" id="todo" style="margin-top:12px">${extratoTodo ? 'Mostrar só as últimas' : `Ver as ${movs.length} movimentações`}</button>` : ''}</section>
        <aside class="lado">${blocoBenef()}
          <div class="card"><h2>Vencimentos <small>próximos lotes</small></h2>
            ${c.lotes.length ? '' : '<p class="faint" style="margin:6px 0 0">Sem pontos guardados.</p>'}${c.lotes.slice(0, 5).map((l) => { const d = l.vence ? KV.diasAte(l.vence) : 9999; return `<div class="ben"><span>${fmt.pts(l.resta)} pts<br><span class="faint" style="font-size:12.5px">${esc(l.origem)} de ${fmt.data(l.data)}</span></span>
              <span class="l" style="${d <= 60 ? 'color:var(--warn);font-weight:700' : ''}">${l.vence ? fmt.data(l.vence) : 'sem data'}${d <= 60 ? `<br>em ${d} dias` : ''}</span></div>`; }).join('')}</div>
          <div class="card"><h2>Valor da milha</h2><dl class="dados">
            <dt>Usado na cotação</dt><dd class="num">${p.valorMilha ? fmt.milha(p.valorMilha) : '—'}</dd>
            <dt>Custo real desta conta</dt><dd class="num">${custo ? fmt.milha(custo) : '—'}</dd></dl></div>
        </aside></div>`;

    const abrir = app.querySelector('#abrir');
    if (abrir) abrir.onclick = () => { mensagem = ''; KVShell.irPara({ ben: 'lista' }); sincronizar(); };
    const todo = app.querySelector('#todo');
    if (todo) todo.onclick = () => { if (extratoTodo) KVShell.desfazer({ extrato: 1 }, sincronizar); else { KVShell.irPara({ extrato: 'todo' }); sincronizar(); } };
    app.querySelectorAll('[data-mov]').forEach((b) => {
      b.onclick = () => { KVShell.irPara({ mov: b.dataset.mov }); sincronizar(); };
      // passar o mouse já começa a buscar o detalhe
      b.onpointerenter = () => KVApi.adiantar('/api/movimento?id=' + b.dataset.mov);
    });
    KVShell.icones();
  }
  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const est = await KV.carregar();
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      if (!params.get('id') && KV.contas()[0]) params.set('id', KV.contas()[0].id);
      await recarregar();
      document.querySelector('.carregando').remove();
      app = KVShell.montar('contas', { dono: true });
      sincronizar();
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.innerHTML = `${esc(e.message)} <a href="contas.html" style="color:var(--orange)">Voltar pras contas</a>`; }
  })();
};

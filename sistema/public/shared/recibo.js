/* Recibo: o último passo da emissão (rascunho v2/proposta.html, emissão ev=1).
   O sistema monta os dados no mesmo formato do recibo-kv (o "D") com o que já sabe do orçamento; tudo pode ser corrigido à mão
   antes de baixar. A folha e o PDF são os do recibo de hoje (shared/recibo-folha.js); os dados da empresa vêm do banco.
   Só o bloco de pagamento mudou (decisão de 2026-11-15): faixa azul com linhas pontilhadas e o que falta pagar grande embaixo.
   Uso (telas/emissao.js): KVRecibo.passo(o) devolve o html do passo; KVRecibo.ligar(app, o) liga os campos e desenha a prévia. */
(function () {
  const O = KVOrc, P = KVProp, { esc, fmt } = KVOrc;
  const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const reais = (c) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dLonga = (iso) => iso.split('-').reverse().join('/');
  const diaMais = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return O.isoDia(d); };
  const lugar = (cod) => { const c = O.cidadeCurta(cod); return c && c !== cod ? `${c} (${cod})` : cod; };
  const FORMAS_R = [['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['cartao', 'Cartão à vista'], ['parcelado', 'Cartão parcelado']];

  // um recibo por orçamento aberto: o que foi mexido à mão fica até "Refazer com os dados do sistema"
  let RD = null, doOrc = null, mexido = false, celular = false, empresa = null;

  // ---------- os dados do recibo a partir do orçamento ----------
  function montarD(o) {
    const vs = P.trechosVoo(o), c = P.aceita(o);
    const op = (ti) => P.op(o, c.escolha[ti]);
    const locs = vs.map((ti) => { const e = o.emissoes.find((x) => x.trecho === ti && !x.cancelada); return e ? e.localizador : ''; });
    const cias = vs.map((ti) => op(ti).cia || op(ti).site);
    // mesmo localizador (ou mesma cia) em todos os voos vai no "geral"; diferente, vai em cada trecho
    const mesmoLoc = !!locs[0] && locs.every((l) => l === locs[0]), mesmaCia = cias.every((x) => x === cias[0]);
    const v = P.valorFinal(o) || 0, r = Math.min(v, o.receb.recebido || 0);
    return {
      passageiros: o.passageirosLista.map((p) => p.nome), locGeral: mesmoLoc ? locs[0] : '', ciaGeral: mesmaCia ? cias[0] : '',
      trechos: vs.map((ti, k) => { const x = op(ti), t = o.trechos[ti], mais = /\+(\d)$/.exec(x.chega);
        return { locEsp: mesmoLoc ? '' : locs[k], ciaEsp: mesmaCia ? '' : cias[k],
          partida: lugar(x.de || t.de), dataPartida: dLonga(x.data), horaPartida: x.sai,
          destino: lugar(x.para || t.para), dataChegada: dLonga(diaMais(x.data, mais ? +mais[1] : 0)), horaChegada: x.chega.replace(/ \+\d$/, ''),
          paradas: (x.escalasOnde || []).filter((e) => e[0]).map((e) => (e[1] ? `${e[0]} - ${e[1]}` : e[0])),
          duracaoTotal: x.duracao || '',
          bagEsp: [x.mala_mao === 0 ? 'Mala de mão não inclusa' : 'Mala de mão inclusa', x.bagagem ? `${x.bagagem} mala${x.bagagem > 1 ? 's' : ''} despachada${x.bagagem > 1 ? 's' : ''} inclusa${x.bagagem > 1 ? 's' : ''}` : 'Mala despachada não inclusa'] }; }),
      hospedagens: [], bagGeral: [], informacoes: '', valor: brl(v), pagamento: [],
      pag: { total: reais(v), forma: o.receb.forma === 'parcelado' ? 'parcelado' : o.receb.forma || 'pix', parcelas: String(o.receb.parcelas || ''), pago: reais(r) },
    };
  }

  // ---------- bloco de pagamento da folha ----------
  function contaPag(p) {
    const t = O.lerReais(p.total) || 0, pg = Math.min(t, O.lerReais(p.pago) || 0), n = Math.max(1, +p.parcelas || 1);
    const forma = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão de crédito à vista', parcelado: `Cartão de crédito em ${n}x de ${brl(Math.round(t / n))}` }[p.forma] || '';
    const quit = t > 0 && pg >= t;
    return { t, pg, falta: t - pg, forma, quit, selo: quit ? '✓ Pago' : pg ? 'Pago em parte' : 'A pagar' };
  }
  const pagHtml = (k) => `<div class="bloco pg-d"><div class="pg-d-cab"><span class="pg-rot">💰 PAGAMENTO</span><span class="pg-selo ${k.quit ? 'ok' : ''}">${k.selo}</span></div>
    <div class="pg-l"><span>Valor da viagem</span><i></i><b>${brl(k.t)}</b></div><div class="pg-l"><span>Forma de pagamento</span><i></i><b>${esc(k.forma)}</b></div>
    ${k.pg && !k.quit ? `<div class="pg-l"><span>Já pago</span><i></i><b>− ${brl(k.pg)}</b></div>` : ''}
    <div class="pg-d-tot"><span class="pg-rot">${k.quit ? 'PAGAMENTO QUITADO' : k.pg ? 'FALTA PAGAR' : 'TOTAL A PAGAR'}</span><b>${brl(k.quit ? k.t : k.falta)}</b></div></div>`;
  KVRecibo.pagamento = (D) => pagHtml(contaPag(D.pag));

  // ---------- formulário: cada campo aponta pro lugar no D (data-d="trechos.0.partida"); data-l = uma linha por item ----------
  const campo = (cam, rot, cls = '', ph = '') => { const v = cam.split('.').reduce((x, k) => (x == null ? x : x[k]), RD) ?? '';
    return `<label class="r-c ${cls}"><span>${rot}</span>${Array.isArray(v) ? `<textarea data-d="${cam}" data-l rows="${Math.max(2, v.length)}" placeholder="${esc(ph || 'uma linha por item')}">${esc(v.join('\n'))}</textarea>` : `<input data-d="${cam}" value="${esc(v)}" placeholder="${esc(ph)}">`}</label>`; };
  const grupo = (titulo, corpo, extra = '') => `<fieldset class="r-g"><legend>${titulo}${extra}</legend>${corpo}</fieldset>`;

  function passo(o) {
    if (doOrc !== o.id) { doOrc = o.id; mexido = false; RD = null; }
    if (!mexido || !RD) RD = montarD(o);
    const vs = P.trechosVoo(o), falta = vs.filter((ti) => !o.emissoes.some((e) => e.trecho === ti)).length;
    const semEmpresa = empresa && !empresa.cnpj && !empresa.tel;
    return `<div class="r-grid"><div class="r-esq"><div class="r-cab"><h3>Recibo</h3><small data-r-estado>${mexido ? 'editado à mão' : 'preenchido pelo sistema'}</small>
        ${mexido ? '<button class="btn fantasma r-refaz" data-refaz-recibo><i data-lucide="rotate-ccw"></i>Refazer com os dados do sistema</button>' : ''}</div>
      ${falta ? `<small class="r-aviso">Falta emitir ${falta} voo${falta > 1 ? 's' : ''}: o localizador ainda fica vazio.</small>` : ''}
      ${semEmpresa ? '<small class="r-aviso">Os dados da empresa (CNPJ, telefone, logo) ainda não foram preenchidos. <a href="empresa.html" style="color:var(--orange)">Preencher em Configurações</a></small>' : ''}
      ${grupo('Passageiros', campo('passageiros', 'Um nome por linha', 'r-full'))}
      ${grupo('Localizador e cia', campo('locGeral', 'Localizador geral', '', 'vazio = um por trecho') + campo('ciaGeral', 'Cia aérea geral'))}
      ${RD.trechos.map((t, i) => grupo(`Trecho ${i + 1}`, campo(`trechos.${i}.locEsp`, 'Localizador') + campo(`trechos.${i}.ciaEsp`, 'Cia aérea')
        + campo(`trechos.${i}.partida`, 'Partida', 'r-full') + campo(`trechos.${i}.dataPartida`, 'Data') + campo(`trechos.${i}.horaPartida`, 'Hora')
        + campo(`trechos.${i}.destino`, 'Destino', 'r-full') + campo(`trechos.${i}.dataChegada`, 'Data') + campo(`trechos.${i}.horaChegada`, 'Hora')
        + campo(`trechos.${i}.paradas`, 'Paradas', 'r-full', 'ex.: São Paulo (GRU) - 1h05') + campo(`trechos.${i}.duracaoTotal`, 'Duração total')
        + campo(`trechos.${i}.bagEsp`, 'Bagagem', 'r-full'))).join('')}
      ${RD.hospedagens.map((h, i) => grupo(`Hospedagem ${i + 1}`, campo(`hospedagens.${i}.codigo`, 'Código de confirmação', 'r-full') + campo(`hospedagens.${i}.local`, 'Hotel', 'r-full') + campo(`hospedagens.${i}.cidade`, 'Cidade', 'r-full')
        + campo(`hospedagens.${i}.entrada`, 'Entrada', '', 'dd/mm/aaaa') + campo(`hospedagens.${i}.horaEntrada`, 'Hora', '', '14:00') + campo(`hospedagens.${i}.saida`, 'Saída', '', 'dd/mm/aaaa') + campo(`hospedagens.${i}.horaSaida`, 'Hora', '', '12:00')
        + campo(`hospedagens.${i}.incluso`, 'O que está incluso', 'r-full', 'ex.: café da manhã'), `<button class="btn-x" data-tira-hosp="${i}" aria-label="Tirar a hospedagem ${i + 1}"><i data-lucide="x"></i></button>`)).join('')}
      <button class="btn r-add" data-add-hosp><i data-lucide="hotel"></i>Adicionar hospedagem</button>
      ${grupo('Bagagem e informações', campo('bagGeral', 'Franquia de bagagem geral', 'r-full') + `<label class="r-c r-full"><span>Informações</span><textarea data-d="informacoes" rows="3" placeholder="ex.: chegar 2h antes, documento com foto">${esc(RD.informacoes)}</textarea></label>`)}
      ${grupo('Valor e pagamento', campo('pag.total', 'Valor total (R$)') + campo('pag.pago', 'Já pago (R$)')
        + `<label class="r-c ${RD.pag.forma === 'parcelado' ? '' : 'r-full'}"><span>Forma</span><select data-d="pag.forma" data-combo="nao">${FORMAS_R.map(([k, n]) => `<option value="${k}" ${k === RD.pag.forma ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
        + (RD.pag.forma === 'parcelado' ? campo('pag.parcelas', 'Parcelas') : ''))}</div>
    <div class="r-dir"><div class="r-barra"><div class="seg" role="group" aria-label="Formato"><button data-r-fmt="0" aria-pressed="${!celular}">A4</button><button data-r-fmt="1" aria-pressed="${celular}">Celular</button></div>
        <button class="btn primario" data-baixa-recibo><i data-lucide="file-down"></i>Baixar PDF</button></div>
      <div class="r-prev"><div class="r-folha" data-folha></div></div></div></div>`;
  }

  // ---------- prévia: a folha tem largura fixa (680, ou 390 no celular); aqui ela é reduzida pra caber ----------
  function desenhar(app) {
    const box = app.querySelector('[data-folha]'); if (!box) return;
    const r = KVRecibo.montar(box, RD, celular), k = Math.min(1, (box.parentElement.clientWidth - 24) / r.offsetWidth);
    r.style.zoom = k;
  }
  // html2canvas e jsPDF só são baixados quando alguém abre o recibo
  const scripts = {};
  const carregar = (src) => (scripts[src] = scripts[src] || new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete scripts[src]; erro(new Error('Não deu pra baixar o gerador de PDF; confira a internet')); }; document.head.append(s); }));
  const fonte = () => { if (!document.querySelector('link[data-sora]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.sora = '1'; l.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap'; document.head.append(l); } };

  // liga uma vez por tela (a emissão redesenha o miolo, mas o app é o mesmo); o orçamento mais novo fica em oAtual
  const ligados = new WeakSet();
  let oAtual = null;
  function redesenhar(app, foco) {
    const g = app.querySelector('.r-grid'); if (!g) return;
    const tmp = document.createElement('div'); tmp.innerHTML = passo(oAtual); g.replaceWith(tmp.firstElementChild);
    KVShell.icones(); desenhar(app); const f = foco && app.querySelector(foco); if (f) f.focus();
  }
  async function ligar(app, o) {
    oAtual = o; fonte();
    if (!empresa) { try { empresa = await KVApi.empresa(); } catch (e) { empresa = {}; } KVRecibo.empresa(empresa); if (!empresa.cnpj && !empresa.tel) redesenhar(app); }
    desenhar(app);
    const prev = app.querySelector('.r-prev'); if (prev) new ResizeObserver(() => desenhar(app)).observe(prev);
    if (ligados.has(app)) return;
    ligados.add(app);
    app.addEventListener('input', (e) => {
      const el = e.target; if (el.dataset.d == null || !RD || !app.querySelector('.r-grid')) return;
      const ks = el.dataset.d.split('.'), ult = ks.pop(), alvo = ks.reduce((x, k) => x[k], RD);
      alvo[ult] = el.hasAttribute('data-l') ? el.value.split('\n').map((x) => x.trim()).filter(Boolean) : el.value;
      if (!mexido) { mexido = true; const c = app.querySelector('[data-r-estado]'); if (c) c.textContent = 'editado à mão'; }
      desenhar(app);
    });
    app.addEventListener('change', (e) => { if (e.target.dataset.d === 'pag.forma') redesenhar(app, '[data-d="pag.forma"]'); });
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b || !app.querySelector('.r-grid')) return;
      if (b.hasAttribute('data-add-hosp')) { RD.hospedagens.push({ codigo: '', local: '', cidade: '', entrada: '', horaEntrada: '', saida: '', horaSaida: '', incluso: '' }); mexido = true; redesenhar(app, `[data-d="hospedagens.${RD.hospedagens.length - 1}.codigo"]`); }
      else if (b.dataset.tiraHosp != null) { RD.hospedagens.splice(+b.dataset.tiraHosp, 1); redesenhar(app, '[data-add-hosp]'); }
      else if (b.hasAttribute('data-refaz-recibo')) { mexido = false; redesenhar(app); }
      else if (b.dataset.rFmt != null) { celular = b.dataset.rFmt === '1'; app.querySelectorAll('[data-r-fmt]').forEach((x) => x.setAttribute('aria-pressed', x === b)); desenhar(app); }
      else if (b.hasAttribute('data-baixa-recibo')) {
        const txt = b.innerHTML; b.disabled = true; b.innerHTML = '<i data-lucide="loader"></i>Gerando o PDF…'; KVShell.icones();
        try {
          await Promise.all([carregar('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'), carregar('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')]);
          await KVRecibo.pdf(RD, celular);
        } catch (err) { KVShell.aviso('Erro ao gerar o PDF: ' + err.message, { erro: true }); }
        finally { b.disabled = false; b.innerHTML = txt; KVShell.icones(); }
      }
    });
  }

  KVRecibo.passo = passo;
  KVRecibo.ligar = ligar;
})();

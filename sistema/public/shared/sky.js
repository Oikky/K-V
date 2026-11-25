/* Skyscanner: a base de preço em dinheiro do orçamento (não é opção de trecho). Um por roteiro: preço por pessoa + observação.
   Usado na pesquisa (barra lateral), na proposta e na barra da extensão (acima dos trechos).
   No lugar fica só um resumo (valor e começo da observação); tocar nele abre um popup pra ver tudo e editar.
   KVSky.html(o, editavel) desenha o resumo; KVSky.ligar(raiz, () => o, aoErro, depois) abre o popup e grava quando o campo muda.
   Precisa de orc.js e api.js antes. */
(function () {
  const O = KVOrc, { esc } = KVOrc;
  const reais = (c) => (c == null ? '' : (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const de = (o, r) => ((o.sky || [])[r]) || { valor: null, texto: '' };
  const nomeRot = (o, r) => (O.roteiros(o).length > 1 ? ` · roteiro ${O.letra(r)}` : '');

  function html(o, editavel = true) {
    const rs = O.roteiros(o);
    return `<div class="sky" data-sky-ed="${editavel ? 1 : 0}">${rs.map((idx, r) => { const s = de(o, r), linha1 = String(s.texto || '').split('\n')[0];
      return `<button type="button" class="sky-res" data-sky-abrir="${r}" aria-haspopup="dialog" aria-label="Skyscanner${nomeRot(o, r)}: ${editavel ? 'ver e editar' : 'ver'}">
        <span class="sky-rot">Skyscanner${rs.length > 1 ? ` · ${O.letra(r)} <small>${O.cidades(o, idx).map(esc).join(' → ')}</small>` : ''}</span>
        <span class="sky-val ${s.valor ? '' : 'vazio'}">${s.valor ? `R$ ${reais(s.valor)}<small> por pessoa</small>` : editavel ? 'Pôr o valor' : 'sem valor'}</span>
        ${linha1 ? `<span class="sky-obs">${esc(linha1)}${String(s.texto).includes('\n') ? ' …' : ''}</span>` : ''}</button>`; }).join('')}</div>`;
  }

  // um popup só pra página toda, criado na primeira vez
  let dlg = null, aberto = null;
  function popup() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog'); dlg.className = 'janela sky-dlg'; document.body.append(dlg);
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-sky-fechar]')) dlg.close(); });
    // grava ao sair do campo (change); o objeto do orçamento já fica com o valor novo e o resumo é redesenhado
    dlg.addEventListener('change', async (e) => {
      if (!aberto || !e.target.closest('[data-sky-v], [data-sky-t]')) return;
      const { r, orc, aoErro, depois, raiz } = aberto, o = orc();
      const vEl = dlg.querySelector('[data-sky-v]'), valor = O.lerReais(vEl.value), texto = dlg.querySelector('[data-sky-t]').value.trim();
      vEl.value = reais(valor);
      try {
        const res = await KVApi.acao('orc.sky', { orcamento: o.id, roteiro: r, valor, texto }, { quieto: true }); o.sky = res.sky;
        const velho = raiz.querySelector('.sky'); if (velho) velho.outerHTML = html(o, velho.dataset.skyEd === '1');
        if (depois) depois();
      } catch (err) { aoErro(err); }
    });
    // Enter no valor só sai do campo (grava); na observação pula linha
    dlg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-sky-v]')) { e.preventDefault(); dlg.querySelector('[data-sky-t]').focus(); } });
    return dlg;
  }

  function abrir(raiz, r, orc, aoErro, depois) {
    const o = orc(), s = de(o, r), ed = (raiz.querySelector('.sky') || {}).dataset?.skyEd === '1', ro = ed ? '' : 'readonly';
    const d = popup(); aberto = { r, orc, aoErro, depois, raiz };
    d.innerHTML = `<header><div style="flex:1"><h2>Skyscanner${nomeRot(o, r)}</h2><div class="sub">${O.cidades(o, O.roteiros(o)[r]).map(esc).join(' → ')} · base de preço em dinheiro</div></div>
        <button type="button" class="btn icone" data-sky-fechar aria-label="Fechar">✕</button></header>
      <div class="corpo sky-form">
        <div class="campo"><label for="sky-v">Preço por pessoa</label><label class="sky-v"><span>R$</span><input id="sky-v" data-sky-v inputmode="decimal" autocomplete="off" placeholder="0,00" value="${reais(s.valor)}" ${ro}></label></div>
        <div class="campo"><label for="sky-t">Observação</label><textarea id="sky-t" data-sky-t maxlength="600" rows="7" placeholder="Cia, escalas, malas… uma coisa por linha" ${ro}>${esc(s.texto)}</textarea></div>
      </div>
      <footer style="justify-content:flex-end"><span class="faint" style="font-size:13px;margin-right:auto">${ed ? 'Grava sozinho ao sair do campo' : 'Só leitura'}</span><button type="button" class="btn primario" data-sky-fechar>Pronto</button></footer>`;
    d.showModal();
    if (ed) d.querySelector(s.valor ? '[data-sky-t]' : '[data-sky-v]').focus();
  }

  function ligar(raiz, orc, aoErro, depois) {
    raiz.addEventListener('click', (e) => { const b = e.target.closest('[data-sky-abrir]'); if (b) abrir(raiz, +b.dataset.skyAbrir, orc, aoErro, depois); });
  }

  window.KVSky = { html, ligar, de };
})();

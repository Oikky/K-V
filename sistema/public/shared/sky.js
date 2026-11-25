/* Skyscanner: a base de preço em dinheiro do orçamento (não é opção de trecho). Um por roteiro: preço por pessoa + observação.
   Usado na pesquisa (abaixo de "Opções de voo") e na barra da extensão (acima dos trechos).
   KVSky.html(o, editavel) desenha; KVSky.ligar(raiz, () => o, aoErro, depois) grava quando o campo muda. Precisa de orc.js e api.js antes. */
(function () {
  const O = KVOrc, { esc } = KVOrc;
  const reais = (c) => (c == null ? '' : (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const de = (o, r) => ((o.sky || [])[r]) || { valor: null, texto: '' };

  function html(o, editavel = true) {
    const rs = O.roteiros(o), ro = editavel ? '' : 'readonly';
    return `<div class="sky">${rs.map((idx, r) => { const s = de(o, r);
      return `<div class="sky-l"><span class="sky-rot">Skyscanner${rs.length > 1 ? ` · roteiro ${O.letra(r)} <small>${O.cidades(o, idx).map(esc).join(' → ')}</small>` : ''}</span>
        <label class="sky-v"><span>R$</span><input data-sky-v="${r}" inputmode="decimal" autocomplete="off" placeholder="por pessoa" value="${reais(s.valor)}" aria-label="Preço no Skyscanner por pessoa${rs.length > 1 ? `, roteiro ${O.letra(r)}` : ''}" ${ro}></label>
        <textarea class="sky-t" data-sky-t="${r}" autocomplete="off" maxlength="600" rows="${Math.min(6, Math.max(1, String(s.texto || '').split('\n').length))}" placeholder="observação (cia, escalas…)" aria-label="Observação do Skyscanner" ${ro}>${esc(s.texto)}</textarea></div>`; }).join('')}</div>`;
  }

  // grava ao sair do campo (change); o objeto do orçamento já fica com o valor novo
  function ligar(raiz, orc, aoErro, depois) {
    raiz.addEventListener('change', async (e) => {
      const r = e.target.dataset.skyV ?? e.target.dataset.skyT; if (r == null) return;
      const o = orc(), linha = e.target.closest('.sky-l');
      const valor = O.lerReais(linha.querySelector('[data-sky-v]').value), texto = linha.querySelector('[data-sky-t]').value.trim();
      linha.querySelector('[data-sky-v]').value = reais(valor);
      try { const res = await KVApi.acao('orc.sky', { orcamento: o.id, roteiro: +r, valor, texto }, { quieto: true }); o.sky = res.sky; if (depois) depois(); }
      catch (err) { aoErro(err); }
    });
  }

  window.KVSky = { html, ligar, de };
})();

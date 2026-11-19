/* Tela: Empresa (configurações). Endereço: /empresa.html
   Os dados da K&V que saem no recibo: CNPJ, telefone, Instagram, e-mail e a logo. Ficam no banco (o repositório é público).
   Quem vê: dono e admin. Salvar grava tudo de uma vez (ação empresa.salvar).
   O estilo desta tela está em telas/empresa.css. */
KVTelas['empresa'] = function () {
  const { esc } = KVOrc;
  let app = null, dados = {}, logoNova; // logoNova: undefined = não mexeu; null = tirou; texto = trocou

  const abas = () => `<div class="seg" role="tablist" aria-label="Configurações" style="margin-bottom:18px">
    <button role="tab" data-ir="programas.html" aria-pressed="false">Programas</button><button role="tab" data-ir="equipe.html" aria-pressed="false">Equipe</button><button role="tab" aria-pressed="true">Empresa</button></div>`;
  const campo = (k, rot, ph, extra = '') => `<div class="campo"><label for="e-${k}">${rot}</label><input id="e-${k}" data-e="${k}" value="${esc(dados[k] || '')}" placeholder="${esc(ph)}" autocomplete="off" ${extra}></div>`;
  const logoAtual = () => (logoNova !== undefined ? logoNova : dados.logo);

  function render() {
    const logo = logoAtual();
    app.innerHTML = `<div class="topo"><div><h1>Configurações</h1><div class="muted">Os dados da empresa que saem no recibo do cliente</div></div></div>
      ${abas()}
      <section class="card emp">
        <div class="emp-logo"><span class="emp-img">${logo ? `<img src="${esc(logo)}" alt="Logo da empresa">` : '<span>K&amp;V</span>'}</span>
          <div class="emp-logo-bt"><label class="btn"><i data-lucide="image-up"></i>${logo ? 'Trocar a logo' : 'Escolher a logo'}<input type="file" accept="image/png,image/jpeg,image/webp" data-logo hidden></label>
            ${logo ? '<button class="btn fantasma" data-tira-logo><i data-lucide="trash-2"></i>Tirar</button>' : ''}
            <span class="faint">PNG ou JPG; fica com 256 px no recibo</span></div></div>
        <div class="duas">${campo('cnpj', 'CNPJ', '00.000.000/0001-00', 'inputmode="numeric"')}${campo('tel', 'Telefone', '(00) 9 0000-0000', 'inputmode="tel"')}</div>
        <div class="duas">${campo('ig', 'Instagram', '@perfil')}${campo('gmail', 'E-mail', 'contato@exemplo.com', 'inputmode="email"')}</div>
        <label class="check"><input type="checkbox" id="e-pesquisaCria" ${dados.pesquisaCria ? 'checked' : ''}><span>Quem pesquisa pode criar orçamentos<small>Ligado, os pesquisadores também veem o botão "Novo orçamento".</small></span></label>
        <div class="emp-pe"><span class="faint" data-estado></span><button class="btn primario" data-salvar><i data-lucide="check"></i>Salvar</button></div>
      </section>`;
    KVShell.icones();
  }

  // a logo vira um PNG de até 256 px antes de ir pro banco (fica leve no recibo e no banco)
  const reduzir = (arquivo) => new Promise((ok, erro) => {
    const img = new Image(), url = URL.createObjectURL(arquivo);
    img.onload = () => { const k = Math.min(1, 256 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/png')); };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error('Não deu pra abrir essa imagem')); };
    img.src = url;
  });

  const ler = () => { app.querySelectorAll('[data-e]').forEach((i) => { dados[i.dataset.e] = i.value; }); dados.pesquisaCria = app.querySelector('#e-pesquisaCria').checked; };

  function ligarEventos() {
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.ir) KVRota.ir(b.dataset.ir);
      else if (b.hasAttribute('data-tira-logo')) { logoNova = null; render(); }
      else if (b.hasAttribute('data-salvar')) {
        ler();
        b.disabled = true;
        try {
          await KVApi.acao('empresa.salvar', { ...dados, logo: logoNova });
          if (logoNova !== undefined) { dados.logo = logoNova; logoNova = undefined; }
          render(); KVShell.aviso('Dados da empresa salvos');
        } catch (err) { KVShell.aviso(err.message, { erro: true }); b.disabled = false; }
      }
    });
    app.addEventListener('change', async (e) => {
      if (!e.target.hasAttribute('data-logo') || !e.target.files[0]) return;
      ler();
      try { logoNova = await reduzir(e.target.files[0]); render(); app.querySelector('[data-estado]').textContent = 'Logo nova: falta salvar'; }
      catch (err) { KVShell.aviso(err.message, { erro: true }); }
    });
  }

  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const est = await KVApi.estado();
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      dados = await KVApi.empresa();
      document.querySelector('.carregando').remove();
      app = KVShell.montar('config', { dono: true });
      ligarEventos(); render();
    } catch (e) { const c = document.querySelector('.carregando'); if (c) c.textContent = e.message; }
  })();
};

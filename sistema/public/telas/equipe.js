/* Tela: Equipe (configurações). Endereço: /equipe.html
   Quem usa o sistema: nível (Dono ou Pesquisador), se pesquisa voos e se o acesso está liberado. Mexer abre uma janela.
   Quem vê: dono e admin. Só o admin mexe no admin (o servidor confere em usuario.salvar).
   O estilo desta tela está em telas/equipe.css. */
KVTelas['equipe'] = function () {
  const { esc } = KVOrc;
  let app = null, est = null;
  const NIVEL = { dono: 'Dono', pesquisador: 'Pesquisador', admin: 'Admin' };
  const souAdmin = () => !!window.KVAdmin;
  const pessoas = () => [...est.usuarios].sort((a, b) => b.ativo - a.ativo || a.nome.localeCompare(b.nome));
  const inicial = (n) => esc((n || '?').trim()[0].toUpperCase());

  // abas das configurações (Programas fica na própria tela dele)
  const abas = () => `<div class="seg" role="tablist" aria-label="Configurações" style="margin-bottom:18px">
    <button role="tab" data-ir="programas.html" aria-pressed="false">Programas</button><button role="tab" aria-pressed="true">Equipe</button><button role="tab" data-ir="empresa.html" aria-pressed="false">Empresa</button></div>`;

  function linha(u) {
    const travado = u.papel === 'admin' && !souAdmin();
    return `<li><button class="eq-linha ${u.ativo ? '' : 'inativo'}" data-pessoa="${esc(u.email)}" ${travado ? 'disabled title="Só o admin mexe no admin"' : ''}>
      ${u.foto ? `<img class="eq-foto" src="${esc(u.foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="eq-foto">${inicial(u.nome)}</span>`}
      <span class="eq-txt"><b>${esc(u.nome)}</b><span>${esc(u.email)}</span></span>
      <span class="eq-tags"><span class="etiqueta">${NIVEL[u.papel]}</span>${u.papel !== 'pesquisador' && u.pesquisa ? '<span class="etiqueta">pesquisa</span>' : ''}${u.ativo ? '' : '<span class="etiqueta warn">sem acesso</span>'}</span>
      ${travado ? '' : '<i data-lucide="chevron-right" class="eq-seta"></i>'}</button></li>`;
  }

  function render() {
    app.innerHTML = `<div class="topo"><div><h1>Configurações</h1><div class="muted">Quem usa o sistema e o que cada pessoa pode fazer</div></div>
        <button class="btn primario" data-nova style="margin-left:auto"><i data-lucide="user-plus"></i>Pessoa</button></div>
      ${abas()}
      <ul class="eq-lista">${pessoas().map(linha).join('')}</ul>
      <p class="faint eq-nota"><b>Dono</b> vê tudo: proposta, fechamento, contas, financeiro e folha. <b>Pesquisador</b> pega orçamentos, pesquisa voos e bate ponto.
        Dono que também pesquisa entra na folha.</p>`;
    KVShell.icones(); sincJanela();
  }

  // ---------- janela: cadastrar ou mudar o acesso de uma pessoa ----------
  const dlg = document.createElement('dialog'); dlg.className = 'janela'; document.body.append(dlg);
  const fechar = () => KVShell.desfazer({ janela: 1, p: 1 }, sincJanela);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); fechar(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fechar(); });
  function sincJanela() {
    if (KVShell.param('janela') !== 'pessoa') { if (dlg.open) dlg.close(); return; }
    const email = KVShell.param('p'), u = est.usuarios.find((x) => x.email === email) || null;
    const v = u || { email: '', nome: '', papel: 'pesquisador', pesquisa: 1, ativo: 1 };
    const eu = (window.KVEu.admin || window.KVEu).email === v.email;
    const niveis = Object.entries(NIVEL).filter(([k]) => k !== 'admin' || souAdmin() || v.papel === 'admin');
    dlg.innerHTML = `<form class="form-j" novalidate>
      <header><div style="flex:1"><h2>${u ? esc(u.nome) : 'Nova pessoa'}</h2><div class="sub">${u ? esc(u.email) : 'Alguém novo na equipe'}</div></div>
        <button class="btn icone" type="button" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>
      <div class="corpo">
        <div class="campo"><label for="eq-nome">Nome</label><input id="eq-nome" name="nome" value="${esc(v.nome)}" autocomplete="off" required></div>
        ${u ? '' : '<div class="campo"><label for="eq-email">E-mail do Google</label><input id="eq-email" name="email" type="email" inputmode="email" autocomplete="off" required></div>'}
        <div class="campo"><label for="eq-nivel">Nível de acesso</label><select id="eq-nivel" name="papel" ${eu ? 'disabled' : ''}>${niveis.map(([k, n]) => `<option value="${k}" ${k === v.papel ? 'selected' : ''}>${n}</option>`).join('')}</select>
          ${eu ? '<span class="faint" style="font-size:13px">Você não muda o seu próprio nível.</span>' : ''}</div>
        <label class="check" data-so-dono ${v.papel === 'pesquisador' ? 'style="display:none"' : ''}><input type="checkbox" name="pesquisa" ${v.pesquisa ? 'checked' : ''}><span>Também pesquisa voos<br><span class="faint" style="font-weight:500">Pega orçamentos, bate ponto e entra na folha</span></span></label>
        <label class="check"><input type="checkbox" name="ativo" ${v.ativo ? 'checked' : ''} ${eu ? 'disabled' : ''}><span>Acesso liberado<br><span class="faint" style="font-weight:500">Desligado, a pessoa não entra mais no sistema (o histórico dela fica)</span></span></label>
        ${u ? '' : '<p class="faint" style="font-size:13px;margin:0">Pra conseguir entrar, o e-mail também precisa ser liberado no login (Cloudflare Access). Avise o admin.</p>'}
      </div>
      <footer><button class="btn" type="button" data-x>Cancelar</button><button class="btn primario" type="submit"><i data-lucide="check"></i>Salvar</button></footer></form>`;
    const f = dlg.querySelector('form');
    f.papel.onchange = () => { dlg.querySelector('[data-so-dono]').style.display = f.papel.value === 'pesquisador' ? 'none' : ''; };
    dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fechar);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const b = f.querySelector('[type=submit]'); b.disabled = true;
      const papel = f.papel.value;
      try {
        await KVApi.acao('usuario.salvar', { email: u ? u.email : f.email.value, nome: f.nome.value, papel,
          pesquisa: papel === 'pesquisador' || f.pesquisa.checked, ativo: f.ativo.checked });
        est = await KVApi.estado();
        KVShell.aviso(u ? 'Acesso atualizado' : 'Pessoa cadastrada');
        fechar(); render();
      } catch (err) { KVShell.aviso(err.message, { erro: true }); b.disabled = false; }
    };
    if (!dlg.open) dlg.showModal();
    KVShell.icones();
    if (!u) f.nome.focus();
  }

  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      est = await KVApi.estado();
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      document.querySelector('.carregando').remove();
      app = KVShell.montar('config', { dono: true });
      document.title = 'Equipe · K&V';
      render();
      app.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        if (b.dataset.ir) KVRota.ir(b.dataset.ir);
        else if (b.dataset.pessoa) { KVShell.irPara({ janela: 'pessoa', p: b.dataset.pessoa }); sincJanela(); }
        else if (b.hasAttribute('data-nova')) { KVShell.irPara({ janela: 'pessoa', p: null }); sincJanela(); }
      });
      KVShell.aoVoltar(render);
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.textContent = e.message; }
  })();
};

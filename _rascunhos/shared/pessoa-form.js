/* RASCUNHO DESCARTÁVEL: janela de nova pessoa / editar dados, usada na lista de clientes e na ficha.
   Nome e CPF são obrigatórios; o resto é opcional até o dono responder (PERGUNTAS-PRO-DONO.md, item 12).
   Cadastro único: se o CPF já existe, avisa e oferece abrir o cadastro que já está lá. */
(function () {
  const mascaraCpf = (v) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  const mascaraFone = (v) => { const d = v.replace(/\D/g, '').slice(0, 11); if (d.length <= 2) return d.length ? `(${d}` : ''; if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`; return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`; };
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  // dlg: <dialog class="janela">; p: pessoa (editar) ou null (nova); fechar(): fecha a janela; aoSalvar(pessoa)
  function abrir(dlg, p, { fechar, aoSalvar }) {
    const nova = !p;
    const pass = (p && p.passaporte) || {};
    dlg.innerHTML = `<header><div style="flex:1"><h2>${nova ? 'Nova pessoa' : 'Editar dados'}</h2><div class="sub">${nova ? 'Quem já era cliente antes do sistema. No dia a dia, a pessoa é cadastrada no fechamento do orçamento.' : esc(p.nome)}</div></div>
        <button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>
      <div class="corpo"><div class="form-pessoa">
        <div class="campo largo"><label for="f-nome">Nome completo, igual ao documento</label><input id="f-nome" autocomplete="off" value="${esc(p && p.nome)}"></div>
        <div class="campo largo-cel"><label for="f-cpf">CPF</label><input id="f-cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" value="${esc(p && p.cpf)}" ${p ? 'readonly' : ''}>
          ${p ? '<span class="ajuda">O CPF liga a pessoa às contas de pontos e não muda.</span>' : ''}<div data-aviso></div></div>
        <div class="campo"><label for="f-nasc">Nascimento <span class="opc">opcional</span></label><input id="f-nasc" type="date" value="${esc(p && p.nascimento)}"></div>
        <div class="campo"><label for="f-zap">WhatsApp <span class="opc">opcional</span></label><input id="f-zap" inputmode="tel" placeholder="(11) 91234-5678" value="${esc(p && p.whatsapp)}"></div>
        <div class="campo"><label for="f-mail">E-mail <span class="opc">opcional</span></label><input id="f-mail" type="email" inputmode="email" value="${esc(p && p.email)}"></div>
        <div class="campo"><label for="f-pass">Passaporte <span class="opc">opcional</span></label><input id="f-pass" autocomplete="off" style="text-transform:uppercase" value="${esc(pass.numero)}"></div>
        <div class="campo"><label for="f-val">Validade do passaporte</label><input id="f-val" type="date" value="${esc(pass.validade)}"></div>
        <div class="campo largo"><label for="f-obs">Observações <span class="opc">opcional</span></label><textarea id="f-obs" rows="2" placeholder="Ex.: prefere janela, sempre leva mala de 23 kg">${esc(p && p.obs)}</textarea></div>
      </div><div style="height:14px"></div></div>
      <footer><button class="btn" data-x>Cancelar</button><button class="btn primario" data-salvar><i data-lucide="check"></i>${nova ? 'Cadastrar' : 'Salvar'}</button></footer>`;
    const $ = (s) => dlg.querySelector(s);
    const aviso = $('[data-aviso]');
    const checar = () => {
      const nome = $('#f-nome').value.trim(), cpf = $('#f-cpf').value;
      let ok = nome.split(/\s+/).length >= 2;
      let html = '';
      if (nova) {
        const d = cpf.replace(/\D/g, '');
        const dono = d.length === 11 ? KV.pessoas.acharCpf(cpf) : null;
        if (dono) { ok = false; html = `<div class="aviso warn" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><span>Esse CPF já é de <b>${esc(dono.nome)}</b>. Cada pessoa tem um cadastro só.</span><a class="btn pequeno" href="pessoa.html?id=${dono.id}">Abrir cadastro</a></div>`; }
        else if (d.length && d.length < 11) ok = false;
        else if (!d.length) ok = false;
      }
      aviso.innerHTML = html;
      const b = $('[data-salvar]'); b.disabled = !ok; b.style.opacity = ok ? 1 : .5;
      return ok;
    };
    $('#f-cpf').addEventListener('input', (e) => { e.target.value = mascaraCpf(e.target.value); checar(); });
    $('#f-zap').addEventListener('input', (e) => { e.target.value = mascaraFone(e.target.value); });
    $('#f-nome').addEventListener('input', checar);
    dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fechar);
    $('[data-salvar]').onclick = () => {
      if (!checar()) return;
      const numero = $('#f-pass').value.trim().toUpperCase(), validade = $('#f-val').value;
      const dados = {
        nome: $('#f-nome').value.trim(), nascimento: $('#f-nasc').value || null, whatsapp: $('#f-zap').value.trim() || null,
        email: $('#f-mail').value.trim() || null, passaporte: numero ? { numero, validade: validade || null } : null, obs: $('#f-obs').value.trim(),
      };
      if (nova) dados.cpf = $('#f-cpf').value;
      aoSalvar(KV.pessoas.salvar(dados, p && p.id));
    };
    checar();
    if (!dlg.open) dlg.showModal();
    if (window.lucide) lucide.createIcons();
    if (nova) $('#f-nome').focus();
  }
  window.KVPessoaForm = { abrir };
})();

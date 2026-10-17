/* Janela de nova pessoa / editar dados (fechamento, lista de clientes e ficha).
   Nome e CPF são obrigatórios; o resto é opcional até o dono responder (PERGUNTAS-PRO-DONO.md, item 12).
   Cadastro único: se o CPF já existe, avisa e oferece usar (ou abrir) o cadastro que já está lá. Precisa de api.js. */
(function () {
  const mascaraCpf = (v) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  const mascaraFone = (v) => { const d = v.replace(/\D/g, '').slice(0, 11); if (d.length <= 2) return d.length ? `(${d}` : ''; if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`; return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`; };
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const soDig = (s) => String(s || '').replace(/\D/g, '');
  function cpfValido(cpf) {
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
    const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +cpf[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === +cpf[9] && dv(10) === +cpf[10];
  }

  // dlg: <dialog class="janela">; p: pessoa (editar) ou null (nova); pessoas: o cadastro carregado (pra achar CPF repetido)
  // fechar(): fecha a janela; aoSalvar(pessoa); aoUsar(pessoa): opcional, usa o cadastro que já existe
  function abrir(dlg, p, { pessoas = [], fechar, aoSalvar, aoUsar, sub, inicial = {} }) {
    const nova = !p;
    const v = p || inicial;
    dlg.className = 'janela';
    dlg.innerHTML = `<header><div style="flex:1"><h2>${nova ? 'Nova pessoa' : 'Editar dados'}</h2><div class="sub">${esc(sub || (nova ? 'Fica no cadastro único, achado pelo CPF.' : p.nome))}</div></div>
        <button class="btn icone" data-x aria-label="Fechar"><i data-lucide="x"></i></button></header>
      <div class="corpo"><div class="form-pessoa">
        <div class="campo largo"><label for="f-nome">Nome completo, igual ao documento</label><input id="f-nome" autocomplete="off" value="${esc(v.nome)}"></div>
        <div class="campo largo-cel"><label for="f-cpf">CPF</label><input id="f-cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" value="${esc(v.cpf ? mascaraCpf(v.cpf) : '')}" ${p ? 'readonly' : ''}>
          ${p ? '<span class="ajuda">O CPF liga a pessoa às contas de pontos e não muda.</span>' : ''}<div data-aviso></div></div>
        <div class="campo"><label for="f-nasc">Nascimento <span class="opc">opcional</span></label><input id="f-nasc" type="date" value="${esc(v.nascimento)}"></div>
        <div class="campo"><label for="f-zap">WhatsApp <span class="opc">opcional</span></label><input id="f-zap" inputmode="tel" placeholder="(11) 91234-5678" value="${esc(v.whatsapp ? mascaraFone(v.whatsapp) : '')}"></div>
        <div class="campo"><label for="f-mail">E-mail <span class="opc">opcional</span></label><input id="f-mail" type="email" inputmode="email" value="${esc(v.email)}"></div>
        <div class="campo"><label for="f-pass">Passaporte <span class="opc">opcional</span></label><input id="f-pass" autocomplete="off" style="text-transform:uppercase" value="${esc(v.passaporte_numero)}"></div>
        <div class="campo"><label for="f-val">Validade do passaporte</label><input id="f-val" type="date" value="${esc(v.passaporte_validade)}"></div>
        <div class="campo largo"><label for="f-obs">Observações <span class="opc">opcional</span></label><textarea id="f-obs" rows="2" placeholder="Ex.: prefere janela, sempre leva mala de 23 kg">${esc(v.obs)}</textarea></div>
      </div><div style="height:14px"></div></div>
      <footer><button class="btn" data-x>Cancelar</button><button class="btn primario" data-salvar><i data-lucide="check"></i>${nova ? 'Cadastrar' : 'Salvar'}</button></footer>`;
    const $ = (s) => dlg.querySelector(s);
    const aviso = $('[data-aviso]');
    const checar = () => {
      const nome = $('#f-nome').value.trim();
      let ok = nome.split(/\s+/).length >= 2, html = '';
      if (nova) {
        const d = soDig($('#f-cpf').value);
        const dono = d.length === 11 ? pessoas.find((x) => x.cpf === d) : null;
        if (dono) {
          ok = false;
          html = `<div class="aviso warn" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:8px"><span>Esse CPF já é de <b>${esc(dono.nome)}</b>. Cada pessoa tem um cadastro só.</span>${aoUsar ? `<button class="btn pequeno" data-usar="${dono.id}">Usar esse cadastro</button>` : `<a class="btn pequeno" href="pessoa.html?id=${dono.id}">Abrir cadastro</a>`}</div>`;
        } else if (d.length === 11 && !cpfValido(d)) { ok = false; html = '<div class="aviso danger" style="margin-top:8px">CPF inválido; confira os números.</div>'; }
        else if (d.length !== 11) ok = false;
      }
      aviso.innerHTML = html;
      const u = aviso.querySelector('[data-usar]'); if (u) u.onclick = () => aoUsar(pessoas.find((x) => x.id === +u.dataset.usar));
      const b = $('[data-salvar]'); b.disabled = !ok; b.style.opacity = ok ? 1 : .5;
      return ok;
    };
    $('#f-cpf').addEventListener('input', (e) => { e.target.value = mascaraCpf(e.target.value); checar(); });
    $('#f-zap').addEventListener('input', (e) => { e.target.value = mascaraFone(e.target.value); });
    $('#f-nome').addEventListener('input', checar);
    dlg.querySelectorAll('[data-x]').forEach((b) => b.onclick = fechar);
    $('[data-salvar]').onclick = async () => {
      if (!checar()) return;
      const dados = {
        nome: $('#f-nome').value.trim(), nascimento: $('#f-nasc').value || null, whatsapp: soDig($('#f-zap').value) || null,
        email: $('#f-mail').value.trim() || null, passaporte_numero: $('#f-pass').value.trim().toUpperCase() || null,
        passaporte_validade: $('#f-val').value || null, obs: $('#f-obs').value.trim(),
      };
      if (nova) dados.cpf = soDig($('#f-cpf').value); else dados.id = p.id;
      const b = $('[data-salvar]'); b.disabled = true;
      try {
        const r = await KVApi.acao('pessoa.salvar', dados);
        aoSalvar({ ...(p || {}), ...dados, id: r.id, cpf: nova ? dados.cpf : p.cpf });
      } catch (e) {
        aviso.innerHTML = `<div class="aviso danger" style="margin-top:8px">${esc(e.message)}</div>`; b.disabled = false;
      }
    };
    checar();
    if (!dlg.open) dlg.showModal();
    if (window.lucide) lucide.createIcons();
    (nova && v.nome ? $('#f-cpf') : $('#f-nome')).focus();
  }
  window.KVPessoaForm = { abrir, mascaraCpf, mascaraFone, cpfValido };
})();

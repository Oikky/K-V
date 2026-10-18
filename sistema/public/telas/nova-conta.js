/* Tela: Nova conta de pontos. Endereço: /nova-conta.html
   Nova conta (rodada 5 dos rascunhos, formulário único), gravando no banco. O titular vem do cadastro único de pessoas
     (ou é cadastrado aqui, pelo CPF). O saldo de hoje entra como o primeiro lote. Só o dono.
   O estilo desta tela está em telas/nova-conta.css. */
KVTelas['nova-conta'] = function () {
  let app = null, contas = [], pessoas = [];
  const { fmt, esc } = KV;
  const daqui = (meses) => { const d = new Date(KV.hoje + 'T12:00:00'); d.setMonth(d.getMonth() + meses); return KV.isoDia(d); };
  const progsDe = (tid) => contas.filter((c) => c.titularId === tid).map((c) => c.programaId);
  const num = (v) => +String(v || '').replace(/\D/g, '') || 0;
  const centavos = (v) => { const n = +String(v ?? '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); return isFinite(n) && n > 0 ? Math.round(n * 100) : null; };
  // campos que dependem do programa (categoria só na Azul, clube não existe na Livelo)
  function camposPrograma(prog) {
    return `${prog === 'azul' ? `<div class="campo"><label for="cat">Categoria na Azul</label><select id="cat">${Object.entries(KV.categoriasAzul()).map(([k, v]) => `<option value="${k}">${k} (${v} beneficiários)</option>`).join('')}</select></div>` : ''}
      <div class="campo"><label for="numero">Número de fidelidade</label><input id="numero" inputmode="numeric" placeholder="opcional"></div>
      ${prog !== 'livelo' ? `<div class="secao">Clube</div>
        <label class="liga inteiro"><input type="checkbox" id="temclube"> Esta conta assina clube</label>
        <div class="campo" data-clube><label for="plano">Pontos por mês</label><select id="plano"><option>1000</option><option selected>2000</option><option>3000</option><option>5000</option></select></div>
        <div class="campo" data-clube><label for="mensal">Mensalidade (R$)</label><input id="mensal" inputmode="decimal" placeholder="ex.: 35,00"></div>` : ''}
      <div class="secao">Saldo de hoje</div>
      <div class="campo"><label for="saldo">Pontos que já tem</label><input id="saldo" inputmode="numeric" placeholder="0"><span class="ajuda">Entra como saldo inicial.</span></div>
      <div class="campo"><label for="vence">Esses pontos vencem em</label><input id="vence" type="date" value="${daqui(24)}"></div>`;
  }
  function ligarClube(raiz) {
    const cb = raiz.querySelector('#temclube'); if (!cb) return;
    const t = () => raiz.querySelectorAll('[data-clube]').forEach((e) => e.classList.toggle('oculto', !cb.checked)); cb.onchange = t; t();
  }
  function coletar(raiz, base) {
    const v = (id) => { const e = raiz.querySelector('#' + id); return e ? (e.type === 'checkbox' ? e.checked : e.value) : undefined; };
    return { ...base, categoria: v('cat') || null, numero: v('numero') || null, clube: v('temclube') ? +v('plano') : null, clube_custo: v('temclube') ? centavos(v('mensal')) : null,
      saldo: num(v('saldo')), vence: v('vence') };
  }

  const variantes = {
    // A: um formulário só; titular existente ou novo
    A() {
      app.innerHTML = `<a class="voltar" href="contas.html"><i data-lucide="arrow-left"></i>Contas de pontos</a>
        <div class="topo"><h1>Nova conta de pontos</h1></div>
        <form class="card" id="f" style="max-width:680px"><div class="grade-campos">
          <div class="secao">Titular</div>
          <div class="campo inteiro"><label for="tit">Titular</label><select id="tit" data-combo="sim"><option value="__novo">+ Titular novo</option>${pessoas.map((p) => `<option value="${p.id}">${esc(p.nome)}${p.cpf ? ` · ${fmt.cpf(p.cpf)}` : ''}</option>`).join('')}</select></div>
          <div class="campo" data-novo><label for="tnome">Nome do titular</label><input id="tnome" placeholder="Nome completo, igual ao documento"></div>
          <div class="campo" data-novo><label for="tcpf">CPF do titular</label><input id="tcpf" inputmode="numeric" placeholder="000.000.000-00"></div>
          <div class="secao">Programa</div>
          <div class="campo inteiro"><label for="prog">Programa</label><select id="prog">${KV.programas().map((p) => `<option value="${p.id}">${p.nome}</option>`).join('')}</select><span class="ajuda" id="jatem"></span></div>
          <div id="porprog" style="display:contents"></div>
        </div><div class="rodape-form"><a class="btn" href="contas.html">Cancelar</a><button class="btn primario" type="submit"><i data-lucide="check"></i>Cadastrar conta</button></div></form>
        <div id="salvo" style="max-width:680px;margin-top:14px"></div>`;
      const $ = (id) => app.querySelector('#' + id);
      const atual = () => {
        const novo = $('tit').value === '__novo';
        app.querySelectorAll('[data-novo]').forEach((e) => e.classList.toggle('oculto', !novo));
        const tem = novo ? [] : progsDe(+$('tit').value);
        $('jatem').innerHTML = tem.includes($('prog').value) ? '<span style="color:var(--warn)">Esse titular já tem conta nesse programa.</span>' : tem.length ? `Já tem: ${tem.map((x) => KV.programa(x).nome).join(', ')}.` : '';
        $('porprog').innerHTML = camposPrograma($('prog').value); ligarClube(app);
      };
      $('tit').onchange = atual; $('prog').onchange = atual; atual();
      $('tcpf').addEventListener('input', (e) => { e.target.value = KVPessoaForm.mascaraCpf(e.target.value); });
      $('f').onsubmit = async (e) => {
        e.preventDefault();
        const novo = $('tit').value === '__novo';
        if (novo && !KVPessoaForm.cpfValido($('tcpf').value.replace(/\D/g, ''))) { $('tcpf').focus(); KVShell.aviso('CPF inválido; confira os números', { erro: true }); return; }
        const dados = coletar(app, { titular: novo ? { nome: $('tnome').value.trim(), cpf: $('tcpf').value.replace(/\D/g, '') } : +$('tit').value, programa: $('prog').value });
        const b = e.submitter; if (b) b.disabled = true;
        try { const r = await KVApi.acao('conta.criar', dados); KVRota.ir(`conta.html?id=${r.id}`); }
        catch (err) { KVShell.aviso(err.message, { erro: true }); if (b) b.disabled = false; }
      };
    },
  };
  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const est = await KV.carregar();
      if (!(est.eu.papel === 'dono' || est.eu.papel === 'admin')) { KVRota.trocar('orcamentos.html'); return; }
      contas = KV.contas(); pessoas = await KVApi.pessoas();
      document.querySelector('.carregando').remove();
      app = KVShell.montar('contas', { dono: true });
      variantes.A(); KVShell.icones();
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.textContent = e.message; }
  })();
};

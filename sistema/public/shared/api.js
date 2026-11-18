/* Conversa com o servidor. Toda mudança vai por KVApi.acao(nome, dados): cada clique leva uma chave única,
   então um clique repetido (rede lenta, dois toques) não grava duas vezes.
   Leituras abrem na hora: a página usa a última resposta guardada nesta aba (até 30 min) e confere com o servidor
   por trás. Se veio algo novo e a pessoa ainda não mexeu na tela, ela se redesenha sozinha com o dado novo.
   Qualquer gravação apaga o que estava guardado, então depois de mudar algo nada aparece desatualizado. */
(function () {
  async function pedir(caminho, opcoes) {
    let r;
    // o admin pode usar o sistema como outra pessoa da equipe (o e-mail dela vai no cabeçalho; o servidor confere que é admin mesmo)
    const como = (() => { try { const v = localStorage.getItem('kv-ver-como') || ''; return v.includes('@') ? v : ''; } catch (e) { return ''; } })();
    const headers = { ...((opcoes && opcoes.headers) || {}), ...(como ? { 'x-kv-ver-como': como } : {}) };
    try { r = await fetch(caminho, { cache: 'no-store', credentials: 'same-origin', ...opcoes, headers }); }
    catch (e) { throw new Error('Sem conexão. Confira a internet e tente de novo.'); }
    // o login do Access venceu: a resposta vem redirecionada pra página de login
    if (r.redirected || r.type === 'opaqueredirect') { location.reload(); throw new Error('Entrando de novo…'); }
    const corpo = await r.json().catch(() => null);
    if (!r.ok || !corpo) throw new Error((corpo && corpo.erro) || 'Erro no servidor. Tente de novo.');
    return corpo;
  }

  // ---------- leituras guardadas na aba ----------
  const PREFIXO = 'kv:', VALIDADE = 30 * 60e3;
  const ler = (k) => { try { const v = JSON.parse(sessionStorage.getItem(PREFIXO + k)); return v && Date.now() - v.em < VALIDADE ? v : null; } catch (e) { return null; } };
  const guardar = (k, texto) => { try { sessionStorage.setItem(PREFIXO + k, JSON.stringify({ em: Date.now(), texto })); } catch (e) {} };
  const esquecer = () => { try { Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIXO)).forEach((k) => sessionStorage.removeItem(k)); } catch (e) {} };

  // a pessoa já mexeu nesta tela? (aí não redesenha por baixo dela)
  let mexeu = false;
  ['pointerdown', 'keydown', 'input'].forEach((ev) => addEventListener(ev, () => { mexeu = true; }, { capture: true, passive: true }));
  let recarregando = false, ultimaTroca = 0;
  function chegouNovo() {
    if (mexeu || recarregando || document.querySelector('dialog[open]')) return;
    // no máximo uma troca a cada 20 s (se o servidor responder diferente toda vez, não fica redesenhando)
    if (Date.now() - ultimaTroca < 20e3) return;
    ultimaTroca = Date.now(); recarregando = true;
    // a tela abre de novo já com o dado novo guardado: troca quase sem piscar
    setTimeout(() => window.KVRota && KVRota.recarregar(), 50);
  }

  const usados = new Set(); // na mesma página, a segunda leitura do mesmo endereço sempre vai ao servidor
  async function obter(caminho) {
    const guardado = !usados.has(caminho) && ler(caminho);
    usados.add(caminho);
    if (guardado) {
      pedir(caminho).then((novo) => {
        const texto = JSON.stringify(novo);
        guardar(caminho, texto);
        if (texto !== guardado.texto) chegouNovo();
      }).catch(() => {});
      return JSON.parse(guardado.texto);
    }
    const novo = await comLinha(pedir(caminho));
    guardar(caminho, JSON.stringify(novo));
    return novo;
  }
  // foto do perfil: o login do Access sabe quem entrou pelo Google; uma vez por aba, a foto de lá vai pro banco
  // (se mudou), pra aparecer no canto e no menu de troca de pessoa. Sem foto, fica a inicial do nome.
  let fotoConferida = false;
  function fotoDoGoogle(eu) {
    if (fotoConferida) return;
    fotoConferida = true;
    try { if (sessionStorage.getItem('kv-foto-ok')) return; sessionStorage.setItem('kv-foto-ok', '1'); } catch (e) {}
    const minha = eu.admin ? eu.admin.foto : eu.foto;
    fetch('/cdn-cgi/access/get-identity', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((id) => {
        if (!id) return;
        const achar = (o) => o && (o.picture || o.photo || o.avatar_url);
        const url = achar(id) || achar(id.oidc_fields) || achar(id.custom) || achar(id.idp && id.idp.claims);
        if (url && url !== minha) window.KVApi.acao('eu.foto', { url }).catch(() => {});
      }).catch(() => {});
  }
  // ---------- todo clique responde ----------
  // O botão que disparou a gravação fica "ocupado" (girador, travado) até o servidor responder, e uma linha
  // corre no topo enquanto qualquer gravação ou leitura da tela estiver no caminho. Assim nada parece travado.
  let ultimoAlvo = null, ultimoEm = 0;
  const ALVO = 'button, a.btn, [role="button"], .cartao-ref, .pilula, label.sel-pilula';
  addEventListener('click', (e) => { const a = e.target.closest && e.target.closest(ALVO); if (a) { ultimoAlvo = a; ultimoEm = Date.now(); } }, true);
  addEventListener('submit', (e) => { if (e.submitter) { ultimoAlvo = e.submitter; ultimoEm = Date.now(); } }, true);
  function ocupar() {
    const el = Date.now() - ultimoEm < 600 && ultimoAlvo && ultimoAlvo.isConnected ? ultimoAlvo : null;
    ultimoAlvo = null;
    if (!el || el.classList.contains('kv-ocupado')) return () => {};
    const tinha = el.disabled;
    el.classList.add('kv-ocupado'); el.setAttribute('aria-busy', 'true');
    if ('disabled' in el) el.disabled = true;
    return () => { el.classList.remove('kv-ocupado'); el.removeAttribute('aria-busy'); if ('disabled' in el) el.disabled = tinha; };
  }
  let naRede = 0, linhaTimer = null;
  function rede(delta) {
    naRede = Math.max(0, naRede + delta);
    clearTimeout(linhaTimer);
    let linha = document.querySelector('.kv-rede');
    if (naRede && !linha) {
      // só aparece se demorar um pouco (resposta rápida não pisca nada)
      linhaTimer = setTimeout(() => { if (naRede && !document.querySelector('.kv-rede')) { linha = document.createElement('div'); linha.className = 'kv-rede'; linha.setAttribute('aria-hidden', 'true'); document.body.append(linha); } }, 120);
    } else if (!naRede && linha) linha.remove();
  }
  async function comLinha(promessa) { rede(1); try { return await promessa; } finally { rede(-1); } }

  const indo = new Set();
  const chave = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));

  window.KVApi = {
    estado: async () => {
      const e = await obter('/api/estado');
      window.KVAdmin = e.eu.real === 'admin'; window.KVEu = e.eu; window.KVEquipe = e.equipe || null;
      fotoDoGoogle(e.eu);
      return e;
    },
    orcamentos: () => obter('/api/orcamentos'),
    ponto: () => obter('/api/ponto'),
    empresa: () => obter('/api/empresa'),
    pessoas: () => obter('/api/pessoas'),
    clientes: () => obter('/api/clientes'),
    financeiro: () => obter('/api/financeiro'),
    juntos: (id) => obter('/api/pessoas/juntos?id=' + encodeURIComponent(id)),
    contas: (programa) => obter('/api/contas' + (programa ? '?programa=' + encodeURIComponent(programa) : '')),
    conta: (id) => obter('/api/conta?id=' + encodeURIComponent(id)),
    movimento: (id) => obter('/api/movimento?id=' + encodeURIComponent(id)),
    orcamento: (id) => obter('/api/orcamento?id=' + encodeURIComponent(id)),
    // { quieto: true } = gravação automática (salvar sozinho): não marca botão nenhum como ocupado
    acao: async (acao, dados = {}, { quieto = false } = {}) => {
      const soltar = quieto ? () => {} : ocupar();
      try {
        const r = (await comLinha(pedir('/api/acao', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao, dados, chave: chave() }),
        }))).resultado;
        esquecer();
        return r;
      } finally { soltar(); }
    },
    // tela nova: a primeira leitura de cada endereço volta a poder vir do que está guardado
    novaTela: () => { usados.clear(); mexeu = false; recarregando = false; },
    esquecer,
    // abre o que a próxima tela vai pedir, enquanto a pessoa ainda está nesta
    adiantar: (caminho) => {
      if (indo.has(caminho) || ler(caminho)) return;
      indo.add(caminho);
      pedir(caminho).then((d) => guardar(caminho, JSON.stringify(d))).catch(() => {}).finally(() => indo.delete(caminho));
    },
  };

  // tocar num link já começa a buscar os dados da tela de destino
  const DESTINOS = {
    'orcamentos.html': ['/api/orcamentos'], 'contas.html': ['/api/contas'], 'clientes.html': ['/api/clientes', '/api/contas'],
    'ponto.html': ['/api/ponto'], 'folha.html': ['/api/ponto'], 'programas.html': ['/api/contas'],
    'entrada.html': ['/api/contas'], 'saida.html': ['/api/contas'], 'nova-conta.html': ['/api/contas', '/api/pessoas'], 'novo-orcamento.html': ['/api/pessoas', '/api/orcamentos'],
  };
  const PORID = { 'orcamento.html': '/api/orcamento', 'proposta.html': '/api/orcamento', 'fechamento.html': '/api/orcamento', 'emissao.html': '/api/orcamento', 'conta.html': '/api/conta' };
  function adiantarLink(e) {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    const u = new URL(a.href, location.href); if (u.origin !== location.origin) return;
    let pagina = u.pathname.split('/').pop() || 'orcamentos.html';
    if (!pagina.endsWith('.html')) pagina += '.html';
    (DESTINOS[pagina] || []).forEach(window.KVApi.adiantar);
    const id = u.searchParams.get('id'); if (PORID[pagina] && id) window.KVApi.adiantar(`${PORID[pagina]}?id=${encodeURIComponent(id)}`);
  }
  addEventListener('pointerdown', adiantarLink, { passive: true });
  addEventListener('mouseover', adiantarLink, { passive: true });
})();

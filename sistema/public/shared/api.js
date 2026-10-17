/* Conversa com o servidor. Toda mudança vai por KVApi.acao(nome, dados): cada clique leva uma chave única,
   então um clique repetido (rede lenta, dois toques) não grava duas vezes.
   Leituras abrem na hora: a página usa a última resposta guardada nesta aba (até 30 min) e confere com o servidor
   por trás. Se veio algo novo e a pessoa ainda não mexeu na tela, ela se redesenha sozinha com o dado novo.
   Qualquer gravação apaga o que estava guardado, então depois de mudar algo nada aparece desatualizado. */
(function () {
  async function pedir(caminho, opcoes) {
    let r;
    try { r = await fetch(caminho, { cache: 'no-store', credentials: 'same-origin', ...opcoes }); }
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
  let recarregando = false;
  function chegouNovo() {
    if (mexeu || recarregando || document.querySelector('dialog[open]')) return;
    // no máximo uma troca a cada 20 s (se o servidor responder diferente toda vez, não fica recarregando)
    try { if (Date.now() - (+sessionStorage.getItem('kv-troca') || 0) < 20e3) return; sessionStorage.setItem('kv-troca', Date.now()); } catch (e) { return; }
    recarregando = true;
    // a página abre de novo já com o dado novo guardado: troca quase sem piscar
    setTimeout(() => location.reload(), 50);
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
    const novo = await pedir(caminho);
    guardar(caminho, JSON.stringify(novo));
    return novo;
  }
  const indo = new Set();
  const chave = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));

  window.KVApi = {
    estado: () => obter('/api/estado'),
    orcamentos: () => obter('/api/orcamentos'),
    ponto: () => obter('/api/ponto'),
    pessoas: () => obter('/api/pessoas'),
    clientes: () => obter('/api/clientes'),
    juntos: (id) => obter('/api/pessoas/juntos?id=' + encodeURIComponent(id)),
    contas: (programa) => obter('/api/contas' + (programa ? '?programa=' + encodeURIComponent(programa) : '')),
    conta: (id) => obter('/api/conta?id=' + encodeURIComponent(id)),
    orcamento: (id) => obter('/api/orcamento?id=' + encodeURIComponent(id)),
    acao: async (acao, dados = {}) => {
      const r = (await pedir('/api/acao', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao, dados, chave: chave() }),
      })).resultado;
      esquecer();
      return r;
    },
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

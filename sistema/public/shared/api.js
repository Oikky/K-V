/* Conversa com o servidor. Toda mudança vai por KVApi.acao(nome, dados): cada clique leva uma chave única,
   então um clique repetido (rede lenta, dois toques) não grava duas vezes. */
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
  const chave = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));

  window.KVApi = {
    estado: () => pedir('/api/estado'),
    orcamentos: () => pedir('/api/orcamentos'),
    pessoas: () => pedir('/api/pessoas'),
    juntos: (id) => pedir('/api/pessoas/juntos?id=' + encodeURIComponent(id)),
    contas: (programa) => pedir('/api/contas' + (programa ? '?programa=' + encodeURIComponent(programa) : '')),
    orcamento: (id) => pedir('/api/orcamento?id=' + encodeURIComponent(id)),
    acao: async (acao, dados = {}) => (await pedir('/api/acao', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao, dados, chave: chave() }),
    })).resultado,
  };
})();

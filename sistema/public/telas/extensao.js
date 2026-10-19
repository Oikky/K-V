/* Tela: Extensão do Chrome (instalar e atualizar). Endereço: /extensao.html
   Passo a passo pra instalar a barra da pesquisa (sistema/extensao/). Quem vê: todos (abre pelo menu da foto).
   O arquivo pra baixar é extensao/kv-pesquisa.zip, gerado com "npm run extensao".
   O estilo desta tela está em telas/extensao.css. */
KVTelas['extensao'] = function () {
  const passo = (n, titulo, texto) => `<li><span class="num">${n}</span><div><b>${titulo}</b><p>${texto}</p></div></li>`;
  (async function iniciar() {
    document.body.insertAdjacentHTML('afterbegin', '<p class="carregando area">Carregando…</p>');
    try {
      const est = await KVApi.estado();
      const dono = est.eu.papel === 'dono' || est.eu.papel === 'admin';
      const versao = await fetch('/extensao/versao.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ versao: '' }));
      document.querySelector('.carregando').remove();
      const app = KVShell.montar('', { dono });
      document.title = 'Extensão · K&V';
      app.innerHTML = `<div class="topo"><div><h1>Extensão do Chrome</h1><div class="muted">Barra lateral da pesquisa${versao.versao ? ` · versão ${versao.versao}` : ''}</div></div></div>
        <div class="ext">
          <section class="ext-o-que">
            <p>Do lado do site da companhia, a barra mostra o seu cronômetro e os orçamentos que estão com você. Ela <b>abre a busca já preenchida</b>
              (Smiles, Latam, Azul, Skyscanner) e tem o <b>formulário da opção de voo</b>, igual ao da tela de pesquisa, pra lançar sem trocar de aba.</p>
            <a class="btn primario" href="/extensao/kv-pesquisa.zip" download>${'<i data-lucide="download"></i>'}Baixar a extensão</a>
          </section>
          <h2>Instalar (uma vez só, no computador)</h2>
          <ol class="ext-passos">
            ${passo(1, 'Baixe e descompacte', 'Clique em "Baixar a extensão". Clique com o botão direito no arquivo baixado → <b>Extrair tudo</b>. Guarde a pasta <b>kv-pesquisa</b> num lugar fixo (ex.: Documentos). Não apague depois: o Chrome usa essa pasta.')}
            ${passo(2, 'Abra as extensões do Chrome', 'Na barra de endereço, digite <code>chrome://extensions</code> e aperte Enter.')}
            ${passo(3, 'Ligue o modo do desenvolvedor', 'Botão no canto de cima, à direita. Ele só libera instalar extensão a partir de uma pasta.')}
            ${passo(4, 'Carregue a pasta', 'Clique em <b>Carregar sem compactação</b> e escolha a pasta <b>kv-pesquisa</b>.')}
            ${passo(5, 'Fixe o ícone', 'Clique na peça de quebra-cabeça ao lado da barra de endereço e no alfinete do <b>K&amp;V Pesquisa</b>. Clicar no ícone laranja abre a barra.')}
            ${passo(6, 'Entre', 'Na primeira vez, a barra pede pra entrar no sistema (o mesmo login Google). Depois disso, ela sabe quem é você.')}
          </ol>
          <h2>Atualizar</h2>
          <p class="muted">Quase tudo da barra vem do sistema, então ela se atualiza sozinha. Só quando a barra avisar "Tem versão nova da extensão":
            baixe de novo, troque o conteúdo da pasta <b>kv-pesquisa</b> pelo novo e clique no botão de recarregar (seta em círculo) do K&amp;V Pesquisa em <code>chrome://extensions</code>.</p>
          <h2>Como usar</h2>
          <ol class="ext-passos">
            ${passo(1, 'Buscar', 'Escolha o orçamento e o dia e toque no site: a aba abre com a busca preenchida.')}
            ${passo(2, 'Lançar', 'Preencha o voo no formulário da barra e toque em <b>Lançar</b> (ou Enter). Site e dia continuam pra próxima. O que você digitar fica salvo sozinho até ser lançado.')}
          </ol>
        </div>`;
      KVShell.icones();
    } catch (e) { const el = document.querySelector('.carregando'); if (el) el.textContent = e.message; }
  })();
};

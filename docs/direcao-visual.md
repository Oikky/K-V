# Direção visual (proposta, aguardando ok)

## Leitura da referência: HubSpot CRM (Behance)

Imagens em `referencias/behance-hubspot-crm/` (só locais; não vão pro repositório, por direito autoral).

**O que é:** conceito de redesign de um CRM de vendas. Interface escura, quase preta, com um verde-limão neon de destaque, fonte Urbanist, tudo em formato de pílula e cards bem arredondados. Tem versão desktop, tablet e celular (a do celular é clara).

**Vale aproveitar:**
- **Números grandes no topo** ("34 deals · 20 won · 3 lost"), com um selo pequeno de variação. Pra nós: orçamentos abertos, enviados e fechados no mês.
- **Barra de agenda no topo**, uma linha do tempo do dia. Pra nós: a faixa de **Próximos voos** (revisão, check-in, dia do voo).
- **Um card destacado em cor cheia** no meio dos cinzas: "este precisa de você agora". Pra nós: o orçamento que está esperando o dono.
- **Filtros em pílula com contagem** ("All · Hot · Due today"). Pra nós: as 8 etapas do orçamento.
- **Situação dentro do card**, com um seletor ("Call scheduled ▾"). Pra nós: a etapa do orçamento, trocável ali mesmo.
- **Painel lateral de detalhe** que abre sem sair da lista.
- **Menu lateral fino, só com ícones**, que deixa a tela toda pro trabalho.
- Pouca borda e pouca sombra: a hierarquia vem do tamanho e da cor das superfícies.

**Não vale:**
- **O verde-limão neon.** Não é a nossa marca, e "fundo preto + um neon" é o visual mais batido de dashboard feito por IA.
- **Listas em carrossel horizontal de cards.** Pra centenas de orçamentos e dezenas de opções de voo, tabela e lista vertical são mais rápidas de ler e comparar.
- **Texto minúsculo e cinza-claro sobre preto** (o mockup tem rótulos de ~8px). Os pesquisadores passam 4h por dia na tela.
- **Fotos de avatar em todo card.** Ninguém aqui tem foto cadastrada, e isso só ocupa espaço.
- **A palavra gigante "WORKSPACE"**, que é decoração e ocupa a área mais valiosa da tela.
- **Videochamada, personas, fluxo de usuário:** é apresentação do Behance, não interface.
- Imagens 06 e 16 são do próprio Behance, não do projeto.

## Leitura da logo

| Cor | Hex | Onde está |
|---|---|---|
| Azul-marinho noite | `#010E1F` | fundo |
| Laranja | `#FF8911` | o "&" |
| Azul-petróleo | `#087890` → `#68ACBE` | o arco do voo |
| Branco | `#FFFFFF` | K, V, avião, "EASY TRAVELING" |

As letras são uma sans geométrica bem pesada; "EASY TRAVELING" é Montserrat (ou muito parecida).

## Direção proposta: "Painel de voo à noite"

A K&V é azul-marinho com um laranja que chama a atenção: é o céu noturno com a luz de um avião. A interface usa o marinho da logo como fundo, superfícies um pouco mais claras empilhadas, e o **laranja só onde precisa de ação ou atenção do dono**, como o "&" na logo. O azul-petróleo do arco fica com o mundo dos **pontos e milhas**: saldos, programas, vagas.

Estratégia de cor: **contida** (neutros azulados + um destaque laranja + um secundário petróleo para informação).

### Tokens (tema escuro)

```css
:root {
  /* superfícies (do marinho da logo) */
  --bg:          #010E1F;  /* fundo da página */
  --surface-1:   #0B1B30;  /* cards */
  --surface-2:   #13263F;  /* card em foco, campos de formulário */
  --surface-3:   #1C3352;  /* hover, pílula selecionada */
  --line:        #213A5C;  /* divisórias quando precisar */

  /* texto */
  --text:        #F3F6FA;
  --text-2:      #A9B8CC;  /* secundário: legível, não cinza-fantasma */
  --text-3:      #7488A3;  /* rótulos pequenos */

  /* marca */
  --orange:      #FF8911;  /* ação principal e "precisa de você" */
  --orange-ink:  #1F1000;  /* texto em cima do laranja */
  --teal:        #1A8BA6;  /* pontos, milhas, programas */
  --teal-soft:   #68ACBE;

  /* estados (não competem com o laranja) */
  --ok:          #3CCB8B;  /* pago, emitido */
  --warn:        #F5C451;  /* vencendo, perto do limite */
  --danger:      #FF6B6B;  /* perdido, cancelado, limite estourado */

  /* forma */
  --r-pill: 999px;  --r-card: 20px;  --r-field: 12px;  --r-chip: 10px;
  --space: 4px;  /* escala: 4 8 12 16 24 32 48 64 */
  --shadow-pop: 0 12px 32px rgb(0 0 0 / .35);  /* só pra coisas flutuantes */
}
```

Tema claro: os mesmos papéis, com fundo `#F4F7FB`, cards brancos, texto `#0B1B30`, o laranja um pouco mais escuro (`#E8740A`) pra manter o contraste.

### Tipografia

- **Interface:** **Urbanist** (a mesma da referência). Geométrica e da família visual da logo, mas mais leve pra leitura longa. Números de preço e milhas com **algarismos tabulares**, pra coluna alinhar.
- **Marca e números grandes:** **Montserrat ExtraBold**, a mesma do "EASY TRAVELING", só nos KPIs e no nome K&V.
- Tamanho mínimo de 13px na interface; rótulos de dado com 12px no mínimo.

### Componentes-chave

- **Menu lateral fino** (ícones + nome no hover/expandido), com o cronômetro de ponto sempre visível pro pesquisador.
- **Faixa de próximos voos** no topo do painel do dono.
- **KPIs grandes** em Montserrat, com o selo de variação.
- **Fila de orçamentos** com pílulas por etapa e contagem; o card que espera o dono fica em laranja cheio.
- **Registro de opção de voo** como linha densa de tabela, com atalhos de teclado, porque é a tarefa mais repetida.
- **Painel lateral** de detalhe, sem sair da lista.

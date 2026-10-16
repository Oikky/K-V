# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

HTML, CSS e JavaScript puros, abertos no navegador ou num servidor local (`python -m http.server`). Custo zero: sem Firebase, Cloudflare, domínio, deploy nem API paga. Os dados são fictícios, em memória ou em JSON, e o acesso a eles fica num módulo separado, pra ser trocado por um backend de verdade no futuro.

## Users

- **Dono:** conversa com os clientes pelo WhatsApp, negocia, define o preço de venda, decide a emissão e gerencia as contas de pontos. Tem acesso total. Precisa ver rápido o que está esperando por ele: orçamentos pesquisados pra revisar, o que está a receber, vagas de beneficiário e pontos perto de vencer.
- **Pesquisador** (duas pessoas, pagas por hora): pega orçamentos da fila, procura voos em vários sites (Smiles, Latam, Azul, Interline, Skyscanner) e registra as opções de voo. Bate o próprio ponto com um cronômetro e vê quanto ganhou na semana. Não vê contas, valores de venda nem lucro.

## Product Purpose

Sistema interno da K&V, uma agência que emite passagens aéreas pelo menor custo: em pontos de contas de programas de fidelidade que ela gerencia, ou em dinheiro. Substitui o sistema atual, montado no Superhuman Docs. Dá certo quando nenhum orçamento se perde entre o pedido e a emissão, quando cada emissão em pontos respeita o saldo e o limite de beneficiários, e quando o dono sabe quanto vendeu, lucrou e tem a receber.

## Positioning

Não é um CRM genérico. O centro é a gestão de milhas de terceiros: o sistema cruza cada opção de voo com o valor da milha, o saldo das contas e as vagas de beneficiário por CPF, coisa que um CRM de vendas não faz.

## Operating Context

- O pedido chega pelo WhatsApp do dono e vira um orçamento com trechos e lista de conferência.
- A pesquisa acontece em várias abas de sites de companhias e programas ao mesmo tempo. O registro das opções é o trabalho repetitivo do dia.
- O orçamento passa por 8 etapas: Novo, Em pesquisa, Pesquisado, Enviado, Fechado, Emitido, Perdido, Cancelado.
- Glossário completo em `CONTEXT.md`.

## Capabilities and Constraints

- Ordem de construção: gestão de contas de pontos primeiro, atendimento depois.
- Admin primeiro; o site pros clientes vem depois.
- O sistema avisa, mas não bloqueia, nas regras de negócio (limite de beneficiários, lista de conferência).
- IA só depois do sistema completo, pra automatizar processos manuais que já existem.
- Dúvidas de negócio em aberto: `PERGUNTAS-PRO-DONO.md`.
- O sistema precisa ser **instalável pela web** (app que se baixa do navegador, no celular e no computador). Continua custo zero.

## Brand Commitments

- Nome: **K&V**, slogan **"Easy Traveling"**. Logo em `marca/Logo K&V.png`: "K&V" em branco com o "&" em laranja, um arco azul-petróleo e um avião, sobre azul-marinho escuro.
- A paleta do sistema parte da logo.
- A animação da logo na tela de entrada é guiada pessoalmente pelo dev: deixar só o espaço reservado.
- Interface em português do Brasil.

## Evidence on Hand

- Logo: `marca/Logo K&V.png`.
- Modelo do recibo atual: https://oikky.github.io/recibo-kv/
- Referência visual: `referencias/behance-hubspot-crm/` (só local, não vai pro repositório).
- Nenhum dado real de cliente ou conta entra no repositório, que é público.

## Product Principles

1. **Nada se perde.** Todo orçamento tem etapa e responsável visíveis.
2. **Avisar, não travar.** O dono sai do padrão com frequência; o sistema lembra e alerta, mas não bloqueia.
3. **Cada papel vê o seu.** O pesquisador vê só os dados do voo e o próprio ponto; dinheiro e contas ficam com o dono.
4. **Registro rápido.** Lançar uma opção de voo é a tarefa mais repetida e precisa ser a mais rápida.
5. **Voltar desfaz o último passo.** O voltar do celular e o botão de voltar do mouse voltam pra aba, vista, filtro ou janela anterior. Abrir uma janela, trocar de vista ou de aba conta como um passo; nunca joga a pessoa pra fora do sistema.

## Accessibility & Inclusion

Uso de muitas horas por dia, no desktop, ao lado das abas de pesquisa. Também precisa funcionar no celular (o dono atende pelo WhatsApp). Respeitar "reduzir movimento".

# Tarefas

O que está combinado fazer, em ordem de etapa do projeto.

## Etapa 1: Contexto
- [x] Entrevista feita; glossário e decisões no `CONTEXT.md`.
- [ ] Levar as dúvidas de `PERGUNTAS-PRO-DONO.md` ao dono.

## Etapa 2: Direção visual
- [x] Referência (HubSpot CRM, Behance) lida; imagens só locais em `referencias/`.
- [x] Tokens aprovados em `docs/direcao-visual.md`.

## Etapa 3: Rascunhos e sistema
Rodar: `python -m http.server 8790` dentro de `_rascunhos` (a porta 8765 é do Sunnify).
- [x] Gestão de contas: lista, detalhe, entrada, saída, nova conta (rodadas 1 a 5).
- [ ] Configurações dos programas: escolher entre A, B e C da rodada 5.
- [ ] Atendimento: fila de orçamentos, lançamento de opções de voo, decisão do dono, emissão.
- [ ] Clientes e passageiros, financeiro, ponto do pesquisador.
- [ ] Admin de verdade (depois dos rascunhos aprovados), e só então o site dos clientes.
- [ ] **Recibo:** estudar o layout do modelo atual (https://oikky.github.io/recibo-kv/) e adaptar pro sistema novo, com melhorias. O recibo é gerado a partir da emissão e salvo em PDF pelo navegador.
- [ ] **Próximos voos:** lista no painel do dono com os lembretes de revisão, check-in e dia do voo (substitui o Google Agenda por enquanto).
- [ ] **Instalável pela web (PWA):** manifesto, ícones a partir da logo, service worker pra abrir sem internet e o botão "instalar" do navegador, no celular e no computador. Sem loja de aplicativo e sem custo.
- [ ] **Voltar = passo anterior:** em todas as telas, o voltar do celular e do mouse desfaz o último passo (aba, vista, filtro, janela). Já funciona nos rascunhos de contas.
- [ ] Tela de entrada: espaço reservado pra animação da logo (não animar; a animação vai ser guiada depois).

## Futuro (só depois do sistema todo montado)
A IA serve pra automatizar processos manuais chatos que já existem. Então primeiro vem o fluxo manual completo.

- [ ] **IA no atendimento do dono:** o dono manda um áudio explicando o pedido, e a IA monta o orçamento (trechos, datas, lista de conferência) num formato padrão. Atalhos como "o de sempre" ou "igual ao último" reaproveitam um orçamento anterior do mesmo contato. Por isso o orçamento precisa ser bem estruturado desde já.

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
- [x] Configurações dos programas: escolhida a B da rodada 5 (um programa por vez, com − e +).
- [x] Ponto do pesquisador: `ponto.html` (cronômetro ao lado da semana) e `folha.html` (cartão por pesquisador), rodada 6.
- [x] Clientes e passageiros: `clientes.html` (por cliente + tabela) e `pessoa.html` (viagens + coluna lateral), rodada 7.
- [x] Atendimento, rodada 8: fila, novo orçamento e pesquisa (opções de voo), refeitos no jeito da referência.
- [ ] Atendimento, rodada 9: `proposta.html` ajustada com o usuário (milhas em destaque, valor da milha por combinação, à vista e parcelado) e pronta pra mostrar ao dono; `fechamento.html` e `emissao.html` feitos, ainda sem revisão. Seguem a suposição da pergunta 13.
- [ ] Financeiro (depois do atendimento, porque usa vendas e recebimentos).
- [ ] Admin de verdade (depois dos rascunhos aprovados), e só então o site dos clientes.
- [ ] **Recibo:** estudar o layout do modelo atual (https://oikky.github.io/recibo-kv/) e adaptar pro sistema novo, com melhorias. O recibo é gerado a partir da emissão e salvo em PDF pelo navegador.
- [ ] **Próximos voos:** lista no painel do dono com os lembretes de revisão, check-in e dia do voo (substitui o Google Agenda por enquanto).
- [ ] **Instalável pela web (PWA):** manifesto, ícones a partir da logo, service worker pra abrir sem internet e o botão "instalar" do navegador, no celular e no computador. Sem loja de aplicativo e sem custo.
- [ ] **Voltar = passo anterior:** em todas as telas, o voltar do celular e do mouse desfaz o último passo (aba, vista, filtro, janela). Já funciona nos rascunhos de contas.
- [ ] Tela de entrada: espaço reservado pra animação da logo (não animar; a animação vai ser guiada depois).

## Demonstração de IA (2026-10-17)
- [x] **Bot do Telegram** (`bot/bot.py`, `bot/Ligar bot.bat`): o dono manda o pedido em texto ou áudio; o áudio vira texto no PC (faster-whisper), a Claude monta o orçamento e ele entra na fila como Novo (`_rascunhos/dados/pedidos.json`, fora do git). Só pra mostrar a ideia ao dono; não é o sistema de verdade.

- [x] **O dono aprovou o bot (2026-10-17).** Decidido: bot e sistema de verdade juntos, tudo na Cloudflare (ver `docs/arquitetura.md`).

## Sistema de verdade (`sistema/`)
- [x] Base: Worker, desenho do banco (D1), login pelo Access, papéis, ações com histórico e sem lançamento em dobro. Testado no PC.
- [x] Publicado: https://kv-sistema.ikkysousa5.workers.dev, login com Google pelo Access (só os e-mails da equipe).
- [x] Bot na nuvem (Worker kv-bot): webhook, Whisper da Cloudflare, Claude, Confirmar/Cancelar. O bot/bot.py antigo foi aposentado.
- [ ] **Próximo:** fila de orçamentos lendo do banco (os pedidos do bot já estão lá, mas ainda não aparecem). Depois, o resto do atendimento.
- [ ] Contas de pontos, clientes e ponto no banco.
- [ ] Trazer os dados do Superhuman Docs.

## Futuro (só depois do sistema todo montado)
A IA serve pra automatizar processos manuais chatos que já existem. Então primeiro vem o fluxo manual completo.

- [ ] **IA no atendimento do dono:** o dono manda um áudio explicando o pedido, e a IA monta o orçamento (trechos, datas, lista de conferência) num formato padrão. Atalhos como "o de sempre" ou "igual ao último" reaproveitam um orçamento anterior do mesmo contato. Por isso o orçamento precisa ser bem estruturado desde já.

# Tarefas

O que está combinado fazer, em ordem de etapa do projeto.

## Etapa 1: Contexto
- [ ] Terminar a entrevista e fechar o `CONTEXT.md`.
- [ ] Levar as dúvidas de `PERGUNTAS-PRO-DONO.md` ao dono.

## Etapa 2: Direção visual
- [ ] Ler as referências (`referencias/`, ainda vazia) e a logo (`marca/`).
- [ ] Propor tokens (cores a partir da logo, fontes, espaçamentos, raios, sombras) e esperar o ok.

## Etapa 3: Rascunhos e sistema
- [ ] **Recibo:** estudar o layout do modelo atual (https://oikky.github.io/recibo-kv/) e adaptar pro sistema novo, com melhorias. O recibo é gerado a partir da emissão e salvo em PDF pelo navegador.
- [ ] **Próximos voos:** lista no painel do dono com os lembretes de revisão, check-in e dia do voo (substitui o Google Agenda por enquanto).
- [ ] **Instalável pela web (PWA):** manifesto, ícones a partir da logo, service worker pra abrir sem internet e o botão "instalar" do navegador, no celular e no computador. Sem loja de aplicativo e sem custo.
- [ ] **Voltar = passo anterior:** em todas as telas, o voltar do celular e do mouse desfaz o último passo (aba, vista, filtro, janela). Já funciona nos rascunhos de contas.
- [ ] Tela de entrada: espaço reservado pra animação da logo (não animar; a animação vai ser guiada depois).

## Futuro (só depois do sistema todo montado)
A IA serve pra automatizar processos manuais chatos que já existem. Então primeiro vem o fluxo manual completo.

- [ ] **IA no atendimento do dono:** o dono manda um áudio explicando o pedido, e a IA monta o orçamento (trechos, datas, lista de conferência) num formato padrão. Atalhos como "o de sempre" ou "igual ao último" reaproveitam um orçamento anterior do mesmo contato. Por isso o orçamento precisa ser bem estruturado desde já.

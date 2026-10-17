# Arquitetura do sistema de verdade

Decidido em 2026-10-17. Tudo na Cloudflare, no plano grátis. O único custo é a API da Claude, usada pelo bot.

## O caminho de cada coisa

```
Celular do dono / PC do pesquisador
        │  (login pelo Cloudflare Access: conta Google ou código no e-mail)
        ▼
Worker "kv-sistema"  ──── serve as telas (os mesmos HTML/CSS/JS dos rascunhos)
        │                 /api/estado  → devolve os dados que o papel pode ver
        │                 /api/acao    → recebe um pedido de mudança, confere e grava
        │                 /telegram    → recebe as mensagens do bot (sem login, com senha secreta)
        ▼
Banco D1 (SQL)            Workers AI (Whisper: áudio → texto)      API da Claude (texto → orçamento)
```

- **Um Worker só** serve as telas, a API e o bot. Um endereço, um deploy.
- **Só o Worker grava.** A tela nunca mexe direto no banco: manda uma ação ("pegar orçamento", "registrar entrada") e o Worker confere quem pediu, se o papel pode, e grava.
- **Cada papel recebe só o seu.** O pesquisador nem recebe contas, pontos, valor da milha ou preço de venda: o Worker corta antes de mandar.
- **As telas não mudam.** Hoje elas leem tudo de `window.KV` (dados fictícios). No sistema, o `KV` carrega os dados de `/api/estado` ao abrir e manda cada mudança pra `/api/acao`.

## Login

O Cloudflare Access fica na frente de tudo (menos do `/telegram`). Só entra quem tiver o e-mail liberado. O Worker lê o e-mail que o Access manda e procura na tabela `usuarios` qual é o papel (dono ou pesquisador). E-mail fora da tabela não vê nada.

## Bot do Telegram

1. O Telegram chama `/telegram` com a senha secreta. O Worker confere a senha e o chat liberado e responde "ok" na hora.
2. Depois de responder (`waitUntil`), o áudio vira texto no Whisper da Cloudflare e a Claude monta o orçamento.
3. O bot mostra o resumo com os botões **Confirmar** e **Cancelar**. O orçamento só entra na fila quando o dono confirma.
4. Sem nome ou WhatsApp do cliente, o bot pergunta e espera a próxima mensagem da mesma pessoa (15 min).

## Regras dos dados

- **Pontos, dinheiro e valor da milha em números inteiros.** Dinheiro em centavos. Valor da milha em milionésimos de real (R$ 0,016 = 16000), porque o ajuste fino é de R$ 0,0005.
- **Histórico de tudo** (tabela `eventos`): quem fez, o quê, quando e como estava antes. É dela que sai o histórico do orçamento.
- **Sem lançamento em dobro:** toda ação leva uma chave única. Se a mesma chave chegar de novo (internet caiu e a tela reenviou, ou o Telegram repetiu), o Worker devolve o resultado da primeira vez.
- **Saldo nunca é digitado:** sai da soma das entradas menos as saídas. Cada entrada guarda quanto dela ainda resta, e as saídas gastam primeiro o que vence antes.
- **Nenhum dado real no repositório.** O repositório é público: aqui fica só o código e o desenho do banco. Os dados ficam no D1.

## Cópia de segurança

- O D1 guarda 30 dias de "volta no tempo" sozinho (Time Travel).
- Depois: uma exportação diária automática pra fora da Cloudflare, pra não depender de uma conta só.

## Ordem de construção

1. **Base:** Worker, banco, login e papéis. *(agora)*
2. **Bot na nuvem:** grava direto no banco, com Confirmar/Cancelar.
3. **Atendimento:** fila, pesquisa, proposta, fechamento e emissão lendo e gravando no banco.
4. **Contas de pontos, clientes e ponto**, um por vez.
5. **Trazer os dados do Superhuman Docs** (saldos atuais entram como "Saldo do sistema antigo").
6. Financeiro (ainda sem rascunho), recibo, próximos voos e instalável (PWA).

## Pastas

- `sistema/`: o Worker (`src/`), as telas (`public/`), o desenho do banco (`migrations/`) e a configuração (`wrangler.jsonc`).
- `_rascunhos/`: continua como está, com dados fictícios, pra testar telas novas antes de levar pro sistema.

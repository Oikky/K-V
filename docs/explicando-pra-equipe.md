# Explicando o sistema pra equipe da K&V

Exemplos simples pra apresentar o sistema ao dono e aos pesquisadores. Os nomes são fictícios.

## As etapas de um orçamento

Todo orçamento passa por etapas, da primeira mensagem até a passagem emitida. O sistema mostra **em que etapa cada orçamento está**. Assim ninguém precisa perguntar "já pesquisaram aquele?" ou "a pessoa respondeu?".

**Exemplo:** a Maria manda mensagem querendo ir de SP pra Lisboa em março.

| Etapa | O que aconteceu |
|---|---|
| 1. **Novo** | O dono anotou o pedido da Maria no sistema. Ninguém começou a pesquisar. |
| 2. **Em pesquisa** | Um pesquisador pegou o orçamento e está procurando voos. |
| 3. **Pesquisado** | O pesquisador terminou. As opções estão lá esperando o dono olhar. |
| 4. **Enviado** | O dono escolheu as melhores e mandou o preço pra Maria. Agora é esperar a resposta dela. |
| 5. **Fechado** | A Maria disse "quero essa". O dono marca a opção aceita e cadastra os passageiros. |
| 6. **Emitido** | A passagem foi comprada e tem localizador. Acabou. |
| 7. **Perdido** | A Maria desistiu ou sumiu. O orçamento fica guardado, mas sai da fila. |
| 8. **Cancelado** | A passagem já tinha sido emitida e a Maria cancelou. Se foi em pontos, eles voltam pra conta. |

**E se ela só mudar a data?** Aí é remarcação: o orçamento continua em Emitido, e o sistema só atualiza o voo e anota o custo extra, se houver.

**Por que "Pesquisado" e "Enviado" são separados:** o dono enxerga de um lado o que precisa revisar e mandar, e do outro o que está esperando resposta da pessoa.

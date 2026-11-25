# Perguntas pro dono

Dúvidas de negócio que só quem opera a K&V sabe responder. Enquanto não houver resposta, o sistema segue a **suposição provisória** de cada item. Quando o dono responder, atualizar o `CONTEXT.md` e riscar a pergunta aqui.

## Beneficiários

1. **Limites e renovação por programa.** Estes números estão certos? Hoje o sistema usa:
   - Smiles: 25 CPFs, zera em 1º de janeiro; ok
   - Latam Pass: 25 CPFs, cada um libera a vaga 12 meses depois da emissão; ok
   - TudoAzul: 5 CPFs (até 8 conforme a categoria), troca manual com 30 dias de carência. ok
   _Provisório:_ esses valores, editáveis numa tela de configuração.
2. **Categoria da conta Azul.** Vocês acompanham a categoria de cada conta (ela muda o limite de CPFs)?
   No documento antigo, as contas Azul tinham 7, 9 ou 10 vagas anotadas, mas o sistema só conhece de 5 a 8 (Básico a Diamante). Quantas vagas cada categoria dá de verdade? Teve um ano que a Azul deu de graça algumas vagas
   _Provisório:_ cada conta Azul guarda a sua categoria; as importadas ficaram sem categoria (contam 5 vagas) e com as vagas do documento antigo na observação da conta.
3. **Troca de CPF na Azul.** Vocês trocam CPF cadastrado? Precisa controlar os 30 dias de carência? Não costuma trocar, mas mantem a possibilidade
   _Provisório:_ o sistema registra a data da troca e avisa durante a carência.
4. **Interline e vagas.** Emitir pelo Interline (Azul pelo Mundo) gasta vaga de beneficiário da conta Azul? Não
   _Provisório:_ conta como emissão Azul normal.
5. **Avisar ou bloquear.** Quando uma emissão vai passar do limite, o sistema só avisa ou impede? Permite, mas deixa negativo
   _Provisório:_ só avisa.

## Pontos

6. **Vencimento.** O vencimento é anotado por lote (cada entrada vence numa data) ou é uma data só por conta? Com quantos dias de antecedência avisar? 
   _Provisório:_ por entrada, com aviso 60 dias antes.
7. **Valor da milha.** Os valores atuais estão certos (Smiles 0,016 · Latam 0,0255 · TudoAzul 0,015 · Interline 0,015)? Faz sentido ver o custo real ao lado, como referência? Não faz sentido
   _Provisório:_ sim aos dois.

## Emissão

9. **Taxa de embarque.** Na emissão em pontos, a taxa é paga com cartão da K&V? Precisa anotar qual cartão pagou? Sim e Sim
   _Provisório:_ anota-se só o valor da taxa, sem o cartão.

10. **Cancelamento e remarcação.** Quando o cliente cancela, a K&V devolve dinheiro? Tudo ou parte? E a multa da remarcação: quem paga, o cliente ou a K&V? 
   _Provisório:_ o sistema registra o valor devolvido e o custo extra, e cada caso é decidido pelo dono.

## Financeiro

11. **Resultado do mês.** Como você enxerga o que sobrou de verdade no mês? O lucro de cada venda já desconta o valor da milha. Os gastos com clube e compra de pontos entram de novo como despesa, ou não?
   _Provisório:_ a visão financeira mostra vendas, lucro, custos de pontos e folha separados, sem somar num "resultado".

## Orçamentos

13. **O que vai pro cliente.** Quando o pesquisador acha várias idas e voltas, o que você manda pra pessoa no WhatsApp? Uma combinação só (a melhor), 2 ou 3 combinações com preços diferentes (ex.: "mais barata com escala" e "direto"), ou todas as opções pra ela escolher trecho por trecho? Varia, podem ser de 1 a mais
   _Provisório:_ 2 ou 3 combinações, cada uma com um preço de venda pela viagem inteira (todos os passageiros); no fechamento, marca-se a que a pessoa aceitou.

14. **Quem pesquisa vê o valor em reais das milhas?** O pesquisador pediu pra ver quanto dá em reais uma opção em milhas (ex.: Smiles, 45.000 pts × R$ 0,016 = R$ 720 + taxa). Hoje só o dono vê o valor da milha e o custo; quem pesquisa vê só pontos e taxa. Libera pra quem pesquisa, ou continua só com o dono?
   _Provisório:_ continua só com o dono.

15. **Datas da viagem no pedido.** Hoje o pedido tem o dia exato, a janela de 14 dias (semana do dia e a seguinte) e "outros dias pra olhar" um por um. A equipe pediu mais liberdade. O que serve: escolher o tamanho da janela (só o dia, 3 dias pra cada lado, 7, 14, mês inteiro), ou um intervalo livre "de tal dia até tal dia"?
   _Decidido (25/11/2026):_ os dias de cada trecho são escolhidos num calendário em popup (parecido com o da Smiles): arrastar marca um período, tocar marca um dia solto; até 32 dias por trecho. A janela fixa de 14 dias saiu do formulário.

## Clientes e passageiros

12. **Dados de cada pessoa.** Além de nome e CPF, o que vocês precisam guardar de quem voa e de quem paga? Data de nascimento? WhatsApp e e-mail? Passaporte e validade (pra voo internacional)? Observações (ex.: "prefere janela")? Sim, tudo correto
   _Provisório:_ nome e CPF obrigatórios; nascimento, WhatsApp, e-mail, passaporte com validade e observações opcionais. O sistema avisa quando o passaporte vence perto de um voo internacional.

## Vocabulário

8. ~~"Orçamento"~~: respondido. É o pedido inteiro, com trechos e opções; ver CONTEXT.md.

# Perguntas pro dono

Dúvidas de negócio que só quem opera a K&V sabe responder. Enquanto não houver resposta, o sistema segue a **suposição provisória** de cada item. Quando o dono responder, atualizar o `CONTEXT.md` e riscar a pergunta aqui.

## Beneficiários

1. **Limites e renovação por programa.** Estes números estão certos? Hoje o sistema usa:
   - Smiles: 25 CPFs, zera em 1º de janeiro;
   - Latam Pass: 24 CPFs, cada um libera a vaga 12 meses depois da emissão;
   - TudoAzul: 5 CPFs (até 8 conforme a categoria), troca manual com 30 dias de carência.
   _Provisório:_ esses valores, editáveis numa tela de configuração.
2. **Categoria da conta Azul.** Vocês acompanham a categoria de cada conta (ela muda o limite de CPFs)?
   _Provisório:_ cada conta Azul guarda a sua categoria.
3. **Troca de CPF na Azul.** Vocês trocam CPF cadastrado? Precisa controlar os 30 dias de carência?
   _Provisório:_ o sistema registra a data da troca e avisa durante a carência.
4. **Interline e vagas.** Emitir pelo Interline (Azul pelo Mundo) gasta vaga de beneficiário da conta Azul?
   _Provisório:_ conta como emissão Azul normal.
5. **Avisar ou bloquear.** Quando uma emissão vai passar do limite, o sistema só avisa ou impede?
   _Provisório:_ só avisa.

## Pontos

6. **Vencimento.** O vencimento é anotado por lote (cada entrada vence numa data) ou é uma data só por conta? Com quantos dias de antecedência avisar?
   _Provisório:_ por entrada, com aviso 60 dias antes.
7. **Valor da milha.** Os valores atuais estão certos (Smiles 0,016 · Latam 0,0255 · TudoAzul 0,015 · Interline 0,015)? Faz sentido ver o custo real ao lado, como referência?
   _Provisório:_ sim aos dois.

## Emissão

9. **Taxa de embarque.** Na emissão em pontos, a taxa é paga com cartão da K&V? Precisa anotar qual cartão pagou?
   _Provisório:_ anota-se só o valor da taxa, sem o cartão.

10. **Cancelamento e remarcação.** Quando o cliente cancela, a K&V devolve dinheiro? Tudo ou parte? E a multa da remarcação: quem paga, o cliente ou a K&V?
   _Provisório:_ o sistema registra o valor devolvido e o custo extra, e cada caso é decidido pelo dono.

## Financeiro

11. **Resultado do mês.** Como você enxerga o que sobrou de verdade no mês? O lucro de cada venda já desconta o valor da milha. Os gastos com clube e compra de pontos entram de novo como despesa, ou não?
   _Provisório:_ a visão financeira mostra vendas, lucro, custos de pontos e folha separados, sem somar num "resultado".

## Vocabulário

8. ~~"Orçamento"~~: respondido. É o pedido inteiro, com trechos e opções; ver CONTEXT.md.

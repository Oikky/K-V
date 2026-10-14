# K&V — Admin

Sistema interno da K&V, agência que emite passagens aéreas pelo menor custo: em pontos (contas de programas de fidelidade que o dono gerencia) ou em dinheiro. Este arquivo é o glossário do negócio: só linguagem do domínio, sem detalhe de implementação.

> **Status:** rascunho. Termos marcados com *(vault)* vieram das notas internas da K&V e ainda precisam de confirmação do Ikky. Nada aqui é decisão final até ser confirmado.

## Pessoas e papéis

**Dono** *(vault)*:
Conversa com o cliente, negocia e decide qual opção vai ser emitida. Gerencia as contas de pontos.

**Pesquisador** *(vault)*:
Quem procura voos nos sites e registra as opções no sistema (hoje são duas pessoas).
_Evitar_: operador, estagiário (é cargo, não papel)

## Pontos e programas

**Programa** *(vault)*:
Programa de fidelidade onde ficam os pontos: Smiles, Latam Pass, TudoAzul, Livelo.

**Conta de pontos** *(vault)*:
Cadastro de uma pessoa (o titular) em um programa, com saldo. A K&V gerencia a conta, mas os pontos são do titular.

**Titular** *(vault)*:
Pessoa dona dos pontos de uma conta.

**Beneficiário** *(vault)*:
Pessoa que pode voar com os pontos de uma conta. Cada programa limita quantos beneficiários uma conta pode ter (e com que frequência pode trocar).

**Valor da milha** *(vault)*:
Quanto a K&V considera que custa 1 milha de cada programa (ex.: Smiles R$ 0,016). Anotado por milha, não por milheiro.
_Evitar_: milheiro (usar só quando for de fato o preço de 1.000)

**Interline** *(vault)*:
Azul pelo Mundo: emissão com pontos TudoAzul em companhias parceiras, quase sempre internacional. Tratado como um "site" separado do TudoAzul.

**Clube** *(vault)*:
Assinatura mensal de um programa que entrega pontos todo mês.

**Entrada** *(vault)*:
Pontos que entraram numa conta (clube, cartão, transferência, compra).

**Saída** *(vault)*:
Pontos que saíram de uma conta para emitir uma passagem.

## Pesquisa e decisão

**Orçamento** *(vault)*:
⚠️ A confirmar: no sistema atual é a opção de voo registrada (2.455 registros). Pode ser o pedido inteiro ou cada opção.

**Opção de voo** *(hipótese)*:
Um voo encontrado num site, com horários, escalas, bagagem, taxa e preço (em dinheiro ou em milhas + taxa). Cada sentido (ida ou volta) é registrado separado.

**Site** *(vault)*:
Onde a opção foi encontrada: Smiles, Latam, TudoAzul, Interline, Skyscanner (dinheiro).

**Taxa** *(vault)*:
Taxa de embarque. É paga em dinheiro mesmo quando a passagem sai em pontos.

**Custo em pontos** *(vault)*:
Milhas × valor da milha + taxa. É o número comparado com o preço em dinheiro.

**Janela de datas** *(vault)*:
Semana do dia pedido + semana seguinte (~14 dias), pesquisada para achar o dia mais barato.

## Emissão e pós-venda

**Emissão** *(vault)*:
Compra efetiva da passagem, sempre feita por uma pessoa da K&V.

**Localizador** *(vault)*:
Código da reserva gerado pela companhia na emissão.

**Recibo** *(vault)*:
Documento em PDF entregue ao cliente depois da emissão.

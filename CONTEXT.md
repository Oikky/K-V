# K&V — Admin

Sistema interno da K&V, agência que emite passagens aéreas pelo menor custo: em pontos (contas de programas de fidelidade que o dono gerencia) ou em dinheiro. Este arquivo é o glossário do negócio: só linguagem do domínio, sem detalhe de implementação.

> **Escopo (decidido em 2026-10-15):** o sistema substitui o Superhuman Docs inteiro (contas de pontos, entradas/saídas, beneficiários, atendimento, recibos, ponto). A gestão de contas vem primeiro e o atendimento depois.

> **Status:** rascunho. Termos marcados com *(vault)* vieram das notas internas da K&V e ainda precisam de confirmação. Nada aqui é decisão final até ser confirmado.

## Pessoas e papéis

**Dono** *(vault)*:
Conversa com o cliente, negocia e decide qual opção vai ser emitida. Gerencia as contas de pontos. Tem acesso total ao sistema: contas, entradas, saídas, configurações, valor da milha e financeiro.

**Pesquisador**:
Quem procura voos nos sites e registra as opções no sistema (hoje são duas pessoas). Recebe por hora trabalhada. No sistema, só registra o que pesquisou, bate o próprio ponto e vê quanto ganhou e quanto vai ganhar. Não vê contas, pontos, valor da milha nem o financeiro da K&V.
_Evitar_: operador, estagiário (é cargo, não papel)

**Ponto**:
Cronômetro de trabalho do pesquisador. Ele inicia o cronômetro quando começa a trabalhar e pausa quando sai (pra comer, por exemplo). As horas cronometradas são a base do que ele recebe.

**Valor da hora**:
Quanto o pesquisador recebe por hora trabalhada (hoje cerca de R$ 4,16). É definido pelo dono e pode ser diferente pra cada pesquisador.

**Jornada**:
Horas de referência por dia (hoje 4h). Não há dias fixos: o pesquisador trabalha de segunda a domingo, quando quiser e quando houver pesquisa. HIPÓTESE: a previsão da semana é o que ele ganharia fazendo a jornada em cada dia que falta até domingo (ou seja, o máximo possível), e não uma promessa.

**Fechamento semanal**:
O pagamento do pesquisador é calculado por semana: horas cronometradas × valor da hora. O pesquisador vê quanto já ganhou na semana e a previsão até o fim dela, pela jornada.

## Pontos e programas

**Programa** *(vault)*:
Programa de fidelidade onde ficam os pontos: Smiles, Latam Pass, TudoAzul, Livelo.

**Conta de pontos**:
Conta de um titular num programa, que ele colocou à disposição da K&V. A K&V usa a conta como quiser, em benefício próprio: acumula, gasta e emite pra quem decidir.
_Evitar_: cliente (no sistema antigo a página "Clientes" era, na verdade, de contas)

**Titular**:
Pessoa em cujo nome está a conta de pontos. Só cede a conta: não participa das decisões nem é cliente por causa disso. A K&V não deve nada ao titular, e o sistema não registra acerto com ele.
_Evitar_: cliente, dono dos pontos

**Cliente**:
Pessoa que compra passagem com a K&V. Um titular também pode ser cliente, mas aí são dois papéis separados. Só vira cliente no fechamento, quando o cadastro completo é feito.
_Evitar_: titular, conta

**Contato**:
Quem pediu o orçamento, anotado só com nome e WhatsApp. É pelo WhatsApp que se acham os orçamentos antigos da mesma pessoa. Se ela fechar, vira cliente.
_Evitar_: lead, cliente (antes do fechamento)

**Beneficiário**:
CPF que já voou com os pontos de uma conta. Depois que o CPF vira beneficiário, ele pode voar com aquela conta quantas vezes quiser. Um passageiro novo ocupa uma vaga; um que já é beneficiário não ocupa.
_Evitar_: passageiro (passageiro é quem voa numa emissão; beneficiário é o vínculo do CPF com a conta)

Também pode ser registrado à mão na conta (ex.: CPF que já tinha voado antes do sistema, ou cadastrado direto no programa). Nesse caso, a data informada define quando a vaga volta.

**Limite de beneficiários**:
Quantos CPFs diferentes podem ser beneficiários de uma conta. Quem define é o programa (Smiles, Latam etc.); na Azul, também depende da categoria da conta. O risco é emitir pra um CPF novo numa conta que já está no limite. O sistema avisa, sem bloquear (provisório, ver `PERGUNTAS-PRO-DONO.md`).

**Vaga de beneficiário**:
Limite de beneficiários do programa menos os CPFs que já são beneficiários da conta. O CPF do titular não ocupa vaga.

**Renovação de vagas**:
Regra pela qual um programa libera vagas de beneficiário. Muda de programa pra programa. ⚠️ A pesquisa pública (set/2026) indica, ainda sem confirmação do dono:
- **Smiles**: 25 CPFs por ano civil; zera em 1º de janeiro.
- **Latam Pass**: 24 CPFs em janela móvel; cada CPF libera a vaga 12 meses depois da emissão.
- **TudoAzul**: 5 CPFs (6 a 8 conforme a categoria da conta); não zera sozinho. A troca é manual, com 30 dias de carência antes de emitir pro CPF novo.

**Valor da milha**:
Preço de 1 milha de um programa, definido pelo dono (ex.: Smiles R$ 0,016). É o número usado nas cotações. Anotado por milha, não por milheiro.
_Evitar_: milheiro (usar só quando for de fato o preço de 1.000)

**Custo real da milha**:
Quanto 1 milha custou de verdade, calculado a partir do custo das entradas. Serve só de referência pro dono revisar o valor da milha; não é usado na cotação.

**Interline** *(vault)*:
Azul pelo Mundo: emissão com pontos TudoAzul em companhias parceiras, quase sempre internacional. Tratado como um "site" separado do TudoAzul.

**Clube** *(vault)*:
Assinatura mensal de um programa que entrega pontos todo mês.

**Entrada**:
Pontos que entraram numa conta. Tem um tipo e, quando houver, um custo em R$. Os tipos são:
- **Clube**: mensalidade do programa (tem custo).
- **Compra de pontos**: tem custo.
- **Transferência**: pontos vindos de outro programa (ex.: Livelo → Smiles), às vezes com bônus. O custo vem dos pontos de origem.
- **Cartão de crédito**: pontos gerados por gastos (sem custo).
- **Bônus**: promoção do programa (sem custo).
- **Estorno**: pontos que voltam de uma emissão cancelada.

**Saída**:
Pontos que saíram de uma conta. Os tipos são:
- **Emissão**: passagem emitida com os pontos.
- **Transferência**: pontos enviados pra outro programa. É uma saída na conta de origem e uma entrada na de destino.
- **Expiração**: pontos que venceram sem uso.
- **Ajuste**: correção manual quando o saldo do sistema não bate com o do programa.

**Vencimento**:
Data em que um lote de pontos expira. O sistema avisa quando há pontos perto de vencer. HIPÓTESE: o vencimento é registrado em cada entrada, porque cada lote vence numa data diferente.

## Pesquisa e decisão

**Orçamento**:
O pedido de viagem de uma pessoa, com todos os trechos e a janela de datas (ex.: 5 cidades em 3 semanas), e todas as opções de voo pesquisadas pra ele. Muitos orçamentos não fecham. Tem duas fases: pesquisa e fechamento.
_Evitar_: cotação, pedido (usar "orçamento" pro todo)

**Responsável**:
Pesquisador encarregado de um orçamento. Normalmente ele mesmo pega o orçamento da fila de novos, mas o dono também pode passar um orçamento direto pra alguém. O outro pesquisador vê que o orçamento já tem responsável.

**Trecho**:
Um deslocamento pedido dentro do orçamento, de uma origem pra um destino, com as datas ou a faixa de datas aceita.

**Opção de voo**:
Um voo encontrado num site pra um trecho, com valores e datas: horários, escalas, bagagem, taxa e preço (em dinheiro ou em milhas + taxa). Cada sentido (ida ou volta) é registrado separado.

**Fechamento**:
Momento em que o cliente aceita. Marcam-se no orçamento as opções aceitas e só então se registram o cliente e os passageiros.

**Passageiro**:
Pessoa que vai voar numa opção aceita. Pode ser o próprio cliente ou outra pessoa.

**Etapa do orçamento**:
Em que ponto do caminho o orçamento está. São 8 etapas (decidido em 2026-10-15):
1. **Novo**: o pedido foi anotado e ninguém começou a pesquisar.
2. **Em pesquisa**: um pesquisador está procurando voos.
3. **Pesquisado**: as opções estão prontas, esperando o dono revisar.
4. **Enviado**: o dono mandou a proposta pra pessoa e espera a resposta.
5. **Fechado**: a pessoa aceitou; as opções aceitas estão marcadas e os passageiros, cadastrados.
6. **Emitido**: as passagens foram emitidas e têm localizador.
7. **Perdido**: a pessoa desistiu ou sumiu. O orçamento fica guardado, mas sai da fila.
8. **Cancelado**: a passagem já tinha sido emitida e foi cancelada depois.

"Pesquisado" e "Enviado" ficam separados de propósito: assim o dono vê de um lado o que ainda precisa revisar e mandar, e do outro o que está esperando resposta.
_Evitar_: status, fase

**Site** *(vault)*:
Onde a opção foi encontrada: Smiles, Latam, TudoAzul, Interline, Skyscanner (dinheiro).

**Taxa** *(vault)*:
Taxa de embarque. É paga em dinheiro mesmo quando a passagem sai em pontos.

**Custo em pontos**:
Milhas × valor da milha + taxa. É quanto a opção custa pra K&V quando sai em pontos.

**Preço em dinheiro**:
Quanto a passagem custa comprada direto, sem pontos (achado no Skyscanner ou no site da companhia). Serve de teto: é o que o cliente pagaria sozinho.

**Preço de venda**:
Quanto o cliente paga à K&V. O dono digita caso a caso, olhando lado a lado o custo, o preço em dinheiro e o lucro. Não existe margem automática.
_Evitar_: valor, preço final

**Recebimento**:
Pagamento do cliente à K&V por um orçamento fechado: forma (Pix, cartão, parcelado) e situação (**a receber**, **pago em parte**, **pago**). Pode-se emitir antes ou depois de receber: depende da confiança do dono na pessoa, e o sistema não impõe regra.

**A receber**:
Soma do que os clientes ainda devem à K&V.

**Lucro**:
Preço de venda menos custo. Só o dono vê; o pesquisador vê só os dados do voo.

**Lista de conferência**:
Itens que o pesquisador confere antes de marcar o orçamento como Pesquisado. A lista padrão: janela de 14 dias, bagagem, link de cada preço, pontos e dinheiro. Ela lembra, não bloqueia. Cada orçamento tem a sua: o dono ajusta conforme o pedido do cliente (ex.: "só voo direto", "só pontos"), e o pedido especial fica escrito no orçamento em vez de se perder na conversa.

**Janela de datas** *(vault)*:
Semana do dia pedido + semana seguinte (~14 dias), pesquisada para achar o dia mais barato.

## Emissão e pós-venda

**Emissão**:
Compra efetiva da passagem, sempre feita por uma pessoa da K&V no site do programa ou da companhia. Depois, registra-se no sistema, pra cada voo emitido: como saiu (pontos ou dinheiro), de qual conta (se em pontos), os passageiros (nome e CPF) e o localizador. Uma emissão em pontos gera sozinha a saída na conta. O sistema avisa, já na escolha da conta, se o CPF vai estourar o limite de beneficiários.

**Localizador** *(vault)*:
Código da reserva gerado pela companhia na emissão.

**Recibo**:
Documento entregue ao cliente depois da emissão, com nome, voos, localizador e valor pago. O dono gera no sistema e salva em PDF. O modelo atual é a base.

**Revisão**:
Conferência, antes do voo, de que a companhia não mudou horário nem voo.

**Cancelamento**:
Desfazer uma passagem já emitida. Se ela saiu em pontos, os pontos voltam pra conta como entrada do tipo estorno. Registra-se também se a K&V devolveu dinheiro ao cliente e quanto. O orçamento vai pra etapa Cancelado.

**Remarcação**:
Troca de data ou voo de uma passagem já emitida. Atualizam-se o voo e o localizador (se mudar) e registra-se o custo extra, se houver. A etapa não muda.

**Lembretes do voo**:
Três momentos de cada voo emitido: revisão, abertura do check-in e dia do voo. Aparecem no painel do dono, na lista de próximos voos.

## Financeiro

**Visão financeira**:
O que o dono acompanha no mês: vendas, lucro, a receber, custos de pontos (clube e compra), folha dos pesquisadores, taxa de fechamento (quantos orçamentos fecham a cada 10) e saldo de pontos por programa, com o valor em R$.

**Vendas do mês**:
Soma dos preços de venda dos orçamentos fechados no mês.

**Folha**:
Quanto a K&V paga aos pesquisadores no período, pelas horas cronometradas.

## Decisões das telas

Registro das escolhas feitas nos rascunhos (as variações descartadas ficam na branch `rascunhos/rodada-1`).

**Rodada 1: gestão de contas (2026-10-16)**
- **Lista de contas:** a vista principal é **por titular** (um bloco por pessoa, com as contas dela dentro), e a **tabela por conta** fica como vista secundária. Por padrão, ordena de quem tem mais pontos pra quem tem menos, com a opção de ordenar por quem tem mais programas. Motivo: o dono pensa nas pessoas, não em contas soltas.
- **Valor em R$ do saldo:** não aparece. Motivo: não é informação relevante pro dono.
- **Detalhe da conta:** extrato com coluna lateral. Os beneficiários aparecem como **bolinhas** (uma por vaga; cheia = usada). Clicar nelas abre a lista de pessoas e o cadastro manual de beneficiário.
- **Registrar entrada:** o padrão é **uma entrada por vez** (formulário com prévia do saldo), com a opção de **várias de uma vez** (planilha com "puxar os clubes do mês").

**Rodada 4: fechando a gestão de contas (2026-10-16)**
- **Registrar saída:** **uma forma por tipo** (abas). A transferência mostra "sai de → chega em" com o bônus; a expiração lista os lotes vencendo de todas as contas; no ajuste, digita-se o saldo que aparece no site do programa e o sistema calcula a diferença. Motivo: cada tipo de saída tem um jeito próprio de pensar.
- **Nova conta:** **formulário único**, com titular existente ou novo.
- **Configurações dos programas:** a base é o **valor da milha com exemplo** ("uma emissão de 60.000 milhas custa R$ 960 + taxa"). O valor também pode ser **digitado**, não só arrastado, porque a diferença é milimétrica. Os níveis da Azul abrem numa janela. Novas versões dessa base foram pra rodada 5.
- **Lista de contas:** os filtros viram **listas de seleção**. Na tabela, clicar no nome da coluna ordena como no Windows: 1º clique do maior pro menor, 2º do menor pro maior, 3º desliga.

**Regras gerais de tela (2026-10-16)**
- **Celular é prioridade:** o dono usa o sistema principalmente no **celular**; os pesquisadores, no **computador**. O celular precisa estar impecável.
- **Lista longa vira busca:** toda seleção com muitas opções deixa digitar, e o que se escreve filtra as opções antes de escolher.
- **Voltar desfaz o último passo:** ver `PRODUCT.md`.


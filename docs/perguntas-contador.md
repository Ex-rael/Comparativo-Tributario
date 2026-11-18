# Perguntas ao contador: créditos de IBS/CBS e Simples híbrido

Lista para planejar os créditos de IBS e CBS sobre compras e o Simples Nacional híbrido no comparativo. Situação em 18/11/2026.

**Situação:**
- **Decidida:** respondida pelo usuário.
- **Receita:** respondida pelas calculadoras oficiais da Receita Federal. Detalhes em [`conferencia-calculadoras-rfb.md`](conferencia-calculadoras-rfb.md).
- **Parcial:** a Receita responde uma parte; o resto continua com o contador.
- **Aberta:** pergunta para o contador.

As perguntas que mais mudam o desenho são a **2**, a **18 e a 19** e as **28 a 30**.

## 1. O que o comparativo deve mostrar

| # | Pergunta | Situação | Resposta ou observação |
|---|---|---|---|
| 1 | Que ano(s) simular: só 2027, também 2026 ou a transição do IBS até 2033? | Decidida | Simular a transição do IBS até 2033 |
| 2 | A comparação mede só a carga da empresa ou também o efeito no cliente dela (crédito que o comprador perde se a empresa ficar no Simples puro)? | Decidida | Medir também o efeito no cliente |
| 3 | Quais regimes aparecem lado a lado? | Decidida | Simples puro, Simples híbrido, Presumido e Real |
| 4 | O resultado deve recomendar o regime ou só mostrar os números? | Decidida | Deve recomendar o regime |

## 2. IBS e CBS no Lucro Presumido e no Real

| # | Pergunta | Situação | Resposta ou observação |
|---|---|---|---|
| 5 | A apuração não cumulativa, com crédito amplo, vale igual para Presumido e Real? | Parcial | A calculadora trata os dois como "regime normal" (CRT 3), com as mesmas regras por nota; nada depende da forma de apurar o IR. Ela não faz a apuração do mês: confirmar com o contador |
| 6 | Quais alíquotas usar: as de referência, as de teste de 2026 ou uma hipótese do escritório? | Decidida | Manter a de referência e oferecer a comparação com a futura, estimada continuamente até a definição oficial. A Receita só tem alíquotas de 2026; as de 2027 em diante ainda não existem |
| 7 | Quais aquisições dão crédito: insumos, revenda, serviços, energia, aluguel, frete, imobilizado, uso e consumo? | Parcial | O indicador de crédito do comprador por cClassTrib está em `fontes/rfb-cclasstrib.csv`. A lista por tipo de compra é com o contador |
| 8 | Quais não dão crédito (uso e consumo pessoal, itens vedados)? O escritório já usa uma lista? | Parcial | O CSV indica as classificações sem crédito e a anulação de crédito de quem vende. A lista de vedações de uso e consumo pessoal não está na base da Receita |
| 9 | O crédito do imobilizado é integral na compra ou parcelado? | Aberta | |
| 10 | O crédito condicionado ao pagamento (split payment) entra na simulação, ou supomos que todo tributo da compra foi pago? | Aberta | |
| 11 | Saldo credor (crédito maior que débito no mês): ressarcimento, carrega para o mês seguinte ou ignora? | Decidida | Carrega para o mês seguinte |
| 12 | Quais atividades com alíquota reduzida (60%, 30%, zero) ou regime específico aparecem nos clientes do escritório? | Parcial | Lista oficial no CSV: reduções de 30%, 40% (bares e restaurantes), 50% (bens imóveis), 60%, 70% (locação de imóveis), 80% e 100%. Quais aparecem nos clientes é com o contador |
| 13 | Exportação e venda a governo entram na simulação ou ficam fora, como hoje? | Parcial | A Receita tem as regras: exportação direta sem CBS/IBS, indireta suspensa, e transição de compras governamentais. Entrar ou não no comparativo é decisão do escritório |

## 3. Crédito nas compras conforme o fornecedor

| # | Pergunta | Situação | Resposta ou observação |
|---|---|---|---|
| 14 | Comprando de fornecedor do Simples puro, o crédito é só o IBS/CBS pago no DAS? Como estimar sem a nota: percentual médio por anexo, ou usar a nota? | Receita | O crédito é o valor destacado na nota: base × `pCBSSN` / `pIBSSN` (a parte do DAS que corresponde a CBS/IBS, calculada pelo PGDAS-D). Sem a nota, é preciso a repartição por anexo e faixa (pergunta 19) |
| 15 | Comprando de fornecedor no Simples híbrido, o crédito é integral? | Parcial | Pelo desenho da calculadora, o fornecedor no regime regular emite como o regime regular, e o crédito é o destacado na nota. É uma inferência, não está escrito: confirmar |
| 16 | Comprando de MEI ou de pessoa física, há crédito, mesmo que presumido? | Aberta | |
| 17 | Importação de bens e serviços tem relevância nos clientes do escritório? | Aberta | |

## 4. Simples Nacional híbrido

| # | Pergunta | Situação | Resposta ou observação |
|---|---|---|---|
| 18 | Na opção pelo regime regular, o que sai do DAS: só a parcela de CBS/IBS? Como se calcula a parte do DAS que fica? | Parcial | A calculadora do Simples deixa de calcular só CBS e IBS (o optante com `tpRegimeIBSCBS = 1` vai para o regime regular); o resto continua no PGDAS-D, que não é público. Hipótese do usuário: (a) alíquota efetiva = (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12; (b) DAS cheio = receita do mês × alíquota efetiva; (c) DAS remanescente = DAS cheio − parcela CBS − parcela IBS, com parcela = DAS cheio × % de repartição do tributo na faixa do anexo. Confirmar com o contador |
| 19 | A parcela do DAS que corresponde a CBS/IBS (hoje PIS/COFINS, ICMS e ISS) segue os percentuais de repartição de cada anexo e faixa? O escritório tem essa tabela conferida? | Aberta | Não está nos repositórios. A Receita fala em "percentuais pré-carregados por anexo e ano, aplicáveis à primeira faixa", mas eles ficam no banco centralizado, com integração ao PGDAS-D prevista para a release 16 |
| 20 | Como o Fator R e o sublimite se comportam no híbrido? | Aberta | A calculadora só mostra que, acima do sublimite (CRT 2), o IBS sai pelo regime regular |
| 21 | A opção é por semestre ou por ano, e em que janela? | Aberta | Define se o comparativo simula meio ano em cada regime |
| 22 | A partir de que perfil de cliente o híbrido costuma compensar (proporção B2B, margem, peso das compras)? | Aberta | |
| 23 | Uma empresa no híbrido paga mais que no Simples puro quando vende para consumidor final? | Aberta | É o caso em que o híbrido não compensa, e o comparativo precisa mostrar |

## 5. Simples Nacional puro depois da reforma

| # | Pergunta | Situação | Resposta ou observação |
|---|---|---|---|
| 24 | Quanto de crédito o comprador do cliente consegue aproveitar: o IBS/CBS pago no DAS? Como estimar? | Parcial | O comprador se credita do valor destacado na nota (`pCBSSN` / `pIBSSN`). A estimativa depende da repartição (pergunta 19) |
| 25 | Esse crédito menor deve aparecer no resultado como custo comercial do cliente: perda de competitividade ou desconto que ele teria de dar? | Aberta | |

## 6. Dados do Fiscal: vendas × compras

| # | Pergunta | Situação | Resposta ou observação |
|---|---|---|---|
| 26 | Qual relatório de compras e vendas o setor Fiscal já tira hoje, e de qual sistema? Pode mandar um modelo sem dados reais? | Aberta | |
| 27 | Os dados vêm por mês, por nota, por CFOP, por NCM/NBS ou só em totais? | Aberta | |
| 28 | As vendas podem ser separadas por tipo de cliente: empresa contribuinte (B2B), consumidor final (B2C), governo, exportação? | Aberta | |
| 29 | As compras podem ser separadas por tipo (revenda, insumo, serviço, energia, aluguel, frete, imobilizado, uso e consumo) e por regime do fornecedor (Simples, regular, MEI, pessoa física)? | Aberta | |
| 30 | Se não der para separar, que percentuais médios o contador aceita como premissa? Exemplo: "70% das compras dão crédito integral" | Aberta | |
| 31 | Quanto do histórico de 12 meses existe com essa separação? | Aberta | Hoje a ficha pede receita mensal; compras e despesas entram como um valor ou 12 |
| 32 | Quem do Fiscal vai preencher, e quanto tempo é aceitável por cliente? | Aberta | |

## 7. Transição e tributos atuais

| # | Pergunta | Situação | Resposta ou observação |
|---|---|---|---|
| 33 | Em 2027, com PIS/COFINS extintos e IPI zerado, o que muda nas compras com crédito que a ficha já pede (hoje de PIS/COFINS)? | Parcial | A calculadora confirma que PIS e COFINS só existem na base até 2026. Como reaproveitar os campos da ficha é desenho, com o contador |
| 34 | Entre 2029 e 2032, o ICMS e o ISS caem enquanto o IBS sobe. A simulação deve aplicar essa proporção ano a ano? | Parcial | A base deduz ICMS e ISS até 2032. As alíquotas ano a ano ainda não existem na base da Receita. Com a decisão 1 (simular até 2033), a resposta tende a ser sim |
| 35 | O ICMS e o ISS dentro do DAS continuam como estão até a transição? | Parcial | Os códigos de atividade do Simples a partir de 2027 mantêm "menos ICMS", "menos ISS" e "mais ICMS do I". O ritmo da troca por IBS dentro do DAS depende da repartição (pergunta 19) |

## 8. Validação

| # | Pergunta | Situação | Resposta ou observação |
|---|---|---|---|
| 36 | Há um ou dois clientes reais (um que venda para empresas e um para consumidor final) que o contador já calculou à mão, para servir de conferência? | Aberta | |
| 37 | Quem aprova as regras novas no `aliquotas.json` (crédito, repartição do DAS, cronograma): o contador sozinho ou com os sócios? | Aberta | |
| 38 | Algum ponto é controvertido e deve entrar como "a confirmar", como a LC 224 e os dividendos? | Aberta | Já marcado como a confirmar: o artigo da LC 214/2025 que exclui PIS, COFINS, ICMS e ISS da base na transição |

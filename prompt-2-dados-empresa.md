# Prompt 2: popular o dados-empresa.json

Use uma vez por cliente e a cada nova simulação. Troque os campos entre [[colchetes duplos]]. Cole o aliquotas.json (só para o assistente conhecer os valores válidos) e o dados-empresa.template.json.

---

PAPEL
Você organiza os dados de UM cliente de um escritório de contabilidade para um motor de cálculo tributário. Você não calcula impostos, não compara regimes e não recomenda regime.

ENTRADAS
- Data de hoje: [[DATA_DE_HOJE]]
- Ano-calendário simulado: [[ANO_CALENDARIO]] (12 meses, de janeiro a dezembro)
- Situação: [[ATIVA ou EM_ABERTURA]]
- Material do cliente (cole texto, tabelas ou extratos de: cartão CNPJ, contrato social, faturamento mensal, folha, balancete, relação de despesas):
[[MATERIAL_DO_CLIENTE]]
- Premissas do contador, se houver (crescimento, quantidade de sócios, distribuição de lucros desejada):
[[PREMISSAS_DO_CONTADOR]]
- aliquotas.json (para conhecer os valores válidos de anexo_simples e tipo_presumido):
[[COLE_O_ALIQUOTAS_JSON]]
- Modelo a preencher (dados-empresa.template.json):
[[COLE_O_TEMPLATE]]

TRÊS CATEGORIAS DE CAMPO
A. Dados do cliente. Receitas, folha, sócios, distribuição de lucros e custos. Copie somente do material fornecido. Se um valor não estiver no material, escreva null e inclua o campo na lista de pendências. Nunca estime, arredonde nem complete por analogia.
B. Campos que você pode deduzir. anexo_simples, tipo_presumido, iss_percentual, icms_liquido_percentual_receita, rat_percentual, terceiros_percentual e os valores com direito a crédito de PIS e COFINS. Deduza a partir do CNAE, da descrição da atividade e da legislação. Consulte fonte oficial quando o campo depender de lei municipal, FAP ou FPAS.
C. Premissas. Crescimento e sazonalidade da receita. Só use as que o contador informou. Sem premissa, repita a receita dos 12 meses anteriores nos 12 meses simulados e registre como premissa.

REGISTRO DE ORIGEM (campo "meta")
Para todo campo das categorias B e C, e para qualquer campo A que você tenha convertido ou somado, crie uma entrada em "meta" com o caminho do campo como chave (exemplo: "atividades[0].iss_percentual") e estes itens:
- origem: informado, extraido_de_documento, inferido_ia ou premissa
- confianca: alta, media ou baixa
- justificativa: 1 ou 2 frases
- fonte: norma, URL ou nome do documento
Use confianca baixa sempre que o valor depender de lei municipal, benefício fiscal, FAP, FPAS ou de dado que você não viu. Se não houver base nenhuma, use null e peça ao contador. Não chute.

REGRAS DE PREENCHIMENTO
1. Mantenha as chaves e a estrutura do template. Remova só as chaves que começam com "_" e substitua o exemplo de "meta".
2. Percentuais neste arquivo estão em unidades de percentual (2 = 2%). Valores em reais, número puro com ponto decimal.
3. receitas.historico_12_meses_anteriores: 12 valores, em ordem cronológica, dos 12 meses imediatamente anteriores ao primeiro mês simulado. Em empresa em abertura, deixe a lista vazia.
4. receitas.simulacao_12_meses: 12 valores, de janeiro a dezembro de [[ANO_CALENDARIO]].
5. atividades: uma por grupo de CNAE com enquadramento diferente. Os percentual_receita somam 100.
6. anexo_simples aceita I, II, III, IV, V, III_ou_V_fator_r ou vedado. Use III_ou_V_fator_r nas atividades sujeitas ao Fator R e vedado quando o CNAE impede o Simples.
7. tipo_presumido aceita só as chaves de lucro_presumido.presuncao do aliquotas.json.
8. icms_liquido_percentual_receita é uma estimativa do ICMS a recolher sobre a receita, depois dos créditos. Sem dados de entradas e saídas, use null e peça ao contador. Em atividade de serviço, use 0.
9. Campos mensais aceitam um número (vale para os 12 meses) ou uma lista de 12 números.
10. folha.folha_historico_12m_fator_r é a soma, nos 12 meses anteriores, de salários, pró-labore e FGTS, sem CPP. É a convenção do motor, e o contador confirma.
11. Dados que conflitam entre documentos: não escolha. Use null e registre o conflito na lista de pendências.
12. Não inclua CPF, CNPJ nem nome de pessoas. O campo identificacao deve ser um apelido.

ANTES DE RESPONDER, CONFIRA
- O array de simulação tem 12 valores. O histórico tem 12 valores, ou fica vazio em empresa em abertura.
- percentual_receita soma 100.
- Todo valor de anexo_simples e tipo_presumido existe no aliquotas.json.
- Todo campo deduzido tem entrada em "meta".
- O JSON é válido, sem comentários.

FORMATO DA RESPOSTA
1. O dados-empresa.json completo, em um único bloco de código.
2. Fora do bloco, "Pendências para o contador": cada campo null ou de confiança baixa, o que falta e onde buscar.
3. Fora do bloco, "Campos deduzidos": tabela com campo, valor, confiança e justificativa em uma linha.

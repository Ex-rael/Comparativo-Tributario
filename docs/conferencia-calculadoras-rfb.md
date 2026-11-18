# Conferência com as calculadoras oficiais da Receita Federal

Feita em 18/11/2026, na versão 2.0.0 do Comparativo. Compara o motor e o `aliquotas.json` com os três repositórios que a Receita publicou:

| Repositório | O que é | Interessa ao Comparativo? |
|---|---|---|
| [calculadora-rtc-regime-regular](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular) | API Java que calcula CBS, IBS e IS por item de nota fiscal no regime regular, com a base de dados oficial (pasta `flyway/sql`) | Sim: alíquotas de referência, base de cálculo, reduções e créditos |
| [calculadora-rtc-simples-nacional](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional) | API Java que calcula CBS e IBS das notas do optante pelo Simples (NT 2026.005) | Sim: como o CBS/IBS do Simples funciona e o que é o "Simples híbrido" |
| [calculadora-rtc-gerador-danfse](https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse) | Serviço em Go que gera o PDF da NFS-e (DANFSe) a partir do XML | Não: só gera documento, sem regra de cálculo |

**Limite importante:** as calculadoras trabalham **por nota fiscal**. Elas não fazem a apuração do mês (débitos menos créditos) nem o cálculo do DAS. O roadmap diz isso explicitamente ("não realiza a apuração assistida"; "o cálculo da alíquota efetiva do Simples permanece sob responsabilidade do PGDAS-D"). Por isso, servem para conferir alíquotas, bases e regras, não para substituir o motor.

## Como reproduzir

A base de dados é só SQL; dá para montá-la sem rodar o Java:

```bash
D=calculadora-rtc-regime-regular/flyway/sql
(cat $D/criacao/beforeMigrate.sql $D/criacao/B0001__sistema_tributario_completo.sql; \
 ls $D/manutencao/V*.sql | sort -V | xargs cat; cat $D/criacao/afterMigrate.sql) > tudo.sql
sqlite3 rfb.db < tudo.sql 2> erros.txt   # ~120 erros de chave duplicada e estrangeira, nas tabelas de documentos fiscais; não afetam as tabelas usadas aqui
sqlite3 rfb.db "select * from ALIQUOTA_REFERENCIA"
```

## O que confere

| Ponto | Comparativo | Receita | Situação |
|---|---|---|---|
| CBS em 2026 | `cbs_teste` 0,9% | `ALIQUOTA_REFERENCIA` CBS 0,90% (2026-01-01 a 2026-12-31) | Confere |
| IBS em 2026 | `ibs_teste` 0,1% | IBS estadual 0,10% e IBS municipal 0,00% | Confere; partilha registrada em `ibs_teste_partilha` |
| Alíquotas de 2027 em diante | `cbs_aplicar` e `ibs_aplicar` com os valores de teste, status `a_confirmar` | **Não existem.** A migração V0053 (28/08/2026) apagou as de 2027+ "para excluir e ajustar vigências"; a API devolve 404 e exige `aliquotasNominais` informadas, marcando o cálculo como simulado | Confere com a nossa postura (valor em definição, aviso de hipótese) |
| CBS/IBS no Simples comum | `simples_por_fora_do_das.aplicar = false`: não soma ao Simples | CBS e IBS ficam dentro do DAS (CRT 1). A nota destaca `pCBSSN`/`pIBSSN`, alíquotas efetivas calculadas pelo PGDAS-D, e o comprador se credita desses valores | Confere; nota e fonte atualizadas |
| Anexos e Fator R | Anexos I a V; III ou V pelo Fator R | Tabela `ATIVIDADE_SIMPLES_NACIONAL` com 15 códigos (cAtivSN), anexo sem e com Fator R | Confere na estrutura (só a atividade "09" depende do Fator R: III ou V) |

## O que estava diferente e foi corrigido

**Base da CBS e do IBS no Presumido e no Real.** O motor aplicava as alíquotas sobre a receita bruta. A calculadora deduz da base os tributos "por dentro" (`ElementoBaseCalculo`):

| Elemento | Base do regime regular | Base do Simples | Anos |
|---|---|---|---|
| vPIS, vCOFINS | deduz | não deduz | só 2026 |
| vICMS, vFCP, vICMSMono, vISSQN | deduz | não deduz | 2026 a 2032 |
| vIS (Imposto Seletivo) | soma | soma | 2027 a 2033 |

A versão 2.0.0 passou a deduzir PIS e COFINS em 2026 e ICMS e ISS de 2026 a 2032, lendo as vigências do novo bloco `reforma_consumo.base_regime_regular` do `aliquotas.json`. O IS não é modelado. No exemplo (`dados-empresa.exemplo.json`, botão ligado), o Presumido foi de 142.873,50 para 142.504,42 e o Real de 153.678,42 para 153.161,71. Com o botão desligado, nada muda.

Ficou a confirmar na norma: o artigo da LC 214/2025 que manda excluir esses tributos da base na transição (a calculadora não cita o artigo nesse ponto).

## O que falta no Comparativo (insumo para o desenho de créditos e do Simples híbrido)

1. **Simples híbrido.** Na calculadora (NT 2026.005), é o optante pelo Simples (CRT 1 ou 2) com `tpRegimeIBSCBS = 1`, "optante pelo regime regular do IBS/CBS". Essa operação sai do endpoint do Simples e segue as regras do regime regular, com créditos. A parte do DAS que sobra é do PGDAS-D e **não está nos repositórios**.
   - Não confundir com `CRT = 3` e `tpRegimeIBSCBS = 2`: empresa no regime normal com a opção pelo Simples pendente, com valores suspensos.
   - Na NFS-e, o campo `regApIBSCBSSN` tem três valores: 1 "IBS+CBS pelo SN", 2 "CBS pelo SN + IBS regular" e 3 "Ambos regulares". O valor 2 parece ser o caso do excesso de sublimite (CRT 2, em que o IBS sai pelo regime regular). Isso precisa de confirmação.
2. **Percentuais de CBS/IBS dentro do DAS.** São `pCBSSN` e `pIBSSN`. O roadmap da release 15 fala em "percentuais pré-carregados de IBS e CBS, por anexo e ano, aplicáveis à primeira faixa", mas eles ficam no banco centralizado da Plataforma da CBS, **não** no repositório. A integração com o PGDAS-D está prevista para a release 16. Por enquanto, a repartição por anexo e faixa continua sendo pergunta ao contador (19).
3. **Reduções de alíquota por atividade.** A tabela `PERCENTUAL_REDUCAO` tem 30%, 40% (bares e restaurantes), 50% (bens imóveis), 60%, 70% (locação de imóveis), 80% e 100% (alíquota zero), por cClassTrib. Exportada para `fontes/rfb-cclasstrib.csv`.
4. **Direito a crédito do comprador** por cClassTrib (`CLTR_IN_APROPRIACAO_CREDITOS_ADQUIRENTES_*`) e manutenção ou anulação do crédito de quem vende. Também no CSV.
5. **Venda a governo.** No Simples, a fração da CBS que passa para o IBS é 0 em 2027–2028, 10% a 40% de 2029 a 2032 e 100% a partir de 2033 (tabela `TRANSICAO_ALIQUOTA_COMPRA_GOV_SIMPLES_NACIONAL`). No regime regular, há um redutor de compra governamental.
6. **Exportação no Simples.** Pelo `tpRBSN`: exportação direta (código 3) sem CBS/IBS; exportação indireta (código 4) fica pendente/suspensa.

## Perguntas ao contador que a Receita já responde, total ou parcialmente

| Pergunta ([`perguntas-contador.md`](perguntas-contador.md)) | O que a calculadora mostra |
|---|---|
| 5. A não cumulatividade vale igual no Presumido e no Real? | A calculadora não distingue Presumido de Real: os dois são "regime normal" (CRT 3), com as mesmas regras de CBS/IBS por nota. Ela não faz a apuração do mês, então o crédito em si não aparece, mas nada no cálculo depende da forma de apurar o IR |
| 7 e 8. Quais compras dão crédito? | Indicador de crédito do comprador por cClassTrib (CSV). A lista de itens de uso e consumo pessoal vedados não está na base |
| 12. Atividades com redução | Lista oficial no CSV (30% a 100%) |
| 13. Exportação e governo | Regras do item 6 acima e da transição de compras governamentais |
| 14. Crédito comprando do Simples | É o valor destacado na nota: base × `pCBSSN` / `pIBSSN` (a parte do DAS que corresponde a CBS/IBS). Sem a nota, é preciso a repartição por anexo e faixa (pergunta 19) |
| 15. Crédito comprando do Simples híbrido | O fornecedor no regime regular emite como o regime regular, então o crédito é o destacado na nota (inferido do desenho da calculadora, não escrito) |
| 18. O que sai do DAS no híbrido | Só CBS e IBS (o endpoint do Simples deixa de calcular esses dois e o resto continua no PGDAS-D). A fórmula do DAS que sobra não está publicada |
| 34. ICMS/ISS caindo de 2029 a 2032 | A base deduz ICMS e ISS até 2032. As alíquotas ano a ano ainda não existem na base |
| 35. ICMS e ISS dentro do DAS | Os códigos de atividade continuam com "menos ICMS", "menos ISS", "mais ICMS do I" a partir de 2027 |

## Decisões que o usuário já tomou (18/11/2026, em [`perguntas-contador.md`](perguntas-contador.md))

1. Simular a transição do IBS até 2033.
2. A comparação mede também o efeito no cliente da empresa (crédito que o comprador aproveita).
3. Regimes lado a lado: Simples puro, Simples híbrido, Presumido e Real.
4. O resultado recomenda o regime.
6. Manter a alíquota de referência e oferecer a comparação com a futura, estimada continuamente até a definição oficial.
11. Saldo credor: carrega para o mês seguinte.

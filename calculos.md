# Memória de cálculo do Comparativo Tributário

Este documento descreve, em notação matemática, tudo o que o motor de cálculo (`index.html`, objeto `CTEngine`, versão 1.0.0) faz. Serve para o contador validar as regras sem abrir o código-fonte. A IA não calcula nada: toda a aritmética abaixo é executada pelo JavaScript da página, com o mesmo resultado para a mesma entrada.

> **Como ler.** Cada fórmula indica entre parênteses o campo do JSON de onde vem cada símbolo. Os parâmetros legais (alíquotas, faixas, limites) vêm do `aliquotas.json`; os dados do cliente vêm do `dados-empresa.json`. Se uma norma mudou, o ajuste é no `aliquotas.json`, não na fórmula.

## Sumário

1. [Notação](#1-notação)
2. [Preparação dos dados](#2-preparação-dos-dados)
3. [Encargos de folha](#3-encargos-de-folha)
4. [Simples Nacional](#4-simples-nacional)
5. [Lucro Presumido](#5-lucro-presumido)
6. [Lucro Real](#6-lucro-real)
7. [Retenção sobre lucros distribuídos](#7-retenção-sobre-lucros-distribuídos)
8. [Carga total e ranking](#8-carga-total-e-ranking)
9. [Análise de sensibilidade](#9-análise-de-sensibilidade)
10. [Exemplo numérico conferível](#10-exemplo-numérico-conferível)
11. [O que o motor não modela](#11-o-que-o-motor-não-modela)

---

## 1. Notação

Meses são indexados por $m \in \{1,\dots,12\}$ (janeiro a dezembro do ano simulado) e trimestres por $q \in \{1,2,3,4\}$, com $m \in \{3q-2,\,3q-1,\,3q\}$. Percentuais entram nas fórmulas como fração (4% = 0,04). No `dados-empresa.json` os percentuais são digitados em unidades de percentual (2 = 2%); o motor divide por 100 ao ler.

| Símbolo | Significado | Origem |
|---|---|---|
| $R_m$ | Receita simulada do mês $m$ | `receitas.simulacao_12_meses` |
| $H_j$ | Receita do $j$-ésimo mês anterior ao primeiro simulado ($j=1..12$, em ordem cronológica) | `receitas.historico_12_meses_anteriores` |
| $R = \sum_m R_m$ | Receita anual simulada | derivado |
| $s_a$ | Participação da atividade $a$ na receita ($\sum_a s_a = 1$) | `atividades[].percentual_receita` / 100 |
| $\iota_a$ | Alíquota de ISS da atividade $a$ | `atividades[].iss_percentual` / 100 |
| $\kappa_a$ | ICMS líquido estimado sobre a receita da atividade $a$ | `atividades[].icms_liquido_percentual_receita` / 100 |
| $\text{Sal}_m$ | Salários de empregados no mês | `folha.salarios_empregados_mensal` |
| $\text{Pro}_m$ | Pró-labore total no mês | `folha.prolabore_total_mensal` |
| $\rho$ | Alíquota de RAT | `folha.rat_percentual` / 100 |
| $\tau$ | Alíquota de terceiros | `folha.terceiros_percentual` / 100 |
| $n$ | Quantidade de sócios | `socios.quantidade` |

Campos mensais aceitam um número único (vale para os 12 meses) ou uma lista de 12 valores. Campo vazio vale 0.

Funções auxiliares:

$$\max(0,x) = \begin{cases} x & x>0 \\ 0 & x\le 0 \end{cases} \qquad [x]^+ \equiv \max(0,x)$$

---

## 2. Preparação dos dados

**Situação da empresa.** Se `empresa.situacao = "em_abertura"`, define-se $m_0$ como o primeiro mês com $R_m>0$ (os meses anteriores a $m_0$ não geram nenhum tributo). Para empresa ativa, $m_0 = 1$.

**Histórico.** Se o histórico tiver menos de 12 valores, completa-se à esquerda com zeros (e o motor emite aviso de RBT12 subestimado). Se tiver mais, usam-se os 12 últimos.

**Meses ativos no trimestre** (afeta o limite do adicional de IRPJ):

$$A_q = \begin{cases} 3 & \text{empresa ativa} \\ \#\{\,m \in \text{trimestre } q : m \ge m_0\,\} & \text{em abertura} \end{cases}$$

**ISS e ICMS médios ponderados pela mistura de atividades:**

$$\bar\iota = \sum_a s_a\,\iota_a \qquad\qquad \bar\kappa = \sum_a s_a\,\kappa_a$$

---

## 3. Encargos de folha

Calculados mês a mês, com $c_{\text{CPP}}$ e $c_{\text{FGTS}}$ vindos de `encargos_folha.cpp_patronal` (20%) e `encargos_folha.fgts` (8%):

$$\text{FGTS}_m = c_{\text{FGTS}}\cdot \text{Sal}_m$$

$$\text{CPP}_m = c_{\text{CPP}}\cdot(\text{Sal}_m + \text{Pro}_m)$$

$$\text{RAT}_m = \rho\cdot \text{Sal}_m$$

$$\text{Terc}_m = \tau\cdot \text{Sal}_m$$

Observações: o pró-labore entra só na CPP (RAT e terceiros incidem apenas sobre salários de empregados), e o FGTS **não** entra na carga tributária comparada, pois é igual nos três regimes. Ele aparece apenas como custo no Lucro Real.

**Folha do Fator R** (convenção do motor: salários + pró-labore + FGTS, sem CPP):

$$F_m = \text{Sal}_m + \text{Pro}_m + \text{FGTS}_m$$

---

## 4. Simples Nacional

### 4.1 Receita bruta acumulada (RBT12)

**Empresa ativa** (os 12 meses imediatamente anteriores ao mês $m$, formados pelo histórico e pelos meses já simulados):

$$\text{RBT12}_m = \sum_{j=m}^{12} H_j \;+\; \sum_{k=1}^{m-1} R_k$$

**Empresa em abertura** (proporcionalização pela média dos meses já apurados):

$$\text{RBT12}_m = \begin{cases} 12\,R_{m_0} & m = m_0 \\[4pt] \dfrac{12}{m-m_0}\displaystyle\sum_{k=m_0}^{m-1} R_k & m > m_0 \end{cases}$$

### 4.2 Fator R

Folha dos 12 meses anteriores, com $F^{\text{hist}}$ = `folha.folha_historico_12m_fator_r`:

$$\text{Folha12}_m = \begin{cases} F^{\text{hist}}\cdot\dfrac{12-(m-1)}{12} + \displaystyle\sum_{k=1}^{m-1} F_k & \text{ativa} \\[10pt] \dfrac{12}{m-m_0}\displaystyle\sum_{k=m_0}^{m-1} F_k \;\;(m>m_0),\quad 12\,F_{m_0}\;\;(m=m_0) & \text{em abertura} \end{cases}$$

$$\text{FatorR}_m = \begin{cases}\dfrac{\text{Folha12}_m}{\text{RBT12}_m} & \text{RBT12}_m>0 \\ 0 & \text{caso contrário}\end{cases}$$

Atividades marcadas `III_ou_V_fator_r` são enquadradas no mês $m$ por:

$$\text{Anexo}_m = \begin{cases}\text{III} & \text{FatorR}_m \ge f_{\min} \\ \text{V} & \text{FatorR}_m < f_{\min}\end{cases} \qquad f_{\min} = 0{,}28 \;(\texttt{fator\_r\_minimo})$$

### 4.3 Alíquota efetiva

Para o anexo do mês, seleciona-se a menor faixa $k$ tal que $\text{RBT12}_m \le \text{ate}_k$ (se exceder todas, usa-se a última). Sendo $a_k$ a alíquota nominal e $d_k$ a parcela a deduzir da faixa:

$$\alpha_m = \frac{\text{RBT12}_m\cdot a_k - d_k}{\text{RBT12}_m}$$

Se $\text{RBT12}_m = 0$, usa-se $\alpha_m = a_1$ (alíquota nominal da primeira faixa).

### 4.4 DAS do mês

A receita de cada atividade é $R_m\cdot s_a$ e cada atividade usa a $\alpha_m$ do seu anexo:

$$\text{DAS}_m = \sum_a R_m\, s_a\, \alpha_m^{(\text{anexo}_a)} \qquad\qquad \text{DAS} = \sum_{m=1}^{12}\text{DAS}_m$$

Atividade marcada `vedado` não gera DAS e torna o regime **inelegível**.

### 4.5 CPP fora do DAS (Anexo IV)

No Anexo IV a CPP não está incluída no DAS. Sendo $s^{IV}_m$ a soma das participações das atividades enquadradas no Anexo IV:

$$\text{CPP}^{\text{fora}}_m = s^{IV}\,\big(\text{CPP}_m + \text{RAT}_m\big) \qquad \text{CPP}^{\text{fora}} = \sum_m \text{CPP}^{\text{fora}}_m$$

O Simples não paga contribuições a terceiros.

### 4.6 Itens do regime e elegibilidade

$$\text{Carga}^{\text{empresa}}_{\text{Simples}} = \text{DAS} + \text{CPP}^{\text{fora}}$$

O regime fica **inelegível** se $\text{RBT12}_m > 4{,}8\text{ mi}$ (`limite_receita_anual`) em algum mês, ou se houver atividade `vedado`. Se $\text{RBT12}_m$ passar do sublimite de ICMS/ISS (`sublimite_icms_iss`), o motor emite aviso: a partilha fora do DAS não é modelada.

---

## 5. Lucro Presumido

### 5.1 Presunção ponderada

Para cada atividade, $\pi^{I}_a$ e $\pi^{C}_a$ são os percentuais de presunção de IRPJ e CSLL do `tipo_presumido` (`lucro_presumido.presuncao`):

$$\bar\pi^{I} = \sum_a s_a\,\pi^{I}_a \qquad\qquad \bar\pi^{C} = \sum_a s_a\,\pi^{C}_a$$

### 5.2 Acréscimo da presunção (LC 224/2025, status a confirmar)

Seja $L$ o limite de receita anual do acréscimo (`acrescimo_presuncao.limite_receita_anual`) e $p$ o percentual (`percentual`, 10%). Com receita acumulada $C_m = \sum_{k\le m} R_k$ e $C_0 = 0$, o excedente que cai no mês $m$ é:

$$E_m = [C_m - L]^+ - [C_{m-1} - L]^+$$

O acréscimo só vale a partir da vigência de cada tributo (`vigencia_irpj`, `vigencia_csll`) e se `ativo` não for falso:

$$\Delta^{I}_m = E_m\cdot\bar\pi^{I}\cdot p \quad(\text{se vigente}) \qquad \Delta^{C}_m = E_m\cdot\bar\pi^{C}\cdot p \quad(\text{se vigente})$$

### 5.3 Bases e apuração trimestral

$$B^{I}_m = R_m\,\bar\pi^{I} + \Delta^{I}_m \qquad\qquad B^{C}_m = R_m\,\bar\pi^{C} + \Delta^{C}_m$$

$$B^{I}_q = \sum_{m\in q} B^{I}_m \qquad\qquad B^{C}_q = \sum_{m\in q} B^{C}_m$$

Com $a_{I}=15\%$, $a_{ad}=10\%$, $\ell=20.000$ por mês (limite do adicional) e $a_{C}=9\%$:

$$\text{IRPJ}_q = a_I\,B^{I}_q \;+\; a_{ad}\,\big[B^{I}_q - \ell\,A_q\big]^+ \qquad\qquad \text{CSLL}_q = a_C\,B^{C}_q$$

### 5.4 Tributos mensais sobre a receita

$$\text{PIS}_m = 0{,}65\%\cdot R_m \qquad \text{COFINS}_m = 3\%\cdot R_m \qquad \text{ISS}_m = \bar\iota\,R_m \qquad \text{ICMS}_m = \bar\kappa\,R_m$$

(alíquotas de PIS e COFINS cumulativos lidas de `lucro_presumido.pis_aliquota` e `cofins_aliquota`.)

### 5.5 Itens do regime

$$\text{Carga}^{\text{empresa}}_{\text{Presumido}} = \sum_q(\text{IRPJ}_q+\text{CSLL}_q) + \sum_m\big(\text{PIS}_m+\text{COFINS}_m+\text{ISS}_m+\text{ICMS}_m+\text{CPP}_m+\text{RAT}_m+\text{Terc}_m\big)$$

Fica **inelegível** se $R > 78\text{ mi}$ (`limite_opcao_receita_anual`).

### 5.6 Lucro distribuível isento (aproximado)

Usado só para avisar quando a distribuição planejada excede o que se comprovaria sem escrituração completa:

$$\text{LucroIsento}_{\text{Presumido}} = \Big[\textstyle\sum_q B^{I}_q - \text{IRPJ} - \text{CSLL} - \text{PIS} - \text{COFINS}\Big]^+$$

---

## 6. Lucro Real

Apuração **trimestral**. Parâmetros de `lucro_real`: $a_I = 15\%$, $a_{ad}=10\%$, $\ell=20.000$, $a_C=9\%$, PIS $\varphi = 1{,}65\%$, COFINS $\gamma = 7{,}6\%$ e limite de compensação de prejuízo $\lambda = 30\%$.

### 6.1 PIS e COFINS não cumulativos

Com $K_m$ = compras com direito a crédito + despesas com direito a crédito (`custos.compras_com_direito_credito_pis_cofins_mensal` + `custos.despesas_com_direito_credito_pis_cofins_mensal`):

$$\text{PIS}_m = \big[\varphi\,(R_m - K_m)\big]^+ \qquad \text{COFINS}_m = \big[\gamma\,(R_m - K_m)\big]^+$$

O motor não carrega saldo credor para o mês seguinte: crédito excedente é descartado e gera aviso. ISS e ICMS seguem as mesmas fórmulas do Presumido: $\text{ISS}_m=\bar\iota R_m$ e $\text{ICMS}_m=\bar\kappa R_m$.

### 6.2 Lucro antes do IR

$$\text{Folha}^{\text{custo}}_m = \text{Sal}_m + \text{Pro}_m + \text{FGTS}_m + \text{CPP}_m + \text{RAT}_m + \text{Terc}_m$$

$$\text{LAIR}_m = R_m - \text{PIS}_m - \text{COFINS}_m - \text{ISS}_m - \text{ICMS}_m - \text{Compras}_m - \text{Desp}_m - \text{Folha}^{\text{custo}}_m + \text{Aj}_m$$

onde $\text{Compras}_m$ = `custos.compras_insumos_mensal`, $\text{Desp}_m$ = `custos.outras_despesas_operacionais_mensal` e $\text{Aj}_m$ = `lucro_real.ajustes_adicoes_exclusoes_mensal`.

### 6.3 Compensação de prejuízo e imposto por trimestre

$\text{LAIR}_q = \sum_{m\in q}\text{LAIR}_m$. Com saldo de prejuízo fiscal $P$ (começa em `lucro_real.prejuizo_fiscal_acumulado`):

$$\text{Se } \text{LAIR}_q \le 0:\quad P \leftarrow P - \text{LAIR}_q,\quad B_q = 0$$

$$\text{Se } \text{LAIR}_q > 0:\quad \text{Comp}_q = \min\!\big(P,\;\lambda\,\text{LAIR}_q\big),\quad P \leftarrow P-\text{Comp}_q,\quad B_q = \text{LAIR}_q - \text{Comp}_q$$

$$\text{IRPJ}_q = a_I\,B_q + a_{ad}\,\big[B_q - \ell\,A_q\big]^+ \qquad \text{CSLL}_q = a_C\,B_q$$

O prejuízo do trimestre aumenta o saldo $P$ e é compensado nos trimestres seguintes (o saldo se propaga em ordem cronológica).

### 6.4 Itens do regime

$$\text{Carga}^{\text{empresa}}_{\text{Real}} = \sum_q(\text{IRPJ}_q+\text{CSLL}_q) + \sum_m\big(\text{PIS}_m+\text{COFINS}_m+\text{ISS}_m+\text{ICMS}_m+\text{CPP}_m+\text{RAT}_m+\text{Terc}_m\big)$$

Sempre elegível. Se `compras_insumos` e `outras_despesas` somarem zero, o motor avisa que o lucro está superestimado.

$$\text{LucroIsento}_{\text{Real}} = \Big[\textstyle\sum_q \text{LAIR}_q - \text{IRPJ} - \text{CSLL}\Big]^+$$

---

## 7. Retenção sobre lucros distribuídos

Lei 15.270/2025. Parâmetros de `dividendos`: ano de início $Y_0$ (`vigencia_ano`, 2026), limite mensal por beneficiário $T$ (`limite_mensal_por_beneficiario`, R\$ 50.000) e alíquota $r$ (`retencao_aliquota`, 10%).

Com $D_m$ = distribuição mensal por sócio e $I_m$ = parcela isenta por lucros apurados até 2025 (`isento_lucros_ate_2025_mensal_por_socio`):

$$S_m = [D_m - I_m]^+$$

$$\text{Ret} = \begin{cases}\displaystyle \sum_{m}\; n\cdot r\cdot S_m\cdot\mathbb{1}\,[S_m > T] & \text{ano} \ge Y_0 \\ 0 & \text{ano} < Y_0\end{cases}$$

Quando $S_m > T$, a retenção incide sobre **todo** $S_m$ (não só sobre o excedente de $T$).

**Aplicação por regime.** No Presumido e no Real a retenção entra na carga. No Simples ela só entra se `dividendos.simples_sujeito_retencao = true` (ponto controvertido; padrão: falso). Quando calculada mas não aplicada, o motor mostra o valor como aviso.

---

## 8. Carga total e ranking

$$\text{Carga}^{\text{empresa}} = \text{soma dos itens do regime}$$

$$\text{Carga}^{\text{total}} = \text{Carga}^{\text{empresa}} + \text{Ret}^{\text{aplicada}}$$

$$\%_{\text{total}} = \frac{\text{Carga}^{\text{total}}}{R} \qquad\qquad \%_{\text{empresa}} = \frac{\text{Carga}^{\text{empresa}}}{R}$$

O **ranking** ordena, do menor para o maior $\text{Carga}^{\text{total}}$, apenas os regimes elegíveis. A recomendação final é do contador; o motor só mede.

**Aviso de distribuição.** Se a distribuição anual $\sum_m n\,D_m$ exceder o lucro isento aproximado do regime (itens 5.6 e 6.4), o motor avisa que o excedente exige escrituração contábil completa.

---

## 9. Análise de sensibilidade

O motor recalcula tudo com a receita e o pró-labore multiplicados por fatores, mantendo as demais entradas. Receita (simulação **e** histórico) e pró-labore são escalados:

$$R_m \to f_R\,R_m \qquad H_j \to f_R\,H_j \qquad \text{Pro}_m \to f_P\,\text{Pro}_m$$

| Cenário | $f_R$ | $f_P$ |
|---|---|---|
| Base | 1,0 | 1,0 |
| Receita +10% | 1,1 | 1,0 |
| Receita −10% | 0,9 | 1,0 |
| Pró-labore +20% | 1,0 | 1,2 |
| Pró-labore −20% | 1,0 | 0,8 |

Em cada cenário reporta-se o $\text{Carga}^{\text{total}}$ de cada regime e o regime de menor carga.

---

## 10. Exemplo numérico conferível

Usa o arquivo `dados-empresa.exemplo.json` (empresa fictícia de software, 100% `III_ou_V_fator_r` / `servicos_gerais`, ISS 3%) com o `aliquotas.json` padrão. Receita anual $R = 555.000$. Folha: salários 12.000, pró-labore 8.000, RAT 1%, terceiros 5,8%, $F^{\text{hist}} = 251.520$.

**Simples, janeiro** ($R_1=42.000$; histórico de 40.000 em cada um dos 12 meses):

- $\text{RBT12}_1 = 12\times 40.000 = 480.000$
- $\text{Folha12}_1 = 251.520$, logo $\text{FatorR}_1 = 251.520/480.000 = 0{,}524 \ge 0{,}28 \Rightarrow$ Anexo III
- Faixa 3 do Anexo III: $a = 13{,}5\%$, $d = 17.640$
- $\alpha_1 = (480.000\times 0{,}135 - 17.640)/480.000 = 47.160/480.000 = 0{,}09825$
- $\text{DAS}_1 = 42.000 \times 0{,}09825 = \mathbf{4.126{,}50}$

**Presumido, 1º trimestre** ($R_q = 126.000$; presunção 32%; sem acréscimo, pois $C<L$):

- $B^I = B^C = 126.000\times 0{,}32 = 40.320$
- $\text{IRPJ} = 0{,}15\times 40.320 = \mathbf{6.048{,}00}$; adicional $= 0{,}10\times[40.320 - 20.000\times3]^+ = 0$
- $\text{CSLL} = 0{,}09\times 40.320 = \mathbf{3.628{,}80}$

**Real, janeiro** ($R_1=42.000$; $K_1 = 0 + 2.000$; despesas 6.000):

- $\text{PIS}_1 = 0{,}0165\times(42.000-2.000)=660$ e $\text{COFINS}_1 = 0{,}076\times 40.000 = 3.040$
- $\text{ISS}_1 = 0{,}03\times 42.000 = 1.260$
- $\text{FGTS}=960$, $\text{CPP}=0{,}20\times 20.000=4.000$, $\text{RAT}=120$, $\text{Terc}=696$, logo $\text{Folha}^{\text{custo}}_1 = 12.000+8.000+960+4.000+120+696 = 25.776$
- $\text{LAIR}_1 = 42.000-660-3.040-1.260-0-6.000-25.776 = \mathbf{5.264}$

**Totais do ano na carga da empresa** (arredondados): Simples R\$ 55.524,96 · Presumido R\$ 137.323,50 · Real R\$ 149.460,42. A retenção sobre lucros é zero no exemplo (distribuição de R\$ 4.000 por sócio/mês, abaixo do limite de R\$ 50.000).

---

## 11. O que o motor não modela

- Partilha de ICMS/ISS fora do DAS acima do sublimite do Simples.
- ICMS-ST, produtos monofásicos, exportação, incentivos fiscais, JCP, parcelamentos e retenções na fonte sobre serviços.
- Tributação do pró-labore (igual nos três regimes, portanto fora da comparação) e IRPFM (tributação mínima de altas rendas), que só gera aviso.
- Saldo credor de PIS/COFINS acumulado entre meses.
- CBS e IBS da reforma do consumo (em 2026 apenas aviso informativo; a partir de 2027 o motor avisa que os resultados podem estar defasados).
- Lucro Real com apuração anual por estimativa.

Cada limitação acima também aparece na aba **Resultado** da ferramenta, para o contador ver junto ao número.

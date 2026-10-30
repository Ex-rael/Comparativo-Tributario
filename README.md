# Comparativo Tributário

Ferramenta web para comparar a carga tributária de uma empresa entre **Simples Nacional**, **Lucro Presumido** e **Lucro Real**, a partir de dois arquivos JSON. Roda inteiramente no navegador, sem servidor e sem enviar dados para fora, e pode ser publicada no GitHub Pages.

> **Aviso.** Os valores padrão do `aliquotas.json` são um rascunho a ser validado pelo contador (`status_geral: rascunho_a_validar_pelo_contador`). O resultado é uma estimativa de apoio à decisão, não parecer contábil. As exclusões do motor estão listadas em [Limitações](#limitações).

## Princípio: a IA nunca faz conta

O trabalho é dividido em camadas, para que o cálculo seja sempre o mesmo para a mesma entrada:

| Camada | Quem executa | Risco principal |
|---|---|---|
| **Cálculo** (RBT12, Fator R, bases, IRPJ, CSLL, PIS, COFINS, CPP, retenção sobre lucros, sensibilidade) | JavaScript da página | Regra que o motor não modela |
| **Regras** (`aliquotas.json`) | IA consulta fonte oficial, contador valida | Valor desatualizado |
| **Dados deduzidos** (anexo, tipo de atividade, ISS, RAT, terceiros) | IA infere e registra origem e confiança em `meta`, contador revisa | Inferência errada com cara de certeza |
| **Dados do cliente** (receitas, folha, sócios, custos) | Vêm de documentos do cliente. A IA só organiza | Número digitado errado |

## Páginas

| Página | Para quê |
|---|---|
| **`index.html`** | Aba **Entradas** (cole ou carregue os dois JSON, com validação), **Resultado** (cartões por regime, comparativo item a item, memória de cálculo mês a mês, sensibilidade e avisos), **Fórmulas** (a memória de cálculo em LaTeX) e **Modelos** |
| **`prompts.html`** | Formulários que montam os dois prompts prontos para colar numa IA, com um clique em **Copiar prompt** |

### Aba Resultado
- Cartões com a carga total e o percentual da receita de cada regime, destacando o de menor carga entre os elegíveis.
- Tabela comparativa por tributo, memória de cálculo mensal e trimestral e análise de sensibilidade (receita ±10%, pró-labore ±20%).
- Botão **Aplicar CBS e IBS**: inclui a CBS e o IBS da reforma do consumo, com as alíquotas do `aliquotas.json` (ainda em definição). Desligado, o cálculo é o modo anterior, sem CBS e IBS.

### Aba Fórmulas e `calculos.md`
Toda a aritmética do motor está descrita em [`calculos.md`](calculos.md), em Markdown com LaTeX, para o contador validar sem abrir o código. O arquivo renderiza no GitHub e na aba **Fórmulas**. Inclui um exemplo numérico conferível à mão.

### Página de prompts
- **Prompt 1** (alíquotas e regras): use quando uma norma mudar e a cada virada de ano. Exige um assistente com acesso à web.
- **Prompt 2** (dados da empresa): uma **ficha estruturada** de totais e códigos, sem documentos, CNPJ, nomes ou CPFs. Campos em branco viram "não informado" e a IA devolve como pendência. CPF, CNPJ e e-mail digitados em texto livre são mascarados localmente.
- **Preencher com exemplo** carrega uma empresa fictícia para ver a ficha completa.
- Cada campo mostra uma estimativa de tokens, e o prompt pronto mostra o total.

## Como usar

1. **Alíquotas.** Abra `prompts.html`, aba 1, copie o prompt e cole numa IA com acesso à web. Salve o JSON devolvido como `aliquotas.json` (ou use o padrão do repositório). O contador valida os blocos marcados `a_confirmar`.
2. **Dados da empresa.** Na aba 2, preencha a ficha, copie o prompt e cole numa IA. A IA devolve o `dados-empresa.json`, uma lista de pendências e a tabela de campos deduzidos.
3. **Comparar.** No `index.html`, aba **Entradas**, cole os dois JSON. A validação aparece ao lado de cada um.
4. **Revisar.** Revise as pendências e os campos com confiança baixa. Só então leia a aba **Resultado**.

Para ver o fluxo sem dados reais, use **Carregar exemplo** na aba Entradas.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Motor de cálculo (`CTEngine`) e interface do comparativo |
| `prompts.html` | Formulários dos prompts |
| `calculos.md` | Memória de cálculo em LaTeX |
| `aliquotas.json` | Alíquotas, faixas, limites e vigências, cada bloco com `status` e `fontes` |
| `dados-empresa.template.json` | Modelo em branco dos dados da empresa |
| `dados-empresa.exemplo.json` | Empresa fictícia de software |
| `prompt-1-aliquotas.md`, `prompt-2-dados-empresa.md` | Texto dos prompts, lido pela página de prompts |

## Executar localmente

`index.html` funciona abrindo o arquivo direto. A aba **Fórmulas** e a página `prompts.html` leem outros arquivos com `fetch`, que o navegador bloqueia em `file://`. Para elas:

```bash
python3 -m http.server 8000
# abra http://localhost:8000/index.html
```

O motor também roda no Node: o script do `index.html` exporta `calcular`, `validar` e `sensibilidade` via `module.exports`.

## Publicar no GitHub Pages

Em **Settings → Pages**, escolha a branch `main` e a raiz do repositório. Não há etapa de build. As bibliotecas (KaTeX e marked) vêm do cdnjs.

## Privacidade

- O cálculo acontece no navegador. Nada é enviado a servidor.
- Os prompts são copiados para a área de transferência: o que vai para a IA é o texto que você colar.
- A ficha pede só totais e códigos. Evite documentos inteiros, CNPJ, nomes, CPFs e e-mail.

## Limitações

Fora do escopo do motor: partilha de ICMS e ISS acima do sublimite do Simples, ICMS-ST, produtos monofásicos, exportação, incentivos fiscais, JCP, parcelamentos, retenções na fonte sobre serviços, IRPFM, saldo credor de PIS e COFINS entre meses, compensação de CBS e IBS com os tributos atuais e cronograma de transição do IBS. A lista completa está na seção final do [`calculos.md`](calculos.md) e na aba Resultado.

## Licença

[MIT](LICENSE).

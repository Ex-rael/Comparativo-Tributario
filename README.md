# Comparativo Tributário

Ferramenta web para comparar a carga tributária de uma empresa entre **Simples Nacional**, **Lucro Presumido** e **Lucro Real**, a partir de dois arquivos JSON. Roda inteiramente no navegador, sem servidor e sem enviar dados para fora, e pode ser publicada no GitHub Pages.

> **Aviso.** Os valores padrão do `aliquotas.json` são um rascunho a ser validado pelo contador (`status_geral: rascunho_a_validar_pelo_contador`). O resultado é uma estimativa de apoio à decisão, não parecer contábil. As exclusões do motor estão listadas em [Limitações](#limitações).

## Princípio: a IA nunca faz conta

O trabalho é dividido em camadas, para que o cálculo seja sempre o mesmo para a mesma entrada:

| Camada | Quem executa | Risco principal |
|---|---|---|
| **Cálculo** (RBT12, Fator R, bases, IRPJ, CSLL, PIS, COFINS, CPP, retenção sobre lucros, sensibilidade) | JavaScript da página | Regra que o motor não modela |
| **Regras** (`aliquotas.json`) | IA consulta fonte oficial (prompt 1), contador valida na aba **Alíquotas** | Valor desatualizado |
| **Classificação** (CNAE, anexo, tipo de presunção, ISS, RAT, terceiros) | Contador escolhe na ficha. CNAE e município conferidos na API do IBGE | Enquadramento escolhido errado |
| **Dados do cliente** (receitas, folha, sócios, custos) | Totais digitados na ficha. O `ficha.js` gera o JSON, sem IA | Número digitado errado |

O `dados-empresa.json` sai da ficha por código determinístico: a mesma ficha gera sempre o mesmo JSON. A IA fica opcional, para pesquisar alíquotas e como alternativa à ficha.

## Páginas

| Página | Para quê |
|---|---|
| **`index.html`** | Aba **Entradas** (cole ou carregue os dois JSON, com validação), **Alíquotas** (tabela editável do `aliquotas.json`), **Resultado** (cartões por regime, comparativo item a item, memória de cálculo, sensibilidade e avisos), **Fórmulas** (a memória de cálculo em LaTeX) e **Modelos** |
| **`prompts.html`** (Ficha e prompts) | A **ficha do cliente**, que gera o `dados-empresa.json` sem IA, e os dois prompts prontos para colar numa IA |

### Aba Alíquotas
- Mostra o `aliquotas.json` carregado em tabelas por bloco: Simples (com as 6 faixas de cada anexo), Presumido (com a tabela de presunção), Real, encargos de folha, lucros distribuídos e reforma do consumo.
- Percentuais aparecem em %, valores em R$. Cada bloco traz o status, a base legal, a nota e as fontes.
- **Edite direto na célula.** O JSON e o resultado se atualizam na hora, sem enviar formulário. Células alteradas ficam destacadas e a lista "Alterações desta sessão" mostra cada valor antigo e novo.
- **Copiar JSON alterado** leva o arquivo completo para a área de transferência. **Desfazer alterações** volta ao JSON carregado.

### Aba Resultado
- Cartões com a carga total e o percentual da receita de cada regime, destacando o de menor carga entre os elegíveis.
- Tabela comparativa por tributo, memória de cálculo mensal e trimestral e análise de sensibilidade (receita ±10%, pró-labore ±20%).
- Botão **Aplicar CBS e IBS**: inclui a CBS e o IBS da reforma do consumo, com as alíquotas do `aliquotas.json` (ainda em definição). Desligado, o cálculo é o modo anterior, sem CBS e IBS.

### Aba Fórmulas e `calculos.md`
Toda a aritmética do motor está descrita em [`calculos.md`](calculos.md), em Markdown com LaTeX, para o contador validar sem abrir o código. O arquivo renderiza no GitHub e na aba **Fórmulas**. Inclui um exemplo numérico conferível à mão.

### Ficha e prompts
- **Ficha do cliente** (aba 2): totais e códigos, sem documentos, CNPJ, nomes ou CPFs. O `dados-empresa.json` aparece à direita, gerado na hora pelo `ficha.js`, com a lista de **Pendências** e a validação do motor.
- **CNAE e município** são conferidos na tabela `cnae.json` e na API pública do IBGE, direto do navegador.
- **Enquadramento:** o anexo do Simples só é sugerido quando há regra objetiva (comércio: Anexo I; indústria: Anexo II). CNAE ambíguo, impeditivo ou de serviço mostra a mensagem de que não pode ser inferido automaticamente, e o operador escolhe no select. O tipo de presunção é sempre escolha do operador.
- **RAT e FAP** são informados separados. O JSON recebe RAT × FAP.
- **Premissas fixas**, sempre registradas em `meta`: ISS em branco vira 0 em comércio, ICMS em branco vira 0 em serviço, e sem receita simulada repete-se o histórico (com o crescimento informado, se houver).
- **Usar no Comparativo** abre o `index.html` já com os dados. **Copiar JSON** é a alternativa.
- **Preencher com exemplo** carrega uma empresa fictícia. CPF, CNPJ e e-mail digitados em texto livre são mascarados localmente.
- **Prompt 1** (alíquotas e regras): use quando uma norma mudar e a cada virada de ano. Exige um assistente com acesso à web.
- **Prompt 2** (dados da empresa): alternativa à ficha, em que a IA monta o JSON. Mostra uma estimativa de tokens por campo e no total.

## Como usar

1. **Alíquotas.** Use o `aliquotas.json` do repositório, ou atualize-o com o prompt 1 numa IA com acesso à web. O contador confere e ajusta os valores na aba **Alíquotas** e copia o JSON final.
2. **Dados da empresa.** Em `prompts.html`, aba 2, preencha a ficha e resolva as pendências.
3. **Comparar.** Clique em **Usar no Comparativo**, ou cole o JSON no campo 2 da aba **Entradas** do `index.html`.
4. **Revisar.** Revise as premissas em `meta` e os avisos. Só então leia a aba **Resultado**.

Para ver o fluxo sem dados reais, use **Carregar exemplo** na aba Entradas.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Interface do comparativo |
| `motor.js` | Motor de cálculo (`CTEngine`), usado pelas duas páginas |
| `ficha.js` | Compilador determinístico da ficha para o `dados-empresa.json` (`CTFicha`) |
| `prompts.html` | Ficha do cliente e prompts |
| `cnae.json` | Tabela CNAE 2.3 (IBGE) com anexo sugerido, vedação ao Simples e RAT, gerada por `scripts/gerar-cnae.mjs` |
| `fontes/*.csv` | Tabelas oficiais que alimentam o `cnae.json`: Anexo VI da Resolução CGSN 140/2018 e Anexo V do Decreto 3.048/1999 |
| `docs/avaliacao-apis.md` | Testes de viabilidade das APIs do IBGE (CNAE) e da NFS-e (ISS) |
| `avaliacao/` | Bases rotuladas para avaliar o modelo de decisão, com a origem de cada rótulo |
| `spike/laya-carga.html` | Teste descartável do tempo de carga do LAYA no navegador |
| `scripts/bge-m3-podar.py`, `scripts/bge-m3-avaliar.py` | Poda do vocabulário e int8 do BGE-M3 (389 MB); acerto da busca semântica em `avaliacao/` |
| `treino/laya-colab.ipynb` | Ajuste fino do LAYA no Google Colab (GPU), com validação cruzada e export ONNX int8. Gerado por `scripts/gerar-notebook-colab.py` |
| `CHANGELOG.md` | Histórico de versões |
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

O motor e o compilador também rodam no Node: `require('./motor.js')` exporta `calcular`, `validar` e `sensibilidade`, e `require('./ficha.js')` exporta `compilarFicha`.

## Publicar no GitHub Pages

Em **Settings → Pages**, escolha a branch `main` e a raiz do repositório. Não há etapa de build. As bibliotecas (KaTeX e marked) vêm do cdnjs.

## Privacidade

- O cálculo acontece no navegador. Nada é enviado a servidor.
- Os prompts são copiados para a área de transferência: o que vai para a IA é o texto que você colar.
- A ficha pede só totais e códigos. Evite documentos inteiros, CNPJ, nomes, CPFs e e-mail.

## Limitações

Fora do escopo do motor: partilha de ICMS e ISS acima do sublimite do Simples, ICMS-ST, produtos monofásicos, exportação, incentivos fiscais, JCP, parcelamentos, retenções na fonte sobre serviços, IRPFM, saldo credor de PIS e COFINS entre meses, compensação de CBS e IBS com os tributos atuais e cronograma de transição do IBS. A lista completa está na seção final do [`calculos.md`](calculos.md) e na aba Resultado.

## APIs externas

Só a API pública do IBGE, chamada direto do navegador (CORS liberado, sem autenticação): classificação CNAE e lista de municípios. Sem internet, a ficha funciona normalmente e só deixa de conferir esses dois campos.

As APIs do Sistema Nacional NFS-e (parâmetros municipais de ISS) exigem certificado digital ICP-Brasil e não servem a um site estático. Detalhes em [`docs/avaliacao-apis.md`](docs/avaliacao-apis.md).

## Tabela CNAE

O `cnae.json` é gerado por `node scripts/gerar-cnae.mjs` (Node 18+, sem dependências), que:
1. baixa as 1.332 subclasses da API do IBGE;
2. lê `fontes/cgsn140-anexo-vi.csv` (`cnae;situacao`, com `impeditivo` ou `ambiguo`) e `fontes/decreto3048-anexo-v.csv` (`cnae;rat`);
3. aplica as regras objetivas de anexo sugerido e grava o `cnae.json`.

As duas tabelas oficiais ainda estão **sem dados**: as fontes (portal de normas da Receita e Planalto) não puderam ser baixadas automaticamente, e o gerador nunca preenche valor de memória. Enquanto estiverem vazias, a ficha avisa que a vedação ao Simples não foi verificada. O script foi feito para rodar numa rotina periódica que atualize o `cnae.json` no repositório.

## Versionamento

SemVer, com a versão em `motor.js` e no topo das páginas. Sobe a cada commit: **MAJOR** quando o resultado muda para a mesma entrada ou um JSON antigo deixa de valer; **MINOR** para função nova compatível; **PATCH** para correção, texto, layout ou documentação. Histórico em [`CHANGELOG.md`](CHANGELOG.md).

## Próximos passos

- **Modelo de decisão no navegador** (LAYA) para os enquadramentos ambíguos: plano em [`docs/plano-modelo-decisao.md`](docs/plano-modelo-decisao.md).
- **Preenchimento da ficha auxiliado por IA:** a IA leria os documentos do cliente e proporia os valores da ficha, para o contador revisar antes de gerar o JSON. O JSON continuaria saindo do `ficha.js`, sem IA.
- **Rotina de atualização do `cnae.json`:** rodar `scripts/gerar-cnae.mjs` periodicamente e publicar no repositório.
- **Carregar as tabelas oficiais** de vedação (Anexo VI da Resolução CGSN 140/2018) e RAT (Anexo V do Decreto 3.048/1999) em `fontes/`.
- **Tabela de ISS do escritório:** município (código IBGE) × item da LC 116 → alíquota.

## Licença

[MIT](LICENSE).

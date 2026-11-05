# Comparativo Tributário

Ferramenta web para comparar a carga tributária de uma empresa entre **Simples Nacional**, **Lucro Presumido** e **Lucro Real**, a partir de dois arquivos JSON. O cálculo roda inteiramente no navegador, sem servidor, e a página é publicada no GitHub Pages. Dados só saem da página quando o operador envia um prompt a uma IA (veja [Privacidade](#privacidade)).

**Para usar:** comece pelo [guia do fluxo completo](guia.html) (`guia.html`).

> **Aviso.** Os valores padrão do `aliquotas.json` são um rascunho a ser validado pelo contador (`status_geral: rascunho_a_validar_pelo_contador`). O resultado é uma estimativa de apoio à decisão, não parecer contábil. As exclusões do motor estão listadas em [Limitações](#limitações).

## Princípio: a IA nunca faz conta

O trabalho é dividido em camadas, para que o cálculo seja sempre o mesmo para a mesma entrada:

| Camada | Quem executa | Risco principal |
|---|---|---|
| **Cálculo** (RBT12, Fator R, bases, IRPJ, CSLL, PIS, COFINS, CPP, retenção sobre lucros, sensibilidade) | JavaScript da página | Regra que o motor não modela |
| **Regras** (`aliquotas.json`) | IA consulta fonte oficial (prompt 1), contador valida na aba **Alíquotas** e publica o arquivo | Valor desatualizado |
| **Classificação** (CNAE, anexo, tipo de presunção, ISS, RAT, terceiros) | Contador escolhe na ficha. CNAE e município conferidos na API do IBGE | Enquadramento escolhido errado |
| **Dados do cliente** (receitas, folha, sócios, custos) | Totais digitados na ficha. O `ficha.js` gera o JSON, sem IA | Número digitado errado |

O `dados-empresa.json` sai da ficha por código determinístico: a mesma ficha gera sempre o mesmo JSON. A IA fica opcional, para pesquisar alíquotas e como alternativa à ficha.

### Onde a IA é usada

Nas páginas, todo ponto com IA leva o selo **✦ IA externa** ou **✦ IA interna**. Sem selo, é código determinístico. No código, cada selo é um `<span class="ia" data-ia="...">` (o botão **Enviar para IA** tem a classe `ia-btn`), e `grep -n 'data-ia=\|ia-btn' *.html spike/*.html` lista todos.

| Selo | `data-ia` | Onde | O que a IA faz | Quem confere |
|---|---|---|---|---|
| **IA externa** | `externa` | `prompts.html`: aba 1 (prompt de alíquotas) e "Prompt para IA (opcional)" da aba 2, com os botões **Enviar para IA** | Você envia o prompt a um assistente de IA, fora da página (o Claude, pelo botão, ou outro, copiando). Ele pesquisa alíquotas (prompt 1) ou monta o JSON a partir da ficha (prompt 2) | Contador |
| **IA externa** | `externa` | `index.html`: legendas dos JSON 1 e 2, aba "Modelos" e campos com origem "Inferido por IA" na lista de revisão; `inicio.html`: opção "Atualizar as alíquotas" | Marca os valores que vieram de um prompt | Contador |
| **IA interna** | `interna` | `spike/bge-busca.html` (teste) | O BGE-M3 roda na própria página, sem serviço externo, e sugere o item da lei (e o anexo) a partir da descrição da atividade. O texto não sai do navegador | Contador, no select, quando a folga é pequena |

## Páginas

| Página | Para quê |
|---|---|
| **`inicio.html`** | Página de decisão do primeiro acesso: **Comparar regimes de um cliente** ou **Atualizar as alíquotas** |
| **`index.html`** | Aba **Entradas** (cole ou carregue os dois JSON, com validação), **Alíquotas** (tabela editável do `aliquotas.json`), **Resultado** (cartões por regime, comparativo item a item, memória de cálculo, sensibilidade e avisos), **Fórmulas** (a memória de cálculo em LaTeX) e **Modelos** |
| **`prompts.html`** (Ficha e prompts) | A **ficha do cliente**, que gera o `dados-empresa.json` sem IA, e os dois prompts, com **Enviar para IA** e **Copiar prompt** |
| **`guia.html`** | Guia do fluxo completo para o operador e o contador |

### Modos de uso
Atualizar alíquotas é raro (virada do ano, mudança de norma); comparar clientes é o dia a dia. Para não misturar as duas operações, o primeiro acesso a `index.html` ou `prompts.html` leva a `inicio.html`, e a escolha fica guardada no navegador (`localStorage`, chave `ct:modo`). O link **Trocar**, no topo, volta à escolha.

| Modo | `prompts.html` | `index.html` |
|---|---|---|
| **Comparar regimes** (`comparativo`) | Só a ficha (aba 2) | Entradas (alíquotas recolhidas, sem o texto do JSON), Resultado, Fórmulas, Modelos |
| **Atualizar alíquotas** (`aliquotas`) | Só o prompt 1 | Entradas (só o JSON 1), Alíquotas, Fórmulas, Modelos |

O controle está em `modo.js`: cada elemento de um modo só leva `data-modo-so="comparativo|aliquotas"`. `?modo=comparativo` ou `?modo=aliquotas` na URL também escolhe. Sem `localStorage`, as páginas mostram tudo.

### Aba Alíquotas
- Mostra o `aliquotas.json` carregado em tabelas por bloco: Simples (com as 6 faixas de cada anexo), Presumido (com a tabela de presunção), Real, encargos de folha, lucros distribuídos e reforma do consumo.
- Percentuais aparecem em %, valores em R$, com a unidade no rótulo. Todo campo fica alinhado à esquerda, na mesma coluna. Cada bloco traz o status, a base legal, a nota e as fontes.
- **Edite direto no campo.** Campos alterados ficam destacados e a lista "Alterações ainda não aplicadas" mostra cada item, com o valor antigo e o novo, em português.
- **Aplicar alterações** grava cada mudança em `metadata.alteracoes` (`caminho: antes -> depois (revisão do contador em AAAA-MM-DD)`) e baixa o arquivo `aliquotas-revisado-AAAA-MM-DD-HHMM.json`. A revisão é feita com o técnico, que substitui o `aliquotas.json` do repositório por esse arquivo e publica.
- **Baixar sem alterar** baixa o arquivo como está, para aprovar a resposta da IA sem mudanças. **Desfazer alterações** volta ao último arquivo aplicado ou carregado.

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
- **Enviar para IA**, um botão em cada prompt: copia o prompt e abre `https://claude.ai/new?q=<prompt>` numa nova aba, com o prompt preenchido. Fica desativado enquanto houver campo vazio.
  - Acima de 14.000 caracteres de URL, o Claude abre vazio e o operador cola com Ctrl+V. O limite é testável com `prompts.html?limite_url=N`.
  - Com os arquivos padrão e a página em `https`, o prompt manda a IA abrir os arquivos publicados (`aliquotas.json` e, no prompt 2, `dados-empresa.template.json`) em vez de colá-los inteiros. A URL cai de 26.500 para cerca de 6.400 caracteres no prompt 1, e de 33.000 para cerca de 10.000 no prompt 2 (com a ficha de exemplo). A IA precisa de acesso à web para abrir os links. Para testar localmente: `prompts.html?link_aliquotas=1`.
  - Com um arquivo carregado pelo operador, ele vai inteiro no prompt e, se passar do limite, pela área de transferência.

## Como usar

O passo a passo para o operador está em [`guia.html`](guia.html). Em resumo:

1. **Alíquotas** (modo Atualizar alíquotas, raro). Envie o prompt 1 a uma IA com acesso à web. O contador confere e ajusta os valores na aba **Alíquotas**, aprova e copia o JSON final, que substitui o `aliquotas.json` do repositório. O `index.html` lê esse arquivo; a cópia embutida no código só vale quando a página é aberta direto do arquivo (`file://`).
2. **Dados da empresa** (modo Comparar regimes). Em `prompts.html`, aba 2, preencha a ficha e resolva as pendências.
3. **Comparar.** Clique em **Usar no Comparativo**, ou cole o JSON no campo 2 da aba **Entradas** do `index.html`.
4. **Revisar.** Revise as premissas em `meta` e os avisos. Só então leia a aba **Resultado**.

Para ver o fluxo sem dados reais, use **Preencher com exemplo** na ficha ou **Carregar exemplo** na aba Entradas.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Interface do comparativo |
| `motor.js` | Motor de cálculo (`CTEngine`), usado pelas duas páginas |
| `ficha.js` | Compilador determinístico da ficha para o `dados-empresa.json` (`CTFicha`) |
| `prompts.html` | Ficha do cliente e prompts |
| `inicio.html`, `guia.html` | Página de decisão do primeiro acesso e guia do fluxo completo |
| `modo.js` | Modo de uso (comparar regimes ou atualizar alíquotas), compartilhado pelas páginas |
| `cnae.json` | Tabela CNAE 2.3 (IBGE) com anexo sugerido, vedação ao Simples e RAT, gerada por `scripts/gerar-cnae.mjs` |
| `fontes/*.csv` | Tabelas oficiais que alimentam o `cnae.json`: Anexo VI da Resolução CGSN 140/2018 e Anexo V do Decreto 3.048/1999 |
| `docs/avaliacao-apis.md` | Testes de viabilidade das APIs do IBGE (CNAE) e da NFS-e (ISS) |
| `avaliacao/` | Bases rotuladas para avaliar o modelo de decisão, com a origem de cada rótulo |
| `spike/bge-busca.html` | Teste do BGE-M3 no navegador: sugere o item da LC 123 e o anexo pela descrição e avalia as bases. Modelo em [huggingface.co/isreal01/bge-m3-pt-int8-onnx](https://huggingface.co/isreal01/bge-m3-pt-int8-onnx) |
| `modelo/lei-vetores.json` | Vetores BGE-M3 dos 50 itens da LC 123, gerados por `scripts/bge-m3-vetores-lei.py` |
| `scripts/bge-m3-podar.py`, `scripts/bge-m3-avaliar.py` | Poda do vocabulário e int8 do BGE-M3 (389 MB); acerto da busca semântica em `avaliacao/` |
| `treino/laya-colab.ipynb` | Ajuste fino do LAYA no Google Colab (GPU), com validação cruzada e export ONNX int8. Gerado por `scripts/gerar-notebook-colab.py` |
| `CHANGELOG.md` | Histórico de versões |
| `calculos.md` | Memória de cálculo em LaTeX |
| `aliquotas.json` | Alíquotas, faixas, limites e vigências, cada bloco com `status` e `fontes` |
| `dados-empresa.template.json` | Modelo em branco dos dados da empresa |
| `dados-empresa.exemplo.json` | Empresa fictícia de software |
| `prompt-1-aliquotas.md`, `prompt-2-dados-empresa.md` | Texto dos prompts, lido pela página de prompts |

## Executar localmente

`index.html` funciona abrindo o arquivo direto, com a cópia embutida do `aliquotas.json`. A aba **Fórmulas** e a página `prompts.html` leem outros arquivos com `fetch`, que o navegador bloqueia em `file://`. Para elas:

```bash
python3 -m http.server 8000
# abra http://localhost:8000/ (o primeiro acesso leva a inicio.html)
```

O motor e o compilador também rodam no Node: `require('./motor.js')` exporta `calcular`, `validar` e `sensibilidade`, e `require('./ficha.js')` exporta `compilarFicha`.

## Publicar no GitHub Pages

Em **Settings → Pages**, escolha a branch `main` e a raiz do repositório. Não há etapa de build. As bibliotecas (KaTeX e marked) vêm do cdnjs.

## Privacidade

- O cálculo e a ficha acontecem no navegador. Nada é enviado a servidor do projeto.
- **Copiar prompt** leva o texto para a área de transferência: o que vai para a IA é o que você colar.
- **Enviar para IA** abre o Claude com o prompt no endereço (`claude.ai/new?q=`), ou vazio com o prompt copiado. O texto vai para a conta do operador no Claude: use só se o escritório aprovou o serviço. O prompt 2 leva só os totais e códigos da ficha.
- A ficha pede só totais e códigos e mascara CPF, CNPJ e e-mail digitados em texto livre. Evite documentos inteiros, nomes e endereço.
- A escolha de modo e a passagem da ficha para o comparativo usam o `localStorage` do navegador.

## Limitações

Fora do escopo do motor: partilha de ICMS e ISS acima do sublimite do Simples, ICMS-ST, produtos monofásicos, exportação, incentivos fiscais, JCP, parcelamentos, retenções na fonte sobre serviços, IRPFM, saldo credor de PIS e COFINS entre meses, compensação de CBS e IBS com os tributos atuais e cronograma de transição do IBS. A lista completa está na seção final do [`calculos.md`](calculos.md) e na aba Resultado.

## APIs externas

- **IBGE** (API pública, CORS liberado, sem autenticação), chamada direto do navegador: classificação CNAE e lista de municípios. Sem internet, a ficha funciona normalmente e só deixa de conferir esses dois campos.
- **Claude** (`claude.ai/new`): só aberto numa nova aba quando o operador clica em **Enviar para IA**. A página não recebe nada de volta.
- **Hugging Face**, só no teste `spike/bge-busca.html`: download do modelo BGE-M3 (cerca de 390 MB), uma vez, para o cache do navegador.

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

- **Sugestão de anexo por IA interna** (BGE-M3, em teste em `spike/bge-busca.html`) no campo de anexo da ficha: plano em [`docs/plano-modelo-decisao.md`](docs/plano-modelo-decisao.md).
- **Confirmar o limite de URL do Claude** (`?q=`) num navegador logado e ajustar `LIMITE_URL` em `prompts.html`.
- **Preenchimento da ficha auxiliado por IA:** a IA leria os documentos do cliente e proporia os valores da ficha, para o contador revisar antes de gerar o JSON. O JSON continuaria saindo do `ficha.js`, sem IA.
- **Rotina de atualização do `cnae.json`:** rodar `scripts/gerar-cnae.mjs` periodicamente e publicar no repositório.
- **Carregar as tabelas oficiais** de vedação (Anexo VI da Resolução CGSN 140/2018) e RAT (Anexo V do Decreto 3.048/1999) em `fontes/`.
- **Tabela de ISS do escritório:** município (código IBGE) × item da LC 116 → alíquota.

## Licença

[MIT](LICENSE).

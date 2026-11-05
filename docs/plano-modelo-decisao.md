# Plano: modelo de decisão no navegador para os enquadramentos ambíguos

Status: **fase 0 em andamento**, atualizado em 2026-11-04. Decisões tomadas: download opcional de cerca de 400 MB aceito, com medição do tempo de carga; acerto mínimo de **80%**; ordem da fase 3 confirmada. Resultados na seção 9.

**Estratégia adotada:** dividir o trabalho. O modelo entra onde o texto é livre ("a empresa faz X", objeto social, descrição vaga) e sugere o anexo ou o CNAE provável, com uma probabilidade. Código comum consulta as tabelas (`cnae.json`) e calcula o Fator R. Os casos incertos, quando o modelo não tem confiança ou diverge da tabela, vão para revisão humana. As seções 3 a 5 detalham como, com quatro ajustes.

## 1. Objetivo

Ajudar o operador nas escolhas que a ficha hoje não consegue inferir (anexo do Simples em serviços e CNAEs ambíguos, tipo de presunção), com um **modelo de decisão** rodando no próprio navegador, sem servidor e sem prompt para LLM. O modelo **sugere com probabilidade**. Quem decide continua sendo o operador.

## 2. O que são LAYA e JEV

- **LAYA** ([ConvAI Innovations](https://www.llmreference.com/model-family/laya)): modelo de decisão "System 1", não autorregressivo. Recebe um *estado* e perguntas tipadas e devolve probabilidades calibradas para cada opção numa só passada. Segundo as fontes, tem cerca de 421M de parâmetros (encoder ModernBERT-large com cabeça de decisão), licença Apache 2.0 e foi treinado com RLCD (aprendizado por reforço com regras de pontuação próprias). Já existe conversão para o navegador: [onnx-community/laya-ONNX](https://huggingface.co/onnx-community/laya-ONNX) e [archevel/laya-web](https://huggingface.co/archevel/laya-web) (int8, WebGPU).
- **JEV** ([MindStudio](https://www.mindstudio.ai/blog/jev-judgment-model-browser-agents/)): modelo de julgamento da mesma família de ideias, voltado a agentes de navegação. Não encontrei pesos prontos para o navegador. Fica como alternativa a avaliar, não como base.

> Os números acima vêm de páginas públicas. A seção 9 traz o que foi conferido e medido, e **corrige três pontos**: o tamanho, o idioma e o acerto sem ajuste fino.

## 3. Divisão do trabalho: o que o modelo pode e não pode decidir

O anexo do Simples **não é "o que melhor se adequa"** no sentido de vantagem: é determinado pela atividade, conforme a LC 123/2006. O modelo serve para **ler a descrição da atividade e apontar qual enquadramento legal ela descreve**, não para escolher o anexo mais barato.

| Decisão | Quem decide | Papel do modelo |
|---|---|---|
| CNAE impeditivo (Anexo VI, Tabela A) | Regra (`cnae.json`) | **Nenhum.** A regra sempre prevalece |
| CNAE ambíguo (Anexo VI, Tabela B): a parte vedada se aplica? | Operador | Sugerir, a partir da descrição da atividade |
| Anexo de serviços (III, IV, V) e sujeição ao Fator R | Operador | Sugerir, com as definições da lei como opções |
| III ou V pelo Fator R | **Motor** (folha ÷ receita) | **Nenhum.** É conta, não julgamento |
| Tipo de presunção (natureza da receita) | Operador | Sugerir |
| Comércio (I) e indústria (II) | Regra por divisão CNAE | Conferir a descrição: se ela divergir da regra, o caso vai para revisão |
| CNAE registrado × atividade real | Operador | Apontar divergência entre o CNAE informado e a descrição da atividade |
| CNAE a partir de texto livre | Operador | Sugerir candidatos (seção 4.2) |

### 3.1 Ajustes à estratégia

1. **Não existe tabela oficial CNAE → anexo.** A LC 123/2006 descreve atividades, não códigos. A única tabela oficial por CNAE é o Anexo VI da Resolução CGSN 140/2018 (impeditivo ou ambíguo). O anexo do `cnae.json` é regra do projeto e só cobre comércio e indústria. Por isso, a comparação "modelo × tabela" só existe onde a tabela tem resposta. **Em serviços, o único gatilho de revisão é a confiança do modelo.**
2. **CNAE em duas etapas.** O modelo pontua opções escritas na própria entrada, e as 1.332 subclasses não cabem numa pergunta. Primeiro uma busca no `cnae.json` (palavras ou embeddings) reduz a cerca de 10 candidatos. Depois o modelo escolhe entre eles. O ganho principal é **apontar divergência entre o CNAE registrado e a atividade real**, porque o imposto segue a atividade, e o operador já tem o CNAE no cartão CNPJ.
3. **Do contrato social, só a cláusula do objeto social.** O contrato inteiro tem nomes, CPFs e endereços. A ficha recebe apenas o objeto social, com o mascaramento de CPF, CNPJ e e-mail que já existe.
4. **Revisão humana em três níveis.** O operador confirma sempre. O que muda é quanto a ficha ajuda:

| Nível | Quando | O que a ficha faz |
|---|---|---|
| **Regra** | Impeditivo, comércio, indústria, Fator R | Preenche e cita a regra |
| **Sugestão** | Confiança acima do limiar e, onde houver tabela, de acordo com ela | Pré-seleciona com o percentual. Confirma com um clique |
| **Revisão** | Confiança baixa, divergência com a tabela ou CNAE registrado diferente da descrição | Não pré-seleciona. Mostra o motivo e as duas opções mais prováveis |

### 3.2 O que já existe
- Fator R calculado pelo motor, mês a mês.
- `cnae.json` com validação pelo IBGE, anexo sugerido por regra para comércio e indústria e regra de impeditivo prevalecendo (assim que a tabela do Anexo VI for carregada).
- Select vazio com a mensagem "não pode ser inferido automaticamente" nos casos sem regra: é o nível **Revisão** sem modelo.
- Mascaramento local de CPF, CNPJ e e-mail nos campos de texto livre.

## 4. Como funcionaria

### 4.1 Anexo e presunção a partir da descrição

1. O operador descreve a atividade em uma ou duas frases, ou cola a cláusula do objeto social, sem dados pessoais (por exemplo, "instalamos e fazemos manutenção de ar-condicionado em empresas").
2. A ficha monta o **estado**: CNAE, descrição oficial do IBGE, descrição do operador e % da receita.
3. A ficha monta as **perguntas tipadas**, com opções escritas a partir do texto da lei. Exemplo: "Anexo do Simples para esta atividade", com as opções III (LC 123, art. 18, § 5º-B), IV (§ 5º-C), V ou Fator R (§ 5º-I) e Vedado.
4. O modelo devolve as probabilidades. A ficha mostra as duas opções mais prováveis com o percentual.
5. A ficha classifica o caso num dos três níveis da seção 3.1. Abaixo do limiar (por exemplo, 85%) ou em divergência com a tabela, não pré-seleciona nada e mostra o motivo.
6. O que o operador aceitar entra em `meta` com `origem: "inferido_modelo"`, a probabilidade, o nível, o modelo e a revisão usados. O motor lista esses campos para revisão.

### 4.2 CNAE a partir de texto livre

1. Busca no `cnae.json` pela descrição do operador: palavras-chave na fase 0 e embeddings se necessário. Saem cerca de 10 candidatos.
2. O modelo escolhe entre os candidatos, com probabilidade.
3. Se o CNAE informado não estiver entre os mais prováveis, a ficha mostra o aviso "a descrição parece corresponder a outro CNAE", com as alternativas. O caso vai para o nível **Revisão**.

### 4.3 Técnica

- **Carga:** Transformers.js (ONNX Runtime Web), em um **Web Worker** para não travar a página. Usa WebGPU quando há, e WebAssembly como alternativa.
- **Hospedagem:** os pesos ficam no Hugging Face. O GitHub Pages não aceita arquivos acima de 100 MB, e o Hugging Face libera CORS e tem CDN.
- **Ativação opcional:** um botão "Ativar assistente de decisão (≈ 400 MB, baixado uma vez)". Depois do primeiro download, o navegador guarda o modelo em cache.
- **Reprodutibilidade:** a revisão do modelo fica fixa (hash do Hugging Face). Mesma entrada e mesma revisão dão a mesma sugestão, com variações mínimas de ponto flutuante entre WebGPU e WASM.

## 5. Fases

### Fase 0: spike de viabilidade (descartável, numa branch)
Página de teste isolada que carrega o `laya-ONNX` e mede:
- tamanho real do download e tempo de carga;
- latência por decisão em WebGPU e em WASM;
- memória, num notebook comum e num celular;
- qualidade em português, com cerca de 30 casos montados à mão.

**Saída:** seguir ou não seguir. Se o LAYA for pesado demais, comparar com uma linha de base leve: um modelo de embeddings pequeno e multilíngue (cerca de 100 MB) com vizinho mais próximo sobre exemplos rotulados.

### Fase 1: base de avaliação
De 200 a 300 casos rotulados pelo contador: CNAE, descrição da atividade (ou objeto social), anexo correto e tipo de presunção correto, incluindo os ambíguos e casos em que o CNAE registrado não corresponde à atividade real. Sem dado de cliente. Fica em `avaliacao/casos.jsonl`, versionada.

### Fase 2: perguntas e opções
Escrever o estado e as opções a partir do texto legal e medir na base da fase 1:
- acurácia;
- calibração (Brier e ECE);
- cobertura no limiar: quantos casos o modelo responde e com que acerto.

Ajustar os textos das opções, não a lei.

### Fase 3: integração na ficha, na ordem do maior ganho
`assistente.js` com Worker, barra de progresso do download, os três níveis de revisão e registro em `meta`. Sobe como MINOR, porque não muda o resultado sem o aceite do operador.
1. **Anexo de serviços** a partir da descrição (seção 4.1): é onde mais se precisa de ajuda e onde nenhuma tabela resolve.
2. **Divergência entre o CNAE registrado e a atividade descrita** (seção 4.2, passo 3).
3. **Sugestão de CNAE** a partir de texto livre (seção 4.2 completa).
4. **Tipo de presunção.**

### Fase 4 (condicional): ajuste fino
Só se a fase 2 ficar abaixo da meta. Ajuste fino offline com a base rotulada, exportação para ONNX e publicação dos pesos no Hugging Face.

### Fase 5: governança
- **Critério de liberação:** por exemplo, acerto de pelo menos 95% nos casos em que o modelo responde.
- **Reavaliação:** a cada nova revisão do modelo ou mudança de norma.
- **Documentação:** registro no README, no `calculos.md` e no CHANGELOG.

## 6. Fora do escopo
- O modelo não calcula imposto e não altera o `aliquotas.json`.
- Não substitui as tabelas legais: impeditivo e Fator R seguem por regra e conta.
- Nada roda em servidor, e nenhum dado do cliente sai do navegador.

## 7. Riscos
- **Download pesado** em celular e em conexão lenta. Por isso a ativação é opcional e há a linha de base leve.
- **Qualidade em português** no vocabulário fiscal, ainda não medida.
- **Probabilidade alta não é garantia legal:** a sugestão nunca dispensa o aceite do operador.
- **Dependência de terceiros:** os pesos estão no Hugging Face. Mitigação: fixar a revisão e guardar uma cópia em repositório próprio no Hugging Face.

## 8. Decisões (respondidas em 2026-11-04)
1. **Download:** cerca de 400 MB opcionais é aceitável, com o tempo de carga medido e avaliado. A menor versão existente tem 637 MB (seção 9.2).
2. **Base de avaliação:** buscar bases rotuladas e, sem elas, criar uma. **Acerto mínimo de 80%.** Bases criadas em `avaliacao/` (seção 9.3).
3. **Ordem da fase 3:** confirmada.

## 9. Resultados da fase 0 (2026-11-04)

### 9.1 O que as páginas dos modelos dizem
Lido em `onnx-community/laya-ONNX`, `archevel/laya-web` e `convaiinnovations/laya`:
- **Idioma.** O checkpoint principal é **só inglês** ("English only on root"). Para outros idiomas, o próprio autor indica o `convaiinnovations/laya-multilingual` (mmBERT-base, 322M parâmetros, mais de 100 idiomas), que **não tem conversão para o navegador publicada**.
- **Acerto sem ajuste fino.** A página do modelo diz que os checkpoints base ficam perto do acaso em decisões tipadas sem ajuste fino (0,362 no conjunto *typed-decisions*, contra 0,766 da versão ajustada). Para chegar a 80%, **o ajuste fino da fase 4 deixa de ser condicional**.
- **Formato de entrada.** Uma sequência por pergunta, com limite de 512 tokens e de 48 tokens por opção: `[CLS] {tipo} question: {pergunta} [SEP] [MASK] opção … [SEP] estado [SEP]`. Os textos das opções tirados da lei precisam ser curtos.
- **Licença:** Apache 2.0 nos três repositórios.

### 9.2 Tempo de carga medido (`spike/laya-carga.html`, removido na v1.11.0 com o abandono do LAYA; está no histórico do git)
Modelo `archevel/laya-web` (int8, inglês), com ONNX Runtime Web 1.31.1, em Chrome 154 headless num notebook com 8 núcleos, 16 GB e GPU integrada Intel UHD:

| Medida | Resultado |
|---|---|
| Tamanho real | **603,7 MB** (encoder de 596 MB e cabeça de 37 MB), acima dos 400 MB previstos |
| Download, primeiro acesso | **44 s** a 13,7 MB/s |
| Leitura do cache, acessos seguintes | 0,6 a 1,1 s |
| Inicialização em WebGPU | 3,0 s |
| Inicialização em WebAssembly | 1,4 a 3,1 s |
| Total até pronto, com cache | 2,1 a 3,9 s |
| Memória JS ocupada | cerca de 610 MB |

Estimativa do primeiro acesso em outras conexões: cerca de 100 s a 50 Mbit/s e 8 min a 10 Mbit/s. **Ainda não medido:** latência por decisão e uso em celular, porque falta montar a sequência de entrada (próximo passo).

Problemas encontrados e resolvidos no spike:
- A versão 1.20.1 do ONNX Runtime Web falhava ao carregar o modelo. A 1.31.1 funciona.
- No WebGPU, as duas sessões precisam ser criadas uma de cada vez.

### 9.3 Bases rotuladas
Não existe base pronta de "descrição de atividade → anexo do Simples". As de portais contábeis são secundárias e sem licença de reuso. Foram criadas em `avaliacao/`:
- `anexo-lei.jsonl`: 50 itens com o texto e o rótulo dados pela LC 123/2006 (gabarito oficial).
- `anexo-casos.jsonl`: 138 descrições de operador, com o rótulo herdado do inciso da lei. Inclui 19 casos difíceis. **Validados pelo contador em 2026-11-05, sem mudança de rótulo.**
- `cnae-ibge.jsonl`: 2.581 pares de atividade e CNAE do índice oficial do IBGE.

**Linha de base sem modelo** (busca por palavras): 67,4% de acerto geral; com abstenção, responde 48,6% dos casos e acerta 85,1% deles. O modelo só se justifica se passar dos 80% respondendo mais casos que isso.

### 9.4 Consequências para o plano
1. **Modelo multilíngue.** Converter o `laya-multilingual` para ONNX int8 (fora do navegador, com Python) e publicar no Hugging Face. Pelo número de parâmetros, deve ficar perto dos 400 MB, o que ainda precisa ser medido.
2. **Ajuste fino obrigatório.** Usar `anexo-lei` e os casos validados como treino e avaliação separados, sem misturar.
3. **Próximo passo do spike:** montar a sequência de entrada no navegador (tokenizador e marcadores) e medir latência e acerto sem ajuste fino em `anexo-casos`, para ter o ponto de partida antes de treinar.

## 10. Conversão e primeiros treinos (2026-11-04)

Ambiente local: `laya 0.4.22`, `torch 2.15`, CPU i7-10610U. Modelo: `laya-multilingual` (mmBERT-base, 322M), que já vem dentro de `convaiinnovations/laya` (pasta `multilingual`).

### 10.1 Conversão para ONNX
| Formato | Tamanho | Fidelidade ao PyTorch (188 frases das bases) | Tempo por decisão (CPU) |
|---|---|---|---|
| fp32 | 1,23 GB | 100% das escolhas iguais | ~270 ms |
| **int8** (pesos de MatMul e embeddings) | **320 MB** | 89,9% das escolhas iguais | ~170 ms |
| int8 por canal | 321 MB | 52,7% | ~220 ms |
| int8 com a cabeça de decisão em fp32 | 352 MB | 89,4% | ~185 ms |

- O int8 cabe nos 400 MB.
- A fidelidade foi medida com o modelo sem treino, cujas probabilidades são quase planas, o que exagera as trocas de escolha. Ela precisa ser medida de novo no modelo treinado.
- Se continuar baixa, a próxima tentativa é int8 só nos pesos (`MatMulNBits`), e é preciso conferir se o ONNX Runtime Web aceita esse formato.
- Detalhe do export: a quantização falha na inferência de formas por causa do `value_info` gerado pelo exportador. Apagar o `value_info` antes de quantizar resolve.

### 10.2 Acerto
| Configuração | `anexo-lei` | `anexo-casos` |
|---|---|---|
| Sem ajuste fino | 18% | 16,7% (responde "vedado" em 113 de 138) |
| Ajuste fino só da cabeça (codificador congelado), dobra 0 | — | 3,4% (sem ganho; perda parada perto do acaso) |

Validação cruzada: 5 dobras de `anexo-casos`, agrupadas por inciso da lei. Treino de cada dobra:
- `anexo-lei`;
- 80 descritores do IBGE rotulados por regra: 40 de comércio (I) e 40 de indústria (II), sem o que o art. 17, VIII e X, pode vedar;
- os casos das outras dobras.

Congelar o codificador não basta: a cabeça não separa os anexos a partir das representações originais. **O ajuste fino precisa ser completo.** Em CPU, isso levaria de 3 a 4 h para as 5 dobras. Por isso o treino segue no Colab (GPU T4): `treino/laya-colab.ipynb`, gerado por `scripts/gerar-notebook-colab.py`.

### 10.3 Ajuste fino completo no Colab (GPU T4)
Mesma validação cruzada da 10.2, agora treinando o modelo inteiro.

| Medida | Resultado |
|---|---|
| Acerto geral (138 casos, incisos fora do treino) | **60,9%**, abaixo da linha de base (67,4%) |
| Casos normais / difíceis | 63,0% / 50,0% |
| Com confiança ≥ 0,9 | Responde 65% dos casos e acerta 66,7% |

A confiança não serve para triagem. 40 dos 54 erros ficam entre III, Fator R e vedado: são fronteiras definidas por listas da lei, não por um conceito que o modelo possa aprender com poucos exemplos. **Conclusão: perguntar "qual anexo?" com 6 categorias abstratas não funciona com o LAYA.**

## 11. Busca semântica com BGE-M3 (2026-11-04)

Em vez de classificar, compara a descrição livre com o texto dos 50 itens da lei (`anexo-lei`). O rótulo vem do item mais parecido, e não há treino. Modelo: BGE-M3, o mesmo ONNX já usado no projeto `bgem3-rag`. Pontuação híbrida: denso + 0,3 × esparso.

| Versão | Tamanho | Acerto geral | Normais / difíceis | Inciso certo entre os 3 / 10 primeiros | Respondendo 75% / 50% dos casos | Tempo por descrição (CPU, Python) |
|---|---|---|---|---|---|---|
| fp32 | 2,27 GB | 71,0% | 72% / 67% | 91% / 98% | 81% / 84% | 50 ms |
| int8 | 543 MB | 71,7% | 71% / 78% | 88% / 96% | 79% / 88% | 29 ms |
| **int8 com vocabulário do português** | **389 MB** | **74,6%** | 76% / 72% | 87% / 97% | 79% / 88% | 28 ms |

- **Vocabulário do português.** Ficam só os 92.067 pedaços, de 250.002, escritos com letras do português, números e pontuação. A tokenização sai idêntica à original nos 2.771 textos das bases, porque o tokenizador (Unigram) só usa pedaços com caracteres presentes no texto. Caracteres de fora (ñ, ß, emoji) viram `<unk>`. Fidelidade ao fp32: cosseno médio de 0,981, mínimo de 0,963.
- **As diferenças de acerto entre as três versões (até 5 casos) estão dentro do ruído da quantização.** O resultado é o mesmo.
- Usar os casos sintéticos como chaves extras (1-NN, validação cruzada agrupada) **piorou**: 58,7%. As chaves devem ser o texto da lei.
- O limite de abstenção foi escolhido nos mesmos dados, então os números com abstenção são um pouco otimistas.
- **Desenho proposto:** o BGE-M3 sugere o inciso da lei. O anexo sai do inciso, por código. Quando a folga entre o 1º e o 2º colocado for pequena, o operador escolhe no select entre os 3 primeiros, que contêm o inciso certo em 87 a 91% dos casos. Pares conhecidos, como imóvel próprio × de terceiros e cessão de mão de obra × equipe própria, ganham uma pergunta explícita.
- **Página de teste:** `spike/bge-busca.html`. Ver a 11.1.

### 11.1 No navegador (`spike/bge-busca.html`, 2026-11-05)
**Modelo publicado:** [`isreal01/bge-m3-pt-int8-onnx`](https://huggingface.co/isreal01/bge-m3-pt-int8-onnx), revisão `a54c0b4`, licença MIT.
- A página carrega o modelo fixado nessa revisão.
- Os vetores dos 50 itens da lei vêm prontos em `modelo/lei-vetores.json` (450 KB), gerados por `scripts/bge-m3-vetores-lei.py` com o mesmo modelo.
- Tokenizador: `@huggingface/tokenizers` 0.2.0, de cerca de 36 KB.

| Medida (Chrome 154 sem tela, i7-10610U) | WebAssembly | WebGPU (Intel UHD) |
|---|---|---|
| Pronto com o modelo em cache | **2,4 s** | — |
| Tempo por descrição (mediana / p95) | **223 / 331 ms** | 1.028 / 1.262 ms |
| Tokenização igual ao Python | 138/138 | 138/138 |
| 1º item igual ao Python | 130/138 | 130/138 |
| Acerto geral | **76,8%** | 76,1% |
| Com folga ≥ 0,05 entre o 1º e o 2º item | Responde 53,6%, acerta **87,8%** | Responde 55,8%, acerta 84,4% |

- **WebAssembly é o padrão.** Com int8, a WebGPU desta GPU integrada é 4,6 vezes mais lenta.
- As 8 trocas de 1º item em relação ao Python vêm das diferenças numéricas do int8 entre o ONNX Runtime nativo e o Web. O acerto não piorou.
- **Bases validadas:** os 138 casos foram conferidos pelo contador em 2026-11-05, sem mudança de rótulo, então os acertos desta seção e da 11 valem como medidos.
- **Primeiro acesso pelo Hugging Face** (perfil limpo): download de 45,0 s a 8,6 MB/s e pronto em **47,5 s**. Depois, o modelo fica no cache do navegador. Na mesma execução: 237 / 350 ms por descrição e o mesmo acerto (76,8%).
- **Selo de IA:** a sugestão leva o selo "✦ IA interna". Com folga pequena, a página mostra "não pode ser inferido automaticamente" e um select com os 3 primeiros itens.

**Próximo passo (fase 3):** levar a sugestão para o campo de anexo da ficha (`prompts.html`), com o modelo baixado só quando o operador pedir.

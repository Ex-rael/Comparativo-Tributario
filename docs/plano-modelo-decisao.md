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

### 9.2 Tempo de carga medido (`spike/laya-carga.html`)
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
- `anexo-casos.jsonl`: 138 descrições de operador, com o rótulo herdado do inciso da lei, a validar pelo contador. Inclui 19 casos difíceis.
- `cnae-ibge.jsonl`: 2.581 pares de atividade e CNAE do índice oficial do IBGE.

**Linha de base sem modelo** (busca por palavras): 67,4% de acerto geral; com abstenção, responde 48,6% dos casos e acerta 85,1% deles. O modelo só se justifica se passar dos 80% respondendo mais casos que isso.

### 9.4 Consequências para o plano
1. **Modelo multilíngue.** Converter o `laya-multilingual` para ONNX int8 (fora do navegador, com Python) e publicar no Hugging Face. Pelo número de parâmetros, deve ficar perto dos 400 MB, o que ainda precisa ser medido.
2. **Ajuste fino obrigatório.** Usar `anexo-lei` e os casos validados como treino e avaliação separados, sem misturar.
3. **Próximo passo do spike:** montar a sequência de entrada no navegador (tokenizador e marcadores) e medir latência e acerto sem ajuste fino em `anexo-casos`, para ter o ponto de partida antes de treinar.

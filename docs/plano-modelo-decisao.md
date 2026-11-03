# Plano: modelo de decisão no navegador para os enquadramentos ambíguos

Status: **rascunho para decisão**, 2026-11-03. Nada aqui foi implementado.

**Estratégia adotada:** dividir o trabalho. O modelo entra onde o texto é livre ("a empresa faz X", objeto social, descrição vaga) e sugere o anexo ou o CNAE provável, com uma probabilidade. Código comum consulta as tabelas (`cnae.json`) e calcula o Fator R. Os casos incertos, quando o modelo não tem confiança ou diverge da tabela, vão para revisão humana. As seções 3 a 5 detalham como, com quatro ajustes.

## 1. Objetivo

Ajudar o operador nas escolhas que a ficha hoje não consegue inferir (anexo do Simples em serviços e CNAEs ambíguos, tipo de presunção), com um **modelo de decisão** rodando no próprio navegador, sem servidor e sem prompt para LLM. O modelo **sugere com probabilidade**. Quem decide continua sendo o operador.

## 2. O que são LAYA e JEV

- **LAYA** ([ConvAI Innovations](https://www.llmreference.com/model-family/laya)): modelo de decisão "System 1", não autorregressivo. Recebe um *estado* e perguntas tipadas e devolve probabilidades calibradas para cada opção numa só passada. Segundo as fontes, tem cerca de 421M de parâmetros (encoder ModernBERT-large com cabeça de decisão), licença Apache 2.0 e foi treinado com RLCD (aprendizado por reforço com regras de pontuação próprias). Já existe conversão para o navegador: [onnx-community/laya-ONNX](https://huggingface.co/onnx-community/laya-ONNX) e [archevel/laya-web](https://huggingface.co/archevel/laya-web) (int8, WebGPU).
- **JEV** ([MindStudio](https://www.mindstudio.ai/blog/jev-judgment-model-browser-agents/)): modelo de julgamento da mesma família de ideias, voltado a agentes de navegação. Não encontrei pesos prontos para o navegador. Fica como alternativa a avaliar, não como base.

> Os números acima vêm de páginas públicas e **não foram medidos aqui**. A fase 0 existe para confirmá-los.

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

## 8. Decisões pendentes (do responsável pelo projeto)
1. Um download opcional de cerca de 400 MB é aceitável, ou a meta é um modelo leve (até cerca de 100 MB)?
2. Quem rotula a base de avaliação da fase 1, e qual a meta de acerto para liberar?
3. A ordem da fase 3 (anexo de serviços, divergência de CNAE, sugestão de CNAE, tipo de presunção) está correta?

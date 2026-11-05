# Histórico de versões

A versão segue [SemVer](https://semver.org/lang/pt-BR/) e fica em `motor.js` (`VERSAO`), mostrada no topo das duas páginas. **Sobe a cada commit**:

| Parte | Quando sobe | Exemplo |
|---|---|---|
| **MAJOR** (2.0.0) | O resultado muda para a mesma entrada, ou um JSON antigo deixa de ser aceito | Nova regra de cálculo, chave renomeada no `aliquotas.json` |
| **MINOR** (1.9.0) | Função nova, sem mudar o resultado de entradas antigas | Aba, campo novo opcional, nova tabela |
| **PATCH** (1.8.1) | Correção de erro, texto, layout ou documentação | Ajuste visual, README |

Mudança de valor no `aliquotas.json` (alíquota, faixa, limite) é dado, não código, e entra como PATCH, com a alteração descrita abaixo.

## 1.10.1 — 2026-11-05
- `avaliacao/anexo-casos.jsonl`: os 138 casos foram validados pelo contador, sem mudança de rótulo (`status: validado_contador`). Os acertos medidos valem como estão.

## 1.10.0 — 2026-11-05
- **Selo "✦ IA"** em todo ponto das páginas com IA: "IA externa" (prompt colado num assistente) e "IA no navegador" (modelo local), com legenda no topo. Para listar: `grep -n 'data-ia=' *.html spike/*.html`. README: seção "Onde a IA é usada".
- `spike/bge-busca.html`: teste do BGE-M3 no navegador.
  - Sugere o item da LC 123 e o anexo a partir da descrição; com folga pequena, mostra o select com os 3 primeiros itens.
  - Avalia as bases: 76,8% de acerto e 223 ms por descrição em WebAssembly.
- Modelo publicado no Hugging Face: `isreal01/bge-m3-pt-int8-onnx` (MIT).
- `modelo/lei-vetores.json` e `scripts/bge-m3-vetores-lei.py`: vetores prontos dos 50 itens da lei.
- Ficha: nomes de campo longos nas pendências quebram linha (não havia rolagem horizontal no celular).

## 1.9.2 — 2026-11-04
- Plano, seções 10.3 e 11: o LAYA com ajuste fino completo acertou 60,9% (abaixo da linha de base). A busca semântica com BGE-M3, sem treino, acertou 71–75%, e cabe em 389 MB com int8 e vocabulário do português.
- Scripts `bge-m3-podar.py` (poda do vocabulário e int8) e `bge-m3-avaliar.py` (acerto em `anexo-casos`).
- Conversões locais do LAYA apagadas; o processo fica registrado no plano e em `treino/laya-colab.ipynb`.

## 1.9.1 — 2026-11-04
- `treino/laya-colab.ipynb` (gerado por `scripts/gerar-notebook-colab.py`): ajuste fino completo do LAYA multilíngue no Colab, validação cruzada em 5 dobras e export ONNX int8.
- Plano, seção 10: conversão para ONNX (int8 com 320 MB) e primeiros treinos (sem ajuste: 17%; codificador congelado: sem ganho).

## 1.9.0 — 2026-11-04
- `avaliacao/`: bases rotuladas para o modelo de decisão (50 itens da LC 123, 138 casos de operador a validar, 2.581 pares CNAE do IBGE) e linha de base sem modelo.
- `fontes/lc123-art17-art18.txt`: texto atualizado dos arts. 17 e 18 da LC 123/2006 (Câmara dos Deputados).
- `spike/laya-carga.html`: teste de tempo de carga do LAYA no navegador. Resultados no plano.
- Scripts `gerar-base-cnae.mjs`, `gerar-casos-anexo.py` e `avaliar-baseline.mjs`.

## 1.8.1 — 2026-11-03
- `docs/plano-modelo-decisao.md`: plano do modelo de decisão no navegador (LAYA), com a divisão modelo × regra × revisão humana em três níveis.

## 1.8.0 — 2026-11-03
- `cnae.json` com as 1.332 subclasses CNAE 2.3 do IBGE, gerado por `scripts/gerar-cnae.mjs` (pronto para rotina automática).
- Ficha: anexo do Simples sugerido só por regra objetiva (comércio: Anexo I; indústria: Anexo II). CNAE ambíguo, impeditivo ou de serviço mostra mensagem de que não pode ser inferido automaticamente e pede a escolha no select.
- Ficha: RAT separado do FAP. O JSON recebe RAT × FAP.
- Tabelas oficiais de vedação (Resolução CGSN 140/2018, Anexo VI) e RAT (Decreto 3.048/1999, Anexo V) em `fontes/`, ainda sem dados.
- Versionamento SemVer e este histórico.

## 1.7.0 — 2026-11-03
- Ficha gera o `dados-empresa.json` sem IA (`ficha.js`), com pendências e premissas em `meta`.
- Motor extraído para `motor.js`, usado pelas duas páginas.
- Aba **Alíquotas**: tabela editável do `aliquotas.json` com cópia do JSON alterado.
- CNAE e município conferidos na API do IBGE. Avaliação das APIs em `docs/avaliacao-apis.md`.

## 1.6.0 — 2026-10-30
- README da ferramenta.
- Botões **Preencher com exemplo** e **Limpar ficha**.

## 1.5.0 — 2026-10-30
- Guia "Como usar" nas abas de prompt e orientação sobre crédito de PIS/COFINS. Ajustes de layout.

## 1.4.0 — 2026-10-30
- Ficha estruturada do cliente no prompt 2, sem dados pessoais, com mascaramento de CPF, CNPJ e e-mail.

## 1.3.0 — 2026-10-30
- Estimativa de tokens por campo e no total do prompt.

## 1.2.0 — 2026-10-30
- Botão **Aplicar CBS e IBS** (modo opcional, alíquotas em definição).

## 1.1.0 — 2026-10-30
- Aba **Fórmulas** (memória de cálculo em LaTeX) e página de prompts com formulário.

## 1.0.0 — 2026-10-29
- Comparativo entre Simples Nacional, Lucro Presumido e Lucro Real a partir de dois JSON.

# Bases de avaliação do modelo de decisão

Bases para medir, na fase 2 do [plano](../docs/plano-modelo-decisao.md), se um modelo acerta os enquadramentos. **Meta de liberação: acerto mínimo de 80%.**

Nenhuma base contém dado de cliente.

## Busca por bases prontas (2026-11-04)

| Fonte | Serve? | Motivo |
|---|---|---|
| Tabelas CNAE × anexo de portais contábeis (Contabilizei, contabilidade.com, Jornal Contábil) | Não como gabarito | Fonte secundária e comercial, sem licença de reuso. A lei descreve atividades, não códigos, então essas tabelas já são interpretação |
| UCI CNAE-9 | Não | Só 9 categorias, com o texto já reduzido a palavras soltas |
| **IBGE, lista de atividades por subclasse CNAE** | **Sim, para CNAE** | Oficial. Cada subclasse traz os termos do índice da CNAE |
| **LC 123/2006, arts. 17 e 18** | **Sim, para anexo** | A própria lei lista atividades e diz o anexo ou a vedação de cada uma |

Não há base rotulada pronta de "descrição de atividade → anexo do Simples". Por isso as bases abaixo foram criadas.

## Arquivos

| Arquivo | Itens | Rótulo | Origem do texto | Situação |
|---|---|---|---|---|
| `anexo-lei.jsonl` | 50 | Anexo ou vedação dado pela lei | Texto da LC 123/2006 (`fontes/lc123-art17-art18.txt`) | **Gabarito oficial** |
| `anexo-casos.jsonl` | 138 | Herdado do inciso da lei citado em `inciso_lei` | Descrições escritas como um operador digitaria (`origem_texto: sintetico_ia`) | **Validado pelo contador** em 2026-11-05 (`status: validado_contador`), sem mudança de rótulo |
| `cnae-ibge.jsonl` | 2.581 | Subclasse CNAE | Termos do índice da CNAE, até 2 por subclasse, sorteio com semente fixa | **Gabarito oficial** |

### Rótulos de anexo
`I` (revenda de mercadorias), `II` (indústria), `III`, `IV`, `III_ou_V_fator_r` e `vedado`.

`III_ou_V_fator_r` vale para as atividades cujo anexo depende da razão folha ÷ receita:
- § 5º-I, combinado com o § 5º-J;
- § 5º-D inteiro, combinado com o § 5º-M, II;
- § 5º-B, incisos XVI e XVIII a XXI, combinados com o § 5º-M, I.

O modelo só decide se a atividade está nesse grupo. A escolha entre III e V é conta, e o motor já faz.

### Casos difíceis
`dificuldade: dificil` marca 18 pares em que a mesma palavra leva a rótulos diferentes:
- locação de imóveis próprios (vedado) × administração de imóveis de terceiros (Fator R);
- transporte intermunicipal de passageiros (vedado) × transporte municipal (III);
- cessão de mão de obra (vedado) × limpeza e vigilância com equipe própria (IV, pelo § 5º-H);
- revenda (I) × montagem com marca própria (II).

`dificil_excecao` marca a microcervejaria: está na exceção do art. 17, X, c, então não é vedada e entra como indústria.

## Como regerar
```bash
node scripts/gerar-base-cnae.mjs 2      # cnae-ibge.jsonl, a partir da API do IBGE
python3 scripts/gerar-casos-anexo.py    # anexo-casos.jsonl, a partir de anexo-lei.jsonl
node scripts/avaliar-baseline.mjs       # linha de base sem modelo
```

## Linha de base sem modelo
`scripts/avaliar-baseline.mjs` liga cada caso ao inciso da lei com mais palavras em comum. É o piso que o modelo precisa superar.

| Medida | Resultado |
|---|---|
| Acerto geral em `anexo-casos` | **67,4%** |
| Casos normais | 72,3% |
| Casos difíceis | 38,9% |
| Com abstenção (melhor ≥ 1,5 × segundo) | Responde 48,6% dos casos e acerta **85,1%** deles |

A busca por palavras não chega aos 80% no geral. Com abstenção, passa dos 80%, mas só responde metade dos casos.

## Validação pelo contador
Concluída em 2026-11-05: o contador conferiu `rotulo` × `texto` dos 138 casos, inclusive os difíceis, e não mudou nenhum rótulo. Os números medidos antes da validação valem como estão.

Para revisar no futuro:
1. Corrigir o rótulo ou remover o caso em `scripts/gerar-casos-anexo.py`.
2. Regerar `anexo-casos.jsonl`.
3. Rodar `node scripts/avaliar-baseline.mjs` e `python3 scripts/bge-m3-avaliar.py PASTA_DO_MODELO` de novo.

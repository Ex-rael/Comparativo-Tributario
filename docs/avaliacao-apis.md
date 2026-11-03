# Avaliação das APIs oficiais (CNAE e ISS)

Testes feitos em 2026-11-03. O requisito é consultar **só pelo navegador**, para manter a ferramenta como site estático no GitHub Pages. Isso exige que a API responda a `GET` sem autenticação e libere CORS (`Access-Control-Allow-Origin`).

## 1. CNAE: API de Classificações do IBGE

Endpoint usado: `https://servicodados.ibge.gov.br/api/v2/cnae/subclasses/{7 dígitos}`
Documentação: https://servicodados.ibge.gov.br/api/docs/CNAE?versao=2

**Resultado: viável e já integrado na ficha.**

| Teste | Resultado |
|---|---|
| `GET /v2/cnae/subclasses/6201501` | 200, JSON com `id`, `descricao`, `classe` (grupo, divisão, seção), `atividades` e `observacoes` |
| CORS | `Access-Control-Allow-Origin: *` |
| Código inexistente (`9999999`) | 200 com `[]` (tratado como "não encontrado") |
| Autenticação | Nenhuma |

### O que a API resolve e o que não resolve

| Necessidade (antes coberta pela IA) | IBGE resolve? |
|---|---|
| Conferir se o código CNAE existe | **Sim** |
| Descrição oficial da atividade | **Sim** |
| Seção, divisão, grupo e classe | **Sim** |
| Anexo do Simples Nacional (I a V, Fator R, vedação) | **Não.** É regra da LC 123/2006 e da Resolução CGSN 140/2018 (Anexo VI), não da classificação do IBGE |
| Percentual de presunção do Lucro Presumido | **Não.** Depende da natureza da receita (Lei 9.249/1995, art. 15), não do código |
| RAT (grau de risco) | **Não.** Vem do Anexo V do Decreto 3.048/1999, por CNAE |
| Terceiros (FPAS) | **Não** |

**Conclusão.** O IBGE substitui a IA na **identificação** do CNAE, mas não no **enquadramento tributário**. Na ficha, o anexo do Simples e o tipo de presunção passaram a ser escolha explícita do contador, em listas fechadas. O próximo passo natural é uma tabela versionada no repositório (`cnae.json`) com CNAE → anexo, Fator R, vedação e grau de RAT, validada uma vez pelo contador. A ficha sugeriria o enquadramento e o contador confirmaria.

### Município (mesma API)

`GET https://servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios` responde com CORS liberado e devolve nome e código IBGE. A ficha usa essa lista como sugestão no campo Município e escreve o código no JSON gerado, em `empresa.municipio_ibge`. Nada fica guardado na página: o código só persiste se o operador salvar ou copiar o JSON. Ele é a chave que uma tabela de ISS (arquivo estático no repositório) precisaria.

## 2. ISS: APIs do Sistema Nacional NFS-e

Endpoints avaliados (página "APIs - Prod. Restrita e Produção"):
- Parâmetros municipais: `https://adn.nfse.gov.br/parametrizacao/...` (e `adn.producaorestrita.nfse.gov.br`)
- Sefin Nacional: `https://sefin.nfse.gov.br/SefinNacional/...`

**Resultado: inviável só pelo navegador.**

| Teste | Resultado |
|---|---|
| Handshake TLS com `adn.nfse.gov.br` | O servidor envia `CertificateRequest`: exige **certificado digital do cliente (mTLS)** |
| `GET` sem certificado | Falha no handshake (`ssl/tls alert handshake failure`). Nem a página de documentação abre |
| `GET` em `sefin.nfse.gov.br` sem certificado | 403 Forbidden |

### Por que não serve para o GitHub Pages
1. **Certificado ICP-Brasil.** As APIs exigem e-CNPJ ou e-CPF (A1 ou A3) apresentado no TLS. Uma página estática não tem como fazer isso de forma controlada. O navegador até pode oferecer um certificado instalado, mas só se o servidor liberar CORS para a origem do site, o que não foi verificável sem o certificado e não é o uso previsto da API.
2. **Uso previsto.** As APIs servem a contribuintes e municípios emitindo e consultando notas, não a consultas públicas de alíquota.
3. **Chave da consulta.** A alíquota municipal é parametrizada por **item da lista de serviços da LC 116/2003** (código de tributação nacional), não por CNAE. Mesmo com acesso, faltaria o mapeamento CNAE → item da LC 116.
4. **Cobertura.** Só os municípios aderentes ao padrão nacional publicam parâmetros no ADN.

### O que foi feito no lugar
- ISS continua informado pelo contador na ficha, por atividade.
- A ficha alerta quando o ISS está fora da faixa legal de 2% a 5% (LC 116/2003, arts. 8º e 8º-A).
- Atividade de comércio ou indústria com ISS em branco vira 0, registrado como premissa em `meta`.
- O código IBGE do município vai no JSON gerado (`empresa.municipio_ibge`). A página é estática e não guarda nada: uma futura tabela de ISS do escritório (municípios atendidos × item da LC 116) teria de ser um arquivo versionado no repositório, lido pela página. Consulta à NFS-e só com um intermediário com certificado, o que exigiria backend.

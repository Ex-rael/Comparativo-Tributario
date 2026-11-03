/*
 * Gera o cnae.json usado pela ficha. Feito para rodar em rotina automática (Node 18+, sem dependências):
 *   node scripts/gerar-cnae.mjs
 *
 * Fontes:
 * 1. IBGE (API pública): todas as subclasses CNAE 2.3, com descrição, seção e divisão.
 * 2. fontes/cgsn140-anexo-vi.csv: CNAEs impeditivos e ambíguos ao Simples (Resolução CGSN 140/2018, Anexo VI).
 * 3. fontes/decreto3048-anexo-v.csv: RAT por CNAE (Decreto 3.048/1999, Anexo V).
 * As tabelas 2 e 3 vêm da norma oficial e são mantidas à mão ou pela rotina. Sem elas, as colunas ficam vazias:
 * o gerador nunca inventa valor.
 *
 * O anexo sugerido segue só regras objetivas por divisão CNAE (veja REGRAS_ANEXO). O resto fica para o operador.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const IBGE = 'https://servicodados.ibge.gov.br/api/v2/cnae/subclasses';
const RAIZ = new URL('..', import.meta.url);

const REGRAS_ANEXO = [
  { anexo: 'I', regra: 'Comércio (divisões 45, 46 e 47 da CNAE), exceto manutenção e reparação de veículos (grupo 452)',
    aplica: (c) => ['45', '46', '47'].includes(c.divisao) && c.grupo !== '452' },
  { anexo: 'II', regra: 'Indústria de transformação (divisões 10 a 33 da CNAE)',
    aplica: (c) => Number(c.divisao) >= 10 && Number(c.divisao) <= 33 }
];

/* CSV simples com ";" e cabeçalho. Linhas vazias e começadas por "#" são ignoradas. */
async function lerCsv(nome) {
  const p = new URL('fontes/' + nome, RAIZ);
  if (!existsSync(p)) return { linhas: [], existe: false };
  const txt = await readFile(p, 'utf8');
  const [cab, ...resto] = txt.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  const campos = (cab || '').split(';').map((s) => s.trim());
  const linhas = resto.map((l) => Object.fromEntries(l.split(';').map((v, i) => [campos[i], v.trim()])));
  return { linhas, existe: true };
}
const so7 = (s) => String(s || '').replace(/\D/g, '');

const resp = await fetch(IBGE);
if (!resp.ok) throw new Error('IBGE respondeu ' + resp.status);
const lista = await resp.json();

const anexoVI = await lerCsv('cgsn140-anexo-vi.csv');
const anexoV = await lerCsv('decreto3048-anexo-v.csv');
const vedacao = new Map(anexoVI.linhas.map((l) => [so7(l.cnae), l.situacao]));
const rat = new Map(anexoV.linhas.map((l) => [so7(l.cnae), Number(String(l.rat).replace(',', '.'))]));
for (const [k, v] of vedacao) if (!['impeditivo', 'ambiguo'].includes(v)) throw new Error(`cgsn140-anexo-vi.csv: situação inválida "${v}" no CNAE ${k}`);
for (const [k, v] of rat) if (![1, 2, 3].includes(v)) throw new Error(`decreto3048-anexo-v.csv: RAT inválido "${v}" no CNAE ${k}`);

const subclasses = {};
for (const s of lista.sort((a, b) => a.id.localeCompare(b.id))) {
  const g = s.classe.grupo;
  const c = { divisao: g.divisao.id, grupo: g.id };
  const item = { d: s.descricao, s: g.divisao.secao.id, v: c.divisao };
  const sit = vedacao.get(s.id);
  if (sit) item.simples = sit;
  if (sit !== 'impeditivo') {
    const r = REGRAS_ANEXO.find((x) => x.aplica(c));
    if (r) item.anexo = r.anexo;
  }
  if (rat.has(s.id)) item.rat = rat.get(s.id);
  subclasses[s.id] = item;
}

const saida = {
  schema_version: '1.0',
  metadata: {
    descricao: 'Tabela CNAE para a ficha. d = descrição, s = seção, v = divisão, anexo = anexo do Simples sugerido por regra objetiva, simples = impeditivo ou ambiguo (Anexo VI da Resolução CGSN 140/2018), rat = RAT básico em % (Anexo V do Decreto 3.048/1999). Campo ausente = não inferido automaticamente.',
    gerado_em: new Date().toISOString().slice(0, 10),
    total_subclasses: lista.length,
    fontes: {
      ibge: IBGE,
      cgsn140_anexo_vi: anexoVI.linhas.length ? `fontes/cgsn140-anexo-vi.csv (${anexoVI.linhas.length} CNAEs)` : 'não carregada',
      decreto3048_anexo_v: anexoV.linhas.length ? `fontes/decreto3048-anexo-v.csv (${anexoV.linhas.length} CNAEs)` : 'não carregada'
    },
    regras_anexo: REGRAS_ANEXO.map((r) => `${r.anexo}: ${r.regra}`)
  },
  subclasses
};
await writeFile(new URL('cnae.json', RAIZ), JSON.stringify(saida) + '\n');
console.log(`cnae.json: ${lista.length} subclasses, ${vedacao.size} com situação no Simples, ${rat.size} com RAT, ` +
  `${Object.values(subclasses).filter((x) => x.anexo).length} com anexo sugerido.`);

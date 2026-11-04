/*
 * Gera avaliacao/cnae-ibge.jsonl: pares "descrição de atividade" -> subclasse CNAE, com rótulo oficial do IBGE.
 * Cada subclasse da API do IBGE traz a lista "atividades" (termos do índice da CNAE). Sorteia até N por subclasse,
 * com semente fixa, para a amostra ser sempre a mesma. Uso: node scripts/gerar-base-cnae.mjs [N=2]
 */
import { writeFile } from 'node:fs/promises';

const N = Number(process.argv[2] || 2);
const resp = await fetch('https://servicodados.ibge.gov.br/api/v2/cnae/subclasses');
if (!resp.ok) throw new Error('IBGE respondeu ' + resp.status);
const lista = (await resp.json()).sort((a, b) => a.id.localeCompare(b.id));

/* Gerador pseudoaleatório com semente fixa (mulberry32). */
let semente = 20261104;
function rnd() {
  semente |= 0; semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const linhas = [];
let totalAtividades = 0;
for (const s of lista) {
  const ats = [...new Set((s.atividades || []).map((a) => a.trim()).filter(Boolean))];
  totalAtividades += ats.length;
  for (let k = ats.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [ats[k], ats[j]] = [ats[j], ats[k]]; }
  for (const a of ats.slice(0, N)) {
    linhas.push(JSON.stringify({ texto: a.toLowerCase(), cnae: s.id, descricao_cnae: s.descricao, secao: s.classe.grupo.divisao.secao.id, origem: 'ibge_atividades' }));
  }
}
await writeFile(new URL('../avaliacao/cnae-ibge.jsonl', import.meta.url), linhas.join('\n') + '\n');
console.log(`cnae-ibge.jsonl: ${linhas.length} pares de ${lista.length} subclasses (${totalAtividades} atividades no IBGE).`);

/*
 * Linha de base sem modelo para a fase 2: para cada caso de avaliacao/anexo-casos.jsonl, acha o inciso da lei
 * (avaliacao/anexo-lei.jsonl) com mais palavras em comum (peso IDF, radical de 5 letras) e usa o rótulo dele.
 * Serve de piso: o modelo de decisão só vale a pena se superar este número. Uso: node scripts/avaliar-baseline.mjs
 */
import { readFile } from 'node:fs/promises';

const ler = async (p) => (await readFile(new URL('../' + p, import.meta.url), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
const lei = await ler('avaliacao/anexo-lei.jsonl');
const casos = await ler('avaliacao/anexo-casos.jsonl');

const PARADAS = new Set('a o e de da do das dos em no na nos nas para por com sem que se um uma uns umas ao aos as os ou como mais seu sua nosso nossa nossos nossas fazemos temos somos sao ser outras outros demais bem inclusive desta deste artigo lei complementar forma'.split(' '));
const termos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/)
  .filter((w) => w.length > 2 && !PARADAS.has(w)).map((w) => w.slice(0, 5));

const docs = lei.map((l) => ({ ...l, t: new Set(termos(l.texto)) }));
const df = new Map();
for (const d of docs) for (const w of d.t) df.set(w, (df.get(w) || 0) + 1);
const idf = (w) => Math.log((docs.length + 1) / ((df.get(w) || 0) + 1)) + 1;

let certos = 0, cobertos = 0, certosCobertos = 0;
const porDif = {}, erros = [];
for (const c of casos) {
  const q = new Set(termos(c.texto));
  const pont = docs.map((d) => ({ d, s: [...q].reduce((s, w) => s + (d.t.has(w) ? idf(w) : 0), 0) })).sort((a, b) => b.s - a.s);
  const melhor = pont[0], segundo = pont[1];
  const pred = melhor.s > 0 ? melhor.d.rotulo : null;
  const ok = pred === c.rotulo;
  certos += ok;
  const confiante = melhor.s > 0 && melhor.s >= 1.5 * (segundo.s || 0.001);
  if (confiante) { cobertos++; certosCobertos += ok; }
  const k = c.dificuldade;
  porDif[k] = porDif[k] || [0, 0]; porDif[k][0] += ok; porDif[k][1]++;
  if (!ok) erros.push(`${c.id} [${c.rotulo} -> ${pred}] ${c.texto}`);
}
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '-');
console.log(`Casos: ${casos.length}. Acerto geral: ${pct(certos, casos.length)}.`);
console.log(`Com abstenção (melhor >= 1,5x o segundo): responde ${pct(cobertos, casos.length)} dos casos, acerta ${pct(certosCobertos, cobertos)} deles.`);
for (const [k, [a, b]] of Object.entries(porDif)) console.log(`  ${k}: ${pct(a, b)} (${a}/${b})`);
if (process.argv.includes('--erros')) console.log(erros.join('\n'));

/*
 * Regrava a cópia embutida do aliquotas.json no index.html (var ALIQ_TXT), usada só quando a página
 * é aberta como arquivo (file://). Rode depois de mudar o aliquotas.json, antes do commit.
 * Uso: node scripts/embutir-aliquotas.mjs        (grava)
 *      node scripts/embutir-aliquotas.mjs --conferir   (só confere; sai com erro se estiver desatualizada)
 */
import { readFile, writeFile } from 'node:fs/promises';

const raiz = new URL('../', import.meta.url);
const aliq = await readFile(new URL('aliquotas.json', raiz), 'utf8');
JSON.parse(aliq); // falha aqui se o arquivo não for JSON válido
const html = await readFile(new URL('index.html', raiz), 'utf8');

const re = /^(\s*var ALIQ_TXT = )".*";$/m;
if (!re.test(html)) { console.error('index.html: linha "var ALIQ_TXT = ..." não encontrada.'); process.exit(2); }
const novo = html.replace(re, (_, ini) => ini + JSON.stringify(aliq) + ';');

if (process.argv.includes('--conferir')) {
  if (novo !== html) { console.error('Cópia embutida desatualizada: rode node scripts/embutir-aliquotas.mjs'); process.exit(1); }
  console.log('Cópia embutida em dia.');
} else if (novo === html) {
  console.log('Nada a mudar: a cópia embutida já é igual ao aliquotas.json.');
} else {
  await writeFile(new URL('index.html', raiz), novo);
  console.log('ALIQ_TXT atualizado no index.html.');
}

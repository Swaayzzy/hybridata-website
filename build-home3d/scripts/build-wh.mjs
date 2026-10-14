import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.WH_OUT_DIR || path.join(here, '..', '..', 'site', 'assets');
// warehouse-worker.js: the scene in a module worker (the normal path). warehouse-3d.js: the same scene on the page's thread (fallback).
for (const [entry, out] of [['wh-worker.js', 'warehouse-worker.js'], ['wh-main.js', 'warehouse-3d.js']]) {
  const file = path.join(outDir, out);
  await build({
    entryPoints: [path.join(here, '..', 'src', entry)],
    outfile: file, bundle: true, format: 'esm', minify: !process.env.WH_OUT_DIR, target: 'es2020', platform: 'browser',
    legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'info'
  });
  const buf = readFileSync(file);
  console.log(out, 'size', statSync(file).size, 'sha256', createHash('sha256').update(buf).digest('hex'));
  const s = buf.toString();
  console.log('  eval(', /\beval\s*\(/.test(s), 'new Function', /new\s+Function\b/.test(s), 'Function(', /[^a-zA-Z.]Function\(/.test(s));
}

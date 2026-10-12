import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', '..', 'site', 'assets', '3d', 'rack.3d.js');
await build({
  entryPoints: [path.join(here, '..', 'src', 'rack.js')],
  outfile: out, bundle: true, format: 'esm', minify: true, target: 'es2020', platform: 'browser',
  legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'info'
});
const buf = readFileSync(out);
console.log('size', statSync(out).size, 'sha256', createHash('sha256').update(buf).digest('hex'));
const s = buf.toString();
console.log('eval(', /\beval\s*\(/.test(s), 'new Function', /new\s+Function\b/.test(s), 'Function(', /[^a-zA-Z.]Function\(/.test(s));

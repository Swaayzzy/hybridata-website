import { chromium } from '../../hybridata-bid-screener/scripts/node_modules/playwright/index.mjs';
import fs from 'node:fs';
// usage: node shotall.mjs <outDir> <siteDir> [page1.html,page2.html] [width] [scale]
const [out, dir, list, width = '1440', scale = '0.4'] = process.argv.slice(2);
const pages = list ? list.split(',') : fs.readdirSync(dir).filter(f => f.endsWith('.html'));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(width), height: 900 }, deviceScaleFactor: Number(scale) });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
for (const f of pages) {
  await p.goto('file:///' + dir.split('\\').join('/') + '/' + f, { waitUntil: 'load' });
  const H = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += 400) { await p.evaluate(v => scrollTo(0, v), y); await p.waitForTimeout(60); }
  await p.waitForTimeout(900); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/${f.replace('.html', '')}-${width}.png`, fullPage: true });
  console.log(f, H);
}
await b.close();

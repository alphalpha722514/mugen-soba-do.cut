#!/usr/bin/env node
// 無限そば道・斬 — writes manifest.webmanifest and the app icons in icons/ (for "ホーム画面に追加" and the
// Google Play app made with PWABuilder / Bubblewrap). The icon is the same そばの器 SVG as the favicon in
// index.html, so change it there and run this again:  node tools/pwa/build.mjs
// The game itself does not need these files; index.html links the manifest only when opened over http(s).
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'index.html');
const BG = '#1f3f4a';                                   // the icon's own background (fills the corners)

const MANIFEST = {
  name: '無限そば道・斬',
  short_name: 'そば道・斬',
  description: '',                                      // taken from <meta name="description"> below
  lang: 'ja',
  dir: 'ltr',
  id: './index.html',
  start_url: './index.html',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#e7e0cd',
  theme_color: '#e7e0cd',
  categories: ['games', 'entertainment'],
  icons: [
    {src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
    {src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
    {src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'}
  ]
};

function loadPlaywright(){
  const req = createRequire(import.meta.url);
  for(const t of ['playwright', '/opt/node-tools/node_modules/playwright']){ try{ return req(t); }catch(e){} }
  try{
    const {execSync} = req('node:child_process');
    return req(path.join(execSync('npm root -g', {encoding:'utf8'}).trim(), 'playwright'));
  }catch(e){}
  return null;
}

async function main(){
  const html = fs.readFileSync(SRC, 'utf8');
  const icon = (html.match(/<link rel="icon" type="image\/svg\+xml" href="([^"]+)"/) || [])[1];
  if(!icon) throw new Error('index.html に <link rel="icon" type="image/svg+xml"> が見つかりません');
  const desc = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1] || '';
  const pw = loadPlaywright();
  if(!pw) throw new Error('playwright が見つかりません（npm i -g playwright などで入れてください）');
  const exe = ['/opt/pw-browsers/chromium'].find((p) => { try{ return fs.statSync(p).isFile(); }catch(e){ return false; } });
  const browser = await pw.chromium.launch(exe ? {executablePath: exe} : {});
  try{
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>icons</title>');
    // any: the icon over the whole square. maskable: the same icon at 80% in the middle (Android crops to a circle etc.)
    const out = await page.evaluate(async ({icon, bg}) => {
      const img = new Image();
      img.src = icon;
      await img.decode();
      const draw = (n, scale) => {
        const c = document.createElement('canvas');
        c.width = c.height = n;
        const g = c.getContext('2d');
        g.fillStyle = bg;
        g.fillRect(0, 0, n, n);
        const s = n*scale, o = (n - s)/2;
        g.drawImage(img, o, o, s, s);
        return c.toDataURL('image/png').split(',')[1];
      };
      return {'icon-192.png': draw(192, 1), 'icon-512.png': draw(512, 1), 'icon-maskable-512.png': draw(512, 0.8)};
    }, {icon, bg: BG});
    fs.mkdirSync(path.join(ROOT, 'icons'), {recursive: true});
    for(const [name, b64] of Object.entries(out)) fs.writeFileSync(path.join(ROOT, 'icons', name), Buffer.from(b64, 'base64'));
  } finally {
    await browser.close();
  }
  const manifest = {...MANIFEST, description: desc};
  fs.writeFileSync(path.join(ROOT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({manifest: 'manifest.webmanifest', icons: MANIFEST.icons.map((i) => i.src)}));
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });

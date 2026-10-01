#!/usr/bin/env node
// 無限そば道・斬 — builds og-image.jpg (1200×630), the picture shown when the game's URL is shared on X, LINE, etc.
//
// It opens index.html in headless Chromium and paints the card with the game's own drawing code (the そば畑
// background and a bowl of soba), then writes the JPEG next to index.html. The game itself never reads this file;
// only the og:image / twitter:image meta tags point at it. Run it again after changing the title or the art:
//   node tools/og/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'og-image.jpg');

function loadPlaywright(){
  const req = createRequire(import.meta.url);
  for(const t of ['playwright', '/opt/node-tools/node_modules/playwright']){ try{ return req(t); }catch(e){} }
  try{
    const {execSync} = req('node:child_process');
    return req(path.join(execSync('npm root -g', {encoding:'utf8'}).trim(), 'playwright'));
  }catch(e){}
  return null;
}

// Runs inside the game's own script, so it can use the scene and bowl drawing functions.
const EXPORT = String.raw`
window.__ogImage = function(){
  visualDetail = 'high';
  var w = 1200, h = 630, c = document.createElement('canvas');
  c.width = w; c.height = h;
  var g = c.getContext('2d');
  var skin = {bowl:skinLook('bowl', 'echizen_lacquer_bowl'), noodle:skinLook('noodle', 'nihachi_noodle'), tool:null,
              bg:skinLook('bg', 'soba_field'), effect:null, sound:null, title:null};
  withCanvas(g, w, h, 1, skin, function(){
    ctx.fillStyle = '#e7e0cd';
    ctx.fillRect(0, 0, W, H);
    drawEquippedBg();
    ctx.save(); drawKkBowl(925, 350, 2.1); ctx.restore();
  });
  // a washi panel on the left for the words
  var grd = g.createLinearGradient(0, 0, 760, 0);
  grd.addColorStop(0, 'rgba(240,233,214,0.96)'); grd.addColorStop(0.72, 'rgba(240,233,214,0.9)'); grd.addColorStop(1, 'rgba(240,233,214,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 760, h);
  g.fillStyle = '#1f3f4a'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#2c241a';
  g.font = '700 112px "Yuji Syuku", serif';
  g.fillText('無限そば道・', 60, 228);
  var tx = 60 + g.measureText('無限そば道・').width;
  g.font = '700 128px "Yuji Syuku", serif';
  g.fillStyle = '#a24d2b';
  g.fillText('斬', tx, 230);
  g.fillStyle = '#5c5138';
  g.font = '700 44px "Zen Maru Gothic", sans-serif';
  g.fillText('〜 蕎麦切り修行 〜', 72, 304);
  g.fillStyle = '#2c241a';
  g.font = '900 40px "Zen Maru Gothic", sans-serif';
  g.fillText('越前そばを、リズムで切る。', 72, 410);
  g.font = '700 30px "Zen Maru Gothic", sans-serif';
  g.fillStyle = '#5c5138';
  g.fillText('ブラウザですぐ遊べる・登録不要', 72, 462);
  return c.toDataURL('image/jpeg', 0.9);
};
`;

async function main(){
  const pw = loadPlaywright();
  if(!pw) throw new Error('playwright が見つかりません（npm i -g playwright などで入れてください）');
  const src = fs.readFileSync(SRC, 'utf8');
  const end = src.lastIndexOf('})();');
  if(end < 0) throw new Error('index.html のスクリプト末尾 })(); が見つかりません');
  const html = src.slice(0, end) + EXPORT + '\n' + src.slice(end);
  const exe = ['/opt/pw-browsers/chromium'].find((p) => { try{ return fs.statSync(p).isFile(); }catch(e){ return false; } });
  const browser = await pw.chromium.launch(exe ? {executablePath: exe} : {});
  try{
    // ignoreHTTPSErrors: behind a TLS-inspecting proxy the Google Fonts would not load otherwise
    const ctx = await browser.newContext({viewport: {width: 1200, height: 800}, colorScheme: 'light', ignoreHTTPSErrors: true});
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      let s = 20261001;
      Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    });
    // Google Fonts are fetched with curl (it follows HTTPS_PROXY and the system CA list, which Chromium may not)
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (r) => {
      try{
        const body = execFileSync('curl', ['-sSfL', '-m', '30', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36', r.request().url()], {maxBuffer: 64 * 1024 * 1024});
        const type = /googleapis/.test(r.request().url()) ? 'text/css; charset=utf-8' : 'font/woff2';
        await r.fulfill({status: 200, contentType: type, body, headers: {'access-control-allow-origin': '*'}});
      }catch(e){ await r.continue(); }
    });
    await page.route('http://og.local/**', (r) => r.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html}));
    await page.goto('http://og.local/index.html', {waitUntil: 'domcontentloaded'});
    const fontsOk = await page.evaluate(async () => {
      try{
        await Promise.all([document.fonts.load('700 118px "Yuji Syuku"', '無限そば道斬'),
                           document.fonts.load('900 40px "Zen Maru Gothic"', '越前そばをリズムで切る。'),
                           document.fonts.load('700 30px "Zen Maru Gothic"', 'ブラウザですぐ遊べる・登録不要〜蕎麦切り修行')]);
        await document.fonts.ready;
        return document.fonts.check('700 118px "Yuji Syuku"', '斬');
      }catch(e){ return false; }
    });
    if(!fontsOk) console.warn('注意: Google Fonts を読み込めなかったため、代わりのフォントで描きました');
    const url = await page.evaluate(() => window.__ogImage());
    fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
    console.log(JSON.stringify({out: OUT, bytes: fs.statSync(OUT).size, fonts: fontsOk}));
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });

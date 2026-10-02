#!/usr/bin/env node
// 無限そば道・斬　アイテム図鑑 — builds the item catalogue page (one self-contained HTML file) from index.html.
//
// It opens index.html in headless Chromium, lets the game draw every item with its own drawing code
// (the same pictures as the in-game 図鑑, plus a 着せ替え preview), and writes the page with the
// pictures embedded. Nothing in index.html is changed; the game is loaded from memory with a small
// export added at the end of its script, Math.random seeded and the network blocked, so the same
// index.html always gives the same page.
//
//   node tools/zukan/build.mjs                    build tools/zukan/out/item-zukan.html, print {pageHash, ...}
//   node tools/zukan/build.mjs --out FILE         build to FILE
//   node tools/zukan/build.mjs --mark-published [--url URL]
//                                                 record the current build as published (tools/zukan/state.json)
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'index.html');
const DEFAULT_OUT = path.join(ROOT, 'tools', 'zukan', 'out', 'item-zukan.html');
const STATE = path.join(ROOT, 'tools', 'zukan', 'state.json');
const sha = (s) => createHash('sha256').update(s).digest('hex');

function arg(name){ const i = process.argv.indexOf(name); return i >= 0 ? (process.argv[i + 1] || '') : null; }
function readJson(f, d){ try{ return JSON.parse(fs.readFileSync(f, 'utf8')); }catch(e){ return d; } }

if(process.argv.includes('--mark-published')){
  const out = arg('--out') || DEFAULT_OUT;
  if(!fs.existsSync(out)){ console.error('no build at ' + out + ' — run the build first'); process.exit(1); }
  const state = readJson(STATE, {});
  const url = arg('--url') || state.url || '';
  const next = {url, pageHash: sha(fs.readFileSync(out, 'utf8')), sourceHash: sha(fs.readFileSync(SRC, 'utf8'))};
  fs.writeFileSync(STATE, JSON.stringify(next, null, 2) + '\n');
  console.log(JSON.stringify(next));
  process.exit(0);
}

function loadPlaywright(){
  const req = createRequire(import.meta.url);
  const tries = ['playwright', '/opt/node-tools/node_modules/playwright'];
  for(const t of tries){ try{ return req(t); }catch(e){} }
  try{
    const {execSync} = req('node:child_process');
    const g = execSync('npm root -g', {encoding:'utf8'}).trim();
    return req(path.join(g, 'playwright'));
  }catch(e){}
  return null;
}

// Runs inside the game's own script, so it sees the catalogue, the palettes and the drawing functions.
const EXPORT = String.raw`
window.__zukanExport = function(){
  visualDetail = 'high';
  THUMB_RES = 3; thumbCache = {};
  var SWATCH = {body:'外側', inner:'内側', rim:'縁', gold:'金線', ink:'模様', shell:'卵殻', needle:'松葉',
    dough:'生地', doughDark:'生地の影', fills:'麺', outline:'輪郭', soak:'つゆ浸し', outlineSoak:'つゆ浸しの輪郭',
    blade:'地鉄', hagane:'刃', edge:'刃の線', handle:'柄', band:'口輪', collar:'口金', mei:'銘',
    ring:'リング', just:'JUST!のリング', bits:'粒'};
  var PATTERN = {deco:'模様', shape:'形', hamon:'刃紋', scene:'場面', light:'光', ringStyle:'リングの型', spark:'きらめき',
    grain:'粒', gloss:'艶', density:'模様の密度', speckDensity:'粒の量', husk:'甘皮', jitter:'不揃い', crack:'ヒビ', wet:'みずみずしさ',
    steam:'湯気の乗りやすさ', grav:'落ち方', spin:'回り方', unique:'一点ものの柄'};
  var SOUND_WHEN = {cut:'切るたび（コンボで音階が上がる）', just:'JUST!の合いの手', round:'1杯ごとの始まり', finish:'1杯の仕上がり', serve:'お客さんが食べるとき', miss:'MISSのとき'};
  function isHex(v){ return typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v); }
  function preview(slot, look){
    var w = 360, h = 190, dpr = 2, c = document.createElement('canvas');
    c.width = w*dpr; c.height = h*dpr;
    var g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var skin = {bowl:null, noodle:null, tool:null, bg:null, effect:null, sound:null, title:null};
    skin[slot] = look;
    withCanvas(g, w, h, dpr, skin, function(){
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = COLORS.card || '#fbf7ec';
      ctx.fillRect(0, 0, W, H);
      drawEquippedBg();
      var sc = Math.max(0.5, Math.min(0.72, (W*0.52)/222));
      var bx = W - 10 - 110*sc, by = H*0.5 - 19*sc;
      var laneW = Math.max(96, Math.min(210, bx - 110*sc - 14));
      safeDraw(function(){ drawKkLane(laneW); });
      safeDraw(function(){ drawKkBowl(bx, by, sc); });
      safeDraw(function(){ drawFxParts(ctx, kkParticles(bx, by, sc), true); });
    });
    return c.toDataURL('image/webp', 0.86);
  }
  var out = {total:GACHA_CATALOG.length, rarities:[], slots:EQUIP_SLOT_LABELS, items:[]};
  ['nami','jo','tokujo','kiwami','gen'].forEach(function(r){
    var R = GACHA_RARITIES[r];
    if(!R) return;
    out.rarities.push({id:r, label:R.label, rate:R.rate/100, exchange:R.exchange, dupTickets:R.dupTickets, count:R.count, reward:r==='gen'});
  });
  GACHA_CATALOG.forEach(function(it){
    var slot = it.applyTo, look = skinLook(slot, it.id) || {}, swatches = [], params = [], sounds = [];
    Object.keys(look).forEach(function(k){
      var v = look[k];
      if(k==='id') return;
      if(SWATCH[k]){
        var list = Array.isArray(v) ? v : [v];
        var cols = list.filter(isHex);
        if(cols.length) swatches.push({label:SWATCH[k], colors:cols});
      } else if(PATTERN[k] && v!==null && v!==false && v!==undefined){
        params.push({label:PATTERN[k], value:String(v===true ? 'あり' : v)});
      }
    });
    if(slot==='sound') Object.keys(SOUND_WHEN).forEach(function(k){
      if(look[k]) sounds.push({when:SOUND_WHEN[k], recipe:look[k], voices:(SKIN_SFX[look[k]] || []).length});
    });
    if(slot==='tool' && look.just) sounds.push({when:'JUST!のとき', recipe:look.just, voices:(SKIN_SFX[look.just] || []).length});
    var t = itemThumb(it);
    out.items.push({
      id:it.id, name:it.name, rarity:it.rarity, category:it.category, slot:slot, slotLabel:EQUIP_SLOT_LABELS[slot] || slot,
      desc:it.desc, note:SKIN_NOTES[it.id] || EQUIP_SLOT_NOTES[slot] || '',
      season:GACHA_SEASON_ONLY[it.id] ? '新そばモードの期間だけ出ます（交換も期間中のみ）' : (it.source==='reward' ? 'ガチャ・交換所には出ません。' + rewardCondText(it.cond) + 'されます。' : ''),
      thumb:t ? t.toDataURL('image/webp', 0.9) : '',
      preview:['bowl','noodle','tool','bg','effect'].indexOf(slot)>=0 ? preview(slot, look) : '',
      swatches:swatches, params:params, sounds:sounds
    });
  });
  return out;
};
`;

async function build(outFile){
  const pw = loadPlaywright();
  if(!pw) throw new Error('playwright が見つかりません（npm i -g playwright などで入れてください）');
  const src = fs.readFileSync(SRC, 'utf8');
  const end = src.lastIndexOf('})();');
  if(end < 0) throw new Error('index.html のスクリプト末尾 })(); が見つかりません');
  const html = src.slice(0, end) + EXPORT + '\n' + src.slice(end);
  const exe = ['/opt/pw-browsers/chromium'].find((p) => { try{ return fs.statSync(p).isFile(); }catch(e){ return false; } });
  const browser = await pw.chromium.launch(exe ? {executablePath: exe} : {});
  try{
    const ctx = await browser.newContext({viewport: {width: 420, height: 800}, colorScheme: 'light', deviceScaleFactor: 1});
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      let s = 20261001;
      Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    });
    await page.route('**/*', (r) => r.request().url().startsWith('http://zukan.local/')
      ? r.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html}) : r.abort());
    await page.goto('http://zukan.local/index.html');
    const data = await page.evaluate(() => window.__zukanExport());
    if(errors.length) throw new Error('ゲームの読み込みでエラー: ' + errors.join(' / '));
    const sourceHash = sha(src);
    const out = renderPage(data, sha(JSON.stringify(data)).slice(0, 8));   // stamped with the items' own hash, so other edits leave the page as it is
    fs.mkdirSync(path.dirname(outFile), {recursive: true});
    fs.writeFileSync(outFile, out);
    return {out: outFile, pageHash: sha(out), sourceHash, items: data.items.length, bytes: Buffer.byteLength(out)};
  } finally {
    await browser.close();
  }
}

function esc(s){ return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function renderPage(data, ver){
  const slotOrder = ['bowl','noodle','tool','bg','effect','sound','title'];
  const slotCount = {};
  data.items.forEach((it) => { slotCount[it.slot] = (slotCount[it.slot] || 0) + 1; });
  const chips = slotOrder.filter((s) => slotCount[s]).map((s) =>
    `<button type="button" class="chip" data-slot="${s}" aria-pressed="false">${esc(data.slots[s])}<span class="n">${slotCount[s]}</span></button>`).join('');
  const sections = data.rarities.map((r) => {
    const items = data.items.filter((it) => it.rarity === r.id);
    const cards = items.map((it) => `
      <li class="card r-${it.rarity}" data-slot="${it.slot}" data-text="${esc((it.name + ' ' + it.category + ' ' + it.slotLabel + ' ' + it.desc).toLowerCase())}">
        <button type="button" class="card-btn" data-id="${it.id}" aria-label="${esc(it.name)}の詳細">
          <img class="pic" src="${it.thumb}" alt="" width="288" height="288" loading="lazy">
          <span class="nm">${esc(it.name)}</span>
          <span class="meta"><span class="slot">${esc(it.slotLabel)}</span>${esc(it.category)}${it.season ? '<span class="season">' + (it.rarity === 'gen' ? '実績で解放' : '期間限定') + '</span>' : ''}</span>
        </button>
      </li>`).join('');
    return `
    <section class="band r-${r.id}" aria-labelledby="h-${r.id}">
      <header class="band-head">
        <h2 id="h-${r.id}"><span class="seal">${esc(r.label)}</span></h2>
        <dl class="facts">${r.reward ? `
          <div><dt>入手</dt><dd>修行・クイズの実績</dd></div>
          <div><dt>点数</dt><dd>${items.length}</dd></div>
          <div><dt>ガチャ・交換</dt><dd>出ません</dd></div>` : `
          <div><dt>排出率</dt><dd>${r.rate.toFixed(r.rate % 1 ? 1 : 0)}%</dd></div>
          <div><dt>点数</dt><dd>${items.length}</dd></div>
          <div><dt>交換</dt><dd>そば札 ${r.exchange}枚</dd></div>
          <div><dt>かぶり</dt><dd>そば札 ${r.dupTickets}枚</dd></div>`}
        </dl>
      </header>
      <ul class="grid">${cards}</ul>
    </section>`;
  }).join('');
  const json = JSON.stringify(data.items).replace(/</g, '\\u003c');
  return `<title>無限そば道・斬　アイテム図鑑</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Yuji+Syuku&family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap">
<style>
/* Layout: a shop's 品書き — one band per rarity (並 → 極み), each a grid of item cards; a card opens a detail sheet. */
:root{
  --bg:#e7e0cd; --paper:#fbf7ec; --ink:#2c241a; --ink-soft:#5c5138; --line:rgba(44,36,26,0.14);
  --accent:#1f3f4a; --accent2:#9a4526; --chip:#efe7d3;
  --r-nami:#74654a; --r-jo:#2f6f86; --r-tokujo:#8a6414; --r-kiwami:#7d3f8f; --r-gen:#a3301c; --r-gen-bg:rgba(163,48,28,0.10);
  --r-nami-bg:rgba(116,101,74,0.09); --r-jo-bg:rgba(47,111,134,0.10); --r-tokujo-bg:rgba(194,154,60,0.16); --r-kiwami-bg:rgba(125,63,143,0.12);
  --shadow:0 1px 2px rgba(40,28,10,0.10),0 4px 14px rgba(40,28,10,0.08); --scrim:rgba(30,22,12,0.55);
  --font-display:'Yuji Syuku','Hiragino Mincho ProN','Yu Mincho',serif;
  --font-body:'Zen Maru Gothic','Hiragino Maru Gothic ProN','Yu Gothic Medium','Hiragino Sans',sans-serif;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --bg:#181310; --paper:#251d16; --ink:#ece3d0; --ink-soft:#b9ac8e; --line:rgba(236,227,208,0.13);
  --accent:#9cc3cf; --accent2:#e39a76; --chip:#2e251c;
  --r-nami:#bcae8f; --r-jo:#86bfd2; --r-tokujo:#e6b94f; --r-kiwami:#d29be0; --r-gen:#f08f72; --r-gen-bg:rgba(240,143,114,0.14);
  --r-nami-bg:rgba(188,174,143,0.10); --r-jo-bg:rgba(134,191,210,0.12); --r-tokujo-bg:rgba(230,185,79,0.14); --r-kiwami-bg:rgba(210,155,224,0.14);
  --shadow:0 1px 2px rgba(0,0,0,0.45),0 4px 14px rgba(0,0,0,0.3); --scrim:rgba(0,0,0,0.65); color-scheme:dark; } }
:root[data-theme="dark"]{
  --bg:#181310; --paper:#251d16; --ink:#ece3d0; --ink-soft:#b9ac8e; --line:rgba(236,227,208,0.13);
  --accent:#9cc3cf; --accent2:#e39a76; --chip:#2e251c;
  --r-nami:#bcae8f; --r-jo:#86bfd2; --r-tokujo:#e6b94f; --r-kiwami:#d29be0; --r-gen:#f08f72; --r-gen-bg:rgba(240,143,114,0.14);
  --r-nami-bg:rgba(188,174,143,0.10); --r-jo-bg:rgba(134,191,210,0.12); --r-tokujo-bg:rgba(230,185,79,0.14); --r-kiwami-bg:rgba(210,155,224,0.14);
  --shadow:0 1px 2px rgba(0,0,0,0.45),0 4px 14px rgba(0,0,0,0.3); --scrim:rgba(0,0,0,0.65); color-scheme:dark; }
*{box-sizing:border-box;}
body{background:var(--bg);color:var(--ink);font-family:var(--font-body);font-size:15px;line-height:1.6;}
.wrap{max-width:1120px;margin:0 auto;padding-inline:16px;padding-block:28px 56px;display:flex;flex-direction:column;gap:28px;}
.r-nami{--rc:var(--r-nami);--rbg:var(--r-nami-bg);} .r-jo{--rc:var(--r-jo);--rbg:var(--r-jo-bg);}
.r-tokujo{--rc:var(--r-tokujo);--rbg:var(--r-tokujo-bg);} .r-kiwami{--rc:var(--r-kiwami);--rbg:var(--r-kiwami-bg);} .r-gen{--rc:var(--r-gen);--rbg:var(--r-gen-bg);}
.masthead{display:flex;flex-direction:column;gap:6px;}
.masthead h1{margin:0;font-family:var(--font-display);font-weight:400;font-size:clamp(1.7rem,5vw,2.6rem);line-height:1.15;letter-spacing:.06em;color:var(--accent);text-wrap:balance;}
.masthead h1 small{display:block;font-size:.5em;letter-spacing:.3em;color:var(--ink-soft);margin-top:4px;}
.lede{margin:0;max-width:62ch;color:var(--ink-soft);font-size:.92rem;}
.tools{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;position:sticky;top:env(safe-area-inset-top,0px);z-index:2;
  background:var(--bg);padding-block:10px;border-bottom:1px solid var(--line);}
.chips{display:flex;flex-wrap:wrap;gap:6px;}
.chip{font:inherit;font-size:.86rem;font-weight:700;color:var(--ink);background:var(--chip);border:1px solid var(--line);border-radius:999px;
  padding:5px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
.chip .n{font-size:.72rem;font-weight:500;color:var(--ink-soft);font-variant-numeric:tabular-nums;}
.chip[aria-pressed="true"]{background:var(--accent);color:var(--paper);border-color:var(--accent);}
.chip[aria-pressed="true"] .n{color:var(--paper);opacity:.8;}
.search{flex:1 1 180px;min-width:0;max-width:280px;font:inherit;font-size:.9rem;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:7px 11px;}
.count{font-size:.8rem;color:var(--ink-soft);font-variant-numeric:tabular-nums;margin-left:auto;}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.band{display:flex;flex-direction:column;gap:14px;}
.band-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px;border-bottom:2px solid var(--rc);padding-bottom:8px;}
.band-head h2{margin:0;}
.seal{display:inline-grid;place-items:center;min-width:3.2em;padding:2px 12px;font-family:var(--font-display);font-weight:400;font-size:1.5rem;
  color:var(--paper);background:var(--rc);border-radius:6px;letter-spacing:.08em;}
.facts{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0;}
.facts div{display:flex;gap:6px;align-items:baseline;}
.facts dt{font-size:.74rem;color:var(--ink-soft);letter-spacing:.06em;}
.facts dd{margin:0;font-weight:700;font-variant-numeric:tabular-nums;}
.grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}
.card[hidden]{display:none!important;}
.card-btn{width:100%;height:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:6px;
  background:var(--paper);border:1px solid var(--line);border-top:3px solid var(--rc);border-radius:12px;padding:8px 8px 10px;box-shadow:var(--shadow);
  transition:transform .15s ease;}
.card-btn:hover{transform:translateY(-2px);}
.pic{display:block;width:100%;height:auto;aspect-ratio:1/1;max-width:100%;border-radius:8px;background:var(--rbg);}
.nm{font-weight:900;font-size:.92rem;line-height:1.35;word-break:auto-phrase;}
.meta{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;font-size:.74rem;color:var(--ink-soft);}
.slot{font-weight:700;color:var(--rc);border:1px solid var(--rc);border-radius:4px;padding:0 5px;}
.season{color:var(--accent2);font-weight:700;}
.empty{margin:0;color:var(--ink-soft);}
.foot{font-size:.76rem;color:var(--ink-soft);border-top:1px solid var(--line);padding-top:12px;}
.sheet{position:fixed;inset:0;z-index:10;background:var(--scrim);display:grid;place-items:center;padding:16px;}
.sheet[hidden]{display:none;}
.sheet-box{position:relative;width:min(760px,100%);max-height:calc(100% - 8px);overflow:auto;background:var(--paper);color:var(--ink);
  border-radius:16px;border-top:5px solid var(--rc);box-shadow:var(--shadow);padding:20px;display:grid;grid-template-columns:minmax(0,240px) minmax(0,1fr);gap:18px 22px;}
.sheet-close{position:absolute;top:10px;right:10px;font:inherit;font-size:.85rem;font-weight:700;color:var(--ink);background:var(--chip);
  border:1px solid var(--line);border-radius:999px;padding:4px 12px;cursor:pointer;}
.sheet-pic{width:100%;height:auto;border-radius:10px;background:var(--rbg);}
.sheet-main{min-width:0;display:flex;flex-direction:column;gap:10px;}
.sheet-main h3{margin:0;padding-right:64px;font-family:var(--font-display);font-weight:400;font-size:1.6rem;line-height:1.25;color:var(--ink);text-wrap:balance;word-break:auto-phrase;}
.tags{display:flex;flex-wrap:wrap;gap:6px;}
.tag{font-size:.76rem;font-weight:700;border-radius:4px;padding:1px 7px;background:var(--rbg);color:var(--rc);border:1px solid var(--rc);}
.desc{margin:0;max-width:60ch;}
.note{margin:0;font-size:.86rem;color:var(--ink-soft);}
.sheet-wide{grid-column:1 / -1;display:flex;flex-direction:column;gap:8px;min-width:0;}
.sheet-wide h4{margin:0;font-size:.8rem;letter-spacing:.12em;color:var(--ink-soft);}
.prev{width:100%;height:auto;border-radius:10px;border:1px solid var(--line);}
.sw-list{display:flex;flex-wrap:wrap;gap:10px 18px;margin:0;padding:0;list-style:none;}
.sw-list li{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:.78rem;white-space:nowrap;}
.sw{display:inline-block;width:18px;height:18px;border-radius:4px;border:1px solid var(--line);}
.sw-code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.72rem;color:var(--ink-soft);}
.kv{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none;}
.kv li{font-size:.78rem;background:var(--chip);border:1px solid var(--line);border-radius:6px;padding:2px 8px;}
.kv b{font-weight:700;margin-right:4px;}
@media (max-width:620px){ .sheet-box{grid-template-columns:1fr;} .sheet-pic{max-width:220px;} .grid{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));} }
@media (prefers-reduced-motion:reduce){ .card-btn{transition:none;} .card-btn:hover{transform:none;} }
</style>
<div class="wrap">
  <header class="masthead">
    <h1>無限そば道・斬<small>アイテム図鑑</small></h1>
    <p class="lede">ガチャと交換所、修行やクイズの実績で手に入る全${data.total}点の絵と、装備したときの見た目です。絵はゲームの描画コードでそのまま描いたもので、アイテムの内容が変わるとこのページも作り直されます。カードを押すと、説明・色・模様の設定を見られます。</p>
  </header>
  <div class="tools" role="search">
    <div class="chips" role="group" aria-label="種類で絞り込む">
      <button type="button" class="chip" data-slot="" aria-pressed="true">すべて<span class="n">${data.total}</span></button>${chips}
    </div>
    <input id="q" class="search" type="search" placeholder="名前や説明で探す" aria-label="名前や説明で探す">
    <span class="count" id="count" aria-live="polite">${data.total}点</span>
  </div>
  ${sections}
  <p class="empty" id="empty" hidden>条件に合うアイテムはありません。絞り込みを「すべて」に戻すか、検索の言葉を変えてください。</p>
  <footer class="foot">図鑑データ ${esc(ver)}・index.html の描画コードで「高」の細かさ、ライトテーマの色で描画</footer>
</div>
<div class="sheet" id="sheet" hidden>
  <div class="sheet-box" id="sheet-box" role="dialog" aria-modal="true" aria-labelledby="sh-name"></div>
</div>
<script type="application/json" id="items">${json}</script>
<script>
(function(){
  var items = JSON.parse(document.getElementById('items').textContent), byId = {};
  items.forEach(function(it){ byId[it.id] = it; });
  var RAR = {nami:'並', jo:'上', tokujo:'特上', kiwami:'極み', gen:'限定'};
  var slot = '', q = '', last = null;
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  function apply(){
    var shown = 0;
    cards.forEach(function(c){
      var ok = (!slot || c.getAttribute('data-slot')===slot) && (!q || c.getAttribute('data-text').indexOf(q)>=0);
      c.hidden = !ok; if(ok) shown++;
    });
    document.querySelectorAll('.band').forEach(function(b){ b.hidden = !b.querySelector('.card:not([hidden])'); });
    document.getElementById('count').textContent = shown + '点';
    document.getElementById('empty').hidden = shown>0;
  }
  chips.forEach(function(ch){ ch.addEventListener('click', function(){
    slot = ch.getAttribute('data-slot');
    chips.forEach(function(o){ o.setAttribute('aria-pressed', o===ch ? 'true' : 'false'); });
    apply();
  }); });
  document.getElementById('q').addEventListener('input', function(e){ q = e.target.value.trim().toLowerCase(); apply(); });
  function el(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text!==undefined) e.textContent = text; return e; }
  var sheet = document.getElementById('sheet'), box = document.getElementById('sheet-box');
  function open(id){
    var it = byId[id]; if(!it) return;
    box.className = 'sheet-box r-' + it.rarity;
    box.textContent = '';
    var close = el('button', 'sheet-close', '閉じる'); close.type = 'button'; close.addEventListener('click', shut);
    var img = el('img', 'sheet-pic'); img.src = it.thumb; img.alt = it.name + 'の絵';
    var main = el('div', 'sheet-main'), h = el('h3', '', it.name); h.id = 'sh-name';
    var tags = el('div', 'tags');
    [RAR[it.rarity], it.slotLabel + 'に装備', it.category].forEach(function(t){ tags.appendChild(el('span', 'tag', t)); });
    main.appendChild(h); main.appendChild(tags); main.appendChild(el('p', 'desc', it.desc));
    if(it.note) main.appendChild(el('p', 'note', '装備すると：' + it.note));
    if(it.season) main.appendChild(el('p', 'note', it.season));
    box.appendChild(close); box.appendChild(img); box.appendChild(main);
    if(it.preview){
      var w1 = el('div', 'sheet-wide'); w1.appendChild(el('h4', '', '装備したときの見た目'));
      var p = el('img', 'prev'); p.src = it.preview; p.alt = it.name + 'を装備した着せ替えの見本'; w1.appendChild(p); box.appendChild(w1);
    }
    if(it.swatches.length){
      var w2 = el('div', 'sheet-wide'); w2.appendChild(el('h4', '', '色'));
      var ul = el('ul', 'sw-list');
      it.swatches.forEach(function(s){
        var li = el('li'); li.appendChild(el('span', '', s.label));
        s.colors.forEach(function(c){ var sw = el('span', 'sw'); sw.style.background = c; sw.title = c; li.appendChild(sw); });
        li.appendChild(el('span', 'sw-code', s.colors.join(' ')));
        ul.appendChild(li);
      });
      w2.appendChild(ul); box.appendChild(w2);
    }
    if(it.params.length || it.sounds.length){
      var w3 = el('div', 'sheet-wide'); w3.appendChild(el('h4', '', it.sounds.length && !it.params.length ? '音' : '模様と動き'));
      var kv = el('ul', 'kv');
      it.params.forEach(function(p2){ var li = el('li'); li.appendChild(el('b', '', p2.label)); li.appendChild(document.createTextNode(p2.value)); kv.appendChild(li); });
      it.sounds.forEach(function(s){ var li = el('li'); li.appendChild(el('b', '', s.when)); li.appendChild(document.createTextNode(s.recipe + '（' + s.voices + '音を重ねた合成音）')); kv.appendChild(li); });
      w3.appendChild(kv); box.appendChild(w3);
    }
    last = document.activeElement;
    sheet.hidden = false;
    close.focus();
    try{ history.replaceState(null, '', '#' + id); }catch(e){}
  }
  function shut(){
    sheet.hidden = true;
    try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
    if(last && last.focus) last.focus();
  }
  document.querySelectorAll('.card-btn').forEach(function(b){ b.addEventListener('click', function(){ open(b.getAttribute('data-id')); }); });
  sheet.addEventListener('click', function(e){ if(e.target===sheet) shut(); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && !sheet.hidden) shut(); });
  var h0 = (location.hash || '').slice(1);
  if(byId[h0]) open(h0);
})();
</script>
`;
}

const outFile = arg('--out') || DEFAULT_OUT;
build(outFile).then((r) => { console.log(JSON.stringify(r)); }, (e) => { console.error(String(e && e.message || e)); process.exit(1); });

#!/usr/bin/env node
// Stop hook: keeps the アイテム図鑑 artifact in step with index.html.
// When index.html has changed since the last check, it rebuilds the page (tools/zukan/build.mjs). If the new page
// differs from the one recorded as published (tools/zukan/state.json), it stops Claude from ending the turn and
// asks it to republish to the same URL. Anything missing (no playwright, a failed build) never blocks the turn.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const SRC = path.join(ROOT, 'index.html');
const STATE = path.join(ROOT, 'tools', 'zukan', 'state.json');
const CACHE = path.join(ROOT, '.claude', 'zukan-cache.json');   // not committed: the last index.html this machine checked
const BUILD = path.join(ROOT, 'tools', 'zukan', 'build.mjs');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const readJson = (f) => { try{ return JSON.parse(fs.readFileSync(f, 'utf8')); }catch(e){ return null; } };

let input = {};
try{ input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); }catch(e){}
if(input.stop_hook_active) process.exit(0);                    // already asked once this turn: never loop
if(!fs.existsSync(SRC) || !fs.existsSync(BUILD)) process.exit(0);

const state = readJson(STATE) || {};
const srcHash = sha(fs.readFileSync(SRC, 'utf8'));
if(state.sourceHash === srcHash) process.exit(0);              // the published page was built from this index.html
const cache = readJson(CACHE) || {};
let result = null;
if(cache.sourceHash === srcHash && cache.pageHash && cache.out && fs.existsSync(cache.out)) result = cache;
else{
  try{
    const out = execFileSync(process.execPath, [BUILD], {cwd: ROOT, encoding: 'utf8', timeout: 150000, stdio: ['ignore', 'pipe', 'pipe']});
    result = JSON.parse(out.trim().split('\n').pop());
    fs.writeFileSync(CACHE, JSON.stringify({sourceHash: srcHash, pageHash: result.pageHash, out: result.out}) + '\n');
  }catch(e){
    console.log(JSON.stringify({systemMessage: 'アイテム図鑑を作り直せませんでした（' + String(e.message || e).split('\n')[0] + '）'}));
    process.exit(0);
  }
}
if(result.pageHash === state.pageHash){                        // index.html changed, but not anything the page shows
  process.exit(0);
}
const rel = path.relative(ROOT, result.out);
console.log(JSON.stringify({
  decision: 'block',
  reason: 'index.html の変更でアイテム図鑑のページが変わりました。' + rel + ' を Artifact ツールで url "' + (state.url || '(tools/zukan/state.json に記録がありません)') +
    '" に再公開し（同じURLのまま更新）、続けて `node tools/zukan/build.mjs --mark-published` を実行して tools/zukan/state.json をコミットに含めてください。'
}));

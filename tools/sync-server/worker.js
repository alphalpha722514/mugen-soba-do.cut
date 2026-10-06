// 無限そば道・斬 同期サーバー（Cloudflare Workers + KV。KV のバインド名は DB。番付は D1 のバインド名 RANKDB があればそちら）
// 公開中: https://soba-sync.yfhmbvzk72.workers.dev （Cloudflare の Worker「soba-sync」の「コードを編集」に、この中身を貼って「デプロイ」）
// POST /register・/login {user, hash} → {ok, user, token} ／ GET・PUT /save（Bearer トークン） ／ DELETE /account {hash}
// 番付（参加した人だけ）: POST /ranking（Bearer・判定の記録つき。サーバーで得点を計算し直す。pub:false なら全体には載せず、group:合言葉 の
// クラス番付だけに載せる） ／ GET /ranking?course=&period=week|all[&group=合言葉]（Bearer があれば自分の行に me:true）
// ／ DELETE /ranking[?scope=global | ?group=合言葉]（Bearer。番付から自分を消す。指定なしは全部。アカウント削除でも全部消える）
// ／ GET /ranking/prize（Bearer。先週と先々週の、コースごとの全体の週間番付で一位だったか → {wins:[{week, course}]}。番付一位の引換券。クラス番付は対象外）
const MAX_CHARS = 512 * 1024;            // 1人分のセーブの上限
const TOKEN_TTL = 60 * 60 * 24 * 180;    // ログインの有効期限: 180日
const USER_RE = /^[A-Za-z0-9_\-ぁ-ゖァ-ヺー一-鿿々]{3,16}$/;

// ---- 番付 ----
// ゲームの斬と同じ決まり（index.html の zanWindows・ZAN_POINTS・ZAN_CRIT・コンボ倍率・殿様・イタズラ・修行の心得）。ゲームを変えたらここも直す。
const RANK_TOP = 50;                         // 1つの番付に載せる人数
const RANK_WEEK_TTL = 60 * 60 * 24 * 21;     // 週間の番付は3週間で消える
const RANK_NAME_MAX = 12;                    // 表示名（ゲームの PROFILE_NAME_MAX）
const RANK_DEFAULT_NAME = 'ななしの職人';
const RANK_COURSES = {                        // 曲ごとの判定の数（同時切りまで・タメ切りは2）
  nihachi: {charts: {'nihachi': 76, 'nihachi.shin': 86}},
  juwari:  {charts: {'juwari': 104, 'juwari.shin': 103}},
  arabiki: {charts: {'arabiki': 128, 'arabiki.shin': 134}},
  uchihiki:{charts: {'uchihiki': 112}, alwaysTrick: true}
};
const RANK_WIN = {crit: 10, perfect: 35, ok: 80};          // 判定の幅（ms・全コース共通）。極・一閃は ±10
const RANK_WIN_STRICT = {crit: 7, perfect: 15, ok: 40};    // 修行の心得「極・判定」
const RANK_SPEED_MULT = {'1': 1, '1.2': 1.1, '1.5': 1.2};  // 修行の心得「速切り」の倍率（極・判定・心眼は ×1.1）
// クラス番付（合言葉）: 同じ合言葉の人だけの番付。合言葉はプレイヤーが決める4〜16文字（ひらがな・カタカナ・漢字・英字・数字・ー）。
// 全角／半角・大文字／小文字は同じに扱う（NFKC のあと大文字。ゲームの rankGroupOf と同じ）。誰が入ったかは本人の記録を消すためにだけ覚える
const GROUP_RE = /^[0-9A-Zぁ-ゖァ-ヺー一-鿿々]{4,16}$/;
const RANK_GROUP_TTL = 60 * 60 * 24 * 180;   // 合言葉の全期間の番付は、最後の記録から180日で消える
const RANK_GROUPS_MAX = 5;                    // 1人が覚えておく合言葉の数（古いものから忘れる。その番付は期限で消える）
function groupOf(v) {
  if (typeof v !== 'string' || v.length > 64) return '';
  const t = v.trim().normalize('NFKC').toUpperCase();
  return GROUP_RE.test(t) ? t : '';
}
const RANK_POINTS = [[100, 50], [50, 25], [300, 150]];   // [通常, タメの頭, タメの斬] の [Perfect, OK]
const RANK_GRADES = [['極上', 95, true], ['特上', 85, false], ['上', 70, false], ['並', 0, false]];
// 判定の記録 judges: [[拍×4, ずれms|null, 種類 0/1/2, 判定 0 Perfect・1 OK・2 Miss・3 フェイントにつられた, 殿様 0/1], …]（ゲームで起きた順）
function rankCheck(b) {
  const c = RANK_COURSES[b.course];
  if (!c || typeof b.chart !== 'string' || !(b.chart in c.charts) || !Array.isArray(b.judges) || b.judges.length > 400) return null;
  const trick = b.trick === true;
  if (c.alwaysTrick && !trick) return null;
  const m = b.mods === undefined ? {speed: 1, strict: false, blind: false} : b.mods;
  if (!m || typeof m !== 'object' || !(String(m.speed) in RANK_SPEED_MULT) || typeof m.strict !== 'boolean' || typeof m.blind !== 'boolean') return null;
  const mods = {speed: [1, 1.2, 1.5].find(v => v === m.speed), strict: m.strict, blind: m.blind};
  if (mods.speed === undefined) return null;
  const w = mods.strict ? RANK_WIN_STRICT : RANK_WIN;
  const modMult = RANK_SPEED_MULT[String(mods.speed)] * (mods.strict ? 1.1 : 1) * (mods.blind ? 1.1 : 1);   // ゲームの zanModMult と同じ順
  let combo = 0, maxCombo = 0, score = 0, perfect = 0, ok = 0, miss = 0, n = 0, tono = 0;
  for (const j of b.judges) {
    if (!Array.isArray(j) || j.length < 5) return null;
    const [q, err, kind, rating, tn] = j;
    if (!Number.isInteger(q) || q < 0 || q > 4000 || q % 2 !== 0) return null;     // 拍は半拍の上だけ
    if (![0, 1, 2].includes(kind) || ![0, 1, 2, 3].includes(rating) || ![0, 1].includes(tn)) return null;
    if (rating === 3) { if (!trick) return null; combo = 0; continue; }           // つられた: コンボが切れるだけ
    n++;
    if (rating === 2) { if (err !== null) return null; miss++; combo = 0; continue; }
    if (typeof err !== 'number' || !Number.isInteger(err) || Math.abs(err) > (rating === 0 ? w.perfect : w.ok)) return null;
    if (rating === 0) perfect++; else ok++;
    combo++; maxCombo = Math.max(maxCombo, combo);
    if (tn) tono++;
    const base = RANK_POINTS[kind][rating] * (rating === 0 && Math.abs(err) <= w.crit ? 1.5 : 1);   // 極・一閃 ×1.5
    const mult = 1 + Math.min(1, Math.floor(combo / 10) * 0.1) + (tn ? 0.2 : 0);
    score += Math.round(base * mult * (trick ? 1.2 : 1) * modMult);
  }
  if (n !== c.charts[b.chart]) return null;                                       // どの印もちょうど1回ずつ判定される
  if (tono > (perfect + ok) * 0.4) return null;                                    // 殿様の倍率は、全部Perfectが続いたあとの短いあいだだけ
  if (score !== b.score || maxCombo !== b.combo || perfect !== b.perfect) return null;
  const acc = Math.round((perfect + ok * 0.5) * 100 / n);
  const grade = RANK_GRADES.find(g => acc >= g[1] && (!g[2] || miss === 0))[0];
  return {score, grade, perfect, combo: maxCombo, trick, mods};
}
function rankName(v) {
  const s = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, RANK_NAME_MAX) : '';
  return s || RANK_DEFAULT_NAME;
}
// 週の区切りは日本時間の月曜（その日付が週の名前）
function rankWeek(now, back = 0) {
  const d = new Date(now + 9 * 3600 * 1000 - back * 7 * 86400 * 1000);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
async function rankUid(key) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('rank|' + key))).slice(0, 20); }
async function rankRead(env, k) { const a = await env.DB.get(k, 'json'); return Array.isArray(a) ? a : []; }
// その人の行を1つにして（よいほうを残す）、得点の高い順に RANK_TOP 人まで
async function rankPut(env, k, entry, ttl) {
  const list = await rankRead(env, k), i = list.findIndex(e => e.uid === entry.uid);
  if (i >= 0) { if (list[i].score >= entry.score) { if (list[i].name === entry.name) return; entry = {...list[i], name: entry.name}; } list.splice(i, 1); }
  list.push(entry);
  list.sort((a, b) => b.score - a.score || a.at - b.at);
  const top = list.slice(0, RANK_TOP);
  if (!top.includes(entry) && i < 0) return;
  await env.DB.put(k, JSON.stringify(top), ttl ? {expirationTtl: ttl} : undefined);
}
// scope: 'all'（全部）・'global'（全体の番付だけ）・合言葉（そのクラス番付だけ）
async function rankRemove(env, uid, scope = 'all') {
  const now = Date.now(), groups = await rankRead(env, 'rankg:' + uid);
  const targets = [];                                                     // [key の頭, 全期間の TTL]
  if (scope === 'all' || scope === 'global') targets.push(['rank:%c', undefined]);
  for (const g of scope === 'all' ? groups : groupOf(scope) ? [scope] : []) targets.push(['rank:%c:g:' + g, RANK_GROUP_TTL]);
  for (const course of Object.keys(RANK_COURSES)) {
    for (const [head, allTtl] of targets) {
      const base = head.replace('%c', course);
      for (const [k, ttl] of [[base + ':all', allTtl], [base + ':w' + rankWeek(now), RANK_WEEK_TTL], [base + ':w' + rankWeek(now, 1), RANK_WEEK_TTL]]) {
        const list = await rankRead(env, k), rest = list.filter(e => e.uid !== uid);
        if (rest.length !== list.length) await env.DB.put(k, JSON.stringify(rest), ttl ? {expirationTtl: ttl} : undefined);
      }
    }
  }
  if (scope === 'all') await env.DB.delete('rankg:' + uid);
  else if (groupOf(scope)) {
    const rest = groups.filter(g => g !== scope);
    if (rest.length) await env.DB.put('rankg:' + uid, JSON.stringify(rest)); else await env.DB.delete('rankg:' + uid);
  }
}
// ---- 番付の置き場（D1） ----
// D1（バインド名 RANKDB）があると、番付を「1人1行」で持つ。行ごとに書き足すので、同じ時に何人が送っても、ほかの人の行は消えない。
// KV の番付は1つのリストを「読む→自分を足す→書き戻す」ので、ほぼ同時に送られると後の書き戻しが先の人を消してしまう
// （クラスで一斉に遊ぶと起きる。KV は読んだ値が最大60秒古いこともある）。RANKDB がない間は、これまでどおり KV のリストを使う。
// KV にある記録は、その番付を D1 で初めて開いたときに一度だけ写す（imp:<番付>）。番付の名前は <コース>:all・<コース>:w<週>・
// <コース>:g:<合言葉>:all・<コース>:g:<合言葉>:w<週>（KV のキーは 'rank:' + 番付）。
const RANK_DDL = [
  'CREATE TABLE IF NOT EXISTS rank (board TEXT NOT NULL, uid TEXT NOT NULL, name TEXT NOT NULL, score INTEGER NOT NULL, grade TEXT, perfect INTEGER, combo INTEGER, trick INTEGER, mods TEXT, at INTEGER NOT NULL, exp INTEGER, PRIMARY KEY (board, uid))',
  'CREATE INDEX IF NOT EXISTS rank_top ON rank (board, score DESC, at)',
  'CREATE TABLE IF NOT EXISTS rank_meta (k TEXT PRIMARY KEY, v TEXT)'
];
let rankDdl = null;
const rankImported = new Set();
async function rankDb(env) {
  if (!env.RANKDB) return null;
  if (!rankDdl) rankDdl = env.RANKDB.batch(RANK_DDL.map(q => env.RANKDB.prepare(q))).catch(e => { rankDdl = null; throw e; });
  await rankDdl;
  return env.RANKDB;
}
// 週の番付は3週間、合言葉の全期間は最後の記録から180日、全体の全期間は消えない（秒）
function rankBoardTtl(board) { return /:w[0-9-]+$/.test(board) ? RANK_WEEK_TTL : board.includes(':g:') ? RANK_GROUP_TTL : 0; }
async function rankImport(db, env, board) {
  if (rankImported.has(board)) return;
  if (!(await db.prepare('SELECT v FROM rank_meta WHERE k = ?').bind('imp:' + board).first('v'))) {
    const ttl = rankBoardTtl(board), list = (await rankRead(env, 'rank:' + board)).filter(e => e && typeof e.uid === 'string' && Number.isFinite(e.score));
    const st = list.map(e => db.prepare('INSERT OR IGNORE INTO rank (board, uid, name, score, grade, perfect, combo, trick, mods, at, exp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(board, e.uid, rankName(e.name), Math.floor(e.score), String(e.grade || ''), e.perfect | 0, e.combo | 0, e.trick ? 1 : 0, e.mods ? JSON.stringify(e.mods) : null, e.at || 0, ttl ? (e.at || Date.now()) + ttl * 1000 : null));
    st.push(db.prepare('INSERT OR IGNORE INTO rank_meta (k, v) VALUES (?, ?)').bind('imp:' + board, String(Date.now())));
    await db.batch(st);
  }
  rankImported.add(board);
}
// その人の行を、よいほうの記録で残す（名前と期限はいつも新しく）
async function rankPutDb(db, env, board, entry) {
  await rankImport(db, env, board);
  const ttl = rankBoardTtl(board), exp = ttl ? entry.at + ttl * 1000 : null;
  await db.batch([
    db.prepare('INSERT INTO rank (board, uid, name, score, grade, perfect, combo, trick, mods, at, exp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT (board, uid) DO UPDATE SET score = excluded.score, grade = excluded.grade, perfect = excluded.perfect, combo = excluded.combo, ' +
      'trick = excluded.trick, mods = excluded.mods, at = excluded.at WHERE excluded.score > rank.score')
      .bind(board, entry.uid, entry.name, entry.score, entry.grade, entry.perfect, entry.combo, entry.trick ? 1 : 0, entry.mods ? JSON.stringify(entry.mods) : null, entry.at, exp),
    db.prepare('UPDATE rank SET name = ?, exp = ? WHERE board = ? AND uid = ?').bind(entry.name, exp, board, entry.uid)
  ]);
}
async function rankTopDb(db, env, board) {
  await rankImport(db, env, board);
  const r = await db.prepare('SELECT uid, name, score, grade, perfect, combo, trick, mods FROM rank WHERE board = ? AND (exp IS NULL OR exp > ?) ORDER BY score DESC, at ASC LIMIT ?')
    .bind(board, Date.now(), RANK_TOP).all();
  return (r.results || []).map(e => { let mods = null; try { mods = e.mods ? JSON.parse(e.mods) : null; } catch (x) {} return {...e, trick: !!e.trick, mods}; });
}
// scope: 'all'（全部）・'global'（全体の番付だけ）・合言葉（そのクラス番付だけ）
async function rankRemoveDb(db, uid, scope) {
  if (scope === 'all') await db.prepare('DELETE FROM rank WHERE uid = ?').bind(uid).run();
  else if (scope === 'global') await db.prepare("DELETE FROM rank WHERE uid = ? AND board NOT LIKE '%:g:%'").bind(uid).run();
  else await db.prepare('DELETE FROM rank WHERE uid = ? AND board LIKE ?').bind(uid, '%:g:' + scope + ':%').run();
}
async function sessionKey(req, env) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get('Authorization') || '');
  return m ? await env.DB.get('tok:' + m[1]) : null;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};
// 想定内の失敗（パスワード違いなど）は 200 と {ok:false} で返す（ブラウザのコンソールを汚さないため）
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {status, headers: {...CORS, 'Content-Type': 'application/json; charset=utf-8'}});
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const randomHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));

// ゲームから届くのは SHA-256 済みの値。サーバーでは塩を足して PBKDF2 でもう一度ハッシュ化して保存する
async function slowHash(clientHash, saltHex) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(clientHash), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000}, key, 256));
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function issueToken(env, key) {
  const token = randomHex(32);
  await env.DB.put('tok:' + token, key, {expirationTtl: TOKEN_TTL});
  return token;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: CORS});
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    try {
      if (req.method === 'POST' && (path === '/register' || path === '/login')) {
        const body = await req.json().catch(() => null);
        const user = body && typeof body.user === 'string' ? body.user : '';
        const hash = body && typeof body.hash === 'string' ? body.hash : '';
        if (!USER_RE.test(user) || !/^[0-9a-f]{64}$/.test(hash)) return json({ok: false, error: 'auth'}, 400);
        const key = 'user:' + user.toLowerCase();
        const rec = await env.DB.get(key, 'json');
        if (path === '/register') {
          if (rec) return json({ok: false, error: 'taken'});
          const salt = randomHex(16);
          await env.DB.put(key, JSON.stringify({name: user, salt, hash: await slowHash(hash, salt), data: null, updatedAt: 0}));
          return json({ok: true, user, token: await issueToken(env, key)});
        }
        if (!rec || !same(await slowHash(hash, rec.salt), rec.hash)) return json({ok: false, error: 'auth'});
        return json({ok: true, user: rec.name, token: await issueToken(env, key)});
      }
      if (path === '/save' && (req.method === 'GET' || req.method === 'PUT')) {
        const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get('Authorization') || '');
        const key = m ? await env.DB.get('tok:' + m[1]) : null;
        const rec = key ? await env.DB.get(key, 'json') : null;
        if (!rec) return json({ok: false, error: 'session'});
        if (req.method === 'GET') return json({ok: true, data: rec.data, updatedAt: rec.updatedAt});
        const text = await req.text();
        if (text.length > MAX_CHARS) return json({ok: false, error: 'storage'}, 413);
        let body = null;
        try { body = JSON.parse(text); } catch (e) {}
        if (!body || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return json({ok: false, error: 'storage'}, 400);
        rec.data = body.data;
        rec.updatedAt = Date.now();
        await env.DB.put(key, JSON.stringify(rec));
        return json({ok: true, updatedAt: rec.updatedAt});
      }
      if (path === '/ranking/prize' && req.method === 'GET') {
        // 番付一位の引換券：終わった週（先週・先々週）の、全体の週間番付の一位。同点は先に出した人（番付の並びと同じ）
        const key = await sessionKey(req, env), rec = key ? await env.DB.get(key, 'json') : null;
        if (!rec) return json({ok: false, error: 'session'});
        const uid = await rankUid(key), now = Date.now(), db = await rankDb(env), wins = [];
        for (const back of [1, 2]) {
          const week = rankWeek(now, back);
          for (const course of Object.keys(RANK_COURSES)) {
            const board = course + ':w' + week;
            let top = null;
            if (db) {
              await rankImport(db, env, board);
              top = await db.prepare('SELECT uid FROM rank WHERE board = ? ORDER BY score DESC, at ASC LIMIT 1').bind(board).first('uid');
            } else {
              const list = await rankRead(env, 'rank:' + board);
              top = list[0] ? list[0].uid : null;
            }
            if (top === uid) wins.push({week, course});
          }
        }
        return json({ok: true, wins});
      }
      if (path === '/ranking' && req.method === 'GET') {
        const q = new URL(req.url).searchParams, course = q.get('course') || '', period = q.get('period') === 'all' ? 'all' : 'week';
        const group = q.has('group') ? groupOf(q.get('group')) : '';
        if (!RANK_COURSES[course] || (q.has('group') && !group)) return json({ok: false, error: 'notfound'}, 404);
        const week = rankWeek(Date.now()), key = await sessionKey(req, env), me = key ? await rankUid(key) : '';
        const board = course + (group ? ':g:' + group : '') + ':' + (period === 'all' ? 'all' : 'w' + week), db = await rankDb(env);
        const list = db ? await rankTopDb(db, env, board) : await rankRead(env, 'rank:' + board);
        return json({ok: true, course, period, week, group, entries: list.map((e, i) => ({rank: i + 1, name: e.name, score: e.score, grade: e.grade, perfect: e.perfect, combo: e.combo, trick: e.trick, mods: e.mods || null, me: e.uid === me}))});
      }
      if (path === '/ranking' && (req.method === 'POST' || req.method === 'DELETE')) {
        const key = await sessionKey(req, env), rec = key ? await env.DB.get(key, 'json') : null;
        if (!rec) return json({ok: false, error: 'session'});
        const uid = await rankUid(key);
        if (req.method === 'DELETE') {
          const q = new URL(req.url).searchParams, scope = q.get('scope') === 'global' ? 'global' : q.has('group') ? groupOf(q.get('group')) : 'all';
          if (!scope) return json({ok: false, error: 'notfound'}, 404);
          const db = await rankDb(env);
          if (db) await rankRemoveDb(db, uid, scope);
          await rankRemove(env, uid, scope);                                  // (KV にまだ残っている古い番付からも)
          return json({ok: true});
        }
        const text = await req.text();
        if (text.length > 32 * 1024) return json({ok: false, error: 'storage'}, 413);
        let body = null;
        try { body = JSON.parse(text); } catch (e) {}
        const r = body && typeof body === 'object' ? rankCheck(body) : null;
        if (!r) return json({ok: false, error: 'rejected'});
        const pub = body.pub !== false, group = body.group === undefined ? '' : groupOf(body.group);
        if ((body.group !== undefined && !group) || (!pub && !group)) return json({ok: false, error: 'rejected'});
        const now = Date.now(), entry = {uid, name: rankName(body.name), ...r, at: now}, db = await rankDb(env);
        if (db) {                                                             // 1人1行（重なっても、ほかの人は消えない）
          const boards = [].concat(pub ? [body.course + ':all', body.course + ':w' + rankWeek(now)] : [],
            group ? [body.course + ':g:' + group + ':all', body.course + ':g:' + group + ':w' + rankWeek(now)] : []);
          for (const b of boards) await rankPutDb(db, env, b, {...entry});
          await db.prepare('DELETE FROM rank WHERE exp IS NOT NULL AND exp < ?').bind(now).run();   // (期限の切れた行を片づける)
          return json({ok: true});
        }
        if (pub) {
          await rankPut(env, 'rank:' + body.course + ':all', {...entry});
          await rankPut(env, 'rank:' + body.course + ':w' + rankWeek(now), {...entry}, RANK_WEEK_TTL);
        }
        if (group) {                                                          // クラス番付
          await rankPut(env, 'rank:' + body.course + ':g:' + group + ':all', {...entry}, RANK_GROUP_TTL);
          await rankPut(env, 'rank:' + body.course + ':g:' + group + ':w' + rankWeek(now), {...entry}, RANK_WEEK_TTL);
          const gs = (await rankRead(env, 'rankg:' + uid)).filter(g => g !== group).concat([group]).slice(-RANK_GROUPS_MAX);
          await env.DB.put('rankg:' + uid, JSON.stringify(gs));
        }
        return json({ok: true});
      }
      if (path === '/account' && req.method === 'DELETE') {
        // アカウントの削除: ログイン中のトークンと、もう一度入力されたパスワードの両方が合ったときだけ
        const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get('Authorization') || '');
        const key = m ? await env.DB.get('tok:' + m[1]) : null;
        const rec = key ? await env.DB.get(key, 'json') : null;
        if (!rec) return json({ok: false, error: 'session'});
        const body = await req.json().catch(() => null);
        const hash = body && typeof body.hash === 'string' ? body.hash : '';
        if (!/^[0-9a-f]{64}$/.test(hash) || !same(await slowHash(hash, rec.salt), rec.hash)) return json({ok: false, error: 'auth'});
        const rdb = await rankDb(env), ruid = await rankUid(key);
        if (rdb) await rankRemoveDb(rdb, ruid, 'all');  // 番付からも消す
        await rankRemove(env, ruid);
        await env.DB.delete(key);
        await env.DB.delete('tok:' + m[1]);
        return json({ok: true});
      }
      return json({ok: false, error: 'notfound'}, 404);
    } catch (e) {
      return json({ok: false, error: 'offline'}, 500);
    }
  }
};

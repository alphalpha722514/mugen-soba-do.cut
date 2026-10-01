// 無限そば道・斬 同期サーバー（Cloudflare Workers + KV。KV のバインド名は DB）
// 公開中: https://soba-sync.yfhmbvzk72.workers.dev （Cloudflare の Worker「soba-sync」の「コードを編集」に、この中身を貼って「デプロイ」）
// POST /register・/login {user, hash} → {ok, user, token} ／ GET・PUT /save（Bearer トークン） ／ DELETE /account {hash}
const MAX_CHARS = 512 * 1024;            // 1人分のセーブの上限
const TOKEN_TTL = 60 * 60 * 24 * 180;    // ログインの有効期限: 180日
const USER_RE = /^[A-Za-z0-9_\-ぁ-ゖァ-ヺー一-鿿々]{3,16}$/;

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
      if (path === '/account' && req.method === 'DELETE') {
        // アカウントの削除: ログイン中のトークンと、もう一度入力されたパスワードの両方が合ったときだけ
        const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get('Authorization') || '');
        const key = m ? await env.DB.get('tok:' + m[1]) : null;
        const rec = key ? await env.DB.get(key, 'json') : null;
        if (!rec) return json({ok: false, error: 'session'});
        const body = await req.json().catch(() => null);
        const hash = body && typeof body.hash === 'string' ? body.hash : '';
        if (!/^[0-9a-f]{64}$/.test(hash) || !same(await slowHash(hash, rec.salt), rec.hash)) return json({ok: false, error: 'auth'});
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

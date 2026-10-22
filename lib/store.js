// Depo. Üretimde Upstash Redis (varsa), yoksa Vercel Blob (private); testte bellek içi.
// Arayüz: read, create, write (etag ile), remove, recent ve genel JSON deposu (kv*).
import { get, put, list, del, BlobPreconditionFailedError } from '@vercel/blob';
import { Redis } from '@upstash/redis';
import { createClient } from 'redis';

const pathOf = (code) => `rooms/${code}.json`;

export const blobStore = {
  async read(code) {
    const r = await get(pathOf(code), { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    const room = JSON.parse(await new Response(r.stream).text());
    return { room, etag: r.blob.etag };
  },
  async create(code, room) {
    try {
      await put(pathOf(code), JSON.stringify(room), {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: false,
      });
      return true;
    } catch (e) {
      if (/already exists/i.test(String(e && e.message))) return false;
      throw e;
    }
  },
  async write(code, room, etag) {
    try {
      await put(pathOf(code), JSON.stringify(room), {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
        ifMatch: etag,
      });
      return true;
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) return false;
      throw e;
    }
  },
  async remove(code) {
    try { await del(pathOf(code)); } catch { /* zaten yok */ }
  },
  // Genel JSON deposu (hesaplar, oturumlar, ayarlar)
  async kvGet(path) {
    const r = await get(path, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return { data: JSON.parse(await new Response(r.stream).text()), etag: r.blob.etag };
  },
  async kvCreate(path, data) {
    try {
      await put(path, JSON.stringify(data), {
        access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false,
      });
      return true;
    } catch (e) {
      if (/already exists/i.test(String(e && e.message))) return false;
      throw e;
    }
  },
  async kvWrite(path, data, etag) {
    try {
      await put(path, JSON.stringify(data), {
        access: 'private', contentType: 'application/json', addRandomSuffix: false,
        allowOverwrite: true, ifMatch: etag,
      });
      return true;
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) return false;
      throw e;
    }
  },
  async kvDel(path) {
    try { await del(path); } catch { /* zaten yok */ }
  },
  async kvList(prefix) {
    const out = [];
    let cursor;
    do {
      const r = await list({ prefix, limit: 1000, cursor });
      for (const b of r.blobs) out.push(b.pathname);
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return out;
  },
  async recent(n) {
    const r = await list({ prefix: 'rooms/', limit: 100 });
    return r.blobs
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .slice(0, n)
      .map((b) => b.pathname.slice('rooms/'.length, -'.json'.length));
  },
};


// ---------- Upstash Redis ----------
// etag = değerin kendisi (ham JSON metni); yazma, Lua ile "hâlâ aynı mı?" denetimiyle yapılır.
const TTL = [['rooms/', 12 * 3600], ['sessions/', 31 * 24 * 3600], ['rtc/', 3 * 3600]];
const ttlOf = (path) => (TTL.find(([p]) => path.startsWith(p)) || [0, 0])[1];
const CAS = `local cur = redis.call('GET', KEYS[1])
if cur == ARGV[1] then
  if tonumber(ARGV[3]) > 0 then redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]) else redis.call('SET', KEYS[1], ARGV[2]) end
  return 1
end
return 0`;
const ROOM_INDEX = 'idx:rooms';

export function redisStore(redis) {
  const roomKey = pathOf;
  const getRaw = async (key) => {
    const v = await redis.get(key);
    return v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));
  };
  const create = async (key, data) => {
    const ttl = ttlOf(key);
    const r = ttl ? await redis.set(key, JSON.stringify(data), { nx: true, ex: ttl }) : await redis.set(key, JSON.stringify(data), { nx: true });
    return r === 'OK';
  };
  const cas = async (key, data, etag) => (await redis.eval(CAS, [key], [etag, JSON.stringify(data), String(ttlOf(key))])) === 1;
  return {
    async read(code) {
      const raw = await getRaw(roomKey(code));
      return raw ? { room: JSON.parse(raw), etag: raw } : null;
    },
    async create(code, room) {
      if (!(await create(roomKey(code), room))) return false;
      await redis.zadd(ROOM_INDEX, { score: Date.now(), member: code });
      return true;
    },
    async write(code, room, etag) {
      if (!(await cas(roomKey(code), room, etag))) return false;
      await redis.zadd(ROOM_INDEX, { score: Date.now(), member: code });
      return true;
    },
    async remove(code) {
      await redis.del(roomKey(code));
      await redis.zrem(ROOM_INDEX, code);
    },
    async kvGet(path) {
      const raw = await getRaw(path);
      return raw ? { data: JSON.parse(raw), etag: raw } : null;
    },
    kvCreate: create,
    kvWrite: cas,
    async kvDel(path) { await redis.del(path); },
    async kvList(prefix) {
      const out = [];
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, { match: prefix.replace(/[*?[\]\\]/g, '\\$&') + '*', count: 500 });
        out.push(...keys);
        cursor = String(next);
      } while (cursor !== '0');
      return out;
    },
    async recent(n) {
      await redis.zremrangebyscore(ROOM_INDEX, 0, Date.now() - 12 * 3600_000);
      return redis.zrange(ROOM_INDEX, 0, n - 1, { rev: true });
    },
  };
}

// Standart Redis (TCP, REDIS_URL): redisStore'un beklediği küçük arayüze uyarlanır.
export function nodeRedis(url) {
  const client = createClient({ url, socket: { connectTimeout: 5000, reconnectStrategy: (n) => Math.min(n * 100, 2000) } });
  client.on('error', () => { /* bağlantı hataları çağrıda fırlatılır */ });
  let ready;
  const conn = () => (ready ??= client.connect().then(() => client).catch((e) => { ready = undefined; throw e; }));
  return {
    async get(k) { return (await conn()).get(k); },
    async set(k, v, o = {}) {
      const opts = {};
      if (o.nx) opts.condition = 'NX';
      if (o.ex) opts.expiration = { type: 'EX', value: o.ex };
      return (await conn()).set(k, v, opts);
    },
    async eval(script, keys, args) { return (await conn()).eval(script, { keys, arguments: args }); },
    async del(k) { return (await conn()).del(k); },
    async zadd(k, { score, member }) { return (await conn()).zAdd(k, { score, value: member }); },
    async zrem(k, m) { return (await conn()).zRem(k, m); },
    async zremrangebyscore(k, a, b) { return (await conn()).zRemRangeByScore(k, a, b); },
    async zrange(k, a, b, o) { return (await conn()).zRange(k, a, b, o && o.rev ? { REV: true } : undefined); },
    async scan(cursor, { match, count }) { const r = await (await conn()).scan(cursor, { MATCH: match, COUNT: count }); return [r.cursor, r.keys]; },
    async quit() { if (client.isOpen) await client.quit(); },
  };
}

let sharedRedis;
function redisFromEnv() {
  if (sharedRedis) return sharedRedis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return (sharedRedis = redisStore(new Redis({ url, token, automaticDeserialization: false })));
  const tcp = process.env.REDIS_URL;
  if (tcp) return (sharedRedis = redisStore(nodeRedis(tcp)));
  return null;
}

export function memoryStore() {
  const m = new Map();
  const k = new Map();
  let v = 0;
  return {
    async read(code) {
      const e = m.get(code);
      return e ? { room: JSON.parse(e.body), etag: String(e.v) } : null;
    },
    async create(code, room) {
      if (m.has(code)) return false;
      m.set(code, { body: JSON.stringify(room), v: ++v, at: Date.now() });
      return true;
    },
    async write(code, room, etag) {
      const e = m.get(code);
      if (!e || String(e.v) !== etag) return false;
      m.set(code, { body: JSON.stringify(room), v: ++v, at: Date.now() });
      return true;
    },
    async remove(code) { m.delete(code); },
    async kvGet(path) {
      const e = k.get(path);
      return e ? { data: JSON.parse(e.body), etag: String(e.v) } : null;
    },
    async kvCreate(path, data) {
      if (k.has(path)) return false;
      k.set(path, { body: JSON.stringify(data), v: ++v });
      return true;
    },
    async kvWrite(path, data, etag) {
      const e = k.get(path);
      if (!e || String(e.v) !== etag) return false;
      k.set(path, { body: JSON.stringify(data), v: ++v });
      return true;
    },
    async kvDel(path) { k.delete(path); },
    async kvList(prefix) { return [...k.keys()].filter((x) => x.startsWith(prefix)); },
    async recent(n) {
      return [...m.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, n).map(([c]) => c);
    },
  };
}

let shared;
export function getStore() {
  if (process.env.KM_STORE === 'memory') return (shared ??= memoryStore());
  return redisFromEnv() || blobStore;
}

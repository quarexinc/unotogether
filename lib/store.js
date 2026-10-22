// Oda deposu. Üretimde Vercel Blob (private), testte bellek içi.
// Arayüz: read, create, write (etag ile), remove, recent.
import { get, put, list, del, BlobPreconditionFailedError } from '@vercel/blob';

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
  async recent(n) {
    const r = await list({ prefix: 'rooms/', limit: 100 });
    return r.blobs
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .slice(0, n)
      .map((b) => b.pathname.slice('rooms/'.length, -'.json'.length));
  },
};

export function memoryStore() {
  const m = new Map();
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
    async recent(n) {
      return [...m.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, n).map(([c]) => c);
    },
  };
}

let shared;
export function getStore() {
  if (process.env.KM_STORE === 'memory') return (shared ??= memoryStore());
  return blobStore;
}

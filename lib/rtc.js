// Oda içi sesli/görüntülü konuşma için WebRTC sinyalleşmesi.
// Medya sunucudan geçmez; tarayıcılar birbirine doğrudan bağlanır (mesh). Burada yalnızca
// teklif/cevap (SDP) mesajları ve "kim konuşmada" listesi tutulur. Depodan bağımsızdır (store.kv*).
import crypto from 'node:crypto';
import { HttpError, fail, sleep } from './errors.js';
import { requirePermForUid, getSettings } from './accounts.js';

export const MAX_PEERS = 8; // mesh olduğu için sınırlı: herkes herkese bağlanır
const MSG_TTL_MS = 60_000; // okunmamış sinyal bu süre sonra atılır
const MSG_KEEP = 40;
const PEER_STALE_MS = 45_000; // bu süredir nabız atmayan kişi konuşmadan düşer
const MAX_SDP = 16_000;
const TYPES = ['offer', 'answer', 'bye'];

const cleanCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
const cleanPid = (s) => String(s ?? '').replace(/[^a-f0-9]/g, '').slice(0, 12);
const peersPath = (code) => `rtc/${code}/peers.json`;
const inboxPath = (code, pid) => `rtc/${code}/in-${pid}.json`;

function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Okuma-değiştirme-yazma (etag çakışmasında yeniden dener).
async function rmw(store, path, fallback, fn, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const cur = await store.kvGet(path);
    const data = cur ? cur.data : structuredClone(fallback);
    const out = fn(data);
    if (out === false) return null; // değişiklik gerekmiyor
    const ok = cur ? await store.kvWrite(path, data, cur.etag) : await store.kvCreate(path, data);
    if (ok) return data;
    await sleep(25 + Math.random() * 75);
  }
  throw fail(409, 'busy');
}

async function roomPlayer(store, code, pid, key) {
  const cur = await store.read(code);
  if (!cur) throw fail(404, 'not_found');
  const p = cur.room.players.find((q) => q.id === pid);
  if (!p || !safeEqual(p.key, key)) throw fail(403, 'forbidden');
  return p;
}

// Gelen kutusunun sahibini doğrular (oda dokümanını her seferinde okumamak için).
async function inboxOwner(store, code, pid, key) {
  const cur = await store.kvGet(inboxPath(code, pid));
  if (!cur || !safeEqual(cur.data.key, key)) throw fail(403, 'forbidden');
  return cur;
}

function iceServers(settings) {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (settings.turnUrl) {
    list.push({ urls: settings.turnUrl.split(/\s+/), username: settings.turnUser, credential: settings.turnPass });
  }
  return list;
}

const livePeers = (peers, now) => Object.entries(peers)
  .filter(([, v]) => now - v.beat < PEER_STALE_MS)
  .map(([pid, v]) => ({ pid, name: v.name, av: v.av, joined: v.joined, mic: !!v.mic, cam: !!v.cam }));

async function join(store, b) {
  const code = cleanCode(b.code);
  const pid = cleanPid(b.pid);
  const p = await roomPlayer(store, code, pid, b.key);
  await requirePermForUid(store, p.uid, 'media');
  const settings = await getSettings(store);
  const now = Date.now();
  let full = false;
  const peers = await rmw(store, peersPath(code), {}, (d) => {
    for (const [k, v] of Object.entries(d)) if (now - v.beat >= PEER_STALE_MS) delete d[k];
    if (!d[pid] && Object.keys(d).length >= MAX_PEERS) { full = true; return false; }
    d[pid] = { name: p.name, av: p.av, joined: now, beat: now, mic: !!b.mic, cam: !!b.cam };
  });
  if (full) throw fail(409, 'call_full');
  // Gelen kutusunu sıfırla (eski oturumdan kalan sinyaller karışmasın).
  const path = inboxPath(code, pid);
  const old = await store.kvGet(path);
  const fresh = { key: p.key, n: 0, msgs: [] };
  if (old) await store.kvWrite(path, fresh, old.etag); else await store.kvCreate(path, fresh);
  return {
    me: { pid, joined: now },
    peers: livePeers(peers, now).filter((x) => x.pid !== pid),
    ice: iceServers(settings),
  };
}

async function poll(store, b) {
  const code = cleanCode(b.code);
  const pid = cleanPid(b.pid);
  const { data } = await inboxOwner(store, code, pid, b.key);
  const since = Number.isInteger(b.since) ? b.since : 0;
  return { msgs: data.msgs.filter((m) => m.i > since), n: data.n };
}

async function send(store, b) {
  const code = cleanCode(b.code);
  const pid = cleanPid(b.pid);
  const to = cleanPid(b.to);
  if (!to || to === pid) throw fail(400, 'to');
  if (!TYPES.includes(b.type)) throw fail(400, 'type');
  const sdp = String(b.data ?? '');
  if (sdp.length > MAX_SDP) throw fail(413, 'too_big');
  await inboxOwner(store, code, pid, b.key);
  const now = Date.now();
  const target = await store.kvGet(inboxPath(code, to));
  if (!target) throw fail(404, 'peer_gone');
  await rmw(store, inboxPath(code, to), { key: '', n: 0, msgs: [] }, (d) => {
    d.n += 1;
    d.msgs = d.msgs.filter((m) => now - m.t < MSG_TTL_MS);
    d.msgs.push({ i: d.n, from: pid, type: b.type, data: sdp, t: now });
    if (d.msgs.length > MSG_KEEP) d.msgs.splice(0, d.msgs.length - MSG_KEEP);
  });
  return { ok: true };
}

async function beat(store, b) {
  const code = cleanCode(b.code);
  const pid = cleanPid(b.pid);
  await inboxOwner(store, code, pid, b.key);
  await roomPlayer(store, code, pid, b.key); // odadan atıldıysa konuşmadan da düşer
  const now = Date.now();
  let present = true;
  const peers = await rmw(store, peersPath(code), {}, (d) => {
    for (const [k, v] of Object.entries(d)) if (now - v.beat >= PEER_STALE_MS) delete d[k];
    if (!d[pid]) { present = false; return false; }
    d[pid].beat = now;
    if (typeof b.mic === 'boolean') d[pid].mic = b.mic;
    if (typeof b.cam === 'boolean') d[pid].cam = b.cam;
  });
  if (!present) throw fail(404, 'not_in_call');
  const list = peers ? livePeers(peers, now) : livePeers((await store.kvGet(peersPath(code)))?.data ?? {}, now);
  return { peers: list.filter((x) => x.pid !== pid) };
}

async function leave(store, b) {
  const code = cleanCode(b.code);
  const pid = cleanPid(b.pid);
  const cur = await store.kvGet(inboxPath(code, pid));
  if (!cur || !safeEqual(cur.data.key, b.key)) return { ok: true }; // zaten yok
  await store.kvDel(inboxPath(code, pid));
  let empty = false;
  await rmw(store, peersPath(code), {}, (d) => {
    delete d[pid];
    empty = Object.keys(d).length === 0;
  });
  if (empty) await store.kvDel(peersPath(code));
  return { ok: true };
}

// Basit IP başına hız sınırı: yoklama sık olduğundan oda API'sinden ayrı tutulur.
const hits = new Map();
function limited(ip, max = 900) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 2000) hits.clear();
  return arr.length > max;
}

export async function handleRtc({ method, body, ip = '', origin = '', host = '' }, store) {
  try {
    if (method !== 'POST') throw fail(405, 'method');
    if (limited(ip)) throw fail(429, 'rate');
    if (origin) {
      let h = '';
      try { h = new URL(origin).host; } catch { /* geçersiz */ }
      if (h !== host) throw fail(403, 'origin');
    }
    let b = body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch { throw fail(400, 'json'); } }
    if (!b || typeof b !== 'object') throw fail(400, 'json');
    switch (b.a) {
      case 'join': return { status: 200, json: await join(store, b) };
      case 'poll': return { status: 200, json: await poll(store, b) };
      case 'send': return { status: 200, json: await send(store, b) };
      case 'beat': return { status: 200, json: await beat(store, b) };
      case 'leave': return { status: 200, json: await leave(store, b) };
      default: throw fail(400, 'action');
    }
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, json: { error: e.code } };
    console.error(e);
    return { status: 500, json: { error: 'server' } };
  }
}

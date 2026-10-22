// Oda mantığı. Depodan bağımsızdır: store.read/create/write/remove/recent kullanır.
import crypto from 'node:crypto';

export const MODES = { standart: 10, parti: 10, hizli: 8 };
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const STALE_MS = 120_000; // bu kadar süredir görünmeyen oyuncu odadan düşer
const ONLINE_MS = 45_000; // bu süre içinde görüldüyse çevrimiçi sayılır
const ROOM_TTL_MS = 3 * 3600_000; // listede gösterilen odaların azami yaşı
const CHAT_KEEP = 50;
const AVATARS = 20;

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, code) => new HttpError(status, code);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function newCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}
const newId = () => crypto.randomBytes(6).toString('hex');
const newKey = () => crypto.randomBytes(16).toString('base64url');

export const cleanName = (s) =>
  String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
const cleanText = (s) =>
  String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
const cleanCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function auth(room, pid, key) {
  const p = room.players.find((q) => q.id === pid);
  if (!p || !safeEqual(p.key, key)) throw fail(403, 'forbidden');
  return p;
}

function sys(room, ev, name, now) {
  room.seq += 1;
  room.chat.push({ id: room.seq, sys: ev, name, t: now });
  if (room.chat.length > CHAT_KEEP) room.chat.splice(0, room.chat.length - CHAT_KEEP);
}

function prune(room, now) {
  const before = room.players.length;
  room.players = room.players.filter((p) => p.seen === now || now - p.seen < STALE_MS);
  if (room.players.length !== before && !room.players.some((p) => p.id === room.hostId)) {
    room.hostId = room.players[0]?.id ?? null;
  }
}

// Okuma-değiştirme-yazma. Çakışma olursa etag ile yeniden dener.
async function mutate(store, code, fn) {
  for (let i = 0; i < 8; i++) {
    const cur = await store.read(code);
    if (!cur) throw fail(404, 'not_found');
    const room = cur.room;
    const now = Date.now();
    const result = fn(room, now);
    prune(room, now);
    if (!room.players.length) {
      await store.remove(code);
      return { room: null, result };
    }
    room.updated = now;
    if (await store.write(code, room, cur.etag)) return { room, result };
    await sleep(30 + Math.random() * 90);
  }
  throw fail(409, 'busy');
}

export function view(room, pid, now = Date.now()) {
  return {
    code: room.code,
    mode: room.mode,
    cap: room.cap,
    status: room.status,
    hostId: room.hostId,
    created: room.created,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      av: p.av,
      host: p.id === room.hostId,
      online: now - p.seen < ONLINE_MS,
    })),
    chat: room.chat,
    inRoom: room.players.some((p) => p.id === pid),
  };
}

function readPlayerInput(body) {
  const name = cleanName(body.name);
  if (!name) throw fail(400, 'name');
  const av = Number.isInteger(body.av) && body.av >= 0 && body.av < AVATARS ? body.av : 0;
  return { name, av };
}

async function createRoom(store, body) {
  const { name, av } = readPlayerInput(body);
  const mode = String(body.mode || 'standart');
  if (!(mode in MODES)) throw fail(400, 'mode');
  const cap = Number(body.cap);
  if (!Number.isInteger(cap) || cap < 2 || cap > MODES[mode]) throw fail(400, 'cap');
  const now = Date.now();
  const player = { id: newId(), key: newKey(), name, av, seen: now, joined: now, lastChat: 0 };
  for (let i = 0; i < 8; i++) {
    const code = newCode();
    const room = {
      code, mode, cap, status: 'waiting', hostId: player.id,
      created: now, updated: now, seq: 0, players: [player], chat: [],
    };
    sys(room, 'join', name, now);
    if (await store.create(code, room)) return { code, pid: player.id, key: player.key };
  }
  throw fail(503, 'code_space');
}

async function joinRoom(store, body) {
  const code = cleanCode(body.code);
  if (code.length !== 5) throw fail(400, 'code');
  const input = body.pid ? null : readPlayerInput(body);
  const { result } = await mutate(store, code, (room, now) => {
    const existing = body.pid ? room.players.find((p) => p.id === body.pid) : null;
    if (existing) {
      auth(room, body.pid, body.key);
      existing.seen = now;
      return { pid: existing.id, key: existing.key };
    }
    const { name, av } = input ?? readPlayerInput(body);
    if (room.status !== 'waiting') throw fail(409, 'started');
    if (room.players.length >= room.cap) throw fail(409, 'full');
    const p = { id: newId(), key: newKey(), name, av, seen: now, joined: now, lastChat: 0 };
    room.players.push(p);
    sys(room, 'join', name, now);
    return { pid: p.id, key: p.key };
  });
  return { code, ...result };
}

async function act(store, body) {
  const code = cleanCode(body.code);
  const action = body.action;
  const { room, result } = await mutate(store, code, (r, now) => {
    const me = auth(r, body.pid, body.key);
    me.seen = now;
    switch (action) {
      case 'ping':
        return {};
      case 'chat': {
        const text = cleanText(body.text);
        if (!text) throw fail(400, 'text');
        if (now - (me.lastChat || 0) < 600) throw fail(429, 'slow');
        me.lastChat = now;
        r.seq += 1;
        r.chat.push({ id: r.seq, pid: me.id, name: me.name, av: me.av, text, t: now });
        if (r.chat.length > CHAT_KEEP) r.chat.splice(0, r.chat.length - CHAT_KEEP);
        return {};
      }
      case 'leave':
        r.players = r.players.filter((p) => p.id !== me.id);
        if (r.hostId === me.id) r.hostId = r.players[0]?.id ?? null;
        if (r.players.length) sys(r, 'leave', me.name, now);
        return {};
      case 'start':
        if (r.hostId !== me.id) throw fail(403, 'host_only');
        if (r.players.length < 2) throw fail(400, 'need_players');
        r.status = 'ready';
        sys(r, 'start', me.name, now);
        return {};
      case 'reopen':
        if (r.hostId !== me.id) throw fail(403, 'host_only');
        r.status = 'waiting';
        return {};
      case 'kick': {
        if (r.hostId !== me.id) throw fail(403, 'host_only');
        const target = r.players.find((p) => p.id === body.target);
        if (!target || target.id === me.id) throw fail(400, 'target');
        r.players = r.players.filter((p) => p.id !== target.id);
        sys(r, 'kick', target.name, now);
        return {};
      }
      default:
        throw fail(400, 'action');
    }
  });
  return { ok: true, room: room ? view(room, body.pid) : null, ...result };
}

async function getRoom(store, query) {
  const code = cleanCode(query.code);
  if (code.length !== 5) throw fail(400, 'code');
  const cur = await store.read(code);
  if (!cur) throw fail(404, 'not_found');
  return view(cur.room, String(query.pid || ''));
}

async function listRooms(store) {
  const codes = await store.recent(20);
  const now = Date.now();
  const rows = await Promise.all(codes.map((c) => store.read(c).catch(() => null)));
  const rooms = [];
  for (const row of rows) {
    const r = row?.room;
    if (!r || !r.players.length) continue;
    if (now - r.created > ROOM_TTL_MS) continue;
    if (!r.players.some((p) => now - p.seen < ONLINE_MS)) continue;
    rooms.push({
      code: r.code, mode: r.mode, cap: r.cap, n: r.players.length, status: r.status,
      hostName: r.players.find((p) => p.id === r.hostId)?.name ?? '',
    });
  }
  const players = rooms.reduce((s, r) => s + r.n, 0);
  return { rooms, stats: { rooms: rooms.length, players } };
}

// Basit IP başına hız sınırı (örnek başına; kötüye kullanımı azaltır).
const hits = new Map();
function limited(ip, max = 90) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 2000) hits.clear();
  return arr.length > max;
}

export async function handle({ method, query = {}, body, ip = '' }, store) {
  try {
    if (method === 'GET') {
      if (query.code) return { status: 200, json: await getRoom(store, query) };
      return { status: 200, json: await listRooms(store) };
    }
    if (method === 'POST') {
      if (limited(ip)) throw fail(429, 'rate');
      let b = body;
      if (typeof b === 'string') {
        try { b = JSON.parse(b); } catch { throw fail(400, 'json'); }
      }
      if (!b || typeof b !== 'object') throw fail(400, 'json');
      if (b.action === 'create') return { status: 200, json: await createRoom(store, b) };
      if (b.action === 'join') return { status: 200, json: await joinRoom(store, b) };
      return { status: 200, json: await act(store, b) };
    }
    throw fail(405, 'method');
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, json: { error: e.code } };
    console.error(e);
    return { status: 500, json: { error: 'server' } };
  }
}

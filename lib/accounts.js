// Hesaplar, oturumlar, ayarlar ve yetkiler. Depodan bağımsızdır (store.kv*).
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { fail, sleep, HttpError } from './errors.js';

const scrypt = promisify(crypto.scrypt);

export const PERMS = ['create', 'join', 'chat', 'start', 'download'];
const allOf = (v) => Object.fromEntries(PERMS.map((k) => [k, v]));
export const DEFAULT_SETTINGS = {
  registration: 'open', // open | approval | closed
  guest: { create: false, join: false, chat: false, start: false, download: true }, // giriş yapmayanlar: oda kurmak/katılmak için hesap gerekir
  member: allOf(true), // yeni üyelerin başlangıç yetkileri
  appUrl: '',
  appOpenUrl: '',
};

const AVATARS = 20;
const SESSION_MS = 30 * 24 * 3600_000;
const USER_RE = /^[a-z0-9_]{3,20}$/;
export const COOKIE = 'km_s';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const userPath = (u) => `users/${u}.json`;
const sessPath = (t) => `sessions/${sha(t)}.json`;
const SETTINGS_PATH = 'meta/settings.json';
const FIRST_PATH = 'meta/first-admin.json';

export const cleanDisplay = (s) =>
  String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);

const boolPerms = (o, base) => {
  const out = { ...base };
  for (const k of PERMS) if (o && typeof o[k] === 'boolean') out[k] = o[k];
  return out;
};

// ---------- ayarlar (kısa süreli önbellekli) ----------
const cache = new WeakMap();
export async function getSettings(store, fresh = false) {
  const c = cache.get(store);
  if (!fresh && c && Date.now() - c.t < 3000) return c.v;
  const r = await store.kvGet(SETTINGS_PATH);
  const d = r?.data ?? {};
  const v = {
    registration: ['open', 'approval', 'closed'].includes(d.registration) ? d.registration : DEFAULT_SETTINGS.registration,
    guest: boolPerms(d.guest, DEFAULT_SETTINGS.guest),
    member: boolPerms(d.member, DEFAULT_SETTINGS.member),
    appUrl: typeof d.appUrl === 'string' ? d.appUrl : '',
    appOpenUrl: typeof d.appOpenUrl === 'string' ? d.appOpenUrl : '',
  };
  cache.set(store, { t: Date.now(), v });
  return v;
}

const validHttps = (s) => {
  try { const u = new URL(s); return u.protocol === 'https:' && s.length <= 600; } catch { return false; }
};
export async function saveSettings(store, input) {
  const cur = await getSettings(store, true);
  const next = { ...cur };
  if (input.registration !== undefined) {
    if (!['open', 'approval', 'closed'].includes(input.registration)) throw fail(400, 'registration');
    next.registration = input.registration;
  }
  if (input.guest) next.guest = boolPerms(input.guest, cur.guest);
  if (input.member) next.member = boolPerms(input.member, cur.member);
  if (input.appUrl !== undefined) {
    const v = String(input.appUrl).trim();
    if (v && !validHttps(v)) throw fail(400, 'app_url');
    next.appUrl = v;
  }
  if (input.appOpenUrl !== undefined) {
    const v = String(input.appOpenUrl).trim();
    if (v && (v.length > 200 || /\s/.test(v) || !/^[a-z][a-z0-9+.-]*:/i.test(v) || /^(javascript|data|vbscript|file):/i.test(v))) {
      throw fail(400, 'app_open_url');
    }
    next.appOpenUrl = v;
  }
  const cur2 = await store.kvGet(SETTINGS_PATH);
  const ok = cur2 ? await store.kvWrite(SETTINGS_PATH, next, cur2.etag) : await store.kvCreate(SETTINGS_PATH, next);
  if (!ok) throw fail(409, 'busy');
  cache.delete(store);
  return next;
}

// ---------- parola ----------
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw, salt, 64);
  return `s1$${salt.toString('base64url')}$${h.toString('base64url')}`;
}
let dummy;
async function verifyPassword(pw, stored) {
  if (!stored) {
    dummy ??= await hashPassword('x');
    stored = dummy;
    await verifyPassword(pw, stored).catch(() => {});
    return false;
  }
  const [v, s, h] = String(stored).split('$');
  if (v !== 's1' || !s || !h) return false;
  const want = Buffer.from(h, 'base64url');
  const got = await scrypt(pw, Buffer.from(s, 'base64url'), want.length);
  return crypto.timingSafeEqual(got, want);
}
const checkPassword = (pw) => {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 100) throw fail(400, 'password');
};

// ---------- kullanıcılar ----------
export const getUser = (store, name) => store.kvGet(userPath(name));

export async function mutateUser(store, name, fn) {
  for (let i = 0; i < 8; i++) {
    const cur = await getUser(store, name);
    if (!cur) throw fail(404, 'no_user');
    const out = await fn(cur.data);
    if (await store.kvWrite(userPath(name), cur.data, cur.etag)) return { user: cur.data, out };
    await sleep(20 + Math.random() * 60);
  }
  throw fail(409, 'busy');
}

export const publicUser = (u) => ({
  username: u.username, display: u.display, av: u.av ?? 0, role: u.role, status: u.status,
  perms: u.perms, created: u.created, lastLogin: u.lastLogin ?? null,
});

export function permsOf(settings, user) {
  if (!user) return { ...settings.guest };
  if (user.status !== 'active') return allOf(false);
  if (user.role === 'admin') return allOf(true);
  return boolPerms(user.perms, settings.member);
}

// ---------- oturum ----------
export function parseCookie(header, name = COOKIE) {
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

async function createSession(store, user) {
  const token = crypto.randomBytes(32).toString('base64url');
  await store.kvCreate(sessPath(token), { u: user.username, sv: user.sv || 0, exp: Date.now() + SESSION_MS });
  return token;
}

export const cookieHeader = (token, secure, maxAge = SESSION_MS / 1000) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;

// Çerezden kullanıcıyı bulur. Geçersizse user = null.
export async function identify(store, cookie) {
  const token = parseCookie(cookie);
  if (!token || token.length > 80) return { user: null, token: '' };
  const s = await store.kvGet(sessPath(token));
  if (!s || s.data.exp < Date.now()) {
    if (s) await store.kvDel(sessPath(token));
    return { user: null, token: '' };
  }
  const u = await getUser(store, s.data.u);
  if (!u || (u.data.sv || 0) !== (s.data.sv || 0)) return { user: null, token: '' };
  return { user: u.data, token };
}

// Bir işlem için yetki denetimi. user: çerezdeki kullanıcı (veya null).
export async function requirePerm(store, user, perm) {
  const settings = await getSettings(store);
  const perms = permsOf(settings, user);
  if (!perms[perm]) {
    if (user && user.status !== 'active') throw fail(403, user.status === 'pending' ? 'pending' : 'blocked');
    throw fail(403, user ? 'no_perm' : 'login_required');
  }
  return perms;
}

// Odadaki oyuncunun hesabına göre yetki (çıkış yapıp yetkiyi atlatmayı önler).
export async function requirePermForUid(store, uid, perm) {
  if (!uid) return requirePerm(store, null, perm);
  const u = await getUser(store, uid);
  return requirePerm(store, u?.data ?? { status: 'blocked' }, perm);
}

// ---------- hız sınırı ----------
const hits = new Map();
function limited(key, max, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 3000) hits.clear();
  return arr.length > max;
}

// ---------- kayıt / giriş ----------
async function register(store, b, ip, secure) {
  if (limited(`reg:${ip}`, 8)) throw fail(429, 'rate');
  const settings = await getSettings(store, true);
  if (settings.registration === 'closed') throw fail(403, 'reg_closed');
  const username = String(b.username ?? '').trim().toLowerCase();
  if (!USER_RE.test(username)) throw fail(400, 'username');
  checkPassword(b.password);
  const display = cleanDisplay(b.display) || username.slice(0, 16);
  const adminName = envAdminName();
  // Ortam değişkeniyle bir yönetici tanımlıysa o ad ayrılmıştır ve "ilk kayıt yönetici olur" kuralı kapalıdır.
  if (adminName && username === adminName) throw fail(409, 'username_taken');
  const av = Number.isInteger(b.av) && b.av >= 0 && b.av < AVATARS ? b.av : crypto.randomInt(AVATARS);
  const passHash = await hashPassword(b.password);
  const claimed = adminName ? false : await store.kvCreate(FIRST_PATH, { user: username, at: Date.now() });
  const role = claimed ? 'admin' : 'user';
  const status = claimed || settings.registration === 'open' ? 'active' : 'pending';
  const user = {
    username, display, av, passHash, role, status, sv: 0,
    perms: { ...settings.member }, created: Date.now(), lastLogin: null, fails: 0, lockUntil: 0,
  };
  if (!(await store.kvCreate(userPath(username), user))) {
    if (claimed) await store.kvDel(FIRST_PATH);
    throw fail(409, 'username_taken');
  }
  if (status !== 'active') return { json: { ok: true, pending: true } };
  const token = await createSession(store, user);
  return { json: { ok: true, user: publicUser(user) }, token };
}

const envAdminName = () => {
  const n = String(process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  return USER_RE.test(n) ? n : '';
};
const same = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
// ADMIN_USERNAME / ADMIN_PASSWORD ortam değişkenleri: yönetici hesabı ilk doğru girişte oluşturulur.
async function bootstrapAdmin(store, username, password) {
  const want = process.env.ADMIN_PASSWORD || '';
  if (!want || password.length > 100 || !same(password, want)) return null;
  const settings = await getSettings(store);
  const user = {
    username, display: cleanDisplay(username) || 'Yönetici', av: 0, passHash: await hashPassword(password),
    role: 'admin', status: 'active', sv: 0, perms: { ...settings.member }, created: Date.now(),
    lastLogin: null, fails: 0, lockUntil: 0,
  };
  await store.kvCreate(userPath(username), user);
  return getUser(store, username);
}

async function login(store, b, ip) {
  if (limited(`login:${ip}`, 20)) throw fail(429, 'rate');
  const username = String(b.username ?? '').trim().toLowerCase();
  let cur = USER_RE.test(username) ? await getUser(store, username) : null;
  if (!cur && username && username === envAdminName()) cur = await bootstrapAdmin(store, username, String(b.password ?? ''));
  if (cur && cur.data.lockUntil > Date.now()) throw fail(429, 'locked');
  const ok = await verifyPassword(String(b.password ?? '').slice(0, 100), cur?.data.passHash);
  if (!cur || !ok) {
    if (cur) {
      await mutateUser(store, username, (u) => {
        u.fails = (u.fails || 0) + 1;
        if (u.fails >= 5) { u.lockUntil = Date.now() + 5 * 60_000; u.fails = 0; }
      }).catch(() => {});
    }
    throw fail(401, 'bad_login');
  }
  const { user } = await mutateUser(store, username, (u) => {
    u.fails = 0; u.lockUntil = 0; u.lastLogin = Date.now();
  });
  if (user.status === 'pending') throw fail(403, 'pending');
  if (user.status === 'blocked') throw fail(403, 'blocked');
  const token = await createSession(store, user);
  return { json: { ok: true, user: publicUser(user) }, token };
}

async function changePassword(store, user, b) {
  if (!user) throw fail(401, 'login_required');
  checkPassword(b.next);
  if (!(await verifyPassword(String(b.old ?? '').slice(0, 100), user.passHash))) throw fail(401, 'bad_login');
  const passHash = await hashPassword(b.next);
  await mutateUser(store, user.username, (u) => { u.passHash = passHash; u.sv = (u.sv || 0) + 1; });
  return { json: { ok: true, relogin: true } };
}

async function updateProfile(store, user, b) {
  if (!user || user.status !== 'active') throw fail(401, 'login_required');
  const display = b.display !== undefined ? cleanDisplay(b.display) : undefined;
  if (display !== undefined && !display) throw fail(400, 'name');
  const av = b.av !== undefined ? b.av : undefined;
  if (av !== undefined && !(Number.isInteger(av) && av >= 0 && av < AVATARS)) throw fail(400, 'av');
  const { user: u } = await mutateUser(store, user.username, (x) => {
    if (display !== undefined) x.display = display;
    if (av !== undefined) x.av = av;
  });
  return { json: { ok: true, user: publicUser(u) } };
}

async function me(store, user) {
  const settings = await getSettings(store);
  return {
    user: user && user.status === 'active' ? publicUser(user) : null,
    perms: permsOf(settings, user && user.status === 'active' ? user : null),
    registration: settings.registration,
  };
}

async function appInfo(store, user) {
  const settings = await getSettings(store);
  const active = user && user.status === 'active' ? user : null;
  const perms = permsOf(settings, active);
  return {
    allowed: !!perms.download,
    loginRequired: !perms.download && !active,
    configured: !!settings.appUrl,
    appUrl: perms.download ? settings.appUrl : '',
    appOpenUrl: perms.download ? settings.appOpenUrl : '',
  };
}

export async function handleAuth({ method, query = {}, body, ip = '', cookie = '', secure = false, origin = '', host = '' }, store) {
  try {
    if (method === 'GET') {
      const { user } = await identify(store, cookie);
      if (query.a === 'app') return { status: 200, json: await appInfo(store, user) };
      return { status: 200, json: await me(store, user) };
    }
    if (method !== 'POST') throw fail(405, 'method');
    if (origin) {
      let h = '';
      try { h = new URL(origin).host; } catch { /* geçersiz */ }
      if (h !== host) throw fail(403, 'origin');
    }
    let b = body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch { throw fail(400, 'json'); } }
    if (!b || typeof b !== 'object') throw fail(400, 'json');
    let out;
    if (b.a === 'register') out = await register(store, b, ip, secure);
    else if (b.a === 'login') out = await login(store, b, ip);
    else if (b.a === 'profile') {
      const { user } = await identify(store, cookie);
      return { status: 200, json: (await updateProfile(store, user, b)).json };
    }
    else if (b.a === 'logout') {
      const { token } = await identify(store, cookie);
      if (token) await store.kvDel(sessPath(token));
      return { status: 200, json: { ok: true }, setCookie: cookieHeader('', secure, 0) };
    } else if (b.a === 'password') {
      const { user } = await identify(store, cookie);
      out = await changePassword(store, user, b);
      return { status: 200, json: out.json, setCookie: cookieHeader('', secure, 0) };
    } else throw fail(400, 'action');
    return { status: 200, json: out.json, setCookie: out.token ? cookieHeader(out.token, secure) : undefined };
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, json: { error: e.code } };
    console.error(e);
    return { status: 500, json: { error: 'server' } };
  }
}

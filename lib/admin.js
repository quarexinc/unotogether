// Yönetici API'si: kullanıcılar, yetkiler, ayarlar ve odalar.
import { fail, HttpError } from './errors.js';
import {
  identify, getSettings, saveSettings, getUser, mutateUser, adminUser, cleanDisplay, PERMS,
} from './accounts.js';
import crypto from 'node:crypto';
import { adminRooms, adminRoomOp, adminRoomChat, adminSay, adminBroadcast } from './rooms.js';
import { readRules, writeRules, readStats, resetStats, logEvent, readLog } from './gates.js';

async function listUsers(store) {
  const paths = (await store.kvList('users/')).slice(0, 500);
  const rows = await Promise.all(paths.map((p) => store.kvGet(p).catch(() => null)));
  return rows
    .filter(Boolean)
    .map((r) => adminUser(r.data))
    .sort((a, b) => a.created - b.created);
}

async function patchUser(store, admin, b) {
  const username = String(b.username ?? '').toLowerCase();
  const self = username === admin.username;
  const p = b.patch || {};
  if (self && (p.status !== undefined || p.role !== undefined)) throw fail(400, 'self');
  if (p.status !== undefined && !['active', 'pending', 'blocked'].includes(p.status)) throw fail(400, 'status');
  if (p.role !== undefined && !['admin', 'user'].includes(p.role)) throw fail(400, 'role');
  const { user } = await mutateUser(store, username, (u) => {
    if (p.status !== undefined) {
      if (u.status !== p.status && p.status !== 'active') u.sv = (u.sv || 0) + 1; // açık oturumları kapat
      u.status = p.status;
    }
    if (p.role !== undefined) u.role = p.role;
    if (p.display !== undefined) u.display = cleanDisplay(p.display) || u.display;
    if (p.note !== undefined) u.note = String(p.note).replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, 200);
    if (p.perms && typeof p.perms === 'object') {
      for (const k of PERMS) if (typeof p.perms[k] === 'boolean') u.perms[k] = p.perms[k];
    }
  });
  return adminUser(user);
}

async function bulkUsers(store, admin, b) {
  const names = [...new Set((Array.isArray(b.usernames) ? b.usernames : []).map((x) => String(x).toLowerCase()))]
    .filter((n) => n && n !== admin.username).slice(0, 200);
  const op = String(b.op ?? '');
  const perm = String(b.perm ?? '');
  if (!['approve', 'block', 'unblock', 'perm_on', 'perm_off', 'logout'].includes(op)) throw fail(400, 'action');
  if ((op === 'perm_on' || op === 'perm_off') && !PERMS.includes(perm)) throw fail(400, 'perm');
  let done = 0;
  for (const n of names) {
    try {
      await mutateUser(store, n, (u) => {
        if (u.role === 'admin' && op !== 'logout') return;
        if (op === 'approve' || op === 'unblock') u.status = 'active';
        else if (op === 'block') { u.status = 'blocked'; u.sv = (u.sv || 0) + 1; }
        else if (op === 'logout') u.sv = (u.sv || 0) + 1;
        else u.perms[perm] = op === 'perm_on';
      });
      done += 1;
    } catch { /* kullanıcı silinmiş olabilir */ }
  }
  await logEvent(store, admin.username, 'Toplu işlem', `${op}${perm ? ' ' + perm : ''}: ${done} kullanıcı`);
  return done;
}

export async function handleAdmin({ method, query = {}, body, cookie = '', origin = '', host = '' }, store) {
  try {
    const { user: admin } = await identify(store, cookie);
    if (!admin || admin.status !== 'active') throw fail(401, 'login_required');
    if (admin.role !== 'admin') throw fail(403, 'admin_only');

    if (method === 'GET') {
      switch (query.a) {
        case 'users': return { status: 200, json: { users: await listUsers(store), me: admin.username } };
        case 'rooms': return { status: 200, json: { rooms: await adminRooms(store) } };
        case 'settings': return { status: 200, json: { settings: await getSettings(store, true) } };
        case 'gates': return { status: 200, json: { rules: await readRules(store, true), stats: await readStats(store) } };
        case 'log': return { status: 200, json: { items: await readLog(store) } };
        case 'room_chat': return { status: 200, json: { chat: await adminRoomChat(store, query.code) } };
        default: throw fail(400, 'action');
      }
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

    switch (b.a) {
      case 'user': {
        const u = await patchUser(store, admin, b);
        await logEvent(store, admin.username, 'Kullanıcı düzenlendi', `@${u.username}: ${Object.keys(b.patch || {}).join(', ')}`);
        return { status: 200, json: { user: u } };
      }
      case 'bulk_users':
        return { status: 200, json: { ok: true, done: await bulkUsers(store, admin, b) } };
      case 'logout_user': {
        const username = String(b.username ?? '').toLowerCase();
        await mutateUser(store, username, (u) => { u.sv = (u.sv || 0) + 1; });
        await logEvent(store, admin.username, 'Oturum kapatıldı', '@' + username);
        return { status: 200, json: { ok: true } };
      }
      case 'gates_save': {
        const rules = await writeRules(store, b.rules);
        await logEvent(store, admin.username, 'Yönlendirmeler kaydedildi', `${rules.length} kural, ${rules.filter((r) => r.enabled).length} açık`);
        return { status: 200, json: { rules, stats: await readStats(store) } };
      }
      case 'gate_reset':
        await resetStats(store, b.id ? String(b.id) : '');
        return { status: 200, json: { stats: await readStats(store) } };
      case 'room_say':
        await adminSay(store, b.code, b.text);
        await logEvent(store, admin.username, 'Oda duyurusu', String(b.code ?? '').toUpperCase());
        return { status: 200, json: { ok: true } };
      case 'broadcast': {
        const n = await adminBroadcast(store, b.text);
        await logEvent(store, admin.username, 'Tüm odalara duyuru', `${n} oda`);
        return { status: 200, json: { ok: true, rooms: n } };
      }
      case 'delete_user': {
        const username = String(b.username ?? '').toLowerCase();
        if (username === admin.username) throw fail(400, 'self');
        if (!(await getUser(store, username))) throw fail(404, 'no_user');
        await store.kvDel(`users/${username}.json`);
        await logEvent(store, admin.username, 'Kullanıcı silindi', '@' + username);
        return { status: 200, json: { ok: true } };
      }
      case 'reset_password': {
        const username = String(b.username ?? '').toLowerCase();
        const pw = String(b.password ?? '');
        if (pw.length < 8 || pw.length > 100) throw fail(400, 'password');
        const salt = crypto.randomBytes(16);
        const h = await new Promise((res, rej) => crypto.scrypt(pw, salt, 64, (e, k) => (e ? rej(e) : res(k))));
        await mutateUser(store, username, (u) => {
          u.passHash = `s1$${salt.toString('base64url')}$${h.toString('base64url')}`;
          u.sv = (u.sv || 0) + 1; u.fails = 0; u.lockUntil = 0;
        });
        return { status: 200, json: { ok: true } };
      }
      case 'settings':
      {
        const settings = await saveSettings(store, b.settings || {});
        await logEvent(store, admin.username, 'Ayarlar kaydedildi', Object.keys(b.settings || {}).join(', '));
        return { status: 200, json: { settings } };
      }
      case 'room_start': await adminRoomOp(store, b.code, 'start'); await logEvent(store, admin.username, 'Oda başlatıldı', String(b.code).toUpperCase()); break;
      case 'room_reopen': await adminRoomOp(store, b.code, 'reopen'); break;
      case 'room_close': await adminRoomOp(store, b.code, 'close'); await logEvent(store, admin.username, 'Oda kapatıldı', String(b.code).toUpperCase()); break;
      case 'room_kick': await adminRoomOp(store, b.code, 'kick', String(b.pid ?? '')); await logEvent(store, admin.username, 'Oyuncu atıldı', String(b.code).toUpperCase()); break;
      default: throw fail(400, 'action');
    }
    return { status: 200, json: { ok: true, rooms: await adminRooms(store) } };
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, json: { error: e.code } };
    console.error(e);
    return { status: 500, json: { error: 'server' } };
  }
}

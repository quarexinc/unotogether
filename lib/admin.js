// Yönetici API'si: kullanıcılar, yetkiler, ayarlar ve odalar.
import { fail, HttpError } from './errors.js';
import {
  identify, getSettings, saveSettings, getUser, mutateUser, publicUser, cleanDisplay, PERMS,
} from './accounts.js';
import crypto from 'node:crypto';
import { adminRooms, adminRoomOp } from './rooms.js';

async function listUsers(store) {
  const paths = (await store.kvList('users/')).slice(0, 500);
  const rows = await Promise.all(paths.map((p) => store.kvGet(p).catch(() => null)));
  return rows
    .filter(Boolean)
    .map((r) => publicUser(r.data))
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
    if (p.perms && typeof p.perms === 'object') {
      for (const k of PERMS) if (typeof p.perms[k] === 'boolean') u.perms[k] = p.perms[k];
    }
  });
  return publicUser(user);
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
      case 'user':
        return { status: 200, json: { user: await patchUser(store, admin, b) } };
      case 'delete_user': {
        const username = String(b.username ?? '').toLowerCase();
        if (username === admin.username) throw fail(400, 'self');
        if (!(await getUser(store, username))) throw fail(404, 'no_user');
        await store.kvDel(`users/${username}.json`);
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
        return { status: 200, json: { settings: await saveSettings(store, b.settings || {}) } };
      case 'room_start': await adminRoomOp(store, b.code, 'start'); break;
      case 'room_reopen': await adminRoomOp(store, b.code, 'reopen'); break;
      case 'room_close': await adminRoomOp(store, b.code, 'close'); break;
      case 'room_kick': await adminRoomOp(store, b.code, 'kick', String(b.pid ?? '')); break;
      default: throw fail(400, 'action');
    }
    return { status: 200, json: { ok: true, rooms: await adminRooms(store) } };
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, json: { error: e.code } };
    console.error(e);
    return { status: 500, json: { error: 'server' } };
  }
}

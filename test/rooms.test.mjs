// Oda mantığı testi (bellek içi depo). Çalıştır: npm test
import assert from 'node:assert/strict';
import { handle } from '../lib/rooms.js';
import { memoryStore } from '../lib/store.js';

const store = memoryStore();
// Bu testler misafir akışını sınar: misafir yetkileri açılır (varsayılan kapalıdır).
await store.kvCreate('meta/settings.json', { guest: { create: true, join: true, chat: true, start: true, download: true } });
const post = (body, ip = '1.1.1.1') => handle({ method: 'POST', body, ip }, store);
const get = (query) => handle({ method: 'GET', query }, store);
let n = 0;
const ok = (name) => console.log(`  ok ${++n} ${name}`);

// oluştur
let r = await post({ action: 'create', name: '  Ada  ', av: 3, mode: 'hizli', cap: 4 });
assert.equal(r.status, 200);
const { code, pid: hostId, key: hostKey } = r.json;
assert.match(code, /^[A-Z2-9]{5}$/);
ok('oda oluşturuldu');

r = await post({ action: 'create', name: '', av: 0, mode: 'standart', cap: 4 });
assert.equal(r.status, 400);
r = await post({ action: 'create', name: 'X', mode: 'parti', cap: 11 });
assert.equal(r.status, 400);
r = await post({ action: 'create', name: 'X', mode: 'yok', cap: 4 });
assert.equal(r.status, 400);
ok('geçersiz girdiler reddedildi');

// katıl
r = await post({ action: 'join', code: code.toLowerCase(), name: 'Bora', av: 7 });
assert.equal(r.status, 200);
const bora = r.json;
r = await get({ code, pid: bora.pid });
assert.equal(r.json.players.length, 2);
assert.equal(r.json.players[0].name, 'Ada');
assert.equal(r.json.players[0].host, true);
assert.equal(r.json.inRoom, true);
assert.ok(!JSON.stringify(r.json).includes(hostKey), 'anahtar sızmamalı');
ok('katılım ve görünüm, anahtar sızmıyor');

r = await post({ action: 'join', code: 'ZZZZZ', name: 'Q' });
assert.equal(r.status, 404);
ok('olmayan oda 404');

// yetki
r = await post({ action: 'chat', code, pid: bora.pid, key: 'yanlis', text: 'selam' });
assert.equal(r.status, 403);
r = await post({ action: 'chat', code, pid: bora.pid, key: bora.key, text: ' selam   herkese ' });
assert.equal(r.status, 200);
assert.equal(r.json.room.chat.at(-1).text, 'selam herkese');
r = await post({ action: 'chat', code, pid: bora.pid, key: bora.key, text: 'hemen' });
assert.equal(r.status, 429);
ok('sohbet, yetki ve yavaşlatma');

// sadece ev sahibi başlatır
r = await post({ action: 'start', code, pid: bora.pid, key: bora.key });
assert.equal(r.status, 403);
r = await post({ action: 'start', code, pid: hostId, key: hostKey });
assert.equal(r.status, 200);
assert.equal(r.json.room.status, 'ready');
r = await post({ action: 'join', code, name: 'Cem' });
assert.equal(r.status, 409);
assert.equal(r.json.error, 'started');
ok('başlatma yalnızca ev sahibinde, başlayınca katılım kapalı');

// yeniden bağlanma
r = await post({ action: 'join', code, pid: bora.pid, key: bora.key });
assert.equal(r.status, 200);
assert.equal(r.json.pid, bora.pid);
ok('anahtarla yeniden bağlanma çalışıyor');

r = await post({ action: 'reopen', code, pid: hostId, key: hostKey });
assert.equal(r.json.room.status, 'waiting');

// kapasite
for (const nm of ['C', 'D']) {
  r = await post({ action: 'join', code, name: nm });
  assert.equal(r.status, 200);
}
r = await post({ action: 'join', code, name: 'E' });
assert.equal(r.status, 409);
assert.equal(r.json.error, 'full');
ok('kapasite doldu');

// liste
r = await get({});
assert.equal(r.json.rooms.length, 1);
assert.equal(r.json.rooms[0].n, 4);
assert.equal(r.json.stats.players, 4);
ok('açık oda listesi');

// ev sahibi çıkınca devredilir, atma
r = await post({ action: 'leave', code, pid: hostId, key: hostKey });
assert.equal(r.status, 200);
r = await get({ code, pid: bora.pid });
assert.equal(r.json.players.length, 3);
assert.equal(r.json.hostId, bora.pid);
ok('ev sahibi devri');

const victim = r.json.players.find((p) => p.name === 'C');
r = await post({ action: 'kick', code, pid: bora.pid, key: bora.key, target: victim.id });
assert.equal(r.status, 200);
assert.equal(r.json.room.players.length, 2);
r = await get({ code, pid: victim.id });
assert.equal(r.json.inRoom, false);
ok('oyuncu atma');

// eşzamanlı katılım: kayıp yazma olmamalı
const r2 = await post({ action: 'create', name: 'Host', mode: 'parti', cap: 10 });
const c2 = r2.json.code;
const joins = await Promise.all(
  Array.from({ length: 9 }, (_, i) => post({ action: 'join', code: c2, name: `P${i}` }, `9.9.9.${i}`)),
);
assert.ok(joins.every((j) => j.status === 200), JSON.stringify(joins.map((j) => j.status)));
r = await get({ code: c2 });
assert.equal(r.json.players.length, 10);
ok('9 eşzamanlı katılım, hiçbiri kaybolmadı');

// son oyuncu çıkınca oda silinir
const lone = await post({ action: 'create', name: 'Tek', mode: 'standart', cap: 2 });
await post({ action: 'leave', code: lone.json.code, pid: lone.json.pid, key: lone.json.key });
r = await get({ code: lone.json.code });
assert.equal(r.status, 404);
ok('boş oda silindi');

// hız sınırı
let limited = 0;
for (let i = 0; i < 100; i++) {
  const x = await post({ action: 'join', code: 'ZZZZZ', name: 'Q' }, '7.7.7.7');
  if (x.status === 429) limited++;
}
assert.ok(limited > 0);
ok('hız sınırı devrede');

console.log(`\n${n} test geçti`);

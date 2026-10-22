// Sesli/görüntülü konuşma sinyalleşmesi testi (bellek içi depo). Çalıştır: npm test
import assert from 'node:assert/strict';
import { handle } from '../lib/rooms.js';
import { handleRtc, MAX_PEERS } from '../lib/rtc.js';
import { saveSettings } from '../lib/accounts.js';
import { memoryStore } from '../lib/store.js';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} ${name}`);
let ipn = 0;
const ip = () => `7.7.${Math.floor(++ipn / 250)}.${ipn % 250}`;

async function setup(guestMedia) {
  const store = memoryStore();
  await store.kvCreate('meta/settings.json', { guest: { create: true, join: true, chat: true, start: true, download: true, media: guestMedia } });
  const room = (body) => handle({ method: 'POST', body, ip: ip() }, store);
  const rtc = (body, extra = {}) => handleRtc({ method: 'POST', body, ip: ip(), host: 'x.test', ...extra }, store);
  return { store, room, rtc };
}

// 1) yetki
{
  const { room, rtc } = await setup(false);
  const c = (await room({ action: 'create', name: 'Ada', av: 1, mode: 'standart', cap: 4 })).json;
  const r = await rtc({ a: 'join', code: c.code, pid: c.pid, key: c.key });
  assert.equal(r.status, 403);
  assert.equal(r.json.error, 'login_required');
  ok('konuşma yetkisi kapalıyken katılınamaz');
}

// 2) sinyalleşme
const { store, room, rtc } = await setup(true);
const A = (await room({ action: 'create', name: 'Ada', av: 1, mode: 'standart', cap: 10 })).json;
const code = A.code;
const mk = async (name) => (await room({ action: 'join', code, name, av: 2 })).json;
const B = await mk('Bora');
const withKey = (p, o = {}) => ({ code, pid: p.pid, key: p.key, ...o });

let r = await rtc(withKey(A, { a: 'join', mic: true }));
assert.equal(r.status, 200);
assert.deepEqual(r.json.peers, []);
assert.ok(r.json.ice[0].urls.some((u) => u.startsWith('stun:')));
assert.equal(r.json.ice.length, 1);
r = await rtc(withKey(B, { a: 'join', mic: true, cam: true }));
assert.equal(r.json.peers.length, 1);
assert.equal(r.json.peers[0].pid, A.pid);
assert.equal(r.json.peers[0].name, 'Ada');
assert.equal(r.json.peers[0].mic, true);
ok('katılma: eşler ve ICE listesi döner');

r = await rtc(withKey(B, { a: 'send', to: A.pid, type: 'offer', data: 'v=0 teklif' }));
assert.equal(r.status, 200);
r = await rtc(withKey(A, { a: 'poll', since: 0 }));
assert.equal(r.json.msgs.length, 1);
assert.equal(r.json.msgs[0].from, B.pid);
assert.equal(r.json.msgs[0].type, 'offer');
assert.equal(r.json.msgs[0].data, 'v=0 teklif');
const last = r.json.msgs[0].i;
r = await rtc(withKey(A, { a: 'send', to: B.pid, type: 'answer', data: 'v=0 cevap' }));
r = await rtc(withKey(B, { a: 'poll', since: 0 }));
assert.equal(r.json.msgs[0].type, 'answer');
r = await rtc(withKey(A, { a: 'poll', since: last }));
assert.equal(r.json.msgs.length, 0, 'okunan mesaj tekrar gelmez');
ok('teklif ve cevap karşı tarafa iletilir');

// 3) güvenlik
r = await rtc({ a: 'poll', code, pid: A.pid, key: B.key });
assert.equal(r.status, 403);
r = await rtc({ a: 'send', code, pid: A.pid, key: 'yanlis', to: B.pid, type: 'offer', data: 'x' });
assert.equal(r.status, 403);
r = await rtc(withKey(A, { a: 'send', to: A.pid, type: 'offer', data: 'x' }));
assert.equal(r.status, 400);
r = await rtc(withKey(A, { a: 'send', to: B.pid, type: 'script', data: 'x' }));
assert.equal(r.status, 400);
r = await rtc(withKey(A, { a: 'send', to: B.pid, type: 'offer', data: 'x'.repeat(16001) }));
assert.equal(r.status, 413);
r = await rtc(withKey(A, { a: 'send', to: 'abcabcabcabc', type: 'offer', data: 'x' }));
assert.equal(r.status, 404);
r = await rtc({ a: 'join', code, pid: B.pid, key: 'yanlis' });
assert.equal(r.status, 403);
r = await rtc(withKey(A, { a: 'send', to: B.pid, type: 'offer', data: 'x' }), { origin: 'https://evil.test' });
assert.equal(r.status, 403);
r = await handleRtc({ method: 'GET', ip: ip() }, store);
assert.equal(r.status, 405);
ok('yanlış anahtar, kendine gönderme, geçersiz tür, büyük veri, yabancı köken reddedildi');

// 4) nabız, mikrofon/kamera durumu
r = await rtc(withKey(A, { a: 'beat', mic: false, cam: true }));
assert.equal(r.status, 200);
assert.deepEqual(r.json.peers.map((p) => p.pid), [B.pid]);
r = await rtc(withKey(B, { a: 'beat' }));
const ada = r.json.peers.find((p) => p.pid === A.pid);
assert.equal(ada.mic, false);
assert.equal(ada.cam, true);
// konuşmada olmayan oyuncu nabız atamaz
const C = await mk('Can');
r = await rtc(withKey(C, { a: 'beat' }));
assert.equal(r.status, 403);
ok('nabız mikrofon/kamera durumunu taşır; konuşmada olmayan reddedilir');

// 5) odadan atılan konuşmadan da düşer
await room({ action: 'kick', code, pid: A.pid, key: A.key, target: B.pid });
r = await rtc(withKey(B, { a: 'beat' }));
assert.equal(r.status, 403);
ok('odadan atılan kişi konuşmaya devam edemez');

// 6) kapasite
{
  const { room: rm, rtc: rt } = await setup(true);
  const h = (await rm({ action: 'create', name: 'H', av: 0, mode: 'standart', cap: 10 })).json;
  const all = [h];
  for (let i = 0; i < MAX_PEERS; i++) all.push((await rm({ action: 'join', code: h.code, name: 'P' + i, av: 0 })).json);
  for (let i = 0; i < MAX_PEERS; i++) {
    const x = await rt({ a: 'join', code: h.code, pid: all[i].pid, key: all[i].key });
    assert.equal(x.status, 200, 'katılım ' + i);
  }
  const over = await rt({ a: 'join', code: h.code, pid: all[MAX_PEERS].pid, key: all[MAX_PEERS].key });
  assert.equal(over.status, 409);
  assert.equal(over.json.error, 'call_full');
  // biri ayrılınca yer açılır
  await rt({ a: 'leave', code: h.code, pid: all[0].pid, key: all[0].key });
  const again = await rt({ a: 'join', code: h.code, pid: all[MAX_PEERS].pid, key: all[MAX_PEERS].key });
  assert.equal(again.status, 200);
  ok(`konuşma ${MAX_PEERS} kişiyle sınırlı, ayrılınca yer açılır`);
}

// 7) ayrılma temizler, TURN ayarı yalnızca geçerliyse kabul edilir
r = await rtc(withKey(A, { a: 'leave' }));
assert.equal(r.status, 200);
assert.equal(await store.kvGet(`rtc/${code}/in-${A.pid}.json`), null);
r = await rtc(withKey(A, { a: 'leave' }));
assert.equal(r.status, 200, 'ikinci ayrılma sorun çıkarmaz');
await assert.rejects(() => saveSettings(store, { turnUrl: 'http://x' }), (e) => e.code === 'turn_url');
await saveSettings(store, { turnUrl: 'turn:turn.example.com:3478', turnUser: 'u', turnPass: 'p' });
const D = (await room({ action: 'join', code, name: 'Deniz', av: 3 })).json;
r = await rtc(withKey(D, { a: 'join' }));
assert.equal(r.json.ice.length, 2);
assert.deepEqual(r.json.ice[1], { urls: ['turn:turn.example.com:3478'], username: 'u', credential: 'p' });
ok('ayrılma temizler; TURN ayarı doğrulanır ve ICE listesine eklenir');

console.log(`\n${n} test geçti`);

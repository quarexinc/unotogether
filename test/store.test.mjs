// Redis deposu sözleşme testi: sahte bir Redis istemcisiyle aynı davranış beklenir (npm test).
import assert from 'node:assert/strict';
import { redisStore, memoryStore } from '../lib/store.js';

function fakeRedis() {
  const kv = new Map(); const z = new Map();
  return {
    async get(k) { return kv.has(k) ? kv.get(k) : null; },
    async set(k, v, o = {}) { if (o.nx && kv.has(k)) return null; kv.set(k, v); return 'OK'; },
    async eval(_s, [k], [old, next]) { if (kv.get(k) === old) { kv.set(k, next); return 1; } return 0; },
    async del(k) { kv.delete(k); },
    async zadd(key, { score, member }) { z.set(member, score); },
    async zrem(key, m) { z.delete(m); },
    async zremrangebyscore(key, a, b) { for (const [m, s] of z) if (s >= a && s <= b) z.delete(m); },
    async zrange(key, a, b, o) { const r = [...z.entries()].sort((x, y) => (o?.rev ? y[1] - x[1] : x[1] - y[1])).map(([m]) => m); return r.slice(a, b + 1); },
    async scan(_c, { match }) { const re = new RegExp('^' + match.replace(/\\(.)/g, '$1').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*$/, '.*')); return ['0', [...kv.keys()].filter((k) => re.test(k))]; },
  };
}

let n = 0;
for (const [name, mk] of [['redis', () => redisStore(fakeRedis())], ['bellek', () => memoryStore()]]) {
  const s = mk();
  assert.equal(await s.read('ABCDE'), null);
  assert.equal(await s.create('ABCDE', { a: 1 }), true);
  assert.equal(await s.create('ABCDE', { a: 2 }), false, 'var olan oda ezilmez');
  let r = await s.read('ABCDE');
  assert.deepEqual(r.room, { a: 1 });
  assert.equal(await s.write('ABCDE', { a: 3 }, r.etag), true);
  assert.equal(await s.write('ABCDE', { a: 4 }, r.etag), false, 'bayat etag reddedilir');
  assert.deepEqual((await s.read('ABCDE')).room, { a: 3 });
  await new Promise((r) => setTimeout(r, 5));
  await s.create('ZZZZZ', { b: 1 });
  assert.deepEqual(await s.recent(5), ['ZZZZZ', 'ABCDE']);
  await s.remove('ZZZZZ');
  assert.deepEqual(await s.recent(5), ['ABCDE']);
  // genel depo
  assert.equal(await s.kvGet('users/x.json'), null);
  assert.equal(await s.kvCreate('users/x.json', { u: 1 }), true);
  assert.equal(await s.kvCreate('users/x.json', { u: 2 }), false);
  const g = await s.kvGet('users/x.json');
  assert.equal(await s.kvWrite('users/x.json', { u: 5 }, g.etag), true);
  assert.equal(await s.kvWrite('users/x.json', { u: 6 }, g.etag), false);
  await s.kvCreate('users/y.json', {}); await s.kvCreate('sessions/q.json', {});
  assert.deepEqual((await s.kvList('users/')).sort(), ['users/x.json', 'users/y.json']);
  await s.kvDel('users/y.json');
  assert.deepEqual(await s.kvList('users/'), ['users/x.json']);
  console.log(`  ok ${++n} ${name} deposu aynı davranır`);
}
console.log(`\n${n} test geçti`);

// Hesap, yetki ve yönetici testleri (bellek içi depo). Çalıştır: npm test
import assert from 'node:assert/strict';
import { handle } from '../lib/rooms.js';
import { handleAuth } from '../lib/accounts.js';
import { handleAdmin } from '../lib/admin.js';
import { memoryStore } from '../lib/store.js';

const store = memoryStore();
let n = 0;
const ok = (name) => console.log(`  ok ${++n} ${name}`);
let ipn = 0;
const ip = () => `9.9.${Math.floor(++ipn / 250)}.${ipn % 250}`;

const auth = (body, cookie = '', method = 'POST', query = {}) =>
  handleAuth({ method, body, query, cookie, ip: ip(), host: 'x.test' }, store);
const adm = (body, cookie, method = 'POST', query = {}) =>
  handleAdmin({ method, body, query, cookie, host: 'x.test' }, store);
const rooms = (body, cookie = '') => handle({ method: 'POST', body, ip: ip(), cookie }, store);
const ck = (r) => (r.setCookie ? r.setCookie.split(';')[0] : '');

// ilk kayıt yönetici olur
let r = await auth({ a: 'register', username: 'Emre', password: 'sifre12345', display: 'Emre' });
assert.equal(r.status, 200);
assert.equal(r.json.user.role, 'admin');
assert.match(r.setCookie, /HttpOnly/);
assert.match(r.setCookie, /SameSite=Lax/);
assert.ok(!JSON.stringify(r.json).includes('passHash'));
const adminC = ck(r);
ok('ilk kayıt yönetici, çerez HttpOnly');

r = await auth({ a: 'register', username: 'ada', password: 'sifre12345', display: 'Ada' });
assert.equal(r.json.user.role, 'user');
const adaC = ck(r);
r = await auth({ a: 'register', username: 'ADA', password: 'baska12345' });
assert.equal(r.status, 409);
r = await auth({ a: 'register', username: 'a b', password: 'sifre12345' });
assert.equal(r.status, 400);
r = await auth({ a: 'register', username: 'kisa', password: '123' });
assert.equal(r.status, 400);
ok('ikinci kayıt kullanıcı; tekrar eden ve geçersiz girdiler reddedildi');

r = await auth(null, adaC, 'GET');
assert.equal(r.json.user.username, 'ada');
r = await auth(null, '', 'GET');
assert.equal(r.json.user, null);
r = await auth(null, 'km_s=uydurma', 'GET');
assert.equal(r.json.user, null);
ok('me: oturum çerezi tanınır, sahte çerez tanınmaz');

// giriş ve kilit
r = await auth({ a: 'login', username: 'ada', password: 'yanlis-parola' });
assert.equal(r.status, 401);
r = await auth({ a: 'login', username: 'yokboyle', password: 'yanlis-parola' });
assert.equal(r.status, 401);
r = await auth({ a: 'login', username: 'ada', password: 'sifre12345' });
assert.equal(r.status, 200);
assert.ok(ck(r));
for (let i = 0; i < 5; i++) await auth({ a: 'login', username: 'ada', password: 'x'.repeat(9) });
r = await auth({ a: 'login', username: 'ada', password: 'sifre12345' });
assert.equal(r.status, 429);
assert.equal(r.json.error, 'locked');
ok('giriş, yanlış parola ve 5 hatadan sonra geçici kilit');

// yönetici API'si korunur
r = await adm(null, '', 'GET', { a: 'users' });
assert.equal(r.status, 401);
r = await adm(null, adaC, 'GET', { a: 'users' });
assert.equal(r.status, 403);
r = await adm(null, adminC, 'GET', { a: 'users' });
assert.equal(r.status, 200);
assert.equal(r.json.users.length, 2);
assert.ok(!JSON.stringify(r.json).includes('passHash'));
r = await adm({ a: 'settings', settings: { registration: 'closed' } }, adaC);
assert.equal(r.status, 403);
ok('yönetici API: girişsiz 401, üye 403, yönetici 200, parola özeti sızmıyor');

// ayar doğrulaması
for (const bad of ['javascript:alert(1)', 'http://x.com/a.exe', 'ftp://x']) {
  r = await adm({ a: 'settings', settings: { appUrl: bad } }, adminC);
  assert.equal(r.status, 400, bad);
}
r = await adm({ a: 'settings', settings: { appOpenUrl: 'javascript:alert(1)' } }, adminC);
assert.equal(r.status, 400);
r = await adm({ a: 'settings', settings: { registration: 'herkes' } }, adminC);
assert.equal(r.status, 400);
ok('uygulama bağlantısı yalnızca https, tehlikeli şemalar reddedildi');

// uygulama indirme yetkisi
r = await adm({ a: 'settings', settings: { appUrl: 'https://example.com/app.exe' } }, adminC);
assert.equal(r.status, 200);
r = await auth(null, '', 'GET', { a: 'app' });
assert.equal(r.json.allowed, true);
assert.equal(r.json.appUrl, 'https://example.com/app.exe');
await adm({ a: 'settings', settings: { guest: { download: false } } }, adminC);
r = await auth(null, '', 'GET', { a: 'app' });
assert.equal(r.json.allowed, false);
assert.equal(r.json.loginRequired, true);
assert.equal(r.json.appUrl, '');
r = await auth(null, adaC, 'GET', { a: 'app' });
assert.equal(r.json.allowed, true);
await adm({ a: 'user', username: 'ada', patch: { perms: { download: false } } }, adminC);
r = await auth(null, adaC, 'GET', { a: 'app' });
assert.equal(r.json.allowed, false);
assert.equal(r.json.appUrl, '');
assert.equal(r.json.loginRequired, false);
await adm({ a: 'user', username: 'ada', patch: { perms: { download: true } } }, adminC);
ok('indirme yetkisi misafir ve kullanıcı bazında çalışıyor');

// oda yetkileri
await adm({ a: 'settings', settings: { guest: { create: false } } }, adminC);
r = await rooms({ action: 'create', name: 'Misafir', mode: 'standart', cap: 4 });
assert.equal(r.status, 403);
assert.equal(r.json.error, 'login_required');
r = await rooms({ action: 'create', name: 'Ada', mode: 'standart', cap: 4 }, adaC);
assert.equal(r.status, 200);
const room = r.json;
await adm({ a: 'user', username: 'ada', patch: { perms: { create: false } } }, adminC);
r = await rooms({ action: 'create', name: 'Ada', mode: 'standart', cap: 4 }, adaC);
assert.equal(r.status, 403);
assert.equal(r.json.error, 'no_perm');
ok('oda kurma yetkisi: misafir ve üye bazında');

await adm({ a: 'settings', settings: { guest: { join: false } } }, adminC);
r = await rooms({ action: 'join', code: room.code, name: 'Misafir' });
assert.equal(r.json.error, 'login_required');
r = await rooms({ action: 'join', code: room.code, name: 'Emre' }, adminC);
assert.equal(r.status, 200);
const emre = r.json;
await adm({ a: 'settings', settings: { guest: { join: true, chat: false } } }, adminC);
ok('odaya katılma yetkisi');

r = await rooms({ action: 'join', code: room.code, name: 'Misafir' });
assert.equal(r.status, 200);
const guest = r.json;
r = await rooms({ action: 'chat', code: room.code, pid: guest.pid, key: guest.key, text: 'selam' });
assert.equal(r.json.error, 'login_required');
r = await rooms({ action: 'chat', code: room.code, pid: emre.pid, key: emre.key, text: 'selam' });
assert.equal(r.status, 200);
// çıkış yapıp yetkiyi atlatamaz: oyuncu hesabına bağlı
await adm({ a: 'user', username: 'emre', patch: {} }, adminC);
await adm({ a: 'settings', settings: { guest: { chat: true } } }, adminC);
ok('sohbet yetkisi');

// start yetkisi: ev sahibi Ada, start yetkisi kapalı
await adm({ a: 'user', username: 'ada', patch: { perms: { start: false } } }, adminC);
r = await rooms({ action: 'start', code: room.code, pid: room.pid, key: room.key });
assert.equal(r.status, 403);
assert.equal(r.json.error, 'no_perm');
await adm({ a: 'user', username: 'ada', patch: { perms: { start: true } } }, adminC);
r = await rooms({ action: 'start', code: room.code, pid: room.pid, key: room.key });
assert.equal(r.status, 200);
assert.equal(r.json.room.status, 'ready');
ok('başlatma yetkisi hesaba bağlı');

// yönetici oda paneli
r = await adm(null, adminC, 'GET', { a: 'rooms' });
assert.equal(r.json.rooms.length, 1);
assert.equal(r.json.rooms[0].players.find((p) => p.host).uid, 'ada');
r = await adm({ a: 'room_reopen', code: room.code }, adminC);
assert.equal(r.json.rooms[0].status, 'waiting');
r = await adm({ a: 'room_start', code: room.code }, adminC);
assert.equal(r.json.rooms[0].status, 'ready');
r = await adm({ a: 'room_kick', code: room.code, pid: guest.pid }, adminC);
assert.equal(r.json.rooms[0].players.length, 2);
r = await adm({ a: 'room_close', code: room.code }, adminC);
assert.equal(r.json.rooms.length, 0);
r = await adm({ a: 'room_close', code: room.code }, adminC);
assert.equal(r.status, 404);
ok('yönetici panelinden oda başlatma, yeniden açma, oyuncu atma, kapatma');

// engelleme oturumu düşürür
r = await adm({ a: 'user', username: 'ada', patch: { status: 'blocked' } }, adminC);
assert.equal(r.json.user.status, 'blocked');
r = await auth(null, adaC, 'GET');
assert.equal(r.json.user, null);
r = await auth({ a: 'login', username: 'ada', password: 'sifre12345' });
assert.ok([403, 429].includes(r.status));
r = await adm({ a: 'user', username: 'emre', patch: { status: 'blocked' } }, adminC);
assert.equal(r.status, 400);
r = await adm({ a: 'delete_user', username: 'emre' }, adminC);
assert.equal(r.status, 400);
ok('engellenen kullanıcının oturumu düşer, yönetici kendini engelleyemez/silemez');

// onaylı kayıt
await adm({ a: 'settings', settings: { registration: 'approval' } }, adminC);
r = await auth({ a: 'register', username: 'cem', password: 'sifre12345' });
assert.equal(r.json.pending, true);
assert.ok(!r.setCookie);
await adm({ a: 'user', username: 'cem', patch: { status: 'active' } }, adminC);
r = await auth({ a: 'login', username: 'cem', password: 'sifre12345' });
assert.equal(r.status, 200);
await adm({ a: 'settings', settings: { registration: 'closed' } }, adminC);
r = await auth({ a: 'register', username: 'deniz', password: 'sifre12345' });
assert.equal(r.status, 403);
ok('onaylı kayıt ve kapalı kayıt');

// parola sıfırlama ve değiştirme eski oturumları kapatır
r = await auth({ a: 'login', username: 'cem', password: 'sifre12345' });
const cemC = ck(r);
r = await adm({ a: 'reset_password', username: 'cem', password: 'yenisifre99' }, adminC);
assert.equal(r.status, 200);
r = await auth(null, cemC, 'GET');
assert.equal(r.json.user, null);
r = await auth({ a: 'login', username: 'cem', password: 'yenisifre99' });
assert.equal(r.status, 200);
const cem2 = ck(r);
r = await auth({ a: 'password', old: 'yanlis', next: 'bambaska123' }, cem2);
assert.equal(r.status, 401);
r = await auth({ a: 'password', old: 'yenisifre99', next: 'bambaska123' }, cem2);
assert.equal(r.status, 200);
r = await auth(null, cem2, 'GET');
assert.equal(r.json.user, null);
ok('parola sıfırlama/değiştirme eski oturumları kapatır');

// çıkış ve başka siteden gelen istek
r = await auth({ a: 'login', username: 'cem', password: 'bambaska123' });
const c3 = ck(r);
r = await handleAuth({ method: 'POST', body: { a: 'logout' }, cookie: c3, ip: ip(), host: 'x.test', origin: 'https://kotu.example' }, store);
assert.equal(r.status, 403);
r = await auth({ a: 'logout' }, c3);
assert.match(r.setCookie, /Max-Age=0/);
r = await auth(null, c3, 'GET');
assert.equal(r.json.user, null);
ok('çıkış oturumu siler; başka kaynaktan gelen POST reddedilir');

// varsayılan: misafir oda kuramaz, katılamaz
{
  const st = memoryStore();
  const rm = (body, cookie = '') => handle({ method: 'POST', body, ip: ip(), cookie }, st);
  const au = (body, cookie = '', method = 'POST', query = {}) => handleAuth({ method, body, query, cookie, ip: ip(), host: 'x.test' }, st);
  let q = await rm({ action: 'create', name: 'Misafir', mode: 'standart', cap: 4 });
  assert.equal(q.status, 403);
  assert.equal(q.json.error, 'login_required');
  q = await rm({ action: 'join', code: 'ABCDE', name: 'Misafir' });
  assert.equal(q.json.error, 'login_required');
  q = await au({ a: 'register', username: 'ilk', password: 'sifre12345', av: 5 });
  assert.equal(q.json.user.av, 5);
  const c = q.setCookie.split(';')[0];
  q = await rm({ action: 'create', name: 'Ilk', av: 5, mode: 'standart', cap: 4 }, c);
  assert.equal(q.status, 200);
  q = await au({ a: 'profile', display: 'Yeni Ad', av: 9 }, c);
  assert.equal(q.json.user.display, 'Yeni Ad');
  assert.equal(q.json.user.av, 9);
  q = await au({ a: 'profile', av: 99 }, c);
  assert.equal(q.status, 400);
  q = await au({ a: 'profile', display: 'X' }, '');
  assert.equal(q.status, 401);
  ok('varsayılan: misafir oda kuramaz/katılamaz, hesapla kurulur; profil güncellenir');
}

// ortam değişkeniyle tanımlı yönetici
{
  process.env.ADMIN_USERNAME = 'Root';
  process.env.ADMIN_PASSWORD = 'uzun-parola-123';
  const st = memoryStore();
  const au = (body, cookie = '', method = 'POST', query = {}) => handleAuth({ method, body, query, cookie, ip: ip(), host: 'x.test' }, st);
  let q = await au({ a: 'register', username: 'root', password: 'baska-parola1' });
  assert.equal(q.status, 409);
  q = await au({ a: 'register', username: 'ilkkayit', password: 'sifre12345' });
  assert.equal(q.json.user.role, 'user', 'ilk kayıt artık yönetici olmaz');
  q = await au({ a: 'login', username: 'root', password: 'yanlis-parola' });
  assert.equal(q.status, 401);
  q = await au({ a: 'login', username: 'root', password: 'uzun-parola-123' });
  assert.equal(q.status, 200);
  assert.equal(q.json.user.role, 'admin');
  const rc = q.setCookie.split(';')[0];
  q = await handleAdmin({ method: 'GET', query: { a: 'users' }, cookie: rc, host: 'x.test' }, st);
  assert.equal(q.status, 200);
  q = await au({ a: 'password', old: 'uzun-parola-123', next: 'degisti-parola-9' }, rc);
  assert.equal(q.status, 200);
  q = await au({ a: 'login', username: 'root', password: 'uzun-parola-123' });
  assert.equal(q.status, 401, 'parola değişince ortam değişkenindeki parola geçersiz');
  q = await au({ a: 'login', username: 'root', password: 'degisti-parola-9' });
  assert.equal(q.status, 200);
  delete process.env.ADMIN_USERNAME; delete process.env.ADMIN_PASSWORD;
  ok('ortam değişkeniyle yönetici: ilk girişte oluşur, ad ayrılır, parola değişince env geçersiz');
}

console.log(`\n${n} test geçti`);

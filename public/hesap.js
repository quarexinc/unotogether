(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const ERR = { bad_login: 'Mevcut parola yanlış.', password: 'Yeni parola en az 8 karakter olmalı.', name: 'Görünen ad boş olamaz.', rate: 'Çok hızlı denedin, biraz bekle.', login_required: 'Oturumun bitmiş. Tekrar giriş yap.' };
  const msg = (e) => ERR[e && e.code] || 'Bir sorun oluştu. Tekrar dene.';
  const PERM = { create: 'Oda kur', join: 'Odaya katıl', chat: 'Sohbet', start: 'Odayı başlat', download: 'Uygulamayı indir' };
  let av = 0;

  document.querySelectorAll('[data-pw]').forEach((b) => b.addEventListener('click', () => {
    const inp = b.previousElementSibling; const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password'; b.textContent = show ? 'Gizle' : 'Göster';
  }));

  function paint(u, perms) {
    $('#me-av').textContent = ''; $('#me-av').appendChild(window.KMAV.avEl(u.av || 0));
    $('#me-name').textContent = u.display;
    $('#me-user').textContent = '@' + u.username + (u.role === 'admin' ? ' · yönetici' : '');
    const box = $('#me-perms'); box.textContent = '';
    for (const [k, label] of Object.entries(PERM)) {
      const on = u.role === 'admin' || !!perms[k];
      const b = document.createElement('span');
      b.className = 'perm'; b.setAttribute('aria-pressed', String(on)); b.textContent = label;
      box.appendChild(b);
    }
  }
  function grid() {
    const g = $('#prof-av'); g.textContent = '';
    for (let i = 0; i < 20; i++) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', 'Avatar ' + (i + 1)); b.setAttribute('aria-pressed', String(i === av));
      b.appendChild(window.KMAV.avEl(i));
      b.addEventListener('click', () => { av = i; g.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', String(j === i))); });
      g.appendChild(b);
    }
  }

  window.KMAuth.onReady((s) => {
    if (!s.user) return;
    $('#gate').hidden = true; $('#acc').hidden = false;
    av = s.user.av || 0;
    $('#f-prof').display.value = s.user.display;
    grid(); paint(s.user, s.perms);
  });

  $('#logout').addEventListener('click', async () => {
    try { await window.KMAuth.call('POST', { a: 'logout' }); } catch { /* yine de yönlendir */ }
    location.href = '/';
  });
  $('#f-prof').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#go-prof'); btn.disabled = true; $('#err-prof').textContent = ''; $('#ok-prof').textContent = '';
    try {
      const r = await window.KMAuth.call('POST', { a: 'profile', display: e.target.display.value, av });
      $('#ok-prof').textContent = 'Kaydedildi.';
      paint(r.user, window.KMAuth.state.perms);
      window.KMAuth.refresh();
    } catch (x) { $('#err-prof').textContent = msg(x); } finally { btn.disabled = false; }
  });
  $('#f-pw').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#go-pw'); btn.disabled = true; $('#err-pw').textContent = '';
    try {
      await window.KMAuth.call('POST', { a: 'password', old: e.target.old.value, next: e.target.next.value });
      location.href = '/giris?next=/hesap';
    } catch (x) { $('#err-pw').textContent = msg(x); btn.disabled = false; }
  });
})();

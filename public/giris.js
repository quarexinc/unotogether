(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const ERR = {
    bad_login: 'Kullanıcı adı veya parola yanlış.',
    locked: 'Çok fazla hatalı deneme. 5 dakika sonra tekrar dene.',
    pending: 'Hesabın yönetici onayını bekliyor. Onaylanınca giriş yapabilirsin.',
    blocked: 'Bu hesap engellendi.',
    username_taken: 'Bu kullanıcı adı alınmış.',
    username: 'Kullanıcı adı 3–20 karakter olmalı: harf, rakam veya alt çizgi.',
    password: 'Parola en az 8 karakter olmalı.',
    reg_closed: 'Şu anda yeni kayıt alınmıyor.',
    rate: 'Çok hızlı denedin. Biraz bekleyip tekrar dene.',
    origin: 'İstek reddedildi. Sayfayı yenileyip tekrar dene.',
  };
  const msg = (e) => ERR[e && e.code] || 'Bir sorun oluştu. Tekrar dene.';
  const q = new URLSearchParams(location.search);
  const safeNext = () => {
    const n = q.get('next') || '/';
    return /^\/(?![/\\])/.test(n) ? n : '/';
  };
  let av = Math.floor(Math.random() * 20);

  // vitrin: üst üste binen avatarlar
  const stack = $('#avstack');
  if (stack && window.KMAV) for (const i of [0, 8, 3, 14, 6, 11]) stack.appendChild(window.KMAV.avEl(i));
  // kayıt avatar seçici
  const grid = $('#reg-av');
  if (grid && window.KMAV) {
    for (let i = 0; i < 20; i++) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', 'Avatar ' + (i + 1)); b.setAttribute('aria-pressed', String(i === av));
      b.appendChild(window.KMAV.avEl(i));
      b.addEventListener('click', () => { av = i; grid.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', String(j === i))); });
      grid.appendChild(b);
    }
  }

  // parola göster/gizle
  document.querySelectorAll('[data-pw]').forEach((b) => b.addEventListener('click', () => {
    const inp = b.previousElementSibling;
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.textContent = show ? 'Gizle' : 'Göster';
    b.setAttribute('aria-label', show ? 'Parolayı gizle' : 'Parolayı göster');
  }));
  // parola gücü
  const LV = ['Çok kısa', 'Zayıf', 'Orta', 'İyi', 'Güçlü'];
  $('#reg-pw').addEventListener('input', (e) => {
    const v = e.target.value;
    let sc = 0;
    if (v.length >= 8) sc++;
    if (v.length >= 12) sc++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) sc++;
    if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) sc++;
    if (v.length < 8) sc = 0;
    document.querySelectorAll('#meter i').forEach((el, i) => { el.className = i < sc ? 'on l' + sc : ''; });
    $('#meter-t').textContent = v ? 'Parola gücü: ' + LV[sc] : 'En az 8 karakter. Harf, rakam ve işaret karıştırırsan daha güçlü olur.';
  });

  function tab(which) {
    const reg = which === 'reg';
    $('#t-login').setAttribute('aria-selected', String(!reg));
    $('#t-reg').setAttribute('aria-selected', String(reg));
    $('#f-login').hidden = reg;
    $('#f-reg').hidden = !reg;
    $('#h1').textContent = reg ? 'Hesap oluştur' : 'Giriş yap';
    $('#sub').textContent = reg ? 'Birkaç saniyede hesap aç, odalara katıl.' : 'Hesabınla giriş yap, kaldığın yerden devam et.';
    const i = (reg ? $('#f-reg') : $('#f-login')).querySelector('input');
    if (i) i.focus();
  }
  $('#t-login').addEventListener('click', () => tab('login'));
  $('#t-reg').addEventListener('click', () => tab('reg'));
  $('#to-reg').addEventListener('click', (e) => { e.preventDefault(); tab('reg'); });
  $('#to-login').addEventListener('click', (e) => { e.preventDefault(); tab('login'); });

  async function send(btn, errEl, body, done) {
    if (btn.disabled) return;
    btn.disabled = true; errEl.textContent = '';
    try { done(await window.KMAuth.call('POST', body)); } catch (e) { errEl.textContent = msg(e); } finally { btn.disabled = false; }
  }
  $('#f-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    send($('#go-login'), $('#err-login'), { a: 'login', username: f.username.value, password: f.password.value }, () => { location.href = safeNext(); });
  });
  $('#f-reg').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    send($('#go-reg'), $('#err-reg'), { a: 'register', username: f.username.value, display: f.display.value, av, password: f.password.value }, (r) => {
      if (r.pending) {
        tab('login');
        const n = $('#why');
        n.hidden = false;
        n.textContent = 'Hesabın oluşturuldu. Yönetici onayladıktan sonra giriş yapabilirsin.';
        return;
      }
      location.href = safeNext();
    });
  });

  window.KMAuth.onReady((s) => {
    if (s.user) {
      $('#forms').hidden = true;
      $('#already').hidden = false;
      $('#h1').textContent = 'Hesabın';
      $('#sub').textContent = '';
      $('#already-p').textContent = `${s.user.display} (@${s.user.username}) olarak giriş yaptın.`;
      $('#go-home').href = safeNext();
      $('#do-logout').addEventListener('click', async () => {
        try { await window.KMAuth.call('POST', { a: 'logout' }); } catch { /* yine de yenile */ }
        location.reload();
      });
      return;
    }
    if (q.get('neden') === 'oda') $('#why').hidden = false;
    if (s.registration === 'closed') {
      $('#t-reg').hidden = true; $('#to-reg').parentElement.hidden = true;
    } else if (s.registration === 'approval') {
      $('#reg-note').hidden = false;
      $('#reg-note').textContent = 'Yeni hesaplar yönetici onayından sonra etkinleşir.';
    }
    if (q.get('kayit') === '1' && s.registration !== 'closed') tab('reg');
  });
})();

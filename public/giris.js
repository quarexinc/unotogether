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
  const safeNext = () => {
    const n = new URLSearchParams(location.search).get('next') || '/';
    return /^\/(?![/\\])/.test(n) ? n : '/';
  };

  function tab(which) {
    const reg = which === 'reg';
    $('#t-login').setAttribute('aria-selected', String(!reg));
    $('#t-reg').setAttribute('aria-selected', String(reg));
    $('#f-login').hidden = reg;
    $('#f-reg').hidden = !reg;
    $('#h1').textContent = reg ? 'Hesap oluştur' : 'Giriş yap';
    const f = reg ? $('#f-reg') : $('#f-login');
    const i = f.querySelector('input');
    if (i) i.focus();
  }
  $('#t-login').addEventListener('click', () => tab('login'));
  $('#t-reg').addEventListener('click', () => tab('reg'));

  async function send(form, btn, errEl, body, done) {
    if (btn.disabled) return;
    btn.disabled = true; errEl.textContent = '';
    try {
      const r = await window.KMAuth.call('POST', body);
      done(r);
    } catch (e) {
      errEl.textContent = msg(e);
    } finally { btn.disabled = false; }
  }

  $('#f-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    send(f, $('#go-login'), $('#err-login'),
      { a: 'login', username: f.username.value, password: f.password.value },
      () => { location.href = safeNext(); });
  });
  $('#f-reg').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    send(f, $('#go-reg'), $('#err-reg'),
      { a: 'register', username: f.username.value, display: f.display.value, password: f.password.value },
      (r) => {
        if (r.pending) {
          f.hidden = true;
          const n = $('#reg-note');
          n.hidden = false;
          n.textContent = 'Hesabın oluşturuldu. Yönetici onayladıktan sonra giriş yapabilirsin.';
          $('#f-login').hidden = false; $('#f-reg').hidden = true;
          $('#t-login').setAttribute('aria-selected', 'true'); $('#t-reg').setAttribute('aria-selected', 'false');
          $('#err-login').textContent = '';
          $('#f-login').before(n);
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
      $('#already-p').textContent = `${s.user.display} (@${s.user.username}) olarak giriş yaptın.`;
      $('#go-home').href = safeNext();
      $('#do-logout').addEventListener('click', async () => {
        try { await window.KMAuth.call('POST', { a: 'logout' }); } catch { /* yine de yenile */ }
        location.reload();
      });
      return;
    }
    if (s.registration === 'closed') {
      $('#t-reg').hidden = true;
    } else if (s.registration === 'approval') {
      const n = $('#reg-note');
      n.hidden = false;
      n.textContent = 'Yeni hesaplar yönetici onayından sonra etkinleşir.';
    }
    if (new URLSearchParams(location.search).get('kayit') === '1' && s.registration !== 'closed') tab('reg');
  });
})();

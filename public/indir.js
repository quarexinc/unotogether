(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const h = $('#dl-h'); const p = $('#dl-p'); const cta = $('#dl-cta');
  const btn = (cls, text, href) => {
    const a = document.createElement('a');
    a.className = 'btn ' + cls; a.textContent = text; a.href = href;
    return a;
  };
  const PERM = { create: 'oda kurabilir', join: 'odalara katılabilir', chat: 'sohbet edebilir', start: 'masa başlatabilir', download: 'uygulamayı indirebilir', media: 'sesli ve görüntülü konuşabilir' };

  // masa sahnesi: dört koltukta avatar
  [['#ts1', 0], ['#ts2', 8], ['#ts3', 3], ['#ts4', 14]].forEach(([sel, i]) => { const el = $(sel); if (el && window.KMAV) el.appendChild(window.KMAV.avEl(i)); });

  function bottom(state) {
    const box = $('#cta-links'); box.textContent = '';
    if (state.user) {
      box.append(btn('hot lg', 'Ana sayfaya dön ve oda kur', '/'), btn('line lg', 'Hesabım', '/hesap'));
    } else {
      box.append(btn('hot lg', 'Kayıt ol', '/giris?kayit=1&next=' + encodeURIComponent('/indir')), btn('line lg', 'Giriş yap', '/giris?next=' + encodeURIComponent('/indir')));
    }
  }

  function me(state) {
    if (!state.user) return;
    $('#mini-me').hidden = false;
    $('#mm-av').appendChild(window.KMAV.avEl(state.user.av || 0));
    $('#mm-name').textContent = state.user.display;
    const ok = Object.keys(PERM).filter((k) => state.user.role === 'admin' || state.perms[k]).map((k) => PERM[k]);
    $('#mm-perms').textContent = ok.length ? 'Yetkilerin: ' + ok.join(', ') : 'Şu an hiçbir yetkin açık değil.';
  }

  async function run() {
    const state = window.KMAuth.state;
    me(state); bottom(state);
    let info;
    try {
      const res = await fetch('/api/auth?a=app', { cache: 'no-store', credentials: 'same-origin' });
      info = await res.json();
    } catch {
      h.textContent = 'Bağlanılamadı';
      p.textContent = 'Sunucuya ulaşılamadı. Biraz sonra sayfayı yenile.';
      return;
    }
    cta.textContent = '';
    if (info.loginRequired) {
      h.textContent = 'İndirmek için giriş yap';
      p.textContent = 'Uygulamayı indirmek için hesabınla giriş yapman gerekiyor.';
      cta.append(
        btn('hot lg', 'Giriş yap', '/giris?next=' + encodeURIComponent('/indir')),
        btn('line lg', 'Kayıt ol', '/giris?kayit=1&next=' + encodeURIComponent('/indir')),
      );
      return;
    }
    if (!info.allowed) {
      h.textContent = 'İndirme yetkin yok';
      p.textContent = 'Hesabının uygulamayı indirme yetkisi kapalı. Bir yöneticiden yetki isteyebilirsin.';
      cta.append(btn('line', 'Ana sayfaya dön', '/'));
      return;
    }
    // Sunucuda bağlantı yoksa site ayar dosyasındaki (config.js) bağlantı kullanılır.
    const cfg = window.KARTMASA || {};
    const url = info.appUrl || cfg.appUrl || '';
    const openUrl = info.appOpenUrl || cfg.appOpenUrl || '';
    if (!url) {
      h.textContent = 'Uygulama yakında';
      p.textContent = 'İndirme bağlantısı henüz eklenmedi. Yönetici ekleyince burada görünecek.';
      cta.append(btn('line', 'Ana sayfaya dön', '/'));
      return;
    }
    h.textContent = 'Kartmasa uygulaması';
    p.textContent = 'Kurulum dosyası hazır. İndirdikten sonra çalıştırıp uygulamayı kur.';
    const dl = btn('hot lg', 'Uygulamayı indir', url);
    dl.rel = 'noopener noreferrer';
    dl.addEventListener('click', () => {
      try { localStorage.setItem('km-dl', '1'); } catch { /* depolama kapalı */ }
      fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'dl_click' }), keepalive: true, credentials: 'same-origin' }).catch(() => {});
    });
    cta.appendChild(dl);
    if (openUrl) cta.appendChild(btn('line lg', 'Uygulamayı aç', openUrl.replace('{code}', '')));
  }
  window.KMAuth.ready.then(run);
})();

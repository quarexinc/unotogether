(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const h = $('#dl-h'); const p = $('#dl-p'); const cta = $('#dl-cta');
  const btn = (cls, text, href) => {
    const a = document.createElement('a');
    a.className = 'btn ' + cls; a.textContent = text; a.href = href;
    return a;
  };

  async function run() {
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
    p.textContent = 'Masaüstü için kurulum dosyası hazır.';
    const dl = btn('hot lg', 'Uygulamayı indir', url);
    dl.rel = 'noopener noreferrer';
    cta.appendChild(dl);
    if (openUrl) cta.appendChild(btn('line lg', 'Uygulamayı aç', openUrl.replace('{code}', '')));
  }
  window.KMAuth.ready.then(run);
})();

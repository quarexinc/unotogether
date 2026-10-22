// Yönlendirme kuralları: yönetici panelinden tanımlanan uyarılar, bantlar ve yönlendirmeler.
// Sunucu yalnızca bu ziyaretçiye uyan kuralları gönderir; yöneticiler kurallardan muaftır.
(function () {
  'use strict';
  const path = (location.pathname.replace(/\/$/, '') || '/');
  const store = {
    get(area, k) { try { return window[area].getItem(k); } catch { return null; } },
    set(area, k, v) { try { window[area].setItem(k, v); } catch { /* depolama kapalı */ } },
  };
  const pathOf = (u) => {
    try {
      const x = new URL(u, location.origin);
      return x.origin === location.origin ? (x.pathname.replace(/\/$/, '') || '/') : null;
    } catch { return null; }
  };
  const targetOf = (r) => (r.action === 'redirect' ? r.url : r.ctaUrl);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const send = (id, ev) => {
    try {
      fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'gate_event', id, ev }), keepalive: true, credentials: 'same-origin' }).catch(() => {});
    } catch { /* ağ yok */ }
  };

  function frequencyOk(r) {
    const k = 'km-g-' + r.id;
    if (r.freq === 'session') return !store.get('sessionStorage', k);
    if (r.freq === 'once') return !store.get('localStorage', k);
    if (r.freq === 'hours') {
      const t = Number(store.get('localStorage', k)) || 0;
      return Date.now() - t > r.hours * 3600_000;
    }
    return true;
  }
  function mark(r) {
    const k = 'km-g-' + r.id;
    if (r.freq === 'session') store.set('sessionStorage', k, '1');
    else if (r.freq === 'once') store.set('localStorage', k, '1');
    else if (r.freq === 'hours') store.set('localStorage', k, String(Date.now()));
  }
  function allowed(r) {
    if (r.pages === 'home' && path !== '/') return false;
    const tp = targetOf(r) ? pathOf(targetOf(r)) : null;
    if (tp && tp === path) return false; // zaten hedef sayfadayız
    return frequencyOk(r);
  }

  // ---------- görünümler ----------
  function showPopup(r, preview) {
    const wrap = el('div', 'modal gate-modal');
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
    const sheet = el('div', 'sheet');
    const close = (ev) => {
      if (!preview && ev) send(r.id, ev);
      wrap.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape' && r.dismissable) close('dismiss'); };
    if (r.dismissable) {
      const x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Kapat');
      x.addEventListener('click', () => close('dismiss'));
      sheet.appendChild(x);
      wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close('dismiss'); });
    }
    if (r.title) { const h = el('h2', null, r.title); h.id = 'gate-h-' + r.id; wrap.setAttribute('aria-labelledby', h.id); sheet.appendChild(h); }
    if (r.message) sheet.appendChild(el('p', 'sub', r.message));
    if (r.ctaLabel && r.ctaUrl) {
      const a = el('a', 'btn hot lg wide', r.ctaLabel);
      a.href = preview ? '#' : r.ctaUrl;
      a.addEventListener('click', (e) => {
        if (preview) { e.preventDefault(); return; }
        send(r.id, 'click');
        if (pathOf(r.ctaUrl) === path) { e.preventDefault(); close(); }
      });
      sheet.appendChild(a);
    }
    if (r.dismissable) {
      const later = el('button', 'btn line lg wide', r.laterLabel || 'Daha sonra'); later.type = 'button';
      later.addEventListener('click', () => close('dismiss'));
      sheet.appendChild(later);
    }
    wrap.appendChild(sheet);
    document.body.appendChild(wrap);
    document.addEventListener('keydown', onKey);
    const first = sheet.querySelector('a, button');
    if (first) setTimeout(() => first.focus(), 30);
    return wrap;
  }

  function showBanner(r, preview) {
    const bar = el('div', 'gate-banner');
    bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Duyuru');
    const txt = el('p');
    if (r.title) txt.appendChild(el('b', null, r.title + ' '));
    if (r.message) txt.appendChild(document.createTextNode(r.message));
    bar.appendChild(txt);
    if (r.ctaLabel && r.ctaUrl) {
      const a = el('a', 'btn hot sm', r.ctaLabel);
      a.href = preview ? '#' : r.ctaUrl;
      a.addEventListener('click', (e) => { if (preview) e.preventDefault(); else send(r.id, 'click'); });
      bar.appendChild(a);
    }
    if (r.dismissable) {
      const x = el('button', 'gate-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Kapat');
      x.addEventListener('click', () => { bar.remove(); if (!preview) send(r.id, 'dismiss'); });
      bar.appendChild(x);
    }
    document.body.insertBefore(bar, document.body.firstChild);
    return bar;
  }

  function execute(r) {
    mark(r);
    send(r.id, 'shown');
    if (r.action === 'redirect') { send(r.id, 'click'); location.href = r.url; return; }
    if (r.action === 'banner') showBanner(r); else showPopup(r);
  }

  // ---------- tetikleyiciler ----------
  function install(rules) {
    // zamanlı kurallar (sayfa açılınca)
    for (const r of rules.filter((x) => x.trigger === 'load' || x.action === 'banner')) {
      setTimeout(() => { if (allowed(r)) execute(r); }, r.delay * 1000);
    }
    const clickRules = rules.filter((x) => x.trigger === 'click' && x.action !== 'banner');
    const createRules = rules.filter((x) => x.trigger === 'create' && x.action !== 'banner');
    const joinRules = rules.filter((x) => x.trigger === 'join' && x.action !== 'banner');
    if (!clickRules.length && !createRules.length && !joinRules.length) return;
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('.gate-modal, .gate-banner, .acct-pop')) return; // kendi pencerelerimiz ve hesap menüsü
      const pick = (list) => {
        const link = t.closest('a[href]');
        const lp = link ? pathOf(link.getAttribute('href')) : null;
        return list.find((r) => allowed(r) && !(lp && lp === pathOf(targetOf(r) || '')));
      };
      let r = null;
      if (t.closest('[data-open="create"], .mode')) r = pick(createRules);
      else if (t.closest('[data-open="join"], .roomitem button')) r = pick(joinRules);
      if (!r) r = pick(clickRules);
      if (!r) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      execute(r);
    }, true);
  }

  window.KMGates = { preview(r) { return r.action === 'banner' ? showBanner(r, true) : showPopup(r, true); } };

  // Giriş sayfası hiçbir zaman engellenmez; yönetici dışarıda kalmasın.
  if (path === '/giris' || path === '/admin') return;

  fetch('/api/auth?a=gates', { cache: 'no-store', credentials: 'same-origin' })
    .then((res) => (res.ok ? res.json() : null))
    .then((j) => { if (j && Array.isArray(j.rules) && j.rules.length) install(j.rules); })
    .catch(() => {});

  // Misafirken indirip sonra kayıt olanları "indirdi" say.
  if (window.KMAuth) {
    window.KMAuth.onReady((s) => {
      if (s.user && !s.user.dl && store.get('localStorage', 'km-dl')) {
        fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'dl_click' }), credentials: 'same-origin' }).catch(() => {});
      }
    });
  }
})();

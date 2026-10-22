// Ortak hesap betiği: oturumu sorgular, üst çubuktaki hesap menüsünü kurar.
(function () {
  'use strict';
  const state = { user: null, perms: {}, registration: 'open', ready: false };
  const listeners = [];
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const here = () => location.pathname + location.search;

  async function call(method, body) {
    const res = await fetch('/api/auth' + (method === 'GET' && body ? '?' + new URLSearchParams(body) : ''), {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
      body: method === 'POST' ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      credentials: 'same-origin',
    });
    let j = null;
    try { j = await res.json(); } catch { /* gövde yok */ }
    if (!res.ok) throw Object.assign(new Error((j && j.error) || 'server'), { code: (j && j.error) || 'server', status: res.status });
    return j;
  }

  function render() {
    const host = document.getElementById('acct');
    if (!host) return;
    host.textContent = '';
    if (!state.user) {
      const a = el('a', 'btn line sm', 'Giriş');
      a.href = '/giris?next=' + encodeURIComponent(here());
      host.appendChild(a);
      return;
    }
    const btn = el('button', 'acct-btn');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    const dot = el('span', 'acct-dot', (state.user.display || state.user.username).slice(0, 1).toUpperCase());
    const name = el('span', 'acct-name', state.user.display || state.user.username);
    btn.append(dot, name);
    const pop = el('div', 'acct-pop');
    pop.hidden = true;
    const who = el('div', 'acct-who');
    who.append(el('b', null, state.user.display || state.user.username), el('small', null, '@' + state.user.username + (state.user.role === 'admin' ? ' · yönetici' : '')));
    pop.appendChild(who);
    const link = (href, text) => { const a = el('a', null, text); a.href = href; return a; };
    if (state.user.role === 'admin') pop.appendChild(link('/admin', 'Yönetim paneli'));
    pop.appendChild(link('/indir', 'Uygulamayı indir'));
    const out = el('button', null, 'Çıkış yap');
    out.type = 'button';
    out.addEventListener('click', async () => {
      try { await call('POST', { a: 'logout' }); } catch { /* yine de yenile */ }
      location.reload();
    });
    pop.appendChild(out);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
      btn.setAttribute('aria-expanded', String(!pop.hidden));
    });
    host.append(btn, pop);
  }
  document.addEventListener('click', () => {
    const pop = document.querySelector('.acct-pop');
    if (pop && !pop.hidden) {
      pop.hidden = true;
      const b = document.querySelector('.acct-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    }
  });

  async function refresh() {
    try {
      const j = await call('GET');
      state.user = j.user; state.perms = j.perms || {}; state.registration = j.registration || 'open';
    } catch { state.user = null; }
    state.ready = true;
    render();
    listeners.splice(0).forEach((f) => { try { f(state); } catch { /* dinleyici hatası */ } });
    document.dispatchEvent(new CustomEvent('km:auth', { detail: state }));
    return state;
  }
  const ready = refresh();
  window.KMAuth = {
    state, ready, refresh, call,
    onReady(fn) { if (state.ready) fn(state); else listeners.push(fn); },
  };
})();

(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const PERMS = [
    ['create', 'Oda kur'],
    ['join', 'Odaya katıl'],
    ['chat', 'Sohbet'],
    ['start', 'Odayı başlat'],
    ['download', 'Uygulamayı indir'],
  ];
  const MODE = { standart: 'Standart', parti: 'Parti', hizli: 'Hızlı' };
  const ERR = {
    login_required: 'Oturum bulunamadı. Tekrar giriş yap.',
    admin_only: 'Bu işlem için yönetici olmalısın.',
    self: 'Kendi hesabında bu değişikliği yapamazsın.',
    no_user: 'Kullanıcı bulunamadı.',
    not_found: 'Oda artık yok.',
    need_players: 'Odayı başlatmak için en az 2 oyuncu gerekir.',
    password: 'Parola en az 8 karakter olmalı.',
    app_url: 'İndirme bağlantısı https:// ile başlayan geçerli bir adres olmalı.',
    app_open_url: 'Açma bağlantısı geçerli bir şemayla başlamalı (örn. kartmasa://oda/{code}). javascript: ve benzerleri kabul edilmez.',
    busy: 'Kayıt meşgul, tekrar dene.',
  };
  const msg = (e) => ERR[e && e.code] || 'Bir sorun oluştu. Tekrar dene.';

  function h(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of kids.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  }

  async function api(method, body, qs) {
    const res = await fetch('/api/admin' + (qs ? '?' + new URLSearchParams(qs) : ''), {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      credentials: 'same-origin',
    });
    let j = null;
    try { j = await res.json(); } catch { /* gövde yok */ }
    if (!res.ok) throw Object.assign(new Error((j && j.error) || 'server'), { code: (j && j.error) || 'server', status: res.status });
    return j;
  }

  const S = { users: [], me: '', rooms: [], settings: null, tab: 'users', q: '' };

  // ---------- kapı ----------
  function gate(title, text, links) {
    $('#gate').hidden = false; $('#adm').hidden = true;
    $('#gate-h').textContent = title; $('#gate-p').textContent = text;
    const c = $('#gate-cta'); c.textContent = '';
    for (const [href, label, cls] of links) c.append(h('a', { class: 'btn ' + cls, href, text: label }));
  }

  // ---------- istatistik ----------
  function stats() {
    const active = S.users.filter((u) => u.status === 'active').length;
    const pending = S.users.filter((u) => u.status === 'pending').length;
    const players = S.rooms.reduce((s, r) => s + r.players.length, 0);
    const box = $('#stats'); box.textContent = '';
    for (const [n, l] of [[S.users.length, 'Kullanıcı'], [active, 'Aktif'], [pending, 'Onay bekleyen'], [S.rooms.length, 'Açık oda'], [players, 'Odadaki oyuncu']]) {
      box.append(h('div', { class: 'stat' }, h('b', { text: String(n) }), h('span', { text: l })));
    }
  }

  // ---------- kullanıcılar ----------
  const fmt = (t) => (t ? new Date(t).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : 'hiç');
  const STATUS = { active: ['Aktif', 'ok'], pending: ['Onay bekliyor', 'warn'], blocked: ['Engelli', 'hot'] };

  async function patch(username, p, errEl) {
    errEl.textContent = '';
    try {
      const r = await api('POST', { a: 'user', username, patch: p });
      const i = S.users.findIndex((u) => u.username === username);
      if (i >= 0) S.users[i] = r.user;
      renderUsers(); stats();
    } catch (e) { errEl.textContent = msg(e); renderUsers(); }
  }

  function userRow(u) {
    const self = u.username === S.me;
    const isAdmin = u.role === 'admin';
    const [stText, stCls] = STATUS[u.status] || [u.status, ''];
    const err = h('p', { class: 'err', role: 'alert' });
    const badges = h('div', { class: 'badges' },
      isAdmin ? h('span', { class: 'tag hot', text: 'Yönetici' }) : null,
      h('span', { class: 'tag ' + stCls, text: stText }),
      self ? h('span', { class: 'tag', text: 'Sen' }) : null);
    const head = h('div', { class: 'uhead' },
      h('span', { class: 'acct-dot', text: (u.display || u.username).slice(0, 1).toUpperCase() }),
      h('div', { class: 'uname' }, h('b', { text: u.display }), h('small', { text: `@${u.username} · son giriş: ${fmt(u.lastLogin)}` })),
      badges);

    const perms = h('div', { class: 'perms', role: 'group', 'aria-label': 'Yetkiler' });
    for (const [k, label] of PERMS) {
      const on = isAdmin || !!u.perms[k];
      perms.append(h('button', {
        type: 'button', class: 'perm', 'aria-pressed': String(on), disabled: isAdmin,
        title: isAdmin ? 'Yöneticilerin tüm yetkileri vardır' : null,
        onclick: () => patch(u.username, { perms: { [k]: !on } }, err),
      }, label));
    }

    const act = h('div', { class: 'uact' });
    if (u.status === 'pending') act.append(h('button', { class: 'btn hot sm', type: 'button', onclick: () => patch(u.username, { status: 'active' }, err) }, 'Onayla'));
    if (!self) {
      if (u.status === 'blocked') act.append(h('button', { class: 'btn line sm', type: 'button', onclick: () => patch(u.username, { status: 'active' }, err) }, 'Engeli kaldır'));
      else act.append(h('button', { class: 'btn line sm', type: 'button', onclick: () => patch(u.username, { status: 'blocked' }, err) }, 'Engelle'));
      act.append(h('button', { class: 'btn line sm', type: 'button', onclick: () => patch(u.username, { role: isAdmin ? 'user' : 'admin' }, err) }, isAdmin ? 'Yöneticiliği al' : 'Yönetici yap'));
    }
    // parola sıfırlama (satır içi)
    const pw = h('input', { type: 'text', placeholder: 'Yeni parola (en az 8)', maxlength: '100', autocomplete: 'off', 'aria-label': 'Yeni parola', hidden: true });
    const pwGo = h('button', { class: 'btn hot sm', type: 'button', hidden: true }, 'Kaydet');
    const pwBtn = h('button', { class: 'btn line sm', type: 'button' }, 'Parolayı sıfırla');
    pwBtn.addEventListener('click', () => { pw.hidden = false; pwGo.hidden = false; pwBtn.hidden = true; pw.focus(); });
    pwGo.addEventListener('click', async () => {
      err.textContent = '';
      try {
        await api('POST', { a: 'reset_password', username: u.username, password: pw.value });
        pw.value = ''; pw.hidden = true; pwGo.hidden = true; pwBtn.hidden = false;
        pwBtn.textContent = 'Parola değişti ✓';
        setTimeout(() => { pwBtn.textContent = 'Parolayı sıfırla'; }, 2500);
      } catch (e) { err.textContent = msg(e); }
    });
    act.append(pwBtn, pw, pwGo);
    if (!self) {
      const del = h('button', { class: 'btn danger sm', type: 'button' }, 'Sil');
      let armed = false;
      del.addEventListener('click', async () => {
        if (!armed) {
          armed = true; del.textContent = 'Emin misin? Tekrar tıkla';
          setTimeout(() => { armed = false; del.textContent = 'Sil'; }, 3500);
          return;
        }
        try {
          await api('POST', { a: 'delete_user', username: u.username });
          S.users = S.users.filter((x) => x.username !== u.username);
          renderUsers(); stats();
        } catch (e) { err.textContent = msg(e); }
      });
      act.append(del);
    }
    return h('article', { class: 'urow ' + u.status }, head, perms, act, err);
  }

  function renderUsers() {
    const q = S.q.trim().toLowerCase();
    const rows = S.users.filter((u) => !q || u.username.includes(q) || (u.display || '').toLowerCase().includes(q));
    // önce onay bekleyenler
    rows.sort((a, b) => (b.status === 'pending') - (a.status === 'pending') || a.created - b.created);
    const box = $('#ulist'); box.textContent = '';
    if (!rows.length) { box.append(h('p', { class: 'empty', text: q ? 'Eşleşen kullanıcı yok.' : 'Henüz kullanıcı yok.' })); return; }
    for (const u of rows) box.append(userRow(u));
  }

  async function loadUsers() {
    try {
      const r = await api('GET', null, { a: 'users' });
      S.users = r.users; S.me = r.me;
      $('#err-users').textContent = '';
    } catch (e) { $('#err-users').textContent = msg(e); }
    renderUsers(); stats();
  }

  // ---------- odalar ----------
  async function roomOp(a, code, pid) {
    $('#err-rooms').textContent = '';
    try {
      const r = await api('POST', { a, code, pid });
      S.rooms = r.rooms;
    } catch (e) {
      $('#err-rooms').textContent = msg(e);
      await loadRooms();
      return;
    }
    renderRooms(); stats();
  }

  function roomCard(r) {
    const closeBtn = h('button', { class: 'btn danger sm', type: 'button' }, 'Odayı kapat');
    let armed = false;
    closeBtn.addEventListener('click', () => {
      if (!armed) {
        armed = true; closeBtn.textContent = 'Emin misin? Tekrar tıkla';
        setTimeout(() => { armed = false; closeBtn.textContent = 'Odayı kapat'; }, 3500);
        return;
      }
      roomOp('room_close', r.code);
    });
    const list = h('ul');
    for (const p of r.players) {
      list.append(h('li', null,
        h('span', { class: 'on-dot' + (p.online ? ' on' : ''), title: p.online ? 'Çevrimiçi' : 'Çevrimdışı' }),
        h('span', { class: 'nm', text: p.name }),
        p.host ? h('span', { class: 'tag hot', text: 'Ev sahibi' }) : null,
        p.uid ? h('small', { text: '@' + p.uid }) : h('small', { text: 'misafir' }),
        h('button', { class: 'btn line sm', type: 'button', 'aria-label': p.name + ' oyuncusunu at', onclick: () => roomOp('room_kick', r.code, p.id) }, 'At')));
    }
    const ready = r.status === 'ready';
    return h('article', { class: 'rcard' },
      h('header', null,
        h('code', { text: r.code }),
        h('span', { class: 'tag', text: MODE[r.mode] || r.mode }),
        h('span', { class: 'tag ' + (ready ? 'hot' : ''), text: ready ? 'Hazır' : 'Bekliyor' }),
        h('span', { class: 'note', text: `${r.players.length}/${r.cap} oyuncu` })),
      list,
      h('div', { class: 'uact' },
        ready
          ? h('button', { class: 'btn line sm', type: 'button', onclick: () => roomOp('room_reopen', r.code) }, 'Yeniden aç')
          : h('button', { class: 'btn hot sm', type: 'button', disabled: r.players.length < 2, onclick: () => roomOp('room_start', r.code) }, 'Odayı başlat'),
        closeBtn));
  }

  function renderRooms() {
    const box = $('#rlist'); box.textContent = '';
    if (!S.rooms.length) { box.append(h('p', { class: 'empty', text: 'Şu anda açık oda yok.' })); return; }
    for (const r of S.rooms) box.append(roomCard(r));
  }

  async function loadRooms() {
    try {
      S.rooms = (await api('GET', null, { a: 'rooms' })).rooms;
      $('#err-rooms').textContent = '';
    } catch (e) { $('#err-rooms').textContent = msg(e); }
    renderRooms(); stats();
  }

  // ---------- ayarlar ----------
  function permToggles(box, obj) {
    box.textContent = '';
    for (const [k, label] of PERMS) {
      const b = h('button', { type: 'button', class: 'perm', 'aria-pressed': String(!!obj[k]) }, label);
      b.addEventListener('click', () => {
        obj[k] = !obj[k];
        b.setAttribute('aria-pressed', String(obj[k]));
      });
      box.append(b);
    }
  }
  function renderSettings() {
    const s = S.settings;
    for (const r of document.querySelectorAll('input[name="registration"]')) r.checked = r.value === s.registration;
    permToggles($('#guest-perms'), s.guest);
    permToggles($('#member-perms'), s.member);
    $('#app-url').value = s.appUrl || '';
    $('#app-open').value = s.appOpenUrl || '';
  }
  async function loadSettings() {
    try { S.settings = (await api('GET', null, { a: 'settings' })).settings; renderSettings(); } catch (e) { $('#err-settings').textContent = msg(e); }
  }
  $('#f-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#save-settings');
    btn.disabled = true; $('#err-settings').textContent = ''; $('#ok-settings').textContent = '';
    try {
      const reg = document.querySelector('input[name="registration"]:checked');
      const r = await api('POST', {
        a: 'settings',
        settings: {
          registration: reg ? reg.value : undefined,
          guest: S.settings.guest, member: S.settings.member,
          appUrl: $('#app-url').value, appOpenUrl: $('#app-open').value,
        },
      });
      S.settings = r.settings; renderSettings();
      $('#ok-settings').textContent = 'Kaydedildi.';
    } catch (e2) { $('#err-settings').textContent = msg(e2); } finally { btn.disabled = false; }
  });

  // ---------- sekmeler ----------
  let timer = null;
  function setTab(t) {
    S.tab = t;
    for (const b of document.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === t));
    for (const id of ['users', 'rooms', 'settings']) $('#tab-' + id).hidden = id !== t;
    clearInterval(timer);
    if (t === 'rooms') { loadRooms(); timer = setInterval(() => { if (!document.hidden) loadRooms(); }, 5000); }
    if (t === 'settings') loadSettings();
    if (t === 'users') loadUsers();
  }
  for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => setTab(b.dataset.tab));
  $('#q').addEventListener('input', (e) => { S.q = e.target.value; renderUsers(); });
  $('#reload-users').addEventListener('click', loadUsers);
  $('#reload-rooms').addEventListener('click', loadRooms);

  // ---------- başlangıç ----------
  window.KMAuth.ready.then(async (s) => {
    if (!s.user) return gate('Giriş gerekli', 'Yönetim paneli için yönetici hesabınla giriş yapmalısın.', [['/giris?next=/admin', 'Giriş yap', 'hot']]);
    if (s.user.role !== 'admin') return gate('Yetkin yok', 'Bu sayfa yalnızca yöneticilere açık.', [['/', 'Ana sayfaya dön', 'line']]);
    $('#gate').hidden = true; $('#adm').hidden = false;
    await Promise.all([loadUsers(), loadRooms()]);
    S.tab = 'users';
  });
})();

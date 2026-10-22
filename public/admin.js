(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const PERMS = [['create', 'Oda kur'], ['join', 'Odaya katıl'], ['chat', 'Sohbet'], ['start', 'Odayı başlat'], ['download', 'Uygulamayı indir'], ['media', 'Ses ve kamera']];
  const MODE = { standart: 'Standart', parti: 'Parti', hizli: 'Hızlı' };
  const ERR = {
    login_required: 'Oturum bulunamadı. Tekrar giriş yap.', admin_only: 'Bu işlem için yönetici olmalısın.',
    self: 'Kendi hesabında bu değişikliği yapamazsın.', no_user: 'Kullanıcı bulunamadı.', not_found: 'Oda artık yok.',
    need_players: 'Odayı başlatmak için en az 2 oyuncu gerekir.', password: 'Parola en az 8 karakter olmalı.',
    app_url: 'İndirme bağlantısı https:// ile başlayan geçerli bir adres olmalı.',
    app_open_url: 'Açma bağlantısı geçerli bir şemayla başlamalı (örn. kartmasa://oda/{code}). javascript: ve benzerleri kabul edilmez.',
    gate_url: 'Adres, sitenin kendi yolu (/indir gibi) ya da https:// ile başlayan bir adres olmalı.',
    gate_text: 'Pencere ve bant kurallarında başlık ya da mesajdan en az biri gerekir.',
    gate_many: 'En fazla 30 kural eklenebilir.', gate: 'Kural geçersiz.',
    turn_url: 'TURN adresi turn: veya turns: ile başlamalı (örn. turn:sunucu.com:3478).',
    chat_slow: 'Yavaş mod 0–10000 ms arasında olmalı.', max_rooms: 'Oda sınırı 0–500 arasında bir sayı olmalı.',
    text: 'Mesaj boş olamaz.', busy: 'Kayıt meşgul, tekrar dene.', perm: 'Yetki geçersiz.',
  };
  const msg = (e) => ERR[e && e.code] || 'Bir sorun oluştu. Tekrar dene.';

  function h(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'value') n.value = v;
        else if (k === 'checked') n.checked = !!v;
        else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  }
  const clear = (n) => { n.textContent = ''; return n; };

  async function api(method, body, qs) {
    const res = await fetch('/api/admin' + (qs ? '?' + new URLSearchParams(qs) : ''), {
      method, headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'same-origin',
    });
    let j = null;
    try { j = await res.json(); } catch { /* gövde yok */ }
    if (!res.ok) throw Object.assign(new Error((j && j.error) || 'server'), { code: (j && j.error) || 'server', status: res.status });
    return j;
  }

  const S = {
    users: [], me: '', rooms: [], settings: null, rules: [], rulesJson: '[]', stats: { rules: {}, dl: 0, dlUsers: 0 }, log: [],
    tab: 'overview', f: { q: '', status: '', role: '', app: '', sort: 'new' }, sel: new Set(), open: null, chat: {}, say: {},
  };
  const fmt = (t) => (t ? new Date(t).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : 'hiç');
  const note = (text, cls) => h('p', { class: cls || 'note', text });
  const msgBox = () => h('p', { class: 'err', role: 'alert' });
  const okBox = () => h('p', { class: 'ok', role: 'status' });
  const flash = (box, text, ms = 2500) => { box.textContent = text; setTimeout(() => { if (box.textContent === text) box.textContent = ''; }, ms); };
  const tab = (id) => $('#tab-' + id);

  // ---------- kapı ----------
  function gate(title, text, links) {
    $('#gate').hidden = false; $('#adm').hidden = true;
    $('#gate-h').textContent = title; $('#gate-p').textContent = text;
    const c = clear($('#gate-cta'));
    for (const [href, label, cls] of links) c.append(h('a', { class: 'btn ' + cls, href, text: label }));
  }

  // ---------- veri yükleme ----------
  async function loadUsers() { const r = await api('GET', null, { a: 'users' }); S.users = r.users; S.me = r.me; }
  async function loadRooms() { S.rooms = (await api('GET', null, { a: 'rooms' })).rooms; }
  async function loadSettings() { S.settings = (await api('GET', null, { a: 'settings' })).settings; }
  async function loadGates() {
    const r = await api('GET', null, { a: 'gates' });
    S.rules = r.rules; S.rulesJson = JSON.stringify(r.rules); S.stats = r.stats;
  }
  async function loadLog() { S.log = (await api('GET', null, { a: 'log' })).items; }

  // ---------- küçük bileşenler ----------
  const toggle = (label, on, onClick, disabled) => h('button', { type: 'button', class: 'perm', 'aria-pressed': String(!!on), disabled, onclick: onClick }, label);
  const statCard = (n, l) => h('div', { class: 'stat' }, h('b', { text: String(n) }), h('span', { text: l }));
  const dotAv = (u) => h('span', { class: 'acct-dot', text: (u.display || u.username || '?').slice(0, 1).toUpperCase() });
  const field = (label, control, hint) => h('label', { class: 'field' }, h('span', { text: label }), control, hint ? h('small', { class: 'hint', text: hint }) : null);
  const input = (props) => h('input', { maxlength: '200', ...props });

  // =========================================================
  // GENEL BAKIŞ
  // =========================================================
  function renderOverview() {
    const box = clear(tab('overview'));
    const u = S.users;
    const day = 24 * 3600_000;
    const players = S.rooms.reduce((s, r) => s + r.players.length, 0);
    box.append(h('div', { class: 'stats' },
      statCard(u.length, 'Kullanıcı'), statCard(u.filter((x) => x.status === 'active').length, 'Aktif'),
      statCard(u.filter((x) => x.status === 'pending').length, 'Onay bekleyen'), statCard(u.filter((x) => x.status === 'blocked').length, 'Engelli'),
      statCard(u.filter((x) => x.role === 'admin').length, 'Yönetici'), statCard(u.filter((x) => Date.now() - x.created < day).length, 'Son 24 saatte kayıt'),
      statCard(S.rooms.length, 'Açık oda'), statCard(players, 'Odadaki oyuncu'),
      statCard(S.stats.dl || 0, 'İndirme tıklaması'), statCard(u.filter((x) => x.dl).length, 'Uygulamayı indiren üye')));

    // son 14 gün kayıt grafiği
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const from = d.getTime();
      days.push({ d, n: u.filter((x) => x.created >= from && x.created < from + day).length });
    }
    const max = Math.max(1, ...days.map((x) => x.n));
    const chart = h('div', { class: 'bars', role: 'img', 'aria-label': 'Son 14 günün kayıt sayıları' });
    for (const x of days) {
      chart.append(h('div', { class: 'bar-col', title: `${x.d.toLocaleDateString('tr-TR')}: ${x.n} kayıt` },
        h('i', { style: `height:${Math.max(4, Math.round((x.n / max) * 100))}%` }), h('span', { text: String(x.d.getDate()) })));
    }
    box.append(h('div', { class: 'panel' }, h('h2', { text: 'Son 14 günde kayıt' }), chart));

    // hızlı işlemler
    const bcMsg = msgBox(); const bcOk = okBox();
    const bc = input({ placeholder: 'Tüm açık odalara duyuru yaz…', maxlength: '200', 'aria-label': 'Duyuru' });
    const bcBtn = h('button', { class: 'btn hot', type: 'button' }, 'Tüm odalara gönder');
    bcBtn.addEventListener('click', async () => {
      bcMsg.textContent = '';
      try { const r = await api('POST', { a: 'broadcast', text: bc.value }); bc.value = ''; flash(bcOk, `${r.rooms} odaya gönderildi.`); } catch (e) { bcMsg.textContent = msg(e); }
    });
    const regSel = h('div', { class: 'perms' });
    const regs = [['open', 'Kayıt açık'], ['approval', 'Onaylı kayıt'], ['closed', 'Kayıt kapalı']];
    const paintReg = () => {
      clear(regSel);
      for (const [v, l] of regs) {
        regSel.append(toggle(l, S.settings && S.settings.registration === v, async () => {
          try { S.settings = (await api('POST', { a: 'settings', settings: { registration: v } })).settings; paintReg(); } catch (e) { bcMsg.textContent = msg(e); }
        }));
      }
    };
    paintReg();
    box.append(h('div', { class: 'form-grid' },
      h('div', { class: 'panel' }, h('h2', { text: 'Hızlı duyuru' }), note('Mesaj açık odaların sohbetinde “Duyuru” olarak görünür.'), h('div', { class: 'uact' }, bc, bcBtn), bcMsg, bcOk),
      h('div', { class: 'panel' }, h('h2', { text: 'Kayıt durumu' }), regSel, note('Ayrıntılı ayarlar için Ayarlar sekmesine bak.'))));

    // son hareketler
    const last = h('div', { class: 'logmini' });
    for (const it of S.log.slice(0, 8)) last.append(h('p', null, h('b', { text: it.ev }), ` · ${it.who} · ${it.d || ''} `, h('small', { text: fmt(it.t) })));
    if (!S.log.length) last.append(note('Henüz kayıt yok.'));
    box.append(h('div', { class: 'panel' }, h('h2', { text: 'Son hareketler' }), last));
  }

  // =========================================================
  // KULLANICILAR
  // =========================================================
  const STATUS = { active: ['Aktif', 'ok'], pending: ['Onay bekliyor', 'warn'], blocked: ['Engelli', 'hot'] };

  function filteredUsers() {
    const f = S.f; const q = f.q.trim().toLowerCase();
    let rows = S.users.filter((u) =>
      (!q || u.username.includes(q) || (u.display || '').toLowerCase().includes(q) || (u.note || '').toLowerCase().includes(q)) &&
      (!f.status || u.status === f.status) && (!f.role || u.role === f.role) &&
      (!f.app || (f.app === 'yes' ? u.dl : !u.dl)));
    const by = { new: (a, b) => b.created - a.created, old: (a, b) => a.created - b.created, login: (a, b) => (b.lastLogin || 0) - (a.lastLogin || 0), name: (a, b) => a.username.localeCompare(b.username) };
    rows.sort((a, b) => (b.status === 'pending') - (a.status === 'pending') || by[f.sort](a, b));
    return rows;
  }

  async function patch(username, p, errEl) {
    errEl.textContent = '';
    try {
      const r = await api('POST', { a: 'user', username, patch: p });
      const i = S.users.findIndex((u) => u.username === username);
      if (i >= 0) S.users[i] = r.user;
      renderUsers();
    } catch (e) { errEl.textContent = msg(e); renderUsers(); }
  }

  function csv(rows) {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['kullanici_adi', 'gorunen_ad', 'rol', 'durum', 'kayit', 'son_giris', 'uygulamayi_indirdi', 'yetkiler', 'not'];
    const lines = [head.join(',')];
    for (const u of rows) {
      lines.push([u.username, u.display, u.role, u.status, new Date(u.created).toISOString(), u.lastLogin ? new Date(u.lastLogin).toISOString() : '',
        u.dl ? 'evet' : 'hayır', Object.entries(u.perms).filter(([, v]) => v).map(([k]) => k).join(' '), u.note].map(q).join(','));
    }
    return '﻿' + lines.join('\n');
  }

  function userRow(u) {
    const self = u.username === S.me; const isAdmin = u.role === 'admin';
    const [stText, stCls] = STATUS[u.status] || [u.status, ''];
    const err = msgBox();
    const chk = h('input', { type: 'checkbox', 'aria-label': u.username + ' seç', checked: S.sel.has(u.username), disabled: self, class: 'selbox' });
    chk.addEventListener('change', () => { if (chk.checked) S.sel.add(u.username); else S.sel.delete(u.username); renderBulkBar(); });
    const head = h('div', { class: 'uhead' }, chk, dotAv(u),
      h('div', { class: 'uname' }, h('b', { text: u.display }), h('small', { text: `@${u.username} · kayıt ${fmt(u.created)} · son giriş ${fmt(u.lastLogin)}` })),
      h('div', { class: 'badges' },
        isAdmin ? h('span', { class: 'tag hot', text: 'Yönetici' }) : null, h('span', { class: 'tag ' + stCls, text: stText }),
        u.dl ? h('span', { class: 'tag ok', text: 'Uygulamayı indirdi' }) : h('span', { class: 'tag', text: 'İndirmedi' }),
        self ? h('span', { class: 'tag', text: 'Sen' }) : null));
    const perms = h('div', { class: 'perms', role: 'group', 'aria-label': 'Yetkiler' });
    for (const [k, label] of PERMS) {
      const on = isAdmin || !!u.perms[k];
      perms.append(h('button', { type: 'button', class: 'perm', 'aria-pressed': String(on), disabled: isAdmin, title: isAdmin ? 'Yöneticilerin tüm yetkileri vardır' : null, onclick: () => patch(u.username, { perms: { [k]: !on } }, err) }, label));
    }
    const noteIn = input({ class: 'notein', placeholder: 'Yönetici notu (yalnızca sen görürsün)', value: u.note || '', maxlength: '200', 'aria-label': u.username + ' notu' });
    noteIn.addEventListener('change', () => patch(u.username, { note: noteIn.value }, err));

    const act = h('div', { class: 'uact' });
    if (u.status === 'pending') act.append(h('button', { class: 'btn hot sm', type: 'button', onclick: () => patch(u.username, { status: 'active' }, err) }, 'Onayla'));
    if (!self) {
      act.append(u.status === 'blocked'
        ? h('button', { class: 'btn line sm', type: 'button', onclick: () => patch(u.username, { status: 'active' }, err) }, 'Engeli kaldır')
        : h('button', { class: 'btn line sm', type: 'button', onclick: () => patch(u.username, { status: 'blocked' }, err) }, 'Engelle'));
      act.append(h('button', { class: 'btn line sm', type: 'button', onclick: () => patch(u.username, { role: isAdmin ? 'user' : 'admin' }, err) }, isAdmin ? 'Yöneticiliği al' : 'Yönetici yap'));
      act.append(h('button', { class: 'btn line sm', type: 'button', onclick: async () => { try { await api('POST', { a: 'logout_user', username: u.username }); err.textContent = ''; flashBtn(err, 'Oturumları kapatıldı.'); } catch (e) { err.textContent = msg(e); } } }, 'Oturumu kapat'));
    }
    const pw = h('input', { type: 'text', placeholder: 'Yeni parola (en az 8)', maxlength: '100', autocomplete: 'off', 'aria-label': 'Yeni parola', hidden: true });
    const pwGo = h('button', { class: 'btn hot sm', type: 'button', hidden: true }, 'Kaydet');
    const pwBtn = h('button', { class: 'btn line sm', type: 'button' }, 'Parolayı sıfırla');
    pwBtn.addEventListener('click', () => { pw.hidden = false; pwGo.hidden = false; pwBtn.hidden = true; pw.focus(); });
    pwGo.addEventListener('click', async () => {
      err.textContent = '';
      try {
        await api('POST', { a: 'reset_password', username: u.username, password: pw.value });
        pw.value = ''; pw.hidden = true; pwGo.hidden = true; pwBtn.hidden = false; pwBtn.textContent = 'Parola değişti ✓';
        setTimeout(() => { pwBtn.textContent = 'Parolayı sıfırla'; }, 2500);
      } catch (e) { err.textContent = msg(e); }
    });
    act.append(pwBtn, pw, pwGo);
    if (!self) {
      const del = h('button', { class: 'btn danger sm', type: 'button' }, 'Sil');
      let armed = false;
      del.addEventListener('click', async () => {
        if (!armed) { armed = true; del.textContent = 'Emin misin? Tekrar tıkla'; setTimeout(() => { armed = false; del.textContent = 'Sil'; }, 3500); return; }
        try { await api('POST', { a: 'delete_user', username: u.username }); S.users = S.users.filter((x) => x.username !== u.username); S.sel.delete(u.username); renderUsers(); } catch (e) { err.textContent = msg(e); }
      });
      act.append(del);
    }
    return h('article', { class: 'urow ' + u.status }, head, perms, noteIn, act, err);
  }
  function flashBtn(box, text) { box.className = 'ok'; flash(box, text); setTimeout(() => { box.className = 'err'; }, 2600); }

  let bulkBox = null; let userListBox = null; let countEl = null;
  function renderBulkBar() {
    if (!bulkBox) return;
    clear(bulkBox);
    bulkBox.hidden = S.sel.size === 0;
    if (!S.sel.size) return;
    const err = msgBox();
    const permSel = h('select', { 'aria-label': 'Yetki seç' }, PERMS.map(([k, l]) => h('option', { value: k, text: l })));
    const run = async (op, extra) => {
      err.textContent = '';
      try { await api('POST', { a: 'bulk_users', op, usernames: [...S.sel], ...extra }); await loadUsers(); S.sel.clear(); renderUsers(); } catch (e) { err.textContent = msg(e); }
    };
    bulkBox.append(h('strong', { text: `${S.sel.size} kullanıcı seçili` }),
      h('div', { class: 'uact' },
        h('button', { class: 'btn hot sm', type: 'button', onclick: () => run('approve') }, 'Onayla'),
        h('button', { class: 'btn line sm', type: 'button', onclick: () => run('block') }, 'Engelle'),
        h('button', { class: 'btn line sm', type: 'button', onclick: () => run('unblock') }, 'Engeli kaldır'),
        h('button', { class: 'btn line sm', type: 'button', onclick: () => run('logout') }, 'Oturumları kapat'),
        permSel,
        h('button', { class: 'btn line sm', type: 'button', onclick: () => run('perm_on', { perm: permSel.value }) }, 'Yetkiyi aç'),
        h('button', { class: 'btn line sm', type: 'button', onclick: () => run('perm_off', { perm: permSel.value }) }, 'Yetkiyi kapat'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { S.sel.clear(); renderUsers(); } }, 'Seçimi kaldır')),
      err);
  }

  function renderUsers() {
    const box = tab('users');
    if (!userListBox || !box.contains(userListBox)) {
      clear(box);
      const q = input({ type: 'search', placeholder: 'Ad, kullanıcı adı veya not ara…', 'aria-label': 'Kullanıcı ara', value: S.f.q });
      q.addEventListener('input', () => { S.f.q = q.value; paintList(); });
      const sel = (key, label, opts) => {
        const s = h('select', { 'aria-label': label }, opts.map(([v, l]) => h('option', { value: v, text: l, selected: S.f[key] === v })));
        s.addEventListener('change', () => { S.f[key] = s.value; paintList(); });
        return s;
      };
      countEl = h('span', { class: 'note' });
      const all = h('button', { class: 'btn line sm', type: 'button', onclick: () => { for (const u of filteredUsers()) if (u.username !== S.me) S.sel.add(u.username); renderUsers(); } }, 'Görünenleri seç');
      const exp = h('button', { class: 'btn line sm', type: 'button', onclick: () => {
        const blob = new Blob([csv(filteredUsers())], { type: 'text/csv;charset=utf-8' });
        const a = h('a', { href: URL.createObjectURL(blob), download: 'kullanicilar.csv' });
        document.body.appendChild(a); a.click(); a.remove();
      } }, 'CSV indir');
      bulkBox = h('div', { class: 'bulk', hidden: true });
      userListBox = h('div', { class: 'ulist' });
      box.append(
        h('div', { class: 'toolbar' }, q,
          sel('status', 'Durum', [['', 'Tüm durumlar'], ['active', 'Aktif'], ['pending', 'Onay bekleyen'], ['blocked', 'Engelli']]),
          sel('role', 'Rol', [['', 'Tüm roller'], ['admin', 'Yönetici'], ['user', 'Üye']]),
          sel('app', 'Uygulama', [['', 'Uygulama: hepsi'], ['yes', 'İndirenler'], ['no', 'İndirmeyenler']]),
          sel('sort', 'Sıralama', [['new', 'Yeniden eskiye'], ['old', 'Eskiden yeniye'], ['login', 'Son girişe göre'], ['name', 'Ada göre']])),
        h('div', { class: 'toolbar' }, countEl, all, exp, h('button', { class: 'btn line sm', type: 'button', onclick: async () => { await loadUsers(); renderUsers(); } }, 'Yenile')),
        bulkBox, userListBox);
    }
    paintList();
  }
  function paintList() {
    const rows = filteredUsers();
    countEl.textContent = `${rows.length} / ${S.users.length} kullanıcı`;
    clear(userListBox);
    if (!rows.length) userListBox.append(h('p', { class: 'empty', text: S.users.length ? 'Eşleşen kullanıcı yok.' : 'Henüz kullanıcı yok.' }));
    for (const u of rows) userListBox.append(userRow(u));
    renderBulkBar();
  }

  // =========================================================
  // ODALAR
  // =========================================================
  async function roomOp(a, code, pid) {
    try { S.rooms = (await api('POST', { a, code, pid })).rooms; renderRooms(); } catch (e) { alert0(e); await loadRooms(); renderRooms(); }
  }
  let roomErr = null;
  function alert0(e) { if (roomErr) roomErr.textContent = msg(e); }

  function roomCard(r) {
    const closeBtn = h('button', { class: 'btn danger sm', type: 'button' }, 'Odayı kapat');
    let armed = false;
    closeBtn.addEventListener('click', () => {
      if (!armed) { armed = true; closeBtn.textContent = 'Emin misin? Tekrar tıkla'; setTimeout(() => { armed = false; closeBtn.textContent = 'Odayı kapat'; }, 3500); return; }
      roomOp('room_close', r.code);
    });
    const list = h('ul');
    for (const p of r.players) {
      list.append(h('li', null, h('span', { class: 'on-dot' + (p.online ? ' on' : ''), title: p.online ? 'Çevrimiçi' : 'Çevrimdışı' }),
        h('span', { class: 'nm', text: p.name }), p.host ? h('span', { class: 'tag hot', text: 'Ev sahibi' }) : null,
        p.uid ? h('small', { text: '@' + p.uid }) : h('small', { text: 'misafir' }),
        h('button', { class: 'btn line sm', type: 'button', 'aria-label': p.name + ' oyuncusunu at', onclick: () => roomOp('room_kick', r.code, p.id) }, 'At')));
    }
    const ready = r.status === 'ready';
    const chatBox = h('div', { class: 'chatlog', hidden: !S.chat[r.code] });
    const paintChat = () => {
      clear(chatBox);
      for (const m of S.chat[r.code] || []) {
        chatBox.append(h('p', { class: m.sys ? 'sysmsg' : '' }, h('small', { text: new Date(m.t).toLocaleTimeString('tr-TR', { timeStyle: 'short' }) + ' ' }),
          m.sys ? `[${m.sys}] ${m.name}` : h('span', null, h('b', { text: m.name + ': ' }), m.text)));
      }
      if (!(S.chat[r.code] || []).length) chatBox.append(note('Sohbet boş.'));
    };
    const chatBtn = h('button', { class: 'btn line sm', type: 'button' }, S.chat[r.code] ? 'Sohbeti gizle' : 'Sohbeti göster');
    chatBtn.addEventListener('click', async () => {
      if (S.chat[r.code]) { delete S.chat[r.code]; renderRooms(); return; }
      try { S.chat[r.code] = (await api('GET', null, { a: 'room_chat', code: r.code })).chat; renderRooms(); } catch (e) { alert0(e); }
    });
    paintChat();
    const say = input({ placeholder: 'Bu odaya duyuru…', maxlength: '200', 'aria-label': r.code + ' odasına duyuru', value: S.say[r.code] || '' });
    say.addEventListener('input', () => { S.say[r.code] = say.value; });
    const sayBtn = h('button', { class: 'btn line sm', type: 'button' }, 'Gönder');
    sayBtn.addEventListener('click', async () => {
      try {
        await api('POST', { a: 'room_say', code: r.code, text: say.value });
        S.say[r.code] = ''; say.value = '';
        if (S.chat[r.code]) S.chat[r.code] = (await api('GET', null, { a: 'room_chat', code: r.code })).chat;
        renderRooms();
      } catch (e) { alert0(e); }
    });
    return h('article', { class: 'rcard' },
      h('header', null, h('code', { text: r.code }), h('span', { class: 'tag', text: MODE[r.mode] || r.mode }),
        h('span', { class: 'tag ' + (ready ? 'hot' : ''), text: ready ? 'Hazır' : 'Bekliyor' }), h('span', { class: 'note', text: `${r.players.length}/${r.cap} oyuncu · ${fmt(r.created)}` })),
      list,
      h('div', { class: 'uact' }, ready
        ? h('button', { class: 'btn line sm', type: 'button', onclick: () => roomOp('room_reopen', r.code) }, 'Yeniden aç')
        : h('button', { class: 'btn hot sm', type: 'button', disabled: r.players.length < 2, onclick: () => roomOp('room_start', r.code) }, 'Odayı başlat'),
        chatBtn, closeBtn),
      h('div', { class: 'uact' }, say, sayBtn), chatBox);
  }
  function renderRooms() {
    const box = clear(tab('rooms'));
    roomErr = msgBox();
    box.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn line sm', type: 'button', onclick: async () => { await loadRooms(); renderRooms(); } }, 'Yenile'),
      h('span', { class: 'note', text: 'Liste 5 saniyede bir kendiliğinden yenilenir.' })), roomErr);
    const grid = h('div', { class: 'rgridA' });
    if (!S.rooms.length) grid.append(h('p', { class: 'empty', text: 'Şu anda açık oda yok.' }));
    for (const r of S.rooms) grid.append(roomCard(r));
    box.append(grid);
  }

  // =========================================================
  // YÖNLENDİRMELER
  // =========================================================
  const PRESETS = [
    { label: 'Misafirler: ilk kayıt ol (her tıklamada)', r: { name: 'Önce kayıt ol', audience: { guest: true }, trigger: 'click', action: 'redirect', url: '/giris?kayit=1', freq: 'session' } },
    { label: 'Üyeler: önce uygulamayı indir (pencere)', r: { name: 'Önce uygulamayı indirin', audience: { noapp: true }, trigger: 'click', action: 'popup', title: 'Önce uygulamayı indirin', message: 'Oyuna başlamadan önce masaüstü uygulamayı indirip kurman gerekiyor.', ctaLabel: 'Uygulamayı indir', ctaUrl: '/indir', laterLabel: 'Daha sonra', dismissable: true, freq: 'hours', hours: 1 } },
    { label: 'Üyeler: önce uygulamayı indir (yönlendir)', r: { name: 'Uygulama sayfasına yönlendir', audience: { noapp: true }, trigger: 'click', action: 'redirect', url: '/indir', freq: 'session' } },
    { label: 'Misafirler: hoş geldin penceresi', r: { name: 'Hoş geldin', audience: { guest: true }, trigger: 'load', delay: 3, action: 'popup', title: 'Kartmasa’ya hoş geldin', message: 'Oda kurmak ve arkadaşlarına katılmak için ücretsiz hesap aç.', ctaLabel: 'Kayıt ol', ctaUrl: '/giris?kayit=1', laterLabel: 'Sonra', dismissable: true, freq: 'once' } },
    { label: 'Oda kurarken uygulama hatırlatması', r: { name: 'Oda kurmadan önce uygulama', audience: { noapp: true }, trigger: 'create', action: 'popup', title: 'Uygulamayı indirdin mi?', message: 'Masa hazır olunca oyun masaüstü uygulamada açılır. Önce uygulamayı indir.', ctaLabel: 'Uygulamayı indir', ctaUrl: '/indir', laterLabel: 'İndirdim, devam et', dismissable: true, freq: 'session' } },
    { label: 'Duyuru bandı (herkese)', r: { name: 'Duyuru bandı', audience: { guest: true, noapp: true, app: true }, trigger: 'load', action: 'banner', title: 'Duyuru:', message: 'Bu hafta sonu turnuva var. Odanı kur, arkadaşlarını çağır.', ctaLabel: 'Oda kur', ctaUrl: '/', dismissable: true, freq: 'session', pages: 'all' } },
    { label: 'Bakım penceresi (herkese, kapatılamaz)', r: { name: 'Bakım', audience: { guest: true, noapp: true, app: true }, trigger: 'load', action: 'popup', title: 'Kısa bir bakımdayız', message: 'Birkaç dakika içinde geri döneceğiz. Anlayışın için teşekkürler.', dismissable: false, freq: 'always', pages: 'all' } },
  ];
  const TRIG = [['click', 'Sayfada herhangi bir yere tıklayınca'], ['load', 'Sayfa açılınca (gecikmeli)'], ['create', '“Oda Oluştur” düğmelerine basınca'], ['join', '“Odaya Katıl” düğmelerine basınca']];
  const ACT = [['redirect', 'Başka sayfaya yönlendir'], ['popup', 'Pencere göster'], ['banner', 'Üstte bant göster']];
  const FREQ = [['always', 'Her seferinde'], ['session', 'Oturumda bir kez'], ['hours', 'Belirli saatte bir'], ['once', 'Tarayıcıda yalnızca bir kez']];
  const URLS = ['/giris?kayit=1', '/giris', '/indir', '/hesap', '/'];
  let gateMsg = null; let gateOk = null; let gateList = null; let gateSave = null;

  const dirty = () => JSON.stringify(S.rules) !== S.rulesJson;
  function markDirty() { if (gateSave) { gateSave.disabled = !dirty(); gateSave.textContent = dirty() ? 'Değişiklikleri kaydet' : 'Kaydedildi'; } }
  const blank = () => ({ id: '', name: 'Yeni kural', enabled: false, audience: { guest: true, noapp: false, app: false }, trigger: 'click', delay: 0, pages: 'home', action: 'popup', url: '', title: '', message: '', ctaLabel: '', ctaUrl: '', laterLabel: '', dismissable: true, freq: 'session', hours: 24 });
  const withDefaults = (r) => ({ ...blank(), ...r, audience: { guest: false, noapp: false, app: false, ...(r.audience || {}) } });

  const audText = (a) => [a.guest && 'misafir', a.noapp && 'indirmemiş üye', a.app && 'indirmiş üye'].filter(Boolean).join(' + ') || 'kimse';
  const selectOf = (opts, val, on) => {
    const s = h('select', null, opts.map(([v, l]) => h('option', { value: v, text: l, selected: v === val })));
    s.addEventListener('change', () => on(s.value));
    return s;
  };

  function ruleCard(r, i) {
    const st = S.stats.rules[r.id] || { shown: 0, click: 0, dismiss: 0 };
    const ctr = st.shown ? Math.round((st.click / st.shown) * 100) : 0;
    const open = S.open === (r.id || 'new' + i);
    const key = r.id || 'new' + i;
    const head = h('div', { class: 'rule-head' },
      toggle(r.enabled ? 'Açık' : 'Kapalı', r.enabled, () => { r.enabled = !r.enabled; renderGates(); }),
      h('div', { class: 'rule-title' }, h('b', { text: r.name }),
        h('small', { text: `${audText(r.audience)} · ${TRIG.find((t) => t[0] === r.trigger)[1].toLowerCase()} · ${ACT.find((a) => a[0] === r.action)[1].toLowerCase()}` })),
      h('div', { class: 'rule-stats', title: 'Gösterim / tıklama / kapatma' }, h('span', { text: `${st.shown} gösterim` }), h('span', { text: `${st.click} tık (%${ctr})` }), h('span', { text: `${st.dismiss} kapatma` })),
      h('div', { class: 'uact' },
        h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Yukarı taşı', disabled: i === 0, onclick: () => { S.rules.splice(i - 1, 0, S.rules.splice(i, 1)[0]); renderGates(); } }, '↑'),
        h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Aşağı taşı', disabled: i === S.rules.length - 1, onclick: () => { S.rules.splice(i + 1, 0, S.rules.splice(i, 1)[0]); renderGates(); } }, '↓'),
        h('button', { class: 'btn line sm', type: 'button', 'aria-expanded': String(open), onclick: () => { S.open = open ? null : key; renderGates(); } }, open ? 'Kapat' : 'Düzenle')));
    const card = h('article', { class: 'rule' + (r.enabled ? ' on' : '') }, head);
    if (!open) return card;

    const aud = h('div', { class: 'perms' },
      [['guest', 'Misafir (giriş yapmamış)'], ['noapp', 'Üye · uygulamayı indirmemiş'], ['app', 'Üye · uygulamayı indirmiş']].map(([k, l]) =>
        toggle(l, r.audience[k], () => { r.audience[k] = !r.audience[k]; renderGates(); })));
    const urlList = h('datalist', { id: 'urls' }, URLS.map((u) => h('option', { value: u })));
    const f = [];
    f.push(field('Kural adı (yalnızca sen görürsün)', input({ value: r.name, maxlength: '60', oninput: (e) => { r.name = e.target.value; markDirty(); } })));
    f.push(h('div', { class: 'field' }, h('span', { text: 'Kime gösterilsin?' }), aud, h('small', { class: 'hint', text: 'Yöneticiler her zaman kurallardan muaftır.' })));
    f.push(field('Ne zaman?', selectOf(TRIG, r.trigger, (v) => { r.trigger = v; renderGates(); })));
    if (r.trigger === 'load' || r.action === 'banner') f.push(field('Gecikme (saniye)', input({ type: 'number', min: '0', max: '120', value: String(r.delay), oninput: (e) => { r.delay = Number(e.target.value) || 0; markDirty(); } })));
    f.push(field('Hangi sayfalarda?', selectOf([['home', 'Yalnızca ana sayfa'], ['all', 'Tüm sayfalar (giriş ve yönetim hariç)']], r.pages, (v) => { r.pages = v; markDirty(); })));
    f.push(field('Ne yapsın?', selectOf(ACT, r.action, (v) => { r.action = v; renderGates(); })));
    if (r.action === 'redirect') {
      f.push(field('Yönlendirilecek adres', input({ value: r.url, list: 'urls', placeholder: '/giris?kayit=1 veya https://…', oninput: (e) => { r.url = e.target.value; markDirty(); } }), 'Sitenin kendi yolu (/indir gibi) ya da https:// adresi.'));
    } else {
      f.push(field('Başlık', input({ value: r.title, maxlength: '80', oninput: (e) => { r.title = e.target.value; markDirty(); } })));
      f.push(field('Mesaj', h('textarea', { rows: '3', maxlength: '400', value: r.message, oninput: (e) => { r.message = e.target.value; markDirty(); } })));
      f.push(field('Ana düğme yazısı', input({ value: r.ctaLabel, maxlength: '30', placeholder: 'Uygulamayı indir', oninput: (e) => { r.ctaLabel = e.target.value; markDirty(); } })));
      f.push(field('Ana düğme adresi', input({ value: r.ctaUrl, list: 'urls', placeholder: '/indir', oninput: (e) => { r.ctaUrl = e.target.value; markDirty(); } })));
      if (r.action === 'popup' && r.dismissable) f.push(field('“Daha sonra” düğmesi yazısı', input({ value: r.laterLabel, maxlength: '30', placeholder: 'Daha sonra', oninput: (e) => { r.laterLabel = e.target.value; markDirty(); } })));
      f.push(h('div', { class: 'field' }, h('span', { text: 'Kapatılabilsin mi?' }), toggle(r.dismissable ? 'Evet, kapatılabilir' : 'Hayır, kapatılamaz', r.dismissable, () => { r.dismissable = !r.dismissable; renderGates(); }),
        r.dismissable ? null : h('small', { class: 'hint', text: 'Kapatılamayan pencere yalnızca ana düğmeyle (varsa) kapanır. Düğme yoksa ziyaretçi siteyi kullanamaz.' })));
    }
    f.push(field('Ne sıklıkla?', selectOf(FREQ, r.freq, (v) => { r.freq = v; renderGates(); })));
    if (r.freq === 'hours') f.push(field('Kaç saatte bir?', input({ type: 'number', min: '1', max: '720', value: String(r.hours), oninput: (e) => { r.hours = Number(e.target.value) || 1; markDirty(); } })));

    const warn = (r.trigger === 'click' && r.action === 'redirect' && r.freq === 'always')
      ? h('p', { class: 'alert', text: 'Dikkat: her tıklamada yönlendirmek ziyaretçinin siteyi kullanmasını imkânsız kılar. “Oturumda bir kez” daha uygundur. Giriş ve yönetim sayfaları ve yöneticiler bu kurallardan muaftır.' }) : null;
    const actions = h('div', { class: 'uact' },
      r.action !== 'redirect' ? h('button', { class: 'btn line sm', type: 'button', onclick: () => window.KMGates && window.KMGates.preview({ ...r, id: 'preview' }) }, 'Önizle') : null,
      h('button', { class: 'btn line sm', type: 'button', onclick: () => { const c = { ...structuredClone(r), id: '', name: r.name + ' (kopya)', enabled: false }; S.rules.splice(i + 1, 0, c); S.open = 'new' + (i + 1); renderGates(); } }, 'Kopyala'),
      r.id ? h('button', { class: 'btn line sm', type: 'button', onclick: async () => { try { S.stats = (await api('POST', { a: 'gate_reset', id: r.id })).stats; renderGates(); } catch (e) { gateMsg.textContent = msg(e); } } }, 'Sayaçları sıfırla') : null,
      (() => {
        const del = h('button', { class: 'btn danger sm', type: 'button' }, 'Kuralı sil'); let armed = false;
        del.addEventListener('click', () => { if (!armed) { armed = true; del.textContent = 'Emin misin? Tekrar tıkla'; setTimeout(() => { armed = false; del.textContent = 'Kuralı sil'; }, 3500); return; } S.rules.splice(i, 1); S.open = null; renderGates(); });
        return del;
      })());
    card.append(h('div', { class: 'rule-body' }, h('div', { class: 'form-grid' }, f), urlList, warn, actions));
    return card;
  }

  function renderGates() {
    const box = clear(tab('gates'));
    gateMsg = msgBox(); gateOk = okBox();
    const presetSel = h('select', { 'aria-label': 'Hazır şablon' }, h('option', { value: '', text: 'Hazır şablon seç…' }), PRESETS.map((p, i) => h('option', { value: String(i), text: p.label })));
    const addPreset = h('button', { class: 'btn hot sm', type: 'button' }, 'Şablonu ekle');
    addPreset.addEventListener('click', () => {
      if (presetSel.value === '') return;
      S.rules.push(withDefaults({ ...structuredClone(PRESETS[Number(presetSel.value)].r), enabled: false }));
      S.open = 'new' + (S.rules.length - 1); renderGates();
    });
    gateSave = h('button', { class: 'btn hot', type: 'button' }, 'Kaydedildi');
    gateSave.addEventListener('click', async () => {
      gateMsg.textContent = ''; gateSave.disabled = true;
      try {
        const r = await api('POST', { a: 'gates_save', rules: S.rules });
        S.rules = r.rules; S.rulesJson = JSON.stringify(r.rules); S.stats = r.stats; S.open = null;
        renderGates(); flash(gateOk, 'Kurallar kaydedildi. Ziyaretçilere birkaç saniye içinde uygulanır.');
      } catch (e) { gateMsg.textContent = msg(e); markDirty(); }
    });
    const revert = h('button', { class: 'btn line sm', type: 'button', onclick: () => { S.rules = JSON.parse(S.rulesJson); S.open = null; renderGates(); } }, 'Değişiklikleri geri al');
    const allOn = h('button', { class: 'btn line sm', type: 'button', onclick: () => { S.rules.forEach((r) => { r.enabled = true; }); renderGates(); } }, 'Hepsini aç');
    const allOff = h('button', { class: 'btn line sm', type: 'button', onclick: () => { S.rules.forEach((r) => { r.enabled = false; }); renderGates(); } }, 'Hepsini kapat');
    const resetAll = h('button', { class: 'btn line sm', type: 'button', onclick: async () => { try { S.stats = (await api('POST', { a: 'gate_reset' })).stats; renderGates(); } catch (e) { gateMsg.textContent = msg(e); } } }, 'Tüm sayaçları sıfırla');
    box.append(
      h('div', { class: 'panel' },
        h('h2', { text: 'Yönlendirme kuralları' }),
        note('Ziyaretçileri belirli adımlara yönlendir: “önce kayıt ol”, “önce uygulamayı indirin”, duyuru bandı ve daha fazlası. Kurallar yukarıdan aşağıya sırayla denenir; ilk uyan çalışır. Yöneticiler, giriş sayfası ve bu panel kurallardan muaftır.'),
        h('div', { class: 'toolbar' }, presetSel, addPreset, h('button', { class: 'btn line sm', type: 'button', onclick: () => { S.rules.push(blank()); S.open = 'new' + (S.rules.length - 1); renderGates(); } }, 'Boş kural')),
        h('div', { class: 'toolbar' }, allOn, allOff, resetAll, h('span', { class: 'note', text: `Uygulama indirme tıklaması: ${S.stats.dl || 0} · indiren üye: ${S.stats.dlUsers || 0}` }))),
      gateList = h('div', { class: 'rules-list' }),
      h('div', { class: 'toolbar sticky-save' }, gateSave, revert, gateMsg, gateOk));
    if (!S.rules.length) gateList.append(h('p', { class: 'empty', text: 'Henüz kural yok. Yukarıdan bir şablon ekleyerek başla.' }));
    S.rules.forEach((r, i) => gateList.append(ruleCard(r, i)));
    markDirty();
  }

  // =========================================================
  // AYARLAR
  // =========================================================
  function renderSettings() {
    const box = clear(tab('settings'));
    const s = S.settings;
    const err = msgBox(); const ok = okBox();
    const reg = h('div', { class: 'radio-list' }, [['open', 'Herkes kayıt olabilir', 'Kayıt olan hemen giriş yapar.'], ['approval', 'Onayla', 'Yeni üyeler yönetici onaylayana kadar bekler.'], ['closed', 'Kayıt kapalı', 'Yeni hesap oluşturulamaz.']]
      .map(([v, t, d]) => h('label', null, h('input', { type: 'radio', name: 'registration', value: v, checked: s.registration === v }), h('div', null, h('b', { text: t }), h('span', { text: d })))));
    const permBox = (obj) => h('div', { class: 'perms' }, PERMS.map(([k, l]) => { const b = toggle(l, obj[k], () => { obj[k] = !obj[k]; b.setAttribute('aria-pressed', String(obj[k])); }); return b; }));
    const appUrl = input({ type: 'url', inputmode: 'url', placeholder: 'https://…', maxlength: '600', value: s.appUrl || '' });
    const appOpen = input({ placeholder: 'kartmasa://oda/{code}', maxlength: '200', value: s.appOpenUrl || '' });
    const slow = input({ type: 'number', min: '0', max: '10000', step: '100', value: String(s.chatSlowMs) });
    const maxRooms = input({ type: 'number', min: '0', max: '500', value: String(s.maxRooms) });
    const turnUrl = input({ placeholder: 'turn:sunucu.com:3478', maxlength: '200', value: s.turnUrl || '' });
    const turnUser = input({ placeholder: 'kullanıcı adı', maxlength: '200', value: s.turnUser || '', autocomplete: 'off' });
    const turnPass = input({ placeholder: 'parola', maxlength: '200', value: s.turnPass || '', autocomplete: 'off' });
    const words = h('textarea', { rows: '3', placeholder: 'Her satıra ya da virgülle ayırarak bir sözcük', value: (s.bannedWords || []).join('\n') });
    const form = h('form', { class: 'panel', novalidate: true },
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('span', { text: 'Kayıt' }), reg),
        h('div', { class: 'field' }, h('span', { text: 'Giriş yapmayanlar (misafir) yetkileri' }), permBox(s.guest), h('small', { class: 'hint', text: 'Kapalı olan işlem için giriş yapmak gerekir.' })),
        h('div', { class: 'field' }, h('span', { text: 'Yeni üyelerin başlangıç yetkileri' }), permBox(s.member), h('small', { class: 'hint', text: 'Yalnızca bundan sonra kayıt olanlara uygulanır.' }))),
      h('div', { class: 'form-grid' },
        field('Uygulama indirme bağlantısı (https)', appUrl, 'İndirme yetkisi buradan uygulanır. Boş bırakırsan sitedeki config.js bağlantısı kullanılır; o dosya herkese açıktır ve yetkiyi denetleyemez.'),
        field('Uygulamayı açan bağlantı (isteğe bağlı)', appOpen, '{code} oda koduyla değişir.')),
      h('div', { class: 'form-grid' },
        field('Sohbet yavaş modu (milisaniye)', slow, 'Bir oyuncunun iki mesajı arasındaki en kısa süre. 0 = sınırsız.'),
        field('Aynı anda en fazla açık oda', maxRooms, '0 = sınırsız. Sınıra ulaşınca yeni oda kurulamaz.')),
      h('div', { class: 'form-grid' },
        field('TURN sunucusu (isteğe bağlı)', turnUrl, 'Sesli/görüntülü konuşmada doğrudan bağlanamayan kişiler (bazı mobil ağlar, kurumsal ağlar) için aktarma sunucusu. Boşsa yalnızca doğrudan bağlantı denenir.'),
        field('TURN kullanıcı adı', turnUser), field('TURN parolası', turnPass)),
      field('Sohbette gizlenen sözcükler', words, 'Bu sözcükler sohbette *** olarak görünür. Büyük/küçük harf fark etmez.'),
      err, ok, h('div', null, h('button', { class: 'btn hot', type: 'submit' }, 'Ayarları kaydet')));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = ''; ok.textContent = '';
      const r = form.querySelector('input[name="registration"]:checked');
      try {
        S.settings = (await api('POST', { a: 'settings', settings: {
          registration: r ? r.value : undefined, guest: s.guest, member: s.member, appUrl: appUrl.value, appOpenUrl: appOpen.value,
          chatSlowMs: Number(slow.value), maxRooms: Number(maxRooms.value), bannedWords: words.value,
          turnUrl: turnUrl.value, turnUser: turnUser.value, turnPass: turnPass.value } })).settings;
        flash(ok, 'Kaydedildi.'); renderSettings();
      } catch (x) { err.textContent = msg(x); }
    });
    box.append(form);
  }

  // =========================================================
  // GÜNLÜK
  // =========================================================
  function renderLog() {
    const box = clear(tab('log'));
    const q = input({ type: 'search', placeholder: 'Günlükte ara…', 'aria-label': 'Günlükte ara' });
    const list = h('div', { class: 'logs' });
    const paint = () => {
      clear(list);
      const t = q.value.trim().toLowerCase();
      const rows = S.log.filter((x) => !t || `${x.ev} ${x.who} ${x.d}`.toLowerCase().includes(t));
      if (!rows.length) list.append(h('p', { class: 'empty', text: 'Kayıt yok.' }));
      for (const it of rows) list.append(h('div', { class: 'logrow' }, h('small', { text: fmt(it.t) }), h('b', { text: it.ev }), h('span', { text: it.who }), h('span', { class: 'note', text: it.d })));
    };
    q.addEventListener('input', paint);
    box.append(h('div', { class: 'toolbar' }, q, h('button', { class: 'btn line sm', type: 'button', onclick: async () => { await loadLog(); renderLog(); } }, 'Yenile')),
      note('Son 300 olay: kayıtlar, yönetici işlemleri, kural ve ayar değişiklikleri.'), list);
    paint();
  }

  // ---------- sekmeler ----------
  const RENDER = { overview: renderOverview, users: renderUsers, rooms: renderRooms, gates: renderGates, settings: renderSettings, log: renderLog };
  const LOAD = {
    overview: () => Promise.all([loadUsers(), loadRooms(), loadSettings(), loadLog(), loadGates()]),
    users: loadUsers, rooms: loadRooms, gates: loadGates, settings: loadSettings, log: loadLog,
  };
  let timer = null;
  async function setTab(t) {
    if (S.tab === 'gates' && t !== 'gates' && dirty() && !window.__gateWarned) { window.__gateWarned = true; tab('gates').dataset.unsaved = '1'; }
    S.tab = t;
    for (const b of document.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === t));
    for (const id of Object.keys(RENDER)) tab(id).hidden = id !== t;
    clearInterval(timer);
    try {
      if (!(t === 'gates' && dirty())) await LOAD[t]();
    } catch (e) { tab(t).textContent = msg(e); return; }
    if (t === 'users') userListBox = null;
    RENDER[t]();
    if (t === 'rooms') timer = setInterval(async () => { if (!document.hidden && S.tab === 'rooms') { try { await loadRooms(); renderRooms(); } catch { /* sonraki turda dene */ } } }, 5000);
  }
  for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => setTab(b.dataset.tab));
  window.addEventListener('beforeunload', (e) => { if (S.tab === 'gates' && dirty()) { e.preventDefault(); e.returnValue = ''; } });

  window.KMAuth.ready.then(async (s) => {
    if (!s.user) return gate('Giriş gerekli', 'Yönetim paneli için yönetici hesabınla giriş yapmalısın.', [['/giris?next=/admin', 'Giriş yap', 'hot']]);
    if (s.user.role !== 'admin') return gate('Yetkin yok', 'Bu sayfa yalnızca yöneticilere açık.', [['/', 'Ana sayfaya dön', 'line']]);
    $('#gate').hidden = true; $('#adm').hidden = false;
    S.tab = '';
    await setTab('overview');
  });
})();

// Kartmasa istemcisi. Oda verisi /api/rooms üzerinden gelir; oyun masaüstü uygulamada oynanır.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CFG = Object.assign({ appUrl: '', appOpenUrl: '' }, window.KARTMASA || {});
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* depolama kapalı */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* depolama kapalı */ } },
  };

  // ---------- diller: [tr, en, de] ----------
  const T = {
    nav_modes: ['Oyun Modları', 'Game Modes', 'Spielmodi'],
    nav_rooms: ['Açık Odalar', 'Open Rooms', 'Offene Räume'],
    nav_rules: ['Kurallar', 'Rules', 'Regeln'],
    nav_comm: ['Topluluk', 'Community', 'Community'],
    download: ['Uygulamayı İndir', 'Get the App', 'App herunterladen'],
    create: ['Oda Oluştur', 'Create Room', 'Raum erstellen'],
    join: ['Odaya Katıl', 'Join Room', 'Raum beitreten'],
    hero_k: ['Arkadaşlarınla kart masası', 'A card table for friends', 'Kartentisch für Freunde'],
    hero_a: ['Masayı kur,', 'Set the table,', 'Deck den Tisch,'],
    hero_b: ['rekabeti başlat!', 'start the rivalry!', 'starte den Wettkampf!'],
    hero_p: ['Arkadaşların için anında oda aç, kodu paylaş ve sohbet et. Herkes hazır olduğunda masaüstü uygulamayla oyuna geçin.', 'Open a room in seconds, share the code and chat. When everyone is in, jump into the game with the desktop app.', 'Eröffne in Sekunden einen Raum, teile den Code und chatte. Sind alle da, geht es in der Desktop-App los.'],
    stat_rooms: ['Açık oda', 'Open rooms', 'Offene Räume'],
    stat_players: ['Bekleyen oyuncu', 'Players waiting', 'Wartende Spieler'],
    stat_modes: ['Oyun modu', 'Game modes', 'Spielmodi'],
    atm_k: ['Masadan bir kare', 'A look at the table', 'Ein Blick auf den Tisch'],
    atm_h: ['Oyunun havasını hisset', 'Feel the pace', 'Spür das Tempo'],
    atm_p: ['Kart kaosunu, masa atmosferini ve temposunu yakından gör.', 'See the card chaos, the table atmosphere and the tempo up close.', 'Erlebe Kartenchaos, Tischatmosphäre und Tempo aus nächster Nähe.'],
    atm_big: ['Masa kur. Arkadaşlarını çağır. Kartları karıştır.', 'Set a table. Call your friends. Shuffle the cards.', 'Tisch aufbauen. Freunde rufen. Karten mischen.'],
    atm_small: ['Tek bir kodla lobiye gir, sohbet et ve uygulamayla oyuna geç.', 'Enter the lobby with one code, chat and start playing in the app.', 'Mit einem Code in die Lobby, chatten und in der App losspielen.'],
    how_k: ['Üç adımda masa', 'A table in three steps', 'Ein Tisch in drei Schritten'],
    how_h: ['Nasıl çalışır?', 'How it works', 'So funktioniert es'],
    how_p: ['Oda sistemini birkaç saniyede kullanmaya başla.', 'Start using rooms in a few seconds.', 'Nutze Räume in wenigen Sekunden.'],
    s1h: ['Odanı oluştur', 'Create your room', 'Erstelle deinen Raum'],
    s1p: ['Avatarını, modu ve oyuncu kapasitesini seç.', 'Pick your avatar, mode and player capacity.', 'Wähle Avatar, Modus und Spielerzahl.'],
    s2h: ['Kodu paylaş', 'Share the code', 'Teile den Code'],
    s2p: ['Oda kodunu veya davet linkini arkadaşlarına gönder ve lobiyi doldur.', 'Send the room code or invite link to your friends and fill the lobby.', 'Sende Raumcode oder Einladungslink an deine Freunde und füll die Lobby.'],
    s3h: ['Uygulamayla başla', 'Start in the app', 'In der App starten'],
    s3p: ['Herkes hazır olduğunda masaüstü uygulamayı aç. Oyun tarayıcıda oynanmaz, uygulama gerekir.', 'When everyone is in, open the desktop app. The game is not played in the browser; the app is required.', 'Sind alle da, öffne die Desktop-App. Das Spiel läuft nicht im Browser, die App ist nötig.'],
    open_k: ['Canlı lobi', 'Live lobby', 'Live-Lobby'],
    open_h: ['Açık odalar', 'Open rooms', 'Offene Räume'],
    open_p: ['Kod bilmeden de katılabilirsin. Bekleyen masalar burada görünür.', 'You can join without a code. Waiting tables appear here.', 'Du kannst auch ohne Code beitreten. Wartende Tische erscheinen hier.'],
    open_empty: ['Şu an bekleyen oda yok. İlk masayı sen kur.', 'No rooms waiting right now. Set up the first table.', 'Gerade wartet kein Raum. Eröffne den ersten Tisch.'],
    modes_k: ['Masanı seç', 'Choose your table', 'Wähle deinen Tisch'],
    modes_h: ['Oyun modları', 'Game modes', 'Spielmodi'],
    modes_p: ['Bir moda dokun, oda oluşturma ekranı seçiminle açılsın.', 'Tap a mode and the create screen opens with it selected.', 'Tippe auf einen Modus, der Erstellen-Dialog öffnet sich damit.'],
    pick: ['Seç ve oda kur', 'Pick and create', 'Wählen und erstellen'],
    m_standart: ['Standart', 'Classic', 'Klassisch'],
    md_standart: ['Klasik kurallarla dengeli maçlar.', 'Balanced matches with the classic rules.', 'Ausgewogene Partien mit klassischen Regeln.'],
    m_acimasiz: ['Acımasız', 'Ruthless', 'Gnadenlos'],
    md_acimasiz: ['+6, ceza istifleme ve daha sert cezalar.', '+6, stacking penalties and harsher draws.', '+6, Strafen stapeln und härtere Strafen.'],
    m_cift: ['Çift Taraf', 'Two-Sided', 'Zweiseitig'],
    md_cift: ['Çevir kartıyla karanlık tarafa geç, cezalar büyür.', 'Flip to the dark side where penalties grow.', 'Wechsle auf die dunkle Seite, wo Strafen wachsen.'],
    m_parti: ['Parti', 'Party', 'Party'],
    md_parti: ['Çift deste, 10 kişiye kadar kalabalık masa.', 'Double deck, tables of up to 10 players.', 'Doppeltes Deck, Tische mit bis zu 10 Spielern.'],
    m_hizli: ['Hızlı', 'Fast', 'Schnell'],
    md_hizli: ['12 saniyelik hamle süresiyle yarış.', 'Race against a 12 second move timer.', 'Wettlauf gegen 12 Sekunden pro Zug.'],
    rules_k: ['Masa düzeni', 'Table etiquette', 'Tischordnung'],
    rules_h: ['Kurallar', 'Rules', 'Regeln'],
    rules_p: ['Her oyuncu için net ve anlaşılır bir akış.', 'A clear flow for every player.', 'Ein klarer Ablauf für jeden Spieler.'],
    r1h: ['Renk veya sayı eşleştir.', 'Match color or number.', 'Farbe oder Zahl passend legen.'],
    r1p: ['Ortadaki karta uygun renk, sayı ya da özel kart oynayabilirsin.', 'Play a card of the same color, the same number, or a special card.', 'Lege dieselbe Farbe, dieselbe Zahl oder eine Spezialkarte.'],
    r2h: ['TEK de.', 'Call TEK.', 'Sag TEK.'],
    r2p: ['Elinde tek kart kalınca TEK! çağrısı yap. Unutursan rakipler seni yakalar ve 2 kart çekersin.', 'With one card left, call TEK!. If you forget, rivals catch you and you draw 2.', 'Bei einer Karte ruf TEK!. Vergisst du es, fangen dich die Gegner und du ziehst 2.'],
    r3h: ['Sıra sende mi?', 'Your turn?', 'Bist du dran?'],
    r3p: ['Oynayabileceğin kart yoksa desteden çek. Çektiğin kart uyuyorsa hemen oynayabilirsin.', 'No playable card? Draw from the deck. If it fits, you can play it right away.', 'Keine passende Karte? Zieh vom Stapel. Passt sie, darfst du sie sofort spielen.'],
    lg_s: ['Atla: sıradaki oyuncu sırasını kaybeder.', 'Skip: the next player loses their turn.', 'Aussetzen: Der nächste Spieler verliert seinen Zug.'],
    lg_r: ['Yön: oyun yönü tersine döner.', 'Reverse: the direction of play flips.', 'Richtung: Die Spielrichtung dreht sich um.'],
    lg_d: ['Çek: sıradaki oyuncu kart çeker ve sırasını kaybeder.', 'Draw: the next player draws cards and loses their turn.', 'Ziehen: Der nächste Spieler zieht Karten und setzt aus.'],
    lg_q: ['Joker: rengi sen seçersin. +4 ise büyük ceza verir.', 'Wild: you choose the color. The +4 hits hard.', 'Joker: Du wählst die Farbe. Der +4 trifft hart.'],
    lg_f: ['Çevir: Çift Taraf modunda masa karanlık tarafa geçer.', 'Flip: in Two-Sided mode the table moves to the dark side.', 'Wenden: Im Zweiseitig-Modus wechselt der Tisch auf die dunkle Seite.'],
    comm_k: ['Oyuncu kültürü', 'Player culture', 'Spielerkultur'],
    comm_h: ['Topluluk', 'Community', 'Community'],
    comm_p: ['Masaların temel prensipleri.', 'The basic principles of every table.', 'Die Grundprinzipien jedes Tisches.'],
    c1h: ['Saygılı sohbet', 'Respectful chat', 'Respektvoller Chat'],
    c1p: ['Sohbeti diğer oyuncuları rahatsız etmeyecek şekilde kullan.', 'Keep the chat comfortable for everyone.', 'Halte den Chat für alle angenehm.'],
    c2h: ['Adil oyun', 'Fair play', 'Fair Play'],
    c2p: ['Hile, spam ve kasıtlı oyun bozma davranışlarından kaçın.', 'Avoid cheating, spam and deliberately ruining games.', 'Kein Betrug, Spam oder absichtliches Stören.'],
    c3h: ['Davetini paylaş', 'Share your invite', 'Teile deine Einladung'],
    c3p: ['Oda kodunu veya linkini arkadaşlarınla paylaşarak masanı doldur.', 'Share the room code or link with friends to fill your table.', 'Teile Raumcode oder Link, um deinen Tisch zu füllen.'],
    foot: ['Arkadaşlarınla anında masa kur.', 'Set up a table with friends in seconds.', 'Eröffne in Sekunden einen Tisch mit Freunden.'],
    foot_note: ['Bağımsız bir kart oyunu projesidir; herhangi bir marka ile bağlantısı yoktur.', 'An independent card game project, not affiliated with any brand.', 'Ein unabhängiges Kartenspielprojekt ohne Markenbezug.'],
    cr_h: ['Yeni oda oluştur', 'Create a new room', 'Neuen Raum erstellen'],
    cr_p: ['Adını, avatarını ve oyun modunu seç. Oda kodun hemen oluşturulur.', 'Pick a name, avatar and mode. Your room code is created instantly.', 'Wähle Name, Avatar und Modus. Dein Raumcode entsteht sofort.'],
    f_name: ['Kullanıcı adı', 'Username', 'Benutzername'],
    f_avatar: ['Avatarını seç', 'Pick your avatar', 'Wähle deinen Avatar'],
    f_mode: ['Oyun modu', 'Game mode', 'Spielmodus'],
    f_cap: ['Oyuncu sayısı', 'Players', 'Spieler'],
    cr_go: ['Odayı kur!', 'Create room!', 'Raum erstellen!'],
    jn_h: ['Odaya katıl', 'Join a room', 'Raum beitreten'],
    jn_p: ['Arkadaşının gönderdiği oda kodunu veya linkini yaz.', 'Enter the room code or link your friend sent.', 'Gib den Raumcode oder Link deines Freundes ein.'],
    f_code: ['Oda kodu veya linki', 'Room code or link', 'Raumcode oder Link'],
    jn_go: ['Odaya git', 'Go to room', 'Zum Raum'],
    rcode: ['Oda kodu', 'Room code', 'Raumcode'],
    copy_code: ['Kodu kopyala', 'Copy code', 'Code kopieren'],
    copy_link: ['Linki kopyala', 'Copy link', 'Link kopieren'],
    copied: ['Kopyalandı', 'Copied', 'Kopiert'],
    leave: ['Odadan ayrıl', 'Leave room', 'Raum verlassen'],
    back: ['Ana sayfa', 'Home', 'Startseite'],
    ready_h: ['Masa hazır', 'The table is ready', 'Der Tisch ist bereit'],
    ready_p: ['Oyuna geçmek için masaüstü uygulamayı aç. Oyun tarayıcıda oynanmaz.', 'Open the desktop app to start playing. The game is not played in the browser.', 'Öffne die Desktop-App, um zu spielen. Das Spiel läuft nicht im Browser.'],
    open_app: ['Uygulamada aç', 'Open in the app', 'In der App öffnen'],
    app_soon: ['Uygulama bağlantısı henüz eklenmedi.', 'The app link has not been added yet.', 'Der App-Link wurde noch nicht hinzugefügt.'],
    start: ['Masayı başlat', 'Start the table', 'Tisch starten'],
    reopen: ['Beklemeye al', 'Back to waiting', 'Zurück ins Warten'],
    chat: ['Sohbet', 'Chat', 'Chat'],
    chat_ph: ['Bir mesaj yaz…', 'Write a message…', 'Nachricht schreiben…'],
    send: ['Gönder', 'Send', 'Senden'],
    need2: ['Başlamak için en az 2 oyuncu gerekir.', 'At least 2 players are needed to start.', 'Zum Starten braucht es mindestens 2 Spieler.'],
    wait_host: ['Ev sahibinin masayı başlatması bekleniyor.', 'Waiting for the host to start the table.', 'Warten, bis der Gastgeber den Tisch startet.'],
    empty_seat: ['Boş koltuk', 'Empty seat', 'Freier Platz'],
    you: ['Sen', 'You', 'Du'],
    host: ['Ev sahibi', 'Host', 'Gastgeber'],
    offline: ['çevrimdışı', 'offline', 'offline'],
    kick: ['Odadan çıkar', 'Remove from room', 'Aus dem Raum entfernen'],
    seats: ['koltuk', 'seats', 'Plätze'],
    enter: ['Katıl', 'Join', 'Beitreten'],
    host_of: ['Ev sahibi', 'Host', 'Gastgeber'],
    waiting: ['Bekliyor', 'Waiting', 'Wartet'],
    ready: ['Hazır', 'Ready', 'Bereit'],
    sys_join: ['{n} odaya katıldı', '{n} joined the room', '{n} ist dem Raum beigetreten'],
    sys_leave: ['{n} odadan ayrıldı', '{n} left the room', '{n} hat den Raum verlassen'],
    sys_start: ['{n} masayı başlattı', '{n} started the table', '{n} hat den Tisch gestartet'],
    sys_kick: ['{n} odadan çıkarıldı', '{n} was removed', '{n} wurde entfernt'],
    closed: ['Oda kapandı.', 'The room was closed.', 'Der Raum wurde geschlossen.'],
    kicked: ['Bu odadan çıkarıldın ya da oda sona erdi.', 'You were removed from this room or it ended.', 'Du wurdest entfernt oder der Raum wurde beendet.'],
    e_name: ['Önce bir kullanıcı adı yaz.', 'Enter a username first.', 'Gib zuerst einen Namen ein.'],
    e_code: ['Geçerli bir oda kodu yaz.', 'Enter a valid room code.', 'Gib einen gültigen Raumcode ein.'],
    e_nf: ['Bu kodla bir oda bulunamadı.', 'No room found with that code.', 'Kein Raum mit diesem Code gefunden.'],
    e_full: ['Oda dolu.', 'The room is full.', 'Der Raum ist voll.'],
    e_started: ['Bu masa başladı, yeni oyuncu alınmıyor.', 'This table has started and is closed to new players.', 'Dieser Tisch läuft schon und nimmt keine neuen Spieler auf.'],
    e_rate: ['Çok fazla istek. Biraz bekle.', 'Too many requests. Wait a moment.', 'Zu viele Anfragen. Warte kurz.'],
    e_fail: ['Bir şey ters gitti, tekrar dene.', 'Something went wrong, try again.', 'Etwas ist schiefgelaufen, versuch es erneut.'],
    e_host: ['Bu işlem için ev sahibi olmalısın.', 'Only the host can do that.', 'Das kann nur der Gastgeber.'],
  };
  const LANGS = ['tr', 'en', 'de'];
  let L = Math.max(0, LANGS.indexOf(LS.get('km-lang', 'tr')));
  const t = (k, p) => {
    let s = (T[k] && T[k][L]) || (T[k] && T[k][0]) || k;
    if (p) for (const x in p) s = s.replace('{' + x + '}', p[x]);
    return s;
  };
  function applyLang() {
    document.documentElement.lang = LANGS[L];
    $$('[data-i]').forEach((el) => { el.textContent = t(el.dataset.i); });
    $$('[data-ip]').forEach((el) => { el.placeholder = t(el.dataset.ip); });
    $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === LANGS[L])));
    buildChips();
    renderRoomList();
    if (R) { lastSig = ''; lastChatId = -1; renderRoom(); }
  }

  // ---------- avatarlar: 5 şekil x 4 renk ----------
  const SHAPES = [
    'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    'M13 2L5 13h6l-1 9 8-12h-6z',
    'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z',
    'M12 2l8 10-8 10-8-10z',
    'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z',
  ];
  const GRADS = [['#ff3b72', '#b5179e'], ['#ffb21e', '#ff6a3d'], ['#19d3a6', '#0a8f9c'], ['#7a63ff', '#3a2bd0']];
  function avEl(i) {
    const s = document.createElement('span');
    s.className = 'av';
    const g = GRADS[Math.floor(i / 5) % 4];
    s.style.setProperty('--g', `linear-gradient(135deg,${g[0]},${g[1]})`);
    s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${SHAPES[i % 5]}"/></svg>`;
    return s;
  }

  // ---------- yardımcılar ----------
  const MODE_MAX = { standart: 8, acimasiz: 8, cift: 6, parti: 10, hizli: 8 };
  const modeName = (m) => t('m_' + m);
  let toastT;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.hidden = true; }, 2600);
  }
  async function api(method, body, qs) {
    const res = await fetch('/api/rooms' + (qs ? '?' + new URLSearchParams(qs) : ''), {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    let j = null;
    try { j = await res.json(); } catch { /* gövde yok */ }
    if (!res.ok) throw Object.assign(new Error((j && j.error) || 'server'), { code: (j && j.error) || 'server', status: res.status });
    return j;
  }
  function errText(e) {
    const m = { name: 'e_name', code: 'e_code', not_found: 'e_nf', full: 'e_full', started: 'e_started', rate: 'e_rate', host_only: 'e_host' };
    return t(m[e && e.code] || 'e_fail');
  }
  async function copyText(s) {
    try { await navigator.clipboard.writeText(s); return true; } catch {
      const ta = document.createElement('textarea');
      ta.value = s; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { /* izin yok */ }
      ta.remove();
      return ok;
    }
  }

  // ---------- uygulama bağlantıları ----------
  function wireAppLinks() {
    $$('[data-app="dl"]').forEach((a) => {
      if (CFG.appUrl) { a.href = CFG.appUrl; a.classList.remove('off'); a.removeAttribute('aria-disabled'); a.removeAttribute('title'); }
      else { a.href = '#'; a.classList.add('off'); a.setAttribute('aria-disabled', 'true'); a.title = t('app_soon'); }
    });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.off');
    if (a) { e.preventDefault(); toast(t('app_soon')); }
  });

  // ---------- modallar ----------
  let lastFocus = null;
  function openModal(id) {
    lastFocus = document.activeElement;
    const m = $('#m-' + id);
    m.hidden = false;
    const first = $('input', m);
    if (first) setTimeout(() => first.focus(), 30);
  }
  function closeModals() {
    $$('.modal').forEach((m) => { m.hidden = true; });
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });
  $$('.modal').forEach((m) => m.addEventListener('mousedown', (e) => { if (e.target === m) closeModals(); }));
  $$('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
  $$('[data-open]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.open === 'create') prepCreate();
    openModal(b.dataset.open);
  }));

  // ---------- profil, avatar ve seçenek alanları ----------
  const profile = Object.assign({ name: '', av: Math.floor(Math.random() * 20) }, LS.get('km-profile', {}));
  const form = { mode: 'standart', cap: 4 };
  function buildAvatarGrid(id, getter, setter) {
    const g = $(id);
    g.textContent = '';
    for (let i = 0; i < 20; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Avatar ' + (i + 1));
      b.setAttribute('aria-pressed', String(getter() === i));
      b.appendChild(avEl(i));
      b.addEventListener('click', () => { setter(i); $$('button', g).forEach((x, j) => x.setAttribute('aria-pressed', String(j === i))); });
      g.appendChild(b);
    }
  }
  function buildChips() {
    const mg = $('#cr-mode');
    mg.textContent = '';
    for (const m of Object.keys(MODE_MAX)) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = modeName(m);
      b.setAttribute('aria-pressed', String(form.mode === m));
      b.addEventListener('click', () => { form.mode = m; if (form.cap > MODE_MAX[m]) form.cap = MODE_MAX[m]; buildChips(); });
      mg.appendChild(b);
    }
    const cg = $('#cr-cap');
    cg.textContent = '';
    for (let n = 2; n <= MODE_MAX[form.mode]; n++) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = String(n);
      b.setAttribute('aria-pressed', String(form.cap === n));
      b.addEventListener('click', () => { form.cap = n; buildChips(); });
      cg.appendChild(b);
    }
  }
  function prepCreate() {
    $('#cr-err').textContent = '';
    $('#cr-name').value = profile.name;
    buildAvatarGrid('#cr-av', () => profile.av, (i) => { profile.av = i; });
    buildChips();
  }
  $$('.mode').forEach((b) => b.addEventListener('click', () => {
    form.mode = b.dataset.mode;
    if (form.cap > MODE_MAX[form.mode]) form.cap = MODE_MAX[form.mode];
    prepCreate();
    openModal('create');
  }));
  function prepJoin(code) {
    $('#jn-err').textContent = '';
    if (code) $('#jn-code').value = code;
    $('#jn-name').value = profile.name;
    buildAvatarGrid('#jn-av', () => profile.av, (i) => { profile.av = i; });
  }
  $$('[data-open="join"]').forEach((b) => b.addEventListener('click', () => prepJoin()));

  // ---------- oda oluştur / katıl ----------
  let busy = false;
  async function submit(btn, errEl, fn) {
    if (busy) return;
    busy = true; btn.disabled = true; errEl.textContent = '';
    try { await fn(); } catch (e) { errEl.textContent = errText(e); } finally { busy = false; btn.disabled = false; }
  }
  $('#f-create').addEventListener('submit', (e) => {
    e.preventDefault();
    submit($('#cr-go'), $('#cr-err'), async () => {
      profile.name = $('#cr-name').value.trim();
      LS.set('km-profile', profile);
      const r = await api('POST', { action: 'create', name: profile.name, av: profile.av, mode: form.mode, cap: form.cap });
      closeModals();
      enterRoom({ code: r.code, pid: r.pid, key: r.key });
    });
  });
  function parseCode(s) {
    const m = String(s).match(/[?&]oda=([A-Za-z0-9]{5})/i) || String(s).match(/\b([A-Za-z0-9]{5})\b/);
    return m ? m[1].toUpperCase() : '';
  }
  $('#f-join').addEventListener('submit', (e) => {
    e.preventDefault();
    submit($('#jn-go'), $('#jn-err'), async () => {
      const code = parseCode($('#jn-code').value);
      if (!code) throw Object.assign(new Error('code'), { code: 'code' });
      profile.name = $('#jn-name').value.trim();
      LS.set('km-profile', profile);
      const r = await api('POST', { action: 'join', code, name: profile.name, av: profile.av });
      closeModals();
      enterRoom({ code: r.code, pid: r.pid, key: r.key });
    });
  });

  // ---------- açık odalar ----------
  let rooms = [];
  function renderRoomList() {
    const ul = $('#roomlist');
    ul.textContent = '';
    for (const r of rooms) {
      const li = document.createElement('li');
      li.className = 'roomitem';
      const top = document.createElement('div'); top.className = 'top';
      const code = document.createElement('code'); code.textContent = r.code;
      const tag = document.createElement('span'); tag.className = 'tag' + (r.status === 'ready' ? ' hot' : '');
      tag.textContent = modeName(r.mode);
      top.append(code, tag);
      const info = document.createElement('p'); info.className = 'info';
      info.textContent = `${r.hostName} · ${r.n}/${r.cap} ${t('seats')} · ${r.status === 'ready' ? t('ready') : t('waiting')}`;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn line sm'; btn.textContent = t('enter');
      btn.disabled = r.status !== 'waiting' || r.n >= r.cap;
      btn.addEventListener('click', () => { prepJoin(r.code); openModal('join'); });
      li.append(top, info, btn);
      ul.appendChild(li);
    }
  }
  async function loadRooms() {
    try {
      const j = await api('GET');
      rooms = j.rooms;
      $('#st-rooms').textContent = String(j.stats.rooms);
      $('#st-players').textContent = String(j.stats.players);
      renderRoomList();
    } catch { /* ağ yoksa eski liste kalır */ }
  }
  let listT;
  function listLoop() {
    clearTimeout(listT);
    if (!S && !document.hidden) loadRooms();
    listT = setTimeout(listLoop, 6000);
  }

  // ---------- lobi ----------
  let S = null; // {code, pid, key}
  let R = null; // son görünüm
  let pollT; let pingT;
  let lastSig = ''; let lastChatId = -1;

  function showHome() {
    $('#room').hidden = true;
    $('#home').hidden = false;
    S = null; R = null; lastSig = ''; lastChatId = -1;
    clearTimeout(pollT); clearInterval(pingT);
    LS.del('km-session');
    loadRooms();
  }
  function enterRoom(sess) {
    S = sess;
    LS.set('km-session', sess);
    R = null; lastSig = ''; lastChatId = -1;
    $('#home').hidden = true;
    $('#room').hidden = false;
    $('#r-closed').hidden = true;
    $('#r-body').hidden = false;
    $('#r-chat').textContent = '';
    $('#r-code').textContent = sess.code;
    window.scrollTo({ top: 0 });
    clearTimeout(pollT); clearInterval(pingT);
    poll();
    pingT = setInterval(ping, 15000);
  }
  function showEnded(msg) {
    clearTimeout(pollT); clearInterval(pingT);
    LS.del('km-session');
    S = null;
    $('#r-closed-text').textContent = msg;
    $('#r-closed').hidden = false;
    $('#r-body').hidden = true;
  }
  async function poll() {
    if (!S) return;
    try {
      const v = await api('GET', null, { code: S.code, pid: S.pid });
      if (!S) return;
      R = v;
      if (!v.inRoom) { showEnded(t('kicked')); return; }
      renderRoom();
    } catch (e) {
      if (e.status === 404) { showEnded(t('closed')); return; }
    }
    pollT = setTimeout(poll, document.hidden ? 5000 : 1500);
  }
  async function ping() {
    if (!S) return;
    try { await api('POST', { action: 'ping', ...S }); } catch (e) {
      if (e.status === 403 || e.status === 404) showEnded(t('kicked'));
    }
  }
  async function roomAction(action, extra = {}) {
    if (!S) return;
    try {
      const r = await api('POST', { action, ...S, ...extra });
      if (r.room) { R = r.room; renderRoom(); }
    } catch (e) { toast(errText(e)); }
  }

  function renderRoom() {
    if (!R || !S) return;
    const me = S.pid;
    const isHost = R.hostId === me;
    $('#r-mode').textContent = modeName(R.mode);
    $('#r-cap').textContent = `${R.players.length}/${R.cap} ${t('seats')}`;

    const sig = JSON.stringify([R.players, R.status, R.cap, R.hostId, L]);
    if (sig !== lastSig) {
      lastSig = sig;
      const ul = $('#r-players');
      ul.textContent = '';
      for (const p of R.players) {
        const li = document.createElement('li');
        li.className = 'pl' + (p.id === me ? ' me' : '');
        const nm = document.createElement('div'); nm.className = 'nm';
        const b = document.createElement('b'); b.textContent = p.name;
        const sm = document.createElement('small');
        if (p.host) { const s = document.createElement('span'); s.className = 'host'; s.textContent = t('host'); sm.appendChild(s); }
        if (p.id === me) { const s = document.createElement('span'); s.textContent = t('you'); sm.appendChild(s); }
        if (!p.online) { const s = document.createElement('span'); s.className = 'off'; s.textContent = t('offline'); sm.appendChild(s); }
        nm.append(b, sm);
        li.append(avEl(p.av), nm);
        if (isHost && p.id !== me) {
          const k = document.createElement('button');
          k.type = 'button'; k.className = 'kick'; k.textContent = '×'; k.title = t('kick'); k.setAttribute('aria-label', t('kick'));
          k.addEventListener('click', () => roomAction('kick', { target: p.id }));
          li.appendChild(k);
        }
        ul.appendChild(li);
      }
      for (let i = R.players.length; i < R.cap; i++) {
        const li = document.createElement('li');
        li.className = 'pl empty-seat';
        li.textContent = t('empty_seat');
        ul.appendChild(li);
      }
    }

    const ready = R.status === 'ready';
    $('#r-ready').hidden = !ready;
    if (ready) {
      const open = $('#r-open-app'); const dl = $('#r-dl-app');
      const href = CFG.appOpenUrl ? CFG.appOpenUrl.replace('{code}', encodeURIComponent(S.code)) : '';
      if (href) { open.href = href; open.classList.remove('off'); } else { open.href = '#'; open.classList.add('off'); }
      if (CFG.appUrl) { dl.href = CFG.appUrl; dl.classList.remove('off'); } else { dl.href = '#'; dl.classList.add('off'); }
      $('#r-app-note').hidden = !!(href || CFG.appUrl);
    }
    const start = $('#r-start'); const reopen = $('#r-reopen'); const hint = $('#r-hint');
    start.hidden = !isHost || ready;
    reopen.hidden = !isHost || !ready;
    start.disabled = R.players.length < 2;
    hint.textContent = isHost ? (!ready && R.players.length < 2 ? t('need2') : '') : (!ready ? t('wait_host') : '');

    const last = R.chat.length ? R.chat[R.chat.length - 1].id : 0;
    if (last !== lastChatId) {
      lastChatId = last;
      const ul = $('#r-chat');
      const stick = ul.scrollHeight - ul.scrollTop - ul.clientHeight < 60;
      ul.textContent = '';
      for (const m of R.chat) {
        const li = document.createElement('li');
        if (m.sys) {
          li.className = 'msg sys';
          li.textContent = t('sys_' + m.sys, { n: m.name });
        } else {
          li.className = 'msg';
          const d = document.createElement('div');
          const nm = document.createElement('b'); nm.textContent = m.name;
          const p = document.createElement('p'); p.textContent = m.text;
          d.append(nm, p);
          li.append(avEl(m.av), d);
        }
        ul.appendChild(li);
      }
      if (stick) ul.scrollTop = ul.scrollHeight;
    }
  }

  $('#r-start').addEventListener('click', () => roomAction('start'));
  $('#r-reopen').addEventListener('click', () => roomAction('reopen'));
  $('#r-leave').addEventListener('click', async () => {
    const s = S;
    showHome();
    if (s) { try { await api('POST', { action: 'leave', ...s }); } catch { /* oda zaten kapanmış olabilir */ } }
  });
  $('#r-home').addEventListener('click', showHome);
  $('#r-copy-code').addEventListener('click', async () => { if (S && await copyText(S.code)) toast(t('copied')); });
  $('#r-copy-link').addEventListener('click', async () => { if (S && await copyText(`${location.origin}/?oda=${S.code}`)) toast(t('copied')); });
  $('#r-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = $('#r-text');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    await roomAction('chat', { text });
  });

  // ---------- dil, gezinme ----------
  $$('.lang button').forEach((b) => b.addEventListener('click', () => {
    L = Math.max(0, LANGS.indexOf(b.dataset.lang));
    LS.set('km-lang', LANGS[L]);
    wireAppLinks();
    applyLang();
  }));
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2 || a.classList.contains('off')) return;
    if (!$('#room').hidden) {
      e.preventDefault();
      $('#room').hidden = true; $('#home').hidden = false;
      if (S) { /* oda arka planda açık kalır */ }
      setTimeout(() => { const el = $(id); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 30);
    }
  }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { listLoop(); if (S) { clearTimeout(pollT); poll(); } } });

  // ---------- başlangıç ----------
  async function resume() {
    const saved = LS.get('km-session', null);
    if (!saved || !saved.code) return false;
    try {
      const v = await api('GET', null, { code: saved.code, pid: saved.pid });
      if (!v.inRoom) { LS.del('km-session'); return false; }
      enterRoom(saved);
      return true;
    } catch { LS.del('km-session'); return false; }
  }
  (async () => {
    applyLang();
    wireAppLinks();
    const params = new URLSearchParams(location.search);
    const inviteCode = parseCode(params.get('oda') || '');
    if (inviteCode) history.replaceState(null, '', location.pathname);
    const resumed = await resume();
    if (!resumed) listLoop();
    if (inviteCode && !resumed) { prepJoin(inviteCode); openModal('join'); }
  })();
})();

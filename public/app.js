// Kartmasa istemcisi. Oda verisi /api/rooms üzerinden gelir; oyun masaüstü uygulamada oynanır.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const FX = window.KMFX || { sfx() {}, confetti() {}, count(el, v) { if (el) el.textContent = String(v); } };
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
    md_standart: ['Resmî klasik kurallar, 108 kartlık deste, 10 kişiye kadar.', 'Official classic rules, 108-card deck, up to 10 players.', 'Offizielle klassische Regeln, 108 Karten, bis zu 10 Spieler.'],
    m_parti: ['Parti', 'Party', 'Party'],
    md_parti: ['Aynı kurallar, arkadaş grubu için kalabalık masa.', 'Same rules, a big table for a group of friends.', 'Gleiche Regeln, ein großer Tisch für die Freundesgruppe.'],
    m_hizli: ['Hızlı', 'Fast', 'Schnell'],
    md_hizli: ['Aynı kurallar, 12 saniyelik hamle süresiyle.', 'Same rules with a 12 second move timer.', 'Gleiche Regeln mit 12 Sekunden pro Zug.'],
    rules_k: ['Masa düzeni', 'Table etiquette', 'Tischordnung'],
    rules_h: ['Kurallar', 'Rules', 'Regeln'],
    rules_p: ['Her oyuncu için net ve anlaşılır bir akış.', 'A clear flow for every player.', 'Ein klarer Ablauf für jeden Spieler.'],
    r1h: ['Renk veya sayı eşleştir.', 'Match color or number.', 'Farbe oder Zahl passend legen.'],
    r1p: ['Ortadaki karta uygun renk, sayı ya da özel kart oynayabilirsin.', 'Play a card of the same color, the same number, or a special card.', 'Lege dieselbe Farbe, dieselbe Zahl oder eine Spezialkarte.'],
    r2h: ['TEK de.', 'Call TEK.', 'Sag TEK.'],
    r2p: ['Elinde tek kart kalınca TEK! çağrısı yap. Unutursan yakalanır ve 2 kart çekersin.', 'With one card left, call TEK!. If you forget and get caught, you draw 2.', 'Bei einer Karte ruf TEK!. Vergisst du es und wirst erwischt, ziehst du 2.'],
    r4h: ['7 kartla başla.', 'Start with 7 cards.', 'Starte mit 7 Karten.'],
    r4p: ['Her oyuncuya 7 kart dağıtılır, destenin üstündeki kart açılır. Sırayla oynanır.', 'Everyone gets 7 cards and the top card of the deck is turned over. Play goes in turn.', 'Jeder bekommt 7 Karten, die oberste Karte wird aufgedeckt. Es wird reihum gespielt.'],
    r5h: ['Eli ilk bitiren kazanır.', 'First to empty their hand wins.', 'Wer zuerst keine Karten hat, gewinnt.'],
    r5p: ['Elindeki son kartı oynayan turu alır. Rakiplerin elinde kalan kartlar puan olarak toplanır, 500 puana ulaşan oyunu kazanır.', 'Whoever plays their last card wins the round and scores the points left in rivals’ hands. First to 500 wins the game.', 'Wer die letzte Karte legt, gewinnt die Runde und erhält die Punkte der Gegner. Wer zuerst 500 erreicht, gewinnt.'],
    r3h: ['Sıra sende mi?', 'Your turn?', 'Bist du dran?'],
    r3p: ['Oynayabileceğin kart yoksa desteden bir kart çek. Uyuyorsa oynayabilir, uymuyorsa sırayı geçersin.', 'No playable card? Draw one. If it fits you may play it, otherwise your turn passes.', 'Keine passende Karte? Zieh eine. Passt sie, darfst du sie legen, sonst ist der Nächste dran.'],
    lg_s: ['Atla: sıradaki oyuncu sırasını kaybeder.', 'Skip: the next player loses their turn.', 'Aussetzen: Der nächste Spieler verliert seinen Zug.'],
    lg_r: ['Yön: oyun yönü tersine döner.', 'Reverse: the direction of play flips.', 'Richtung: Die Spielrichtung dreht sich um.'],
    lg_d: ['Çek: sıradaki oyuncu kart çeker ve sırasını kaybeder.', 'Draw: the next player draws cards and loses their turn.', 'Ziehen: Der nächste Spieler zieht Karten und setzt aus.'],
    lg_q: ['Joker: rengi sen seçersin. +4 ise sıradaki 4 kart çeker; yalnızca elinde o renkten kart yokken oynanır, itiraz edilebilir.', 'Wild: you choose the color. The +4 makes the next player draw 4; only playable with no card of the current color, and it can be challenged.', 'Joker: Du wählst die Farbe. Der +4 lässt den Nächsten 4 ziehen; nur ohne passende Farbe, Anzweifeln erlaubt.'],
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
    snd: ['Ses', 'Sound', 'Ton'],
    snd_fx: ['Ses efektleri', 'Sound effects', 'Soundeffekte'],
    snd_music: ['Arka plan müziği', 'Background music', 'Hintergrundmusik'],
    snd_vol: ['Ses seviyesi', 'Volume', 'Lautstärke'],
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
    $$('[data-ia]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.ia)));
    $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === LANGS[L])));
    buildChips();
    renderRoomList();
    if (R) { lastSig = ''; lastChatId = -1; renderRoom(); }
  }

  // ---------- insan avatarları: 20 çizilmiş karakter ----------
  // [ten, saç stili, saç rengi, üst rengi, arka plan, aksesuar]
  const AVS = [
    ['#f9d5b8', 'short', '#1b1030', '#ff3b72', 0, ''],
    ['#f1c27d', 'long', '#4a2c17', '#19d3a6', 1, 'glasses'],
    ['#c68642', 'curly', '#1b1030', '#7a63ff', 2, ''],
    ['#e0a370', 'bun', '#d9a441', '#ffb21e', 3, ''],
    ['#8d5524', 'buzz', '#1b1030', '#ff6a3d', 0, 'headphones'],
    ['#f9d5b8', 'side', '#8a5a2b', '#3a2bd0', 1, ''],
    ['#5c3a21', 'short', '#1b1030', '#b5179e', 2, 'beard'],
    ['#f1c27d', 'pony', '#c0392b', '#0a8f9c', 3, ''],
    ['#e0a370', 'hijab', '#19d3a6', '#ff3b72', 0, ''],
    ['#c68642', 'long', '#1b1030', '#ffb21e', 1, 'earring'],
    ['#f9d5b8', 'curly', '#c0392b', '#19d3a6', 2, 'glasses'],
    ['#8d5524', 'side', '#1b1030', '#7a63ff', 3, ''],
    ['#f1c27d', 'buzz', '#2b2b3a', '#ff3b72', 0, 'beard'],
    ['#e0a370', 'bun', '#1b1030', '#3a2bd0', 1, 'headphones'],
    ['#f9d5b8', 'long', '#d9a441', '#ff6a3d', 2, ''],
    ['#5c3a21', 'curly', '#1b1030', '#19d3a6', 3, 'earring'],
    ['#c68642', 'pony', '#4a2c17', '#b5179e', 0, ''],
    ['#f1c27d', 'short', '#8a5a2b', '#0a8f9c', 1, 'glasses'],
    ['#e0a370', 'hijab', '#7a63ff', '#ffb21e', 2, ''],
    ['#8d5524', 'side', '#4a2c17', '#ff3b72', 3, 'headphones'],
  ];
  const BGS = [['#ff9ab5', '#b5179e'], ['#6ee7c8', '#0a8f9c'], ['#a99bff', '#3a2bd0'], ['#ffd27a', '#ff6a3d']];
  const HAIR_BACK = {
    long: (c) => `<path d="M17.5 30c0-13 6-19.5 14.5-19.5S46.5 17 46.5 30v20h-29z" fill="${c}"/>`,
    bun: (c) => `<circle cx="32" cy="9.5" r="6" fill="${c}"/>`,
    curly: (c) => `<g fill="${c}"><circle cx="21" cy="19" r="6.5"/><circle cx="32" cy="14.5" r="7.5"/><circle cx="43" cy="19" r="6.5"/><circle cx="18.5" cy="28" r="5.5"/><circle cx="45.5" cy="28" r="5.5"/></g>`,
    pony: (c) => `<ellipse cx="47" cy="32" rx="4.2" ry="10" transform="rotate(-14 47 32)" fill="${c}"/>`,
    hijab: (c) => `<path d="M16 31c0-15 6.5-22 16-22s16 7 16 22c0 9-3 15-3 21H19c0-6-3-12-3-21z" fill="${c}"/>`,
  };
  const HAIR_FRONT = {
    short: (c) => `<path d="M20 26c-.5-9.5 4.5-15 12-15s12.5 5.5 12 15c-3-4.5-7-6.5-12-6.5S23 21.5 20 26z" fill="${c}"/>`,
    long: (c) => `<path d="M20.5 25c1.5-8 6-12 11.5-12s10 4 11.5 12c-3.5-3-7.5-4.5-11.5-4.5S24 22 20.5 25z" fill="${c}"/>`,
    bun: (c) => `<path d="M20 26c-.5-9.5 4.5-15 12-15s12.5 5.5 12 15c-3-4.5-7-6.5-12-6.5S23 21.5 20 26z" fill="${c}"/>`,
    curly: (c) => `<path d="M21 23c2-5 6-7 11-7s9 2 11 7c-3-2-6.5-3-11-3s-8 1-11 3z" fill="${c}"/>`,
    buzz: (c) => `<path d="M20.8 24.5c0-8 4.8-12.2 11.2-12.2s11.2 4.2 11.2 12.2c-3-3-6.8-4.2-11.2-4.2s-8.2 1.2-11.2 4.2z" fill="${c}" opacity=".85"/>`,
    side: (c) => `<path d="M20.5 26c-1.5-9.5 4.5-15.5 13-14.5 7 .8 10 6.5 10 14.5-1-3.5-3-5.5-6.5-6.5-5 3.2-10 4-16.5 6.5z" fill="${c}"/>`,
    pony: (c) => `<path d="M20 26c-.5-9.5 4.5-15 12-15s12.5 5.5 12 15c-3-4.5-7-6.5-12-6.5S23 21.5 20 26z" fill="${c}"/>`,
  };
  function faceSVG(i) {
    const [skin, hair, hc, shirt, , acc] = AVS[i % AVS.length];
    const hijab = hair === 'hijab';
    const back = HAIR_BACK[hair] ? HAIR_BACK[hair](hc) : '';
    const front = HAIR_FRONT[hair] ? HAIR_FRONT[hair](hc) : '';
    let a = '';
    if (acc === 'glasses') a = '<g fill="none" stroke="#1b1030" stroke-width="1.3"><circle cx="27.6" cy="27.5" r="4.3"/><circle cx="36.4" cy="27.5" r="4.3"/><path d="M31.9 27.2h.2"/></g>';
    if (acc === 'headphones') a = '<path d="M19.5 28c0-11 5-17 12.5-17s12.5 6 12.5 17" fill="none" stroke="#241039" stroke-width="2.4" stroke-linecap="round"/><rect x="16.6" y="25" width="5" height="9" rx="2.4" fill="#ff3b72"/><rect x="42.4" y="25" width="5" height="9" rx="2.4" fill="#ff3b72"/>';
    if (acc === 'earring') a = '<circle cx="20.6" cy="33" r="1.5" fill="#ffd27a"/><circle cx="43.4" cy="33" r="1.5" fill="#ffd27a"/>';
    if (acc === 'beard') a = `<path d="M21.5 30c.5 9 4.5 14 10.5 14s10-5 10.5-14c-1.5 3.6-4 5.2-6.4 5.2-1.7-1.2-6.7-1.2-8.2 0-2.4 0-5-1.6-6.4-5.2z" fill="${hc}" opacity=".95"/>`;
    const head = hijab
      ? `<ellipse cx="32" cy="29" rx="9.6" ry="11.4" fill="${skin}"/>`
      : `<circle cx="20.4" cy="28.5" r="2.7" fill="${skin}"/><circle cx="43.6" cy="28.5" r="2.7" fill="${skin}"/><ellipse cx="32" cy="27.5" rx="11.4" ry="13" fill="${skin}"/>`;
    const eyes = '<circle cx="27.6" cy="27.8" r="1.55" fill="#1b1030"/><circle cx="36.4" cy="27.8" r="1.55" fill="#1b1030"/>';
    const brows = `<path d="M24.6 24.2c1.4-1 3-1 4.3-.2M35.1 24c1.3-.8 2.9-.8 4.3.2" fill="none" stroke="${hijab || hair === 'buzz' ? '#3a2515' : hc}" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>`;
    const mouth = '<path d="M28.4 34.2c2.2 2.1 5 2.1 7.2 0" fill="none" stroke="#7a2a3c" stroke-width="1.4" stroke-linecap="round"/>';
    const cheeks = '<circle cx="24.4" cy="32" r="2.2" fill="#ff6a8a" opacity=".22"/><circle cx="39.6" cy="32" r="2.2" fill="#ff6a8a" opacity=".22"/>';
    return `<svg viewBox="0 0 64 64" aria-hidden="true">${back}<rect x="27" y="36" width="10" height="13" rx="4" fill="${skin}"/><rect x="27" y="36" width="10" height="13" rx="4" fill="#000" opacity=".12"/><path d="M8 66c0-14 10-20 24-20s24 6 24 20z" fill="${shirt}"/><path d="M25.5 47.5c2 3 4 4.4 6.5 4.4s4.5-1.4 6.5-4.4" fill="none" stroke="#000" stroke-width="1.3" opacity=".16" stroke-linecap="round"/>${head}${front}${cheeks}${eyes}${brows}${mouth}${a}</svg>`;
  }
  const faceCache = {};
  function avEl(i) {
    const idx = ((i % AVS.length) + AVS.length) % AVS.length;
    const s = document.createElement('span');
    s.className = 'av';
    const g = BGS[AVS[idx][4]];
    s.style.setProperty('--g', `linear-gradient(160deg,${g[0]},${g[1]})`);
    s.innerHTML = faceCache[idx] || (faceCache[idx] = faceSVG(idx));
    return s;
  }

  // ---------- yardımcılar ----------
  const MODE_MAX = { standart: 10, parti: 10, hizli: 8 };
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
    FX.sfx('open');
    const first = $('input', m);
    if (first) setTimeout(() => first.focus(), 30);
  }
  function closeModals() {
    if ($$('.modal').some((m) => !m.hidden)) FX.sfx('close');
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
    try { await fn(); } catch (e) { errEl.textContent = errText(e); FX.sfx('error'); } finally { busy = false; btn.disabled = false; }
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
      li.setAttribute('data-tilt', '');
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
      FX.count($('#st-rooms'), j.stats.rooms);
      FX.count($('#st-players'), j.stats.players);
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
  let prevIds = null; let prevStatus = null; let fresh = new Set();

  function showHome() {
    $('#room').hidden = true;
    $('#home').hidden = false;
    S = null; R = null; lastSig = ''; lastChatId = -1; prevIds = null; prevStatus = null;
    clearTimeout(pollT); clearInterval(pingT);
    LS.del('km-session');
    loadRooms();
  }
  function enterRoom(sess) {
    S = sess;
    LS.set('km-session', sess);
    R = null; lastSig = ''; lastChatId = -1; prevIds = null; prevStatus = null;
    $('#home').hidden = true;
    $('#room').hidden = false;
    $('#r-closed').hidden = true;
    $('#r-body').hidden = false;
    $('#r-chat').textContent = '';
    const codeEl = $('#r-code');
    codeEl.textContent = '';
    [...sess.code].forEach((ch, k) => { const sp = document.createElement('span'); sp.textContent = ch; sp.style.setProperty('--k', String(k)); codeEl.appendChild(sp); });
    FX.sfx('whoosh');
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
    } catch (e) { toast(errText(e)); FX.sfx('error'); }
  }

  function renderRoom() {
    if (!R || !S) return;
    const me = S.pid;
    const isHost = R.hostId === me;
    $('#r-mode').textContent = modeName(R.mode);
    $('#r-cap').textContent = `${R.players.length}/${R.cap} ${t('seats')}`;

    const ids = new Set(R.players.map((p) => p.id));
    fresh = new Set();
    if (prevIds) {
      const joined = [...ids].filter((i) => !prevIds.has(i));
      const left = [...prevIds].filter((i) => !ids.has(i));
      joined.forEach((i) => fresh.add(i));
      if (joined.length) FX.sfx('join'); else if (left.length) FX.sfx('leave');
    }
    prevIds = ids;
    if (prevStatus && prevStatus !== 'ready' && R.status === 'ready') { FX.sfx('start'); FX.confetti(); }
    prevStatus = R.status;

    const sig = JSON.stringify([R.players, R.status, R.cap, R.hostId, L]);
    if (sig !== lastSig) {
      lastSig = sig;
      const ul = $('#r-players');
      ul.textContent = '';
      for (const p of R.players) {
        const li = document.createElement('li');
        li.className = 'pl' + (p.id === me ? ' me' : '') + (fresh.has(p.id) ? ' pop' : '');
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
      const prevLast = lastChatId;
      const incoming = prevLast >= 0 ? R.chat.filter((m) => m.id > prevLast) : [];
      if (incoming.some((m) => !m.sys && m.pid !== me)) FX.sfx('msg');
      lastChatId = last;
      const ul = $('#r-chat');
      const stick = ul.scrollHeight - ul.scrollTop - ul.clientHeight < 60;
      ul.textContent = '';
      for (const m of R.chat) {
        const li = document.createElement('li');
        const isNew = prevLast >= 0 && m.id > prevLast;
        if (m.sys) {
          li.className = 'msg sys' + (isNew ? ' slide' : '');
          li.textContent = t('sys_' + m.sys, { n: m.name });
        } else {
          li.className = 'msg' + (isNew ? ' slide' : '');
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
  $('#r-copy-code').addEventListener('click', async () => { if (S && await copyText(S.code)) { toast(t('copied')); FX.sfx('copy'); } });
  $('#r-copy-link').addEventListener('click', async () => { if (S && await copyText(`${location.origin}/?oda=${S.code}`)) { toast(t('copied')); FX.sfx('copy'); } });
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
  $$('.av[data-av]').forEach((el) => {
    const a = avEl(Number(el.dataset.av));
    el.style.setProperty('--g', a.style.getPropertyValue('--g'));
    el.innerHTML = a.innerHTML;
  });
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

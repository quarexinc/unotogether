// Oda içi sesli ve görüntülü sohbet. Medya tarayıcılar arasında doğrudan (WebRTC, mesh) akar;
// /api/rtc yalnızca bağlantı mesajlarını (SDP) ve "kim konuşmada" listesini taşır.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  };
  const panel = $('#call');
  if (!panel) return;

  // ---------- metinler [tr, en, de] ----------
  const LANGS = ['tr', 'en', 'de'];
  const TX = {
    title: ['Sesli ve görüntülü sohbet', 'Voice and video chat', 'Sprach- und Videochat'],
    hint: ['Odadakilerle konuş; kamerayı istersen aç.', 'Talk with the room; turn the camera on if you like.', 'Sprich mit dem Raum; Kamera nach Wunsch.'],
    join: ['Konuşmaya katıl', 'Join the call', 'Anruf beitreten'],
    leave: ['Ayrıl', 'Leave', 'Verlassen'],
    mic: ['Mikrofon', 'Mic', 'Mikrofon'],
    cam: ['Kamera', 'Camera', 'Kamera'],
    you: ['Sen', 'You', 'Du'],
    muted: ['Sessiz', 'Muted', 'Stumm'],
    connecting: ['Bağlanıyor…', 'Connecting…', 'Verbinde…'],
    failed: ['Bağlanamadı', 'Could not connect', 'Keine Verbindung'],
    retry: ['Tekrar dene', 'Retry', 'Erneut'],
    mute_them: ['Sesini kapat', 'Mute for me', 'Für mich stumm'],
    unmute_them: ['Sesini aç', 'Unmute', 'Laut'],
    alone: ['Şu an konuşmada yalnızsın. Arkadaşların katılınca burada görünürler.', 'You are the only one here. Friends appear when they join.', 'Du bist allein. Freunde erscheinen, sobald sie beitreten.'],
    listener: ['Mikrofona erişilemedi; yalnızca dinleyebilirsin. Tarayıcıdan izin verip mikrofon düğmesine bas.', 'Microphone unavailable; you can only listen. Allow it in the browser and press the mic button.', 'Mikrofon nicht verfügbar; du kannst nur zuhören.'],
    nocam: ['Kameraya erişilemedi. Tarayıcıdan izin verdiğinden emin ol.', 'Could not access the camera. Check the browser permission.', 'Kein Kamerazugriff. Prüfe die Browser-Berechtigung.'],
    unsupported: ['Bu tarayıcı sesli sohbeti desteklemiyor.', 'This browser does not support voice chat.', 'Dieser Browser unterstützt keinen Sprachchat.'],
    e_perm: ['Ses ve kamera yetkin kapalı. Yöneticiden iste.', 'Voice and camera are turned off for your account.', 'Sprache und Kamera sind für dein Konto deaktiviert.'],
    e_full: ['Konuşma dolu (en fazla 8 kişi).', 'The call is full (8 people max).', 'Der Anruf ist voll (max. 8).'],
    e_gone: ['Konuşmadan çıkarıldın.', 'You were removed from the call.', 'Du wurdest aus dem Anruf entfernt.'],
    e_net: ['Bağlantı kurulamadı. Tekrar dene.', 'Could not connect. Try again.', 'Verbindung fehlgeschlagen.'],
    joined: ['konuşmaya katıldı', 'joined the call', 'ist dem Anruf beigetreten'],
    left: ['konuşmadan ayrıldı', 'left the call', 'hat den Anruf verlassen'],
    live: ['Konuşmadasın', 'You are in the call', 'Du bist im Anruf'],
  };
  const lang = () => Math.max(0, LANGS.indexOf(LS.get('km-lang', 'tr')));
  const t = (k) => (TX[k] || [k])[lang()] || TX[k][0];

  const ERR = { login_required: 'e_perm', no_perm: 'e_perm', call_full: 'e_full', forbidden: 'e_gone', not_found: 'e_gone', not_in_call: 'e_gone' };

  // ---------- durum ----------
  let C = null; // etkin konuşma; null = konuşmada değil
  let toastT = null;
  const toast = (m) => { const n = $('#toast'); if (!n) return; n.textContent = m; n.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { n.hidden = true; }, 3200); };
  const sess = () => LS.get('km-session', null);
  const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.RTCPeerConnection);

  async function rtc(body) {
    const s = (C && C.sess) || sess();
    if (!s) throw Object.assign(new Error('no-session'), { status: 403, code: 'forbidden' });
    const res = await fetch('/api/rtc', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store',
      body: JSON.stringify({ code: s.code, pid: s.pid, key: s.key, ...body }),
    });
    let j = null;
    try { j = await res.json(); } catch { /* gövde yok */ }
    if (!res.ok) throw Object.assign(new Error((j && j.error) || 'server'), { status: res.status, code: (j && j.error) || 'server' });
    return j;
  }

  // ---------- arayüz ----------
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  panel.textContent = '';
  const head = el('div', 'call-head');
  const title = el('h3'); const hint = el('p', 'soft');
  head.append(title, hint);
  const grid = el('div', 'ctiles'); grid.hidden = true;
  const note = el('p', 'soft call-note'); note.hidden = true;
  const bar = el('div', 'call-bar');
  const bJoin = el('button', 'btn hot', ''); bJoin.type = 'button';
  const bMic = el('button', 'btn line', ''); bMic.type = 'button'; bMic.hidden = true;
  const bCam = el('button', 'btn line', ''); bCam.type = 'button'; bCam.hidden = true;
  const bLeave = el('button', 'btn ghost', ''); bLeave.type = 'button'; bLeave.hidden = true;
  bar.append(bJoin, bMic, bCam, bLeave);
  panel.append(head, grid, note, bar);

  const ICONS = {
    mic: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2Z"/></svg>',
    micoff: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="m3.3 2 18.7 18.7-1.3 1.3-4.1-4.1a6.9 6.9 0 0 1-2.6 1v3.1h-2v-3.1A7 7 0 0 1 5 12h2a5 5 0 0 0 7.2 4.5l-1.5-1.5A3 3 0 0 1 9 12V9.7L2 3.3 3.3 2Zm11.7 9.2L9.2 5.4A3 3 0 0 1 15 6v5.2Zm4 .8a7 7 0 0 1-.9 3.4l-1.5-1.5c.3-.6.4-1.2.4-1.9h2Z"/></svg>',
    cam: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M4 6h10a2 2 0 0 1 2 2v2.5l4-2.5v8l-4-2.5V16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/></svg>',
    camoff: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3.3 2 22 20.7 20.7 22l-2.9-2.9A2 2 0 0 1 16 20H4a2 2 0 0 1-2-2V8c0-.8.5-1.5 1.1-1.8L2 4.3 3.3 2ZM16 8v3.2L8.8 4H14a2 2 0 0 1 2 2Zm6 0v8l-4-2.5v-3L22 8Z"/></svg>',
    vol: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9H3Zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Z"/></svg>',
    voloff: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9H3Zm17.6 3 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4L20.6 12Z"/></svg>',
  };
  const setIcon = (btn, icon, label) => { btn.innerHTML = ICONS[icon]; btn.append(' ' + label); }; // yalnızca sabit SVG + çeviri metni

  function paint() {
    title.textContent = t('title');
    hint.textContent = C ? t('live') : t('hint');
    bJoin.textContent = t('join');
    bLeave.textContent = t('leave');
    const mic = !!(C && C.audio && C.audio.enabled);
    const cam = !!(C && C.video);
    setIcon(bMic, mic ? 'mic' : 'micoff', t('mic'));
    setIcon(bCam, cam ? 'cam' : 'camoff', t('cam'));
    bMic.setAttribute('aria-pressed', String(mic));
    bCam.setAttribute('aria-pressed', String(cam));
    bJoin.hidden = !!C;
    for (const b of [bMic, bCam, bLeave]) b.hidden = !C;
    grid.hidden = !C;
    const alone = C && C.peers.size === 0;
    if (alone) { note.hidden = false; note.textContent = t('alone'); } else if (!C || !C.notice) { note.hidden = true; }
    if (C && C.notice) { note.hidden = false; note.textContent = t(C.notice); }
    for (const p of (C ? [C.self, ...C.peers.values()] : [])) paintTile(p);
  }

  function makeTile(info, self) {
    const tile = el('div', 'ctile');
    const vid = document.createElement('video');
    vid.autoplay = true; vid.playsInline = true; vid.muted = !!self;
    vid.setAttribute('playsinline', '');
    const av = el('div', 'cav');
    av.append(window.KMAV ? window.KMAV.avEl(info.av || 0) : document.createElement('span'));
    const foot = el('div', 'cfoot');
    const name = el('b', null, info.name || '');
    const mic = el('span', 'cmic'); mic.setAttribute('role', 'img');
    foot.append(name, mic);
    const state = el('div', 'cstate'); state.hidden = true;
    tile.append(vid, av, foot, state);
    const o = { tile, vid, name, micEl: mic, state, info };
    if (!self) {
      const vol = el('button', 'cvol'); vol.type = 'button';
      vol.addEventListener('click', () => { vid.muted = !vid.muted; paintTile(o); });
      tile.append(vol); o.vol = vol;
    }
    grid.append(tile);
    return o;
  }
  function paintTile(o) {
    if (!o) return;
    const self = o === C.self;
    const mic = self ? !!(C.audio && C.audio.enabled) : o.micOn !== false;
    const cam = self ? !!C.video : !!o.camOn;
    o.tile.classList.toggle('cam-on', cam);
    o.tile.classList.toggle('cam-off', !cam);
    o.micEl.innerHTML = mic ? '' : ICONS.micoff;
    o.micEl.title = mic ? '' : t('muted');
    o.micEl.setAttribute('aria-label', mic ? '' : t('muted'));
    o.name.textContent = self ? `${o.info.name} (${t('you')})` : o.info.name;
    if (o.vol) {
      o.vol.innerHTML = o.vid.muted ? ICONS.voloff : ICONS.vol;
      o.vol.title = o.vid.muted ? t('unmute_them') : t('mute_them');
      o.vol.setAttribute('aria-label', o.vol.title);
    }
    const st = o.status;
    o.state.hidden = !st || st === 'connected';
    o.state.textContent = st === 'failed' ? t('failed') : t('connecting');
    if (st === 'failed') {
      if (!o.retry) {
        o.retry = el('button', 'btn line sm', ''); o.retry.type = 'button';
        o.retry.addEventListener('click', () => { if (C) { C.fails.delete(o.info.pid); dropPeer(o.info.pid, false); reconcile(); } });
        o.state.append(o.retry);
      }
      o.retry.textContent = t('retry');
    }
  }

  // ---------- konuşan vurgusu ----------
  function watchLevel(o, stream, isSelf) {
    if (!C.ac || !stream.getAudioTracks().length) return;
    try {
      const src = C.ac.createMediaStreamSource(stream);
      const an = C.ac.createAnalyser(); an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      o.level = { an, buf, src, on: false };
      o.level.timer = setInterval(() => {
        an.getByteTimeDomainData(buf);
        let s = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; }
        const loud = Math.sqrt(s / buf.length) > 0.04 && (isSelf ? !!(C && C.audio && C.audio.enabled) : o.micOn !== false);
        if (loud !== o.level.on) { o.level.on = loud; o.tile.classList.toggle('speaking', loud); }
      }, 160);
    } catch { /* ses analizi yoksa yalnızca vurgu olmaz */ }
  }

  // ---------- bağlantılar ----------
  const iceDone = (pc, ms) => new Promise((res) => {
    if (pc.iceGatheringState === 'complete') return res();
    const done = () => { pc.removeEventListener('icegatheringstatechange', on); clearTimeout(to); res(); };
    const on = () => { if (pc.iceGatheringState === 'complete') done(); };
    const to = setTimeout(done, ms);
    pc.addEventListener('icegatheringstatechange', on);
  });

  function broadcastState() {
    const msg = JSON.stringify({ mic: !!(C.audio && C.audio.enabled), cam: !!C.video });
    for (const p of C.peers.values()) { if (p.dc && p.dc.readyState === 'open') { try { p.dc.send(msg); } catch { /* kanal kapanmış */ } } }
  }

  function setupPeer(info, initiator) {
    const pid = info.pid;
    const pc = new RTCPeerConnection({ iceServers: C.ice });
    const o = makeTile(info, false);
    Object.assign(o, { pid, pc, initiator, stream: new MediaStream(), micOn: info.mic, camOn: info.cam, status: 'connecting', made: Date.now() });
    o.vid.srcObject = o.stream;
    C.peers.set(pid, o);

    pc.ontrack = (e) => {
      o.stream.addTrack(e.track);
      if (e.track.kind === 'audio') watchLevel(o, new MediaStream([e.track]), false);
      o.vid.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') {
        o.status = 'connected'; clearTimeout(o.giveUp); o.dc && o.dc.readyState === 'open' && o.dc.send(JSON.stringify({ mic: !!(C.audio && C.audio.enabled), cam: !!C.video }));
        capBitrate(o);
      } else if (s === 'failed' || s === 'closed') {
        if (C && C.peers.get(pid) === o) failPeer(o);
      } else if (s === 'disconnected') {
        clearTimeout(o.discT); o.discT = setTimeout(() => { if (C && C.peers.get(pid) === o && pc.connectionState === 'disconnected') failPeer(o); }, 8000);
      }
      paintTile(o);
    };
    const wireDc = (dc) => {
      o.dc = dc;
      dc.onopen = () => dc.send(JSON.stringify({ mic: !!(C.audio && C.audio.enabled), cam: !!C.video }));
      dc.onmessage = (ev) => {
        try { const m = JSON.parse(ev.data); if (typeof m.mic === 'boolean') o.micOn = m.mic; if (typeof m.cam === 'boolean') o.camOn = m.cam; paintTile(o); } catch { /* geçersiz */ }
      };
    };
    pc.ondatachannel = (ev) => wireDc(ev.channel);
    if (initiator) {
      wireDc(pc.createDataChannel('st'));
      o.ta = pc.addTransceiver(C.audio || 'audio', { direction: 'sendrecv' });
      o.tv = pc.addTransceiver(C.video || 'video', { direction: 'sendrecv' });
    }
    // Bir süre içinde kurulamazsa vazgeç; yeniden denemeyi uzlaştırma yapar.
    o.giveUp = setTimeout(() => { if (C && C.peers.get(pid) === o && o.status !== 'connected') failPeer(o); }, 25000);
    paintTile(o);
    paint();
    return o;
  }

  function capBitrate(o) {
    try {
      const s = o.tv && o.tv.sender;
      if (!s) return;
      const p = s.getParameters();
      if (!p.encodings || !p.encodings.length) p.encodings = [{}];
      p.encodings[0].maxBitrate = 250000;
      s.setParameters(p).catch(() => {});
    } catch { /* desteklenmiyor */ }
  }

  function failPeer(o) {
    const n = (C.fails.get(o.pid) || 0) + 1;
    C.fails.set(o.pid, n);
    if (n >= 3) { o.status = 'failed'; closePc(o); paintTile(o); return; }
    dropPeer(o.pid, false);
    setTimeout(reconcile, 2500); // kısa bekleyip yeniden dener
  }
  function closePc(o) {
    clearTimeout(o.giveUp); clearTimeout(o.discT);
    if (o.level) { clearInterval(o.level.timer); try { o.level.src.disconnect(); } catch { /* */ } }
    try { o.dc && o.dc.close(); } catch { /* */ }
    try { o.pc.onconnectionstatechange = null; o.pc.close(); } catch { /* */ }
  }
  function dropPeer(pid, sayBye) {
    const o = C && C.peers.get(pid);
    if (!o) return;
    if (sayBye) rtc({ a: 'send', to: pid, type: 'bye', data: '' }).catch(() => {});
    closePc(o);
    o.tile.remove();
    C.peers.delete(pid);
    paint();
  }

  async function sendLocalDescription(o, type) {
    await iceDone(o.pc, 2500);
    const d = o.pc.localDescription;
    await rtc({ a: 'send', to: o.pid, type, data: d.sdp });
  }

  async function connectTo(info) {
    const o = setupPeer(info, true);
    try {
      await o.pc.setLocalDescription(await o.pc.createOffer());
      await sendLocalDescription(o, 'offer');
    } catch (e) { if (C && C.peers.get(info.pid) === o) failPeer(o); }
  }

  async function onOffer(m) {
    let info = C.known.get(m.from);
    if (!info) { await refresh(); info = C.known.get(m.from); }
    if (!info) return; // konuşmada görünmeyen biri: yok say
    if (C.peers.has(m.from)) dropPeer(m.from, false); // karşı taraf yeniden bağlanıyor
    const o = setupPeer(info, false);
    try {
      await o.pc.setRemoteDescription({ type: 'offer', sdp: m.data });
      for (const tr of o.pc.getTransceivers()) {
        const kind = tr.receiver.track.kind;
        tr.direction = 'sendrecv';
        if (kind === 'audio') { o.ta = tr; if (C.audio) await tr.sender.replaceTrack(C.audio); }
        if (kind === 'video') { o.tv = tr; if (C.video) await tr.sender.replaceTrack(C.video); }
      }
      await o.pc.setLocalDescription(await o.pc.createAnswer());
      await sendLocalDescription(o, 'answer');
    } catch (e) { if (C && C.peers.get(m.from) === o) failPeer(o); }
  }
  async function onAnswer(m) {
    const o = C.peers.get(m.from);
    if (!o || o.pc.signalingState !== 'have-local-offer') return;
    try { await o.pc.setRemoteDescription({ type: 'answer', sdp: m.data }); } catch { failPeer(o); }
  }

  // Konuşma listesi ile bağlantıları uzlaştır: eksik olanlara (benden önce girenlere) teklif gönder.
  function reconcile() {
    if (!C) return;
    const now = Date.now();
    for (const info of C.known.values()) {
      const have = C.peers.get(info.pid);
      if (have) { if (have.status === 'connected' || have.status === 'connecting') { if (typeof info.mic === 'boolean' && !(have.dc && have.dc.readyState === 'open')) { have.micOn = info.mic; have.camOn = info.cam; paintTile(have); } } continue; }
      if ((C.fails.get(info.pid) || 0) >= 3) continue;
      const older = info.joined < C.me.joined || (info.joined === C.me.joined && info.pid < C.me.pid);
      if (older) connectTo(info);
    }
    for (const [pid, o] of [...C.peers]) {
      if (!C.known.has(pid) && now - o.made > 15000) dropPeer(pid, false);
    }
  }
  async function refresh() {
    const r = await rtc({ a: 'beat', mic: !!(C.audio && C.audio.enabled), cam: !!C.video });
    C.known = new Map(r.peers.map((p) => [p.pid, p]));
    reconcile();
  }

  // ---------- döngüler ----------
  async function pollLoop() {
    if (!C) return;
    const me = C;
    try {
      const r = await rtc({ a: 'poll', since: me.since });
      if (C !== me) return;
      for (const m of r.msgs) {
        me.since = Math.max(me.since, m.i);
        if (m.type === 'offer') await onOffer(m);
        else if (m.type === 'answer') await onAnswer(m);
        else if (m.type === 'bye') { me.fails.delete(m.from); dropPeer(m.from, false); }
      }
    } catch (e) {
      if (e.status === 403 || e.status === 404) { end(ERR[e.code] || 'e_gone'); return; }
    }
    if (C === me) me.pollT = setTimeout(pollLoop, document.hidden ? 5000 : 2500);
  }
  async function beatLoop() {
    if (!C) return;
    const me = C;
    try { await refresh(); } catch (e) {
      if (e.status === 403 || e.status === 404) { end(ERR[e.code] || 'e_gone'); return; }
    }
    if (C === me) me.beatT = setTimeout(beatLoop, 15000);
  }

  // ---------- katıl / ayrıl ----------
  async function join() {
    if (C || !sess()) return;
    if (!supported()) { toast(t('unsupported')); return; }
    const perms = (window.KMAuth && window.KMAuth.state && window.KMAuth.state.perms) || null;
    if (perms && perms.media === false && !(window.KMAuth.state.user && window.KMAuth.state.user.role === 'admin')) { toast(t('e_perm')); return; }
    bJoin.disabled = true;
    let audio = null; let notice = '';
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      audio = s.getAudioTracks()[0] || null;
    } catch { notice = 'listener'; }
    try {
      const r = await rtc({ a: 'join', mic: !!audio, cam: false });
      const s = sess();
      let ac = null;
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch { /* ses analizi olmadan devam */ }
      C = { sess: { code: s.code, pid: s.pid, key: s.key }, ice: r.ice, me: r.me, audio, video: null, peers: new Map(), known: new Map(), fails: new Map(), since: 0, ac, notice, self: null };
      // Kendi adım ve avatarım oda görünümünden gelir.
      const mine = (window.KMRoom && window.KMRoom.me && window.KMRoom.me()) || {};
      const info = { pid: r.me.pid, name: mine.name || '…', av: mine.av || 0 };
      C.self = makeTile(info, true);
      C.self.vid.classList.add('mirror');
      if (audio) watchLevel(C.self, new MediaStream([audio]), true);
      for (const p of r.peers) C.known.set(p.pid, p);
      paint();
      reconcile();
      pollLoop();
      C.beatT = setTimeout(beatLoop, 15000);
      FXsfx('whoosh');
    } catch (e) {
      if (audio) audio.stop();
      toast(t(ERR[e.code] || 'e_net'));
    } finally { bJoin.disabled = false; }
  }
  const FXsfx = (n) => { try { window.KMFX && window.KMFX.sfx(n); } catch { /* ses yok */ } };

  function teardown() {
    if (!C) return null;
    const me = C;
    C = null;
    clearTimeout(me.pollT); clearTimeout(me.beatT);
    for (const o of me.peers.values()) { closePc(o); o.tile.remove(); }
    if (me.self) { if (me.self.level) clearInterval(me.self.level.timer); me.self.tile.remove(); }
    for (const tr of [me.audio, me.video]) { try { tr && tr.stop(); } catch { /* */ } }
    try { me.ac && me.ac.close(); } catch { /* */ }
    return me;
  }
  function end(noticeKey) {
    const me = teardown();
    paint();
    if (me && noticeKey) toast(t(noticeKey));
  }
  async function leave() {
    const peers = C ? [...C.peers.keys()] : [];
    const had = !!C;
    // "bye" mesajlarını kutular silinmeden önce gönder.
    if (had) await Promise.allSettled(peers.map((pid) => rtc({ a: 'send', to: pid, type: 'bye', data: '' })));
    teardown();
    paint();
    if (had) rtc({ a: 'leave' }).catch(() => {});
  }
  // Oda kapanınca / sayfa kapanınca konuşmayı bırak.
  document.addEventListener('km:roomend', () => { if (C) leave(); });
  window.addEventListener('pagehide', () => {
    const s = sess();
    if (!C || !s) return;
    try { navigator.sendBeacon('/api/rtc', new Blob([JSON.stringify({ a: 'leave', code: s.code, pid: s.pid, key: s.key })], { type: 'application/json' })); } catch { /* */ }
  });

  // ---------- düğmeler ----------
  bJoin.addEventListener('click', join);
  bLeave.addEventListener('click', leave);
  bMic.addEventListener('click', async () => {
    if (!C) return;
    if (!C.audio) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        C.audio = s.getAudioTracks()[0];
        C.notice = '';
        if (!C.self.level) watchLevel(C.self, new MediaStream([C.audio]), true);
        for (const o of C.peers.values()) {
          if (o.ta) await o.ta.sender.replaceTrack(C.audio);
        }
      } catch { toast(t('listener')); return; }
    } else {
      C.audio.enabled = !C.audio.enabled;
    }
    broadcastState(); refresh().catch(() => {}); paint();
  });
  bCam.addEventListener('click', async () => {
    if (!C) return;
    if (C.video) {
      const v = C.video; C.video = null;
      for (const o of C.peers.values()) if (o.tv) o.tv.sender.replaceTrack(null).catch(() => {});
      C.self.vid.srcObject = null; v.stop();
    } else {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 }, facingMode: 'user' } });
        C.video = s.getVideoTracks()[0];
        C.self.vid.srcObject = new MediaStream([C.video]);
        C.self.vid.play().catch(() => {});
        for (const o of C.peers.values()) if (o.tv) { await o.tv.sender.replaceTrack(C.video); capBitrate(o); }
        C.video.addEventListener('ended', () => { if (C && C.video) bCam.click(); });
      } catch { toast(t('nocam')); return; }
    }
    broadcastState(); refresh().catch(() => {}); paint();
  });
  // dil değişince etiketleri yenile
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.lang button')) setTimeout(paint, 0); });

  // ---------- ilk durum ----------
  window.KMCall = { leave, active: () => !!C };
  const gate = () => {
    const st = window.KMAuth && window.KMAuth.state;
    const perm = !st || !st.perms || st.perms.media !== false || (st.user && st.user.role === 'admin');
    panel.classList.toggle('disabled', !perm || !supported());
    if (!supported()) hint.textContent = t('unsupported');
    else if (!perm && !C) hint.textContent = t('e_perm');
    bJoin.disabled = !perm || !supported();
  };
  paint();
  if (window.KMAuth && window.KMAuth.ready) window.KMAuth.ready.then(gate);
  gate();
})();

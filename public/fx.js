// Kartmasa efektleri: ses (WebAudio), müzik, konfeti, parçacıklar, kaydırınca beliren bölümler, eğilen kartlar.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* depolama kapalı */ } },
  };
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);

  // ================= SES =================
  const st = { fx: LS.get('km-fx', true), music: LS.get('km-music', false), vol: LS.get('km-vol', 60) };
  let ctx; let master; let musicGain; let musicTimer = null; let nextBar = 0; let barIdx = 0;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = (st.vol / 100) ** 1.5;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function env(g, t0, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  function tone(f, t0, d, o = {}) {
    const { type = 'sine', peak = 0.2, to = null, a = 0.008, dest } = o;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + d);
    env(g, t0, a, d, peak);
    osc.connect(g);
    g.connect(dest || master);
    osc.start(t0);
    osc.stop(t0 + a + d + 0.05);
  }
  function noise(t0, d, o = {}) {
    const { f0 = 400, f1 = 3000, peak = 0.12 } = o;
    const n = Math.floor(ctx.sampleRate * d);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f0, t0);
    bp.frequency.exponentialRampToValueAtTime(f1, t0 + d);
    const g = ctx.createGain();
    env(g, t0, d * 0.25, d * 0.75, peak);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0);
  }
  const SFX = {
    tick: (t) => tone(1900, t, 0.03, { type: 'triangle', peak: 0.025 }),
    click: (t) => { tone(660, t, 0.07, { type: 'triangle', peak: 0.12, to: 440 }); tone(1320, t, 0.04, { peak: 0.045 }); },
    open: (t) => { noise(t, 0.25, { f0: 300, f1: 2600, peak: 0.08 }); tone(hz(79), t + 0.1, 0.18, { peak: 0.05 }); },
    close: (t) => noise(t, 0.2, { f0: 2400, f1: 300, peak: 0.07 }),
    whoosh: (t) => noise(t, 0.4, { f0: 200, f1: 3600, peak: 0.1 }),
    join: (t) => [72, 76, 79].forEach((m, i) => tone(hz(m), t + i * 0.07, 0.24, { peak: 0.13 })),
    leave: (t) => [76, 72].forEach((m, i) => tone(hz(m), t + i * 0.09, 0.2, { peak: 0.09 })),
    msg: (t) => { tone(hz(84), t, 0.12, { peak: 0.08 }); tone(hz(88), t + 0.08, 0.16, { peak: 0.07 }); },
    copy: (t) => { tone(hz(79), t, 0.08, { type: 'square', peak: 0.035 }); tone(hz(86), t + 0.06, 0.12, { peak: 0.06 }); },
    error: (t) => tone(190, t, 0.24, { type: 'sawtooth', peak: 0.06, to: 120 }),
    start: (t) => {
      [60, 64, 67, 72, 76].forEach((m, i) => tone(hz(m), t + i * 0.09, 0.5, { type: 'triangle', peak: 0.11 }));
      noise(t, 0.5, { f0: 500, f1: 5000, peak: 0.06 });
      tone(hz(84), t + 0.5, 0.9, { peak: 0.09 });
    },
  };
  function sfx(name) {
    if (!st.fx || !ensure()) return;
    const f = SFX[name];
    if (f) f(ctx.currentTime + 0.005);
  }

  // Müzik: A minor dört akor, yumuşak pad + bas + arpej + hafif vuruş
  const PROG = [
    { bass: 45, pad: [57, 60, 64], arp: [69, 72, 76, 72] },
    { bass: 41, pad: [53, 57, 60], arp: [65, 69, 72, 69] },
    { bass: 48, pad: [60, 64, 67], arp: [72, 76, 79, 76] },
    { bass: 43, pad: [55, 59, 62], arp: [67, 71, 74, 71] },
  ];
  function scheduleBar(t) {
    const p = PROG[barIdx % 4]; barIdx++;
    const beat = 60 / 84; const bar = beat * 4;
    p.pad.forEach((m) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = hz(m);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + bar * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t + bar * 1.05);
      o.connect(g); g.connect(musicGain);
      o.start(t); o.stop(t + bar * 1.1);
    });
    tone(hz(p.bass), t, beat * 1.8, { peak: 0.12, dest: musicGain });
    tone(hz(p.bass), t + beat * 2, beat * 1.8, { peak: 0.09, dest: musicGain });
    for (let i = 0; i < 8; i++) tone(hz(p.arp[i % 4]), t + (i * beat) / 2, beat * 0.9, { peak: i % 2 ? 0.035 : 0.05, dest: musicGain });
    for (let i = 0; i < 4; i++) tone(90, t + i * beat, 0.12, { peak: 0.06, to: 45, dest: musicGain });
    return bar;
  }
  function musicLoop() {
    const now = ctx.currentTime;
    if (nextBar < now) nextBar = now + 0.1;
    while (nextBar < now + 1.2) nextBar += scheduleBar(nextBar);
  }
  function startMusic() {
    if (musicTimer || !ensure()) return;
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0001;
    musicGain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 1.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1800;
    musicGain.connect(lp); lp.connect(master);
    nextBar = ctx.currentTime + 0.1;
    musicTimer = setInterval(musicLoop, 250);
    musicLoop();
  }
  function stopMusic() {
    if (!musicTimer) return;
    clearInterval(musicTimer); musicTimer = null;
    const g = musicGain;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    setTimeout(() => g.disconnect(), 900);
  }

  // ----- ses paneli -----
  const btn = $('#snd-btn'); const pop = $('#snd-pop');
  const fxBox = $('#snd-fx'); const muBox = $('#snd-music'); const vol = $('#snd-vol');
  function paintSound() {
    if (btn) btn.dataset.state = st.fx || st.music ? 'on' : 'off';
    if (fxBox) fxBox.checked = st.fx;
    if (muBox) muBox.checked = st.music;
    if (vol) vol.value = String(st.vol);
  }
  if (btn && pop) {
    btn.addEventListener('click', () => {
      const open = pop.hidden;
      pop.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('pointerdown', (e) => {
      if (!pop.hidden && !e.target.closest('.snd')) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    fxBox.addEventListener('change', () => { st.fx = fxBox.checked; LS.set('km-fx', st.fx); paintSound(); if (st.fx) sfx('click'); });
    muBox.addEventListener('change', () => {
      st.music = muBox.checked; LS.set('km-music', st.music); paintSound();
      if (st.music) startMusic(); else stopMusic();
    });
    vol.addEventListener('input', () => {
      st.vol = Number(vol.value); LS.set('km-vol', st.vol);
      if (master) master.gain.value = (st.vol / 100) ** 1.5;
    });
    vol.addEventListener('change', () => sfx('tick'));
  }
  paintSound();

  // Tarayıcılar ilk dokunuştan önce sesi açtırmaz.
  let unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (st.music) startMusic();
  }
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (unlocked) ctx.resume();
  });

  // Genel tıklama ve üzerine gelme sesleri
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.snd')) return;
    if (e.target.closest('button, .btn, .mode, a.nav-a, .nav a')) sfx('click');
  });
  let lastTick = 0;
  if (fine) {
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest('.btn, .mode, .roomitem, .avgrid button, .chips button, .lang button, .nav a');
      if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
      const now = performance.now();
      if (now - lastTick > 70) { lastTick = now; sfx('tick'); }
    });
  }

  // ================= GÖRSEL =================
  // Konfeti
  const cc = $('#fx-confetti');
  let confetti = [];
  let confettiRun = false;
  const COLORS = ['#ff3b72', '#ffb21e', '#19d3a6', '#7a63ff', '#ffffff'];
  function burst(x, y, n = 140) {
    if (reduce || !cc) return;
    const w = (cc.width = innerWidth); const h = (cc.height = innerHeight);
    const ox = x ?? w / 2; const oy = y ?? h * 0.3;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const v = 4 + Math.random() * 9;
      confetti.push({
        x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6,
        r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
        s: 6 + Math.random() * 7, c: COLORS[(Math.random() * COLORS.length) | 0],
        d: Math.random() < 0.5, life: 0,
      });
    }
    if (!confettiRun) { confettiRun = true; requestAnimationFrame(confettiStep); }
  }
  function confettiStep() {
    const g = cc.getContext('2d');
    g.clearRect(0, 0, cc.width, cc.height);
    confetti = confetti.filter((p) => p.y < cc.height + 30 && p.life < 220);
    for (const p of confetti) {
      p.vy += 0.28; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
      g.globalAlpha = Math.max(0, 1 - p.life / 220);
      if (p.d) { g.beginPath(); g.moveTo(0, -p.s); g.lineTo(p.s * 0.7, 0); g.lineTo(0, p.s); g.lineTo(-p.s * 0.7, 0); g.closePath(); g.fill(); }
      else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      g.restore();
    }
    if (confetti.length) requestAnimationFrame(confettiStep);
    else { confettiRun = false; g.clearRect(0, 0, cc.width, cc.height); }
  }

  // Arka plan parçacıkları: yukarı süzülen elmaslar
  const bg = $('#fx-bg');
  if (bg && !reduce) {
    const g = bg.getContext('2d');
    let W = 0; let H = 0; let dpr = 1;
    const parts = [];
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      bg.width = W * dpr; bg.height = H * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener('resize', resize);
    const count = Math.min(38, Math.floor(innerWidth / 36));
    for (let i = 0; i < count; i++) {
      parts.push({
        x: Math.random() * W, y: Math.random() * H, s: 5 + Math.random() * 15,
        v: 6 + Math.random() * 22, sw: Math.random() * 6.28, r: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.4, c: COLORS[(Math.random() * 4) | 0], a: 0.07 + Math.random() * 0.16,
        fill: Math.random() < 0.55,
      });
    }
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!document.hidden) {
        g.clearRect(0, 0, W, H);
        for (const p of parts) {
          p.y -= p.v * dt; p.sw += dt * 0.8; p.r += p.vr * dt;
          if (p.y < -30) { p.y = H + 30; p.x = Math.random() * W; }
          const x = p.x + Math.sin(p.sw) * 18;
          g.save(); g.translate(x, p.y); g.rotate(p.r); g.globalAlpha = p.a;
          g.beginPath(); g.moveTo(0, -p.s); g.lineTo(p.s * 0.62, 0); g.lineTo(0, p.s); g.lineTo(-p.s * 0.62, 0); g.closePath();
          if (p.fill) { g.fillStyle = p.c; g.fill(); } else { g.strokeStyle = p.c; g.lineWidth = 1.4; g.stroke(); }
          g.restore();
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // Kaydırınca beliren bölümler. Gözlemci çalışmazsa her şey 3 sn sonra görünür.
  const rv = $$('[data-rv]');
  if (rv.length) {
    rv.forEach((el, i) => { el.style.setProperty('--d', `${(Number(el.dataset.rv) || 0) * 90}ms`); });
    const showAll = () => rv.forEach((el) => el.classList.add('in'));
    if (reduce || !('IntersectionObserver' in window)) showAll();
    else {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
      rv.forEach((el) => io.observe(el));
      setTimeout(showAll, 3500);
    }
  }

  // Sayaç animasyonu
  function count(el, to) {
    const end = Number(to);
    if (!el || Number.isNaN(end)) return;
    const from = Number(el.textContent) || 0;
    if (reduce || from === end) { el.textContent = String(end); return; }
    const t0 = performance.now(); const dur = 700;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = String(Math.round(from + (end - from) * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Eğilen kartlar ve imleci izleyen parıltı
  if (fine && !reduce) {
    let cur = null;
    const reset = (el) => { el.style.transform = ''; };
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest('[data-tilt]');
      if (cur && cur !== el) reset(cur);
      cur = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`);
      el.style.transform = `perspective(800px) rotateX(${(0.5 - y) * 7}deg) rotateY(${(x - 0.5) * 9}deg) translateY(-3px)`;
    });
    document.addEventListener('pointerleave', () => { if (cur) reset(cur); }, true);
    // Hero kart yelpazesi imleci takip eder
    const fan = $('.fan'); const hero = $('.hero');
    if (fan && hero) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        fan.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
        fan.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      });
      hero.addEventListener('pointerleave', () => { fan.style.setProperty('--px', '0'); fan.style.setProperty('--py', '0'); });
    }
  }

  // Düğmelerde dalga efekti
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn');
    if (!b || reduce || b.classList.contains('off')) return;
    const r = b.getBoundingClientRect(); const d = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'rip';
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    b.appendChild(s);
    setTimeout(() => s.remove(), 650);
  });

  window.KMFX = { sfx, confetti: burst, count, reduce };
})();

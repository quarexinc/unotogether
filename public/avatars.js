// 20 çizilmiş insan avatarı (SVG). window.KMAV.avEl(i) bir <span class="av"> döndürür.
(function () {
  'use strict';
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
  window.KMAV = { avEl, count: AVS.length };
})();

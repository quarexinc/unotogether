// Yönlendirme kuralları, istatistikler ve etkinlik günlüğü. Depodan bağımsızdır (store.kv*).
import { fail, sleep } from './errors.js';

const RULES_PATH = 'meta/gates.json';
const STATS_PATH = 'meta/gate-stats.json';
const LOG_PATH = 'meta/log.json';
const MAX_RULES = 30;
const LOG_KEEP = 300;

export const TRIGGERS = ['click', 'load', 'create', 'join'];
export const ACTIONS = ['redirect', 'popup', 'banner'];
export const FREQS = ['always', 'session', 'hours', 'once'];

const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// Yalnızca sitenin kendi yolu (/...) veya https adresi.
export function cleanUrl(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^\/(?![/\\])[^\s]{0,300}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' && s.length <= 500) return s;
  } catch { /* geçersiz */ }
  throw fail(400, 'gate_url');
}

const newId = () => 'r_' + Math.random().toString(36).slice(2, 8);

export function normalizeRule(r) {
  if (!r || typeof r !== 'object') throw fail(400, 'gate');
  const audience = {
    guest: !!r.audience?.guest,
    noapp: !!r.audience?.noapp,
    app: !!r.audience?.app,
  };
  const trigger = TRIGGERS.includes(r.trigger) ? r.trigger : 'click';
  const action = ACTIONS.includes(r.action) ? r.action : 'popup';
  const freq = FREQS.includes(r.freq) ? r.freq : 'session';
  const out = {
    id: /^r_[a-z0-9]{3,10}$/.test(String(r.id)) ? r.id : newId(),
    name: str(r.name, 60) || 'Adsız kural',
    enabled: !!r.enabled,
    audience,
    trigger,
    delay: Math.max(0, Math.min(120, Math.round(Number(r.delay) || 0))),
    pages: r.pages === 'all' ? 'all' : 'home',
    action,
    url: cleanUrl(r.url),
    title: str(r.title, 80),
    message: str(r.message, 400),
    ctaLabel: str(r.ctaLabel, 30),
    ctaUrl: cleanUrl(r.ctaUrl),
    laterLabel: str(r.laterLabel, 30),
    dismissable: r.dismissable !== false,
    freq,
    hours: Math.max(1, Math.min(720, Math.round(Number(r.hours) || 24))),
  };
  if (out.action === 'redirect' && !out.url) throw fail(400, 'gate_url');
  if (out.action !== 'redirect' && !out.title && !out.message) throw fail(400, 'gate_text');
  return out;
}

export function normalizeRules(list) {
  if (!Array.isArray(list)) throw fail(400, 'gate');
  if (list.length > MAX_RULES) throw fail(400, 'gate_many');
  const seen = new Set();
  return list.map((r) => {
    const n = normalizeRule(r);
    while (seen.has(n.id)) n.id = newId();
    seen.add(n.id);
    return n;
  });
}

// ---------- genel okuma/yazma yardımcıları ----------
async function rmw(store, path, fallback, fn, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const cur = await store.kvGet(path);
    const data = cur ? cur.data : structuredClone(fallback);
    fn(data);
    const ok = cur ? await store.kvWrite(path, data, cur.etag) : await store.kvCreate(path, data);
    if (ok) return data;
    await sleep(20 + Math.random() * 70);
  }
  throw fail(409, 'busy');
}

// ---------- kurallar ----------
const cache = new WeakMap();
export async function readRules(store, fresh = false) {
  const c = cache.get(store);
  if (!fresh && c && Date.now() - c.t < 3000) return c.v;
  const r = await store.kvGet(RULES_PATH);
  let v = [];
  try { v = normalizeRules(r?.data?.rules ?? []); } catch { v = []; }
  cache.set(store, { t: Date.now(), v });
  return v;
}

export async function writeRules(store, list) {
  const rules = normalizeRules(list);
  await rmw(store, RULES_PATH, { rules: [] }, (d) => { d.rules = rules; });
  cache.delete(store);
  return rules;
}

// category: 'guest' | 'noapp' | 'app' | 'admin'
export function applicable(rules, category) {
  if (category === 'admin') return [];
  return rules.filter((r) => r.enabled && r.audience[category]);
}

// ---------- istatistik ----------
const EMPTY_STATS = { rules: {}, dl: 0, dlUsers: 0 };
export async function readStats(store) {
  const r = await store.kvGet(STATS_PATH);
  return { ...EMPTY_STATS, ...(r?.data ?? {}) };
}
export async function bumpRule(store, id, ev) {
  if (!/^r_[a-z0-9]{3,10}$/.test(id) || !['shown', 'click', 'dismiss'].includes(ev)) throw fail(400, 'gate_event');
  await rmw(store, STATS_PATH, EMPTY_STATS, (d) => {
    d.rules ||= {};
    d.rules[id] ||= { shown: 0, click: 0, dismiss: 0 };
    d.rules[id][ev] += 1;
  }, 4);
}
export async function bumpDownload(store, newUser) {
  await rmw(store, STATS_PATH, EMPTY_STATS, (d) => {
    d.dl = (d.dl || 0) + 1;
    if (newUser) d.dlUsers = (d.dlUsers || 0) + 1;
  }, 4);
}
export async function resetStats(store, id) {
  await rmw(store, STATS_PATH, EMPTY_STATS, (d) => {
    if (id) delete (d.rules || {})[id];
    else { d.rules = {}; d.dl = 0; d.dlUsers = 0; }
  });
}

// ---------- etkinlik günlüğü ----------
export async function logEvent(store, who, ev, detail = '') {
  try {
    await rmw(store, LOG_PATH, { items: [] }, (d) => {
      d.items ||= [];
      d.items.push({ t: Date.now(), who: str(who, 24), ev: str(ev, 40), d: str(detail, 140) });
      if (d.items.length > LOG_KEEP) d.items.splice(0, d.items.length - LOG_KEEP);
    }, 3);
  } catch { /* günlük en iyi çabayla yazılır */ }
}
export async function readLog(store) {
  const r = await store.kvGet(LOG_PATH);
  return (r?.data?.items ?? []).slice().reverse();
}

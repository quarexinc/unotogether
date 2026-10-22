import { handleRtc } from '../lib/rtc.js';
import { getStore } from '../lib/store.js';

export default async function handler(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const { status, json } = await handleRtc(
    { method: req.method, body: req.body, ip, origin: req.headers.origin || '', host: req.headers.host || '' },
    getStore(),
  );
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(json);
}

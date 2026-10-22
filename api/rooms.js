import { handle } from '../lib/rooms.js';
import { getStore } from '../lib/store.js';

export default async function handler(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const { status, json } = await handle(
    { method: req.method, query: req.query || {}, body: req.body, ip, cookie: req.headers.cookie || '' },
    getStore(),
  );
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(json);
}

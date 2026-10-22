import { handleAuth } from '../lib/accounts.js';
import { getStore } from '../lib/store.js';

export default async function handler(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const out = await handleAuth(
    {
      method: req.method, query: req.query || {}, body: req.body, ip,
      cookie: req.headers.cookie || '',
      secure: String(req.headers['x-forwarded-proto'] || '').includes('https'),
      origin: req.headers.origin || '', host: req.headers.host || '',
    },
    getStore(),
  );
  res.setHeader('Cache-Control', 'no-store');
  if (out.setCookie) res.setHeader('Set-Cookie', out.setCookie);
  res.status(out.status).json(out.json);
}

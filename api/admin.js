import { handleAdmin } from '../lib/admin.js';
import { getStore } from '../lib/store.js';

export default async function handler(req, res) {
  const out = await handleAdmin(
    {
      method: req.method, query: req.query || {}, body: req.body,
      cookie: req.headers.cookie || '', origin: req.headers.origin || '', host: req.headers.host || '',
    },
    getStore(),
  );
  res.setHeader('Cache-Control', 'no-store');
  res.status(out.status).json(out.json);
}

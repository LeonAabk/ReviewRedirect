import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  getRedirects,
  getRedirectById,
  upsertRedirect,
  syncBatchRedirects,
  updateRedirectIdAndUrl,
  deleteRedirect
} from './src/server/storage.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());

// CORS & Headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// 1. Direkte NFC-snarvei: GET /r/:id (f.eks. /r/kafe-hansen eller /r/yummy-time-hamar)
app.get('/r/:id', (req, res) => {
  const id = req.params.id;
  const item = getRedirectById(id, true);
  if (item && item.google_url) {
    return res.redirect(302, item.google_url);
  }
  return res.redirect(`/r.html?id=${encodeURIComponent(id)}`);
});

// 2. GET /r.html: Hvis ?id= eller ?slug= sendes inn, utfør umiddelbar HTTP 302 omdirigering til destinasjonen
app.get('/r.html', (req, res, next) => {
  const id = ((req.query.id || req.query.slug || req.query.card || req.query.kort || '') as string).trim();
  if (id) {
    const item = getRedirectById(id, true);
    if (item && item.google_url) {
      return res.redirect(302, item.google_url);
    }
  }

  const rHtmlPath = isProd
    ? path.resolve(__dirname, 'dist', 'r.html')
    : (fs.existsSync(path.resolve(__dirname, 'public', 'r.html'))
        ? path.resolve(__dirname, 'public', 'r.html')
        : path.resolve(__dirname, 'r.html'));

  if (fs.existsSync(rHtmlPath)) {
    let content = fs.readFileSync(rHtmlPath, 'utf-8');
    const all = getRedirects();
    const inject = `<script>window.__SERVER_REDIRECTS__ = ${JSON.stringify(all)};</script>`;
    content = content.replace('</head>', `${inject}\n</head>`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(content);
  }
  next();
});

// 3. GET /: Hvis noen åpner rot-siden med ?id= eller ?slug= fra et programmert NFC-kort
app.get('/', (req, res, next) => {
  const id = ((req.query.id || req.query.slug || req.query.card || req.query.kort || '') as string).trim();
  if (id) {
    const item = getRedirectById(id, true);
    if (item && item.google_url) {
      return res.redirect(302, item.google_url);
    }
  }
  next();
});

// 4. Offentlig API for enkelt-omdirigering: GET /api/redirect/:id (eller /api/redirect?id=...)
app.get('/api/redirect/:id?', (req, res) => {
  const id = ((req.params.id || req.query.id || req.query.slug || '') as string).trim();
  if (!id) {
    return res.status(400).json({ success: false, error: 'Mangler id' });
  }
  const item = getRedirectById(id, true);
  if (item) {
    return res.json({ success: true, item });
  }
  return res.status(404).json({ success: false, error: `Kort-ID "${id}" ble ikke funnet på serveren.` });
});

// 5. API for klikkregistrering: POST /api/click/:id
app.post('/api/click/:id', (req, res) => {
  const id = req.params.id;
  const item = getRedirectById(id, true);
  if (item) {
    return res.json({ success: true, clicks: item.clicks });
  }
  return res.status(404).json({ success: false });
});

// 6. Offentlig API: GET /api/redirects (henter alle kort til dashboard)
app.get('/api/redirects', (req, res) => {
  const list = getRedirects();
  return res.json({ success: true, items: list });
});

// 7. API: POST /api/redirects (oppretter/oppdaterer kort eller synkroniserer batch fra localStorage)
app.post('/api/redirects', (req, res) => {
  const body = req.body;
  if (Array.isArray(body)) {
    const result = syncBatchRedirects(body);
    return res.json({ success: true, items: result });
  } else if (body && Array.isArray(body.items)) {
    const result = syncBatchRedirects(body.items);
    return res.json({ success: true, items: result });
  } else if (body && body.id && body.google_url) {
    const saved = upsertRedirect(body);
    return res.json({ success: true, item: saved, items: getRedirects() });
  }
  return res.status(400).json({ success: false, error: 'Mangler id eller google_url' });
});

// 8. API: PUT /api/redirects/:id (redigering av Kort-ID og URL)
app.put('/api/redirects/:id', (req, res) => {
  const oldId = req.params.id;
  const { newId, google_url } = req.body || {};
  if (!google_url) {
    return res.status(400).json({ success: false, error: 'Mangler google_url' });
  }
  const updated = updateRedirectIdAndUrl(oldId, newId || oldId, google_url);
  if (updated) {
    return res.json({ success: true, item: updated, items: getRedirects() });
  }
  return res.status(404).json({ success: false, error: 'Fant ikke opprinnelig kort' });
});

// 9. API: DELETE /api/redirects/:id
app.delete('/api/redirects/:id', (req, res) => {
  const id = req.params.id;
  const ok = deleteRedirect(id);
  return res.json({ success: ok, items: getRedirects() });
});

// 10. GET /admin.html
app.get('/admin.html', (req, res, next) => {
  const adminHtmlPath = isProd
    ? path.resolve(__dirname, 'dist', 'admin.html')
    : (fs.existsSync(path.resolve(__dirname, 'public', 'admin.html'))
        ? path.resolve(__dirname, 'public', 'admin.html')
        : path.resolve(__dirname, 'admin.html'));

  if (fs.existsSync(adminHtmlPath)) {
    let content = fs.readFileSync(adminHtmlPath, 'utf-8');
    const sbUrl = process.env.VITE_SUPABASE_URL || '';
    const sbKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    content = content
      .replace("const SUPABASE_URL = '';", `const SUPABASE_URL = '${sbUrl}';`)
      .replace("const SUPABASE_ANON_KEY = '';", `const SUPABASE_ANON_KEY = '${sbKey}';`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(content);
  }
  next();
});

// 11. Direkte kort-slug rute: /:slug (hvis noen har programmert kun slug i NFC)
app.get('/:slug', (req, res, next) => {
  const slug = req.params.slug;
  const reserved = [
    'admin.html',
    'r.html',
    'index.html',
    'api',
    'assets',
    'favicon.ico',
    'robots.txt',
    '@vite',
    'src',
    'node_modules'
  ];
  if (reserved.includes(slug.toLowerCase()) || slug.includes('.')) {
    return next();
  }
  const item = getRedirectById(slug, true);
  if (item && item.google_url) {
    return res.redirect(302, item.google_url);
  }
  next();
});

// 12. Vite middleware (dev) eller dist static (prod)
async function startServer() {
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: Number(PORT) },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server kjører på http://0.0.0.0:${PORT} [${isProd ? 'production' : 'development'}]`);
  });
}

startServer();

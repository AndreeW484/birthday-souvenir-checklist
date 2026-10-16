import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { handleApi } from './api.mjs';

const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
for (const weight of [400, 600, 700, 800]) files[`/fonts/nunito-${weight}.ttf`] = [`fonts/nunito-${weight}.ttf`, 'font/ttf'];

export const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
    const url = new URL(req.url, 'http://' + req.headers.host);
    if (url.pathname.startsWith('/api/')) {
      const options = { method: req.method, headers: req.headers };
      if (!['GET', 'HEAD'].includes(req.method)) { options.body = Readable.toWeb(req); options.duplex = 'half'; }
      const response = await handleApi(new Request(url, options));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (req.method !== 'GET' || !files[url.pathname]) { res.writeHead(404); res.end('No encontrado.'); return; }
    const [file, mime] = files[url.pathname];
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(await readFile(new URL('./public/' + file, import.meta.url)));
  } catch { res.writeHead(500); res.end('No pudimos completar la operación.'); }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log('Checklist listo: http://localhost:' + (process.env.PORT || 3000)));

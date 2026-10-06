import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../_site/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };

function parsePort(raw) {
  if (raw === undefined || raw === '') return 4173;
  if (!/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  return value >= 1 && value <= 65535 ? value : undefined;
}

const rawPort = process.env.COURSE_PORT;
const port = parsePort(rawPort);
if (port === undefined) {
  console.error(`Invalid COURSE_PORT "${rawPort}": expected an integer between 1 and 65535 (e.g. COURSE_PORT=4173).`);
  process.exitCode = 1;
} else {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/') { response.writeHead(302, { Location: '/linux/' }); response.end(); return; }
      if (!pathname.startsWith('/linux/')) { response.writeHead(404); response.end(); return; }
      const target = path.resolve(root, pathname.slice('/linux/'.length) || 'index.html');
      if (!target.startsWith(root)) { response.writeHead(403); response.end(); return; }
      const info = await stat(target);
      if (!info.isFile()) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      response.end(await readFile(target));
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use on 127.0.0.1. Stop the process using it or choose another COURSE_PORT, e.g. COURSE_PORT=${port >= 65535 ? 65534 : port + 1} node scripts/serve-site.mjs`);
    } else {
      console.error(`Course preview server failed on 127.0.0.1:${port}: ${error.message}`);
    }
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`Course preview: http://127.0.0.1:${port}/linux/`));
}

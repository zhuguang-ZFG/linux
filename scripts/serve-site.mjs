import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../_site/', import.meta.url));
const port = Number(process.env.COURSE_PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
createServer(async (request, response) => {
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
}).listen(port, '127.0.0.1', () => console.log(`Course preview: http://127.0.0.1:${port}/linux/`));

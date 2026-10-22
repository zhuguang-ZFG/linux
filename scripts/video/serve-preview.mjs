// 本地预览服务器：带 Range 支持，浏览器才能拖动进度条抽看时间点
// 用法 node scripts/video/serve-preview.mjs <目录> [端口]
import { createServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'video-out');
const port = Number(process.argv[3] || 8765);
const TYPES = { '.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg', '.srt': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  const size = statSync(file).size;
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': type });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Accept-Ranges': 'bytes', 'Content-Length': size, 'Content-Type': type });
    createReadStream(file).pipe(res);
  }
}).listen(port, '127.0.0.1', () => console.log(`预览 http://127.0.0.1:${port}/preview.html  (${root})`));

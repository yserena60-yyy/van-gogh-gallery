import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8765);
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
};

createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) {
      response.writeHead(403).end();
      return;
    }
    const details = await stat(file);
    if (!details.isFile()) {
      response.writeHead(404).end();
      return;
    }
    const headers = {
      'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
      'Content-Length': details.size,
      'Accept-Ranges': 'bytes',
    };
    const range = request.method === 'GET' ? request.headers.range : null;
    let start = 0;
    let end = details.size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (match && (match[1] || match[2])) {
        if (match[1]) {
          start = Number(match[1]);
          end = match[2] ? Math.min(Number(match[2]), end) : end;
        } else {
          const suffix = Number(match[2]);
          start = suffix > 0 ? Math.max(0, details.size - suffix) : details.size;
        }
      }
      if (!match || !(match[1] || match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= details.size) {
        response.writeHead(416, { 'Content-Range': `bytes */${details.size}` }).end();
        return;
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${details.size}`;
      headers['Content-Length'] = end - start + 1;
    }
    response.writeHead(range ? 206 : 200, headers);
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    await pipeline(createReadStream(file, range ? { start, end } : {}), response);
  } catch {
    if (response.headersSent) response.destroy();
    else response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Interactive gallery: http://127.0.0.1:${port}`);
});

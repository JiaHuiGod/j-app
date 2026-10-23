import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.update-mirror');
const port = Number(process.argv[3] ?? 8787);

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end();
    return;
  }

  let pathname;

  try {
    pathname = decodeURIComponent(
      new URL(request.url ?? '/', 'http://127.0.0.1').pathname,
    );
  } catch {
    response.writeHead(400).end();
    return;
  }

  const filePath = path.resolve(root, `.${pathname}`);

  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }

  let fileStat;

  try {
    fileStat = statSync(filePath);
  } catch {
    response.writeHead(404).end();
    return;
  }

  if (!fileStat.isFile()) {
    response.writeHead(404).end();
    return;
  }

  const contentType = filePath.endsWith('.nupkg')
    ? 'application/octet-stream'
    : 'text/plain; charset=utf-8';

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': fileStat.size,
    'Content-Type': contentType,
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}

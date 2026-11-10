// 検証用に同じプロセスの中で配信する（別プロセスを立てない＝止め忘れが残らない）。gzip あり
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { gzipSync } from 'node:zlib'
const ROOT = join(import.meta.dirname, '..')
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.md': 'text/plain; charset=utf-8' }
export function serve(port = 0) {
  const srv = http.createServer(async (q, r) => {
    let p = normalize(decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'
    if (p.includes('..')) { r.writeHead(400); return r.end() }
    try {
      let body = await readFile(join(ROOT, p)); const ty = TYPES[extname(p)] || 'application/octet-stream'
      const h = { 'content-type': ty, 'cache-control': 'no-store' }
      if (/text|javascript|json|svg/.test(ty) && /gzip/.test(q.headers['accept-encoding'] || '')) { body = gzipSync(body); h['content-encoding'] = 'gzip' }
      r.writeHead(200, h); r.end(body)
    } catch (e) { r.writeHead(404); r.end() }
  })
  return new Promise((ok) => srv.listen(port, () => ok({ url: `http://localhost:${srv.address().port}/`, close: () => new Promise((d) => srv.close(d)) })))
}

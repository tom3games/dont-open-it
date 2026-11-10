import './mute-auto.mjs'
// 遊び方ごとの点の分布。node sim.mjs [回数=12]
import { chromium } from 'playwright'
import { serve } from './tools/serve.mjs'
const N = +(process.argv[2] || 12)
const sv = await serve(0)
const b = await chromium.launch()
const p = await (await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } })).newPage()
await p.goto(sv.url + '?tut=0'); await p.waitForFunction(() => window.__dnReady, null, { timeout: 15000 })
const kinds = ['best', 'human', 'slow', 'noReal', 'slapAll', 'spam', 'openAll', 'nothing']
const rows = await p.evaluate(({ kinds, N }) => kinds.map((k) => {
  const rs = []; for (let i = 1; i <= N; i++) rs.push(dn.sim(k, i * 101))
  const avg = (f) => Math.round(rs.reduce((a, r) => a + f(r), 0) / rs.length * 10) / 10
  const ranks = {}; for (const r of rs) ranks[r.rank] = (ranks[r.rank] || 0) + 1
  return { k, score: avg((r) => r.score), min: Math.min(...rs.map((r) => r.score)), max: Math.max(...rs.map((r) => r.score)), base: avg((r) => r.base), study: avg((r) => r.study), slaps: avg((r) => r.st.slaps), bad: avg((r) => r.st.bad), opens: avg((r) => r.st.opens), byHand: avg((r) => r.st.byHand), real: avg((r) => r.st.realOk), items: avg((r) => r.st.items), pt: avg((r) => r.pt), ranks }
}), { kinds, N })
for (const r of rows) console.log(JSON.stringify(r))
await b.close(); await sv.close()

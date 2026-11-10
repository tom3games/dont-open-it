import '../mute-auto.mjs'
// チュートリアル・朝・正体・答案を撮る。node tools/shot2.mjs [w h] [lang]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { serve } from './serve.mjs'
const OUT = import.meta.dirname + '/../shots'; mkdirSync(OUT, { recursive: true })
const [w, h] = [+(process.argv[2] || 390), +(process.argv[3] || 844)], lang = process.argv[4] || 'ja'
const sv = await serve(0)
const b = await chromium.launch()
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: w, height: h }, deviceScaleFactor: 2 })
const p = await ctx.newPage(); const errs = []
p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(sv.url + '?tut=1&seed=9&lang=' + lang); await p.waitForFunction(() => window.__dnReady, null, { timeout: 15000 })
const sh = (n) => p.screenshot({ path: `${OUT}/t-${n}-${w}-${lang}.png` })
await p.click('#bStart'); await p.evaluate(() => dn.dbg.pause())
const st = (n) => p.evaluate((n) => dn.dbg.step(n), n)
for (let i = 0; i < 400 && !(await p.evaluate(() => dn.S.freeze)); i++) await st(5)
await sh('freeze')
const hx = await p.evaluate(() => dn.handXY(0)); await p.mouse.click(hx.x, hx.y); await st(20)
for (let i = 0; i < 400 && !(await p.evaluate(() => dn.S.hint && dn.S.hint.key === 'hintFeint')); i++) await st(5)
await st(20); await sh('feint')
await p.evaluate(() => dn.bot('human', 2))
for (let i = 0; i < 600 && !(await p.evaluate(() => dn.S.hint && dn.S.hint.key === 'hintReal')); i++) await st(10)
await p.evaluate(() => dn.bot(null)); await st(30); await sh('realhint')
await p.evaluate(() => dn.bot('human', 2))
await p.evaluate(() => dn.dbg.skipTo(478.5)); for (let i = 0; i < 200 && (await p.evaluate(() => dn.S.mode)) !== 'alarm'; i++) await st(10)
await st(40); await sh('alarm')
const ph = await p.evaluate(() => dn.phoneXY()); await p.mouse.click(ph.x, ph.y)
await st(60 * 1.5); await sh('reveal1'); await st(60 * 3); await sh('reveal2')
await p.mouse.click(w / 2, h / 2); await p.waitForTimeout(800); await sh('result')
console.log(JSON.stringify(await p.evaluate(() => dn.S.res && { s: dn.S.res.score, r: dn.S.res.title })))
console.log(errs.join('\n') || 'no errors')
await b.close(); await sv.close()

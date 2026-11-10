import '../mute-auto.mjs'
// 画面を撮って見る。node tools/shot.mjs [w h]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { serve } from './serve.mjs'
const OUT = import.meta.dirname + '/../shots'; mkdirSync(OUT, { recursive: true })
const [w, h] = [+(process.argv[2] || 390), +(process.argv[3] || 844)]
const sv = await serve(0)
const b = await chromium.launch()
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: w, height: h }, deviceScaleFactor: 2 })
const p = await ctx.newPage(); const errs = []
p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(sv.url + '?tut=0&seed=5'); await p.waitForFunction(() => window.__dnReady, null, { timeout: 15000 })
await p.waitForTimeout(400)
await p.screenshot({ path: `${OUT}/s-title-${w}.png` })
await p.click('#bStart'); await p.evaluate(() => dn.dbg.pause())
const st = async (n, name) => { await p.evaluate((n) => dn.dbg.step(n), n); await p.screenshot({ path: `${OUT}/s-${name}-${w}.png` }) }
await p.evaluate(() => dn.bot('best', 3))
await st(60 * 4, 'play4')
await p.evaluate(() => { dn.bot(null); dn.dbg.force(0, 'phone') }); await st(60 * 1.05, 'lunge')
await p.evaluate(() => { dn.slap(0) }); await st(8, 'slapped')
await p.evaluate(() => dn.bot('best', 3)); await st(60 * 2, 'after')
await p.evaluate(() => dn.dbg.addNote('real', 'mom')); await st(10, 'real')
await p.evaluate(() => { dn.bot('best', 4); dn.dbg.skipTo(250) }); await st(60 * 3, 'late')
await p.evaluate(() => { dn.bot(null); dn.dbg.force(1, 'phone'); dn.dbg.force(0, 'mug') }); await st(60 * 1.1, 'late2')
console.log(JSON.stringify(await p.evaluate(() => dn.state())))
await p.evaluate(() => dn.dbg.finish()); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/s-result-${w}.png` })
console.log(errs.join('\n') || 'no errors')
await b.close(); await sv.close()

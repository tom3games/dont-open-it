import './mute-auto.mjs'
// その通知、開くな の検証。node verify.mjs
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { chromium, webkit } from 'playwright'
import { mkdirSync } from 'node:fs'
import { serve } from './tools/serve.mjs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const sv = await serve(0)
const URL0 = sv.url
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}, q = '?tut=0&seed=7') {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('keep')) localStorage.clear() } catch (e) { } })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', (e) => p.errs.push('pageerror ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0 + q); await p.waitForFunction(() => window.__dnReady, null, { timeout: 15000 })
  await p.waitForTimeout(500)
  return p
}
const overflow = (p) => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *, #overlay:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    if (el.closest('.feed')) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = (q) => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) button,main:not([hidden]) a,main:not([hidden]) canvas,#overlay:not([hidden]) .ov-phone,#phone')) { if (!el.offsetParent && el.id !== 'phone') continue; const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1 || r.left < -1 || r.right > innerWidth + 1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  return { H, over: over.slice(0, 6) }
})
const variance = (p, sel) => p.evaluate((sel) => {
  const c = document.querySelector(sel), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 13) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  return Math.round(s2 / n - (s / n) ** 2)
}, sel)
const st = (p) => p.evaluate(() => dn.state())
const step = (p, n) => p.evaluate((n) => dn.dbg.step(n), n)
// 手が状態になるまで進める
async function until(p, fn, arg, max = 900) { for (let i = 0; i < max; i += 5) { if (await p.evaluate(fn, arg)) return true; await step(p, 5) } return false }
async function startPaused(p) { await p.click('#bStart'); await p.evaluate(() => { dn.dbg.pause(); dn.S.nextNote = 1e9; dn.S.hands[0].next = 1e9; dn.S.hands[1].next = 1e9 }) }

const browser = await chromium.launch(MUTE_LAUNCH)
let p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r))
})
await t('OGP 一式がある（画像は絶対URL）', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map((k) => (document.querySelector(`meta[property="${k}"]`) || {}).content).concat((document.querySelector('meta[name="twitter:card"]') || {}).content))
  expect(r.every(Boolean) && /^https:\/\/.*og\.png/.test(r[2]), JSON.stringify(r))
})
await t('タイトル: 題名・はじめる・遊び方・English が見える', async () => {
  const r = await p.evaluate(() => ['#t1', '#t2', '#bStart', '#bHow', '#bLang'].map((s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return e.textContent && b.width > 10 && b.bottom <= innerHeight }))
  expect(r.every(Boolean), JSON.stringify(r))
})
await t('遊び方を開いて戻る（ルールは3つ）', async () => {
  await p.click('#bHow'); const n = await p.evaluate(() => document.querySelectorAll('#howRules li').length)
  await p.click('#bHowClose'); const v = await p.evaluate(() => dn.mode)
  expect(n === 3 && v === 'title', n + ' ' + v); return { rules: n }
})

// ---- 遊びの芯（本物の指で押す） ----
await startPaused(p)
await t('はじめるで遊びに入り、音は無音のまま（Chromium）', async () => {
  const r = await p.evaluate(() => ({ v: dn.mode, ok: window.__muteOk(), calls: window.__soundCalls }))
  expect(r.v === 'play' && r.ok, JSON.stringify(r)); return r
})
await t('音を鳴らす呼び出しが届いている（無音のまま）', async () => {
  await p.evaluate(() => dn.dbg.addNote('spam', 'cart'))
  const r = await p.evaluate(() => ({ played: Object.values(Snd.played).reduce((a, b) => a + b, 0), loops: Object.keys(Snd.loops).length, ok: window.__muteOk() }))
  expect(r.played > 0 && r.loops >= 2 && r.ok, JSON.stringify(r)); return r
})
await t('右手はノートの上で書く（行が進む）', async () => {
  const a = (await st(p)).study; await step(p, 120); const b = (await st(p)).study
  expect(b - a > 1.5, a + '->' + b); return { d: +(b - a).toFixed(2) }
})
await t('スマホへ伸びた手を指で押すと、はたける（開かない）', async () => {
  await p.evaluate(() => dn.dbg.force(0, 'phone'))
  await until(p, () => dn.S.hands[0].st === 'go')
  await step(p, 10)
  const xy = await p.evaluate(() => dn.handXY(0)); await p.mouse.click(xy.x, xy.y)
  const s = await st(p)
  expect(s.stats.slaps === 1 && s.hands[0].st === 'hurt' && s.stats.opens === 0, JSON.stringify(s.stats) + s.hands[0].st)
})
await t('消しゴムへ伸びた手をはたくと「痛っ」で勉強が止まる', async () => {
  await until(p, () => dn.S.hands[0].st === 'write')
  await p.evaluate(() => dn.dbg.force(0, 'eraser'))
  await until(p, () => dn.S.hands[0].st === 'go')
  const xy = await p.evaluate(() => dn.handXY(0)); await p.mouse.click(xy.x, xy.y)
  const s = await st(p); const pause = await p.evaluate(() => dn.S.pause - dn.S.pt)
  expect(s.stats.bad === 1 && pause > 0.5, JSON.stringify(s.stats) + ' ' + pause)
})
await t('消しゴムを通すと使って戻ってくる（勉強が増える）', async () => {
  await until(p, () => dn.S.hands[0].st === 'write' && dn.S.pt > dn.S.pause)
  const a = await p.evaluate(() => dn.S.stats.items)
  await p.evaluate(() => dn.dbg.force(0, 'eraser'))
  const ok = await until(p, () => dn.S.hands[0].st === 'apply', null, 600)
  await until(p, () => dn.S.hands[0].st === 'write')
  const b = await p.evaluate(() => dn.S.stats.items)
  expect(ok && b === a + 1, ok + ' ' + a + '->' + b)
})
await t('伸びた手を放っておくと通知を開いてしまい、時間が溶ける', async () => {
  await p.evaluate(() => { dn.dbg.addNote('spam', 'oshi') })
  await until(p, () => dn.S.hands[0].st === 'write')
  await p.evaluate(() => dn.dbg.force(0, 'phone'))
  const g0 = await p.evaluate(() => dn.S.gm)
  const ok = await until(p, () => dn.S.mode === 'melt', null, 600)
  const shot = await p.evaluate(() => !document.getElementById('overlay').hidden)
  await until(p, () => dn.S.mode === 'play', null, 600)
  const s = await st(p)
  expect(ok && shot && s.stats.opens === 1 && s.stats.byHand === 1 && s.gm - g0 >= 20, JSON.stringify(s.stats) + ' ' + (s.gm - g0))
  return { melted: Math.round(s.gm - g0) }
})
await t('スマホへ伸びた手が通知の上にあっても、押せばはたく方が勝つ', async () => {
  await p.evaluate(() => { dn.dbg.addNote('spam', 'cart'); dn.dbg.addNote('spam', 'like') })
  await until(p, () => dn.S.hands[0].st === 'write')
  await p.evaluate(() => dn.dbg.force(0, 'phone'))
  await until(p, () => dn.S.hands[0].st === 'go' && (dn.S.pt - dn.S.hands[0].t0) / dn.S.hands[0].dur > 0.8)
  const r = await p.evaluate(() => { const xy = dn.handXY(0); const e = document.elementFromPoint(xy.x, xy.y); return { xy, onCard: !!(e && e.closest('.card')) } })
  const o0 = (await st(p)).stats.opens
  await p.mouse.click(r.xy.x, r.xy.y)
  const s = await st(p)
  expect(s.stats.opens === o0 && s.stats.slaps === 2, JSON.stringify(r) + JSON.stringify(s.stats)); return { onCard: r.onCard }
})
await t('本物の至急（母）を指で開くと、得をして早く戻る', async () => {
  await until(p, () => dn.S.hands[0].st === 'write')
  const uid = await p.evaluate(() => dn.dbg.addNote('real', 'mom'))
  const vis = await p.evaluate((u) => dn.visibleCards()[0] === u, uid)
  const xy = await p.evaluate((u) => dn.cardXY(u), uid); await p.mouse.click(xy.x, xy.y)
  const s = await st(p)
  expect(vis && s.mode === 'real' && s.stats.realOk === 1, vis + JSON.stringify(s))
  await until(p, () => dn.S.mode === 'play', null, 400)
})
await t('偽物の至急（お母さん（公式））を開くと時間が溶ける', async () => {
  const uid = await p.evaluate(() => dn.dbg.addNote('fake', 'fmom'))
  const top = await p.evaluate(() => dn.visibleCards()[0])
  const xy = await p.evaluate((u) => dn.cardXY(u), uid); await p.mouse.click(xy.x, xy.y)
  const s = await st(p)
  expect(top === uid && s.mode === 'melt' && s.stats.fakeOpen === 1, JSON.stringify(s.stats) + ' top ' + top)
  await until(p, () => dn.S.mode === 'play', null, 400)
})
await t('本物を9秒放っておくと見逃し。後から開いても得はしない', async () => {
  const uid = await p.evaluate(() => dn.dbg.addNote('real', 'ken'))
  for (let i = 0; i < 300; i++) { await p.evaluate(() => { dn.S.hands[0].next = 1e9; dn.S.hands[1].next = 1e9; dn.S.nextNote = 1e9 }); await step(p, 5); if (await p.evaluate((u) => dn.notes().find((x) => x.uid === u).missed && dn.S.mode === 'play', uid)) break }
  const n = await p.evaluate((u) => dn.notes().find((x) => x.uid === u), uid)
  const ok0 = (await st(p)).stats.realOk
  await p.evaluate((u) => dn.tapCard(u), uid)
  const s = await st(p)
  expect(n.missed && !n.pinned && s.stats.realOk === ok0 && s.mode === 'real', JSON.stringify(n) + JSON.stringify(s.stats))
  await until(p, () => dn.S.mode === 'play', null, 400)
})
await t('2時から左手も伸びてくる', async () => {
  await p.evaluate(() => dn.dbg.skipTo(241))
  const s = await st(p)
  expect(s.hands[1].on, JSON.stringify(s.hands))
})
await t('左手がスマホへ伸びても指ではたける', async () => {
  await p.evaluate(() => { dn.S.hands[0].next = 1e9; dn.dbg.force(1, 'phone') })
  await until(p, () => dn.S.hands[1].st === 'go')
  const a = (await st(p)).stats.slaps
  const xy = await p.evaluate(() => dn.handXY(1)); await p.mouse.click(xy.x, xy.y)
  const s = await st(p)
  expect(s.stats.slaps === a + 1 && s.hands[1].st === 'hurt', JSON.stringify(s.hands[1]))
})
await t('朝6時: アラームでスマホを押すと正体が明かされ、答案が返る', async () => {
  await p.evaluate(() => { dn.S.nextNote = dn.S.pt + 1; dn.dbg.skipTo(480) })
  await until(p, () => dn.S.mode === 'alarm', null, 600)
  await step(p, 30)
  const xy = await p.evaluate(() => dn.phoneXY()); await p.mouse.click(xy.x, xy.y)
  const m = await p.evaluate(() => dn.S.mode)
  await step(p, 60 * 4)
  const n = await p.evaluate(() => document.querySelectorAll('.rv.on').length)
  await p.screenshot({ path: ROOT + '/shots/v-reveal.png' })
  await p.mouse.click(195, 400); await p.waitForTimeout(500)
  const v = await p.evaluate(() => dn.mode)
  const va = await variance(p, '#card')
  await p.screenshot({ path: ROOT + '/shots/v-result.png' })
  expect(m === 'reveal' && n >= 3 && v === 'result' && va > 500, [m, n, v, va].join(' ')); return { revealed: n, variance: va }
})
await t('結果: Xでポストのリンクに点数とURL', async () => {
  const h = await p.evaluate(() => document.getElementById('bPost').href)
  expect(/x\.com\/intent\/post/.test(h) && /tom3games\.com%2Fplay%2Fdont-open-it/.test(h) && /%E7%82%B9/.test(h), h)
})
await t('もう一回で、まっさらな夜からやり直せる（連打しても1回）', async () => {
  await p.evaluate(() => { const b = document.getElementById('bAgain'); b.click(); b.click() })
  const s = await st(p)
  expect(s.view === 'play' && s.study < 0.1 && s.gm < 1 && s.stats.opens === 0, JSON.stringify(s))
})
await t('遊んだ間のエラーなし', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

// ---- 採点の分布（sim。遊び方ごとに12回） ----
p = await open(browser)
await t('分布: 上手い > 人の速さ > 遅い > 全部はたく > 何もしない。人の速さで60点前後', async () => {
  const r = await p.evaluate(() => {
    const avg = (k) => { let s = 0; for (let i = 1; i <= 12; i++) s += dn.sim(k, i * 101).score; return Math.round(s / 12) }
    return { best: avg('best'), human: avg('human'), slow: avg('slow'), noReal: avg('noReal'), slapAll: avg('slapAll'), openAll: avg('openAll'), spam: avg('spam'), nothing: avg('nothing') }
  })
  expect(r.best > r.human && r.human > r.slow && r.slow > r.slapAll && r.slapAll > r.nothing && r.human >= 55 && r.best > r.noReal && r.human > r.openAll && r.nothing < 20 && r.spam <= 5, JSON.stringify(r)); return r
})
await t('何もしない夜は最低の判定（追試）', async () => {
  const r = await p.evaluate(() => [1, 2, 3, 4, 5].map((s) => dn.sim('nothing', s)).map((x) => x.score + x.rank))
  expect(r.every((x) => /追試$/.test(x)), r.join(',')); return r
})
await t('同じ種・同じ遊び方なら同じ点（再現）', async () => {
  const r = await p.evaluate(() => [dn.sim('human', 42).score, dn.sim('human', 42).score, dn.sim('best', 9).score, dn.sim('best', 9).score])
  expect(r[0] === r[1] && r[2] === r[3], r.join(','))
})
await t('人の速さ: 新しい事が起きない時間が5秒を超えない', async () => {
  const r = await p.evaluate(() => {
    let worst = 0
    for (let sd = 1; sd <= 6; sd++) {
      const keep = dn.S; dn.start(); dn.dbg.pause(); dn.bot('human', sd)
      let last = 0, n0 = 0, l0 = ''
      for (let i = 0; i < 60 * 120 && dn.S.mode !== 'result'; i++) {
        dn.dbg.step(1)
        if (dn.S.mode !== 'play') { last = dn.S.pt; continue }
        const sig = dn.S.notes.length + '|' + dn.S.hands.map((h) => h.lid || 0).join(',')
        if (sig !== l0) { l0 = sig; last = dn.S.pt }
        worst = Math.max(worst, dn.S.pt - last)
      }
      dn.bot(null); void keep; void n0
    }
    return +worst.toFixed(1)
  })
  expect(r <= 5, r); return { worstGap: r }
})
await p.close()

// ---- 文字は同時に2つまで（心の声＋案内か帯） ----
p = await open(browser)
await t('遊び中の文字は同時に2つまで（人の速さで1晩）', async () => {
  await p.click('#bStart'); await p.evaluate(() => { dn.dbg.pause(); dn.bot('human', 3) })
  let worst = 0
  for (let i = 0; i < 300; i++) {
    await step(p, 30)
    const n = await p.evaluate(() => { const v = document.getElementById('voice'), h = document.getElementById('hint'), b = document.getElementById('banner'); return (v.classList.contains('on') ? 1 : 0) + (!h.hidden ? 1 : 0) + (dn.S.bannerPt != null && dn.S.pt - dn.S.bannerPt < 2.2 ? 1 : 0) })
    worst = Math.max(worst, n)
    if (await p.evaluate(() => dn.S.mode !== 'play')) { if (await p.evaluate(() => dn.S.mode === 'result')) break }
  }
  expect(worst <= 2, worst); return { worst }
})
await p.close()

// ---- チュートリアル（初めての1回だけ） ----
p = await open(browser, {}, '?seed=3')
await t('初めての1回: 最初の手で止まり「伸びた手をタップ」→ はたくと進む', async () => {
  await p.click('#bStart'); await p.evaluate(() => dn.dbg.pause())
  const ok = await until(p, () => dn.S.freeze, null, 600)
  const hint = await p.evaluate(() => !document.getElementById('hint').hidden && document.getElementById('hint').textContent)
  const pt0 = await p.evaluate(() => dn.S.pt); await step(p, 60); const pt1 = await p.evaluate(() => dn.S.pt)
  const xy = await p.evaluate(() => dn.handXY(0)); await p.mouse.click(xy.x, xy.y)
  const s = await st(p)
  expect(ok && hint === '伸びた手をタップ' && pt0 === pt1 && !s.freeze && s.stats.slaps === 1, JSON.stringify({ ok, hint, pt0, pt1, s: s.stats }))
})
await t('初めての1回: 消しゴムの案内と、最初の本物の案内が出る', async () => {
  const a = await until(p, () => dn.S.hint && dn.S.hint.key === 'hintFeint', null, 900)
  await p.evaluate(() => dn.bot('best', 1))
  const b = await until(p, () => dn.S.hint && dn.S.hint.key === 'hintReal', null, 3000)
  expect(a && b, a + ' ' + b)
})
await t('1晩終えたらチュートリアルは次から出ない', async () => {
  await p.evaluate(() => dn.dbg.finish())
  const v = await p.evaluate(() => localStorage.getItem('dn_tut'))
  expect(v === '1', v)
})
await p.close()

// ---- 英語 ----
p = await open(browser, {}, '?lang=en&tut=0')
await t('英語: タイトルと遊び方が英語（日本語の字が無い）', async () => {
  const r = await p.evaluate(() => [document.getElementById('t1').textContent + document.getElementById('t2').textContent, document.getElementById('howRules').textContent, document.getElementById('bStart').textContent])
  expect(/Don't Open/.test(r[0]) && !/[ぁ-んァ-ヶ一-龠]/.test(r.join('')), r.join('|'))
})
await t('英語: 通知も英語で出る・結果の答案も描ける', async () => {
  await p.click('#bStart'); await p.evaluate(() => { dn.dbg.pause(); dn.dbg.addNote('spam', 'gossip') })
  const tx = await p.evaluate(() => document.querySelector('.card .c-msg').textContent)
  await p.evaluate(() => dn.dbg.finish()); await p.waitForTimeout(300)
  const va = await variance(p, '#card')
  expect(/talking trash/.test(tx) && va > 500, tx + ' ' + va)
})
await t('English ⇄ 日本語の切り替え', async () => {
  await p.click('#bAgain'); await p.evaluate(() => dn.dbg.finish()); await p.waitForTimeout(200)
  await p.goto(URL0 + '?tut=0'); await p.waitForFunction(() => window.__dnReady)
  await p.click('#bLang'); const a = await p.evaluate(() => document.getElementById('bStart').textContent)
  await p.click('#bLang'); const b = await p.evaluate(() => document.getElementById('bStart').textContent)
  expect(a === 'Start' && b === 'はじめる', a + b)
})
await t('英語: エラーなし', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

// ---- 3サイズ × 全画面で一画面に収まる・はみ出さない・押す物が画面内 ----
for (const [w, h, name] of [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'max']]) {
  const q = await open(browser, { viewport: { width: w, height: h } })
  const views = {}
  views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await q.click('#bHow'); views.how = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` }); await q.click('#bHowClose')
  await q.click('#bStart'); await q.evaluate(() => { dn.dbg.pause(); dn.bot('best', 1) }); await step(q, 60 * 6)
  views.play = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  const inside = await q.evaluate(() => {
    const W = innerWidth, H = innerHeight, bad = []
    for (const i of [0, 1]) { const a = dn.handXY(i); if (!a || a.x < 0 || a.x > W || a.y < 0 || a.y > H) bad.push('palm' + i) }
    for (const id of ['phone', 'note']) { const r = document.getElementById(id).getBoundingClientRect(); if (r.left < -2 || r.right > W + 2 || r.top < 0) bad.push(id) }
    for (const b of document.querySelectorAll('.card')) { const r = b.getBoundingClientRect(); if (r.left < 0 || r.right > W || r.bottom > H) bad.push('card') }
    return bad
  })
  await q.evaluate(() => { dn.bot(null); dn.dbg.skipTo(470); dn.S.crawl = 1 }); await step(q, 2)
  const crawlOk = await q.evaluate(() => { const r = document.getElementById('phone').getBoundingClientRect(); return r.left >= -2 && r.bottom < innerHeight })
  await q.screenshot({ path: `${ROOT}/shots/fit-${name}-crawl.png` })
  await q.evaluate(() => dn.dbg.addNote('spam', 'confess')); await q.evaluate(() => dn.tapCard(dn.notes().slice(-1)[0].uid))
  views.melt = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-melt.png` })
  await q.evaluate(() => { for (let i = 0; i < 400 && dn.S.mode !== 'play' && dn.S.mode !== 'alarm'; i++) dn.dbg.step(5) })
  await q.evaluate(() => { dn.dbg.skipTo(480) }); await step(q, 30)
  views.alarm = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-alarm.png` })
  await q.evaluate(() => dn.phoneXY()).then((xy) => q.mouse.click(xy.x, xy.y)); await step(q, 60 * 4)
  views.reveal = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-reveal.png` })
  await q.mouse.click(w / 2, h / 2); await q.waitForTimeout(600)
  views.result = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`${name}: 手のひら・スマホ・ノート・通知が画面内`, async () => { expect(!inside.length && crawlOk, inside.join(',') + ' crawl ' + crawlOk) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !q.errs.length, JSON.stringify(o) + q.errs.join('|')) })
  await q.close()
}
await browser.close()

// ---- WebKit（iPhone 相当）でタッチの通し ----
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで始め、スマホへ伸びた手をタップではたける', async () => {
  const b = await wp.evaluate(() => { const r = document.getElementById('bStart').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  await wp.touchscreen.tap(b.x, b.y)
  await wp.evaluate(() => { dn.dbg.pause(); dn.S.nextNote = 1e9; dn.dbg.force(0, 'phone') })
  await until(wp, () => dn.S.hands[0].st === 'go')
  const xy = await wp.evaluate(() => dn.handXY(0)); await wp.touchscreen.tap(xy.x, xy.y)
  const s = await st(wp)
  expect(s.view === 'play' && s.stats.slaps === 1, JSON.stringify(s.stats))
})
await t('WebKit: 通知をタップで開ける', async () => {
  await until(wp, () => dn.S.hands[0].st === 'write')
  const uid = await wp.evaluate(() => dn.dbg.addNote('real', 'teach'))
  const xy = await wp.evaluate((u) => dn.cardXY(u), uid); await wp.touchscreen.tap(xy.x, xy.y)
  const s = await st(wp)
  expect(s.mode === 'real' && s.stats.realOk === 1, JSON.stringify(s))
})
await t('WebKit: 実際には無音（タップで音を鳴らす操作のあと）', async () => {
  const r = await wp.evaluate(() => ({ ok: window.__muteOk(), calls: window.__soundCalls }))
  expect(r.ok, JSON.stringify(r)); return r
})
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
await sv.close()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

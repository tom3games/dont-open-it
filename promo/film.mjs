import '../mute-auto.mjs'   // ブラウザでは音を出さない。音は記録して ffmpeg で後から重ねる
// X 投稿用の縦長プレイ動画（1080x1920・30fps・H.264＋AAC）。node promo/film.mjs
// 1) 人の速さの bot で書きながらはたく 2) 2時に左手も裏切る 3) 「ずっと好きでした」に手が伸びて時間が溶ける 4) 朝6時のアラーム→正体→答案＋題名
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { serve, open, Recorder, mix, encode, inspect, stills } from '../../_shared/promo-film.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const SLUG = 'dont-open-it', SEED = +(process.env.SEED || 77)
const TMP = process.env.FRAMES || join(tmpdir(), `${SLUG}-frames-${Date.now()}`)
const OUT_DIR = join(homedir(), 'Desktop/バカゲー動画'); mkdirSync(OUT_DIR, { recursive: true })
// はたいた所に指の印（撮影用。ゲームの画面には無い）
const srv = await serve(ROOT, { 'game.js': [['  function slap(i) {\n', '  function slap(i) {\n    if (window.__film && window.__film.tapMark) window.__film.tapMark(i)\n']] })
const { b, p, errs } = await open({ chromium, port: srv.port, path: '/?tut=0&seed=' + SEED, ready: '__dnReady' })
await p.evaluate(() => {
  const F = window.__film
  const st = document.createElement('style'); st.textContent = '.__tap{position:fixed;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(255,255,255,.55);border:3px solid rgba(20,20,20,.55);pointer-events:none;z-index:99999;animation:__tp .38s ease-out forwards}@keyframes __tp{from{transform:scale(.5);opacity:1}to{transform:scale(1.3);opacity:0}}'
  document.head.appendChild(st)
  F.tapAt = (x, y) => { const d = document.createElement('div'); d.className = '__tap'; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.appendChild(d); window.setTimeout(() => d.remove(), 420) }
  F.tapMark = (i) => { const xy = dn.handXY(i); if (xy) F.tapAt(xy.x, xy.y) }
  F.hookSnd(); F.on()
  dn.start(); dn.bot('human', 5)
})
const tick = (F, a) => {
  const S = dn.S
  if (a.mode === 'pt') return S.mode === 'play' && S.pt >= a.t
  if (a.mode === 'gm') return S.gm >= a.t
  if (a.mode === 'n') { F.k = (F.k || 0) + 1; if (F.k >= a.n) { F.k = 0; return true } return false }
  if (a.mode === 'melted') return S.mode === 'play' && S.stats.opens > a.n
  if (a.mode === 'alarm') return S.mode === 'alarm'
  return false
}
const rec = new Recorder(p, TMP)
const segs = []
const shoot = async (arg, max) => { const t0 = rec.sec; await rec.run(tick, { max, arg }); segs.push([arg.mode, t0, rec.sec]) }
// 1) 書きながらはたく（最初の1秒から遊んでいる画面）
await rec.run(tick, { ff: true, max: 30 * 20, arg: { mode: 'pt', t: 1.5 } })
await shoot({ mode: 'pt', t: 7.5 }, 30 * 8)
// 2) 2時: 左手も裏切る
await p.evaluate(() => dn.bot('best', 3))
await rec.run(tick, { ff: true, max: 30 * 200, arg: { mode: 'gm', t: 238 } })
await shoot({ mode: 'n', n: 30 * 4.5 }, 30 * 6)
// 3) 「ずっと好きでした」に手が伸びて、時間が溶ける
await p.evaluate(() => { dn.bot(null); dn.S.hands[1].next = 1e9; dn.S.nextNote = dn.S.pt + 9; dn.dbg.addNote('spam', 'confess'); dn.dbg.force(0, 'phone') })
const n0 = await p.evaluate(() => dn.S.stats.opens)
await shoot({ mode: 'melted', n: n0 }, 30 * 7)
// 4) 朝: アラーム → 正体 → 答案
await p.evaluate(() => dn.bot('best', 4))
await rec.run(tick, { ff: true, max: 30 * 300, arg: { mode: 'gm', t: 476 } })
await p.evaluate(() => dn.bot(null))
await shoot({ mode: 'alarm' }, 30 * 3)
await shoot({ mode: 'n', n: 30 * 1.0 }, 40)
await p.evaluate(() => { const xy = dn.phoneXY(); window.__film.tapAt(xy.x, xy.y); document.getElementById('phone').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: xy.x, clientY: xy.y })) })
await shoot({ mode: 'n', n: 30 * 4.2 }, 30 * 5)
await p.evaluate(() => { document.getElementById('overlay').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })) })
await shoot({ mode: 'n', n: 30 * 2.2 }, 30 * 3)
await p.evaluate(() => {
  const c = document.createElement('div'); c.innerHTML = 'その通知、<b style="display:block;color:#ff5a4f;font-size:78px;font-weight:400">開くな</b>'
  c.style.cssText = 'position:fixed;left:0;right:0;top:34%;z-index:99998;text-align:center;font:400 40px Yomogi,sans-serif;color:#fff;text-shadow:0 0 4px #12142e,0 0 4px #12142e,0 4px 0 #12142e;transform:rotate(-3deg);pointer-events:none;background:rgba(18,20,46,.55);padding:14px 0'
  document.body.appendChild(c)
})
await shoot({ mode: 'n', n: 45 }, 50)
const log = await p.evaluate(() => ({ rec: window.__film.rec, gains: window.__film.gains, res: dn.S.res && { score: dn.S.res.score, title: dn.S.res.title } }))
await b.close(); srv.close()
const dur = rec.sec
const wav = join(TMP, 'mix.wav'), out = join(OUT_DIR, `${SLUG}-x-1080x1920.mp4`)
mix({ rec: log.rec, gains: log.gains, dur, root: ROOT, out: wav })
encode({ frames: TMP, wav, out })
const info = inspect(out)
const st = stills(out, [0.5, ...segs.map((s) => (s[1] + s[2]) / 2), dur - 0.6], join(TMP, 'still'))
writeFileSync(join(ROOT, 'promo/film-log.json'), JSON.stringify({ seed: SEED, segs, info, res: log.res, errs }, null, 1))
console.log(JSON.stringify({ out, info, segs, errs, res: log.res, stills: st }, null, 1))

import './mute-auto.mjs'
// SNS 用の画像 og.png（1200x630）と img/icon.png を作る。node og.mjs
// 遊んでいる一番おもしろい瞬間: 「あなたの悪口が書かれています」に右手が飛びつく直前、左手はもう絆創膏
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { serve } from './tools/serve.mjs'
const sv = await serve(0)
const b = await chromium.launch()
const p = await (await b.newContext({ locale: 'ja-JP', viewport: { width: 430, height: 860 }, deviceScaleFactor: 2 })).newPage()
await p.goto(sv.url + '?tut=0&seed=11'); await p.waitForFunction(() => window.__dnReady)
await p.click('#bStart')
await p.evaluate(() => {
  dn.dbg.pause(); dn.bot('best', 2); dn.dbg.skipTo(258); dn.bot(null)
  dn.S.nextNote = 1e9; dn.S.hands[1].next = 1e9; dn.S.hands[1].slaps = 7; dn.S.crawl = 0.35
  for (const id of ['cart', 'oshi', 'gossip']) { dn.dbg.addNote('spam', id); dn.S.pt += 0.01 }
  dn.S.voice = null
})
await p.evaluate(() => { for (let i = 0; i < 300 && dn.S.hands[0].st !== 'write'; i++) dn.dbg.step(1); dn.dbg.force(0, 'phone') })
await p.evaluate(() => { for (let i = 0; i < 400 && !(dn.S.hands[0].st === 'go' && (dn.S.pt - dn.S.hands[0].t0) / dn.S.hands[0].dur > 0.55); i++) dn.dbg.step(1); dn.S.voice = { s: 'え、気になる', t0: dn.S.t, dur: 99 }; document.getElementById('voice').textContent = 'え、気になる'; document.getElementById('voice').classList.add('on'); document.getElementById('banner').style.display = 'none' })
await p.waitForTimeout(400)
const shot = await p.screenshot({ clip: { x: 0, y: 0, width: 430, height: 860 } })
const icon = await p.screenshot({ clip: { x: 215, y: 150, width: 200, height: 200 } })
writeFileSync('img/icon_src.png', icon)
const q = await (await b.newContext({ viewport: { width: 1200, height: 630 } })).newPage()
await q.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Yomogi&display=swap" rel="stylesheet"><style>
body{margin:0;width:1200px;height:630px;background:#1d2340;overflow:hidden;font-family:Yomogi,sans-serif;position:relative}
.sc{position:absolute;left:40px;top:-150px;width:470px;transform:rotate(-3deg);box-shadow:0 20px 40px rgba(0,0,0,.6);border:8px solid #fff}
.sc img{display:block;width:100%}
.t{position:absolute;left:560px;top:90px;color:#fff;text-shadow:0 4px 0 #0e1030}
.t span{display:block;font-size:64px}
.t b{display:block;font-weight:400;font-size:150px;color:#ff5a4f;line-height:1;letter-spacing:.04em}
.t p{font-size:34px;margin:22px 0 0;line-height:1.4;color:#ffe9b0}
.n{position:absolute;right:40px;bottom:30px;color:#9aa3d0;font-size:24px}
</style></head><body><div class="sc"><img src="data:image/png;base64,${shot.toString('base64')}"></div>
<div class="t"><span>その通知、</span><b>開くな</b><p>テスト前夜、通知が鳴りやまない。<br>勝手に伸びる自分の手をはたけ。</p></div><div class="n">tom3games.com</div></body></html>`)
await q.waitForTimeout(1200); await q.evaluate(() => document.fonts.ready)
await q.screenshot({ path: 'og.png' })
await b.close(); await sv.close()
console.log('og.png ok')

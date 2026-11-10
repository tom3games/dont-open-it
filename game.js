// その通知、開くな: 処理。固定60Hz（performance.now で数える）。遊びの時間は全部 tick の中で進める（タイマーを使わない＝sim と dbg.step で再現できる）
(function () {
  'use strict'
  window.__jsUp = true
  const SND = typeof Snd !== 'undefined' ? Snd : null   // sfx.js の const Snd は window に載らない
  const D = window.DN_DATA, $ = (id) => document.getElementById(id)
  const Q = new URLSearchParams(location.search)
  let LANG = 'ja'
  try { LANG = (Q.get('lang') || localStorage.getItem('dn_lang') || ((navigator.language || 'ja').indexOf('ja') === 0 ? 'ja' : 'en')) === 'en' ? 'en' : 'ja' } catch (e) { }
  const T = (k) => D.T[LANG][k]
  const pickTx = (o) => o[LANG] || o.ja

  // ---------- 定数 ----------
  const DT = 1 / 60
  const NIGHT = 480                 // 22:00〜6:00 の分
  const RATE = NIGHT / 140          // 1秒で何分すすむか（溶けなければ約2分20秒）
  const FULL = 100                  // この行数で100点
  const PER_PAGE = 11               // 1ページの行数
  const REAL_WIN = 9                // 本物と偽物の至急が上に止まる秒数
  const MELT_MIN = { 1: 20, 2: 30, 3: 40 }

  // ---------- 乱数 ----------
  function rngOf(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
  let R = rngOf(1)
  const rr = (a, b) => a + (b - a) * R()
  const pick = (a) => a[Math.floor(R() * a.length)]
  const lerp = (a, b, k) => a + (b - a) * k
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const ease = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2

  // ---------- 音 ----------
  const SN = (n, k) => Array.from({ length: k }, (_, i) => 'snd/' + n + (i + 1) + '.mp3')
  if (SND) SND.def({
    notif: SN('notif', 4), buzz: SN('buzz', 3), slap: SN('slap', 3), ouch: SN('ouch', 3), paper: SN('paper', 2), cloth: SN('cloth', 2),
    spill: 'snd/spill.mp3', zoom: 'snd/zoom.mp3', unzoom: 'snd/unzoom.mp3', click: 'snd/click.mp3', alarm: 'snd/alarm.mp3', rooster: 'snd/rooster.mp3',
    meow: 'snd/meow.mp3', doorbell: 'snd/doorbell.mp3', j_good: 'snd/j_good.mp3', j_mid: 'snd/j_mid.mp3', j_bad: 'snd/j_bad.mp3', j_real: 'snd/j_real.mp3',
  })
  const snd = (n, o) => { if (SND && !SIM) Snd.play(n, o) }
  const loop = (slot, url, v, f) => { if (SND && !SIM) Snd.loop(slot, url, v, f) }
  let audioOn = false
  function audioInit() { if (!SND || audioOn) return; audioOn = true; Snd.init() }

  // ---------- 画像 ----------
  const POSE = {}
  for (const p of ['write', 'reach', 'slap', 'sneak', 'rest', 'grab']) { const im = new Image(); im.src = 'img/hw_' + p + '.webp'; POSE[p] = im }

  // ---------- 配置 ----------
  const L = {}
  const el = { phone: $('phone'), note: $('note'), ink: $('ink'), mug: $('iMug'), marker: $('iMarker'), eraser: $('iEraser'), books: $('iBooks'), cat: $('iCat'), bg: $('bg') }
  function place(e, r, rot) { e.style.width = r.w + 'px'; e.style.height = r.h + 'px'; e.style.transform = 'translate(' + r.x + 'px,' + r.y + 'px)' + (rot ? ' rotate(' + rot + 'deg)' : '') }
  function layout() {
    const W = innerWidth, H = document.documentElement.clientHeight || innerHeight
    L.W = W; L.H = H
    // 机の奥の端が画面の 16% あたりに来るよう背景を大きく敷く（窓と月は上に少しだけ）
    const bh = Math.max(H * 1.5, W / 0.75), bw = bh * 0.75
    L.bg = { x: (W - bw) * 0.32, y: H * 0.16 - bh * 0.44, w: bw, h: bh }
    place(el.bg, L.bg)
    const pw = Math.min(W * 0.52, H * 0.26, 250), ph = pw * 1.6
    L.phone = { x: W * 0.975 - pw, y: H * 0.165, w: pw, h: ph }
    const nw = Math.min(W * 0.8, H * 0.46), nh = nw * 402 / 483
    L.note = { x: W * 0.45 - nw / 2, y: H * 0.605, w: nw, h: nh, rot: -2.5 }
    const s = Math.min(W / 390, H / 760)
    const sz = (n, k) => ({ w: n * k * s, h: 0 })
    L.mug = { w: 78 * s, h: 78 * s * 260 / 203, cx: W * 0.15, cy: H * 0.40 }
    L.marker = { w: 56 * s, h: 56 * s * 240 / 186, cx: W * 0.17, cy: H * 0.55 }
    L.eraser = { w: 46 * s, h: 46 * s * 200 / 197, cx: W * 0.40, cy: H * 0.53 }
    L.books = { w: 108 * s, h: 108 * s * 260 / 272, cx: W * 0.16, cy: H * 0.215 }
    L.cat = { w: pw * 1.15, h: pw * 1.15 * 300 / 328 }
    for (const k of ['mug', 'marker', 'eraser', 'books']) { const r = L[k]; r.x = r.cx - r.w / 2; r.y = r.cy - r.h / 2; void sz }
    place(el.books, L.books, -4)
    L.aw = Math.min(W * 0.34, H * 0.17); L.ah = L.aw * 560 / 255
    L.sR = { x: W * 0.80, y: H + L.ah * 0.85 }
    L.sL = { x: W * 0.10, y: H + L.ah * 0.85 }
    L.restL = { x: W * 0.17, y: H * 0.80 }
    for (const a of ARMS) { a.el.style.width = L.aw + 'px'; a.el.style.height = L.ah + 'px' }
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    el.ink.width = Math.round(L.note.w * dpr); el.ink.height = Math.round(L.note.h * dpr); L.dpr = dpr
    place(el.note, L.note, L.note.rot)
    layoutTitle()
    inkDirty = true
    if (W && S) render(true)
  }
  // ノートの上の点（u,v は画像の割合）から画面へ
  function notePt(u, v) {
    const n = L.note, cx = n.x + n.w / 2, cy = n.y + n.h / 2, a = n.rot * Math.PI / 180
    const x = (u - 0.5) * n.w, y = (v - 0.5) * n.h
    return { x: cx + x * Math.cos(a) - y * Math.sin(a), y: cy + x * Math.sin(a) + y * Math.cos(a) }
  }
  const LINE = (i) => { const pg = Math.floor(i / PER_PAGE) % 2, row = i % PER_PAGE; return { u0: pg ? 0.555 : 0.075, u1: pg ? 0.93 : 0.45, v: 0.135 + row * (0.74 / (PER_PAGE - 1)) } }

  // ---------- 状態 ----------
  let S = null, SIM = false, MODE = 'boot'
  const ARMS = [
    { side: 'R', el: $('armR'), img: null },
    { side: 'L', el: $('armL'), img: null },
  ]
  for (const a of ARMS) a.img = a.el.querySelector('img')

  function newHand(side) {
    return { side, on: side === 'R', st: side === 'R' ? 'write' : 'rest', t0: 0, dur: 0, pose: side === 'R' ? 'write' : 'rest', tgt: null, from: null, to: null, p: null, next: 2, slaps: 0, hold: null, sw: false, swAt: 0, force: null }
  }
  function newGame(seed, opt) {
    opt = opt || {}
    R = rngOf(seed)
    const tut = !!opt.tut
    S = {
      seed, tut, t: 0, pt: 0, gm: 0, mode: 'play', study: 0, pause: 0, boost: 0, stains: [],
      hands: [newHand('R'), newHand('L')], notes: [], uid: 0, nextNote: tut ? 3.2 : 2.4, crawl: 0, shakeT: -9,
      bag: { 1: [], 2: [], 3: [] }, rare: 0, ov: null, voice: null, hint: null, banner: null,
      stats: { slaps: 0, bad: 0, opens: 0, meltMin: 0, realOk: 0, realN: 0, fakeOpen: 0, spills: 0, items: 0, byHand: 0 },
      events: [], leftOn: false, cat: null, alarmT: 0, done: false, tutStep: 0, freeze: false, writeOn: false, writeT: 0, bellN: 0,
    }
    // 本物の至急は2つ（3つから）、偽物は2〜3。gm で出す
    const reals = [...D.REAL].sort(() => R() - 0.5).slice(0, 2)
    const ra = tut ? 55 : rr(60, 150), rb = rr(250, 380)
    S.events.push({ gm: ra, kind: 'real', def: reals[0] }, { gm: rb, kind: 'real', def: reals[1] })
    const fakes = [...D.FAKE].sort(() => R() - 0.5).slice(0, R() < 0.5 ? 2 : 3)
    const fg = [rr(140, 220), rr(300, 360), rr(400, 450)]
    fakes.forEach((f, i) => S.events.push({ gm: fg[i], kind: 'fake', def: f }))
    if (R() < 0.45) S.events.push({ gm: rr(300, 370), kind: 'cat' })
    S.events.push({ gm: 240, kind: 'left' })
    S.events.sort((a, b) => a.gm - b.gm)
    S.stats.realN = 2
    S.hands[0].next = tut ? 1.6 : rr(1.6, 2.6)
    S.hands[1].next = 99
    inkDirty = true
    return S
  }

  // ---------- 通知 ----------
  function drawSpam() {
    const p = S.gm / NIGHT
    if (R() < 0.08 && S.rare < 2) { S.rare++; const r = pick(D.RARE); if (!S.notes.some((n) => n.def.id === r.id)) return { kind: 'rare', def: r } }
    const w3 = lerp(0.1, 0.5, p), w1 = lerp(0.6, 0.15, p), x = R()
    const t = x < w1 ? 1 : x < w1 + w3 ? 3 : 2
    let b = S.bag[t]
    if (!b.length) { b = S.bag[t] = D.SPAM.filter((s) => s.t === t).sort(() => R() - 0.5) }
    return { kind: 'spam', def: b.pop() }
  }
  function addNote(kind, def) {
    const app = D.APPS[def.app]
    const n = { uid: ++S.uid, kind, def, app: def.app, t: def.t || 3, at: S.pt, gm: S.gm, opened: false, missed: false, pin: 0 }
    if (kind === 'real' || kind === 'fake') n.pin = S.pt + (S.tut && kind === 'real' && S.stats.realOk === 0 && !S.tutReal ? 15 : REAL_WIN)
    S.notes.push(n)
    snd('notif', { vol: S.cat ? 0.35 : 0.8, dest: S.cat ? 'muf' : undefined })
    snd('buzz', { vol: S.cat ? 0.25 : 0.6 })
    S.shakeT = S.t
    if (S.gm > 120 && !S.cat) S.crawl = Math.min(1, S.crawl + 0.06)
    // 誘惑が強い通知は、右手がすぐ伸びる
    const h = S.hands[0]
    if (kind !== 'real' && (n.t === 3 || (n.t === 2 && R() < 0.4)) && h.st === 'write' && S.pt > 1) { h.next = Math.min(h.next, S.pt + 0.3); h.force = 'phone' }
    if (n.t === 3 && kind === 'spam' && R() < 0.5) say('tempt3')
    if (kind === 'real') {
      if (def.bell) S.bellN = 0
      if (S.tut && !S.tutReal) { S.tutReal = true; showHint('hintReal', 'card', n.uid) }
    }
    void app
    cardsDirty = true
    return n
  }
  function unread() { return S.notes.filter((n) => !n.opened) }
  function stack() {
    const u = unread()
    const pinned = u.filter((n) => n.pin > S.pt && !n.missed).sort((a, b) => b.at - a.at)
    const rest = u.filter((n) => !(n.pin > S.pt && !n.missed)).sort((a, b) => b.at - a.at)
    return pinned.concat(rest)
  }
  const msgOf = (n) => pickTx(n.def)[0]
  const truthOf = (n) => pickTx(n.def)[1]
  const fromOf = (n) => n.def.from ? pickTx(n.def.from) : ''

  // ---------- 手 ----------
  function phonePt() { const p = phoneRect(); return { x: p.x + p.w * 0.5, y: p.y + p.h * 0.62 } }
  function phoneRect() {
    const c = S ? S.crawl : 0
    return { x: L.phone.x - c * L.W * 0.14, y: L.phone.y + c * L.H * 0.07, w: L.phone.w, h: L.phone.h, rot: -6 * c }
  }
  function itemPt(k) { const r = L[k]; return { x: r.cx, y: r.cy } }
  function writePt() {
    const i = Math.floor(S.study), f = S.study - i, ln = LINE(i % (PER_PAGE * 2))
    return notePt(lerp(ln.u0, ln.u1, f), ln.v + 0.02)
  }
  function restPt(h) { return h.side === 'R' ? writePt() : L.restL }
  function tgtPt(h, tgt) { if (tgt === 'phone' || tgt === 'cat') return phonePt(); if (tgt === 'rest') return restPt(h); return itemPt(tgt) }

  function busyItem(k) { return S.hands.some((h) => h.tgt === k && h.st !== 'rest' && h.st !== 'write') }
  function startLunge(h, force) {
    const p = S.gm / NIGHT
    let tgt = force
    if (!tgt) {
      const pp = h.side === 'R' ? 0.5 + 0.15 * p + 0.02 * Math.min(unread().length, 10) : 0.62
      if (R() < pp) tgt = 'phone'
      else {
        const opts = (h.side === 'R' ? ['eraser', 'marker', 'mug'] : ['mug', 'marker']).filter((k) => !busyItem(k))
        tgt = opts.length ? pick(opts) : 'phone'
      }
    }
    if (tgt === 'phone' && S.cat && S.cat.on) tgt = 'cat'
    // 序盤は両手そろって伸びない（3時から解禁）
    const other = S.hands[h.side === 'R' ? 1 : 0]
    if (tgt === 'phone' && S.gm < 180 + 0 && other.on && (other.st === 'wind' || other.st === 'go') && other.tgt === 'phone') { h.next = S.pt + 1.2; return }
    h.tgt = tgt; h.st = 'wind'; h.t0 = S.pt; h.lid = (h.lid || 0) + 1
    h.dur = (S.tut && S.tutStep < 1 ? 1.0 : lerp(0.8, 0.6, p))
    h.pose = tgt === 'phone' ? 'sneak' : 'rest'
    h.from = h.p ? { ...h.p } : restPt(h)
    h.sw = tgt !== 'phone' && tgt !== 'cat' && S.gm >= 300 && R() < 0.3
    h.force = null
    if (tgt === 'phone') snd('cloth', { vol: 0.5 })
  }
  function goDur(h, a, b) {
    const d = Math.hypot(b.x - a.x, b.y - a.y), p = S.gm / NIGHT
    let k = clamp(d / (L.H * 0.95 * lerp(1, 1.35, p)), 0.8, 1.7)
    if (S.tut && S.tutStep < 1) k = Math.max(k, 1.5)
    return k
  }
  function handTick(h) {
    const now = S.pt, k = h.dur ? clamp((now - h.t0) / h.dur, 0, 1) : 1
    switch (h.st) {
      case 'write': case 'rest': {
        h.p = restPt(h)
        if (h.on && now >= h.next && S.mode === 'play') startLunge(h, h.force)
        break
      }
      case 'wind': {
        const to = tgtPt(h, h.tgt)
        h.p = { x: lerp(h.from.x, to.x, 0.08 * ease(k)), y: lerp(h.from.y, to.y, 0.08 * ease(k)) - L.H * 0.012 * Math.sin(k * Math.PI) }
        if (k >= 1) { h.st = 'go'; h.t0 = now; h.from = { ...h.p }; h.dur = goDur(h, h.p, to); h.pose = (h.tgt === 'phone') ? 'reach' : 'rest'; h.swAt = h.sw ? rr(0.4, 0.6) : 2 }
        break
      }
      case 'go': {
        const to = tgtPt(h, h.tgt)
        h.p = { x: lerp(h.from.x, to.x, ease(k)), y: lerp(h.from.y, to.y, ease(k)) }
        if (k >= h.swAt) { h.st = 'turn'; h.t0 = now; h.dur = 0.4; h.pose = 'sneak'; h.sw = false; h.swAt = 2; break }
        if (k >= 1) arrive(h)
        break
      }
      case 'turn': {
        if (k >= 1) { h.tgt = 'phone'; h.st = 'go'; h.t0 = now; h.from = { ...h.p }; h.dur = Math.max(0.8, goDur(h, h.p, phonePt()) * 0.9); h.pose = 'reach'; snd('cloth', { vol: 0.5 }) }
        break
      }
      case 'grab': {   // 物をつかむ（0.25秒）してから持って戻る
        h.p = tgtPt(h, h.tgt)
        if (k >= 1) { h.st = 'bring'; h.t0 = now; h.from = { ...h.p }; h.dur = 0.45 }
        break
      }
      case 'bring': {
        const to = restPt(h)
        h.p = { x: lerp(h.from.x, to.x, ease(k)), y: lerp(h.from.y, to.y, ease(k)) }
        if (k >= 1) { h.st = 'apply'; h.t0 = now; h.dur = 0.6 }
        break
      }
      case 'apply': {
        const to = restPt(h)
        h.p = { x: to.x + Math.sin(now * 40) * L.W * 0.012, y: to.y + Math.cos(now * 33) * L.H * 0.004 }
        if (k >= 1) { useItem(h); h.hold = null; h.st = h.side === 'R' ? 'write' : 'rest'; h.pose = h.side === 'R' ? 'write' : 'rest'; h.tgt = null; h.next = now + nextGap(h) }
        break
      }
      case 'pet': {   // 猫をなでる
        const to = phonePt()
        h.p = { x: to.x + Math.sin(now * 9) * L.W * 0.03, y: to.y - L.H * 0.03 }
        if (k >= 1) back(h)
        break
      }
      case 'hurt': {
        const to = restPt(h)
        h.p = { x: lerp(h.from.x, to.x, ease(k)), y: lerp(h.from.y, to.y + L.H * 0.04, ease(k)) }
        if (k >= 1) back(h)
        break
      }
      case 'back': {
        const to = restPt(h)
        h.p = { x: lerp(h.from.x, to.x, ease(k)), y: lerp(h.from.y, to.y, ease(k)) }
        if (k >= 1) { h.st = h.side === 'R' ? 'write' : 'rest'; h.pose = h.side === 'R' ? 'write' : 'rest'; h.tgt = null }
        break
      }
      case 'eager': {   // 朝のアラーム。両手でスマホに飛びつく（遊びの時計は止まっているので S.t で数える）
        const to = phonePt(), ke = clamp((S.t - S.alarmT) / 0.7, 0, 1)
        h.p = { x: lerp(h.from.x, to.x + (h.side === 'R' ? 1 : -1) * L.W * 0.07, ease(ke)) + Math.sin(S.t * 30) * 2, y: lerp(h.from.y, to.y + L.H * 0.1, ease(ke)) }
        break
      }
    }
  }
  function nextGap(h) { const p = S.gm / NIGHT; return h.side === 'R' ? rr(2.2, 4.2) * lerp(1, 0.7, p) : rr(3.4, 6) * lerp(1, 0.75, p) }
  function back(h) { h.st = 'back'; h.t0 = S.pt; h.dur = 0.35; h.from = { ...h.p }; h.pose = h.side === 'R' ? 'write' : 'rest'; if (h.next < S.pt + 0.8) h.next = S.pt + nextGap(h) }
  function arrive(h) {
    if (h.tgt === 'phone') {
      h.pose = 'grab'
      const u = stack().filter((n) => n.kind !== 'real')
      const n = u.sort((a, b) => b.t - a.t || b.at - a.at)[0] || stack()[0]
      S.stats.byHand++
      if (n) { openNote(n, 'hand'); return }
      back(h); return
    }
    if (h.tgt === 'cat') { h.st = 'pet'; h.t0 = S.pt; h.dur = 1.0; h.pose = 'rest'; return }
    h.st = 'grab'; h.t0 = S.pt; h.dur = 0.25; h.pose = 'grab'; h.hold = h.tgt
  }
  function useItem(h) {
    const k = h.hold
    S.stats.items++
    if (k === 'eraser') { S.study += 1.5; if (R() < 0.4) say('eraser') }
    if (k === 'marker') { S.study += 2.5; if (R() < 0.4) say('hl') }
    if (k === 'mug') { S.boost = S.pt + 8; say('coffee') }
    snd('paper', { vol: 0.5 })
  }
  // はたく
  function slap(i) {
    if (!S || S.mode !== 'play' || S.freeze && S.tutStep !== 0) return false
    const h = S.hands[i]
    if (!h.on) return false
    const lunging = (h.st === 'wind' || h.st === 'go') && h.tgt === 'phone' || h.st === 'turn'
    h.slaps++
    if (lunging) {
      S.stats.slaps++
      snd('slap', { vol: 0.9 })
      say('slap', true)
      if (S.freeze) { S.freeze = false; S.tutStep = 1; hideHint() }
      h.next = S.pt + rr(1.3, 2.5)
    } else {
      S.stats.bad++
      snd('ouch', { vol: 0.8 }); snd('slap', { vol: 0.4 })
      say('hurt', true)
      S.pause = Math.max(S.pause, S.pt + 1.0)
      if (h.hold === 'mug' && (h.st === 'bring' || h.st === 'apply' || h.st === 'grab')) {
        S.stats.spills++; S.study = Math.max(0, S.study - 4); snd('spill', { vol: 0.8 })
        S.stains.push({ u: rr(0.2, 0.8), v: rr(0.3, 0.7), r: rr(0.08, 0.13), sp: Math.floor(S.study / (PER_PAGE * 2)) }); inkDirty = true
      }
      h.hold = null
      if (h.next < S.pt + 1.5) h.next = S.pt + rr(1.5, 2.5)
    }
    h.st = 'hurt'; h.t0 = S.pt; h.dur = 0.55; h.from = { ...(h.p || restPt(h)) }; h.pose = 'slap'; h.tgt = null; h.sw = false
    return lunging
  }

  // ---------- 開く ----------
  function openNote(n, by) {
    if (!S || S.mode !== 'play' || n.opened) return
    n.opened = true; cardsDirty = true
    if (n.kind === 'real') {
      if (!n.missed) { S.stats.realOk++; n.ok = true }
      S.ov = { kind: 'real', n, t0: S.t, dur: 2.4, late: n.missed }
      S.mode = 'real'; S.gm += 6
      snd(n.missed ? 'j_bad' : 'j_real', { vol: 0.7 }); snd('click', { vol: 0.6 })
      if (S.tut) hideHint()
    } else {
      const m = n.kind === 'fake' ? 35 : n.kind === 'rare' ? 25 : MELT_MIN[n.t]
      S.stats.opens++; S.stats.meltMin += m; if (n.kind === 'fake') S.stats.fakeOpen++
      S.ov = { kind: 'melt', n, t0: S.t, dur: 2.9, from: S.gm, to: Math.min(NIGHT, S.gm + m), by }
      S.mode = 'melt'
      snd('zoom', { vol: 0.8 })
    }
    n.by = by
    for (const h of S.hands) { if (h.st !== 'rest' && h.st !== 'write') { h.st = h.side === 'R' ? 'write' : 'rest'; h.pose = h.st; h.hold = null; h.tgt = null } h.next = S.pt + 1.6 + (h.side === 'L' ? 1.2 : 0) }
    S.writeOn = false; loop('write', null, 0, 0.15)
    ovDirty = true
  }
  function ovTick() {
    const o = S.ov, k = (S.t - o.t0) / o.dur
    if (o.kind === 'melt') {
      S.gm = lerp(o.from, o.to, clamp((k - 0.35) / 0.5, 0, 1))
      if (k >= 1) { S.gm = o.to; endOv(); say(o.n.kind === 'fake' ? 'fakeOpen' : 'melt', true) }
    } else if (o.kind === 'real') {
      if (k >= 1) { endOv(); if (!o.late) say('real', true) }
    } else if (o.kind === 'reveal') {
      const step = Math.floor((S.t - o.t0 - 0.6) / 0.42)
      if (step >= 0 && step < o.list.length && !o.list[step].on) { o.list[step].on = true; snd('paper', { vol: 0.4 }); ovDirty = true }
      if (S.t - o.t0 > o.list.length * 0.42 + 4.5) finish()
    }
  }
  function endOv() {
    S.ov = null; S.mode = 'play'; S.crawl = 0; ovDirty = true
    snd('unzoom', { vol: 0.6 })
    if (S.gm >= NIGHT) startAlarm()
  }

  // ---------- 朝 ----------
  function startAlarm() {
    S.mode = 'alarm'; S.alarmT = S.t; S.gm = NIGHT
    loop('write', null, 0, 0.1); loop('alarm', 'snd/alarm.mp3', 0.75, 0.05)
    snd('rooster', { vol: 0.5, delay: 1.2 })
    for (const h of S.hands) { h.on = true; h.st = 'eager'; h.t0 = S.pt; h.dur = 0.5; h.from = { ...(h.p || restPt(h)) }; h.pose = 'reach' }
    hideHint(); showHint('alarmTap', 'phone'); S.voice = null; voiceDirty = true
    cardsDirty = true
  }
  function stopAlarm() {
    if (S.mode !== 'alarm') return
    loop('alarm', null, 0, 0.05); snd('click', { vol: 0.8 })
    hideHint()
    for (const h of S.hands) { h.st = 'eager'; h.pose = 'grab' }
    // 未読の正体を明かす
    const pool = S.notes.filter((n) => n.kind !== 'real')
    const score = (n) => (n.opened ? 0 : 10) + n.t * 3 + (n.kind === 'rare' ? 6 : 0) + (n.kind === 'fake' ? 5 : 0)
    const list = pool.slice().sort((a, b) => score(b) - score(a)).slice(0, 6).sort((a, b) => a.at - b.at).map((n) => ({ n, on: false }))
    S.ov = { kind: 'reveal', t0: S.t, list, total: pool.length }
    S.mode = 'reveal'; ovDirty = true
    snd('zoom', { vol: 0.6 })
  }

  // ---------- 1コマ ----------
  function tick() {
    S.t += DT
    if (S.mode === 'alarm') { for (const h of S.hands) handTick(h); if (S.t - S.alarmT > 6) stopAlarm(); return }
    if (S.mode === 'melt' || S.mode === 'real' || S.mode === 'reveal') { ovTick(); return }
    if (S.mode !== 'play') return
    if (S.freeze) return
    S.pt += DT; S.gm += RATE * DT
    // 書く
    const R0 = S.hands[0], writing = R0.st === 'write' && S.pt >= S.pause
    if (writing) S.study += DT * (S.pt < S.boost ? 1.4 : 1)
    if (writing !== S.writeOn && S.pt - S.writeT > 0.2) { S.writeOn = writing; S.writeT = S.pt; loop('write', writing ? 'snd/write_loop.mp3' : null, 0.35, 0.12) }
    const sp = Math.floor(S.study / (PER_PAGE * 2))
    if (sp !== S.spread) { if (S.spread != null) snd('paper', { vol: 0.6 }); S.spread = sp; inkDirty = true }
    // 予定
    while (S.events.length && S.gm >= S.events[0].gm) {
      const e = S.events.shift()
      if (e.kind === 'real' || e.kind === 'fake') { if (S.cat && S.cat.on && e.kind === 'real') { e.gm = S.gm + 8; S.events.push(e); S.events.sort((a, b) => a.gm - b.gm); continue } addNote(e.kind, e.def) }
      if (e.kind === 'left') { const h = S.hands[1]; h.on = true; h.next = S.pt + 2.5; banner('leftOn'); say('left', true) }
      if (e.kind === 'cat') { S.cat = { on: true, t0: S.pt, dur: 16 }; snd('meow', { vol: 0.7 }); loop('purr', 'snd/purr.mp3', 0.3, 0.8); say('cat', true); catDirty = true }
    }
    if (S.cat && S.cat.on && S.pt - S.cat.t0 > S.cat.dur) { S.cat.on = false; snd('meow', { vol: 0.5 }); loop('purr', null, 0, 0.5); catDirty = true }
    if (S.gm >= 420 && !S.birds) { S.birds = true; loop('amb2', 'snd/amb_birds.mp3', 0.18, 3) }
    // 通知
    if (S.pt >= S.nextNote) {
      const d = drawSpam(); addNote(d.kind, d.def)
      S.nextNote = S.pt + lerp(4.0, 2.3, S.gm / NIGHT) * rr(0.8, 1.2)
    }
    // 至急の締め切り
    for (const n of S.notes) {
      if (n.kind === 'real' && !n.opened && !n.missed) {
        if (n.def.bell && (S.pt - n.at > 3 && S.bellN === 0 || S.pt - n.at > 6.5 && S.bellN === 1)) { S.bellN++; snd('doorbell', { vol: 0.55, dest: 'muf' }); if (S.bellN === 1) say('bell') }
        if (S.pt > n.pin) { n.missed = true; cardsDirty = true }
      }
      if (n.pin && S.pt > n.pin && !n.unpinned) { n.unpinned = true; cardsDirty = true }
    }
    // チュートリアル
    if (S.tut) tutTick()
    for (const h of S.hands) if (h.on || h.st !== 'rest') handTick(h)
    if (S.gm >= NIGHT && S.mode === 'play') startAlarm()
    if (BOT) BOT(S)
  }
  function tutTick() {
    const h = S.hands[0]
    if (S.tutStep === 0) {
      if (h.st === 'write' && S.pt > 1.6 && S.pt < 3) { h.next = S.pt; h.force = 'phone' }
      if (h.st === 'go' && h.tgt === 'phone' && (S.pt - h.t0) / h.dur > 0.3 && !S.freeze) { S.freeze = true; showHint('hintSlap', 'hand', 0) }
    } else if (S.tutStep === 1) {
      if (h.st === 'write' && S.pt > 6) { h.next = S.pt; h.force = 'eraser'; S.tutStep = 2 }
    } else if (S.tutStep === 2) {
      if (h.st === 'wind' && h.tgt === 'eraser' && !S.hint) showHint('hintFeint', 'hand', 0)
      if (h.st === 'grab' || h.st === 'hurt') { S.tutStep = 3; hideHint() }
    }
  }

  // ---------- 声と案内（同時に出す文字は2つまで: 心の声＋案内） ----------
  function say(key, force) {
    if (SIM || !S) return
    if (!force && S.voice && S.t - S.voice.t0 < S.voice.dur) return
    const arr = T('voice')[key]; if (!arr) return
    const s = pick(arr)
    S.voice = { s, t0: S.t, dur: 0.9 + 0.09 * s.length + 0.4 }
    voiceDirty = true
  }
  function showHint(key, at, ref) { if (SIM) return; S.hint = { key, at, ref }; hintDirty = true }
  function hideHint() { if (S && S.hint) { S.hint = null; hintDirty = true } }
  function banner(key) { if (SIM) return; S.bannerPt = S.pt; const b = $('banner'); b.textContent = T(key); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on') }

  // ---------- 描画 ----------
  let cardsDirty = true, ovDirty = true, voiceDirty = true, hintDirty = true, inkDirty = true, catDirty = true
  const fmt = (gm) => { const m = Math.floor(22 * 60 + gm) % (24 * 60); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') }
  const shownCards = new Set()
  function cardHTML(n, old) {
    const fresh = !shownCards.has(n.uid); shownCards.add(n.uid)
    const a = D.APPS[n.app], ago = Math.round(S.gm - n.gm)
    const when = ago < 2 ? (LANG === 'ja' ? 'いま' : 'now') : (LANG === 'ja' ? ago + '分前' : ago + 'm ago')
    const name = pickTx(a)
    const from = fromOf(n)
    return '<button class="card' + (old ? ' old' : '') + (fresh ? ' new' : '') + '" data-uid="' + n.uid + '"><i style="background:' + a.c + '">' + esc(name[0]) + '</i><span class="c-tx"><span class="c-app"><span>' + esc(name) + '</span><span>' + when + '</span></span>' +
      (from ? '<b class="c-from">' + esc(from) + '</b>' : '') + '<span class="c-msg">' + esc(msgOf(n)) + '</span></span></button>'
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  let lastMin = -1
  function render(force) {
    if (!S || SIM) return
    // スマホ
    const pr = phoneRect()
    const shake = S.t - S.shakeT < 0.38
    el.phone.style.width = pr.w + 'px'; el.phone.style.height = pr.h + 'px'
    el.phone.style.transform = 'translate(' + pr.x + 'px,' + pr.y + 'px) rotate(' + pr.rot + 'deg)'
    if (shake && !el.phone.classList.contains('buzz')) { el.phone.classList.add('buzz'); setTimeout(() => el.phone.classList.remove('buzz'), 400) }
    const mm = Math.floor(S.gm)
    if (mm !== lastMin || force) { lastMin = mm; $('pTime').textContent = fmt(S.gm); $('pDate').textContent = T('dateFmt')(S.gm >= 120 ? 12 : 11); $('batt').style.width = Math.max(4, 82 - S.gm / NIGHT * 70 - S.stats.opens * 6) + '%'; cardsDirty = cardsDirty || mm % 3 === 0 }
    if (cardsDirty || force) {
      cardsDirty = false
      const st = stack(), vis = st.slice(0, 3)
      $('cards').innerHTML = S.mode === 'alarm' ? '' : vis.map((n, i) => cardHTML(n, i > 0)).join('')
      const more = st.length - vis.length
      $('more').textContent = more > 0 && S.mode !== 'alarm' ? (LANG === 'ja' ? 'ほか ' + more + ' 件の通知' : '+' + more + ' more') : ''
      $('alarmUI').hidden = S.mode !== 'alarm'
      $('alarmTxt').textContent = T('alarm')
    }
    // 夜明け
    $('dawn').style.opacity = clamp((S.gm - 380) / 100, 0, 1)
    // 物
    for (const k of ['mug', 'marker', 'eraser']) {
      const r = L[k], h = S.hands.find((x) => x.hold === k)
      let x = r.x, y = r.y, rot = k === 'marker' ? -20 : k === 'eraser' ? 10 : 0
      if (h && h.p) { x = h.p.x - r.w / 2 + (h.side === 'R' ? -L.aw * 0.08 : L.aw * 0.08); y = h.p.y - r.h * 0.2 }
      el[k].style.width = r.w + 'px'; el[k].style.height = r.h + 'px'
      el[k].style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + rot + 'deg)'
      el[k].style.zIndex = h ? 6 : 1
    }
    // 猫
    if (catDirty || force) {
      catDirty = false
      const c = S.cat, cr = L.cat
      el.cat.hidden = !c
      if (c) {
        el.cat.style.width = cr.w + 'px'; el.cat.style.height = cr.h + 'px'
        const p = phonePt(), x = p.x - cr.w / 2, y = p.y - cr.h * 0.62
        el.cat.style.transform = 'translate(' + (c.on ? x : L.W + 20) + 'px,' + y + 'px)'
      }
    }
    // インク
    if (inkDirty || force) drawInk(true); else drawInk(false)
    // 腕
    ARMS.forEach((a, i) => {
      const h = S.hands[i]
      const vis = MODE !== 'title'
      a.el.style.display = vis ? '' : 'none'
      if (!h.p) h.p = restPt(h)
      const s = i === 0 ? L.sR : L.sL
      const P = h.p
      let th = Math.atan2(P.x - s.x, s.y - P.y)
      if (h.st === 'wind' || h.st === 'turn') th += Math.sin(S.t * 38) * 0.03
      const ux = Math.sin(th), uy = -Math.cos(th), reach = L.ah * 0.9
      const bx = P.x - ux * reach, by = P.y - uy * reach
      const lift = h.st === 'wind' ? 1.04 : 1
      a.el.style.transform = 'translate(' + (bx - L.aw / 2) + 'px,' + (by - L.ah) + 'px) rotate(' + (th * 180 / Math.PI) + 'deg) scale(' + lift + ')'
      const want = POSE[h.pose].src
      if (a.cur !== h.pose) { a.cur = h.pose; a.img.src = want }
      a.el.querySelector('.band').hidden = h.slaps < 6
      // はたく当たり（手のひらの真ん中）
      const r = Math.max(44, L.aw * 0.46), cx = bx + ux * L.ah * 0.64, cy = by + uy * L.ah * 0.64
      a.palm = { x: cx, y: cy, r }
    })
    // 心の声
    const v = S.voice, von = v && S.t - v.t0 < v.dur
    if (voiceDirty) { voiceDirty = false; if (v) $('voice').textContent = v.s }
    $('voice').classList.toggle('on', !!von)
    // 案内
    if (hintDirty || S.hint) renderHint()
    if (ovDirty) renderOv()
    if (S.ov && S.ov.kind === 'melt') { const o = S.ov; $('ovClock').innerHTML = esc(T('melt')) + ' <b>' + fmt(S.gm) + '</b>' }
  }
  function renderHint() {
    const hn = $('hint'), f = $('finger')
    if (hintDirty) { hintDirty = false; hn.hidden = !S.hint; f.hidden = !S.hint; if (S.hint) hn.textContent = T(S.hint.key) }
    if (!S.hint) return
    let x = L.W / 2, y = L.H / 2, ty
    if (S.hint.at === 'hand') { const a = ARMS[S.hint.ref]; if (a.palm) { x = a.palm.x; y = a.palm.y } ty = y - L.H * 0.17 }
    else if (S.hint.at === 'card') { const b = document.querySelector('.card[data-uid="' + S.hint.ref + '"]'); if (b) { const r = b.getBoundingClientRect(); x = r.left + r.width * 0.5; y = r.top + r.height * 0.6 } ty = L.phone.y + L.phone.h + 14 }
    else if (S.hint.at === 'phone') { const p = phoneRect(); x = p.x + p.w * 0.62; y = p.y + p.h * 0.78; ty = p.y + p.h + 14 }
    f.style.left = (x - 10) + 'px'; f.style.top = (y - 6) + 'px'
    hn.style.top = clamp(ty, 60, L.H - 50) + 'px'
  }
  function renderOv() {
    ovDirty = false
    const ov = $('overlay'), o = S && S.ov
    ov.hidden = !o
    if (!o) return
    const body = $('ovBody'), head = $('ovHead'), clk = $('ovClock')
    if (o.kind === 'melt' || o.kind === 'real') {
      const a = D.APPS[o.n.app]
      head.style.background = a.c; $('ovIcon').textContent = pickTx(a)[0]; $('ovApp').textContent = pickTx(a)
      if (o.kind === 'melt') {
        // 開いたら最後、関連の投稿が流れてくる（時間が溶ける）
        const rel = D.SPAM.filter((x) => x.id !== o.n.def.id).sort(() => Math.random() - 0.5).slice(0, 9)
        body.innerHTML = (fromOf(o.n) ? '<p class="from">' + esc(fromOf(o.n)) + '</p>' : '') + '<h3>' + esc(msgOf(o.n)) + '</h3><p class="truth">' + esc(truthOf(o.n)) + '</p>' +
          '<div class="feed"><div>' + rel.map((x) => '<p style="--c:' + D.APPS[x.app].c + '"><i></i>' + esc(pickTx(x)[0]) + '</p>').join('') + '</div></div>'
        clk.hidden = false
      } else {
        const tx = pickTx(o.n.def)
        body.innerHTML = '<p class="from">' + esc(fromOf(o.n)) + '</p><p class="bub">' + esc(tx[0]) + '</p><p class="bub me">' + (o.late ? (LANG === 'ja' ? 'ごめん今見た' : 'sorry, just saw this') : (LANG === 'ja' ? 'わかった' : 'got it')) + '</p><p class="truth">' + esc(o.late ? tx[2] : tx[1]) + '</p>'
        clk.hidden = true
      }
    } else if (o.kind === 'reveal') {
      head.style.background = '#1d2340'; $('ovIcon').textContent = '!'; $('ovApp').textContent = T('unreadN')(o.total)
      body.innerHTML = '<div class="ov-list">' + o.list.map((x) => '<div class="rv' + (x.on ? ' on' : '') + '"><s>' + esc((fromOf(x.n) ? fromOf(x.n) + ' ' : '') + msgOf(x.n)) + '</s><em>' + esc(truthOf(x.n)) + '</em></div>').join('') + '</div>' +
        (o.list.every((x) => x.on) ? '<p class="ov-sum">' + esc(LANG === 'ja' ? o.total + '件中、大事なのは' + S.stats.realN + '件だけ' : 'Of ' + o.total + ', only ' + S.stats.realN + ' mattered') + '</p>' : '')
      clk.hidden = true
    }
  }
  // ノートの字
  let inkSp = -1, inkLines = -1
  function drawInk(full) {
    const c = el.ink, g = c.getContext('2d'), w = c.width, h = c.height
    const sp = Math.floor(S.study / (PER_PAGE * 2)), inSp = S.study - sp * PER_PAGE * 2
    if (full || sp !== inkSp) { g.clearRect(0, 0, w, h); inkSp = sp; inkLines = 0 }
    g.strokeStyle = '#4b5068'; g.lineWidth = 1.3 * L.dpr; g.lineCap = 'round'; g.lineJoin = 'round'
    const upto = Math.floor(inSp)
    for (let i = inkLines; i <= upto && i < PER_PAGE * 2; i++) {
      const f = i < upto ? 1 : inSp - upto
      scribble(g, i, f, w, h, sp)
    }
    inkLines = Math.max(0, upto)
    for (const s of S.stains) if (s.sp === sp && !s.drawn) { s.drawn = true; g.fillStyle = 'rgba(120,70,30,.28)'; g.beginPath(); g.ellipse(s.u * w, s.v * h, s.r * w, s.r * w * 0.8, 0.3, 0, 7); g.fill(); g.strokeStyle = 'rgba(100,55,20,.35)'; g.stroke(); g.strokeStyle = '#4b5068' }
    if (full) for (const s of S.stains) if (s.sp === sp) s.drawn = false
    $('pageNo').textContent = 'p.' + (1 + sp * 2)
  }
  function scribble(g, i, f, w, h, sp) {
    const ln = LINE(i), r = rngOf(i * 977 + sp * 131 + 7)
    const x0 = ln.u0 * w, x1 = lerp(ln.u0, ln.u1, f) * w, y = ln.v * h, amp = h * 0.012
    g.beginPath(); let x = x0, pen = false
    while (x < x1) {
      const word = (0.06 + r() * 0.1) * w
      const xe = Math.min(x1, x + word)
      g.moveTo(x, y); pen = true
      for (let xx = x; xx < xe; xx += w * 0.006) g.lineTo(xx, y - amp * (0.4 + 0.6 * Math.abs(Math.sin(xx * 0.9 + i))) * (r() < 0.15 ? 1.6 : 1))
      x = xe + w * 0.018
    }
    if (pen) g.stroke()
    // 書き直した行（同じ所を上書き）にならないよう、毎回その行だけ消して描き直す
  }

  // ---------- 入力 ----------
  // はたく: 押した所に手のひらがあるか。伸びている手を先に見る（重なっていても、スマホへ向かう手をはたける）
  function handAt(x, y) {
    if (!S || S.mode !== 'play' || MODE !== 'play') return -1
    let best = -1, bd = 1e9
    S.hands.forEach((h, i) => {
      const a = ARMS[i]; if (!h.on || !a.palm) return
      const d = Math.hypot(x - a.palm.x, y - a.palm.y); if (d > a.palm.r) return
      const pri = ((h.st === 'wind' || h.st === 'go') && h.tgt === 'phone') || h.st === 'turn' ? 0 : 1
      const sc = pri * 1e5 + d
      if (sc < bd) { bd = sc; best = i }
    })
    return best
  }
  document.addEventListener('pointerdown', (e) => {
    const i = handAt(e.clientX, e.clientY); if (i < 0) return
    if (e.target.closest && e.target.closest('button:not(.card),a,#overlay')) return
    e.preventDefault(); e.stopPropagation(); audioInit(); slap(i); render()
  }, { capture: true, passive: false })
  $('cards').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.card'); if (!b || !S) return
    e.preventDefault(); audioInit()
    const n = S.notes.find((x) => x.uid === +b.dataset.uid)
    if (n) tapCard(n)
  })
  function tapCard(n) { if (S.mode !== 'play' || S.freeze) return; openNote(n, 'tap'); render() }
  el.phone.addEventListener('pointerdown', (e) => { audioInit(); if (S && S.mode === 'alarm') { e.preventDefault(); stopAlarm(); render() } })
  $('overlay').addEventListener('pointerdown', (e) => { if (S && S.mode === 'reveal' && S.ov.list.every((x) => x.on)) { e.preventDefault(); finish() } })

  // ---------- 画面 ----------
  function show(v) {
    MODE = v
    for (const id of ['vTitle', 'vHow', 'vResult']) $(id).hidden = true
    if (v === 'title') $('vTitle').hidden = false
    el.books.style.visibility = v === 'title' ? 'hidden' : ''
    if (v === 'how') $('vHow').hidden = false
    if (v === 'result') $('vResult').hidden = false
    const playing = v === 'play'
    $('voice').hidden = !playing; $('hint').hidden = true; $('finger').hidden = true
    if (!playing) $('overlay').hidden = true
  }
  function applyLang() {
    document.documentElement.lang = LANG
    $('t1').textContent = T('title1'); $('t2').textContent = T('title2'); $('tSub').textContent = T('sub')
    $('bStart').textContent = T('start'); $('bHow').textContent = T('how'); $('bLang').textContent = T('lang')
    $('howH').textContent = T('howH'); $('howRules').innerHTML = T('rules').map((r) => '<li>' + esc(r) + '</li>').join('')
    $('howNote').textContent = T('howNote'); $('bHowClose').textContent = T('back'); $('lPrivacy').textContent = T('privacy'); $('howCredit').textContent = T('credit')
    $('bAgain').textContent = T('again'); $('bSave').textContent = T('save'); $('bPost').textContent = T('post')
    $('bootMsg').textContent = T('boot')
  }
  function layoutTitle() {
    const n = L.note, b = document.querySelector('.tbtns')
    b.style.top = Math.min(L.H - 130, n.y + n.h * 0.22) + 'px'
  }
  let titleDemo = 0
  function toTitle() {
    loop('write', null, 0, 0.1); loop('alarm', null, 0, 0.05)
    newGame((Math.random() * 1e9) | 0, {})
    S.mode = 'title'
    // タイトルの見本: スマホに通知が1つ
    addNote('spam', D.SPAM.find((s) => s.id === 'oshi')); S.notes[0].gm = -1
    show('title'); render(true)
  }
  let tutDone = false
  try { tutDone = localStorage.getItem('dn_tut') === '1' } catch (e) { }
  function startGame() {
    audioInit()
    const seed = +Q.get('seed') || ((Math.random() * 1e9) | 0)
    const tut = Q.get('tut') != null ? Q.get('tut') === '1' : !tutDone
    newGame(seed, { tut })
    show('play')
    if (window.TM) TM.start()
    loop('bgm', 'snd/bgm_lofi.mp3', 0.2, 1.2); loop('amb', 'snd/amb_clock.mp3', 0.28, 1); loop('amb2', 'snd/amb_crickets.mp3', 0.16, 1); loop('purr', null, 0, 0.1)
    say('start', true)
    render(true)
  }
  $('bStart').addEventListener('click', () => { snd('click'); startGame() })
  $('bHow').addEventListener('click', () => { audioInit(); show('how') })
  $('bHowClose').addEventListener('click', () => show('title'))
  $('bLang').addEventListener('click', () => { LANG = LANG === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('dn_lang', LANG) } catch (e) { } applyLang(); render(true) })
  $('bAgain').addEventListener('click', () => { if (MODE !== 'result') return; snd('click'); startGame() })
  const bMute = $('bMute')
  let muted = false
  try { muted = localStorage.getItem('dn_mute') === '1' } catch (e) { }
  function setMute(m) { muted = m; bMute.classList.toggle('off', m); if (SND) Snd.setMute(m); try { localStorage.setItem('dn_mute', m ? '1' : '0') } catch (e) { } }
  setMute(muted)
  bMute.addEventListener('click', () => { audioInit(); setMute(!muted) })

  // ---------- 結果 ----------
  function result() {
    const st = S.stats
    const base = clamp(Math.round(S.study / FULL * 100), 0, 100)
    let bonus = 0
    const realLines = []
    for (const n of S.notes.filter((x) => x.kind === 'real')) {
      const tx = pickTx(n.def)
      if (n.ok) { bonus += n.def.ok; realLines.push({ ok: true, s: fromOf(n) + '：' + tx[1], b: n.def.ok }) } else { bonus += n.def.ng; realLines.push({ ok: false, s: fromOf(n) + '：' + tx[2], b: n.def.ng }) }
    }
    // 予定が溶けて届かなかった本物は無視あつかい
    const got = S.notes.filter((x) => x.kind === 'real').length
    for (let i = got; i < 2; i++) { bonus -= 10 }
    const score = clamp(base + bonus, 0, 100)
    const rk = T('ranks').find((r) => score >= r[0])
    let title = rk[2]
    if (st.realOk === 0) title = T('familyTitle')
    const com = T('comments').find((c) => score >= c[0])[1]
    return { score, base, bonus, rank: rk[1], title, comment: com, realLines, st }
  }
  function finish() {
    if (S.done) return
    S.done = true; S.mode = 'result'; S.ov = null; ovDirty = true
    loop('write', null, 0, 0.1); loop('alarm', null, 0, 0.05); loop('purr', null, 0, 0.3)
    if (S.tut) { tutDone = true; try { localStorage.setItem('dn_tut', '1') } catch (e) { } }
    const r = S.res = result()
    if (SIM) return
    if (SND) Snd.duck(0.3, 2.5)
    snd(r.score >= 80 ? 'j_good' : r.score >= 40 ? 'j_mid' : 'j_bad', { vol: 0.8 })
    if (window.TM) TM.end(r.score, r.score >= 60)
    show('result'); renderOv()
    drawCard(r)
    if (Q.get('auto') && Q.get('again') === '1') setTimeout(() => { if (MODE === 'result') { startGame(); BOT = makeBot(Q.get('auto'), (Math.random() * 99) | 0) } }, 3500)
    const text = T('shareTxt')(r.score, r.title) + ' ' + T('tags')
    $('bPost').href = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent('https://tom3games.com/play/dont-open-it/')
  }
  $('bSave').addEventListener('click', () => { if (window.TM) TM.share('save'); $('card').toBlob((b) => { if (!b) return; const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = 'dont-open-it.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000) }) })
  $('bPost').addEventListener('click', () => { if (window.TM) TM.share('x') })

  // 答案用紙
  function drawCard(r) {
    const c = $('card'), g = c.getContext('2d'), W = 720, H = 1080
    const F = (px, w) => (w || '') + ' ' + px + 'px Yomogi, "Hiragino Sans", sans-serif'
    const G = (px, w) => (w || '') + ' ' + px + 'px "Hiragino Sans", "Noto Sans JP", sans-serif'
    const rnd = rngOf(S.seed)
    g.fillStyle = '#fbf9f2'; g.fillRect(0, 0, W, H)
    // 見出し
    g.fillStyle = '#23285a'; g.textBaseline = 'alphabetic'
    g.font = G(40, 800); g.fillText(T('resultH'), 40, 82)
    g.font = G(26, 700); g.fillText(T('subject'), 40, 124)
    g.font = G(20, 600); g.fillStyle = '#555'; g.fillText(T('nameL'), 40, 172)
    g.strokeStyle = '#888'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(40, 184); g.lineTo(330, 184); g.stroke()
    g.font = F(30); g.fillStyle = '#23285a'; g.fillText(T('you'), 130 + (LANG === 'en' ? 6 : 0), 176)
    // 点数（赤ペン）
    const red = '#d8372e'
    g.save(); g.translate(560, 120); g.rotate(-0.06)
    g.fillStyle = red; g.font = F(r.score >= 100 ? 108 : 120); g.textAlign = 'center'; g.fillText(String(r.score), 0, 30)
    g.font = F(36); g.fillText(LANG === 'ja' ? '点' : 'pts', 96, 30)
    g.strokeStyle = red; g.lineWidth = 5
    for (let k = 0; k < 2; k++) { g.beginPath(); g.ellipse(4 + k * 3, -6, 128 + k * 6, 70 + k * 4, -0.05, 0.3, Math.PI * 2 + 0.1); g.stroke() }
    g.restore()
    // ハンコ
    g.save(); g.translate(420, 210); g.rotate(-0.25)
    g.strokeStyle = red; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 52, 0, 7); g.stroke()
    g.fillStyle = red; g.textAlign = 'center'; g.font = G(r.rank.length > 2 ? 26 : 36, 900); g.fillText(r.rank, 0, 12)
    g.restore()
    // 称号
    g.fillStyle = red; g.textAlign = 'left'; let tf = 38; g.font = F(tf); while (tf > 22 && g.measureText(r.title).width > 300) { tf -= 2; g.font = F(tf) } g.fillText(r.title, 40, 238)
    // 答え（書けた量だけ鉛筆の字）
    const lines = 8, filled = Math.round(r.base / 100 * lines), top = 300, gap = 42
    g.strokeStyle = '#cfdcee'; g.lineWidth = 1.5
    for (let i = 0; i <= lines; i++) { const y = top + 8 + i * gap; g.beginPath(); g.moveTo(40, y); g.lineTo(W - 40, y); g.stroke() }
    g.strokeStyle = '#e9a0a0'; g.beginPath(); g.moveTo(96, top - 30); g.lineTo(96, top + lines * gap + 10); g.stroke()
    g.lineCap = 'round'
    for (let i = 0; i < lines; i++) {
      const y = top + i * gap
      g.fillStyle = '#23285a'; g.font = G(20, 700); g.fillText('(' + (i + 1) + ')', 44, y + 2)
      if (i < filled) {
        let x = 112; const end = 600 - rnd() * 150
        g.strokeStyle = '#4b5068'; g.lineWidth = 2.2; g.beginPath()
        while (x < end) { const we = Math.min(end, x + 40 + rnd() * 70); g.moveTo(x, y); for (let xx = x; xx < we; xx += 5) g.lineTo(xx, y - 6 - 8 * Math.abs(Math.sin(xx * 0.7 + i))); x = we + 16 }
        g.stroke()
        g.strokeStyle = red; g.lineWidth = 3.5; g.beginPath()
        if (rnd() < 0.8) g.ellipse(650, y - 6, 20, 16, 0, 0, 7); else { g.moveTo(636, y - 20); g.lineTo(666, y + 6); g.moveTo(666, y - 20); g.lineTo(636, y + 6) }
        g.stroke()
      }
    }
    // 開いた回数だけ、白い所にスマホの落書き
    for (let k = 0; k < Math.min(5, r.st.opens); k++) {
      const x = 380 + k * 56, y = top + Math.min(lines - 1, filled + 1) * gap
      if (filled >= lines) break
      g.strokeStyle = '#8a8fa6'; g.lineWidth = 2; g.strokeRect(x, y - 36, 26, 44); g.beginPath(); g.arc(x + 13, y + 1, 2.5, 0, 7); g.stroke()
    }
    // 先生のひとこと
    g.fillStyle = red; g.font = F(34)
    g.fillText(r.comment, 112, top + Math.min(filled, lines - 1) * gap + (filled >= lines ? 2 : 4) + (filled >= lines ? 0 : 0))
    // 本物の至急
    let y0 = top + lines * gap + 36
    g.font = G(21, 700)
    r.realLines.forEach((l, i) => {
      g.fillStyle = l.ok ? '#1f7a6e' : red
      g.fillText(fit(g, (l.b > 0 ? '+' : '') + l.b + '  ' + l.s, W - 80), 40, y0 + i * 30)
    })
    // 付箋: 昨夜の通知の正体
    const pool = S.notes.filter((n) => n.kind !== 'real').sort((a, b) => (b.t * 3 + (b.kind === 'rare' ? 4 : b.kind === 'fake' ? 1 : 0) + (b.opened ? 0 : 2) + b.uid * 0.01) - (a.t * 3 + (a.kind === 'rare' ? 4 : a.kind === 'fake' ? 1 : 0) + (a.opened ? 0 : 2) + a.uid * 0.01)).slice(0, 3)
    const ny = y0 + 72, nh = 46 + pool.length * 58
    g.save(); g.translate(40, ny); g.rotate(-0.015)
    g.fillStyle = '#ffe066'; g.fillRect(0, 0, 640, nh); g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, nh - 8, 640, 8)
    g.fillStyle = '#5a4300'; g.font = G(19, 800); g.fillText(T('truthH'), 16, 32)
    pool.forEach((n, i) => {
      const yy = 62 + i * 58
      g.fillStyle = '#2b2118'; g.font = G(18, 600); g.fillText(fit(g, (fromOf(n) ? fromOf(n) + ' ' : '') + msgOf(n), 600), 16, yy)
      g.fillStyle = red; g.font = F(24); g.fillText(fit(g, truthOf(n), 600), 30, yy + 28)
    })
    g.restore()
    // 下の行
    g.fillStyle = '#555'; g.font = G(17, 600); g.textAlign = 'left'
    g.fillText(fit(g, T('stat')({ slaps: r.st.slaps, opens: r.st.opens, meltTxt: T('meltTxt')(r.st.meltMin), realOk: r.st.realOk, realN: r.st.realN }), W - 80), 40, H - 56)
    g.textAlign = 'right'; g.fillStyle = '#23285a'; g.font = F(22); g.fillText(LANG === 'ja' ? 'その通知、開くな' : 'Don\'t Open That', W - 40, H - 22)
    g.textAlign = 'left'
  }
  function fit(g, s, w) { if (g.measureText(s).width <= w) return s; while (s.length > 1 && g.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…' }

  // ---------- ループ ----------
  let acc = 0, last = performance.now(), paused = false
  function frame() {
    const now = performance.now()
    if (!paused && S && (MODE === 'play' || MODE === 'title')) {
      acc += Math.min(0.25, (now - last) / 1000)
      while (acc >= DT) { acc -= DT; if (MODE === 'play') tick(); else S.t += DT }
      if (MODE === 'play' && S.mode === 'result') { /* finish で画面が変わる */ }
      render()
    }
    last = now
    requestAnimationFrame(frame)
  }

  // ---------- bot（sim と自動確認用） ----------
  let BOT = null
  function makeBot(kind, seed) {
    const r = rngOf(seed * 7 + 3)
    const seen = new Map(), cardSeen = new Map()
    const P = {
      best: { re: [0.15, 0.2], miss: 0, mis: 0, real: 1, realT: [0.5, 0.8], fake: 0 },
      human: { re: [0.5, 1.0], miss: 0.08, mis: 0.12, real: 0.85, realT: [1.5, 3.5], fake: 0.15, imp: 0.012 },
      slow: { re: [0.9, 1.3], miss: 0.12, mis: 0.15, real: 0.7, realT: [2.5, 5], fake: 0.2, imp: 0.02 },
      slapAll: { re: [0.5, 0.8], miss: 0, mis: 1, real: 0, fake: 0 },
      noReal: { re: [0.15, 0.2], miss: 0, mis: 0, real: 0, fake: 0 },
    }[kind]
    let spamT = 0
    return function (S) {
      if (kind === 'nothing') return
      if (kind === 'spam') { if (S.pt > spamT) { spamT = S.pt + 0.35; slap(0); slap(1) } return }
      if (kind === 'openAll') { for (const n of S.notes) if (!n.opened && S.pt - n.at > 1) { openNote(n, 'tap'); return } return }
      S.hands.forEach((h, i) => {
        if (!h.on) return
        const key = i + ':' + h.lid + ':' + (h.tgt === 'phone' || h.st === 'turn' ? 'p' : 'i')
        const active = h.st === 'wind' || h.st === 'go' || h.st === 'turn'
        if (!active) return
        const toPhone = h.tgt === 'phone' || h.st === 'turn'
        if (!seen.has(key)) {
          const want = toPhone ? r() >= P.miss : r() < P.mis
          seen.set(key, { at: S.pt + rr2(P.re), want })
        }
        const s = seen.get(key)
        if (s.want && S.pt >= s.at && !s.done) { s.done = true; slap(i) }
      })
      for (const n of S.notes) {
        if (n.opened || n.missed || cardSeen.has(n.uid)) continue
        if (n.kind === 'real') cardSeen.set(n.uid, r() < P.real ? S.pt + rr2(P.realT) : Infinity)
        else if (n.kind === 'fake') cardSeen.set(n.uid, r() < P.fake ? S.pt + 2 : Infinity)
        else cardSeen.set(n.uid, n.t === 3 && P.imp && r() < P.imp * 10 ? S.pt + 2.5 : Infinity)
      }
      for (const [uid, at] of cardSeen) if (S.pt >= at) { cardSeen.set(uid, Infinity); const n = S.notes.find((x) => x.uid === uid); if (n && !n.opened && S.mode === 'play') { openNote(n, 'tap'); return } }
    }
    function rr2(a) { return a[0] + (a[1] - a[0]) * r() }
  }
  function sim(kind, seed) {
    SIM = true
    const keep = S
    newGame(seed, {}); BOT = makeBot(kind, seed)
    let n = 0
    while (!S.done && n++ < 60 * 400) { tick(); if (S.mode === 'alarm' && S.t - S.alarmT > 0.8) stopAlarm(); if (S.mode === 'reveal') finish() }
    const out = { kind, seed, ...S.res, study: Math.round(S.study), pt: Math.round(S.pt), t: Math.round(S.t) }
    out.st = { ...S.stats }
    BOT = null; SIM = false; S = keep
    return out
  }

  // ---------- 窓口 ----------
  window.dn = {
    get S() { return S }, get mode() { return MODE }, L,
    state: () => S && ({ mode: S.mode, view: MODE, gm: S.gm, pt: S.pt, study: S.study, stats: { ...S.stats }, hands: S.hands.map((h) => ({ on: h.on, st: h.st, tgt: h.tgt, pose: h.pose })), unread: unread().length, crawl: S.crawl, freeze: S.freeze, tut: S.tut, res: S.res, cat: !!(S.cat && S.cat.on) }),
    handXY: (i) => { const a = ARMS[i]; return a.palm ? { x: a.palm.x, y: a.palm.y } : null },
    cardXY: (uid) => { const b = document.querySelector('.card[data-uid="' + uid + '"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } },
    phoneXY: () => { const r = el.phone.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } },
    notes: () => S.notes.map((n) => ({ uid: n.uid, kind: n.kind, t: n.t, opened: n.opened, missed: n.missed, pinned: n.pin > S.pt })),
    visibleCards: () => [...document.querySelectorAll('.card')].map((b) => +b.dataset.uid),
    slap, tapCard: (uid) => { const n = S.notes.find((x) => x.uid === uid); if (n) tapCard(n) }, start: startGame, sim,
    bot: (kind, seed) => { BOT = kind ? makeBot(kind, seed || 1) : null },
    dbg: {
      pause: () => { paused = true }, resume: () => { paused = false; last = performance.now() },
      step: (n) => { for (let i = 0; i < (n || 1); i++) { if (MODE === 'play') { tick(); if (S.mode === 'result' && MODE === 'play') break } } render() },
      skipTo: (gm) => { while (S.gm < gm && S.mode !== 'result') { tick(); if (S.mode === 'melt' || S.mode === 'real') { S.t += 3; ovTick() } } if (S.mode === 'play') tick(); render(true) },
      force: (i, tgt) => { const h = S.hands[i]; h.on = true; h.next = S.pt; h.force = tgt },
      addNote: (kind, id) => { const pool = kind === 'real' ? D.REAL : kind === 'fake' ? D.FAKE : kind === 'rare' ? D.RARE : D.SPAM; const n = addNote(kind, pool.find((x) => x.id === id) || pool[0]); render(true); return n.uid },
      finish: () => { S.gm = NIGHT; if (S.mode === 'play') startAlarm(); stopAlarm(); finish() },
    },
  }

  // ---------- 起動 ----------
  applyLang()
  layout()
  addEventListener('resize', layout)
  if (window.visualViewport) visualViewport.addEventListener('resize', layout)
  toTitle()
  requestAnimationFrame(frame)
  // 最初の画面に要る絵が届いたら読み込み画面を消す
  const need = ['img/desk.webp', 'img/hw_write.webp', 'img/i_note.webp'].map((u) => new Promise((ok) => { const im = new Image(); im.onload = im.onerror = () => { window.__bootStep && __bootStep(); ok() }; im.src = u }))
  const fontP = document.fonts && document.fonts.load ? document.fonts.load('20px Yomogi').catch(() => { }) : Promise.resolve()
  Promise.all(need.concat([fontP])).then(() => {
    window.__bootDone = true; $('boot').classList.add('gone'); setTimeout(() => { $('boot').hidden = true }, 450); window.__dnReady = true
    // 確認用: ?auto=human&go=1&again=1（無音で bot が遊ぶ。シミュレーターに流す）
    if (Q.get('auto')) { if (SND) Snd.setMute(true); bMute.classList.add('off') }
    if (Q.get('go') === '1') { startGame(); if (Q.get('auto')) BOT = makeBot(Q.get('auto'), 1) }
  })
})()

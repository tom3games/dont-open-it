// 決まった秒数だけ配信して自分で終わる（止めるコマンドが要らない）。node tools/serve-for.mjs <port> <秒>
import { serve } from './serve.mjs'
const sv = await serve(+(process.argv[2] || 6451)); console.log(sv.url)
setTimeout(() => process.exit(0), 1000 * +(process.argv[3] || 600))

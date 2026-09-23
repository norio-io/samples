// 制作サンプルの表示検証。CLAUDE.md の「検証」節の手順を自動化する。
//
// リポジトリ直下をローカルの HTTP サーバで /samples/ 配下に配信し（GitHub Pages と同じパス）、
// 各サンプルの全ページについて、はみ出し・コントラスト・リンク・コンソールエラーを検査する。
// 違反が1件でもあれば終了コード 1 で終わる。
//
// 使い方: npm --prefix scripts ci && npm --prefix scripts run check
// 環境変数:
//   CHROMIUM_PATH  Playwright が同梱版以外の Chromium を使う場合の実行ファイル
//   PAGES          検査対象を絞る正規表現（例: PAGES=dental-clinic）

import { createServer } from 'node:http'
import { readFile, readdir, stat } from 'node:fs/promises'
import { extname, join, normalize, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BASE_PATH = '/samples/'
const PUBLIC_ORIGIN = 'https://norio-io.github.io'
const WIDTHS = [1755, 1440, 1024, 768, 390]
const FONT_SIZES = [15, 19]
const MIN_CONTRAST = 4.5

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' }

// ---- 配信 ---------------------------------------------------------------

// GitHub Pages と同様に、ディレクトリは末尾スラッシュ付きへ 301、index.html を返す
function serve () {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (!url.pathname.startsWith(BASE_PATH)) return notFound(res)
    let path
    try { path = decodeURIComponent(url.pathname.slice(BASE_PATH.length)) } catch { return notFound(res) }
    const file = normalize(join(ROOT, path))
    if (!file.startsWith(ROOT) || relative(ROOT, file).split(sep).some(p => p.startsWith('.') || p === 'node_modules' || p === 'scripts')) return notFound(res)
    try {
      let s = await stat(file)
      let target = file
      if (s.isDirectory()) {
        if (!url.pathname.endsWith('/')) {
          res.writeHead(301, { location: url.pathname + '/' + url.search })
          return res.end()
        }
        target = join(file, 'index.html')
        s = await stat(target)
      }
      res.writeHead(200, { 'content-type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream' })
      res.end(req.method === 'HEAD' ? undefined : await readFile(target))
    } catch {
      notFound(res)
    }
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)))
}

function notFound (res) {
  res.writeHead(404, { 'content-type': 'text/plain' })
  res.end('404')
}

// ---- 検査対象 -----------------------------------------------------------

// <制作種別>/<業種>/ 以下の index.html。リポジトリ直下（一覧）と、第1階層のみのディレクトリ
// （cafe/ corp/ shop/ などの旧URL、booking/ などの制作種別直下）はリダイレクトのため対象外
async function listPages () {
  const pages = []
  async function walk (dir) {
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.') || ent.name === 'node_modules' || ent.name === 'scripts') continue
      const p = join(dir, ent.name)
      if (ent.isDirectory()) await walk(p)
      else if (ent.name === 'index.html') {
        const rel = relative(ROOT, dir).split(sep).join('/')
        if (rel.split('/').length >= 2) pages.push(rel + '/')
      }
    }
  }
  await walk(ROOT)
  const filter = process.env.PAGES ? new RegExp(process.env.PAGES) : null
  return pages.filter(p => !filter || filter.test(p)).sort()
}

// ---- ブラウザ内で実行する計測 ---------------------------------------------

// 要素単位のはみ出し。幅を持つ要素（ブロック、表、図版、リスト、カードなど）を列挙し、
// 「右にはみ出し」と「内部あふれ」を判定する。祖先で既に検出した要素の子孫は重複として省く
function measureOverflow () {
  const vw = document.documentElement.clientWidth
  const found = []
  const reported = new Set()
  const selectorOf = el => {
    const parts = []
    for (let e = el; e && e.nodeType === 1 && e !== document.body && parts.length < 4; e = e.parentElement) {
      let s = e.localName
      if (e.id) { parts.unshift(`${s}#${e.id}`); break }
      const cls = [...e.classList].slice(0, 2)
      if (cls.length) s += '.' + cls.join('.')
      const same = e.parentElement ? [...e.parentElement.children].filter(c => c.localName === e.localName) : []
      if (same.length > 1) s += `:nth-of-type(${same.indexOf(e) + 1})`
      parts.unshift(s)
    }
    return parts.join(' > ')
  }
  const visible = el => {
    if (!el.getClientRects().length) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none'
  }
  // 祖先が overflow で切り取っている要素は、画面外に出ても表示に影響しない
  const clippedByAncestor = el => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX
      if (ox !== 'visible') return a.getBoundingClientRect().right <= vw + 1
    }
    return false
  }
  // 位置固定の要素（開閉式のメニューなど）は横スクロールを生まない
  const fixedAncestor = el => {
    for (let a = el; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return true
    return false
  }
  const hasReportedAncestor = el => {
    for (let a = el.parentElement; a; a = a.parentElement) if (reported.has(a)) return true
    return false
  }

  if (document.documentElement.scrollWidth > vw + 1) {
    found.push({ kind: 'ページ横スクロール', selector: 'html', value: `scrollWidth ${document.documentElement.scrollWidth} > clientWidth ${vw}` })
  }
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('svg') && el.localName !== 'svg') continue
    if (['script', 'style', 'br', 'wbr', 'template', 'noscript'].includes(el.localName)) continue
    if (!visible(el) || hasReportedAncestor(el)) continue
    const b = el.getBoundingClientRect()
    if (b.width === 0 || b.height === 0) continue
    if (b.right > vw + 1 && !fixedAncestor(el) && !clippedByAncestor(el)) {
      found.push({ kind: '右にはみ出し', selector: selectorOf(el), value: `right ${b.right.toFixed(1)} > ${vw}` })
      reported.add(el)
      continue
    }
    const cs = getComputedStyle(el)
    const scrollable = ['auto', 'scroll'].includes(cs.overflowX)
    const ellipsis = cs.textOverflow === 'ellipsis'
    if (!scrollable && !ellipsis && el.localName !== 'svg' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && cs.display !== 'inline') {
      found.push({ kind: '内部あふれ', selector: selectorOf(el), value: `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}` })
      reported.add(el)
    }
  }
  return found
}

// コントラスト。テキストを直接持つ要素について、描画色と、祖先をたどって合成した背景色から比を求める。
// 背景がグラデーションの場合は各色停止点のうち最も低い比を採る。画像背景は判定不能として報告する
function measureContrast (minRatio) {
  const parse = s => {
    const m = s.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
    return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }
  }
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a)
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }
    const mix = k => (top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / a
    return { r: mix('r'), g: mix('g'), b: mix('b'), a }
  }
  const lum = c => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
  const selectorOf = el => {
    const parts = []
    for (let e = el; e && e.nodeType === 1 && e !== document.body && parts.length < 4; e = e.parentElement) {
      let s = e.localName
      if (e.id) { parts.unshift(`${s}#${e.id}`); break }
      const cls = [...e.classList].slice(0, 2)
      if (cls.length) s += '.' + cls.join('.')
      parts.unshift(s)
    }
    return parts.join(' > ')
  }
  const WHITE = { r: 255, g: 255, b: 255, a: 1 }

  // 背景の候補（グラデーションなら複数）を返す。null は画像背景で判定不能
  const backgrounds = el => {
    const layers = []
    for (let a = el; a; a = a.parentElement) {
      const cs = getComputedStyle(a)
      const img = cs.backgroundImage
      if (img && img !== 'none') {
        if (/url\(/.test(img)) return null
        const stops = [...img.matchAll(/rgba?\([^)]+\)/g)].map(m => parse(m[0]))
        if (stops.length) { layers.push(stops); if (stops.every(s => s.a === 1)) break }
      }
      const bg = parse(cs.backgroundColor)
      if (bg && bg.a > 0) { layers.push([bg]); if (bg.a === 1) break }
    }
    let results = [WHITE]
    for (const layer of layers.reverse()) results = results.flatMap(base => layer.map(c => over(c, base)))
    return results
  }

  const found = []
  const seen = new Set()
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('svg, script, style, noscript, template')) continue
    if (el.matches(':disabled') || el.closest('[aria-hidden="true"]')) continue
    const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()
    if (!text) continue
    const rect = el.getBoundingClientRect()
    if (!el.getClientRects().length || rect.width <= 1 || rect.height <= 1) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') continue
    let opacity = 1
    for (let a = el; a; a = a.parentElement) opacity *= Number(getComputedStyle(a).opacity)
    if (opacity === 0) continue
    const bgs = backgrounds(el)
    const selector = selectorOf(el)
    if (!bgs) {
      if (!seen.has(selector)) found.push({ kind: '判定不能（画像背景）', selector, text: text.slice(0, 24), value: '' })
      seen.add(selector)
      continue
    }
    const fgRaw = parse(cs.color)
    if (!fgRaw) {
      if (!seen.has(selector)) found.push({ kind: '判定不能（色の形式）', selector, text: text.slice(0, 24), value: cs.color })
      seen.add(selector)
      continue
    }
    let worst = Infinity
    let pair
    for (const bg of bgs) {
      const fg = over({ ...fgRaw, a: fgRaw.a * opacity }, bg)
      const r = ratio(fg, bg)
      if (r < worst) { worst = r; pair = [fg, bg] }
    }
    if (worst < minRatio && !seen.has(selector)) {
      seen.add(selector)
      found.push({ kind: 'コントラスト不足', selector, text: text.slice(0, 24), value: `${worst.toFixed(2)}:1（文字 ${hex(pair[0])} / 背景 ${hex(pair[1])}）` })
    }
  }
  return found
}

// ---- 実行 -----------------------------------------------------------------

const server = await serve()
const origin = `http://127.0.0.1:${server.address().port}`
const toLocal = href => href.startsWith(PUBLIC_ORIGIN + BASE_PATH) ? origin + href.slice(PUBLIC_ORIGIN.length) : href

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const context = await browser.newContext({ reducedMotion: 'reduce' })
// 外部への通信は遮断する。結果を外部サービスの状態に依存させないため
await context.route(url => !url.href.startsWith(origin), route => route.abort())

const pages = await listPages()
const violations = []
const warnings = []
// 判定不能（画像背景上の文字）は目視確認を促す注意として出し、失敗にはしない
const report = (page, width, fontSize, item) => (item.kind.startsWith('判定不能') ? warnings : violations).push({ page, width, fontSize, ...item })
const linkTargets = new Map() // URL -> 参照元ページ

for (const path of pages) {
  const url = origin + BASE_PATH + path
  for (const width of WIDTHS) {
    for (const fontSize of FONT_SIZES) {
      const page = await context.newPage()
      await page.setViewportSize({ width, height: 900 })
      const errors = []
      page.on('pageerror', e => errors.push(e.message))
      page.on('console', m => {
        if (m.type() !== 'error') return
        // 遮断した外部通信の失敗は対象外
        const loc = m.location().url
        if (loc && !loc.startsWith(origin)) return
        errors.push(m.text())
      })
      page.on('requestfailed', r => { if (r.url().startsWith(origin)) errors.push(`読み込み失敗: ${r.url()}`) })
      page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`) })

      await page.goto(url, { waitUntil: 'load' })
      await page.addStyleTag({ content: '*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important;animation-delay:0s!important}' })
      await page.evaluate(size => document.body.style.setProperty('font-size', `${size}px`, 'important'), fontSize)
      // スクロール連動の表示（IntersectionObserver など）を発火させる
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
          scrollTo(0, y)
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        }
        scrollTo(0, 0)
      })
      await page.waitForTimeout(100)

      for (const item of await page.evaluate(measureOverflow)) report(path, width, fontSize, { check: 'はみ出し', ...item })
      for (const item of await page.evaluate(measureContrast, MIN_CONTRAST)) report(path, width, fontSize, { check: 'コントラスト', ...item })
      for (const e of new Set(errors)) report(path, width, fontSize, { check: 'エラー', kind: 'コンソールエラー', selector: '', value: e })

      if (width === WIDTHS[0] && fontSize === FONT_SIZES[0]) {
        const hrefs = await page.$$eval('a[href]', as => as.map(a => a.href))
        for (const href of hrefs) {
          const target = toLocal(href).split('#')[0]
          if (!target.startsWith(origin)) continue
          if (!linkTargets.has(target)) linkTargets.set(target, new Set())
          linkTargets.get(target).add(path)
        }
      }
      await page.close()
    }
  }
}

for (const [target, from] of linkTargets) {
  const res = await fetch(target, { redirect: 'follow' }).catch(e => ({ status: e.message }))
  if (res.status !== 200) {
    for (const path of from) report(path, '-', '-', { check: 'リンク', kind: 'リンク切れ', selector: `a[href] → ${target.slice(origin.length)}`, value: String(res.status) })
  }
}

await browser.close()
server.close()

// ---- 出力 -----------------------------------------------------------------

// 同じページ・検査・要素・値の組は、幅とフォントサイズをまとめて1行に出す
const group = list => {
  const grouped = new Map()
  for (const v of list) {
    const key = [v.page, v.check, v.kind, v.selector, v.value].join('\u0000')
    if (!grouped.has(key)) grouped.set(key, { ...v, at: [] })
    grouped.get(key).at.push(v.width === '-' ? '-' : `${v.width}px/${v.fontSize}px`)
  }
  return grouped
}
const print = grouped => {
  let current
  for (const v of grouped.values()) {
    if (v.page !== current) console.log(`\n■ ${current = v.page}`)
    const text = v.text ? `「${v.text}」 ` : ''
    console.log(`  [${v.check}] ${v.kind} ${v.selector} ${text}${v.value}  @ ${v.at.join(', ')}`)
  }
}

console.log(`検査対象: ${pages.length} ページ × 幅 ${WIDTHS.length} 種 × フォントサイズ ${FONT_SIZES.length} 種`)
const warned = group(warnings)
if (warned.size) {
  console.log(`\n注意 ${warned.size} 件（目視で確認すること）`)
  print(warned)
}
const grouped = group(violations)
if (!grouped.size) {
  console.log('\n違反はありません')
  process.exit(0)
}
print(grouped)
const count = check => [...grouped.values()].filter(v => v.check === check).length
console.log(`\n違反 ${grouped.size} 件（はみ出し ${count('はみ出し')} / コントラスト ${count('コントラスト')} / リンク ${count('リンク')} / エラー ${count('エラー')}）`)
process.exit(1)

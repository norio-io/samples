/*
 * 山の湯宿 こだま（架空）— 客室・料金・空室の架空データ
 * 客室ページと空室カレンダーの両方から読み込む。
 * 空室は日付と客室から決まる擬似乱数で作る。同じ日付・客室なら、再読み込みしても、
 * 別の端末で開いても同じ結果になる。
 */
'use strict'

window.KODAMA = (() => {
  const ROOMS = [
    {
      id: 'seseragi', name: 'せせらぎ', type: '和室', area: 25, layout: '和室10畳＋広縁',
      min: 1, max: 4, bath: false, count: 6, base: 18000, bed: '布団', view: '渓流側',
      equip: ['広縁（椅子と卓）', 'シャワー付き内風呂', '洗浄機能付きトイレ', '冷蔵庫', 'Wi-Fi']
    },
    {
      id: 'hibiki', name: 'ひびき', type: '和室（二間）', area: 45, layout: '和室12.5畳＋次の間8畳',
      min: 2, max: 6, bath: false, count: 3, base: 21000, bed: '布団', view: '山側',
      equip: ['二間続き', '内風呂（檜の浴槽）', '洗浄機能付きトイレ 2か所', '冷蔵庫', 'Wi-Fi']
    },
    {
      id: 'kodama', name: 'こだま', type: '和洋室', area: 38, layout: '和室8畳＋ツインベッドの洋室',
      min: 2, max: 4, bath: false, count: 4, base: 24000, bed: 'ベッド2台＋布団', view: '渓流側',
      equip: ['ベッド2台', 'シャワー付き内風呂', '洗浄機能付きトイレ', '冷蔵庫', 'Wi-Fi']
    },
    {
      id: 'yamabiko', name: 'やまびこ', type: '露天風呂付き和室', area: 42, layout: '和室10畳＋縁側＋客室露天風呂',
      min: 2, max: 3, bath: true, count: 3, base: 32000, bed: '布団', view: '渓流側',
      equip: ['客室露天風呂（源泉）', '縁側', '洗浄機能付きトイレ', '冷蔵庫', 'Wi-Fi']
    },
    {
      id: 'mine', name: 'みね', type: '露天風呂付き特別室', area: 68, layout: '和室10畳＋ツインベッドの洋室＋テラス＋客室露天風呂',
      min: 2, max: 5, bath: true, count: 1, base: 42000, bed: 'ベッド2台＋布団', view: '山と渓流の角部屋',
      equip: ['客室露天風呂（源泉）', 'テラス', '内風呂', '洗浄機能付きトイレ 2か所', '冷蔵庫', 'Wi-Fi']
    }
  ]

  // 1室の人数による1名あたりの料金の係数（2名1室を基準とする）
  const FACTOR = { 1: 1.4, 2: 1, 3: 0.93, 4: 0.87, 5: 0.83, 6: 0.8 }
  // 休前日の加算（1名あたり）
  const EVE_EXTRA = 4000
  const MAX_GUESTS = 6

  const room = id => ROOMS.find(r => r.id === id)
  const pad = n => String(n).padStart(2, '0')
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const yen = n => n.toLocaleString('ja-JP')

  // 祝日。日付の決まった祝日と、第n月曜の祝日、振替休日を規則から求める。
  // 春分・秋分の日は 3/20・9/23 に固定する簡略化をしている
  const holidayCache = new Map()
  function holidays (y) {
    if (holidayCache.has(y)) return holidayCache.get(y)
    const nthMonday = (m, n) => {
      const dow = new Date(y, m - 1, 1).getDay()
      return 1 + ((8 - dow) % 7) + (n - 1) * 7
    }
    const list = [
      [1, 1, '元日'], [1, nthMonday(1, 2), '成人の日'], [2, 11, '建国記念の日'], [2, 23, '天皇誕生日'],
      [3, 20, '春分の日'], [4, 29, '昭和の日'], [5, 3, '憲法記念日'], [5, 4, 'みどりの日'], [5, 5, 'こどもの日'],
      [7, nthMonday(7, 3), '海の日'], [8, 11, '山の日'], [9, nthMonday(9, 3), '敬老の日'], [9, 23, '秋分の日'],
      [10, nthMonday(10, 2), 'スポーツの日'], [11, 3, '文化の日'], [11, 23, '勤労感謝の日']
    ]
    const map = new Map(list.map(([m, d, name]) => [`${m}-${d}`, name]))
    for (const [m, d] of list) {
      const date = new Date(y, m - 1, d)
      if (date.getDay() !== 0) continue
      // 日曜の祝日は、次の祝日でない日を振替休日とする
      const sub = new Date(date)
      do sub.setDate(sub.getDate() + 1)
      while (map.has(`${sub.getMonth() + 1}-${sub.getDate()}`))
      if (sub.getFullYear() === y) map.set(`${sub.getMonth() + 1}-${sub.getDate()}`, '振替休日')
    }
    holidayCache.set(y, map)
    return map
  }
  const holidayName = d => holidays(d.getFullYear()).get(`${d.getMonth() + 1}-${d.getDate()}`) || ''

  // 休前日: 土曜日と、祝日の前日
  function isEve (d) {
    if (d.getDay() === 6) return true
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    return Boolean(holidayName(next))
  }

  // 文字列から 0 以上 1 未満の値を返すハッシュ（FNV-1a に攪拌を加えたもの）
  function hash (str) {
    let h = 2166136261
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    h ^= h >>> 13
    h = Math.imul(h, 0x5bd1e995)
    h ^= h >>> 15
    return (h >>> 0) / 4294967296
  }

  // 残りの室数。休前日と祝日は埋まりやすくする
  function remaining (r, d) {
    const busy = isEve(d) ? 0.32 : holidayName(d) ? 0.12 : 0
    const occ = Math.min(1, 0.2 + hash(`${r.id}:${iso(d)}`) * 0.75 + busy)
    // 1室だけの客室は、四捨五入だと半分以上の日が満室になるため、満室の判定を厳しくする
    return r.count === 1 ? (occ > 0.8 ? 0 : 1) : Math.round(r.count * (1 - occ))
  }

  // 'ok'（空室） / 'few'（残りわずか） / 'full'（満室）
  function status (r, d) {
    const left = remaining(r, d)
    if (left === 0) return { key: 'full', left }
    if (left <= Math.max(1, Math.floor(r.count / 3))) return { key: 'few', left }
    return { key: 'ok', left }
  }

  // 1泊2食付き・1名あたりの料金（100円単位）
  function price (r, guests, d) {
    const p = Math.round(r.base * FACTOR[guests] / 100) * 100
    return d && isEve(d) ? p + EVE_EXTRA : p
  }

  const STATUS = {
    ok: { sym: '○', text: '空室' },
    few: { sym: '△', text: '残りわずか' },
    full: { sym: '×', text: '満室' }
  }

  return { ROOMS, MAX_GUESTS, EVE_EXTRA, STATUS, room, iso, pad, yen, holidayName, isEve, status, price }
})()

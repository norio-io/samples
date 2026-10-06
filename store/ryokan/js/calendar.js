/*
 * 空室と料金のカレンダー。
 * 表示の条件（客室・人数・月）は URL のクエリ ?room=…&guests=…&month=YYYY-MM に持たせる。
 * 読み込み時にクエリから状態を復元し、不正な値は既定値に置き換えて URL も書き直す。
 * 月の移動は履歴に積み（pushState）、ブラウザの戻るで前に見ていた月へ戻れる。
 */
'use strict'

;(() => {
  const K = window.KODAMA
  const { ROOMS, STATUS } = K
  const DOW = ['日', '月', '火', '水', '木', '金', '土']
  const MONTHS_AHEAD = 5

  const $ = id => document.getElementById(id)
  const roomSel = $('room')
  const guestSel = $('guests')
  const msg = $('msg')
  const title = $('cal-title')
  const calBox = $('cal')
  const prev = $('prev')
  const next = $('next')
  const pick = $('pick')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const firstMonth = { y: today.getFullYear(), m: today.getMonth() + 1 }
  const monthIndex = ({ y, m }) => y * 12 + (m - 1)
  const fromIndex = i => ({ y: Math.floor(i / 12), m: (i % 12) + 1 })
  const minIdx = monthIndex(firstMonth)
  const maxIdx = minIdx + MONTHS_AHEAD
  const monthKey = ({ y, m }) => `${y}-${K.pad(m)}`

  let state
  let selected = null // 選択中の日付（YYYY-MM-DD）

  for (const r of ROOMS) roomSel.add(new Option(`${r.name}（${r.type}）`, r.id))

  // ---- URL と状態 ------------------------------------------------------

  function parse (search) {
    const q = new URLSearchParams(search)
    const notes = []
    let room = K.room(q.get('room') || '')
    if (!room) {
      if (q.has('room')) notes.push('指定の客室が見つからないため、せせらぎを表示しています。')
      room = ROOMS[0]
    }
    let guests = 2
    const g = q.get('guests')
    if (g !== null) {
      const n = Number(g)
      if (/^\d+$/.test(g) && n >= 1) guests = n
      else notes.push('人数の指定が正しくないため、2名で表示しています。')
    }
    if (guests < room.min || guests > room.max) {
      const fixed = Math.min(room.max, Math.max(room.min, guests))
      if (g !== null || guests !== fixed) notes.push(`${room.name}の定員は${room.min}〜${room.max}名のため、人数を${fixed}名にしています。`)
      guests = fixed
    }
    let month = firstMonth
    const mq = q.get('month')
    const mm = /^(\d{4})-(\d{2})$/.exec(mq || '')
    if (mm) {
      const cand = { y: Number(mm[1]), m: Number(mm[2]) }
      const i = monthIndex(cand)
      if (cand.m >= 1 && cand.m <= 12 && i >= minIdx && i <= maxIdx) month = cand
      else notes.push('指定の月は予約を受け付けていないため、今月を表示しています。')
    } else if (mq) {
      notes.push('月の指定が正しくないため、今月を表示しています。')
    }
    return { state: { room: room.id, guests, month }, notes }
  }

  function query (s) {
    return `?room=${s.room}&guests=${s.guests}&month=${monthKey(s.month)}`
  }

  function save (push) {
    const url = location.pathname + query(state)
    if (url === location.pathname + location.search) return
    history[push ? 'pushState' : 'replaceState'](null, '', url)
  }

  // ---- 描画 ------------------------------------------------------------

  function fillGuests () {
    const r = K.room(state.room)
    guestSel.textContent = ''
    for (let n = r.min; n <= r.max; n++) guestSel.add(new Option(`${n}名`, n))
    guestSel.value = String(state.guests)
  }

  function render () {
    const r = K.room(state.room)
    const { y, m } = state.month
    roomSel.value = r.id
    fillGuests()

    const idx = monthIndex(state.month)
    prev.setAttribute('aria-disabled', String(idx <= minIdx))
    next.setAttribute('aria-disabled', String(idx >= maxIdx))
    title.innerHTML = `${y}年 ${m}月<small>${r.name}（${r.type}）・${state.guests}名1室</small>`

    const first = new Date(y, m - 1, 1)
    const days = new Date(y, m, 0).getDate()
    const table = document.createElement('table')
    table.className = 'cal'
    // 表の名前は月の見出し（#cal-title）から取る
    table.setAttribute('aria-labelledby', 'cal-title')
    table.innerHTML = '<thead><tr>' + DOW.map((d, i) => `<th scope="col" class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}" abbr="${d}曜日">${d}</th>`).join('') + '</tr></thead>'
    const tbody = document.createElement('tbody')
    let tr = document.createElement('tr')
    for (let i = 0; i < first.getDay(); i++) tr.append(blank())
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, m - 1, d)
      tr.append(cell(r, date))
      if (date.getDay() === 6 && d !== days) { tbody.append(tr); tr = document.createElement('tr') }
    }
    while (tr.children.length < 7) tr.append(blank())
    tbody.append(tr)
    table.append(tbody)
    calBox.replaceChildren(table)
    renderPick()
  }

  function blank () {
    const td = document.createElement('td')
    td.className = 'blank'
    return td
  }

  function cell (r, date) {
    const td = document.createElement('td')
    const iso = K.iso(date)
    const hol = K.holidayName(date)
    const eve = K.isEve(date)
    const past = date < today
    const st = K.status(r, date)
    const s = STATUS[st.key]
    const label = `${date.getMonth() + 1}月${date.getDate()}日 ${DOW[date.getDay()]}曜日${hol ? ' ' + hol : ''}${eve ? ' 休前日' : ''}`
    const top = `<span class="top"><span class="dn">${date.getDate()}${hol ? `<span class="hol" title="${hol}">祝</span>` : ''}</span>${eve && !past ? '<span class="eve">休前日</span>' : ''}</span>`
    td.classList.toggle('is-eve', eve)
    if (past) {
      td.className += ' st-past'
      td.innerHTML = `<div class="day">${top}<span class="st"><span class="sym" aria-hidden="true">－</span><span class="stx">受付終了</span></span></div>`
      return td
    }
    const stx = st.key === 'few' ? '<span>残り</span><span>わずか</span>' : s.text
    const price = st.key === 'full' ? '<span class="pr">－</span>' : `<span class="pr">${K.yen(K.price(r, state.guests, date))}<small>円</small></span>`
    const inner = `${top}<span class="st"><span class="sym" aria-hidden="true">${s.sym}</span><span class="stx">${stx}</span></span>${price}`
    td.className += ` st-${st.key}`
    if (st.key === 'full') {
      td.innerHTML = `<div class="day">${inner}</div>`
    } else {
      // ボタンの読み上げは、日付・状態・料金を1文にまとめた aria-label で行う
      const name = `${label} ${s.text} 1名 ${K.yen(K.price(r, state.guests, date))}円`
      td.innerHTML = `<button type="button" class="day" data-date="${iso}" aria-pressed="${selected === iso}" aria-label="${name}">${inner}</button>`
    }
    return td
  }

  function renderPick () {
    const r = K.room(state.room)
    if (!selected || !selected.startsWith(monthKey(state.month))) {
      selected = null
      pick.innerHTML = '<h3>日付を選んでください</h3><p>空室または残りわずかの日を選ぶと、ここにご利用の人数での料金を表示します。</p>'
      return
    }
    const [y, m, d] = selected.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const st = K.status(r, date)
    const per = K.price(r, state.guests, date)
    const hol = K.holidayName(date)
    pick.innerHTML = `<h3>${m}月${d}日（${DOW[date.getDay()]}${hol ? '・祝' : ''}）から1泊${K.isEve(date) ? '・休前日' : ''}</h3>
      <dl>
        <dt>客室</dt><dd>${r.name}（${r.type}）</dd>
        <dt>人数</dt><dd>${state.guests}名1室</dd>
        <dt>空室</dt><dd>${STATUS[st.key].sym} ${STATUS[st.key].text}（残り${st.left}室）</dd>
        <dt>1名あたり</dt><dd>${K.yen(per)}円</dd>
      </dl>
      <p class="total">合計 <b>${K.yen(per * state.guests)}</b>円（1泊2食付き・${state.guests}名分）</p>
      <p>このサンプルでは予約の受付は行いません。</p>`
  }

  // ---- 操作 ------------------------------------------------------------

  function setMessage (notes) {
    msg.textContent = notes.join(' ')
  }

  roomSel.addEventListener('change', () => {
    const r = K.room(roomSel.value)
    const notes = []
    let g = state.guests
    if (g < r.min || g > r.max) {
      g = Math.min(r.max, Math.max(r.min, g))
      notes.push(`${r.name}の定員は${r.min}〜${r.max}名のため、人数を${g}名にしました。`)
    }
    state = { ...state, room: r.id, guests: g }
    setMessage(notes)
    render()
    save(false)
  })

  guestSel.addEventListener('change', () => {
    state = { ...state, guests: Number(guestSel.value) }
    setMessage([])
    render()
    save(false)
  })

  function move (delta) {
    const i = monthIndex(state.month) + delta
    if (i < minIdx || i > maxIdx) return
    state = { ...state, month: fromIndex(i) }
    setMessage([])
    render()
    save(true)
  }
  prev.addEventListener('click', () => move(-1))
  next.addEventListener('click', () => move(1))

  calBox.addEventListener('click', e => {
    const btn = e.target.closest('button.day')
    if (!btn) return
    selected = selected === btn.dataset.date ? null : btn.dataset.date
    for (const b of calBox.querySelectorAll('button.day')) b.setAttribute('aria-pressed', String(b.dataset.date === selected))
    renderPick()
  })

  $('ctl').addEventListener('submit', e => e.preventDefault())

  window.addEventListener('popstate', () => {
    const p = parse(location.search)
    state = p.state
    setMessage(p.notes)
    render()
  })

  // ---- 初期表示 ----------------------------------------------------------

  const init = parse(location.search)
  state = init.state
  setMessage(init.notes)
  render()
  save(false)
})()

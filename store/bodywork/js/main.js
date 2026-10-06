// ひととせ整体院（架空）— 制作サンプル
// 1. 営業時間表で本日の曜日の列を強調する
// 2. トップの「本日の営業」に、曜日に応じた時間帯を表示する
// 3. 予約フォームの入力を検証する（送信処理は持たない）

(() => {
  'use strict'

  // 曜日ごとの営業時間。Date#getDay() の値（0 = 日曜）を添字とする
  const HOURS = [
    ['10:00–13:00', '14:00–17:00'], // 日
    ['10:00–13:00', '14:00–20:00'], // 月
    ['10:00–13:00', '14:00–20:00'], // 火
    null,                           // 水（定休日）
    ['10:00–13:00', '14:00–20:00'], // 木
    ['10:00–13:00', '14:00–20:00'], // 金
    ['10:00–13:00', '14:00–17:00']  // 土
  ]
  const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

  // 検証で日付を差し替えられるよう、?today=YYYY-MM-DD を受け付ける
  const today = (() => {
    const q = new URLSearchParams(location.search).get('today')
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) {
      const [y, m, d] = q.split('-').map(Number)
      return new Date(y, m - 1, d)
    }
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })()
  const todayIndex = today.getDay()

  // ---- 1. 営業時間表 -------------------------------------------------------
  // 列見出しの th に data-day（0〜6）を持たせ、同じ列の td にも .is-today を付ける
  for (const table of document.querySelectorAll('table.hours')) {
    const heads = [...table.querySelectorAll('thead th[data-day]')]
    const head = heads.find(th => Number(th.dataset.day) === todayIndex)
    if (!head) continue
    const col = [...head.parentElement.children].indexOf(head)
    head.classList.add('is-today')
    const mark = document.createElement('span')
    mark.className = 'today-mark'
    mark.textContent = '本日'
    head.append(mark)
    for (const row of table.tBodies[0].rows) {
      const cell = row.children[col]
      if (cell) cell.classList.add('is-today')
    }
  }

  // ---- 2. 本日の営業 -------------------------------------------------------
  const card = document.querySelector('[data-today-card]')
  if (card) {
    const day = card.querySelector('.day')
    const slots = card.querySelector('.slots')
    const label = `${today.getMonth() + 1}月${today.getDate()}日（${DAY_NAMES[todayIndex]}）`
    const hours = HOURS[todayIndex]
    day.textContent = label
    if (hours) {
      slots.textContent = `${hours[0]} ／ ${hours[1]}`
    } else {
      slots.innerHTML = ''
      const s = document.createElement('span')
      s.className = 'closed'
      s.textContent = '本日は定休日です'
      slots.append(s, '。Web予約は24時間受け付けています。')
    }
  }

  // ---- 3. 予約フォーム -----------------------------------------------------
  const form = document.querySelector('form[data-reserve]')
  if (!form) return

  const pad = n => String(n).padStart(2, '0')
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + 60)
  const dateInput = form.elements.date
  dateInput.min = iso(today)
  dateInput.max = iso(maxDate)

  const summary = form.querySelector('.form-summary')
  const done = form.querySelector('.form-done')

  const value = name => {
    const el = form.elements[name]
    return (el.value ?? '').trim()
  }

  // 各項目の検証。誤りがあれば文言を、なければ空文字を返す
  const rules = {
    menu: () => value('menu') ? '' : 'ご希望のメニューを選んでください。',
    date: () => {
      const v = value('date')
      if (!v) return 'ご希望の日付を入力してください。'
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return '日付の形式が正しくありません。'
      const [y, m, d] = v.split('-').map(Number)
      const day = new Date(y, m - 1, d)
      if (day < today) return '本日以降の日付を選んでください。'
      if (day > maxDate) return 'Web予約は60日先までです。それ以降はお電話でご相談ください。'
      if (!HOURS[day.getDay()]) return '水曜日は定休日です。別の日付を選んでください。'
      return ''
    },
    time: () => {
      const v = value('time')
      if (!v) return 'ご希望の開始時刻を選んでください。'
      const d = value('date')
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, m, dd] = d.split('-').map(Number)
        const wd = new Date(y, m - 1, dd).getDay()
        if ((wd === 0 || wd === 6) && v > '16:00') return '土曜・日曜の受付は 16:00 開始までです。'
      }
      return ''
    },
    visit: () => form.querySelector('input[name="visit"]:checked') ? '' : '初めてのご来院かどうかを選んでください。',
    name: () => value('name') ? '' : 'お名前を入力してください。',
    tel: () => {
      const v = value('tel').replace(/[‐－―ー−]/g, '-')
      if (!v) return '電話番号を入力してください。'
      const digits = v.replace(/[-\s()]/g, '')
      if (!/^0\d{9,10}$/.test(digits)) return '電話番号は 0 から始まる10〜11桁の数字で入力してください。'
      return ''
    },
    email: () => {
      const v = value('email')
      if (!v) return ''
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'メールアドレスの形式が正しくありません。'
    },
    agree: () => form.elements.agree.checked ? '' : 'キャンセルの規定をご確認のうえ、チェックを入れてください。'
  }

  // 項目ごとの誤り表示。入力欄に aria-invalid を付け、文言は aria-describedby で結び付けてある
  const show = (name, message) => {
    const err = form.querySelector(`#err-${name}`)
    if (err) err.textContent = message
    const targets = name === 'visit'
      ? form.querySelectorAll('input[name="visit"]')
      : [form.elements[name]]
    for (const el of targets) {
      if (message) el.setAttribute('aria-invalid', 'true')
      else el.removeAttribute('aria-invalid')
    }
  }

  const check = name => {
    const message = rules[name]()
    show(name, message)
    return message
  }

  // 一度誤りを表示した項目は、入力のたびに再検証する
  form.addEventListener('input', e => {
    const name = e.target.name
    if (!rules[name]) return
    if (e.target.getAttribute('aria-invalid') === 'true' || form.dataset.tried) check(name)
    if (name === 'date' && form.dataset.tried) check('time')
  })
  form.addEventListener('change', e => {
    const name = e.target.name
    if (rules[name] && form.dataset.tried) check(name)
  })

  form.addEventListener('submit', e => {
    e.preventDefault()
    form.dataset.tried = '1'
    done.hidden = true
    const errors = Object.keys(rules)
      .map(name => ({ name, message: check(name) }))
      .filter(r => r.message)

    const list = summary.querySelector('ul')
    list.innerHTML = ''
    if (errors.length) {
      for (const { name, message } of errors) {
        const li = document.createElement('li')
        const a = document.createElement('a')
        const target = name === 'visit' ? form.querySelector('input[name="visit"]') : form.elements[name]
        a.href = `#${target.id}`
        a.textContent = message
        a.addEventListener('click', ev => { ev.preventDefault(); target.focus() })
        li.append(a)
        list.append(li)
      }
      summary.querySelector('p').textContent = `入力内容に ${errors.length} 件の誤りがあります。`
      summary.hidden = false
      summary.focus()
      return
    }
    summary.hidden = true
    done.hidden = false
    done.focus()
  })

  form.addEventListener('reset', () => {
    delete form.dataset.tried
    summary.hidden = true
    done.hidden = true
    for (const name of Object.keys(rules)) show(name, '')
  })
})()

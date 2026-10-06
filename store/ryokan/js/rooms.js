/*
 * 客室の絞り込み。人数（定員の範囲に入るか）と、露天風呂の有無で絞る。
 * 条件は URL のクエリ（?guests=3&bath=1）にも反映し、再読み込みで同じ表示に戻す。
 */
'use strict'

;(() => {
  const { ROOMS, MAX_GUESTS } = window.KODAMA
  const form = document.getElementById('filter')
  const result = document.getElementById('result')
  const empty = document.getElementById('empty')
  const emptyWhy = document.getElementById('empty-why')
  const compare = document.getElementById('compare-wrap')

  const readForm = () => ({
    guests: Number(form.elements.guests.value) || 0,
    bath: form.elements.bath.checked
  })

  function writeForm ({ guests, bath }) {
    for (const r of form.elements.guests) r.checked = r.value === (guests ? String(guests) : '')
    form.elements.bath.checked = bath
  }

  function fromUrl () {
    const q = new URLSearchParams(location.search)
    const g = Number(q.get('guests'))
    return {
      guests: Number.isInteger(g) && g >= 1 && g <= MAX_GUESTS ? g : 0,
      bath: q.get('bath') === '1'
    }
  }

  function toUrl ({ guests, bath }) {
    const q = new URLSearchParams()
    if (guests) q.set('guests', guests)
    if (bath) q.set('bath', '1')
    const s = q.toString()
    history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash)
  }

  function apply () {
    const cond = readForm()
    const match = ROOMS.filter(r => (!cond.guests || (r.min <= cond.guests && cond.guests <= r.max)) && (!cond.bath || r.bath))
    const ids = new Set(match.map(r => r.id))
    for (const el of document.querySelectorAll('[data-room]')) el.hidden = !ids.has(el.dataset.room)

    // 空室カレンダーへのリンクには、選んだ人数を引き継ぐ（定員外なら 2名）
    for (const r of ROOMS) {
      const a = document.querySelector(`#${r.id} .cal-link`)
      const g = cond.guests && cond.guests >= r.min && cond.guests <= r.max ? cond.guests : Math.max(2, r.min)
      if (a) a.href = `../calendar/?room=${r.id}&guests=${g}`
    }

    const words = []
    if (cond.guests) words.push(`${cond.guests}名で泊まれる`)
    if (cond.bath) words.push('露天風呂付きの')
    const label = words.length ? words.join('、') + '客室' : ''

    if (!match.length) {
      empty.hidden = false
      compare.hidden = true
      emptyWhy.textContent = `${label}はありません。人数を「指定なし」に戻すか、「露天風呂付きの客室だけを表示」の選択を外すと、ほかの客室が表示されます。`
      result.textContent = '条件に合う客室はありません'
    } else {
      empty.hidden = true
      compare.hidden = false
      result.textContent = words.length
        ? `${label}：5種類中 ${match.length}種類を表示しています`
        : '5種類すべての客室を表示しています'
    }
    toUrl(cond)
  }

  form.addEventListener('change', apply)
  form.addEventListener('submit', e => e.preventDefault())
  document.getElementById('reset').addEventListener('click', () => {
    writeForm({ guests: 0, bath: false })
    apply()
    form.elements.guests[0].focus()
  })

  writeForm(fromUrl())
  apply()
})()

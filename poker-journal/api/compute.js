// Vercel Serverless Function — ESM, Node.js
// Receives compact spot data (cards + board per all-in), returns equity values.
// Client does HH parsing; only equity computation runs here.

function _eval5(cs) {
  const r = cs.map(c => c.rank).sort((a, b) => b - a)
  const flush = cs.every(c => c.suit === cs[0].suit)
  const fr = {}; r.forEach(x => fr[x] = (fr[x] || 0) + 1)
  const bf = Object.entries(fr).sort((a, b) => b[1] - a[1] || +b[0] - +a[0]).map(([k]) => +k)
  const cnt = bf.map(k => fr[k])
  const u = [...new Set(r)].sort((a, b) => b - a)
  let st = false, sh = 0
  if (u.length === 5) {
    if (u[0] - u[4] === 4) { st = true; sh = u[0] }
    else if (u[0] === 12 && u[1] === 3 && u[2] === 2 && u[3] === 1 && u[4] === 0) { st = true; sh = 3 }
  }
  const sc = (cat, a, b, c, d, e) => ((cat << 20) | ((a||0) << 16) | ((b||0) << 12) | ((c||0) << 8) | ((d||0) << 4) | (e||0))
  if (flush && st) return sc(8, sh)
  if (cnt[0] === 4) return sc(7, bf[0], bf[1])
  if (cnt[0] === 3 && cnt[1] === 2) return sc(6, bf[0], bf[1])
  if (flush) return sc(5, r[0], r[1], r[2], r[3], r[4])
  if (st) return sc(4, sh)
  if (cnt[0] === 3) return sc(3, bf[0], bf[1], bf[2])
  if (cnt[0] === 2 && cnt[1] === 2) return sc(2, Math.max(bf[0], bf[1]), Math.min(bf[0], bf[1]), bf[2])
  if (cnt[0] === 2) return sc(1, bf[0], bf[1], bf[2], bf[3])
  return sc(0, r[0], r[1], r[2], r[3], r[4])
}

function _best5(cards) {
  if (cards.length < 5) return 0
  if (cards.length === 5) return _eval5(cards)
  let best = -Infinity
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++)
      for (let k = j + 1; k < cards.length; k++)
        for (let l = k + 1; l < cards.length; l++)
          for (let m = l + 1; m < cards.length; m++) {
            const s = _eval5([cards[i], cards[j], cards[k], cards[l], cards[m]])
            if (s > best) best = s
          }
  return best
}

// card integer: suit*13+rank, evaluate7: lower = better
function _ev7(ints) { return -_best5(ints.map(c => ({ suit: Math.floor(c / 13), rank: c % 13 }))) }

function _nCk(n, k) {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  k = Math.min(k, n - k); let r = 1
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1)
  return Math.round(r)
}

function _enum(deck, k, cb) {
  const n = deck.length; let c = 0
  if (k === 0) { cb([]); return 1 }
  if (k === 1) { for (let i = 0; i < n; i++) { cb([deck[i]]); c++ } return c }
  if (k === 2) { for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) { cb([deck[i], deck[j]]); c++ } return c }
  if (k === 3) { for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) for (let m = j+1; m < n; m++) { cb([deck[i], deck[j], deck[m]]); c++ } return c }
  if (k === 4) { for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) for (let m = j+1; m < n; m++) for (let p = m+1; p < n; p++) { cb([deck[i], deck[j], deck[m], deck[p]]); c++ } return c }
  if (k === 5) { for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) for (let m = j+1; m < n; m++) for (let p = m+1; p < n; p++) for (let q = p+1; q < n; q++) { cb([deck[i], deck[j], deck[m], deck[p], deck[q]]); c++ } return c }
  return c
}

function _sample(deck, k, board) {
  const pool = deck.slice()
  for (let j = 0; j < k; j++) {
    const r = j + Math.floor(Math.random() * (pool.length - j))
    const tmp = pool[j]; pool[j] = pool[r]; pool[r] = tmp
  }
  return [...board, ...pool.slice(0, k)]
}

function equity2(hero, villain, board) {
  const used = new Set([...hero, ...villain, ...board])
  const deck = []; for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c)
  const rem = 5 - board.length
  if (rem === 0) { const s1 = _ev7([...hero, ...board]), s2 = _ev7([...villain, ...board]); return s1 < s2 ? 1 : s1 > s2 ? 0 : 0.5 }
  let w = 0, ti = 0, total = 0
  if (_nCk(deck.length, rem) <= 100000) {
    total = _enum(deck, rem, combo => { const b = [...board, ...combo]; const s1 = _ev7([...hero, ...b]), s2 = _ev7([...villain, ...b]); if (s1 < s2) w++; else if (s1 === s2) ti++ })
    return total ? (w + ti / 2) / total : 0.5
  }
  const N = rem === 5 ? 150000 : 50000
  for (let i = 0; i < N; i++) { const b = _sample(deck, rem, board); const s1 = _ev7([...hero, ...b]), s2 = _ev7([...villain, ...b]); if (s1 < s2) w++; else if (s1 === s2) ti++ }
  return (w + ti / 2) / N
}

function equity3(hero, v1, v2, board) {
  const used = new Set([...hero, ...v1, ...v2, ...board])
  const deck = []; for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c)
  const rem = 5 - board.length
  let hs = 0, total = 0
  const evalAll = (b) => {
    const sh = _ev7([...hero, ...b]), s1 = _ev7([...v1, ...b]), s2 = _ev7([...v2, ...b])
    const best = Math.min(sh, s1, s2)
    if (sh === best) { let w = 1; if (s1 === best) w++; if (s2 === best) w++; hs += 1 / w }
  }
  if (rem === 0) { evalAll(board); return hs }
  if (_nCk(deck.length, rem) <= 100000) {
    total = _enum(deck, rem, combo => evalAll([...board, ...combo]))
  } else {
    const N = rem === 5 ? 150000 : 50000
    for (let i = 0; i < N; i++) evalAll(_sample(deck, rem, board))
    total = N
  }
  return hs / total
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') return res.status(405).end(JSON.stringify({ error: 'Method not allowed' }))
  try {
    const body = req.body || {}
    // spots: [{ hero:[int,int], villains:[[int,int],...], board:[int,...] }, ...]
    const { spots } = body
    if (!Array.isArray(spots)) return res.status(400).end(JSON.stringify({ error: 'Missing spots array' }))
    const equities = spots.map(({ hero, villains, board }) => {
      if (!hero || !villains || !board) return null
      if (villains.length >= 2) return equity3(hero, villains[0], villains[1], board)
      if (villains.length === 1) return equity2(hero, villains[0], board)
      return null
    })
    res.status(200).end(JSON.stringify({ equities }))
  } catch (err) {
    res.status(500).end(JSON.stringify({ error: err.message || String(err) }))
  }
}

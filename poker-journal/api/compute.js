// Vercel Serverless Function — runs on Node.js, no browser freeze
// Heavy equity computation (150k MC iterations for preflop) done here

const _RANKS = '23456789TJQKA'

function _parseCard(s) {
  if (!s || s.length < 2) return null
  const r = _RANKS.indexOf(s[0].toUpperCase())
  const suit = 'SHDC'.indexOf(s[1].toUpperCase())
  return (r >= 0 && suit >= 0) ? { rank: r, suit } : null
}

function _parseCardArr(str) {
  return str.replace(/[\[\]]/g, '').trim().split(/\s+/).map(_parseCard).filter(Boolean)
}

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
  const sc = (cat, a = 0, b = 0, c = 0, d = 0, e = 0) =>
    (cat << 20) | (a << 16) | (b << 12) | (c << 8) | (d << 4) | e
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

// Integer card encoding: card = suit * 13 + rank
function _cardToInt(c) { return c.suit * 13 + c.rank }
function _evaluate7(ints) { return -_best5(ints.map(c => ({ suit: Math.floor(c / 13), rank: c % 13 }))) }

function _nChooseK(n, k) {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  k = Math.min(k, n - k)
  let r = 1
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
  return Math.round(r)
}

function _enumerate5(deck, k, cb) {
  const n = deck.length; let count = 0
  if (k === 0) { cb([]); return 1 }
  if (k === 1) { for (let i = 0; i < n; i++) { cb([deck[i]]); count++ } return count }
  if (k === 2) { for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) { cb([deck[i], deck[j]]); count++ } return count }
  if (k === 3) { for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) for (let m = j+1; m < n; m++) { cb([deck[i], deck[j], deck[m]]); count++ } return count }
  if (k === 4) { for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) for (let m = j+1; m < n; m++) for (let p = m+1; p < n; p++) { cb([deck[i], deck[j], deck[m], deck[p]]); count++ } return count }
  if (k === 5) { for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) for (let m = j+1; m < n; m++) for (let p = m+1; p < n; p++) for (let q = p+1; q < n; q++) { cb([deck[i], deck[j], deck[m], deck[p], deck[q]]); count++ } return count }
  return count
}

function _sampleBoard(deck, k, existingBoard) {
  const pool = deck.slice()
  for (let j = 0; j < k; j++) { const r = j + Math.floor(Math.random() * (pool.length - j));[pool[j], pool[r]] = [pool[r], pool[j]] }
  return [...existingBoard, ...pool.slice(0, k)]
}

function _equity2(hero, villain, board) {
  const used = new Set([...hero, ...villain, ...board])
  const deck = []; for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c)
  const remaining = 5 - board.length
  if (remaining === 0) {
    const s1 = _evaluate7([...hero, ...board]), s2 = _evaluate7([...villain, ...board])
    return s1 < s2 ? 1 : s1 > s2 ? 0 : 0.5
  }
  let w = 0, ti = 0, total = 0
  const nCombos = _nChooseK(deck.length, remaining)
  if (nCombos <= 100000) {
    total = _enumerate5(deck, remaining, (combo) => {
      const b = [...board, ...combo]
      const s1 = _evaluate7([...hero, ...b]), s2 = _evaluate7([...villain, ...b])
      if (s1 < s2) w++; else if (s1 === s2) ti++
    })
    return (w + ti / 2) / total
  }
  const N = remaining === 5 ? 150000 : 50000
  for (let i = 0; i < N; i++) {
    const b = _sampleBoard(deck, remaining, board)
    const s1 = _evaluate7([...hero, ...b]), s2 = _evaluate7([...villain, ...b])
    if (s1 < s2) w++; else if (s1 === s2) ti++
  }
  return (w + ti / 2) / N
}

function _equity3(hero, v1, v2, board) {
  const used = new Set([...hero, ...v1, ...v2, ...board])
  const deck = []; for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c)
  const remaining = 5 - board.length
  let heroShare = 0, total = 0
  const evalAll = (b) => {
    const sh = _evaluate7([...hero, ...b]), s1 = _evaluate7([...v1, ...b]), s2 = _evaluate7([...v2, ...b])
    const best = Math.min(sh, s1, s2)
    if (sh === best) { let winners = 1; if (s1 === best) winners++; if (s2 === best) winners++; heroShare += 1 / winners }
  }
  if (remaining === 0) { evalAll(board); return heroShare }
  const nCombos = _nChooseK(deck.length, remaining)
  if (nCombos <= 100000) {
    total = _enumerate5(deck, remaining, (combo) => evalAll([...board, ...combo]))
  } else {
    const N = remaining === 5 ? 150000 : 50000
    for (let i = 0; i < N; i++) evalAll(_sampleBoard(deck, remaining, board))
    total = N
  }
  return heroShare / total
}

function _parseHand(text) {
  const lines = text.trim().split('\n').map(l => l.replace(/\[[\d: \/\-]+\]/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (!lines.length) return null
  const hand = {
    handId: null, gameId: null, date: null,
    prizePool: 0, buyIn: 0, multiplier: 1,
    blinds: { sb: 0, bb: 0 },
    players: [], hero: null, heroCards: [],
    board: [], boardAtAllin: [],
    allInStreet: null, allInPot: 0, allinDetected: false,
    showdown: [], winners: [], heroFinish: null,
  }
  let sec = 'header', boardFlop = [], boardTurn = null, boardRiver = null
  for (const line of lines) {
    if (line === '*** HEADER ***') { sec = 'header'; continue }
    if (line === '*** PLAYERS ***') { sec = 'players'; continue }
    if (line === '*** HOLE CARDS ***') { sec = 'holecards'; continue }
    if (line.startsWith('*** PRE-FLOP ***')) { sec = 'preflop'; continue }
    if (line.startsWith('*** FLOP ***')) {
      sec = 'flop'
      const m = line.match(/\[([^\]]+)\]/); if (m) boardFlop = _parseCardArr(m[1])
      continue
    }
    if (line.startsWith('*** TURN ***')) {
      sec = 'turn'
      const ms = [...line.matchAll(/\[([^\]]+)\]/g)]
      if (ms.length >= 2) boardTurn = _parseCardArr(ms[ms.length - 1][1])[0]
      else if (ms.length === 1) { const cs = _parseCardArr(ms[0][1]); boardTurn = cs[cs.length - 1] }
      continue
    }
    if (line.startsWith('*** RIVER ***')) {
      sec = 'river'
      const ms = [...line.matchAll(/\[([^\]]+)\]/g)]
      if (ms.length >= 2) boardRiver = _parseCardArr(ms[ms.length - 1][1])[0]
      else if (ms.length === 1) { const cs = _parseCardArr(ms[0][1]); boardRiver = cs[cs.length - 1] }
      continue
    }
    if (line.startsWith('*** SHOWDOWN ***')) { sec = 'showdown'; continue }
    if (line.startsWith('*** SUMMARY ***')) { sec = 'summary'; continue }

    if (sec === 'header') {
      if (line.startsWith('Hand ID:')) hand.handId = line.slice(8).trim()
      else if (line.startsWith('Game ID:')) hand.gameId = line.slice(8).trim()
      else if (line.startsWith('Date & Time:')) hand.date = line.slice(12).trim()
      else if (line.startsWith('Blinds:')) { const m = line.match(/(\d+)\/(\d+)/); if (m) { hand.blinds.sb = +m[1]; hand.blinds.bb = +m[2] } }
      else if (line.startsWith('Prize pool:')) hand.prizePool = parseFloat(line.replace(/[^0-9.]/g, '')) || 0
      else if (line.startsWith('Buy In:')) hand.buyIn = parseFloat(line.replace(/[^0-9.]/g, '')) || 0
      else if (line.startsWith('Multiplier:')) { const m = line.match(/x([\d.]+)/); if (m) hand.multiplier = parseFloat(m[1]) }
      else if (line.startsWith('Total Pot:')) hand.allInPot = parseInt(line.split(':')[1]) || 0
    }
    if (sec === 'players') {
      const m = line.match(/^Seat \d+: (.+?) \((\d+)\)\s*\[([^\]]+)\]/)
      if (m) {
        const isHero = m[3].includes('Hero')
        hand.players.push({ name: m[1].trim(), chips: +m[2], isHero })
        if (isHero) hand.hero = m[1].trim()
      }
    }
    if (sec === 'holecards' && hand.hero) {
      const m = line.match(/^(.+?):\s*\[([^\]]+)\]/)
      if (m && m[1].trim() === hand.hero) hand.heroCards = _parseCardArr(m[2])
    }
    if (['preflop', 'flop', 'turn', 'river'].includes(sec) && !hand.allinDetected) {
      if (/all[\s\-]?in/i.test(line)) {
        hand.allinDetected = true
        hand.allInStreet = sec
        hand.boardAtAllin = [...boardFlop, ...(boardTurn ? [boardTurn] : []), ...(boardRiver ? [boardRiver] : [])]
      }
    }
    if (sec === 'flop' && !boardFlop.length) {
      const m = line.match(/^\[([^\]]+)\]/)
      if (m) { const cs = _parseCardArr(m[1]); if (cs.length >= 3) boardFlop = cs.slice(0, 3) }
    }
    if (sec === 'turn' && boardTurn === null) {
      const ms = [...line.matchAll(/\[([^\]]+)\]/g)]
      if (ms.length >= 2) boardTurn = _parseCardArr(ms[ms.length - 1][1])[0]
      else if (ms.length === 1) { const cs = _parseCardArr(ms[0][1]); if (cs.length) boardTurn = cs[cs.length - 1] }
    }
    if (sec === 'river' && boardRiver === null) {
      const ms = [...line.matchAll(/\[([^\]]+)\]/g)]
      if (ms.length >= 2) boardRiver = _parseCardArr(ms[ms.length - 1][1])[0]
      else if (ms.length === 1) { const cs = _parseCardArr(ms[0][1]); if (cs.length) boardRiver = cs[cs.length - 1] }
    }
    if (sec === 'showdown') {
      const m = line.match(/^(.+?):?\s+shows\s+\[([^\]]+)\]/)
      if (m) hand.showdown.push({ player: m[1].replace(/:$/, '').trim(), cards: _parseCardArr(m[2]) })
    }
    if (sec === 'summary') {
      const wm = line.match(/^(.+?)\s+wins\s+(?:main pot|side pot)\s+of\s+(\d+)/i)
      if (wm) hand.winners.push({ player: wm[1].trim(), amount: +wm[2] })
      const fm = line.match(/^(.+?)\s+finished\s+\d+\w*\s+and\s+wins\s+([\d.]+)/i)
      if (fm && hand.hero && fm[1].trim() === hand.hero) hand.heroFinish = { prize: parseFloat(fm[2]) }
    }
  }
  hand.board = [...boardFlop, ...(boardTurn ? [boardTurn] : []), ...(boardRiver ? [boardRiver] : [])]
  return hand.handId ? hand : null
}

function _parseBetclicHH(text) {
  return text.replace(/â¬/g, '€').replace(/\r/g, '').split(/^-{4,}$/m).map(t => t.trim()).filter(Boolean).map(_parseHand).filter(Boolean)
}

function _calcSessionStats(hands) {
  const tourns = {}
  for (const h of hands) {
    const gid = h.gameId || '_'
    if (!tourns[gid]) tourns[gid] = { hands: [], prizePool: h.prizePool, buyIn: h.buyIn, multiplier: h.multiplier, heroPrize: 0, heroWon: false }
    tourns[gid].hands.push(h)
    if (h.heroFinish) { tourns[gid].heroPrize = h.heroFinish.prize; tourns[gid].heroWon = true }
  }
  let evEurTotal = 0, evChipsTotal = 0, allinTotal = 0, buyInTotal = 0, prizeTotal = 0, wonCount = 0
  const tList = []
  for (const [gid, tn] of Object.entries(tourns)) {
    const totalChips = tn.hands[0]?.players.reduce((s, p) => s + p.chips, 0) || 500
    let evEur = 0, evChips = 0, allin = 0
    for (const h of tn.hands) {
      if (!h.allinDetected || !h.hero) continue
      const hs = h.showdown.find(s => s.player === h.hero)
      if (!hs || hs.cards.length < 2) continue
      const allVs = h.showdown.filter(s => s.player !== h.hero && s.cards.length >= 2)
      if (allVs.length === 0) continue
      const board = (h.boardAtAllin || []).map(_cardToInt)
      const hInts = hs.cards.map(_cardToInt)
      const pot = h.allInPot
      let eq, nInvolved
      if (allVs.length >= 2) {
        eq = _equity3(hInts, allVs[0].cards.map(_cardToInt), allVs[1].cards.map(_cardToInt), board)
        nInvolved = 3
      } else {
        eq = _equity2(hInts, allVs[0].cards.map(_cardToInt), board)
        nInvolved = 2
      }
      const diffChips = pot * (eq - 1 / nInvolved)
      const diffEur = (diffChips / totalChips) * tn.prizePool
      evChips += diffChips
      evEur += diffEur
      allin++
    }
    evEurTotal += evEur; evChipsTotal += evChips; allinTotal += allin
    buyInTotal += tn.buyIn; prizeTotal += tn.heroPrize
    if (tn.heroWon) wonCount++
    tList.push({
      gameId: gid, date: tn.hands[0]?.date || null,
      prizePool: tn.prizePool, buyIn: tn.buyIn, multiplier: tn.multiplier,
      handCount: tn.hands.length, allinSpots: allin,
      evChips, evEur, heroWon: tn.heroWon, heroPrize: tn.heroPrize,
    })
  }
  const n = Object.keys(tourns).length
  return {
    importedAt: new Date().toISOString(),
    totalHands: hands.length, totalTournaments: n,
    totalBuyIn: buyInTotal, totalPrizeWon: prizeTotal,
    netResult: prizeTotal - buyInTotal,
    winRate: n ? wonCount / n : 0,
    allinSpots: allinTotal,
    evChips: evChipsTotal,
    evEur: evEurTotal,
    chipEvPerTourn: n ? evChipsTotal / n : 0,
    tournaments: tList,
  }
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { text } = req.body || {}
  if (!text) return res.status(400).json({ error: 'Missing text' })
  try {
    const hands = _parseBetclicHH(text)
    if (!hands.length) return res.status(400).json({ error: 'Aucune main valide trouvée dans ce fichier.' })
    const stats = _calcSessionStats(hands)
    res.status(200).json(stats)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

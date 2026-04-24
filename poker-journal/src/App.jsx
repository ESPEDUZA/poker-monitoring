import React, { useState, useEffect } from 'react'
import {
  Check, Plus, Trash2, X, Lightbulb, AlertTriangle,
  Heart, Brain, Wallet, Users, Zap, Target, Trophy,
  ArrowUpRight, Spade,
} from 'lucide-react'

const STORAGE_KEY = 'poker_journal_v2'

const DEFAULT_DATA = {
  objectives: { '3y': [], '2y': [], '1y': [], '6m': [], '3m': [], '1m': [] },
  problems: [],
  sideGoals: [],
  monthlyDashboard: {
    month: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    sessionsPlayed: 0,
    hoursPlayed: 0,
    bankrollStart: 0,
    bankrollEnd: 0,
    studyHours: 0,
    notes: '',
  },
  monthlyHistory: [],
  xp: 0,
  hhSessions: [],
}

const HORIZONS = [
  { key: '3y', label: '3 ANS', sub: 'LONG TERME', color: '#8B7FCC', num: '01' },
  { key: '2y', label: '2 ANS', sub: 'CAP INTERMÉDIAIRE', color: '#8B7FCC', num: '02' },
  { key: '1y', label: '1 AN', sub: 'HORIZON ANNUEL', color: '#C9A84C', num: '03' },
  { key: '6m', label: '6 MOIS', sub: 'MOYEN TERME', color: '#C9A84C', num: '04' },
  { key: '3m', label: '3 MOIS', sub: 'TRIMESTRE ACTIF', color: '#3E9E6E', num: '05' },
  { key: '1m', label: '1 MOIS', sub: 'FOCUS IMMÉDIAT', color: '#3E9E6E', num: '06' },
]

const XP_PER_OBJECTIVE = {
  '3y': 100, '2y': 75, '1y': 50, '6m': 30, '3m': 20, '1m': 10,
}

const SIDE_CATEGORIES = [
  { key: 'physical', label: 'PHYSIQUE & SANTÉ', icon: Heart, color: '#3E9E6E' },
  { key: 'mental', label: 'MENTAL & ÉMOTIONS', icon: Brain, color: '#8B7FCC' },
  { key: 'financial', label: 'FINANCES & VIE', icon: Wallet, color: '#C9A84C' },
  { key: 'social', label: 'RELATIONS & SOCIAL', icon: Users, color: '#5A8FA8' },
]

const LEVELS = [
  { level: 1, threshold: 0, title: 'FISH' },
  { level: 2, threshold: 100, title: 'RECREATIONAL' },
  { level: 3, threshold: 300, title: 'REGULAR' },
  { level: 4, threshold: 600, title: 'GRINDER' },
  { level: 5, threshold: 1000, title: 'SHARK' },
  { level: 6, threshold: 1500, title: 'CRUSHER' },
  { level: 7, threshold: 2500, title: 'HIGH ROLLER' },
  { level: 8, threshold: 4000, title: 'PRO' },
]

function getLevel(xp) {
  let current = LEVELS[0]
  let next = LEVELS[1]
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].threshold) {
      current = LEVELS[i]
      next = LEVELS[i + 1] || LEVELS[i]
    }
  }
  return { current, next }
}

// ===== HH IMPORT ENGINE =====

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

function _makeDeck(exclude) {
  const ex = new Set(exclude.map(c => c.suit * 13 + c.rank))
  const d = []
  for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) if (!ex.has(s * 13 + r)) d.push({ rank: r, suit: s })
  return d
}

// ── Opus equity engine (browser port) ─────────────────────────────────────
// Cards are integers 0-51: card = suit * 13 + rank  (rank 0=2 … 12=A, suit 0=S/1=H/2=D/3=C)
function _cardToInt(c) { return c.suit * 13 + c.rank }
// evaluate7: lower score = better hand (Opus convention, uses existing _best5 which is higher=better)
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

// equity2 — exact port of Opus equity2, cards = int arrays
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

// equity3 — exact port of Opus equity3, cards = int arrays
function _equity3(hero, v1, v2, board) {
  const used = new Set([...hero, ...v1, ...v2, ...board])
  const deck = []; for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c)
  const remaining = 5 - board.length
  let heroShare = 0, total = 0
  const evalAll = (b) => {
    const sh = _evaluate7([...hero, ...b]), s1 = _evaluate7([...v1, ...b]), s2 = _evaluate7([...v2, ...b])
    const best = Math.min(sh, s1, s2)  // lower = better
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
  // Strip iPoker inline timestamps [HH:MM:SS] or [DD/MM/YYYY HH:MM:SS] — contains only digits/:/ /- never letters, so card brackets like [Qh 5s] are safe
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
      // Format: *** TURN *** [existing board] [new card] — take the LAST bracket
      const ms = [...line.matchAll(/\[([^\]]+)\]/g)]
      if (ms.length >= 2) boardTurn = _parseCardArr(ms[ms.length - 1][1])[0]
      else if (ms.length === 1) { const cs = _parseCardArr(ms[0][1]); boardTurn = cs[cs.length - 1] }
      continue
    }
    if (line.startsWith('*** RIVER ***')) {
      sec = 'river'
      // Format: *** RIVER *** [existing board] [new card] — take the LAST bracket
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

    // Detect any all-in in the hand (hero OR villain) — CEV needs showdown, not who shoved
    if (['preflop', 'flop', 'turn', 'river'].includes(sec) && !hand.allinDetected) {
      if (/all[\s\-]?in/i.test(line)) {
        hand.allinDetected = true
        hand.allInStreet = sec
        hand.boardAtAllin = [...boardFlop, ...(boardTurn ? [boardTurn] : []), ...(boardRiver ? [boardRiver] : [])]
      }
    }

    // Board cards on a separate line after *** TURN/RIVER *** (some iPoker variants)
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
      // "PlayerName shows [cards]" or "PlayerName: shows [cards]"
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
    // Sum all player stacks = conserved total throughout tournament
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
      console.log('[CEV]', {
        gid: gid.slice(-6), hand: h.handId?.slice(-6),
        nInvolved, nShowdown: h.showdown.length,
        hCards: hs.cards.map(c => _RANKS[c.rank] + 'SHDC'[c.suit]).join(''),
        vCards: allVs.map(v => v.cards.map(c => _RANKS[c.rank] + 'SHDC'[c.suit]).join('')).join('|'),
        boardAtAllin: (h.boardAtAllin || []).map(c => _RANKS[c.rank] + 'SHDC'[c.suit]).join(''),
        pot, eq: +eq.toFixed(3), diffChips: +diffChips.toFixed(1)
      })
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

export default function App() {
  const [data, setData] = useState(DEFAULT_DATA)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('vision')
  const [showObjForm, setShowObjForm] = useState(false)
  const [newObjText, setNewObjText] = useState('')
  const [newObjHorizon, setNewObjHorizon] = useState('1m')
  const [showProblemForm, setShowProblemForm] = useState(false)
  const [newProblem, setNewProblem] = useState({ title: '', description: '', solution: '' })
  const [showSideForm, setShowSideForm] = useState(false)
  const [newSide, setNewSide] = useState({ title: '', category: 'physical', description: '' })
  const [xpBurst, setXpBurst] = useState(null)
  const [hhView, setHhView] = useState('list')
  const [hhSelectedIdx, setHhSelectedIdx] = useState(null)
  const [hhProcessing, setHhProcessing] = useState(false)
  const [hhError, setHhError] = useState(null)

  // Load data from storage (graceful fallback to localStorage, then defaults)
  useEffect(() => {
    (async () => {
      try {
        if (typeof window !== 'undefined' && window.storage) {
          try {
            const result = await window.storage.get(STORAGE_KEY)
            if (result && result.value) {
              setData({ ...DEFAULT_DATA, ...JSON.parse(result.value) })
            }
          } catch (e) {
            // key doesn't exist
          }
        } else if (typeof window !== 'undefined' && window.localStorage) {
          const raw = window.localStorage.getItem(STORAGE_KEY)
          if (raw) setData({ ...DEFAULT_DATA, ...JSON.parse(raw) })
        }
      } catch (e) {
        console.warn('load failed', e)
      }
      setLoading(false)
    })()
  }, [])

  const saveData = async (newData) => {
    setData(newData)
    try {
      if (typeof window !== 'undefined' && window.storage) {
        await window.storage.set(STORAGE_KEY, JSON.stringify(newData))
      } else if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newData))
      }
    } catch (e) {
      console.warn('save failed', e)
    }
  }

  const handleHHImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setHhProcessing(true)
    setHhError(null)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const hands = _parseBetclicHH(evt.target.result)
        if (!hands.length) { setHhError('Aucune main valide trouvée dans ce fichier.'); setHhProcessing(false); return }
        const stats = _calcSessionStats(hands)
        const newSessions = [...(data.hhSessions || []), stats]
        saveData({ ...data, hhSessions: newSessions })
        setHhSelectedIdx(newSessions.length - 1)
        setHhView('detail')
      } catch (err) {
        setHhError('Erreur de parsing: ' + err.message)
      }
      setHhProcessing(false)
      e.target.value = ''
    }
    reader.readAsText(file, 'UTF-8')
  }

  const triggerXpBurst = (amount) => {
    setXpBurst({ amount, id: Date.now() })
    setTimeout(() => setXpBurst(null), 1800)
  }

  // Objectives
  const addObjective = () => {
    if (!newObjText.trim()) return
    const obj = { id: Date.now().toString(), text: newObjText.trim(), done: false }
    saveData({
      ...data,
      objectives: { ...data.objectives, [newObjHorizon]: [...data.objectives[newObjHorizon], obj] },
    })
    setNewObjText('')
    setShowObjForm(false)
  }

  const toggleObjective = (horizon, id) => {
    const obj = data.objectives[horizon].find(o => o.id === id)
    const wasDone = obj.done
    const xpDelta = wasDone ? -XP_PER_OBJECTIVE[horizon] : XP_PER_OBJECTIVE[horizon]
    const newData = {
      ...data,
      objectives: {
        ...data.objectives,
        [horizon]: data.objectives[horizon].map(o => o.id === id ? { ...o, done: !o.done } : o),
      },
      xp: Math.max(0, (data.xp || 0) + xpDelta),
    }
    saveData(newData)
    if (!wasDone) triggerXpBurst(XP_PER_OBJECTIVE[horizon])
  }

  const deleteObjective = (horizon, id) => {
    const obj = data.objectives[horizon].find(o => o.id === id)
    const xpDelta = obj.done ? -XP_PER_OBJECTIVE[horizon] : 0
    saveData({
      ...data,
      objectives: { ...data.objectives, [horizon]: data.objectives[horizon].filter(o => o.id !== id) },
      xp: Math.max(0, (data.xp || 0) + xpDelta),
    })
  }

  // Problems
  const addProblem = () => {
    if (!newProblem.title.trim()) return
    saveData({
      ...data,
      problems: [...data.problems, { id: Date.now().toString(), ...newProblem, resolved: false }],
    })
    setNewProblem({ title: '', description: '', solution: '' })
    setShowProblemForm(false)
  }

  const toggleProblem = (id) => {
    const p = data.problems.find(x => x.id === id)
    const wasResolved = p.resolved
    const xpDelta = wasResolved ? -40 : 40
    saveData({
      ...data,
      problems: data.problems.map(x => x.id === id ? { ...x, resolved: !x.resolved } : x),
      xp: Math.max(0, (data.xp || 0) + xpDelta),
    })
    if (!wasResolved) triggerXpBurst(40)
  }

  const deleteProblem = (id) => {
    saveData({ ...data, problems: data.problems.filter(x => x.id !== id) })
  }

  // Side goals
  const addSideGoal = () => {
    if (!newSide.title.trim()) return
    saveData({
      ...data,
      sideGoals: [...data.sideGoals, { id: Date.now().toString(), ...newSide, done: false }],
    })
    setNewSide({ title: '', category: 'physical', description: '' })
    setShowSideForm(false)
  }

  const toggleSideGoal = (id) => {
    const g = data.sideGoals.find(x => x.id === id)
    const wasDone = g.done
    const xpDelta = wasDone ? -25 : 25
    saveData({
      ...data,
      sideGoals: data.sideGoals.map(x => x.id === id ? { ...x, done: !x.done } : x),
      xp: Math.max(0, (data.xp || 0) + xpDelta),
    })
    if (!wasDone) triggerXpBurst(25)
  }

  const deleteSideGoal = (id) => {
    saveData({ ...data, sideGoals: data.sideGoals.filter(x => x.id !== id) })
  }

  // Monthly
  const updateMonthly = (field, value) => {
    saveData({ ...data, monthlyDashboard: { ...data.monthlyDashboard, [field]: value } })
  }

  const archiveMonth = () => {
    if (!window.confirm('ARCHIVER CE MOIS ET COMMENCER UN NOUVEAU ?')) return
    saveData({
      ...data,
      monthlyHistory: [data.monthlyDashboard, ...data.monthlyHistory],
      monthlyDashboard: {
        ...DEFAULT_DATA.monthlyDashboard,
        month: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        bankrollStart: data.monthlyDashboard.bankrollEnd || 0,
      },
    })
  }

  // Stats
  const totalObj = Object.values(data.objectives).reduce((a, arr) => a + arr.length, 0)
  const doneObj = Object.values(data.objectives).reduce((a, arr) => a + arr.filter(o => o.done).length, 0)
  const progress = totalObj > 0 ? Math.round((doneObj / totalObj) * 100) : 0

  const { current: lvl, next: nextLvl } = getLevel(data.xp || 0)
  const levelProgress = nextLvl.threshold > lvl.threshold
    ? Math.round(((data.xp - lvl.threshold) / (nextLvl.threshold - lvl.threshold)) * 100)
    : 100

  const m = data.monthlyDashboard
  const netResult = (Number(m.bankrollEnd) || 0) - (Number(m.bankrollStart) || 0)
  const hourly = m.hoursPlayed > 0 ? (netResult / m.hoursPlayed).toFixed(2) : '0.00'

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0F' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12, letterSpacing: '0.2em', color: '#C9A84C' }}>CHARGEMENT...</div>
      </div>
    )
  }

  return (
    <div className="app">
      <style>{css}</style>

      {/* XP Burst */}
      {xpBurst && (
        <div key={xpBurst.id} className="xp-burst">
          +{xpBurst.amount} XP
        </div>
      )}

      {/* Industrial stripe marquee */}
      <div className="stripe-marquee">
        <div className="stripe-inner">
          {Array(8).fill(0).map((_, i) => (
            <span key={i}>"POKER PRO JOURNAL" &nbsp;— &nbsp;OBJECTIVES &nbsp;°&nbsp; DISCIPLINE &nbsp;°&nbsp; PERFORMANCE &nbsp;—&nbsp; </span>
          ))}
        </div>
      </div>

      {/* HEADER */}
      <header className="header">
        <div className="header-top">
          <div className="header-left">
            <div className="label-strip">
              <span className="zip-tag">C/O</span>
              <span>SINCE 2026</span>
              <span className="zip-tag alt">"JOURNAL"</span>
            </div>
            <h1 className="title">
              <span className="title-main">POKER</span>
              <span className="title-slash">/</span>
              <span className="title-main">PRO</span>
              <span className="title-quote">"JOURNAL"</span>
            </h1>
            <div className="subtitle">
              <span>→ TRANSITION TRACKER</span>
              <span className="dot" />
              <span>VERSION 2.0</span>
              <span className="dot" />
              <span>{new Date().toLocaleDateString('fr-FR')}</span>
            </div>
          </div>

          <div className="header-right">
            {/* LEVEL CARD */}
            <div className="level-card">
              <div className="level-card-top">
                <div className="level-num">LVL {lvl.level.toString().padStart(2, '0')}</div>
                <Trophy size={14} />
              </div>
              <div className="level-title">"{lvl.title}"</div>
              <div className="level-xp">
                <div className="level-xp-text">
                  <span>{data.xp} XP</span>
                  <span>{nextLvl.threshold} XP</span>
                </div>
                <div className="level-bar">
                  <div className="level-fill" style={{ width: `${levelProgress}%` }} />
                </div>
              </div>
            </div>

            {/* PROGRESS CARD */}
            <div className="progress-card">
              <div className="progress-label">PROGRESSION GLOBALE</div>
              <div className="progress-num">{progress}<span>%</span></div>
              <div className="progress-meta">{doneObj}/{totalObj} OBJECTIFS</div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <nav className="tabs">
          {[
            { id: 'vision', label: 'VISION', num: '01' },
            { id: 'objectifs', label: 'OBJECTIFS', num: '02' },
            { id: 'problemes', label: 'PROBLÈMES', num: '03' },
            { id: 'annexes', label: 'ANNEXES', num: '04' },
            { id: 'mensuel', label: 'MENSUEL', num: '05' },
            { id: 'hh', label: 'ANALYSE HH', num: '06' },
          ].map(t => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'tab-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="tab-num">{t.num}</span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {/* === VISION === */}
        {tab === 'vision' && (
          <section className="section">
            <SectionHeader num="01" title='"VISION"' subtitle="DU PLUS LOIN AU PLUS PROCHE" color="#FF4500" />
            <div className="vision-grid">
              {HORIZONS.map((h) => {
                const objs = data.objectives[h.key] || []
                const done = objs.filter(o => o.done).length
                const pct = objs.length > 0 ? Math.round((done / objs.length) * 100) : 0
                return (
                  <div key={h.key} className="vision-card" style={{ '--accent': h.color }}>
                    <div className="vision-card-stripe">
                      <span>HORIZON {h.num}</span>
                      <span>"{h.label}"</span>
                    </div>
                    <div className="vision-card-body">
                      <div className="vision-card-label">{h.sub}</div>
                      <div className="vision-card-big">{h.label}</div>
                      <div className="vision-card-bar">
                        <div className="vision-card-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="vision-card-meta">
                        <span>{done}/{objs.length}</span>
                        <span>{pct}%</span>
                      </div>
                      {objs.length > 0 ? (
                        <ul className="vision-list">
                          {objs.slice(0, 3).map(o => (
                            <li key={o.id} className={o.done ? 'done' : ''}>
                              <span className="vision-bullet">{o.done ? '■' : '□'}</span>
                              <span>{o.text}</span>
                            </li>
                          ))}
                          {objs.length > 3 && <li className="more">+{objs.length - 3} AUTRES</li>}
                        </ul>
                      ) : (
                        <button className="vision-add" onClick={() => { setNewObjHorizon(h.key); setShowObjForm(true); setTab('objectifs') }}>
                          + DÉFINIR UN CAP
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* === OBJECTIFS === */}
        {tab === 'objectifs' && (
          <section className="section">
            <SectionHeader
              num="02"
              title='"OBJECTIFS"'
              subtitle="PAR HORIZON"
              color="#00C853"
              action={
                <button className="btn-primary" onClick={() => setShowObjForm(true)}>
                  <Plus size={14} /> NOUVEL OBJECTIF
                </button>
              }
            />

            {showObjForm && (
              <div className="form-card">
                <div className="form-tag">"NEW ENTRY"</div>
                <div className="form-row">
                  <label>HORIZON</label>
                  <div className="chip-row">
                    {HORIZONS.map(h => (
                      <button
                        key={h.key}
                        className={`chip ${newObjHorizon === h.key ? 'chip-active' : ''}`}
                        style={newObjHorizon === h.key ? { background: h.color, borderColor: h.color } : {}}
                        onClick={() => setNewObjHorizon(h.key)}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-row">
                  <label>OBJECTIF</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newObjText}
                    onChange={e => setNewObjText(e.target.value)}
                    placeholder="EX : ATTEINDRE UN ROI DE 15% EN MTT"
                    onKeyDown={e => e.key === 'Enter' && addObjective()}
                    autoFocus
                  />
                </div>
                <div className="form-actions">
                  <button className="btn-ghost" onClick={() => { setShowObjForm(false); setNewObjText('') }}>ANNULER</button>
                  <button className="btn-primary" onClick={addObjective}>AJOUTER →</button>
                </div>
              </div>
            )}

            <div className="horizons-grid">
              {HORIZONS.map(h => {
                const objs = data.objectives[h.key] || []
                return (
                  <div key={h.key} className="horizon-card" style={{ '--accent': h.color }}>
                    <div className="horizon-head">
                      <div>
                        <div className="horizon-num">{h.num}</div>
                        <div className="horizon-label">"{h.label}"</div>
                        <div className="horizon-sub">{h.sub}</div>
                      </div>
                      <button className="btn-icon" onClick={() => { setNewObjHorizon(h.key); setShowObjForm(true) }}>
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="horizon-xp">+{XP_PER_OBJECTIVE[h.key]} XP / OBJECTIF</div>
                    <div className="horizon-body">
                      {objs.length === 0 ? (
                        <p className="empty-text">— VIDE —</p>
                      ) : (
                        objs.map(o => (
                          <div key={o.id} className={`obj-item ${o.done ? 'obj-done' : ''}`}>
                            <button
                              className="obj-check"
                              onClick={() => toggleObjective(h.key, o.id)}
                              style={o.done ? { background: h.color, borderColor: h.color } : {}}
                            >
                              {o.done && <Check size={11} strokeWidth={4} />}
                            </button>
                            <span className="obj-text">{o.text}</span>
                            <button className="obj-delete" onClick={() => deleteObjective(h.key, o.id)}>
                              <X size={12} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* === PROBLÈMES === */}
        {tab === 'problemes' && (
          <section className="section">
            <SectionHeader
              num="03"
              title='"PROBLÈMES"'
              subtitle="DIFFICULTÉS & SOLUTIONS"
              color="#FFD100"
              action={
                <button className="btn-primary" onClick={() => setShowProblemForm(true)}>
                  <Plus size={14} /> NOUVEAU
                </button>
              }
            />

            {showProblemForm && (
              <div className="form-card">
                <div className="form-tag">"NEW ISSUE"</div>
                <div className="form-row">
                  <label>PROBLÈME / DIFFICULTÉ</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newProblem.title}
                    onChange={e => setNewProblem({ ...newProblem, title: e.target.value })}
                    placeholder="EX : GÉRER LE TILT APRÈS UN BAD BEAT"
                  />
                </div>
                <div className="form-row">
                  <label>CONTEXTE</label>
                  <textarea
                    className="form-textarea"
                    value={newProblem.description}
                    onChange={e => setNewProblem({ ...newProblem, description: e.target.value })}
                    placeholder="QUAND, COMMENT, IMPACT SUR LE JEU"
                    rows={3}
                  />
                </div>
                <div className="form-row">
                  <label>"SOLUTION" ENVISAGÉE</label>
                  <textarea
                    className="form-textarea"
                    value={newProblem.solution}
                    onChange={e => setNewProblem({ ...newProblem, solution: e.target.value })}
                    placeholder="PROTOCOLE, EXERCICE, ROUTINE"
                    rows={3}
                  />
                </div>
                <div className="form-actions">
                  <button className="btn-ghost" onClick={() => { setShowProblemForm(false); setNewProblem({ title: '', description: '', solution: '' }) }}>ANNULER</button>
                  <button className="btn-primary" onClick={addProblem}>ENREGISTRER →</button>
                </div>
              </div>
            )}

            <div className="problems-grid">
              {data.problems.length === 0 && !showProblemForm && (
                <div className="empty-state">
                  <AlertTriangle size={32} strokeWidth={1.5} />
                  <p>"AUCUNE DIFFICULTÉ CONSIGNÉE"</p>
                  <span>+40 XP À CHAQUE RÉSOLUTION</span>
                </div>
              )}
              {data.problems.map(p => (
                <div key={p.id} className={`problem-card ${p.resolved ? 'resolved' : ''}`}>
                  <div className="problem-tag">
                    {p.resolved ? '"RESOLVED"' : '"ACTIVE"'}
                  </div>
                  <div className="problem-head">
                    <h3 className="problem-title">{p.title}</h3>
                    <div className="problem-actions">
                      <button
                        className="btn-icon problem-toggle"
                        onClick={() => toggleProblem(p.id)}
                        data-resolved={p.resolved}
                      >
                        <Check size={13} strokeWidth={3} />
                      </button>
                      <button className="btn-icon" onClick={() => deleteProblem(p.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {p.description && (
                    <div className="problem-block">
                      <div className="problem-block-label">→ CONTEXTE</div>
                      <p>{p.description}</p>
                    </div>
                  )}
                  {p.solution && (
                    <div className="problem-block solution-block">
                      <div className="problem-block-label"><Lightbulb size={11} /> "SOLUTION"</div>
                      <p>{p.solution}</p>
                    </div>
                  )}
                  {!p.resolved && <div className="problem-xp">+40 XP À LA RÉSOLUTION</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* === ANNEXES === */}
        {tab === 'annexes' && (
          <section className="section">
            <SectionHeader
              num="04"
              title='"ANNEXES"'
              subtitle="OBJECTIFS HORS POKER"
              color="#651FFF"
              action={
                <button className="btn-primary" onClick={() => setShowSideForm(true)}>
                  <Plus size={14} /> NOUVEL OBJECTIF
                </button>
              }
            />

            {showSideForm && (
              <div className="form-card">
                <div className="form-tag">"NEW GOAL"</div>
                <div className="form-row">
                  <label>CATÉGORIE</label>
                  <div className="chip-row">
                    {SIDE_CATEGORIES.map(c => (
                      <button
                        key={c.key}
                        className={`chip ${newSide.category === c.key ? 'chip-active' : ''}`}
                        style={newSide.category === c.key ? { background: c.color, borderColor: c.color } : {}}
                        onClick={() => setNewSide({ ...newSide, category: c.key })}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-row">
                  <label>OBJECTIF</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSide.title}
                    onChange={e => setNewSide({ ...newSide, title: e.target.value })}
                    placeholder="EX : COURIR 3X / SEMAINE"
                  />
                </div>
                <div className="form-row">
                  <label>DESCRIPTION (OPTIONNEL)</label>
                  <textarea
                    className="form-textarea"
                    value={newSide.description}
                    onChange={e => setNewSide({ ...newSide, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="form-actions">
                  <button className="btn-ghost" onClick={() => { setShowSideForm(false); setNewSide({ title: '', category: 'physical', description: '' }) }}>ANNULER</button>
                  <button className="btn-primary" onClick={addSideGoal}>AJOUTER →</button>
                </div>
              </div>
            )}

            <div className="side-grid">
              {SIDE_CATEGORIES.map(cat => {
                const goals = data.sideGoals.filter(g => g.category === cat.key)
                const Icon = cat.icon
                const doneCount = goals.filter(g => g.done).length
                return (
                  <div key={cat.key} className="side-card" style={{ '--accent': cat.color }}>
                    <div className="side-head">
                      <div className="side-icon-wrap" style={{ background: cat.color }}>
                        <Icon size={16} color="#fff" strokeWidth={2.5} />
                      </div>
                      <div className="side-head-text">
                        <div className="side-title">"{cat.label}"</div>
                        <div className="side-count">{doneCount}/{goals.length} COMPLETED · +25 XP</div>
                      </div>
                    </div>
                    <div className="side-body">
                      {goals.length === 0 ? (
                        <p className="empty-text">— VIDE —</p>
                      ) : (
                        goals.map(g => (
                          <div key={g.id} className={`side-item ${g.done ? 'done' : ''}`}>
                            <button
                              className="obj-check"
                              onClick={() => toggleSideGoal(g.id)}
                              style={g.done ? { background: cat.color, borderColor: cat.color } : {}}
                            >
                              {g.done && <Check size={11} strokeWidth={4} />}
                            </button>
                            <div className="side-item-content">
                              <div className="side-item-title">{g.title}</div>
                              {g.description && <div className="side-item-desc">{g.description}</div>}
                            </div>
                            <button className="obj-delete" onClick={() => deleteSideGoal(g.id)}>
                              <X size={12} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* === MENSUEL === */}
        {tab === 'mensuel' && (
          <section className="section">
            <SectionHeader
              num="05"
              title='"MENSUEL"'
              subtitle="TABLEAU DE BORD"
              color="#00B8D9"
              action={
                <button className="btn-ghost" onClick={archiveMonth}>
                  ARCHIVER LE MOIS →
                </button>
              }
            />

            <div className="monthly-grid">
              <div className="metric-card metric-hero" style={{ '--accent': '#FF4500' }}>
                <div className="metric-tag">"MOIS EN COURS"</div>
                <input
                  type="text"
                  className="metric-input-hero"
                  value={m.month}
                  onChange={e => updateMonthly('month', e.target.value)}
                />
                <div className="metric-hero-deco">
                  <Spade size={140} strokeWidth={1} />
                </div>
                <div className="metric-hero-stripe">
                  <span>"TRACKING" ●</span>
                  <span>SINCE {new Date().getFullYear()}</span>
                </div>
              </div>

              <MetricCard label="SESSIONS" value={m.sessionsPlayed} onChange={v => updateMonthly('sessionsPlayed', Number(v))} color="#3E9E6E" />
              <MetricCard label="HEURES À LA TABLE" value={m.hoursPlayed} onChange={v => updateMonthly('hoursPlayed', Number(v))} color="#C9A84C" />
              <MetricCard label="HEURES D'ÉTUDE" value={m.studyHours} onChange={v => updateMonthly('studyHours', Number(v))} color="#8B7FCC" />
              <MetricCard label="BANKROLL DÉBUT (€)" value={m.bankrollStart} onChange={v => updateMonthly('bankrollStart', Number(v))} color="#5A8FA8" />
              <MetricCard label="BANKROLL FIN (€)" value={m.bankrollEnd} onChange={v => updateMonthly('bankrollEnd', Number(v))} color="#C9A84C" />

              <div className={`metric-card metric-result ${netResult >= 0 ? 'positive' : 'negative'}`}>
                <div className="metric-tag">"RÉSULTAT NET"</div>
                <div className="metric-big">
                  {netResult >= 0 ? '+' : ''}{netResult.toLocaleString('fr-FR')}€
                </div>
                <div className="metric-hourly">
                  <span>→</span> TAUX HORAIRE : {hourly} €/H
                </div>
              </div>
            </div>

            <PerformanceChart history={data.monthlyHistory} current={m} />

            <div className="notes-card">
              <div className="notes-tag">"NOTES DU MOIS" ●</div>
              <textarea
                className="notes-textarea"
                value={m.notes}
                onChange={e => updateMonthly('notes', e.target.value)}
                placeholder="MAINS MARQUANTES, PATTERNS, LEAKS DÉTECTÉS, ÉTAT MENTAL, LECTURES..."
                rows={8}
              />
            </div>

            {data.monthlyHistory.length > 0 && (
              <div className="history">
                <h3 className="history-title">"HISTORIQUE" — ARCHIVED</h3>
                <div className="history-list">
                  {data.monthlyHistory.map((h, i) => {
                    const n = (Number(h.bankrollEnd) || 0) - (Number(h.bankrollStart) || 0)
                    return (
                      <div key={i} className="history-card">
                        <div className="history-month">{h.month}</div>
                        <div className="history-stats">
                          <span>{h.sessionsPlayed} SESSIONS</span>
                          <span>{h.hoursPlayed}H</span>
                          <span className={n >= 0 ? 'pos' : 'neg'}>{n >= 0 ? '+' : ''}{n.toLocaleString('fr-FR')}€</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* === ANALYSE HH === */}
        {tab === 'hh' && (
          <section className="section">
            <SectionHeader
              num="06"
              title='"ANALYSE HH"'
              subtitle="SESSIONS SPIN & GO — BETCLIC"
              color="#C9A84C"
              action={hhView === 'detail' && (
                <button className="btn-ghost" onClick={() => setHhView('list')}>← RETOUR</button>
              )}
            />

            {hhView === 'list' && (
              <div className="hh-wrap">
                <label className="hh-dropzone" htmlFor="hh-file">
                  <span className="hh-drop-icon">▲</span>
                  <div className="hh-drop-title">IMPORTER FICHIER HH</div>
                  <div className="hh-drop-sub">Format Betclic .txt — Spin &amp; Go</div>
                  {hhProcessing && <div className="hh-drop-loading">ANALYSE EN COURS...</div>}
                  <input id="hh-file" type="file" accept=".txt" style={{ display: 'none' }} onChange={handleHHImport} />
                </label>
                {hhError && <div className="hh-error">{hhError}</div>}

                {!(data.hhSessions || []).length ? (
                  <div className="hh-empty">
                    <div className="hh-empty-icon">◈</div>
                    <div className="hh-empty-text">"AUCUNE SESSION IMPORTÉE"</div>
                  </div>
                ) : (
                  <div className="hh-session-list">
                    <div className="hh-list-title">SESSIONS ARCHIVÉES — {(data.hhSessions || []).length}</div>
                    {[...(data.hhSessions || [])].reverse().map((s, ri) => {
                      const idx = (data.hhSessions.length - 1) - ri
                      return (
                        <div key={idx} className="hh-session-card" onClick={() => { setHhSelectedIdx(idx); setHhView('detail') }}>
                          <div className="hh-sc-left">
                            <div className="hh-sc-date">{new Date(s.importedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                            <div className="hh-sc-meta">{s.totalTournaments} TOURNOIS · {s.totalHands} MAINS · {s.allinSpots} ALL-INS</div>
                          </div>
                          <div className="hh-sc-right">
                            <div className={`hh-sc-result ${s.netResult >= 0 ? 'hh-pos' : 'hh-neg'}`}>{s.netResult >= 0 ? '+' : ''}{s.netResult.toFixed(2)}€</div>
                            <div className={`hh-sc-cev ${(s.evEur ?? s.cevDiff ?? 0) >= 0 ? 'hh-pos' : 'hh-neg'}`}>EV {(s.evEur ?? s.cevDiff ?? 0) >= 0 ? '+' : ''}{(s.evEur ?? s.cevDiff ?? 0).toFixed(2)}€</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {hhView === 'detail' && hhSelectedIdx !== null && (data.hhSessions || [])[hhSelectedIdx] && (
              <HHDetail
                session={(data.hhSessions || [])[hhSelectedIdx]}
                onDelete={() => {
                  const updated = (data.hhSessions || []).filter((_, i) => i !== hhSelectedIdx)
                  saveData({ ...data, hhSessions: updated })
                  setHhView('list')
                  setHhSelectedIdx(null)
                }}
              />
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="footer-stripe">
          {Array(6).fill(0).map((_, i) => (
            <span key={i}>"POKER JOURNAL" ●&nbsp;&nbsp;</span>
          ))}
        </div>
        <div className="footer-bottom">
          <span>"DISCIPLINE"</span>
          <span>●</span>
          <span>PERFORMANCE</span>
          <span>●</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  )
}

function HHDetail({ session: s, onDelete }) {
  const e = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '€'
  const ch = v => (v >= 0 ? '+' : '') + Math.round(v)
  const evEur = s.evEur ?? s.cevDiff ?? 0
  const evChips = s.evChips ?? 0
  const chipEvT = s.chipEvPerTourn ?? (s.totalTournaments ? evChips / s.totalTournaments : 0)

  return (
    <div className="hh-detail">
      {/* Summary bar — mirrors the reference software top row */}
      <div className="hh-summary-bar">
        <div className="hh-sum-cell">
          <div className="hh-sum-label">TOURNOIS</div>
          <div className="hh-sum-val">{s.totalTournaments}</div>
        </div>
        <div className="hh-sum-cell">
          <div className="hh-sum-label">EV (€)</div>
          <div className={`hh-sum-val ${evEur >= 0 ? 'hh-pos' : 'hh-neg'}`}>{e(evEur)}</div>
        </div>
        <div className="hh-sum-cell">
          <div className="hh-sum-label">EV CHIPS</div>
          <div className={`hh-sum-val ${evChips >= 0 ? 'hh-pos' : 'hh-neg'}`}>{ch(evChips)}</div>
        </div>
        <div className="hh-sum-cell">
          <div className="hh-sum-label">EV/TOURNOI</div>
          <div className={`hh-sum-val ${chipEvT >= 0 ? 'hh-pos' : 'hh-neg'}`}>{chipEvT >= 0 ? '+' : ''}{chipEvT.toFixed(1)}</div>
        </div>
        <div className="hh-sum-cell">
          <div className="hh-sum-label">NET WON</div>
          <div className={`hh-sum-val ${s.netResult >= 0 ? 'hh-pos' : 'hh-neg'}`}>{e(s.netResult)}</div>
        </div>
        <div className="hh-sum-cell">
          <div className="hh-sum-label">WIN RATE</div>
          <div className="hh-sum-val">{(s.winRate * 100).toFixed(1)}%</div>
        </div>
        <div className="hh-sum-cell">
          <div className="hh-sum-label">MAINS</div>
          <div className="hh-sum-val">{s.totalHands}</div>
        </div>
        <div className="hh-sum-cell">
          <div className="hh-sum-label">ALL-INS</div>
          <div className="hh-sum-val">{s.allinSpots}</div>
        </div>
      </div>

      {/* Per-tournament table */}
      {s.tournaments?.length > 0 && (
        <div className="hh-tourns">
          <div className="hh-tbl-wrap">
            <table className="hh-tbl">
              <thead>
                <tr>
                  <th>STAKE</th>
                  <th>POOL</th>
                  <th className="right">NET WON</th>
                  <th className="right">EV (€)</th>
                  <th className="right">EV CHIPS</th>
                  <th className="right">MAINS</th>
                  <th className="right">ALLIN</th>
                </tr>
              </thead>
              <tbody>
                {s.tournaments.map((t, i) => {
                  const tEvEur = t.evEur ?? t.cevDiff ?? 0
                  const tEvCh = t.evChips ?? 0
                  const net = t.heroWon ? t.heroPrize - t.buyIn : -t.buyIn
                  return (
                    <tr key={i} className={t.heroWon ? 'won' : ''}>
                      <td>{t.buyIn.toFixed(0)}€</td>
                      <td><span className="hh-mul">x{t.multiplier}</span> {t.prizePool.toFixed(0)}€</td>
                      <td className={`right ${net >= 0 ? 'hh-pos' : 'hh-neg'}`}>{e(net)}</td>
                      <td className={`right ${tEvEur >= 0 ? 'hh-pos' : 'hh-neg'}`}>{t.allinSpots > 0 ? e(tEvEur) : '—'}</td>
                      <td className={`right ${tEvCh >= 0 ? 'hh-pos' : 'hh-neg'}`}>{t.allinSpots > 0 ? ch(tEvCh) : '—'}</td>
                      <td className="right dim">{t.handCount}</td>
                      <td className="right dim">{t.allinSpots}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button className="hh-delete-btn" onClick={onDelete}>SUPPRIMER CETTE SESSION</button>
    </div>
  )
}

function SectionHeader({ num, title, subtitle, color, action }) {
  return (
    <div className="section-header" style={{ '--accent': color }}>
      <div className="section-header-left">
        <div className="section-num">[{num}]</div>
        <div>
          <h2 className="section-title">{title}</h2>
          <div className="section-sub">→ {subtitle}</div>
        </div>
      </div>
      {action}
    </div>
  )
}

function PerformanceChart({ history, current }) {
  const allMonths = [...history].reverse()
  if (Number(current.bankrollEnd) > 0 || Number(current.bankrollStart) > 0) {
    allMonths.push(current)
  }

  if (allMonths.length < 2) {
    return (
      <div className="chart-wrap chart-empty">
        <div className="chart-empty-inner">
          <span className="chart-empty-icon">◈</span>
          <p>"GRAPHIQUE DISPONIBLE DÈS LE 2ÈME MOIS ARCHIVÉ"</p>
        </div>
      </div>
    )
  }

  const W = 800
  const H = 220
  const PAD = { top: 32, right: 24, bottom: 44, left: 60 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const bankrolls = allMonths.map(m => Number(m.bankrollEnd) || Number(m.bankrollStart) || 0)
  const minBR = Math.min(...bankrolls)
  const maxBR = Math.max(...bankrolls)
  const rangeBR = maxBR - minBR || 1

  const toX = i => PAD.left + (i / (allMonths.length - 1)) * chartW
  const toY = v => PAD.top + chartH - ((v - minBR) / rangeBR) * chartH

  const linePath = bankrolls.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${toX(bankrolls.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`

  const nets = allMonths.map(m => (Number(m.bankrollEnd) || 0) - (Number(m.bankrollStart) || 0))
  const maxAbsNet = Math.max(...nets.map(Math.abs), 1)

  const BAR_H = 72
  const BAR_PAD = { top: 18, bottom: 14, left: 60, right: 24 }
  const barChartH = BAR_H + BAR_PAD.top + BAR_PAD.bottom
  const barW = Math.max(6, (chartW / allMonths.length) * 0.55)
  const barMidY = BAR_PAD.top + BAR_H / 2

  const ticks = Array.from({ length: 5 }, (_, i) => minBR + (rangeBR * i) / 4)

  const monthLabel = (m) => {
    const parts = (m.month || '').split(' ')
    return parts[0] ? parts[0].slice(0, 3).toUpperCase() : `M${allMonths.indexOf(m) + 1}`
  }

  return (
    <div className="chart-wrap">
      <div className="chart-header">
        <div>
          <span className="chart-title">"PERFORMANCE"</span>
          <span className="chart-title-sub"> BANKROLL & RÉSULTATS MENSUELS</span>
        </div>
        <div className="chart-legend">
          <span className="legend-dot pos" /><span>POSITIF</span>
          <span className="legend-dot neg" /><span>NÉGATIF</span>
          <span className="legend-dot br" /><span>BANKROLL</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
        <text x={PAD.left} y={PAD.top - 12} fontSize="9" fontFamily="'JetBrains Mono',monospace" fill="#888" fontWeight="700" letterSpacing="2">BANKROLL (€)</text>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={toY(t).toFixed(1)} x2={W - PAD.right} y2={toY(t).toFixed(1)} stroke="#EAEAE6" strokeWidth="1" />
            <text x={PAD.left - 8} y={toY(t)} textAnchor="end" dominantBaseline="middle" fontSize="9" fontFamily="'JetBrains Mono',monospace" fill="#999" fontWeight="500">
              {Math.abs(t) >= 1000 ? `${(t / 1000).toFixed(1)}k` : Math.round(t)}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="#C9A84C" fillOpacity="0.07" />
        <path d={linePath} fill="none" stroke="#C9A84C" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {bankrolls.map((v, i) => (
          <g key={i}>
            <circle cx={toX(i).toFixed(1)} cy={toY(v).toFixed(1)} r="5" fill="#fff" stroke="#C9A84C" strokeWidth="2" />
            <circle cx={toX(i).toFixed(1)} cy={toY(v).toFixed(1)} r="2" fill="#C9A84C" />
            <text x={toX(i).toFixed(1)} y={PAD.top + chartH + 16} textAnchor="middle" fontSize="9" fontFamily="'JetBrains Mono',monospace" fill="#666" fontWeight="500">
              {monthLabel(allMonths[i])}
            </text>
          </g>
        ))}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke="#1A1A1A" strokeWidth="1.5" />
        <line x1={PAD.left} y1={PAD.top + chartH} x2={W - PAD.right} y2={PAD.top + chartH} stroke="#1A1A1A" strokeWidth="1.5" />
      </svg>

      <svg viewBox={`0 0 ${W} ${barChartH}`} className="chart-svg chart-bars" preserveAspectRatio="xMidYMid meet">
        <text x={PAD.left} y={9} fontSize="9" fontFamily="'JetBrains Mono',monospace" fill="#888" fontWeight="700" letterSpacing="2">NET MENSUEL (€)</text>
        <line x1={PAD.left} y1={barMidY} x2={W - PAD.right} y2={barMidY} stroke="#1A1A1A" strokeWidth="1.5" />
        {nets.map((n, i) => {
          const bh = Math.max(2, (Math.abs(n) / maxAbsNet) * (BAR_H / 2 - 6))
          const isPos = n >= 0
          const bx = toX(i) - barW / 2
          const by = isPos ? barMidY - bh : barMidY
          return (
            <g key={i}>
              <rect x={bx.toFixed(1)} y={by.toFixed(1)} width={barW.toFixed(1)} height={bh.toFixed(1)} fill={isPos ? '#4E7A5A' : '#8B3A3A'} opacity="0.88" />
              {Math.abs(n) > 0 && (
                <text x={toX(i).toFixed(1)} y={(isPos ? barMidY - bh - 5 : barMidY + bh + 10).toFixed(1)} textAnchor="middle" fontSize="8" fontFamily="'JetBrains Mono',monospace" fill={isPos ? '#4E7A5A' : '#8B3A3A'} fontWeight="700">
                  {isPos ? '+' : ''}{n}€
                </text>
              )}
            </g>
          )
        })}
        <line x1={PAD.left} y1={0} x2={PAD.left} y2={barChartH} stroke="#1A1A1A" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

function MetricCard({ label, value, onChange, color }) {
  return (
    <div className="metric-card" style={{ '--accent': color }}>
      <div className="metric-tag">{label}</div>
      <input
        type="number"
        className="metric-input"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

const css = `
/* ===== BASE ===== */
.app {
  min-height: 100vh;
  background: #0A0A0F;
  color: #ECECF0;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  position: relative;
  overflow-x: hidden;
}

/* ===== XP BURST ===== */
.xp-burst {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #C9A84C;
  color: #0A0A0F;
  font-weight: 900;
  font-size: 48px;
  letter-spacing: -0.02em;
  padding: 20px 40px;
  border-radius: 4px;
  box-shadow: 0 0 60px rgba(201,168,76,0.6), 0 20px 40px rgba(0,0,0,0.5);
  z-index: 9999;
  pointer-events: none;
  animation: xpPop 1.8s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

@keyframes xpPop {
  0% { transform: translate(-50%, -50%) scale(0.5) rotate(-6deg); opacity: 0; }
  20% { transform: translate(-50%, -50%) scale(1.15) rotate(-2deg); opacity: 1; }
  40% { transform: translate(-50%, -50%) scale(1) rotate(-2deg); opacity: 1; }
  100% { transform: translate(-50%, -150%) scale(0.8) rotate(-2deg); opacity: 0; }
}

/* ===== MARQUEE STRIPE ===== */
.stripe-marquee {
  background: #13131A;
  color: #C9A84C;
  padding: 8px 0;
  overflow: hidden;
  border-bottom: 1px solid #2A2A3A;
}

.stripe-inner {
  display: flex;
  white-space: nowrap;
  animation: marquee 50s linear infinite;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
  font-weight: 500;
  opacity: 0.6;
}

@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

/* ===== HEADER ===== */
.header {
  padding: 32px 40px 0;
  border-bottom: 1px solid #2A2A3A;
  background: #0A0A0F;
  position: relative;
}

.header::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #8B7FCC 0%, #C9A84C 50%, #3E9E6E 100%);
}

.header-top {
  display: flex;
  justify-content: space-between;
  gap: 40px;
  align-items: flex-start;
  padding-top: 24px;
  padding-bottom: 32px;
}

.header-left { flex: 1; min-width: 0; }

.label-strip {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.15em;
  color: #44445A;
}

.zip-tag {
  background: #C9A84C;
  color: #0A0A0F;
  padding: 3px 8px;
  font-weight: 700;
  border-radius: 2px;
}

.zip-tag.alt {
  background: transparent;
  color: #C9A84C;
  border: 1px solid rgba(201,168,76,0.4);
}

.title {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-weight: 900;
  font-size: clamp(48px, 9vw, 120px);
  line-height: 0.85;
  letter-spacing: -0.04em;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: baseline;
  text-transform: uppercase;
}

.title-main {
  color: #ECECF0;
}

.title-slash {
  color: #C9A84C;
  font-weight: 900;
  transform: skewX(-10deg);
  display: inline-block;
}

.title-quote {
  font-size: 0.3em;
  font-weight: 500;
  letter-spacing: 0.02em;
  background: #C9A84C;
  color: #0A0A0F;
  padding: 4px 10px;
  align-self: center;
  margin-left: 8px;
  font-family: 'JetBrains Mono', monospace;
  border-radius: 2px;
}

.subtitle {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  color: #44445A;
  flex-wrap: wrap;
}

.subtitle .dot {
  width: 3px;
  height: 3px;
  background: #44445A;
  border-radius: 50%;
}

.header-right {
  display: flex;
  gap: 16px;
  flex-shrink: 0;
}

/* LEVEL CARD */
.level-card {
  background: #13131A;
  color: #ECECF0;
  padding: 18px 20px;
  border: 1px solid #2A2A3A;
  min-width: 210px;
  position: relative;
  border-radius: 6px;
}

.level-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  color: #C9A84C;
}

.level-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #8888AA;
}

.level-title {
  font-weight: 900;
  font-size: 24px;
  letter-spacing: -0.02em;
  line-height: 1;
  margin-bottom: 16px;
  color: #ECECF0;
}

.level-xp-text {
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.1em;
  color: #44445A;
  margin-bottom: 6px;
}

.level-bar {
  height: 6px;
  background: #1C1C26;
  border-radius: 3px;
  overflow: hidden;
}

.level-fill {
  height: 100%;
  background: linear-gradient(90deg, #A07830, #C9A84C, #E8C46A);
  border-radius: 3px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 0 10px rgba(201,168,76,0.5);
}

.level-fill::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: shimmer 2s linear infinite;
  border-radius: 3px;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* PROGRESS CARD */
.progress-card {
  background: #13131A;
  color: #ECECF0;
  padding: 18px 20px;
  border: 1px solid #2A2A3A;
  min-width: 160px;
  position: relative;
  border-radius: 6px;
  overflow: hidden;
}

.progress-card::before {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #C9A84C, transparent);
}

.progress-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin-bottom: 8px;
  color: #8888AA;
}

.progress-num {
  font-weight: 900;
  font-size: 56px;
  letter-spacing: -0.04em;
  line-height: 0.9;
  color: #C9A84C;
}

.progress-num span {
  font-size: 24px;
  margin-left: 2px;
  color: #44445A;
}

.progress-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  margin-top: 6px;
  color: #44445A;
}

/* ===== TABS ===== */
.tabs {
  display: flex;
  gap: 0;
  overflow-x: auto;
  border-top: 1px solid #2A2A3A;
  margin: 0 -40px;
  padding: 0 40px;
  background: #0A0A0F;
}

.tab {
  background: transparent;
  border: none;
  padding: 14px 20px 14px 0;
  margin-right: 28px;
  cursor: pointer;
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  position: relative;
  color: #44445A;
  transition: color 0.15s;
  white-space: nowrap;
}

.tab:hover { color: #8888AA; }

.tab-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.12em;
}

.tab-label {
  font-size: 14px;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.tab-active {
  color: #ECECF0;
}

.tab-active::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 20px;
  height: 2px;
  background: #C9A84C;
  box-shadow: 0 0 8px rgba(201,168,76,0.6);
}

/* ===== MAIN ===== */
.main {
  padding: 48px 40px 80px;
  min-height: 60vh;
  background: #0A0A0F;
}

.section {
  animation: slideIn 0.4s cubic-bezier(0.2, 0.8, 0.3, 1);
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* SECTION HEADER */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 40px;
  gap: 24px;
  flex-wrap: wrap;
  padding-bottom: 20px;
  border-bottom: 1px solid #2A2A3A;
  position: relative;
}

.section-header::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 80px;
  height: 2px;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.section-header-left {
  display: flex;
  gap: 20px;
  align-items: flex-end;
}

.section-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--accent);
  padding-bottom: 10px;
  opacity: 0.6;
}

.section-title {
  font-weight: 900;
  font-size: clamp(32px, 5vw, 56px);
  letter-spacing: -0.03em;
  line-height: 0.95;
  text-transform: uppercase;
  color: #ECECF0;
}

.section-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  color: #44445A;
  margin-top: 6px;
}

/* BUTTONS */
.btn-primary, .btn-ghost {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-weight: 900;
  font-size: 12px;
  letter-spacing: 0.05em;
  padding: 10px 18px;
  border: 1px solid #2A2A3A;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  white-space: nowrap;
  text-transform: uppercase;
  border-radius: 3px;
}

.btn-primary {
  background: #C9A84C;
  color: #0A0A0F;
  border-color: #C9A84C;
}

.btn-primary:hover {
  background: #E8C46A;
  border-color: #E8C46A;
  box-shadow: 0 0 20px rgba(201,168,76,0.3);
  transform: translateY(-1px);
}

.btn-ghost {
  background: transparent;
  color: #8888AA;
  border-color: #2A2A3A;
}

.btn-ghost:hover {
  background: #1C1C26;
  color: #ECECF0;
  border-color: #C9A84C;
  transform: translateY(-1px);
}

.btn-icon {
  width: 28px;
  height: 28px;
  padding: 0;
  background: #1C1C26;
  border: 1px solid #2A2A3A;
  color: #8888AA;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  border-radius: 3px;
}

.btn-icon:hover {
  background: #C9A84C;
  color: #0A0A0F;
  border-color: #C9A84C;
}

.btn-icon.problem-toggle[data-resolved="true"] {
  background: #3E9E6E;
  color: #fff;
  border-color: #3E9E6E;
}

/* FORM */
.form-card {
  background: #13131A;
  border: 1px solid #2A2A3A;
  padding: 28px;
  margin-bottom: 32px;
  position: relative;
  border-radius: 6px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
}

.form-tag {
  position: absolute;
  top: -12px;
  left: 20px;
  background: #C9A84C;
  color: #0A0A0F;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  padding: 4px 10px;
  border-radius: 2px;
}

.form-row { margin-bottom: 18px; }

.form-row label {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  margin-bottom: 8px;
  text-transform: uppercase;
  color: #8888AA;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 500;
  background: #0A0A0F;
  border: 1px solid #2A2A3A;
  color: #ECECF0;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  border-radius: 3px;
}

.form-textarea {
  resize: vertical;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  line-height: 1.5;
  text-transform: none;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #C9A84C;
  box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #2A2A3A;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 8px 14px;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.05em;
  background: #1C1C26;
  border: 1px solid #2A2A3A;
  cursor: pointer;
  transition: all 0.15s;
  color: #8888AA;
  text-transform: uppercase;
  border-radius: 3px;
}

.chip:hover {
  background: #242432;
  color: #ECECF0;
  border-color: #C9A84C;
}

.chip-active {
  background: #C9A84C !important;
  color: #0A0A0F !important;
  border-color: #C9A84C !important;
}

/* ===== VISION ===== */
.vision-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.vision-card {
  background: #13131A;
  border: 1px solid #2A2A3A;
  position: relative;
  transition: all 0.25s;
  border-radius: 6px;
  overflow: hidden;
}

.vision-card:hover {
  border-color: var(--accent);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  transform: translateY(-3px);
}

.vision-card-stripe {
  background: var(--accent);
  color: #0A0A0F;
  padding: 6px 14px;
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.vision-card-body {
  padding: 20px;
}

.vision-card-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.15em;
  color: #44445A;
  margin-bottom: 4px;
}

.vision-card-big {
  font-weight: 900;
  font-size: 48px;
  letter-spacing: -0.04em;
  line-height: 0.9;
  margin-bottom: 16px;
  color: #ECECF0;
}

.vision-card-bar {
  height: 4px;
  background: #1C1C26;
  border-radius: 2px;
  overflow: hidden;
}

.vision-card-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 6px var(--accent);
}

.vision-card-meta {
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  margin: 8px 0 16px;
  color: #8888AA;
}

.vision-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid #1E1E2A;
}

.vision-list li {
  display: flex;
  gap: 10px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
  align-items: flex-start;
  color: #ECECF0;
}

.vision-bullet {
  color: var(--accent);
  font-family: 'JetBrains Mono', monospace;
  flex-shrink: 0;
  font-weight: 900;
}

.vision-list li.done {
  color: #44445A;
  text-decoration: line-through;
}

.vision-list li.more {
  color: var(--accent);
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  padding-left: 20px;
}

.vision-add {
  margin-top: 14px;
  padding: 10px;
  width: 100%;
  background: transparent;
  border: 1px dashed #2A2A3A;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.2s;
  color: #44445A;
  border-radius: 3px;
  text-transform: uppercase;
}

.vision-add:hover {
  background: var(--accent);
  color: #0A0A0F;
  border-style: solid;
  border-color: var(--accent);
}

/* ===== HORIZONS GRID ===== */
.horizons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.horizon-card {
  background: #13131A;
  border: 1px solid #2A2A3A;
  padding: 22px;
  position: relative;
  transition: all 0.25s;
  border-radius: 6px;
  overflow: hidden;
}

.horizon-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: var(--accent);
  box-shadow: 0 2px 8px var(--accent);
}

.horizon-card:hover {
  border-color: var(--accent);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  transform: translateY(-2px);
}

.horizon-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 12px;
}

.horizon-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--accent);
  opacity: 0.6;
}

.horizon-label {
  font-weight: 900;
  font-size: 28px;
  letter-spacing: -0.03em;
  line-height: 1;
  margin-top: 2px;
  color: #ECECF0;
}

.horizon-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.12em;
  color: #44445A;
  margin-top: 2px;
}

.horizon-xp {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  background: rgba(201,168,76,0.1);
  color: #C9A84C;
  padding: 4px 8px;
  display: inline-block;
  margin-bottom: 16px;
  border-radius: 2px;
  border: 1px solid rgba(201,168,76,0.2);
}

.horizon-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.obj-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: #0A0A0F;
  border: 1px solid #1E1E2A;
  transition: all 0.15s;
  border-radius: 3px;
}

.obj-item:hover {
  background: #1C1C26;
  border-color: #2A2A3A;
  transform: translateX(-2px);
}

.obj-done { opacity: 0.4; }

.obj-check {
  width: 18px;
  height: 18px;
  border: 1.5px solid #2A2A3A;
  background: #1C1C26;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
  color: #0A0A0F;
  padding: 0;
  transition: all 0.15s;
  border-radius: 3px;
}

.obj-check:hover {
  border-color: var(--accent);
  transform: scale(1.1);
}

.obj-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 500;
  color: #ECECF0;
}

.obj-done .obj-text { text-decoration: line-through; }

.obj-delete {
  opacity: 0;
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #44445A;
}

.obj-item:hover .obj-delete { opacity: 1; }

.obj-delete:hover { color: #C45A5A; }

.empty-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.15em;
  color: #44445A;
  text-align: center;
  padding: 12px;
}

/* ===== PROBLEMS ===== */
.problems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.problem-card {
  background: #13131A;
  border: 1px solid #2A2A3A;
  padding: 22px;
  position: relative;
  transition: all 0.25s;
  border-radius: 6px;
  overflow: hidden;
}

.problem-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 3px;
  background: #C9A84C;
  opacity: 0.5;
}

.problem-card.resolved::before {
  background: #3E9E6E;
  opacity: 0.8;
}

.problem-card:hover {
  border-color: #C9A84C;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  transform: translateY(-2px);
}

.problem-tag {
  position: absolute;
  top: 14px;
  right: 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.15em;
  padding: 3px 8px;
  background: rgba(201,168,76,0.1);
  color: #C9A84C;
  border: 1px solid rgba(201,168,76,0.2);
  border-radius: 2px;
}

.resolved .problem-tag {
  background: rgba(62,158,110,0.1);
  color: #3E9E6E;
  border-color: rgba(62,158,110,0.2);
}

.problem-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding-left: 14px;
  padding-right: 70px;
}

.problem-title {
  font-weight: 900;
  font-size: 18px;
  letter-spacing: -0.02em;
  line-height: 1.2;
  text-transform: uppercase;
  color: #ECECF0;
}

.problem-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.problem-block {
  margin-top: 12px;
  margin-left: 14px;
  padding: 12px 14px;
  background: #0A0A0F;
  border: 1px solid #1E1E2A;
  border-radius: 3px;
}

.solution-block {
  background: rgba(201,168,76,0.05);
  border-color: rgba(201,168,76,0.2);
}

.problem-block-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.15em;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #8888AA;
}

.problem-block p {
  font-size: 13px;
  line-height: 1.5;
  font-weight: 500;
  color: #ECECF0;
}

.problem-xp {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.15em;
  background: rgba(201,168,76,0.1);
  color: #C9A84C;
  padding: 4px 8px;
  display: inline-block;
  margin-top: 14px;
  margin-left: 14px;
  border-radius: 2px;
}

.empty-state {
  grid-column: 1 / -1;
  padding: 80px 40px;
  text-align: center;
  background: #13131A;
  border: 1px dashed #2A2A3A;
  border-radius: 6px;
}

.empty-state p {
  font-weight: 900;
  font-size: 18px;
  letter-spacing: -0.02em;
  margin: 16px 0 8px;
  color: #8888AA;
}

.empty-state span {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  background: rgba(201,168,76,0.1);
  color: #C9A84C;
  padding: 4px 10px;
  display: inline-block;
  border-radius: 2px;
}

/* ===== SIDE GOALS ===== */
.side-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.side-card {
  background: #13131A;
  border: 1px solid #2A2A3A;
  padding: 22px;
  transition: all 0.25s;
  border-radius: 6px;
}

.side-card:hover {
  border-color: var(--accent);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  transform: translateY(-2px);
}

.side-head {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid #1E1E2A;
}

.side-icon-wrap {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
}

.side-head-text { flex: 1; min-width: 0; }

.side-title {
  font-weight: 900;
  font-size: 16px;
  letter-spacing: -0.01em;
  line-height: 1.1;
  color: #ECECF0;
}

.side-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #44445A;
  margin-top: 4px;
}

.side-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.side-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  background: #0A0A0F;
  border: 1px solid #1E1E2A;
  transition: all 0.15s;
  border-radius: 3px;
}

.side-item:hover {
  background: #1C1C26;
  border-color: #2A2A3A;
  transform: translateX(-2px);
}

.side-item.done { opacity: 0.4; }

.side-item-content { flex: 1; min-width: 0; }

.side-item-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
  color: #ECECF0;
}

.side-item.done .side-item-title { text-decoration: line-through; }

.side-item-desc {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #44445A;
  margin-top: 3px;
  letter-spacing: 0.02em;
}

/* ===== MONTHLY ===== */
.monthly-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.metric-card {
  background: #13131A;
  border: 1px solid #2A2A3A;
  padding: 18px;
  position: relative;
  transition: all 0.25s;
  border-radius: 6px;
  overflow: hidden;
}

.metric-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 40%;
  height: 2px;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.metric-card:hover {
  border-color: var(--accent);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  transform: translateY(-2px);
}

.metric-hero {
  grid-column: span 2;
  grid-row: span 2;
  background: #13131A;
  color: #ECECF0;
  padding: 28px;
  overflow: hidden;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  border: 1px solid #2A2A3A;
  border-radius: 6px;
}

.metric-hero::before {
  background: linear-gradient(90deg, #C9A84C, transparent);
  height: 2px;
  width: 100%;
  box-shadow: none;
}

.metric-hero-deco {
  position: absolute;
  top: 30px;
  right: -20px;
  color: rgba(201,168,76,0.05);
  transform: rotate(-15deg);
  pointer-events: none;
}

.metric-hero-stripe {
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #C9A84C;
  z-index: 2;
  position: relative;
  opacity: 0.6;
}

.metric-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.15em;
  margin-bottom: 10px;
  color: #44445A;
}

.metric-hero .metric-tag {
  color: #C9A84C;
  opacity: 0.7;
}

.metric-input {
  width: 100%;
  padding: 0;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-weight: 900;
  font-size: 40px;
  letter-spacing: -0.04em;
  background: transparent;
  border: none;
  color: #ECECF0;
}

.metric-input:focus { outline: none; color: var(--accent); }

.metric-input-hero {
  width: 100%;
  padding: 0;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-weight: 900;
  font-size: clamp(40px, 5vw, 72px);
  letter-spacing: -0.04em;
  background: transparent;
  border: none;
  color: #ECECF0;
  text-transform: uppercase;
  z-index: 2;
  position: relative;
  line-height: 0.9;
}

.metric-input-hero:focus { outline: none; color: #C9A84C; }

.metric-result {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.metric-result.positive {
  background: rgba(62,158,110,0.08);
  border-color: rgba(62,158,110,0.3);
  --accent: #3E9E6E;
}
.metric-result.positive .metric-tag { color: #3E9E6E; }
.metric-result.positive::before { background: #3E9E6E; box-shadow: 0 0 8px #3E9E6E; }

.metric-result.negative {
  background: rgba(196,90,90,0.08);
  border-color: rgba(196,90,90,0.3);
  --accent: #C45A5A;
}
.metric-result.negative .metric-tag { color: #C45A5A; }
.metric-result.negative::before { background: #C45A5A; box-shadow: 0 0 8px #C45A5A; }

.metric-big {
  font-weight: 900;
  font-size: 44px;
  letter-spacing: -0.04em;
  line-height: 1;
  color: #ECECF0;
}

.metric-result.positive .metric-big { color: #3E9E6E; }
.metric-result.negative .metric-big { color: #C45A5A; }

.metric-hourly {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-top: 10px;
  color: #8888AA;
}

/* NOTES */
/* ===== PERFORMANCE CHART ===== */
.chart-wrap {
  background: #13131A;
  border: 1px solid #2A2A3A;
  padding: 24px 20px 16px;
  margin-bottom: 28px;
  position: relative;
  border-radius: 6px;
}

.chart-wrap.chart-empty {
  padding: 48px 24px;
}

.chart-empty-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #44445A;
}

.chart-empty-icon {
  font-size: 28px;
  color: #C9A84C;
  opacity: 0.4;
}

.chart-empty-inner p {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid #1E1E2A;
}

.chart-title {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-weight: 900;
  font-size: 16px;
  letter-spacing: -0.02em;
  color: #ECECF0;
}

.chart-title-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.1em;
  color: #44445A;
}

.chart-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #44445A;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-dot.pos { background: #3E9E6E; }
.legend-dot.neg { background: #C45A5A; }
.legend-dot.br { background: #C9A84C; }

.chart-svg {
  width: 100%;
  display: block;
}

.chart-bars {
  margin-top: 4px;
  border-top: 1px solid #1E1E2A;
}

.notes-card {
  background: #13131A;
  border: 1px solid #2A2A3A;
  padding: 28px;
  margin-bottom: 40px;
  position: relative;
  border-radius: 6px;
}

.notes-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #5A8FA8, transparent);
  border-radius: 6px 6px 0 0;
}

.notes-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.15em;
  margin-bottom: 16px;
  color: #5A8FA8;
}

.notes-textarea {
  width: 100%;
  padding: 16px;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.6;
  background: #0A0A0F;
  border: 1px solid #1E1E2A;
  color: #ECECF0;
  resize: vertical;
  border-radius: 3px;
}

.notes-textarea:focus {
  outline: none;
  border-color: #5A8FA8;
  box-shadow: 0 0 0 3px rgba(90,143,168,0.1);
}

/* HISTORY */
.history {
  padding-top: 32px;
  border-top: 1px solid #2A2A3A;
}

.history-title {
  font-weight: 900;
  font-size: 24px;
  letter-spacing: -0.02em;
  margin-bottom: 16px;
  text-transform: uppercase;
  color: #8888AA;
}

.history-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.history-card {
  padding: 14px 16px;
  background: #13131A;
  border: 1px solid #2A2A3A;
  border-left: 3px solid #5A8FA8;
  border-radius: 3px;
  transition: all 0.2s;
}

.history-card:hover {
  border-color: #5A8FA8;
  background: #1C1C26;
}

.history-month {
  font-weight: 900;
  font-size: 15px;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  margin-bottom: 8px;
  color: #ECECF0;
}

.history-stats {
  display: flex;
  gap: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  flex-wrap: wrap;
  color: #8888AA;
}

.history-stats .pos { color: #3E9E6E; }
.history-stats .neg { color: #C45A5A; }

/* ===== HH IMPORT ===== */
.hh-wrap { display: flex; flex-direction: column; gap: 24px; }

.hh-dropzone {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 48px 40px; border: 1px dashed #2A2A3A; border-radius: 2px;
  cursor: pointer; transition: all 0.2s; background: #0D0D14;
}
.hh-dropzone:hover { border-color: #C9A84C; background: #13131A; }
.hh-drop-icon { font-size: 28px; color: #C9A84C; }
.hh-drop-title {
  font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700;
  letter-spacing: 0.15em; color: #ECECF0;
}
.hh-drop-sub {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: #44445A; letter-spacing: 0.1em;
}
.hh-drop-loading {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: #C9A84C; letter-spacing: 0.2em; animation: hh-pulse 1s infinite;
}
@keyframes hh-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.hh-error {
  background: #1A0D0D; border: 1px solid #C45A5A; padding: 12px 16px;
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: #C45A5A; letter-spacing: 0.05em;
}

.hh-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 80px 40px; border: 1px solid #1C1C26; background: #0D0D14;
}
.hh-empty-icon { font-size: 32px; color: #2A2A3A; }
.hh-empty-text {
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: #44445A; letter-spacing: 0.15em;
}

.hh-list-title {
  font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700;
  letter-spacing: 0.2em; color: #44445A; padding-bottom: 12px;
  border-bottom: 1px solid #1C1C26;
}
.hh-session-list { display: flex; flex-direction: column; gap: 2px; }
.hh-session-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border: 1px solid #1C1C26; background: #0D0D14;
  cursor: pointer; transition: all 0.2s;
}
.hh-session-card:hover { border-color: #C9A84C; background: #13131A; }
.hh-sc-date {
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;
  color: #ECECF0; letter-spacing: 0.05em;
}
.hh-sc-meta {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: #44445A; letter-spacing: 0.08em; margin-top: 4px;
}
.hh-sc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.hh-sc-result {
  font-family: 'JetBrains Mono', monospace; font-size: 15px;
  font-weight: 900; letter-spacing: -0.02em;
}
.hh-sc-cev {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  font-weight: 700; letter-spacing: 0.05em;
}

.hh-detail { display: flex; flex-direction: column; gap: 24px; }

/* Summary bar */
.hh-summary-bar {
  display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px;
}
.hh-sum-cell {
  background: #0D0D14; border: 1px solid #1C1C26; padding: 16px 12px;
  display: flex; flex-direction: column; gap: 6px;
}
.hh-sum-label {
  font-family: 'JetBrains Mono', monospace; font-size: 8px;
  font-weight: 700; letter-spacing: 0.2em; color: #44445A;
}
.hh-sum-val {
  font-family: 'JetBrains Mono', monospace; font-size: 16px;
  font-weight: 900; letter-spacing: -0.02em; color: #ECECF0;
}

/* Tournament table */
.hh-tbl-wrap { overflow-x: auto; }
.hh-tbl {
  width: 100%; border-collapse: collapse;
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
}
.hh-tbl thead tr {
  border-bottom: 1px solid #2A2A3A;
}
.hh-tbl th {
  padding: 10px 12px; text-align: left; font-size: 9px;
  font-weight: 700; letter-spacing: 0.15em; color: #44445A;
}
.hh-tbl th.right { text-align: right; }
.hh-tbl td {
  padding: 9px 12px; border-bottom: 1px solid #13131A;
  color: #ECECF0; font-weight: 600;
}
.hh-tbl td.right { text-align: right; }
.hh-tbl td.dim { color: #44445A; }
.hh-tbl tr.won td { background: #0D130F; }
.hh-tbl tr:hover td { background: #13131A; }
.hh-mul { color: #C9A84C; font-weight: 700; margin-right: 4px; }

.hh-delete-btn {
  align-self: flex-start; background: none; border: 1px solid #2A2A3A;
  color: #44445A; font-family: 'JetBrains Mono', monospace; font-size: 10px;
  font-weight: 700; letter-spacing: 0.15em; padding: 10px 20px;
  cursor: pointer; transition: all 0.2s;
}
.hh-delete-btn:hover { border-color: #C45A5A; color: #C45A5A; }

.hh-pos { color: #3E9E6E; }
.hh-neg { color: #C45A5A; }

/* ===== FOOTER ===== */
.footer {
  border-top: 1px solid #2A2A3A;
  background: #0A0A0F;
  color: #ECECF0;
}

.footer-stripe {
  background: #13131A;
  border-bottom: 1px solid #2A2A3A;
  padding: 10px 0;
  overflow: hidden;
  white-space: nowrap;
  color: #C9A84C;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2em;
  animation: marquee 30s linear infinite;
  opacity: 0.4;
}

.footer-bottom {
  padding: 24px 40px;
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #44445A;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1100px) {
  .monthly-grid { grid-template-columns: repeat(3, 1fr); }
  .metric-hero { grid-column: span 3; grid-row: span 1; min-height: 200px; }
}

@media (max-width: 900px) {
  .header { padding: 20px; }
  .header-top { flex-direction: column; gap: 24px; }
  .header-right { width: 100%; }
  .level-card, .progress-card { flex: 1; min-width: 0; }
  .main { padding: 32px 20px 60px; }
  .tabs { margin: 0 -20px; padding: 0 20px; }
  .monthly-grid { grid-template-columns: repeat(2, 1fr); }
  .metric-hero { grid-column: span 2; }
  .footer-bottom { padding: 20px; flex-wrap: wrap; }
}

@media (max-width: 600px) {
  .title { font-size: 56px; }
  .monthly-grid { grid-template-columns: 1fr; }
  .metric-hero { grid-column: span 1; }
  .header-right { flex-direction: column; }
  .section-header { flex-direction: column; align-items: flex-start; }
  .section-title { font-size: 40px; }
}
`

/**
 * Pull the vocabulary list (English word – IPA – Vietnamese meaning) out of a lesson PDF.
 *
 * The lesson PDFs have a reading or grammar text with a short list of words below it.
 * Only lines with an IPA transcription are taken as words, so the text above is skipped.
 */

export interface VocabRow {
  word: string
  /** With slashes, like the Sheet: "/əˈbændən/". */
  ipa: string
  pos: string
  meaning: string
  /** False when the row looks doubtful (no Vietnamese meaning): unticked in the preview. */
  sure: boolean
}

/** A piece of text on a PDF page (PDF units, y grows upwards). */
export interface TextBit {
  str: string
  x: number
  y: number
  w: number
  h: number
}

/** Characters used in IPA but never in English or Vietnamese text. */
const IPA_ONLY = /[əɪʊʌæɒɔɑɜːˈˌθðʃʒŋɡʤʧɛɚɝɹɾʔɐɘɵɨʉɫʍ]/
/** Vietnamese letters with diacritics. */
const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
/** Symbol/Wingdings bullets come through as Private Use Area code points (U+F0B7, U+F0D8…). */
const PUA = /[-]/g

const POS_WORDS =
  'phrasal verb|phr\\.?\\s*v|n\\.?\\s*phr|v\\.?\\s*phr|noun|verb|adjective|adverb|preposition|conjunction|pronoun|determiner|idiom|idm|collocation|đgt|trt|pht|dt|đt|tt|phr|adj|adv|prep|conj|pron|det|exp|n|v'
/** "(n)", "(adj.)", "(phr v)", "(idm)", "(đt)"… */
const POS_PAREN = new RegExp(`\\(\\s*(${POS_WORDS})\\s*\\.?\\s*\\)`, 'i')
const POS_PAREN_G = new RegExp(POS_PAREN.source, 'gi')
/** A cell that is only a part of speech: "(v)", "adj", "n.". */
const POS_CELL = new RegExp(`^\\(?\\s*(${POS_WORDS})\\s*\\.?\\s*\\)?$`, 'i')
/** Part of speech at the start of the meaning: "(v): …", "n. …", "adj …", "verb: …". */
const POS_LEAD = new RegExp(
  `^\\s*(?:\\(\\s*(${POS_WORDS})\\s*\\.?\\s*\\)|(${POS_WORDS})\\s*[.:]|(noun|verb|adjective|adverb|adj|adv|prep|conj|pron)(?=\\s))\\s*`,
  'i',
)
/** Part of speech at the end of the word: "abandon v.", "abandon adj". */
const POS_TAIL = /\s+(adj|adv|prep|conj|pron|n\.|v\.)$/i
/** Countability label at the start of the meaning: "[U]", "[C]", "(n, U)", "[uncountable]". */
const COUNT_TAG = /^\s*[[(]\s*(?:(?:(n)\s*,\s*)?(?:C|U|countable|uncountable))\s*[\])]\s*[:.\-–]?\s*/i

/** "/əˈbændən/" or "[əˈbændən]" standing on its own (not "and/or"). */
const DELIMITED = /(^|[\s(:\-–—=|])(\/[^/\n]{1,60}\/|\[[^\]\n]{1,60}\])(?=$|[\s,;:.)\-–—=|])/g

/** Accent labels printed before a transcription: UK, US, BrE, AmE, NAmE (Oxford), Br., Am. */
const VARIANT_LABEL = '(?:N\\.?\\s?Am(?:E|\\.|erican)?|Br(?:E|\\.|itish)?|Am(?:E|\\.|erican)?|UK|US|GA|RP)'
/** What may stand between two transcriptions of one word: "/…/ NAmE /…/", "(UK) /…/ (US) /…/". */
const GLUE = new RegExp(`^[\\s,;|]*(?:or|hoặc|\\(?\\s*${VARIANT_LABEL}\\s*\\)?)?[\\s,;:|.]*$`, 'i')

/** Join mark for a transcription wrapped inside a table cell; settled against the headword. */
const WRAP = ' '

/** Rows whose meaning was cut short by a transcription that had no usable word. */
const DOUBT = new WeakSet<VocabRow>()

interface Part {
  text: string
  ipa: boolean
}

function looksLikeIpa(inner: string, bracket: boolean): boolean {
  if (!inner.trim() || inner !== inner.trim() || VI.test(inner)) return false
  if (!/\p{L}/u.test(inner)) return false
  if (bracket) return IPA_ONLY.test(inner) || /['ˈˌ]/.test(inner)
  return /^[\p{L}ˈˌ'ː:.\s()‿-]+$/u.test(inner)
}

/** One cell → text and IPA parts. */
function splitCell(cell: string): Part[] {
  const parts: Part[] = []
  let at = 0
  for (const m of cell.matchAll(DELIMITED)) {
    const token = m[2]
    if (!looksLikeIpa(token.slice(1, -1), token.startsWith('['))) continue
    const start = m.index! + m[1].length
    if (start > at) parts.push({ text: cell.slice(at, start), ipa: false })
    parts.push({ text: `/${token.slice(1, -1)}/`, ipa: true })
    at = start + token.length
  }
  if (parts.length) {
    if (at < cell.length) parts.push({ text: cell.slice(at), ipa: false })
    return parts
  }

  // No slashes: the first run of tokens with IPA-only characters ("abandon əˈbændən từ bỏ").
  const tokens = cell.split(/(\s+)/)
  const isIpa = (t: string) => IPA_ONLY.test(t) && !VI.test(t)
  const first = tokens.findIndex(isIpa)
  if (first < 0) return [{ text: cell, ipa: false }]
  let last = first
  while (last + 2 < tokens.length && isIpa(tokens[last + 2])) last += 2
  const before = tokens.slice(0, first).join('')
  const after = tokens.slice(last + 1).join('')
  const ipa = tokens.slice(first, last + 1).join('').replace(/^[/[]|[/\]]$/g, '')
  return [
    ...(before.trim() ? [{ text: before, ipa: false }] : []),
    { text: `/${ipa}/`, ipa: true },
    ...(after.trim() ? [{ text: after, ipa: false }] : []),
  ]
}

/** "UK /…/ US /…/", "BrE /…/ NAmE /…/" or "/…/, /…/" become one IPA part. */
function mergeIpa(parts: Part[]): Part[] {
  const out: Part[] = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    const prev = out[out.length - 1]
    if (p.ipa && prev && !prev.ipa && out[out.length - 2]?.ipa && GLUE.test(prev.text)) {
      out.pop()
      out[out.length - 1] = { text: `${out[out.length - 1].text} ${p.text}`, ipa: true }
    } else {
      out.push({ ...p })
    }
  }
  return out
}

/** A cell that holds transcriptions only ("/rent aʊt/", "/ˈwɔːtə(r)/ /ˈwɔːtər/"). */
function isIpaCell(text: string): boolean {
  const p = mergeIpa(splitCell(text))
  return p.some((q) => q.ipa) && p.every((q) => q.ipa || !q.text.trim())
}

/** "(Phr. V.)" → "phr v". */
function normPos(p: string): string {
  return p.replace(/[().]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

function cleanWord(text: string): { word: string; pos: string } {
  let pos = ''
  let w = text.replace(/\s+/g, ' ').trim()
  // Numbering and bullets: "1.", "(2)", "3)", "a.", "b)", "-", "•", Word's Symbol bullet…
  w = w.replace(/^(?:\(?\d+[.)]?\s*|\(?[a-h][.)]\s+|[-–—•*●▪◦·+✓✔➢➤►→-]+\s*)/i, '')
  w = w.replace(POS_PAREN, (_, p: string) => {
    pos = p
    return ' '
  })
  w = w.replace(POS_TAIL, (_, p: string) => {
    pos ||= p
    return ''
  })
  w = w
    .replace(/[\s:：,]+$/, '')
    // Accent label left before the first transcription: "water UK", "water (UK)" (not "join us").
    .replace(/\s+\(?(?:UK|US|BrE|N?AmE|N\.\s?Am\.?|Br\.|Am\.)\)?$/, '')
    .replace(/^[\s:：\-–—=|]+|[\s:：\-–—=|,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { word: w, pos: normPos(pos) }
}

function validWord(w: string): boolean {
  // "Examples: stopped", "Tip: …", "Remember: live" are labels, not headwords.
  if (w.includes(':')) return false
  // A sentence, not a headword: "changes. The -ed ending…", "Exercise 1. Write".
  if (/[.!?]\s+[A-Z]/.test(w)) return false
  return /^[A-Za-z(]/.test(w) && !VI.test(w) && !IPA_ONLY.test(w) && w.length <= 60 && w.split(' ').length <= 7
}

function cleanMeaning(text: string): { meaning: string; pos: string } {
  const LEAD_PUNCT = /^[\s:：\-–—=→>»|,.]+/
  let pos = ''
  let m = text.replace(/\s+/g, ' ').trim().replace(LEAD_PUNCT, '')
  // "(n) [U]: …", "[U] (n): …", "(n, U): …": part of speech and countability in any order.
  for (let k = 0; k < 3; k++) {
    const before = m
    m = m.replace(POS_LEAD, (_, a?: string, b?: string, c?: string) => {
      pos ||= a ?? b ?? c ?? ''
      return ''
    })
    m = m.replace(COUNT_TAG, (_, n?: string) => {
      pos ||= n ?? ''
      return ''
    })
    m = m.replace(LEAD_PUNCT, '').trim()
    if (m === before) break
  }
  return { meaning: m, pos: normPos(pos) }
}

/** Every word entry on one line (two when the list is laid out in two columns). */
export function parseLine(line: string): VocabRow[] {
  const cells = line.split('\t').filter((c) => c.trim())
  const parts = mergeIpa(cells.flatMap(splitCell))
  const ipaAt = parts.flatMap((p, i) => (p.ipa ? [i] : []))
  const rows: VocabRow[] = []
  // Vietnamese text, not counting a part of speech like "(đt)".
  const vi = (p: Part) => VI.test(p.text.replace(POS_PAREN_G, ''))

  // Word – meaning – IPA ("abandon\ttừ bỏ\t/əˈbændən/"): every IPA on the line has the Vietnamese
  // meaning right before it, an English part before that, and nothing Vietnamese right after it.
  const lead =
    ipaAt.length > 0 &&
    ipaAt.every((k, n) => {
      const floor = n === 0 ? 0 : ipaAt[n - 1] + 1
      return k - 2 >= floor && vi(parts[k - 1]) && !vi(parts[k - 2]) && (k + 1 === parts.length || !vi(parts[k + 1]))
    })

  // For each IPA: the English parts just before it are the word; what follows up to the
  // next word is the meaning.
  const wordStart = ipaAt.map((k, n) => {
    const floor = n === 0 ? 0 : ipaAt[n - 1] + 1
    let s = lead ? k - 1 : k
    while (s > floor && !vi(parts[s - 1])) s--
    if (lead) return s
    // Keep at least one part for the previous meaning when it has none yet.
    if (n > 0 && s === floor && k - floor > 1) s++
    return s
  })

  let firstLost = false
  ipaAt.forEach((k, n) => {
    const wordParts = parts.slice(wordStart[n], lead ? k - 1 : k).map((p) => p.text)
    let cellPos = ''
    // "abandon | v | từ bỏ | /…/": the part of speech cell sits between word and meaning.
    if (lead && wordParts.length > 1 && POS_CELL.test(wordParts[wordParts.length - 1].trim())) cellPos = normPos(wordParts.pop()!)
    const { word, pos: wordPos } = cleanWord(wordParts.join(' '))
    const end = n + 1 < ipaAt.length ? wordStart[n + 1] : parts.length
    const after = parts.slice(k + 1, end).map((p) => p.text)
    let pos = wordPos || cellPos
    if ((lead ? after.length > 0 : after.length > 1) && POS_CELL.test(after[0].trim())) pos ||= normPos(after.shift()!)
    if (lead) after.unshift(parts[k - 1].text)
    const m = cleanMeaning(after.join(' '))
    if (!validWord(word)) {
      // A transcription without a usable word (a sound like /t/, IPA inside a note) cut the
      // meaning of the row before it short: untick that row. When the line starts with such a
      // transcription, it is a pronunciation table, not a word list: untick the whole line.
      if (n === 0) firstLost = true
      const prev = rows[rows.length - 1]
      if (prev) {
        prev.sure = false
        DOUBT.add(prev)
      }
      return
    }
    rows.push({ word, ipa: parts[k].text, pos: pos || m.pos, meaning: m.meaning, sure: VI.test(m.meaning) })
  })
  if (firstLost)
    for (const r of rows) {
      r.sure = false
      DOUBT.add(r)
    }
  return rows
}

function startsLower(s: string): boolean {
  const c = s.charAt(0)
  return c !== c.toLocaleUpperCase('vi') || c === '('
}

/** "III. VOCABULARY", "Từ vựng", "C. VOCABULARY TO NOTE – …", "New words". */
const VOCAB_HEAD =
  /^\W*(?:(?:part|phần|section)\s+\w+\W+|[IVX]+[.)]\s*|[A-H][.)]\s*|\d+[.)]\s*)?(?:new\s+words|vocabulary|word\s+list|glossary|từ\s+vựng|từ\s+mới)(?![\p{L}])/iu

/** All word entries in the text lines of a PDF, in order, without duplicates. */
export function extractVocab(lines: string[]): VocabRow[] {
  const rows: VocabRow[] = []
  const lineOf = new Map<VocabRow, number>()
  let last: VocabRow | null = null
  let extra = 0
  let prev = ''
  lines.forEach((raw, li) => {
    // '' = page break: a long meaning may go on at the top of the next page.
    if (!raw.trim()) {
      prev = ''
      return
    }
    let found = parseLine(raw)
    // Word alone on a line, its transcription alone on the next (cards, stacked lists).
    if (!found.length && prev && !prev.includes('\t') && prev.split(/\s+/).length <= 6) {
      const cells = raw.split('\t').filter((c) => c.trim())
      if (cells.length === 1 && isIpaCell(cells[0])) found = parseLine(`${prev}\t${raw}`)
    }
    if (found.length) {
      rows.push(...found)
      for (const r of found) lineOf.set(r, li)
      last = found[found.length - 1]
      if (DOUBT.has(last)) last = null
      extra = 0
      prev = ''
      return
    }
    prev = raw
    if (!last) return
    // A line without IPA right after a word: the meaning, or the rest of a long meaning.
    const text = raw.replace(/\s+/g, ' ').trim()
    // A table row of its own (English word in the first cell, no IPA) is not more meaning.
    const cells = raw.split('\t').filter((c) => c.trim())
    if (cells.length >= 2 && !VI.test(cells[0]) && validWord(cleanWord(cells[0]).word)) {
      last = null
      return
    }
    // The end of a bracket left open, often plain ASCII: "(= catch up" + "with)", "(+" + "to V)".
    const open = (last.meaning.match(/\(/g)?.length ?? 0) > (last.meaning.match(/\)/g)?.length ?? 0)
    if (
      last.meaning &&
      extra < 3 &&
      !IPA_ONLY.test(text) &&
      text.length <= 60 &&
      !/^(ex|e\.g|eg|example|vd|ví dụ)\b/i.test(text) &&
      !/^[a-z\d]{1,2}[.)]\s/i.test(text) &&
      ((open && text.includes(')')) || /^\(\s*[=+≈].*\)$/.test(text))
    ) {
      last.meaning = `${last.meaning} ${text}`
      extra++
      return
    }
    if (!VI.test(text) || IPA_ONLY.test(text) || text.length > 120) {
      last = null
    } else if (!last.meaning) {
      const m = cleanMeaning(text)
      last.meaning = m.meaning
      last.pos ||= m.pos
      last.sure = true
      extra = 1
    } else if (extra < 2 && (/[,;]$/.test(last.meaning) || startsLower(text))) {
      last.meaning = `${last.meaning} ${text}`
      last.sure ||= VI.test(last.meaning)
      extra++
    } else {
      last = null
    }
  })

  // Entry-shaped lines above the vocabulary heading (grammar notes, examples) are left unticked,
  // when the list under the heading is the main one.
  const head = lines.findIndex(
    (l, i) => l.length <= 80 && VOCAB_HEAD.test(l.trim()) && rows.some((r) => lineOf.get(r)! > i && lineOf.get(r)! <= i + 6),
  )
  const ticked = (f: (li: number) => boolean) => rows.filter((r) => r.sure && f(lineOf.get(r)!)).length
  if (head > 0 && ticked((li) => li < head) < ticked((li) => li > head))
    for (const r of rows) if (lineOf.get(r)! < head) r.sure = false

  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = `${r.word.toLowerCase()}|${r.meaning.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

interface Cell {
  text: string
  x: number
  y: number
}
interface Line {
  y: number
  h: number
  cells: Cell[]
}

/** Pieces on the same baseline, top to bottom. */
function baselines(bits: TextBit[]): TextBit[][] {
  const sorted = bits.filter((b) => b.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
  const groups: TextBit[][] = []
  for (const b of sorted) {
    const g = groups[groups.length - 1]
    if (g && Math.abs(g[0].y - b.y) <= Math.max(g[0].h, b.h, 1) * 0.45) g.push(b)
    else groups.push([b])
  }
  return groups
}

/** Pieces on the same baseline → one line; pieces far apart start a new cell. */
function toLines(bits: TextBit[]): Line[] {
  return baselines(bits).map((g) => {
    g.sort((a, b) => a.x - b.x)
    const h = Math.max(...g.map((b) => b.h), 1)
    const cells: Cell[] = [{ text: g[0].str, x: g[0].x, y: g[0].y }]
    for (let i = 1; i < g.length; i++) {
      const a = g[i - 1]
      const b = g[i]
      const gap = b.x - (a.x + a.w)
      const cell = cells[cells.length - 1]
      if (gap > h) cells.push({ text: b.str, x: b.x, y: b.y })
      else cell.text += (gap > h * 0.12 && !/\s$/.test(cell.text) && !/^\s/.test(b.str) ? ' ' : '') + b.str
    }
    for (const c of cells) c.text = c.text.replace(/[  ]+/g, ' ').trim()
    return { y: g[0].y, h, cells }
  })
}

/** How two wrapped pieces of one table cell go back together. */
function joinWrap(s: string, t: string): string {
  if (/(^|\s)[/[]$/.test(s)) return '' // "/" left alone at the end of a line
  if (/\p{L}-$/u.test(s) && /^\p{L}/u.test(t)) return '' // "ni-" + "lông"
  // Inside an open transcription a wrap at a space and a wrap inside a word look the same:
  // leave a mark that is settled against the headword.
  const open = s.lastIndexOf('/')
  const rest = s.slice(open) + t
  if ((s.match(/\//g) ?? []).length % 2 === 1 && IPA_ONLY.test(rest) && !VI.test(rest)) return WRAP
  return ' '
}

/**
 * Tables whose cells wrap onto several lines: put each table row back on one line.
 * A row starts with a line that has a cell in the first column (or a row number); the lines
 * between two row starts are split at the widest vertical gap, cell by cell in the same column.
 */
function joinTableRows(lines: Line[]): Line[] {
  const near = (i: number, j: number) => Math.abs(lines[i].y - lines[j].y) <= 2.5 * Math.max(lines[i].h, lines[j].h)
  const multi = lines.map((l) => l.cells.length >= 2)
  const tableNear = (i: number, j: number) => j >= 0 && j < lines.length && multi[j] && near(i, j)
  // Under a cell other than the first of a table line next to it (a wrapped cell).
  const underColumn = (i: number, j: number) =>
    tableNear(i, j) && lines[j].cells.slice(1).some((c) => Math.abs(c.x - lines[i].cells[0].x) < lines[j].h * 0.6)
  // A transcription alone under the first cell of a table line (word and IPA in one cell).
  const underWord = (i: number, j: number) =>
    tableNear(i, j) &&
    lines[i].cells.length === 1 &&
    Math.abs(lines[j].cells[0].x - lines[i].cells[0].x) < lines[j].h * 0.6 &&
    isIpaCell(lines[i].cells[0].text)
  // A one-cell line inside a table, in a column that only some rows (the header) have on their
  // first line: vertically centred cells whose first line sits above the row number.
  const inColumn = (i: number) => {
    if (multi[i] || lines[i].cells.length !== 1) return false
    const x = lines[i].cells[0].x
    let hit = false
    const sides = [-1, 1].map((dir) => {
      let found = false
      for (let j = i + dir, k = i; j >= 0 && j < lines.length && Math.abs(j - i) <= 6 && near(k, j); k = j, j += dir) {
        if (!multi[j]) continue
        found = true
        if (lines[j].cells.slice(1).some((c) => Math.abs(c.x - x) < lines[j].h * 0.6)) hit = true
      }
      return found
    })
    // Below the last row only right under the line above (a wrapped line, not a new paragraph).
    return hit && sides[0] && (sides[1] || (i > 0 && lines[i - 1].y - lines[i].y <= 1.5 * lines[i].h))
  }
  // A one-cell line between two table lines, or under a column of one, is part of the table.
  const inTable = lines.map(
    (_, i) =>
      multi[i] ||
      (tableNear(i, i - 1) && tableNear(i, i + 1)) ||
      underColumn(i, i - 1) ||
      underColumn(i, i + 1) ||
      underWord(i, i - 1) ||
      inColumn(i),
  )

  const out: Line[] = []
  let i = 0
  while (i < lines.length) {
    if (!inTable[i]) {
      out.push(lines[i++])
      continue
    }
    let j = i
    while (j + 1 < lines.length && inTable[j + 1] && near(j, j + 1)) j++
    const run = lines.slice(i, j + 1)
    i = j + 1
    const tol = Math.max(...run.map((l) => l.h)) * 0.6

    // A line of whole transcriptions under a line of English words, column for column, is a grid
    // of cards (word / IPA / meaning stacked in each): read each column top to bottom.
    const cardLine = (k: number) =>
      k > 0 &&
      run[k].cells.length >= 2 &&
      run[k].cells.every((c) => /^[/[].*[/\]]$/.test(c.text) && isIpaCell(c.text)) &&
      run[k - 1].cells.length === run[k].cells.length &&
      run[k - 1].cells.every((c, n) => Math.abs(c.x - run[k].cells[n].x) < tol && !VI.test(c.text) && !IPA_ONLY.test(c.text))
    if (run.some((_, k) => cardLine(k))) {
      const cols: Cell[][] = []
      for (const l of run)
        for (const c of l.cells) {
          const col = cols.find((k) => Math.abs(k[0].x - c.x) < tol)
          if (col) col.push(c)
          else cols.push([c])
        }
      cols.sort((p, q) => p[0].x - q[0].x)
      for (const col of cols) for (const c of col.sort((p, q) => q.y - p.y)) out.push({ y: c.y, h: run[0].h, cells: [c] })
      continue
    }

    const left = Math.min(...run.flatMap((l) => l.cells.map((c) => c.x)))
    // The IPA under a word in the same cell never starts a row.
    const stacked = (l: Line) => l.cells.length === 1 && Math.abs(l.cells[0].x - left) < tol && isIpaCell(l.cells[0].text)
    // A row number left of column 2 starts a row even when it is centred under a wider "STT".
    const col2 = Math.min(...run.filter((l) => l.cells.length >= 2).map((l) => l.cells[1].x))
    const numbered = (l: Line) => l.cells.length >= 2 && /^\(?\d{1,3}[.)]?$/.test(l.cells[0].text) && l.cells[0].x < col2 - tol
    const anchors = run.filter((l) => !stacked(l) && (l.cells.some((c) => Math.abs(c.x - left) < tol) || numbered(l)))
    if (run.length < 2 || !anchors.length) {
      out.push(...run)
      continue
    }
    const byY = [...anchors].sort((p, q) => q.y - p.y)
    const owner = new Map<Line, Line>()
    // Between two row starts, the row boundary is the widest vertical gap (ties: the upper row,
    // as in top-aligned cells, the Word/LibreOffice default).
    const loose = run.filter((l) => !anchors.includes(l) && !stacked(l))
    for (let k = -1; k < byY.length; k++) {
      const A = byY[k]
      const B = byY[k + 1]
      const mid = loose.filter((l) => (!A || l.y < A.y) && (!B || l.y > B.y)).sort((p, q) => q.y - p.y)
      if (!mid.length) continue
      if (!A || !B) {
        for (const l of mid) owner.set(l, (A ?? B)!)
        continue
      }
      const ys = [A.y, ...mid.map((l) => l.y), B.y]
      const gaps = ys.slice(1).map((y, n) => ys[n] - y)
      const max = Math.max(...gaps)
      let cut = 0
      gaps.forEach((g, n) => {
        if (g >= max - 0.25) cut = n
      })
      mid.forEach((l, n) => owner.set(l, n < cut ? A : B))
    }
    for (const l of run.filter(stacked)) owner.set(l, byY.filter((a) => a.y > l.y).at(-1) ?? byY[0])

    const rows = new Map(anchors.map((a) => [a, [...a.cells]]))
    for (const l of run) if (!rows.has(l)) rows.get(owner.get(l)!)!.push(...l.cells)
    for (const [a, cells] of rows) {
      // Same column = same left edge; within a column, top to bottom.
      const cols: Cell[][] = []
      for (const c of [...cells].sort((p, q) => p.x - q.x)) {
        const col = cols.find((k) => Math.abs(k[0].x - c.x) < tol)
        if (col) col.push(c)
        else cols.push([c])
      }
      cols.sort((p, q) => p[0].x - q[0].x)
      const row: Cell[] = cols.map((col) => {
        col.sort((p, q) => q.y - p.y)
        const text = col.reduce((s, c) => (s ? s + joinWrap(s, c.text) + c.text : c.text), '')
        return { text, x: col[0].x, y: col[0].y }
      })
      // A transcription wrapped inside a word has more sound groups than the headword has words.
      row.forEach((c, k) => {
        if (!c.text.includes(WRAP)) return
        let words = 0
        for (let m = k - 1; m >= 0 && !words; m--) {
          const w = cleanWord(row[m].text).word
          if (validWord(w)) words = w.split(/[\s-]+/).filter(Boolean).length
        }
        const tokens = c.text.trim().split(/\s+/).length
        c.text = c.text.replaceAll(WRAP, words && tokens > words ? '' : ' ')
      })
      out.push({ y: a.y, h: a.h, cells: row })
    }
  }
  return out
}

/**
 * Two-column regions (an empty strip in the middle third of the page on 3+ lines, text on both
 * sides, and list entries with IPA on both sides, or no IPA at all) are read left column first.
 * Tables with IPA in one column are left alone. Returns groups of pieces in reading order.
 */
function splitColumns(bits: TextBit[], x0: number, x1: number): TextBit[][] {
  const groups = baselines(bits)
  if (groups.length < 3) return [bits]
  const lo = x0 + (x1 - x0) * 0.35
  const hi = x0 + (x1 - x0) * 0.65
  const free = (g: TextBit[]) => {
    const iv: [number, number][] = []
    let x = lo
    for (const b of [...g].sort((p, q) => p.x - q.x)) {
      const e = b.x + b.w
      if (e < lo || b.x > hi) continue
      if (b.x > x) iv.push([x, b.x])
      x = Math.max(x, e)
    }
    if (x < hi) iv.push([x, hi])
    return iv
  }
  // A list entry on one side: starts with text that is not a transcription, has IPA after it.
  const entry = (side: TextBit[]) => {
    if (!side.some((b) => IPA_ONLY.test(b.str))) return false
    const first = [...side].sort((p, q) => p.x - q.x)[0].str.trim()
    return !/^[/[]/.test(first) && !IPA_ONLY.test(first.split(/\s/)[0])
  }
  const out: TextBit[][] = []
  let plain: TextBit[] = []
  let i = 0
  while (i < groups.length) {
    const h = Math.max(...groups[i].map((b) => b.h))
    const wide = (iv: [number, number][]) => iv.filter(([a, b]) => b - a >= 1.5 * h)
    let iv = wide(free(groups[i]))
    let j = i
    while (iv.length && j + 1 < groups.length) {
      const next = free(groups[j + 1])
      const n = wide(iv.flatMap(([a, b]) => next.map(([c, d]) => [Math.max(a, c), Math.min(b, d)] as [number, number])))
      if (!n.length) break
      iv = n
      j++
    }
    const run = groups.slice(i, j + 1)
    i = j + 1
    const best = [...iv].sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0]
    if (best && run.length >= 3) {
      const gx = (best[0] + best[1]) / 2
      const sides = run.map((g) => [g.filter((b) => b.x + b.w / 2 < gx), g.filter((b) => b.x + b.w / 2 >= gx)])
      const count = (f: (s: TextBit[][]) => boolean) => sides.filter(f).length
      const both = count(([l, r]) => l.length > 0 && r.length > 0)
      const ipa = count(([l, r]) => [...l, ...r].some((b) => IPA_ONLY.test(b.str)))
      if (both >= 2 && ((count(([l]) => entry(l)) >= 2 && count(([, r]) => entry(r)) >= 2) || !ipa)) {
        if (plain.length) out.push(plain)
        plain = []
        out.push(
          sides.flatMap(([l]) => l),
          sides.flatMap(([, r]) => r),
        )
        continue
      }
    }
    plain.push(...run.flat())
  }
  if (plain.length) out.push(plain)
  return out
}

/**
 * Text pieces of one page → lines, top to bottom. Pieces far apart on the same line
 * (table columns) are separated by a tab; a two-column list is read column by column.
 */
export function linesFromBits(bits: TextBit[], page?: { x0: number; x1: number }): string[] {
  const clean = bits.map((b) => ({ ...b, str: b.str.replace(PUA, ' ') })).filter((b) => b.str.trim())
  if (!clean.length) return []
  const x0 = page?.x0 ?? Math.min(...clean.map((b) => b.x))
  const x1 = page?.x1 ?? Math.max(...clean.map((b) => b.x + b.w))
  return splitColumns(clean, x0, x1).flatMap((bs) => joinTableRows(toLines(bs)).map((l) => l.cells.map((c) => c.text).join('\t')))
}

/** "Trang 3/5", "Page 3 of 5", "- 3 -", "3". */
const PAGE_NO = /^[-–—\s]*(?:(?:trang|page|tr\.|p\.)\s*)?\d+(?:\s*(?:\/|of|trên)\s*\d+)?[-–—\s]*$/i

/**
 * Running headers and footers. In the top or bottom 8% of a page, a whole baseline goes when every
 * piece on it repeats (same text with digits ignored, same place) on 2+ pages, or when it is a
 * page number on the first or last line of the page.
 */
export function dropRunning(pages: { bits: TextBit[]; view: number[] }[]): TextBit[][] {
  const keyOf = (b: TextBit) => `${b.str.trim().replace(/\d+/g, '#').toLowerCase()}@${Math.round(b.x / 4)}@${Math.round(b.y / 2)}`
  const margin = pages.map(({ view: [, y0, , y1] }) => {
    const band = (y1 - y0) * 0.08
    return (b: TextBit) => b.y < y0 + band || b.y > y1 - band
  })
  const seen = new Map<string, number>()
  pages.forEach((pg, p) => {
    for (const k of new Set(pg.bits.filter(margin[p]).map(keyOf))) seen.set(k, (seen.get(k) ?? 0) + 1)
  })
  return pages.map((pg, p) => {
    const inMargin = margin[p]
    const repeated = (b: TextBit) => inMargin(b) && (seen.get(keyOf(b)) ?? 0) >= 2
    const top = Math.max(...pg.bits.map((b) => b.y))
    const bottom = Math.min(...pg.bits.map((b) => b.y))
    const drop = new Set<TextBit>()
    for (const b of pg.bits) {
      if (!inMargin(b)) continue
      const line = pg.bits.filter((o) => Math.abs(o.y - b.y) <= 1)
      if (!line.every(inMargin)) continue
      const text = [...line].sort((q, r) => q.x - r.x).map((o) => o.str).join(' ')
      const outer = Math.abs(b.y - top) <= 1 || Math.abs(b.y - bottom) <= 1
      if (line.every(repeated) || (outer && PAGE_NO.test(text))) drop.add(b)
    }
    return pg.bits.filter((b) => !drop.has(b))
  })
}

/** Text lines of each page of a PDF file. */
export async function pdfPages(data: ArrayBuffer): Promise<string[][]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    const { default: url } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = url
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(data) })
  try {
    const doc = await task.promise
    const pages: { bits: TextBit[]; view: number[] }[] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      const bits: TextBit[] = []
      for (const it of content.items) {
        if (!('str' in it) || !it.str.trim()) continue
        const [, , c, d, x, y] = it.transform as number[]
        bits.push({ str: it.str, x, y, w: it.width, h: it.height || Math.hypot(c, d) })
      }
      pages.push({ bits, view: page.view })
    }
    return dropRunning(pages).map((bits, p) => linesFromBits(bits, { x0: pages[p].view[0], x1: pages[p].view[2] }))
  } finally {
    await task.destroy()
  }
}

/** Text lines of every page of a PDF file (pages separated by an empty line). */
export async function pdfLines(data: ArrayBuffer): Promise<string[]> {
  return (await pdfPages(data)).flatMap((ls) => [...ls, ''])
}

/** Start downloading pdf.js early (e.g. while the user picks a file); errors are ignored. */
export function preloadPdf(): void {
  import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => {})
}

/** 1-based numbers of the pages with almost no text: probably a scanned image. */
export function scannedPages(pages: string[][]): number[] {
  return pages.flatMap((p, i) => (p.join('').replace(/\s/g, '').length < 80 ? [i + 1] : []))
}

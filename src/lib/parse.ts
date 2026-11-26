import { IMPORT_PREFIX } from '../config'
import { answersFor, norm } from './answer'
import type { Deck, Item, RawTab } from './types'

export const IRREGULAR_CHUNK = 20

/** Deck group of the tabs imported from PDFs. */
export const IMPORTED_GROUP = 'Từ PDF'

/** Header key: no diacritics, upper case, single spaces ("Từ vựng" → "TU VUNG"). */
export function headerKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Multi-line cells: "đánh, ⏎thắng" → "đánh, thắng". */
export function cleanMeaning(s: string): string {
  return s
    .split('\n')
    .map((l) => l.trim().replace(/,+$/, '').trim())
    .filter(Boolean)
    .join(', ')
}

function oneLine(s: string): string {
  return s.split('\n').map((l) => l.trim()).filter(Boolean).join(' ')
}

function sentenceCase(s: string): string {
  const t = oneLine(s).toLocaleLowerCase('vi')
  return t.charAt(0).toLocaleUpperCase('vi') + t.slice(1)
}

const cell = (row: string[] | undefined, i: number) => (i >= 0 && row ? (row[i] ?? '').trim() : '')

function findHeader(values: string[][], test: (key: string) => boolean): { row: number; keys: string[] } | null {
  for (let r = 0; r < Math.min(values.length, 10); r++) {
    const keys = values[r].map(headerKey)
    if (keys.some(test)) return { row: r, keys }
  }
  return null
}

class IdMaker {
  private seen = new Map<string, number>()
  make(word: string): string {
    const base = norm(word.split('\n')[0]) || 'item'
    const n = (this.seen.get(base) ?? 0) + 1
    this.seen.set(base, n)
    return n === 1 ? base : `${base}#${n}`
  }
}

function wordItem(ids: IdMaker, word: string, ipa: string, pos: string, meaning: string): Item {
  return {
    id: ids.make(word),
    word: oneLine(word),
    answers: answersFor(word),
    ipa: ipa.trim(),
    pos: oneLine(pos),
    meaning: cleanMeaning(meaning),
  }
}

/** Tabs with columns TỪ VỰNG / CÁCH ĐỌC / LOẠI TỪ / NGHĨA (optionally PHÂN LOẠI). */
function parseWordTab(tab: RawTab, tabIndex: number): Deck[] {
  const h = findHeader(tab.values, (k) => k === 'TU VUNG')
  if (!h) return []
  const col = (k: string) => h.keys.indexOf(k)
  const cWord = col('TU VUNG')
  const cIpa = col('CACH DOC')
  const cPos = col('LOAI TU')
  const cMeaning = col('NGHIA')
  const cGroup = col('PHAN LOAI')

  const name = tab.name.trim()
  if (name.startsWith(IMPORT_PREFIX)) {
    // Imported from a PDF by the app: studied like a session.
    const ids = new IdMaker()
    const items: Item[] = []
    for (const row of tab.values.slice(h.row + 1)) {
      const word = cell(row, cWord)
      if (word) items.push(wordItem(ids, word, cell(row, cIpa), cell(row, cPos), cell(row, cMeaning)))
    }
    const title = name.slice(IMPORT_PREFIX.length).trim() || name
    return [{ id: `S:${name}`, kind: 'session', section: 'vocab', group: IMPORTED_GROUP, title, order: 1000 + tabIndex, items }]
  }

  const session = /^B\s*(\d+)$/i.exec(name)
  if (session) {
    const n = Number(session[1])
    const ids = new IdMaker()
    const items: Item[] = []
    for (const row of tab.values.slice(h.row + 1)) {
      const word = cell(row, cWord)
      if (!word) continue
      items.push(wordItem(ids, word, cell(row, cIpa), cell(row, cPos), cell(row, cMeaning)))
    }
    return [{ id: `S:${tab.name.trim()}`, kind: 'session', section: 'vocab', group: 'Từ vựng', title: `Buổi ${n}`, order: n, items }]
  }

  // Grammar word tab, split by PHÂN LOẠI when present.
  const groups = new Map<string, Item[]>()
  const ids = new Map<string, IdMaker>()
  let current = tab.name.trim()
  for (const row of tab.values.slice(h.row + 1)) {
    const g = cell(row, cGroup)
    if (g) current = sentenceCase(g)
    const word = cell(row, cWord)
    if (!word) continue
    if (!groups.has(current)) {
      groups.set(current, [])
      ids.set(current, new IdMaker())
    }
    groups.get(current)!.push(wordItem(ids.get(current)!, word, cell(row, cIpa), cell(row, cPos), cell(row, cMeaning)))
  }
  return [...groups.entries()].map(([title, items], i) => ({
    id: `G:${tab.name.trim()}:${title}`,
    kind: 'grammar' as const,
    section: 'grammar' as const,
    group: tab.name.trim(),
    title,
    order: tabIndex * 100 + i,
    items,
  }))
}

/** "to V + Ving": groups side by side in column triples (label | word | meaning). */
function parsePatternTab(tab: RawTab, tabIndex: number): Deck[] {
  const width = Math.max(0, ...tab.values.map((r) => r.length))
  const order: string[] = []
  const groups = new Map<string, { items: Item[]; ids: IdMaker; rule: boolean }>()
  const labels: string[] = []
  for (let t = 0; t * 3 + 1 < width; t++) labels.push('')

  for (const row of tab.values) {
    for (let t = 0; t < labels.length; t++) {
      const label = oneLine(cell(row, t * 3))
      const word = cell(row, t * 3 + 1)
      if (label) labels[t] = label
      if (!word || !labels[t]) continue
      const key = labels[t]
      if (!groups.has(key)) {
        groups.set(key, { items: [], ids: new IdMaker(), rule: headerKey(key) === 'DAC BIET' })
        order.push(key)
      }
      const g = groups.get(key)!
      g.items.push(wordItem(g.ids, word, '', '', cell(row, t * 3 + 2)))
    }
  }

  const patternLabels = order.filter((k) => !groups.get(k)!.rule)
  const byWord = new Map<string, string[]>()
  for (const k of patternLabels) {
    for (const it of groups.get(k)!.items) {
      const w = norm(it.answers[0] ?? it.word)
      byWord.set(w, [...(byWord.get(w) ?? []), k])
    }
  }

  return order.map((key, i) => {
    const g = groups.get(key)!
    if (g.rule) {
      return {
        id: `P:${tab.name.trim()}:${key}`,
        kind: 'rule' as const,
        section: 'grammar' as const,
        group: tab.name.trim(),
        title: sentenceCase(key),
        order: tabIndex * 100 + i,
        items: g.items,
      }
    }
    return {
      id: `P:${tab.name.trim()}:${key}`,
      kind: 'pattern' as const,
      section: 'grammar' as const,
      group: tab.name.trim(),
      title: key,
      order: tabIndex * 100 + i,
      patternLabels,
      items: g.items.map((it) => ({ ...it, patterns: byWord.get(norm(it.answers[0] ?? it.word)) ?? [key] })),
    }
  })
}

/** Irregular verbs: Dạng nguyên mẫu | Dạng quá khứ | Dạng quá khứ hoàn thành | Nghĩa. */
function parseIrregularTab(tab: RawTab, tabIndex: number): Deck[] {
  const h = findHeader(tab.values, (k) => k.includes('NGUYEN MAU'))
  if (!h) return []
  const c1 = h.keys.findIndex((k) => k.includes('NGUYEN MAU'))
  const cM = h.keys.indexOf('NGHIA') >= 0 ? h.keys.indexOf('NGHIA') : c1 + 3
  const ids = new IdMaker()
  const all: Item[] = []
  for (const row of tab.values.slice(h.row + 1)) {
    const v1 = cell(row, c1)
    if (!v1) continue
    const v2 = cell(row, c1 + 1)
    const v3 = cell(row, c1 + 2)
    all.push({
      ...wordItem(ids, v1, '', 'verb', cell(row, cM)),
      v2: oneLine(v2),
      v3: oneLine(v3),
    })
  }
  const decks: Deck[] = []
  for (let i = 0; i < all.length; i += IRREGULAR_CHUNK) {
    const items = all.slice(i, i + IRREGULAR_CHUNK)
    const k = i / IRREGULAR_CHUNK + 1
    decks.push({
      id: `I:${tab.name.trim()}:${k}`,
      kind: 'irregular',
      section: 'grammar',
      group: tab.name.trim(),
      title: `Phần ${k}: ${items[0].word} → ${items[items.length - 1].word}`,
      order: tabIndex * 100 + k,
      items,
    })
  }
  return decks
}

function isPatternTab(name: string): boolean {
  return /to\s*v/i.test(name) && /v\s*-?\s*ing/i.test(name)
}

/** Every deck the app can study, from the raw tabs. Tabs that match no rule (e.g. drafts) are ignored. */
export function parseSheet(tabs: RawTab[]): Deck[] {
  const decks: Deck[] = []
  tabs.forEach((tab, i) => {
    if (tab.name.trim().startsWith(IMPORT_PREFIX)) decks.push(...parseWordTab(tab, i + 1))
    else if (isPatternTab(tab.name)) decks.push(...parsePatternTab(tab, i + 1))
    else if (findHeader(tab.values, (k) => k.includes('NGUYEN MAU'))) decks.push(...parseIrregularTab(tab, i + 1))
    else decks.push(...parseWordTab(tab, i + 1))
  })
  return decks.filter((d) => d.items.length > 0).sort((a, b) => a.order - b.order)
}

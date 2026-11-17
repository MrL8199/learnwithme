import { answersFor, isCorrect, isNear, norm } from './answer'
import type { Deck, Item } from './types'

export type Question =
  | { kind: 'mcq'; itemId: string; prompt: string; sub?: string; speak?: string; options: string[]; correct: number }
  | { kind: 'type'; itemId: string; prompt: string; sub?: string; answers: string[]; shown: string }
  | { kind: 'irregular'; itemId: string; prompt: string; sub?: string; v2: string[]; v3: string[]; shown: string }

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick<T>(arr: T[], n: number, rand: () => number): T[] {
  return shuffle(arr, rand).slice(0, n)
}

const hasMeaning = (it: Item) => it.meaning.trim().length > 0

function meaningMcq(it: Item, pool: string[], rand: () => number): Question {
  const right = it.meaning
  const others = [...new Set(pool.filter((m) => norm(m) !== norm(right)))]
  const options = shuffle([right, ...pick(others, 3, rand)], rand)
  return { kind: 'mcq', itemId: it.id, prompt: it.word, sub: it.pos || undefined, speak: it.word, options, correct: options.indexOf(right) }
}

function typing(it: Item, deck: Deck): Question {
  // Items sharing a meaning ("thường xuyên" = usually / frequently) accept each other's words.
  const same = deck.items.filter((x) => norm(x.meaning) === norm(it.meaning))
  return {
    kind: 'type',
    itemId: it.id,
    prompt: it.meaning,
    sub: it.pos || undefined,
    answers: [...new Set(same.flatMap((x) => x.answers))],
    shown: it.word,
  }
}

export function irregularQuestion(it: Item): Question {
  return {
    kind: 'irregular',
    itemId: it.id,
    prompt: it.word,
    sub: it.meaning || undefined,
    v2: answersFor(it.v2 ?? ''),
    v3: answersFor(it.v3 ?? ''),
    shown: `${it.word} – ${it.v2} – ${it.v3}`,
  }
}

function patternMcq(it: Item, deck: Deck, rand: () => number): Question {
  const mine = it.patterns ?? [deck.title]
  const right = pick(mine, 1, rand)[0]
  const wrong = (deck.patternLabels ?? []).filter((l) => !mine.includes(l))
  const options = shuffle([right, ...pick(wrong, 3, rand)], rand)
  return {
    kind: 'mcq',
    itemId: it.id,
    prompt: it.word,
    sub: it.meaning ? `${it.meaning} — đi với cấu trúc nào?` : 'Đi với cấu trúc nào?',
    speak: it.word,
    options,
    correct: options.indexOf(right),
  }
}

/**
 * A full test of one deck: round 1 recognition (multiple choice), round 2 recall (typing).
 * `pool` = meanings from other decks, used when the deck has too few for distractors.
 */
export function buildTest(deck: Deck, pool: string[] = [], rand: () => number = Math.random): Question[] {
  const items = deck.items
  if (deck.kind === 'irregular') {
    return shuffle(items.filter((it) => it.v2 && it.v3), rand).map(irregularQuestion)
  }
  const withMeaning = items.filter(hasMeaning)
  const meanings = [...withMeaning.map((i) => i.meaning), ...(withMeaning.length < 6 ? pool : [])]
  if (deck.kind === 'rule') {
    return shuffle(withMeaning, rand).map((it) => meaningMcq(it, meanings, rand))
  }
  const round1 =
    deck.kind === 'pattern'
      ? shuffle(items, rand).map((it) => patternMcq(it, deck, rand))
      : shuffle(withMeaning, rand).map((it) => meaningMcq(it, meanings, rand))
  const round2 = shuffle(withMeaning, rand).map((it) => typing(it, deck))
  return [...round1, ...round2]
}

/** What "Chép" asks for each item. */
export function copyQuestion(it: Item, deck: Deck): Question | null {
  if (deck.kind === 'irregular') return it.v2 && it.v3 ? irregularQuestion(it) : null
  if (deck.kind === 'rule') return null // free writing, no checking
  return { kind: 'type', itemId: it.id, prompt: it.meaning || it.word, sub: it.pos || undefined, answers: it.answers, shown: it.word }
}

/** Check typed answers against a typing or irregular question. */
export function checkTyped(q: Question, values: string[]): { correct: boolean; near: boolean } {
  if (q.kind === 'type') {
    return { correct: isCorrect(values[0] ?? '', q.answers), near: isNear(values[0] ?? '', q.answers) }
  }
  if (q.kind === 'irregular') {
    const c2 = isCorrect(values[0] ?? '', q.v2)
    const c3 = isCorrect(values[1] ?? '', q.v3)
    const n2 = c2 || isNear(values[0] ?? '', q.v2)
    const n3 = c3 || isNear(values[1] ?? '', q.v3)
    return { correct: c2 && c3, near: !(c2 && c3) && n2 && n3 }
  }
  return { correct: false, near: false }
}

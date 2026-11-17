/** A tab exactly as Apps Script returns it: display strings, row-major. */
export interface RawTab {
  name: string
  values: string[][]
}

export interface SheetData {
  tabs: RawTab[]
  fetchedAt: string
}

/**
 * - session: a "Bx" tab (one class session)
 * - grammar: words from a grammar tab (meaning MCQ + typing)
 * - pattern: verb-pattern group from "to V + Ving" (pattern MCQ + typing)
 * - rule: free-text rules (meaning MCQ only, no typing)
 * - irregular: a slice of the irregular-verb table (type V2 + V3)
 */
export type DeckKind = 'session' | 'grammar' | 'pattern' | 'rule' | 'irregular'

export interface Item {
  id: string
  word: string
  /** Accepted typed answers for the word. */
  answers: string[]
  ipa: string
  pos: string
  meaning: string
  v2?: string
  v3?: string
  /** Pattern labels this verb belongs to (pattern decks only). */
  patterns?: string[]
}

export interface Deck {
  id: string
  kind: DeckKind
  section: 'vocab' | 'grammar'
  /** Source tab name, used to group decks in the Grammar screen. */
  group: string
  title: string
  order: number
  items: Item[]
  /** All pattern labels of the source tab (pattern decks only). */
  patternLabels?: string[]
}

export type EventType = 'start' | 'import' | 'read' | 'copy' | 'test' | 'translate' | 'reset'

export interface TestData {
  mode: 'learn' | 'review' | 'extra'
  score: number
  total: number
  wrong: string[]
}

export interface ImportData {
  /** Review days already done before the app (0-7). */
  doneDays: number
}

export interface StudyEvent {
  id: string
  ts: string
  device: string
  type: EventType
  deckId: string
  data?: TestData | ImportData | Record<string, unknown>
}

import { useSyncExternalStore } from 'react'
import { fetchEvents, fetchSheet, pushEvents } from './api'
import { parseSheet } from './parse'
import type { Deck, EventType, SheetData, StudyEvent } from './types'

export interface Settings {
  apiUrl: string
  token: string
  device: string
  voice: 'en-GB' | 'en-US'
  /** Optional daily "Đã dịch lại bài" tick on session cards. */
  translateTick: boolean
}

export interface State {
  settings: Settings
  sheet: SheetData | null
  decks: Deck[]
  events: StudyEvent[]
  outbox: string[]
  lastSync?: string
  syncing: boolean
  loadingSheet: boolean
  error?: string
}

const K = { settings: 'fc.settings', sheet: 'fc.sheet', events: 'fc.events', outbox: 'fc.outbox', lastSync: 'fc.lastSync' }

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: keep in memory */
  }
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID()
    } catch {
      /* not a secure context */
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function deviceName(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const kind = /iPhone|iPad/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'web'
  return `${kind}-${uid().slice(0, 6)}`
}

const defaults: Settings = { apiUrl: '', token: '', device: '', voice: 'en-GB', translateTick: false }
const storedSettings = { ...defaults, ...read<Partial<Settings>>(K.settings, {}) }
if (!storedSettings.device) storedSettings.device = deviceName()
write(K.settings, storedSettings)

const storedSheet = read<SheetData | null>(K.sheet, null)

let state: State = {
  settings: storedSettings,
  sheet: storedSheet,
  decks: storedSheet ? parseSheet(storedSheet.tabs) : [],
  events: read<StudyEvent[]>(K.events, []),
  outbox: read<string[]>(K.outbox, []),
  lastSync: read<string | undefined>(K.lastSync, undefined),
  syncing: false,
  loadingSheet: false,
}

const listeners = new Set<() => void>()
function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const getState = () => state
export function useStore(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function saveSettings(patch: Partial<Settings>) {
  const settings = { ...state.settings, ...patch }
  write(K.settings, settings)
  set({ settings })
}

export function setSheet(tabs: SheetData['tabs']) {
  const sheet: SheetData = { tabs, fetchedAt: new Date().toISOString() }
  write(K.sheet, sheet)
  set({ sheet, decks: parseSheet(tabs) })
}

export function eventsFor(deckId: string, events = state.events): StudyEvent[] {
  return events.filter((e) => e.deckId === deckId)
}

export function addEvent(type: EventType, deckId: string, data?: StudyEvent['data']) {
  const e: StudyEvent = { id: uid(), ts: new Date().toISOString(), device: state.settings.device, type, deckId, data }
  const events = [...state.events, e]
  const outbox = [...state.outbox, e.id]
  write(K.events, events)
  write(K.outbox, outbox)
  set({ events, outbox })
  scheduleSync()
}

let syncTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSync() {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => void sync(), 1500)
}

/** Push unsent events, then pull everything from the server and merge by id. */
export async function sync(): Promise<void> {
  const { apiUrl, token } = state.settings
  if (!apiUrl || !token || state.syncing) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  set({ syncing: true, error: undefined })
  try {
    const pending = state.events.filter((e) => state.outbox.includes(e.id))
    if (pending.length) {
      await pushEvents(apiUrl, token, pending)
      const sent = new Set(pending.map((e) => e.id))
      const outbox = state.outbox.filter((id) => !sent.has(id))
      write(K.outbox, outbox)
      set({ outbox })
    }
    const { events: remote } = await fetchEvents(apiUrl, token)
    const byId = new Map(state.events.map((e) => [e.id, e]))
    for (const e of remote) byId.set(e.id, e)
    const events = [...byId.values()].sort((a, b) => a.ts.localeCompare(b.ts))
    const lastSync = new Date().toISOString()
    write(K.events, events)
    write(K.lastSync, lastSync)
    set({ events, lastSync, syncing: false })
  } catch (err) {
    set({ syncing: false, error: `Đồng bộ lỗi: ${(err as Error).message}` })
  }
}

export async function refreshSheet(): Promise<boolean> {
  const { apiUrl, token } = state.settings
  if (!apiUrl || !token) return false
  set({ loadingSheet: true, error: undefined })
  try {
    const { tabs } = await fetchSheet(apiUrl, token)
    setSheet(tabs)
    set({ loadingSheet: false })
    return true
  } catch (err) {
    set({ loadingSheet: false, error: `Tải Sheet lỗi: ${(err as Error).message}` })
    return false
  }
}

const SHEET_MAX_AGE_MS = 30 * 60 * 1000

/** On open / when the app comes back to the foreground. */
export function refreshIfStale() {
  void sync()
  const at = state.sheet ? Date.parse(state.sheet.fetchedAt) : 0
  if (Date.now() - at > SHEET_MAX_AGE_MS) void refreshSheet()
}

export function exportBackup(): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), events: state.events })
}

export function importBackup(text: string): number {
  const data = JSON.parse(text) as { events?: StudyEvent[] }
  if (!Array.isArray(data.events)) throw new Error('File sao lưu không hợp lệ')
  const byId = new Map(state.events.map((e) => [e.id, e]))
  let added = 0
  const outbox = [...state.outbox]
  for (const e of data.events) {
    if (!byId.has(e.id)) {
      byId.set(e.id, e)
      outbox.push(e.id)
      added++
    }
  }
  const events = [...byId.values()].sort((a, b) => a.ts.localeCompare(b.ts))
  write(K.events, events)
  write(K.outbox, outbox)
  set({ events, outbox })
  scheduleSync()
  return added
}

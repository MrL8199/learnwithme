import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { studyDate, shortDate } from './lib/date'
import { cycleState, REVIEW_DAYS, READ_TARGET, type CycleState } from './lib/engine'
import { eventsFor, useStore } from './lib/store'
import type { Deck } from './lib/types'

export type Tab = 'today' | 'vocab' | 'grammar' | 'settings'
export type Route =
  | { name: 'tab'; tab: Tab }
  | { name: 'deck'; deckId: string }
  | { name: 'read' | 'copy' | 'test'; deckId: string }

export const NavContext = createContext<{ go: (r: Route) => void; back: () => void }>({ go: () => {}, back: () => {} })
export const useNav = () => useContext(NavContext)

/** Current study date; refreshes when the app returns to the foreground and every minute. */
export function useToday(): string {
  const [today, setToday] = useState(() => studyDate(Date.now()))
  useEffect(() => {
    const tick = () => setToday(studyDate(Date.now()))
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return today
}

export function useCycles(today: string): Map<string, CycleState> {
  const { decks, events } = useStore()
  return useMemo(() => new Map(decks.map((d) => [d.id, cycleState(eventsFor(d.id, events), today)])), [decks, events, today])
}

export function useDeck(deckId: string): Deck | undefined {
  return useStore().decks.find((d) => d.id === deckId)
}

export function deckSubtitle(d: Deck): string {
  if (d.kind === 'session') return `${d.items.length} từ`
  if (d.kind === 'irregular') return `Động từ bất quy tắc · ${d.items.length} động từ`
  return `${d.group} · ${d.items.length} mục`
}

export function chip(s: CycleState): { text: string; tone: 'muted' | 'info' | 'warn' | 'ok' | 'bad' } {
  switch (s.phase) {
    case 'new':
      return { text: 'Chưa học', tone: 'muted' }
    case 'learning':
      return { text: 'Đang học mới', tone: 'info' }
    case 'waiting':
      return { text: 'Ôn từ mai', tone: 'muted' }
    case 'due':
      return { text: `Cần ôn · ${s.done}/${REVIEW_DAYS}`, tone: s.atRisk ? 'bad' : 'warn' }
    case 'doneToday':
      return { text: `Đã ôn hôm nay · ${s.done}/${REVIEW_DAYS}`, tone: 'ok' }
    case 'complete':
      return { text: `Xong ${REVIEW_DAYS}/${REVIEW_DAYS}`, tone: 'ok' }
    case 'expired':
      return { text: `Hết hạn · ${s.done}/${REVIEW_DAYS}`, tone: 'bad' }
  }
}

export function Chip({ s }: { s: CycleState }) {
  const c = chip(s)
  return <span className={`chip ${c.tone}`}>{c.text}</span>
}

export const STEP_LABEL = { read: 'Đọc + nghe', copy: 'Chép', baseline: 'Test mốc', review: 'Ôn hôm nay' } as const

/** One-line explanation of where the deck stands. */
export function statusLine(s: CycleState): string {
  switch (s.phase) {
    case 'new':
      return 'Chưa bắt đầu'
    case 'learning': {
      const step = s.nextStep === 'read' ? `Đọc + nghe (lượt ${s.reads + 1}/${READ_TARGET})` : STEP_LABEL[s.nextStep ?? 'read']
      return `Học mới · bước tiếp: ${step}`
    }
    case 'waiting':
      return 'Đã học xong hôm nay. Bắt đầu ôn từ ngày mai.'
    case 'due': {
      const parts = [`Ôn lần ${s.done + 1}/${REVIEW_DAYS}`]
      if (s.missed > 0) parts.push(`đang bù ${s.missed} ngày`)
      if (s.windowEnd) parts.push(`hạn ${shortDate(s.windowEnd)}`)
      return parts.join(' · ') + (s.atRisk ? ' · không còn đủ ngày để đạt 7/7' : '')
    }
    case 'doneToday':
      return `Đã ôn hôm nay (${s.done}/${REVIEW_DAYS}). Mai ôn tiếp.`
    case 'complete':
      return `Hoàn thành 7/7${s.completeDate ? ` ngày ${shortDate(s.completeDate)}` : ''}`
    case 'expired':
      return `Quá 14 ngày mà mới ôn ${s.done}/${REVIEW_DAYS}. Học lại từ đầu?`
  }
}

export function Dots({ s }: { s: CycleState }) {
  return (
    <span className="dots" aria-label={`${s.done}/${REVIEW_DAYS}`}>
      {Array.from({ length: REVIEW_DAYS }, (_, i) => (
        <span key={i} className={`dot ${i < s.done ? 'on' : ''} ${i === s.done && s.phase === 'due' ? 'next' : ''}`} />
      ))}
    </span>
  )
}

export function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon" onClick={onBack} aria-label="Quay lại">
          ‹
        </button>
      ) : (
        <span className="icon-space" />
      )}
      <h1>{title}</h1>
      <span className="topbar-right">{right}</span>
    </header>
  )
}

export function SyncBadge() {
  const { syncing, outbox, lastSync, settings, error } = useStore()
  if (!settings.apiUrl) return <span className="sync muted">Chưa kết nối</span>
  if (!settings.userKey) return <span className="sync warn">Chưa đăng nhập</span>
  if (syncing) return <span className="sync">Đang đồng bộ…</span>
  if (error) return <span className="sync bad">Lỗi đồng bộ</span>
  if (outbox.length) return <span className="sync warn">Chờ gửi {outbox.length}</span>
  if (lastSync) {
    const t = new Date(lastSync)
    return <span className="sync ok">Đã đồng bộ {t.getHours()}:{String(t.getMinutes()).padStart(2, '0')}</span>
  }
  return null
}

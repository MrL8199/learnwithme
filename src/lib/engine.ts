import { addDays, diffDays, studyDate } from './date'
import type { ImportData, StudyEvent, TestData } from './types'

/** "Đọc nhiều lần": read passes required on learning day. */
export const READ_TARGET = 2
/** "7 ngày": review days required. */
export const REVIEW_DAYS = 7
/** "Được bù": the 7 review days must fall within start+1 … start+14. */
export const WINDOW_DAYS = 14

export type Phase =
  | 'new' // never started
  | 'learning' // started, learning steps not finished
  | 'waiting' // learned today; first review tomorrow
  | 'due' // a review is due today
  | 'doneToday' // today's review done
  | 'complete' // 7/7
  | 'expired' // window passed before 7/7

export type Step = 'read' | 'copy' | 'baseline' | 'review'

export interface CycleState {
  phase: Phase
  startDate?: string
  windowEnd?: string
  reads: number
  copied: boolean
  baseline?: TestData
  learnDone: boolean
  /** Review days done before using the app (declared at setup). */
  imported: number
  /** Distinct study dates with a counted review. */
  reviewDates: string[]
  /** Review days done, 0-7. */
  done: number
  doneToday: boolean
  /** Elapsed review days without a review (make-up still possible). */
  missed: number
  /** Review chances left in the window, today included if still open. */
  chancesLeft: number
  /** Not enough days left to reach 7 in the window. */
  atRisk: boolean
  completeDate?: string
  tests: { date: string; data: TestData }[]
  translatedToday: boolean
  nextStep?: Step
}

const isStart = (e: StudyEvent) => e.type === 'start' || e.type === 'import'

/** State of the current cycle of one deck, from that deck's events. Pure. */
export function cycleState(deckEvents: StudyEvent[], today: string): CycleState {
  const events = [...deckEvents].sort((a, b) => a.ts.localeCompare(b.ts))
  const lastReset = events.map((e) => e.type).lastIndexOf('reset')
  const live = events.slice(lastReset + 1)
  const startIdx = live.map(isStart).lastIndexOf(true)

  const empty: CycleState = {
    phase: 'new',
    reads: 0,
    copied: false,
    learnDone: false,
    imported: 0,
    reviewDates: [],
    done: 0,
    doneToday: false,
    missed: 0,
    chancesLeft: 0,
    atRisk: false,
    tests: [],
    translatedToday: false,
  }
  if (startIdx < 0) return empty

  const start = live[startIdx]
  const cyc = live.slice(startIdx + 1)
  const imported =
    start.type === 'import' ? Math.max(0, Math.min(REVIEW_DAYS, (start.data as ImportData)?.doneDays ?? 0)) : 0
  const startDate = start.type === 'import' ? addDays(studyDate(start.ts), -imported) : studyDate(start.ts)
  const windowEnd = addDays(startDate, WINDOW_DAYS)

  const reads = cyc.filter((e) => e.type === 'read').length
  const copied = cyc.some((e) => e.type === 'copy')
  const tests = cyc
    .filter((e) => e.type === 'test')
    .map((e) => ({ date: studyDate(e.ts), data: e.data as TestData }))
  const baseline = tests.find((t) => t.data.mode === 'learn')?.data
  const learnDone = start.type === 'import' || (reads >= READ_TARGET && copied && !!baseline)

  const reviewDates = [
    ...new Set(
      tests
        .filter((t) => t.data.mode === 'review' && t.date > startDate && t.date <= windowEnd)
        .map((t) => t.date),
    ),
  ].sort()
  const done = Math.min(REVIEW_DAYS, imported + reviewDates.length)
  const completeDate = done >= REVIEW_DAYS ? reviewDates[REVIEW_DAYS - imported - 1] : undefined
  const doneToday = reviewDates.includes(today)

  const elapsedBefore = Math.max(0, Math.min(diffDays(startDate, today) - 1, WINDOW_DAYS))
  const doneBefore = imported + reviewDates.filter((d) => d < today).length
  const missed = done >= REVIEW_DAYS ? 0 : Math.max(0, elapsedBefore - doneBefore)

  const from = today > startDate ? today : addDays(startDate, 1)
  let chancesLeft = Math.max(0, diffDays(from, windowEnd) + 1)
  if (doneToday && from === today) chancesLeft -= 1
  const atRisk = done < REVIEW_DAYS && REVIEW_DAYS - done > chancesLeft

  let phase: Phase
  if (done >= REVIEW_DAYS) phase = 'complete'
  else if (today > windowEnd) phase = 'expired'
  else if (!learnDone) phase = 'learning'
  else if (doneToday) phase = 'doneToday'
  else if (today <= startDate) phase = 'waiting'
  else phase = 'due'

  let nextStep: Step | undefined
  if (phase === 'learning') nextStep = reads < READ_TARGET ? 'read' : !copied ? 'copy' : 'baseline'
  else if (phase === 'due') nextStep = 'review'

  const translatedToday = cyc.some((e) => e.type === 'translate' && studyDate(e.ts) === today)

  return {
    phase,
    startDate,
    windowEnd,
    reads,
    copied,
    baseline,
    learnDone,
    imported,
    reviewDates,
    done,
    doneToday,
    missed,
    chancesLeft,
    atRisk,
    completeDate,
    tests,
    translatedToday,
    nextStep,
  }
}

/** Which kind of test a test started now counts as. */
export function testModeFor(s: CycleState): TestData['mode'] {
  if (s.phase === 'learning') return 'learn'
  if (s.phase === 'due') return 'review'
  return 'extra'
}

/** Phases that belong on the Hôm nay screen. */
export function isActive(s: CycleState): boolean {
  return s.phase === 'learning' || s.phase === 'waiting' || s.phase === 'due' || s.phase === 'doneToday' || s.phase === 'expired'
}

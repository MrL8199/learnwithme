import { describe, expect, it } from 'vitest'
import { cycleState, testModeFor } from '../src/lib/engine'
import { studyDate } from '../src/lib/date'
import type { StudyEvent, TestData } from '../src/lib/types'

let n = 0
/** Local Vietnam time "YYYY-MM-DD HH:mm" → event. */
function ev(type: StudyEvent['type'], local: string, data?: StudyEvent['data']): StudyEvent {
  const ts = new Date(local.replace(' ', 'T') + ':00+07:00').toISOString()
  return { id: String(n++), ts, device: 't', type, deckId: 'S:B9', data }
}
const test = (mode: TestData['mode'], local: string) => ev('test', local, { mode, score: 10, total: 10, wrong: [] })
const learned = () => [ev('start', '2026-11-16 20:00'), ev('read', '2026-11-16 20:05'), ev('read', '2026-11-16 20:10'), ev('copy', '2026-11-16 20:20'), test('learn', '2026-11-16 20:30')]

describe('study date', () => {
  it('rolls over at 04:00 Vietnam time', () => {
    expect(studyDate(new Date('2026-11-17T00:30:00+07:00'))).toBe('2026-11-16')
    expect(studyDate(new Date('2026-11-17T04:00:00+07:00'))).toBe('2026-11-17')
  })
})

describe('cycleState', () => {
  it('is new without events', () => {
    expect(cycleState([], '2026-11-16').phase).toBe('new')
  })

  it('walks through the learning steps', () => {
    const e = [ev('start', '2026-11-16 20:00')]
    expect(cycleState(e, '2026-11-16')).toMatchObject({ phase: 'learning', nextStep: 'read' })
    e.push(ev('read', '2026-11-16 20:05'), ev('read', '2026-11-16 20:10'))
    expect(cycleState(e, '2026-11-16').nextStep).toBe('copy')
    e.push(ev('copy', '2026-11-16 20:20'))
    expect(cycleState(e, '2026-11-16').nextStep).toBe('baseline')
    e.push(test('learn', '2026-11-16 20:30'))
    const s = cycleState(e, '2026-11-16')
    expect(s.phase).toBe('waiting')
    expect(testModeFor(s)).toBe('extra')
  })

  it('needs one review per day and completes at 7/7', () => {
    const e = learned()
    expect(cycleState(e, '2026-11-17').phase).toBe('due')
    for (let d = 17; d <= 23; d++) e.push(test('review', `2026-11-${d} 21:00`))
    e.push(test('review', '2026-11-23 22:00')) // second review same day does not count twice
    const s = cycleState(e, '2026-11-23')
    expect(s).toMatchObject({ phase: 'complete', done: 7, completeDate: '2026-11-23', missed: 0 })
  })

  it('counts a review at 00:30 for the previous day', () => {
    const e = [...learned(), test('review', '2026-11-18 00:30')]
    const s = cycleState(e, '2026-11-17')
    expect(s.reviewDates).toEqual(['2026-11-17'])
    expect(s.phase).toBe('doneToday')
  })

  it('allows make-up days inside the 14-day window', () => {
    const e = [...learned(), test('review', '2026-11-17 21:00'), test('review', '2026-11-20 21:00')]
    const s = cycleState(e, '2026-11-21')
    expect(s).toMatchObject({ phase: 'due', done: 2, missed: 2, atRisk: false })
    // window ends 2026-11-30: from 11-21 there are 10 chances for 5 days
    expect(s.chancesLeft).toBe(10)
  })

  it('warns when 7 is no longer reachable and expires after day 14', () => {
    const e = [...learned(), test('review', '2026-11-17 21:00')]
    expect(cycleState(e, '2026-11-26').atRisk).toBe(true) // 5 chances, 6 needed
    expect(cycleState(e, '2026-12-01').phase).toBe('expired')
  })

  it('imports progress done before the app', () => {
    const e = [ev('import', '2026-11-17 10:00', { doneDays: 5 })]
    const s = cycleState(e, '2026-11-17')
    expect(s).toMatchObject({ phase: 'due', done: 5, learnDone: true, startDate: '2026-11-12', missed: 0 })
    e.push(test('review', '2026-11-17 21:00'), test('review', '2026-11-18 21:00'))
    expect(cycleState(e, '2026-11-18')).toMatchObject({ phase: 'complete', completeDate: '2026-11-18' })
  })

  it('restarts after reset', () => {
    const e = [...learned(), ev('reset', '2026-12-02 08:00')]
    expect(cycleState(e, '2026-12-02').phase).toBe('new')
  })
})

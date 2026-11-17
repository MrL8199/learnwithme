import { useEffect, useMemo, useRef, useState } from 'react'
import { TypedInputs } from '../components/TypedInputs'
import { REVIEW_DAYS, testModeFor } from '../lib/engine'
import { buildTest, checkTyped, type Question } from '../lib/quiz'
import { addEvent, useStore } from '../lib/store'
import { speak } from '../lib/tts'
import type { TestData } from '../lib/types'
import { TopBar, useCycles, useDeck, useNav, useToday } from '../ui'

interface Slot {
  q: Question
  k: number
}
interface Feedback {
  correct: boolean
  near: boolean
  chosen?: number
}

const MAX_RETRIES = 2

export function TestRun({ deckId }: { deckId: string }) {
  const deck = useDeck(deckId)
  const { decks, settings } = useStore()
  const today = useToday()
  const cycle = useCycles(today).get(deckId)
  const { back } = useNav()

  // Fixed for the whole run, even if the state changes while testing.
  const [mode] = useState<TestData['mode']>(() => (cycle ? testModeFor(cycle) : 'extra'))
  const [doneBefore] = useState(() => cycle?.done ?? 0)
  const questions = useMemo(() => {
    if (!deck) return []
    const pool = decks.filter((d) => d.section === deck.section && d.id !== deck.id).flatMap((d) => d.items.map((i) => i.meaning)).filter(Boolean)
    return buildTest(deck, pool)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck?.id])

  const [queue, setQueue] = useState<Slot[]>(() => questions.map((q, k) => ({ q, k })))
  const [pos, setPos] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const first = useRef(new Map<number, boolean>())
  const retries = useRef(new Map<number, number>())
  const wrongIds = useRef(new Set<string>())
  const saved = useRef<TestData | null>(null)
  const [result, setResult] = useState<TestData | null>(null)

  useEffect(() => {
    setQueue(questions.map((q, k) => ({ q, k })))
    setPos(0)
  }, [questions])

  const queueLen = useRef(queue.length)
  queueLen.current = queue.length
  const slot = queue[pos]

  useEffect(() => {
    if (slot?.q.kind === 'mcq' && slot.q.speak) speak(slot.q.speak, settings.voice)
  }, [slot, settings.voice])

  if (!deck) return null

  if (!questions.length) {
    return (
      <div className="screen study">
        <TopBar title="Test" onBack={back} />
        <p className="summary">Bài này chưa có mục nào đủ dữ liệu để test (thiếu nghĩa).</p>
      </div>
    )
  }

  const answer = (correct: boolean, near: boolean, chosen?: number) => {
    const { k, q } = slot
    if (!first.current.has(k)) first.current.set(k, correct)
    if (!correct) {
      wrongIds.current.add(q.itemId)
      const n = retries.current.get(k) ?? 0
      if (n < MAX_RETRIES) {
        retries.current.set(k, n + 1)
        setQueue((qs) => [...qs, { q, k }])
      }
    }
    setFeedback({ correct, near, chosen })
    if (q.kind !== 'mcq') {
      const it = deck.items.find((x) => x.id === q.itemId)
      if (it) speak(it.word, settings.voice)
    }
    if (correct) setTimeout(next, 650)
  }

  function next() {
    setFeedback(null)
    const np = pos + 1
    if (np >= queueLen.current) finish()
    setPos(np)
  }

  function finish() {
    if (saved.current) return
    const score = [...first.current.values()].filter(Boolean).length
    const wrong = [...wrongIds.current].map((id) => deck!.items.find((i) => i.id === id)?.word ?? id)
    const data: TestData = { mode, score, total: questions.length, wrong }
    saved.current = data
    addEvent('test', deck!.id, data)
    setResult(data)
  }

  if (result) {
    const pct = Math.round((result.score / result.total) * 100)
    return (
      <div className="screen study">
        <TopBar title={deck.title} onBack={back} />
        <div className="card center">
          <div className="score">
            {result.score}/{result.total}
          </div>
          <p>{pct}% đúng ngay lần đầu</p>
          <p className="status">
            {mode === 'review'
              ? `Đã tính ôn lần ${Math.min(doneBefore + 1, REVIEW_DAYS)}/${REVIEW_DAYS}.`
              : mode === 'learn'
                ? 'Đã lưu điểm mốc. Ngày mai bắt đầu ôn lần 1/7.'
                : 'Luyện thêm, không tính vào 7 ngày.'}
          </p>
          {result.wrong.length > 0 && (
            <>
              <h3>Từ sai</h3>
              <div className="tags">
                {result.wrong.map((w) => (
                  <span key={w} className="tag" onClick={() => speak(w, settings.voice)}>
                    {w}
                  </span>
                ))}
              </div>
            </>
          )}
          <button className="primary" onClick={back}>
            Xong
          </button>
        </div>
      </div>
    )
  }

  if (!slot) return null
  const { q } = slot
  const answered = feedback !== null
  const isRetry = pos >= questions.length
  const remaining = queue.length - pos

  return (
    <div className="screen study">
      <TopBar
        title={mode === 'review' ? `Ôn lần ${doneBefore + 1}/${REVIEW_DAYS}` : mode === 'learn' ? 'Test mốc' : 'Luyện thêm'}
        onBack={() => {
          if (confirm('Thoát bài test? Kết quả sẽ không được lưu.')) back()
        }}
        right={<span className="counter">còn {remaining}</span>}
      />
      <div className="progress">
        <div style={{ width: `${(Math.min(pos, questions.length) / questions.length) * 100}%` }} />
      </div>
      {isRetry && <p className="hint-text">Làm lại câu sai</p>}

      <div className={`flashcard small ${answered ? (feedback.correct ? 'good' : 'bad') : ''}`}>
        {q.kind === 'mcq' && (
          <>
            <div className="word" onClick={() => q.speak && speak(q.speak, settings.voice)}>
              {q.prompt}
            </div>
            {q.sub && <div className="pos">{q.sub}</div>}
          </>
        )}
        {q.kind === 'type' && (
          <>
            <div className="meaning big">{q.prompt}</div>
            {q.sub && <div className="pos">{q.sub}</div>}
            <div className="hint-text">Gõ từ tiếng Anh</div>
          </>
        )}
        {q.kind === 'irregular' && (
          <>
            <div className="word">{q.prompt}</div>
            {q.sub && <div className="meaning">{q.sub}</div>}
            <div className="hint-text">Gõ V2 và V3</div>
          </>
        )}
        {answered && !feedback.correct && q.kind !== 'mcq' && (
          <div className="answer">
            {feedback.near ? 'Gần đúng! ' : ''}Đáp án: {q.shown}
          </div>
        )}
      </div>

      {q.kind === 'mcq' ? (
        <div className="options">
          {q.options.map((o, idx) => {
            const cls = !answered ? '' : idx === q.correct ? 'good' : idx === feedback.chosen ? 'bad' : 'dim'
            return (
              <button key={idx} className={`option ${cls}`} disabled={answered} onClick={() => answer(idx === q.correct, false, idx)}>
                {o}
              </button>
            )
          })}
        </div>
      ) : (
        <TypedInputs
          labels={q.kind === 'irregular' ? ['V2', 'V3'] : ['Từ tiếng Anh']}
          resetKey={pos}
          disabled={answered}
          onSubmit={(values) => {
            const r = checkTyped(q, values)
            answer(r.correct, r.near)
          }}
        />
      )}

      {answered && !feedback.correct && (
        <div className="bottom-actions">
          <button className="primary" onClick={next}>
            Tiếp ›
          </button>
        </div>
      )}
    </div>
  )
}

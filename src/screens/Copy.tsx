import { useEffect, useState } from 'react'
import { TypedInputs } from '../components/TypedInputs'
import { maskHint, maxHintLevel } from '../lib/hint'
import { checkTyped, copyQuestion } from '../lib/quiz'
import { addEvent, useStore } from '../lib/store'
import { hasVietnameseVoice, speak, speakVi } from '../lib/tts'
import type { Item } from '../lib/types'
import { TopBar, useDeck, useNav } from '../ui'

type Phase = 'write' | 'fix' | 'ok'

/** What is read aloud in English after answering (all three forms for irregular verbs). */
function englishSpeech(it: Item): string {
  return it.v2 ? `${it.word}, ${it.v2}, ${it.v3}` : it.word
}

/**
 * "Chép" on the phone, recall-first:
 * show the Vietnamese meaning (and read it aloud) → type the English from memory →
 * the English is revealed and read aloud. A wrong answer reveals and plays the English
 * as a hint, and must be typed again correctly before moving on.
 */
export function Copy({ deckId }: { deckId: string }) {
  const deck = useDeck(deckId)
  const { settings } = useStore()
  const { back } = useNav()
  const [i, setI] = useState(0)
  const [phase, setPhase] = useState<Phase>('write')
  const [ruleShown, setRuleShown] = useState(true)
  const [firstTry, setFirstTry] = useState(0)
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  /** -1 = no hint asked; 0 = word shape; n = first n letters of each word. */
  const [hint, setHint] = useState(-1)
  const [viVoice] = useState(hasVietnameseVoice)

  const items = deck?.items ?? []
  const it = items[i]
  const q = it && deck ? copyQuestion(it, deck) : null
  const hasMeaning = !!it?.meaning.trim()

  // New item: read the Vietnamese meaning (or, without one, the English word to copy).
  useEffect(() => {
    if (!it || done) return
    if (deck?.kind === 'rule') return
    if (hasMeaning) speakVi(it.meaning)
    else speak(englishSpeech(it), settings.voice)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, done])

  if (!deck || (!it && !done)) return null

  const advance = () => {
    if (i < items.length - 1) {
      setI(i + 1)
      setPhase('write')
      setRuleShown(true)
      setNote('')
      setHint(-1)
    } else {
      addEvent('copy', deck.id)
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="screen study">
        <TopBar title={deck.title} onBack={back} />
        <div className="card center">
          <h2>Đã chép xong {items.length} mục</h2>
          {deck.kind !== 'rule' && (
            <p>
              Viết đúng ngay lần đầu (không gợi ý): {firstTry}/{items.length}
            </p>
          )}
          <button className="primary" onClick={back}>
            Xong
          </button>
        </div>
      </div>
    )
  }

  const header = (
    <>
      <TopBar title="Chép" onBack={back} right={<span className="counter">{i + 1}/{items.length}</span>} />
      <div className="progress">
        <div style={{ width: `${(i / items.length) * 100}%` }} />
      </div>
    </>
  )

  // Rules ("forget / remember + V-ing"): look, then rewrite in your own words (no checking).
  if (!q) {
    return (
      <div className="screen study">
        {header}
        <div className="flashcard small">
          {ruleShown && <div className="word">{it.word}</div>}
          <div className="meaning big">{it.meaning}</div>
        </div>
        {ruleShown ? (
          <div className="bottom-actions">
            <button className="primary" onClick={() => setRuleShown(false)}>
              Nhớ rồi, che lại
            </button>
          </div>
        ) : (
          <>
            <textarea lang="vi" className="note" placeholder="Viết lại quy tắc theo trí nhớ" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="bottom-actions">
              <button onClick={() => setRuleShown(true)}>Xem lại</button>
              <button className="primary" disabled={!note.trim()} onClick={advance}>
                Tiếp ›
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  const revealed = phase !== 'write'
  const irregular = q.kind === 'irregular'
  const hintTarget = irregular ? `${it.v2} – ${it.v3}` : it.word
  const canHint = phase === 'write' && hint < maxHintLevel(hintTarget)
  const labels = irregular ? ['V2 (quá khứ)', 'V3 (quá khứ phân từ)'] : ['Gõ từ tiếng Anh']

  return (
    <div className="screen study">
      {header}
      <div className={`flashcard small ${phase === 'ok' ? 'good' : phase === 'fix' ? 'bad' : ''}`}>
        {hasMeaning ? (
          <>
            <div className="meaning big vi">{it.meaning}</div>
            {it.pos && <div className="pos">{it.pos}</div>}
          </>
        ) : (
          <div className="hint-text">Chưa có nghĩa tiếng Việt — gõ lại từ dưới đây</div>
        )}
        {irregular && <div className="word">{it.word}</div>}

        {(revealed || !hasMeaning) && !irregular && <div className="word reveal">{it.word}</div>}
        {revealed && it.ipa && <div className="ipa">{it.ipa}</div>}
        {revealed && irregular && (
          <div className="forms reveal">
            {it.word} – {it.v2} – {it.v3}
          </div>
        )}
        {phase === 'write' && hint >= 0 && (
          <div className="hint-mask" lang="en" aria-label="Gợi ý">
            {maskHint(hintTarget, hint)}
          </div>
        )}
        {phase === 'ok' && <div className="answer">✓ Đúng</div>}
        {phase === 'fix' && <div className="answer">Chưa đúng — nghe và gõ lại</div>}
      </div>

      <div className="toolbar">
        {hasMeaning && viVoice && (
          <button onClick={() => speakVi(it.meaning)} aria-label="Nghe tiếng Việt">
            🔊 Tiếng Việt
          </button>
        )}
        {canHint && (
          <button onClick={() => setHint((h) => h + 1)} aria-label="Gợi ý thêm một chữ">
            💡 {hint < 0 ? 'Gợi ý' : 'Thêm chữ'}
          </button>
        )}
        {revealed && (
          <button onClick={() => speak(englishSpeech(it), settings.voice)} aria-label="Nghe tiếng Anh">
            🔊 Tiếng Anh
          </button>
        )}
      </div>

      <TypedInputs
        labels={labels}
        resetKey={`${i}-${phase}`}
        disabled={phase === 'ok'}
        submitLabel={phase === 'fix' ? 'Gõ lại' : 'Kiểm tra'}
        onSubmit={(values) => {
          const r = checkTyped(q, values)
          speak(englishSpeech(it), settings.voice)
          if (r.correct) {
            if (phase === 'write' && hint < 0) setFirstTry((n) => n + 1)
            setPhase('ok')
            setTimeout(advance, 1200)
          } else {
            setPhase('fix')
          }
        }}
      />
    </div>
  )
}

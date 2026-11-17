import { useEffect, useRef, useState } from 'react'
import { READ_TARGET } from '../lib/engine'
import { addEvent, useStore } from '../lib/store'
import { speak } from '../lib/tts'
import { TopBar, useCycles, useDeck, useNav, useToday } from '../ui'

/** "Đọc nhiều lần": one card at a time, read aloud, optional cover-the-meaning self check. */
export function Read({ deckId }: { deckId: string }) {
  const deck = useDeck(deckId)
  const { settings } = useStore()
  const s = useCycles(useToday()).get(deckId)
  const { back } = useNav()
  const [i, setI] = useState(0)
  const [cover, setCover] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [finished, setFinished] = useState(false)
  const touchX = useRef<number | null>(null)

  const items = deck?.items ?? []
  const it = items[i]

  useEffect(() => {
    setRevealed(false)
    if (it && autoSpeak) speak(it.word, settings.voice)
  }, [i, it, autoSpeak, settings.voice])

  if (!deck || !it) return null

  const next = () => (i < items.length - 1 ? setI(i + 1) : undefined)
  const prev = () => (i > 0 ? setI(i - 1) : undefined)
  const pass = (s?.reads ?? 0) + 1

  if (finished) {
    const more = s && s.phase === 'learning' && s.reads < READ_TARGET
    return (
      <div className="screen study">
        <TopBar title={deck.title} onBack={back} />
        <div className="card center">
          <h2>Xong 1 lượt đọc</h2>
          {more ? <p>Còn {READ_TARGET - s.reads} lượt nữa.</p> : <p>Bước tiếp: Chép.</p>}
          <div className="actions">
            {more && (
              <button
                className="primary"
                onClick={() => {
                  setI(0)
                  setFinished(false)
                }}
              >
                Đọc lượt tiếp
              </button>
            )}
            <button className={more ? '' : 'primary'} onClick={back}>
              Xong
            </button>
          </div>
        </div>
      </div>
    )
  }

  const showMeaning = !cover || revealed

  return (
    <div className="screen study">
      <TopBar title={`Đọc · lượt ${pass}`} onBack={back} right={<span className="counter">{i + 1}/{items.length}</span>} />
      <div className="progress">
        <div style={{ width: `${((i + 1) / items.length) * 100}%` }} />
      </div>
      <div
        className="flashcard"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (dx < -50) next()
          else if (dx > 50) prev()
        }}
        onClick={() => cover && setRevealed(true)}
      >
        <div className="word">{it.word}</div>
        {it.ipa && <div className="ipa">{it.ipa}</div>}
        {it.pos && <div className="pos">{it.pos}</div>}
        {it.v2 && (
          <div className="forms">
            {it.word} – {it.v2} – {it.v3}
          </div>
        )}
        <div className={`meaning big ${showMeaning ? '' : 'hidden'}`}>{showMeaning ? it.meaning || '—' : 'Chạm để xem nghĩa'}</div>
      </div>
      <div className="toolbar">
        <label className="check small">
          <input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} /> Che nghĩa
        </label>
        <label className="check small">
          <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} /> Tự đọc
        </label>
      </div>
      <div className="bottom-actions">
        <button onClick={prev} disabled={i === 0}>
          ‹ Trước
        </button>
        <button onClick={() => speak(it.word, settings.voice)} aria-label="Nghe">
          🔊
        </button>
        {i < items.length - 1 ? (
          <button className="primary" onClick={next}>
            Tiếp ›
          </button>
        ) : (
          <button
            className="primary"
            onClick={() => {
              addEvent('read', deck.id)
              setFinished(true)
            }}
          >
            Xong lượt
          </button>
        )}
      </div>
    </div>
  )
}

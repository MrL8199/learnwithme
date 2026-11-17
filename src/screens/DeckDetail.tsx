import { useState } from 'react'
import { shortDate } from '../lib/date'
import { READ_TARGET, REVIEW_DAYS } from '../lib/engine'
import { addEvent, useStore } from '../lib/store'
import { speak } from '../lib/tts'
import { Chip, deckSubtitle, Dots, statusLine, TopBar, useCycles, useDeck, useNav, useToday } from '../ui'

const MODE_LABEL = { learn: 'Test mốc', review: 'Ôn', extra: 'Luyện thêm' } as const

export function DeckDetail({ deckId }: { deckId: string }) {
  const deck = useDeck(deckId)
  const today = useToday()
  const s = useCycles(today).get(deckId)
  const { settings } = useStore()
  const { go, back } = useNav()
  const [showWords, setShowWords] = useState(false)
  const [importDays, setImportDays] = useState(7)

  if (!deck || !s) {
    return (
      <div className="screen">
        <TopBar title="Không tìm thấy" onBack={back} />
        <p className="summary">Bài này không còn trong Sheet.</p>
      </div>
    )
  }

  const wrongCount = new Map<string, number>()
  for (const t of s.tests) for (const w of t.data.wrong ?? []) wrongCount.set(w, (wrongCount.get(w) ?? 0) + 1)
  const hard = [...wrongCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)

  const start = () => {
    addEvent('start', deck.id)
    go({ name: 'read', deckId: deck.id })
  }
  const restart = () => {
    if (!confirm(`Học lại ${deck.title} từ đầu? Tiến độ chu kỳ hiện tại sẽ được đặt lại (lịch sử vẫn lưu).`)) return
    addEvent('reset', deck.id)
    addEvent('start', deck.id)
    go({ name: 'read', deckId: deck.id })
  }

  return (
    <div className="screen">
      <TopBar title={deck.title} onBack={back} right={<Chip s={s} />} />
      <div className="card">
        <div className="deck-card-head">
          <div className="row-sub">{deckSubtitle(deck)}</div>
          <Dots s={s} />
        </div>
        <p className="status">{statusLine(s)}</p>
        {s.startDate && (
          <p className="row-sub">
            Bắt đầu {shortDate(s.startDate)} · hạn đủ 7 ngày ôn: {s.windowEnd ? shortDate(s.windowEnd) : ''}
            {s.imported > 0 && ` · ${s.imported} ngày ôn trước khi dùng app`}
          </p>
        )}
      </div>

      {s.phase === 'new' && (
        <div className="card">
          <button className="primary block" onClick={start}>
            Bắt đầu học {deck.title}
          </button>
          <div className="import">
            <span>Đã học trước khi dùng app:</span>
            <select value={importDays} onChange={(e) => setImportDays(Number(e.target.value))}>
              <option value={7}>Đã xong 7/7</option>
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  Đã ôn {n}/7 ngày
                </option>
              ))}
            </select>
            <button onClick={() => addEvent('import', deck.id, { doneDays: importDays })}>Lưu</button>
          </div>
        </div>
      )}

      {s.phase === 'learning' && (
        <div className="card">
          <h3>Học mới (làm 1 lần)</h3>
          <Step done={s.reads >= READ_TARGET} label={`1. Đọc + nghe (${Math.min(s.reads, READ_TARGET)}/${READ_TARGET} lượt)`} onClick={() => go({ name: 'read', deckId })} />
          <Step done={s.copied} label="2. Chép: nghe nghĩa tiếng Việt → gõ từ tiếng Anh" onClick={() => go({ name: 'copy', deckId })} />
          <Step done={!!s.baseline} label="3. Test mốc" onClick={() => go({ name: 'test', deckId })} />
        </div>
      )}

      {s.phase !== 'new' && s.phase !== 'learning' && (
        <div className="card actions-col">
          {s.phase === 'due' && (
            <button className="primary block" onClick={() => go({ name: 'test', deckId })}>
              Ôn hôm nay (lần {s.done + 1}/{REVIEW_DAYS})
            </button>
          )}
          {s.phase !== 'due' && s.phase !== 'expired' && (
            <button className="block" onClick={() => go({ name: 'test', deckId })}>
              Làm test luyện thêm (không tính vào 7 ngày)
            </button>
          )}
          <div className="actions">
            <button onClick={() => go({ name: 'read', deckId })}>Đọc lại</button>
            <button onClick={() => go({ name: 'copy', deckId })}>Chép lại</button>
          </div>
          {settings.translateTick && deck.kind === 'session' && s.phase !== 'complete' && (
            <label className="check">
              <input type="checkbox" checked={s.translatedToday} disabled={s.translatedToday} onChange={() => addEvent('translate', deck.id)} />
              Đã dịch lại bài hôm nay
            </label>
          )}
          <button className="link danger" onClick={restart}>
            Học lại từ đầu
          </button>
        </div>
      )}

      {s.tests.length > 0 && (
        <div className="card">
          <h3>Điểm các lần test</h3>
          <ul className="scores">
            {s.tests.map((t, i) => (
              <li key={i}>
                <span>
                  {shortDate(t.date)} · {MODE_LABEL[t.data.mode]}
                </span>
                <b>
                  {t.data.score}/{t.data.total}
                </b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hard.length > 0 && (
        <div className="card">
          <h3>Hay sai</h3>
          <div className="tags">
            {hard.map(([w, n]) => (
              <span key={w} className="tag" onClick={() => speak(w, settings.voice)}>
                {w} <small>×{n}</small>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <button className="link" onClick={() => setShowWords(!showWords)}>
          {showWords ? 'Ẩn danh sách' : `Xem danh sách (${deck.items.length})`}
        </button>
        {showWords && (
          <ul className="words">
            {deck.items.map((it) => (
              <li key={it.id} onClick={() => speak(it.word, settings.voice)}>
                <div>
                  <b>{it.word}</b> {it.ipa && <span className="ipa">{it.ipa}</span>} {it.pos && <i>{it.pos}</i>}
                  {it.v2 && (
                    <span>
                      {' '}
                      – {it.v2} – {it.v3}
                    </span>
                  )}
                </div>
                <div className="meaning">{it.meaning || <span className="muted">(chưa có nghĩa)</span>}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Step({ done, label, onClick }: { done: boolean; label: string; onClick: () => void }) {
  return (
    <button className={`step ${done ? 'done' : ''}`} onClick={onClick}>
      <span className="step-mark">{done ? '✓' : '○'}</span> {label}
    </button>
  )
}

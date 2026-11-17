import { shortDate } from '../lib/date'
import { isActive, type CycleState } from '../lib/engine'
import { addEvent, useStore } from '../lib/store'
import type { Deck } from '../lib/types'
import { deckSubtitle, Dots, statusLine, STEP_LABEL, SyncBadge, TopBar, useCycles, useNav, useToday } from '../ui'

const RANK: Record<CycleState['phase'], number> = {
  due: 1,
  learning: 2,
  expired: 3,
  waiting: 4,
  doneToday: 5,
  new: 9,
  complete: 9,
}

export function Today() {
  const { decks, settings, error, events } = useStore()
  const today = useToday()
  const cycles = useCycles(today)
  const { go } = useNav()

  const active = decks
    .filter((d) => isActive(cycles.get(d.id)!))
    .sort((a, b) => {
      const sa = cycles.get(a.id)!
      const sb = cycles.get(b.id)!
      const ra = RANK[sa.phase] - (sa.atRisk ? 0.5 : 0)
      const rb = RANK[sb.phase] - (sb.atRisk ? 0.5 : 0)
      return ra - rb || a.order - b.order
    })
  const todo = active.filter((d) => ['due', 'learning'].includes(cycles.get(d.id)!.phase)).length
  const newSessions = decks.filter((d) => d.kind === 'session' && cycles.get(d.id)!.phase === 'new')

  return (
    <div className="screen">
      <TopBar title={`Hôm nay · ${shortDate(today)}`} right={<SyncBadge />} />
      {error && <div className="banner bad">{error}</div>}

      {!decks.length ? (
        <div className="card">
          <h2>Chào bạn</h2>
          <p>Kết nối Google Sheet để bắt đầu: vào <b>Cài đặt</b>, dán URL Apps Script và mã bí mật.</p>
          <button className="primary" onClick={() => go({ name: 'tab', tab: 'settings' })}>
            Mở Cài đặt
          </button>
        </div>
      ) : (
        <>
          <p className="summary">
            {todo > 0 ? (
              <>
                Còn <b>{todo}</b> việc hôm nay
              </>
            ) : active.length ? (
              'Xong việc hôm nay. Mai ôn tiếp nhé.'
            ) : (
              'Chưa có bài nào đang học.'
            )}
          </p>

          {active.map((d) => (
            <TodayCard key={d.id} deck={d} s={cycles.get(d.id)!} />
          ))}

          {!events.length && (
            <div className="card hint">
              <p>
                Bạn đã học một số buổi trước khi dùng app? Vào <b>Cài đặt › Khai báo tiến độ cũ</b> để đánh dấu buổi đã xong hoặc
                đang ôn dở.
              </p>
              <button onClick={() => go({ name: 'tab', tab: 'settings' })}>Khai báo tiến độ</button>
            </div>
          )}

          {newSessions.length > 0 && (
            <section>
              <h3 className="section-title">Buổi chưa bắt đầu</h3>
              {newSessions
                .slice()
                .reverse()
                .map((d) => (
                  <div key={d.id} className="row">
                    <div className="grow" onClick={() => go({ name: 'deck', deckId: d.id })}>
                      <div className="row-title">{d.title}</div>
                      <div className="row-sub">{deckSubtitle(d)}</div>
                    </div>
                    <button
                      onClick={() => {
                        addEvent('start', d.id)
                        go({ name: 'read', deckId: d.id })
                      }}
                    >
                      Bắt đầu học
                    </button>
                  </div>
                ))}
            </section>
          )}
        </>
      )}
      {settings.apiUrl && <div className="spacer" />}
    </div>
  )
}

function TodayCard({ deck, s }: { deck: Deck; s: CycleState }) {
  const { go } = useNav()
  const { settings } = useStore()
  const open = () => go({ name: 'deck', deckId: deck.id })

  let action: { label: string; run: () => void } | null = null
  if (s.phase === 'learning' && s.nextStep) {
    const step = s.nextStep
    const route = step === 'read' ? 'read' : step === 'copy' ? 'copy' : 'test'
    action = { label: STEP_LABEL[step], run: () => go({ name: route, deckId: deck.id }) }
  } else if (s.phase === 'due') {
    action = { label: 'Ôn hôm nay', run: () => go({ name: 'test', deckId: deck.id }) }
  } else if (s.phase === 'expired') {
    action = {
      label: 'Học lại từ đầu',
      run: () => {
        if (!confirm(`Bắt đầu lại ${deck.title} từ bước đọc?`)) return
        addEvent('reset', deck.id)
        addEvent('start', deck.id)
        go({ name: 'read', deckId: deck.id })
      },
    }
  }

  const showTranslate =
    settings.translateTick && deck.kind === 'session' && ['due', 'doneToday', 'waiting'].includes(s.phase)

  return (
    <div className={`card deck-card ${s.phase} ${s.atRisk ? 'risk' : ''}`}>
      <div className="deck-card-head" onClick={open}>
        <div>
          <div className="row-title">{deck.title}</div>
          <div className="row-sub">{deckSubtitle(deck)}</div>
        </div>
        <Dots s={s} />
      </div>
      <p className="status">{statusLine(s)}</p>
      {showTranslate && (
        <label className="check">
          <input
            type="checkbox"
            checked={s.translatedToday}
            disabled={s.translatedToday}
            onChange={() => addEvent('translate', deck.id)}
          />
          Đã dịch lại bài ngữ pháp + bài đọc hôm nay
        </label>
      )}
      <div className="actions">
        {action && (
          <button className="primary" onClick={action.run}>
            {action.label}
          </button>
        )}
        <button onClick={open}>Chi tiết</button>
      </div>
    </div>
  )
}

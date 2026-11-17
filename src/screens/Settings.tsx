import { useState } from 'react'
import { addEvent, exportBackup, getState, importBackup, refreshSheet, saveSettings, setSheet, signIn, signOut, sync, useStore } from '../lib/store'
import { speak } from '../lib/tts'
import type { RawTab } from '../lib/types'
import { TopBar, useCycles, useToday } from '../ui'

export function Settings() {
  const st = useStore()
  const { settings, decks, sheet, loadingSheet, syncing, outbox, lastSync, error } = st
  const [url, setUrl] = useState(settings.apiUrl)
  const [token, setToken] = useState(settings.token)
  const [msg, setMsg] = useState('')
  const [restore, setRestore] = useState('')

  const connect = async () => {
    saveSettings({ apiUrl: url.trim(), token: token.trim() })
    setMsg('Đang tải Sheet…')
    const ok = await refreshSheet()
    if (ok) {
      await sync()
      setMsg(settings.userKey ? 'Đã kết nối.' : 'Đã kết nối. Giờ hãy đăng nhập hoặc tạo tài khoản bên dưới.')
    } else setMsg('')
  }

  const counts = {
    session: decks.filter((d) => d.kind === 'session').length,
    grammar: decks.filter((d) => d.section === 'grammar' && d.kind !== 'irregular').length,
    irregular: decks.filter((d) => d.kind === 'irregular').length,
  }

  return (
    <div className="screen">
      <TopBar title="Cài đặt" />
      {error && <div className="banner bad">{error}</div>}

      <div className="card">
        <h3>Kết nối Google Sheet</h3>
        <label className="field">
          URL Apps Script (kết thúc bằng /exec)
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" inputMode="url" autoCapitalize="none" />
        </label>
        <label className="field">
          Mã nhóm (mã bí mật của Apps Script)
          <input value={token} onChange={(e) => setToken(e.target.value)} autoCapitalize="none" autoCorrect="off" />
        </label>
        <div className="actions">
          <button className="primary" onClick={connect} disabled={!url || !token || loadingSheet}>
            {loadingSheet ? 'Đang tải…' : 'Lưu & tải Sheet'}
          </button>
          {settings.apiUrl && (
            <button onClick={() => void refreshSheet()} disabled={loadingSheet}>
              Tải lại Sheet
            </button>
          )}
        </div>
        {msg && <p className="row-sub">{msg}</p>}
        {sheet && (
          <p className="row-sub">
            {counts.session} buổi · {counts.grammar} bài ngữ pháp · {counts.irregular} phần động từ BQT · cập nhật{' '}
            {new Date(sheet.fetchedAt).toLocaleString('vi-VN')}
          </p>
        )}
        {import.meta.env.DEV && (
          <button
            className="link"
            onClick={async () => {
              const files = import.meta.glob<{ tabs: RawTab[] }>('../../tests/fixtures/sheet.json', { import: 'default' })
              const load = Object.values(files)[0]
              if (!load) return setMsg('Không có tests/fixtures/sheet.json')
              setSheet((await load()).tabs)
              setMsg('Đã nạp dữ liệu mẫu (chỉ có ở bản dev).')
            }}
          >
            Dùng dữ liệu mẫu (dev)
          </button>
        )}
      </div>

      {settings.apiUrl && settings.token && <Account />}

      {decks.length > 0 && settings.userKey && <ImportProgress />}

      <div className="card">
        <h3>Học</h3>
        <label className="field">
          Giọng đọc
          <div className="actions">
            <select value={settings.voice} onChange={(e) => saveSettings({ voice: e.target.value as 'en-GB' | 'en-US' })}>
              <option value="en-GB">Anh – Anh</option>
              <option value="en-US">Anh – Mỹ</option>
            </select>
            <button onClick={() => speak('vocabulary', settings.voice)}>Nghe thử</button>
          </div>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.translateTick} onChange={(e) => saveSettings({ translateTick: e.target.checked })} />
          Hiện ô tick "Đã dịch lại bài" mỗi ngày cho các buổi
        </label>
      </div>

      <div className="card">
        <h3>Đồng bộ</h3>
        <p className="row-sub">
          Máy này: {settings.device} · chờ gửi: {outbox.length}
          {lastSync && ` · lần cuối ${new Date(lastSync).toLocaleString('vi-VN')}`}
        </p>
        <button onClick={() => void sync()} disabled={!settings.apiUrl || syncing}>
          {syncing ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}
        </button>
      </div>

      <div className="card">
        <h3>Sao lưu</h3>
        <p className="row-sub">Tiến độ đã nằm trong Sheet "Flashcard Progress". Đây là bản dự phòng thêm.</p>
        <div className="actions">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(exportBackup())
                setMsg('Đã sao chép dữ liệu vào clipboard.')
              } catch {
                setRestore(exportBackup())
              }
            }}
          >
            Sao chép dữ liệu
          </button>
        </div>
        <textarea className="note" placeholder="Dán dữ liệu sao lưu vào đây để khôi phục" value={restore} onChange={(e) => setRestore(e.target.value)} />
        <button
          disabled={!restore.trim()}
          onClick={() => {
            try {
              const n = importBackup(restore)
              setMsg(`Đã khôi phục ${n} sự kiện.`)
              setRestore('')
            } catch (e) {
              setMsg((e as Error).message)
            }
          }}
        >
          Khôi phục
        </button>
      </div>
    </div>
  )
}

/** Declare progress made before the app (e.g. B1-B5 done, B6 at 5/7). */
function ImportProgress() {
  const { decks } = useStore()
  const cycles = useCycles(useToday())
  const fresh = decks.filter((d) => cycles.get(d.id)?.phase === 'new')
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)

  if (!fresh.length) return null

  const save = () => {
    let n = 0
    for (const [deckId, v] of Object.entries(choice)) {
      if (v === '' || v === 'none') continue
      addEvent('import', deckId, { doneDays: Number(v) })
      n++
    }
    setChoice({})
    alert(n ? `Đã lưu tiến độ cho ${n} bài.` : 'Chưa chọn bài nào.')
  }

  return (
    <div className="card">
      <h3>Khai báo tiến độ cũ</h3>
      <p className="row-sub">Đánh dấu những bài bạn đã học trước khi dùng app. Bài đang ôn dở sẽ tiếp tục từ ngày tiếp theo.</p>
      <button className="link" onClick={() => setOpen(!open)}>
        {open ? 'Thu gọn' : `Mở danh sách (${fresh.length} bài chưa bắt đầu)`}
      </button>
      {open && (
        <>
          {fresh.map((d) => (
            <div key={d.id} className="row">
              <div className="grow">
                <div className="row-title">{d.title}</div>
                {d.section === 'grammar' && <div className="row-sub">{d.kind === 'irregular' ? 'Động từ BQT' : d.group}</div>}
              </div>
              <select value={choice[d.id] ?? 'none'} onChange={(e) => setChoice({ ...choice, [d.id]: e.target.value })}>
                <option value="none">Chưa học</option>
                <option value="7">Xong 7/7</option>
                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    Đang ôn {n}/7
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button className="primary block" onClick={save}>
            Lưu tiến độ
          </button>
        </>
      )}
    </div>
  )
}

function Account() {
  const { settings, outbox, syncing } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const run = async (mode: 'login' | 'register') => {
    setBusy(true)
    setMsg('')
    try {
      await signIn(mode, username, password)
      setPassword('')
      setMsg(mode === 'register' ? 'Đã tạo tài khoản và đăng nhập.' : 'Đã đăng nhập.')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    if (outbox.length) await sync()
    const left = getState().outbox.length
    if (left && !confirm(`Còn ${left} hoạt động chưa gửi lên máy chủ (đang mất mạng?). Đăng xuất sẽ mất chúng. Vẫn đăng xuất?`)) return
    signOut()
    setMsg('Đã đăng xuất.')
  }

  if (settings.userKey) {
    return (
      <div className="card">
        <h3>Tài khoản</h3>
        <p>
          Đang học với tài khoản <b>{settings.user}</b>. Tiến độ của bạn được lưu riêng và đồng bộ giữa các máy đăng nhập cùng
          tài khoản.
        </p>
        <button onClick={logout} disabled={syncing}>
          Đăng xuất
        </button>
        {msg && <p className="row-sub">{msg}</p>}
      </div>
    )
  }

  return (
    <div className="card">
      <h3>Tài khoản</h3>
      <p className="row-sub">
        Mỗi người một tài khoản để tiến độ không lẫn vào nhau. Chưa có thì nhập tên + mật khẩu rồi bấm "Tạo tài khoản".
      </p>
      <label className="field">
        Tên đăng nhập
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" />
      </label>
      <label className="field">
        Mật khẩu
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </label>
      <div className="actions">
        <button className="primary" disabled={busy || !username || !password} onClick={() => run('login')}>
          Đăng nhập
        </button>
        <button disabled={busy || !username || !password} onClick={() => run('register')}>
          Tạo tài khoản
        </button>
      </div>
      {msg && <p className="row-sub">{msg}</p>}
    </div>
  )
}

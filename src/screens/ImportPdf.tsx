import { useEffect, useState } from 'react'
import { IMPORT_PREFIX } from '../config'
import { ApiError } from '../lib/api'
import { extractVocab, pdfPages, preloadPdf, scannedPages, type VocabRow } from '../lib/pdfvocab'
import { importWords, uid, useStore } from '../lib/store'
import { TopBar, useNav } from '../ui'

interface EditRow extends VocabRow {
  key: string
  keep: boolean
}

const blank = (): EditRow => ({ key: uid(), word: '', ipa: '', pos: '', meaning: '', sure: true, keep: true })

/**
 * PDF → word list → tab "[DVL] <name>" in the vocabulary Sheet.
 * Only lines with an IPA transcription are taken; everything can be fixed before saving.
 */
export function ImportPdf() {
  const { settings, decks } = useStore()
  const { back, go } = useNav()
  const [rows, setRows] = useState<EditRow[]>([])
  const [lines, setLines] = useState<string[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<'' | 'reading' | 'saving'>('')
  const [msg, setMsg] = useState('')
  /** Neutral note (e.g. some pages look scanned), as opposed to `msg` errors. */
  const [note, setNote] = useState('')
  const [savedDeck, setSavedDeck] = useState('')
  const [pasted, setPasted] = useState('')

  useEffect(preloadPdf, [])

  const read = async (file: File) => {
    setBusy('reading')
    setMsg('')
    setNote('')
    setSavedDeck('')
    try {
      const pages = await pdfPages(await file.arrayBuffer())
      const text = pages.flatMap((p) => [...p, ''])
      const found = extractVocab(text)
      const scanned = scannedPages(pages)
      setLines(text)
      setRows(found.map((r) => ({ ...r, key: uid(), keep: r.sure })))
      setName(file.name.replace(/\.pdf$/i, '').replace(/[_\s]+/g, ' ').trim().slice(0, 80))
      const scanList = scanned.length === 1 ? `Trang ${scanned[0]}` : `Các trang ${scanned.join(', ')}`
      if (!found.length && scanned.length === pages.length) {
        setMsg('PDF này gần như không có chữ (có thể là ảnh scan), app chưa đọc được. Bạn có thể thêm từ bằng tay bên dưới.')
      } else if (!found.length) {
        setMsg(
          `Không thấy dòng nào có phiên âm IPA.${scanned.length ? ` ${scanList} gần như không có chữ (có thể là ảnh scan).` : ''} Xem "Chữ đọc được từ PDF" ở cuối trang, hoặc thêm từ bằng tay.`,
        )
      } else if (scanned.length) {
        setNote(`${scanList} có vẻ là ảnh scan nên app không đọc được. Nếu có từ ở đó, hãy thêm bằng tay.`)
      }
    } catch (e) {
      setMsg(`Không đọc được PDF: ${(e as Error).message}`)
    } finally {
      setBusy('')
    }
  }

  /** Text copied from anywhere (e.g. Google Lens on a screenshot) goes through the same extractor. */
  const readPasted = () => {
    const text = pasted.split(/\r?\n/)
    const found = extractVocab(text)
    setMsg('')
    setNote('')
    setSavedDeck('')
    setLines(text)
    setRows(found.map((r) => ({ ...r, key: uid(), keep: r.sure })))
    if (!found.length) setMsg('Không thấy dòng nào có phiên âm IPA. Kiểm tra lại đoạn chữ, hoặc thêm từ bằng tay bên dưới.')
  }

  const update = (key: string, patch: Partial<EditRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const chosen = rows.filter((r) => r.keep && r.word.trim())
  const cleanName = name.replace(/\s+/g, ' ').trim()
  const tabName = `${IMPORT_PREFIX} ${cleanName}`

  const save = async () => {
    setBusy('saving')
    setMsg('')
    const data = chosen.map((r) => [r.word, r.ipa, r.pos, r.meaning].map((s) => s.trim()) as [string, string, string, string])
    try {
      let deckId: string
      try {
        deckId = await importWords(cleanName, data)
      } catch (e) {
        if (!(e instanceof ApiError && e.code === 'tab exists')) throw e
        if (!confirm(`Sheet đã có tab "${tabName}". Ghi đè bằng danh sách này?`)) return
        deckId = await importWords(cleanName, data, true)
      }
      setSavedDeck(deckId)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  if (savedDeck) {
    const ready = decks.some((d) => d.id === savedDeck)
    return (
      <div className="screen">
        <TopBar title="Nhập từ PDF" onBack={back} />
        <div className="card center">
          <h2>Đã lưu {chosen.length} từ</h2>
          <p>
            Tab <b>{tabName}</b> đã được tạo trong Sheet từ vựng.
          </p>
          {!ready && <p className="row-sub">Chưa tải lại được danh sách từ. Vào Cài đặt › Tải lại danh sách từ.</p>}
          <div className="actions">
            {ready && (
              <button className="primary" onClick={() => go({ name: 'deck', deckId: savedDeck })}>
                Mở bài
              </button>
            )}
            <button onClick={back}>Xong</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <TopBar title="Nhập từ PDF" onBack={back} />
      {!settings.userKey && <div className="banner warn">Cần đăng nhập để lưu vào Sheet (vẫn xem trước được).</div>}

      <div className="card">
        <p className="row-sub">
          Chọn file PDF bài học. App lấy các dòng có phiên âm (từ – /IPA/ – nghĩa) và bỏ qua bài đọc. Kiểm tra lại rồi lưu thành
          tab mới <b>{IMPORT_PREFIX} …</b> trong Sheet.
        </p>
        <label className="file-pick">
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={!!busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void read(f)
            }}
          />
          <span className="button primary block">{busy === 'reading' ? 'Đang đọc PDF…' : rows.length ? 'Chọn file khác' : 'Chọn file PDF'}</span>
        </label>
        {msg && <p className="row-sub bad-text">{msg}</p>}
        {note && <p className="row-sub">{note}</p>}
      </div>

      <details className="card">
        <summary>Hoặc dán chữ (file không tải được)</summary>
        <p className="row-sub">
          Chụp màn hình phần từ vựng → mở Google Lens → "Sao chép văn bản" → dán vào đây. Mỗi từ một dòng, dạng: từ /IPA/ (loại từ): nghĩa.
        </p>
        <textarea
          lang="en"
          rows={6}
          value={pasted}
          placeholder={'1. Garden /ˈɡɑː.dən/ (n): khu vườn\n2. Borrow /ˈbɒr.əʊ/ (v): mượn, vay'}
          onChange={(e) => setPasted(e.target.value)}
        />
        <button className="block" disabled={!pasted.trim() || !!busy} onClick={readPasted}>
          Tách từ
        </button>
      </details>

      {(rows.length > 0 || lines.length > 0) && (
        <>
          <div className="card">
            <label className="field">
              Tên bài
              <input lang="vi" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </label>
            <p className="row-sub">
              Tab trong Sheet: <b>{tabName}</b>
            </p>
          </div>

          <h3 className="section-title">
            Từ tìm được · chọn {chosen.length}/{rows.length}
          </h3>
          {rows.map((r, i) => (
            <div key={r.key} className={`card vocab-edit ${r.keep ? '' : 'off'}`}>
              <div className="vocab-edit-head">
                <label className="check small">
                  <input type="checkbox" checked={r.keep} onChange={(e) => update(r.key, { keep: e.target.checked })} />
                  {i + 1}
                </label>
                {!r.sure && <span className="chip warn">Kiểm tra lại</span>}
                <button className="link danger" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                  Xoá
                </button>
              </div>
              <div className="vocab-edit-grid">
                <input
                  lang="en"
                  placeholder="Từ tiếng Anh"
                  value={r.word}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => update(r.key, { word: e.target.value })}
                />
                <input placeholder="/IPA/" value={r.ipa} spellCheck={false} onChange={(e) => update(r.key, { ipa: e.target.value })} />
                <input
                  lang="en"
                  placeholder="Loại từ"
                  value={r.pos}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => update(r.key, { pos: e.target.value })}
                />
                <input lang="vi" placeholder="Nghĩa tiếng Việt" value={r.meaning} onChange={(e) => update(r.key, { meaning: e.target.value })} />
              </div>
            </div>
          ))}
          <button className="block" onClick={() => setRows((rs) => [...rs, blank()])}>
            + Thêm từ
          </button>

          <div className="card">
            <button
              className="primary block"
              disabled={!!busy || !settings.userKey || !chosen.length || !cleanName}
              onClick={() => void save()}
            >
              {busy === 'saving' ? 'Đang lưu…' : `Lưu ${chosen.length} từ vào Sheet`}
            </button>
          </div>

          {lines.some((l) => l.trim()) && (
            <details className="card pdf-text">
              <summary>Chữ đọc được từ PDF ({lines.filter((l) => l.trim()).length} dòng)</summary>
              <button className="link" onClick={() => void navigator.clipboard?.writeText(lines.join('\n')).catch(() => {})}>
                Sao chép
              </button>
              <pre>{lines.join('\n')}</pre>
            </details>
          )}
        </>
      )}
    </div>
  )
}

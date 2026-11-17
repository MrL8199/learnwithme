import type { RawTab, StudyEvent } from './types'

/**
 * Client for the Apps Script web app (apps-script/Code.gs).
 * GET is a simple CORS request; POST uses text/plain so the browser sends no preflight
 * (Apps Script cannot answer OPTIONS).
 */
async function get<T>(url: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${url}?${new URLSearchParams(params)}`, { redirect: 'follow' })
  return unwrap<T>(res)
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  })
  return unwrap<T>(res)
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  let json: { ok: boolean; error?: string } & T
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Phản hồi không phải JSON — kiểm tra lại URL Apps Script (phải kết thúc bằng /exec) và quyền truy cập "Anyone".')
  }
  if (!json.ok) throw new Error(json.error === 'bad token' ? 'Sai mã bí mật' : json.error || 'Lỗi không rõ')
  return json
}

export function fetchSheet(url: string, token: string) {
  return get<{ tabs: RawTab[] }>(url, { action: 'data', token })
}

export function fetchEvents(url: string, token: string) {
  return get<{ events: StudyEvent[] }>(url, { action: 'events', token })
}

export function pushEvents(url: string, token: string, events: StudyEvent[]) {
  return post<{ added: number }>(url, { action: 'append', token, events })
}

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
  if (!json.ok) throw new ApiError(json.error ?? 'unknown')
  return json
}

const MESSAGES: Record<string, string> = {
  'bad token': 'Sai mã nhóm',
  'bad key': 'Phiên đăng nhập không còn hợp lệ, hãy đăng nhập lại',
  'bad login': 'Sai tên đăng nhập hoặc mật khẩu',
  'username taken': 'Tên đăng nhập đã có người dùng',
  'bad username': 'Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, dấu . _ -',
  'weak password': 'Mật khẩu cần ít nhất 4 ký tự',
  'unknown action': 'Apps Script đang là bản cũ: dán Code.gs mới và triển khai phiên bản mới',
}

export class ApiError extends Error {
  constructor(public code: string) {
    super(MESSAGES[code] ?? code)
  }
}

/** Vocabulary tabs: with the group code, or with a personal key once logged in. */
export function fetchSheet(url: string, auth: { token?: string; key?: string }) {
  const params: Record<string, string> = { action: 'data' }
  if (auth.key) params.key = auth.key
  else if (auth.token) params.token = auth.token
  return get<{ tabs: RawTab[] }>(url, params)
}

/** The logged-in person's own events only. */
export function fetchEvents(url: string, key: string) {
  return get<{ events: StudyEvent[] }>(url, { action: 'events', key })
}

export function pushEvents(url: string, key: string, events: StudyEvent[]) {
  return post<{ added: number }>(url, { action: 'append', key, events })
}

export function account(url: string, mode: 'login' | 'register', token: string, username: string, password: string) {
  return post<{ user: string; key: string }>(url, { action: mode, token, username, password })
}

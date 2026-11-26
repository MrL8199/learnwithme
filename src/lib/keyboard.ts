/**
 * Keyboard language per field: a field with lang="en" asks the phone keyboard for English,
 * lang="vi" for Vietnamese; a field without its own lang attribute leaves the keyboard as is.
 *
 * Only the Android app can pass this to the keyboard: its WebView (LangWebView.java) exposes
 * window.FlashcardKeyboard and sets EditorInfo.hintLocales. On the web this does nothing.
 */
declare global {
  interface Window {
    FlashcardKeyboard?: { setLang(lang: string): void }
  }
}

export function installKeyboardLang() {
  const bridge = typeof window === 'undefined' ? undefined : window.FlashcardKeyboard
  if (!bridge) return
  // Capture phase, before the keyboard opens: the bridge call is synchronous.
  document.addEventListener(
    'focusin',
    (e) => {
      const el = e.target
      const field = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      const lang = field && el.type !== 'password' ? (el.getAttribute('lang') ?? '') : ''
      try {
        bridge.setLang(lang)
      } catch {
        /* older app build */
      }
    },
    true,
  )
}

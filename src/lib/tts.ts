import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

/**
 * Text to speech: the browser's speechSynthesis on the web, the phone's TTS engine in the
 * Android app (the Android WebView has no speechSynthesis).
 */
const native = Capacitor.isNativePlatform()
/** Native only: whether the TTS engine has Vietnamese (undefined until known). */
let nativeVi: boolean | undefined

if (native) {
  // The engine starts asynchronously; ask once it has had time to load.
  setTimeout(() => {
    TextToSpeech.isLanguageSupported({ lang: 'vi-VN' })
      .then((r) => {
        nativeVi = r.supported
      })
      .catch(() => {})
  }, 1500)
}

let voices: SpeechSynthesisVoice[] = []

function loadVoices() {
  if (typeof speechSynthesis === 'undefined') return
  voices = speechSynthesis.getVoices()
}
if (typeof speechSynthesis !== 'undefined') {
  loadVoices()
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
}

export const canSpeak = () => native || typeof speechSynthesis !== 'undefined'

function findVoice(lang: string): SpeechSynthesisVoice | undefined {
  const norm = (l: string) => l.replace('_', '-').toLowerCase()
  const want = norm(lang)
  const base = want.split('-')[0]
  return voices.find((v) => norm(v.lang) === want) ?? voices.find((v) => norm(v.lang).startsWith(base))
}

/** True when the device has a Vietnamese voice (unknown → true, voices may load late). */
export function hasVietnameseVoice(): boolean {
  if (native) return nativeVi !== false
  if (!canSpeak()) return false
  if (!voices.length) loadVoices()
  return !voices.length || !!findVoice('vi-VN')
}

function say(text: string, lang: string) {
  if (!canSpeak() || !text.trim()) return
  if (native) {
    if (lang.startsWith('vi') && nativeVi === false) return
    TextToSpeech.speak({ text, lang, rate: 0.9 }).catch(() => {
      // Unsupported language (no Vietnamese voice installed): stay silent from now on.
      if (lang.startsWith('vi')) nativeVi = false
    })
    return
  }
  if (!voices.length) loadVoices()
  const voice = findVoice(lang)
  // No Vietnamese voice: an English voice would mangle the text, so stay silent.
  if (!voice && voices.length && !lang.startsWith('en')) return
  // TTS is a nice-to-have: a broken voice engine must never break a study screen.
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 0.9
    if (voice) u.voice = voice
    speechSynthesis.speak(u)
  } catch {
    /* ignore */
  }
}

/** Read an English word aloud with the device's TTS voice. */
export function speak(text: string, lang: 'en-GB' | 'en-US' = 'en-GB') {
  say(text.split('\n')[0].replace(/\+/g, ' ').replace(/\s*\/\s*/g, ', '), lang)
}

/** Read a Vietnamese meaning aloud. */
export function speakVi(text: string) {
  say(text, 'vi-VN')
}

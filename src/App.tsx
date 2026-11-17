import { useCallback, useEffect, useMemo, useState } from 'react'
import { refreshIfStale } from './lib/store'
import { Copy } from './screens/Copy'
import { DeckDetail } from './screens/DeckDetail'
import { DeckList } from './screens/DeckList'
import { Read } from './screens/Read'
import { Settings } from './screens/Settings'
import { TestRun } from './screens/TestRun'
import { Today } from './screens/Today'
import { NavContext, type Route, type Tab } from './ui'

const TABS: { tab: Tab; label: string; icon: string }[] = [
  { tab: 'today', label: 'Hôm nay', icon: '◉' },
  { tab: 'vocab', label: 'Từ vựng', icon: '▤' },
  { tab: 'grammar', label: 'Ngữ pháp', icon: '§' },
  { tab: 'settings', label: 'Cài đặt', icon: '⚙' },
]

export function App() {
  const [stack, setStack] = useState<Route[]>([{ name: 'tab', tab: 'today' }])

  // Phone back button / swipe-back pops our stack.
  useEffect(() => {
    const onPop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    refreshIfStale()
    const onVis = () => document.visibilityState === 'visible' && refreshIfStale()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', refreshIfStale)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', refreshIfStale)
    }
  }, [])

  const go = useCallback((r: Route) => {
    if (r.name === 'tab') {
      setStack([r])
      return
    }
    history.pushState({ depth: Date.now() }, '')
    setStack((s) => [...s, r])
  }, [])
  const back = useCallback(() => history.back(), [])
  const nav = useMemo(() => ({ go, back }), [go, back])

  const route = stack[stack.length - 1]
  const rootTab = stack[0].name === 'tab' ? stack[0].tab : 'today'
  useEffect(() => {
    window.scrollTo(0, 0) // returns a Promise in newer Chrome: must not be returned from the effect
  }, [stack])

  let screen: React.ReactNode
  switch (route.name) {
    case 'tab':
      screen =
        route.tab === 'today' ? <Today /> : route.tab === 'vocab' ? <DeckList section="vocab" /> : route.tab === 'grammar' ? <DeckList section="grammar" /> : <Settings />
      break
    case 'deck':
      screen = <DeckDetail key={route.deckId} deckId={route.deckId} />
      break
    case 'read':
      screen = <Read key={route.deckId} deckId={route.deckId} />
      break
    case 'copy':
      screen = <Copy key={route.deckId} deckId={route.deckId} />
      break
    case 'test':
      screen = <TestRun key={route.deckId} deckId={route.deckId} />
      break
  }

  const studying = route.name === 'read' || route.name === 'copy' || route.name === 'test'

  return (
    <NavContext.Provider value={nav}>
      <main className={studying ? 'studying' : ''}>{screen}</main>
      {!studying && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <button
              key={t.tab}
              className={route.name === 'tab' && rootTab === t.tab ? 'active' : stack.length > 1 && rootTab === t.tab ? 'active' : ''}
              onClick={() => go({ name: 'tab', tab: t.tab })}
            >
              <span className="tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </NavContext.Provider>
  )
}

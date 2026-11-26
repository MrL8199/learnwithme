import { IMPORTED_GROUP } from '../lib/parse'
import { useStore } from '../lib/store'
import type { Deck } from '../lib/types'
import { Chip, TopBar, useCycles, useNav, useToday } from '../ui'

function groupName(d: Deck): string {
  if (d.kind === 'irregular') return 'Động từ bất quy tắc'
  return d.group
}

export function DeckList({ section }: { section: 'vocab' | 'grammar' }) {
  const { decks } = useStore()
  const today = useToday()
  const cycles = useCycles(today)
  const { go } = useNav()
  const list = decks.filter((d) => d.section === section)

  const groups = new Map<string, Deck[]>()
  for (const d of list) {
    const g = section === 'grammar' ? groupName(d) : d.group === IMPORTED_GROUP ? 'Nhập từ PDF' : 'Các buổi học'
    groups.set(g, [...(groups.get(g) ?? []), d])
  }

  return (
    <div className="screen">
      <TopBar
        title={section === 'vocab' ? 'Từ vựng' : 'Ngữ pháp & động từ'}
        right={
          section === 'vocab' && (
            <button className="link" onClick={() => go({ name: 'import' })}>
              + PDF
            </button>
          )
        }
      />
      {!list.length && <p className="summary">Chưa có dữ liệu. Kết nối Sheet trong Cài đặt.</p>}
      {[...groups.entries()].map(([g, ds]) => (
        <section key={g}>
          <h3 className="section-title">{g}</h3>
          {ds.map((d) => (
            <div key={d.id} className="row clickable" onClick={() => go({ name: 'deck', deckId: d.id })}>
              <div className="grow">
                <div className="row-title">{d.title}</div>
                <div className="row-sub">{d.items.length} mục</div>
              </div>
              <Chip s={cycles.get(d.id)!} />
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

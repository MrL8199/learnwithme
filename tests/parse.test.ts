import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cleanMeaning, parseSheet } from '../src/lib/parse'
import type { RawTab } from '../src/lib/types'

// The real sheet export is git-ignored (personal data); these tests run only where it exists.
const FIXTURE = new URL('./fixtures/sheet.json', import.meta.url)
const hasFixture = existsSync(FIXTURE)
const decks = hasFixture ? parseSheet((JSON.parse(readFileSync(FIXTURE, 'utf8')) as { tabs: RawTab[] }).tabs) : []
const byId = (id: string) => decks.find((d) => d.id === id)!

describe.skipIf(!hasFixture)('parseSheet on the real sheet', () => {
  it('reads every B tab as a session, in order', () => {
    const s = decks.filter((d) => d.kind === 'session')
    expect(s.map((d) => d.title)).toEqual(['Buổi 1', 'Buổi 2', 'Buổi 3', 'Buổi 4', 'Buổi 5', 'Buổi 6', 'Buổi 7', 'Buổi 8'])
    expect(byId('S:B1').items).toHaveLength(9)
    expect(byId('S:B8').items).toHaveLength(53)
    const first = byId('S:B1').items[0]
    expect(first).toMatchObject({ word: 'film star', ipa: '/fɪlm stɑːr/', pos: 'noun', meaning: 'ngôi sao điện ảnh' })
  })

  it('ignores the 7 Lượt columns and the draft tab', () => {
    expect(decks.some((d) => d.group === 'Trang tính5' || d.title.includes('Trang'))).toBe(false)
    expect(byId('S:B6').items.every((i) => !/^[01]$/.test(i.meaning))).toBe(true)
  })

  it('splits adj + adv by PHÂN LOẠI', () => {
    const g = decks.filter((d) => d.group === 'adj + adv')
    expect(g[0].title).toBe('Trạng từ chỉ tần suất')
    expect(g[0].items.map((i) => i.word)).toContain('hardly ever')
    expect(g.length).toBeGreaterThanOrEqual(8)
  })

  it('reads the to V + Ving matrix into pattern groups', () => {
    const p = decks.filter((d) => d.group === 'to V + Ving')
    const titles = p.map((d) => d.title)
    expect(titles).toContain('V + To + V')
    expect(titles).toContain('V + O + V')
    const toV = p.find((d) => d.title === 'V + To + V')!
    expect(toV.items.map((i) => i.word)).toContain('agree')
    expect(toV.items.map((i) => i.word)).not.toContain('mỗi đọc 2 lần trong 2 tuần liên tiếp')
    const rule = p.find((d) => d.kind === 'rule')!
    expect(rule.items.length).toBeGreaterThan(5)
    const help = p.flatMap((d) => d.items).find((i) => i.word === 'help')!
    expect(help.patterns!.length).toBeGreaterThan(1)
  })

  it('splits irregular verbs into parts of 20 with V2/V3', () => {
    const irr = decks.filter((d) => d.kind === 'irregular')
    expect(irr.length).toBeGreaterThanOrEqual(4)
    expect(irr[0].items).toHaveLength(20)
    const be = irr[0].items.find((i) => i.word === 'be')!
    expect(be).toMatchObject({ v2: 'was / were', v3: 'been' })
    expect(irr[0].items.find((i) => i.word === 'beat')!.meaning).toBe('đánh, thắng')
  })

})

describe('cleanMeaning', () => {
  it('joins multi-line meanings', () => {
    expect(cleanMeaning('chương trình,\nkế hoạch,\ncơ chế')).toBe('chương trình, kế hoạch, cơ chế')
  })
})

describe('tabs imported from PDFs', () => {
  const tabs: RawTab[] = [
    { name: 'B1', values: [['TỪ VỰNG', 'CÁCH ĐỌC', 'LOẠI TỪ', 'NGHĨA'], ['film star', '/fɪlm stɑːr/', 'noun', 'ngôi sao điện ảnh']] },
    {
      name: '[DVL] Unit 3 – to V or Ving',
      values: [
        ['TỪ VỰNG', 'CÁCH ĐỌC', 'LOẠI TỪ', 'NGHĨA'],
        ['sustainable', '/səˈsteɪnəbl/', 'adj', 'bền vững'],
        ['take off', '/teɪk ɒf/', 'phr v', 'cất cánh'],
      ],
    },
  ]
  const decks = parseSheet(tabs)

  it('are vocabulary sessions listed after the B tabs, even when the name looks like a grammar tab', () => {
    expect(decks.map((d) => [d.id, d.kind, d.section, d.title])).toEqual([
      ['S:B1', 'session', 'vocab', 'Buổi 1'],
      ['S:[DVL] Unit 3 – to V or Ving', 'session', 'vocab', 'Unit 3 – to V or Ving'],
    ])
    expect(decks[1].items[1]).toMatchObject({ word: 'take off', ipa: '/teɪk ɒf/', pos: 'phr v', meaning: 'cất cánh' })
  })
})

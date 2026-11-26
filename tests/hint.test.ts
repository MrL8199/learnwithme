import { describe, expect, it } from 'vitest'
import { maskHint, maxHintLevel } from '../src/lib/hint'

describe('maskHint', () => {
  it('shows the shape, then more letters per level', () => {
    expect(maskHint('visit', 0)).toBe('_____')
    expect(maskHint('visit', 1)).toBe('v____')
    expect(maskHint('visit', 3)).toBe('vis__')
  })

  it('reveals the start of every word and keeps separators', () => {
    expect(maskHint('take off', 1)).toBe('t___ o__')
    expect(maskHint("well-known driver's", 2)).toBe("we__-kn___ dr____'s")
    expect(maskHint('was/were – been', 1)).toBe('w__/w___ – b___')
  })

  it('max level keeps one letter of the longest word hidden', () => {
    expect(maxHintLevel('visit')).toBe(4)
    expect(maxHintLevel('take off')).toBe(3)
    expect(maskHint('take off', maxHintLevel('take off'))).toBe('tak_ off')
  })
})

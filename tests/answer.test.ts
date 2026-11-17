import { describe, expect, it } from 'vitest'
import { answersFor, isCorrect, isNear } from '../src/lib/answer'

describe('answers', () => {
  it('ignores case, spaces, trailing punctuation and a leading "to"', () => {
    expect(isCorrect('  Hardly   Ever ', ['hardly ever'])).toBe(true)
    expect(isCorrect('decide', ['to decide'])).toBe(true)
    expect(isCorrect('to be in need', ['to be in need'])).toBe(true)
    expect(isCorrect('', ['x'])).toBe(false)
  })
  it('expands slash alternatives', () => {
    expect(answersFor('think of/about')).toEqual(['think of/about', 'think of', 'think about'])
    expect(answersFor('was / were')).toEqual(['was / were', 'was', 'were'])
    expect(isCorrect('were', answersFor('was / were'))).toBe(true)
    expect(isCorrect('was/were', answersFor('was / were'))).toBe(true)
  })
  it('uses only the first line and drops parentheses', () => {
    expect(answersFor('it is wise + to V\n(=should)')).toEqual(['it is wise + to V'])
  })
  it('flags near misses', () => {
    expect(isNear('recieve', ['receive'])).toBe(true)
    expect(isNear('cat', ['dog'])).toBe(false)
  })
})

import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { extractVocab, linesFromBits, parseLine, pdfLines } from '../src/lib/pdfvocab'

const one = (line: string) => {
  const rows = parseLine(line)
  expect(rows).toHaveLength(1)
  return rows[0]
}

describe('parseLine', () => {
  it('word /ipa/ (pos): meaning', () => {
    expect(one('abandon /əˈbændən/ (v): từ bỏ')).toEqual({ word: 'abandon', ipa: '/əˈbændən/', pos: 'v', meaning: 'từ bỏ', sure: true })
  })

  it('numbering, pos before the IPA, dash separator', () => {
    expect(one('1. take off (phr v) /teɪk ɒf/ - cất cánh; cởi (quần áo)')).toMatchObject({
      word: 'take off',
      ipa: '/teɪk ɒf/',
      pos: 'phr v',
      meaning: 'cất cánh; cởi (quần áo)',
    })
  })

  it('bullets, square brackets, bare pos', () => {
    expect(one('• reliable [rɪˈlaɪəbl] adj. đáng tin cậy')).toMatchObject({ word: 'reliable', ipa: '/rɪˈlaɪəbl/', pos: 'adj', meaning: 'đáng tin cậy' })
    expect(one('- curious /ˈkjʊəriəs/ adj tò mò')).toMatchObject({ word: 'curious', pos: 'adj', meaning: 'tò mò' })
  })

  it('table row split by tabs', () => {
    expect(one('3\tenvironment\t/ɪnˈvaɪrənmənt/\tn\tmôi trường')).toMatchObject({
      word: 'environment',
      ipa: '/ɪnˈvaɪrənmənt/',
      pos: 'n',
      meaning: 'môi trường',
    })
  })

  it('IPA without slashes', () => {
    expect(one('pollution pəˈluːʃn sự ô nhiễm')).toMatchObject({ word: 'pollution', ipa: '/pəˈluːʃn/', meaning: 'sự ô nhiễm' })
  })

  it('UK and US transcriptions are kept together', () => {
    expect(one('economy /ɪˈkɒnəmi/, /ɪˈkɑːnəmi/ nền kinh tế')).toMatchObject({ ipa: '/ɪˈkɒnəmi/ /ɪˈkɑːnəmi/', meaning: 'nền kinh tế' })
  })

  it('two words on one line (two-column list)', () => {
    const rows = parseLine('rely on /rɪˈlaɪ ɒn/ dựa vào\tdecline /dɪˈklaɪn/ suy giảm')
    expect(rows.map((r) => [r.word, r.meaning])).toEqual([
      ['rely on', 'dựa vào'],
      ['decline', 'suy giảm'],
    ])
  })

  it('ignores prose and slashes that are not IPA', () => {
    expect(parseLine('Students and/or teachers can use the library.')).toEqual([])
    expect(parseLine('Hôm nay chúng ta học về thì hiện tại hoàn thành.')).toEqual([])
    expect(parseLine('Choose a / an / the for each blank.')).toEqual([])
  })

  it('marks rows without a Vietnamese meaning as unsure', () => {
    expect(one('-ed is pronounced /t/ after voiceless sounds').sure).toBe(false)
  })
})

describe('extractVocab', () => {
  it('skips the reading, joins wrapped meanings, takes a meaning from the next line', () => {
    const rows = extractVocab([
      'READING: The future of cities',
      'Many cities are growing quickly. People move to cities to find work, and this creates',
      'problems such as pollution and traffic.',
      'Vocabulary',
      '1. sustainable /səˈsteɪnəbl/ (adj): bền vững, có thể duy trì',
      'lâu dài',
      '2. congestion /kənˈdʒestʃən/ (n)',
      'sự tắc nghẽn',
      '3. migrate /maɪˈɡreɪt/ (v): di cư',
      'Exercise 1. Answer the questions.',
      'Bài tập về nhà',
    ])
    expect(rows.map((r) => [r.word, r.pos, r.meaning])).toEqual([
      ['sustainable', 'adj', 'bền vững, có thể duy trì lâu dài'],
      ['congestion', 'n', 'sự tắc nghẽn'],
      ['migrate', 'v', 'di cư'],
    ])
  })

  it('drops duplicates', () => {
    expect(extractVocab(['a. vital /ˈvaɪtl/ thiết yếu', 'b. vital /ˈvaɪtl/ thiết yếu'])).toHaveLength(1)
  })
})

describe('linesFromBits', () => {
  it('groups by baseline, orders by x, tabs between distant columns', () => {
    const bits = [
      { str: 'từ bỏ', x: 300, y: 700, w: 40, h: 10 },
      { str: 'abandon', x: 50, y: 700, w: 45, h: 10 },
      { str: '/əˈbændən/', x: 100, y: 700.8, w: 60, h: 10 },
      { str: 'next', x: 50, y: 680, w: 25, h: 10 },
      { str: 'line', x: 77, y: 680, w: 20, h: 10 },
    ]
    expect(linesFromBits(bits)).toEqual(['abandon /əˈbændən/\ttừ bỏ', 'next line'])
  })

  it('puts a table row with wrapped cells back on one line', () => {
    const bit = (str: string, x: number, y: number) => ({ str, x, y, w: str.length * 5, h: 10 })
    const bits = [
      bit('1', 50, 700),
      bit('take off', 80, 700),
      bit('/teɪk ɒf/', 160, 700),
      bit('phr', 240, 700),
      bit('cất cánh; cởi', 300, 700),
      bit('v', 240, 688),
      bit('(quần áo)', 300, 688),
      bit('2', 50, 670),
      bit('decline', 80, 670),
      bit('/dɪ', 160, 670),
      bit('n', 240, 670),
      bit('sự suy giảm', 300, 670),
      bit('ˈklaɪn/', 160, 658),
    ]
    expect(linesFromBits(bits)).toEqual([
      '1\ttake off\t/teɪk ɒf/\tphr v\tcất cánh; cởi (quần áo)',
      '2\tdecline\t/dɪˈklaɪn/\tn\tsự suy giảm',
    ])
  })
})

// End to end on a real PDF (generated from tests/fixtures/vocab-sample.html with headless Chrome).
const SAMPLE = new URL('./fixtures/vocab-sample.pdf', import.meta.url)
describe.skipIf(!existsSync(SAMPLE))('pdfLines + extractVocab on a sample PDF', () => {
  it('finds the word list below the reading', async () => {
    const buf = readFileSync(SAMPLE)
    const lines = await pdfLines(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
    const rows = extractVocab(lines)
    expect(rows.map((r) => r.word)).toEqual(['sustainable', 'congestion', 'migrate', 'take off', 'environment', 'reliable'])
    expect(rows.find((r) => r.word === 'environment')).toMatchObject({ ipa: '/ɪnˈvaɪrənmənt/', meaning: 'môi trường' })
    expect(rows.every((r) => r.sure)).toBe(true)
  })
})

// Pasted text in the "N. Word /dotted.ipa/ (pos): nghĩa" layout.
describe('pasted text', () => {
  it('reads a pasted vocabulary list with dotted IPA', () => {
    const rows = extractVocab([
      'Vocabulary',
      '1. Garden /ˈɡɑː.dən/ (n): khu vườn',
      '4. Librarian /laɪˈbreə.ri.ən/ (n): thủ thư',
      '11. Borrow /ˈbɒr.əʊ/ (v): mượn, vay',
      'Exercise: Questions',
    ])
    expect(rows.map((r) => [r.word, r.ipa, r.pos, r.meaning, r.sure])).toEqual([
      ['Garden', '/ˈɡɑː.dən/', 'n', 'khu vườn', true],
      ['Librarian', '/laɪˈbreə.ri.ən/', 'n', 'thủ thư', true],
      ['Borrow', '/ˈbɒr.əʊ/', 'v', 'mượn, vay', true],
    ])
  })
})

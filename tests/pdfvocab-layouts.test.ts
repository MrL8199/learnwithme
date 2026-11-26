// Regression tests from stress-testing the extractor on 10 realistic lesson-PDF layouts.
import { describe, expect, it } from 'vitest'

import * as M from '../src/lib/pdfvocab'
const { extractVocab, linesFromBits, parseLine } = M
type Bit = { str: string; x: number; y: number; w: number; h: number }
const bit = (str: string, x: number, y: number, h = 12): Bit => ({ str, x, y, w: str.length * 5, h })
const rows = (lines: string[]) => extractVocab(lines).map((r: any) => [r.word, r.ipa, r.pos, r.meaning, r.sure])
const ticked = (lines: string[]) => extractVocab(lines).filter((r: any) => r.sure).map((r: any) => r.word)

describe('PUA: Word Symbol/Wingdings bullets', () => {
  it('a bullet glued to the text', () => {
    expect(parseLine(' pick out /pɪk aʊt/ (phr v) - chọn ra, lựa ra').map((r: any) => [r.word, r.pos, r.meaning])).toEqual([
      ['pick out', 'phr v', 'chọn ra, lựa ra'],
    ])
  })
  it('a bullet far enough left to be its own cell does not turn the list into a table', () => {
    const bits = [
      { str: '', x: 100, y: 370.289, w: 10.3, h: 13 },
      bit('manufacture /ˌmænjuˈfæktʃə(r)/ (v) - sản xuất (hàng loạt, bằng máy móc', 125, 370.289, 13),
      bit('trong nhà máy)', 125, 353.089, 13),
      { str: '', x: 100, y: 335.939, w: 10.3, h: 13 },
      bit('demand /dɪˈmɑːnd/ (n) - nhu cầu (của thị trường)', 125, 335.939, 13),
    ]
    expect(rows(linesFromBits(bits))).toEqual([
      ['manufacture', '/ˌmænjuˈfæktʃə(r)/', 'v', 'sản xuất (hàng loạt, bằng máy móc trong nhà máy)', true],
      ['demand', '/dɪˈmɑːnd/', 'n', 'nhu cầu (của thị trường)', true],
    ])
  })
})

describe('RUN + PAGEKEEP: page breaks', () => {
  it('a meaning goes on after the page break', () => {
    expect(rows(['15. expiry date /ɪkˈspaɪəri deɪt/ (n): hạn sử dụng (sau ngày này thực phẩm không còn an', '', 'toàn để ăn)'])).toEqual([
      ['expiry date', '/ɪkˈspaɪəri deɪt/', 'n', 'hạn sử dụng (sau ngày này thực phẩm không còn an toàn để ăn)', true],
    ])
  })
  it('running header/footer pieces go, body text next to them stays', () => {
    const view = [0, 0, 595, 842]
    const page = (n: number, body: Bit[]) => ({
      view,
      bits: [bit('Unit 8 – The Hidden Cost of Food Waste', 57, 805, 9), bit(`Trang ${n}/5`, 280, 30, 9), ...body],
    })
    const out = M.dropRunning([
      page(3, [bit('15. expiry date /ɪkˈspaɪəri deɪt/ (n): hạn sử dụng', 57, 700)]),
      page(4, [bit('toàn để ăn)', 70, 760), bit('dùng', 400, 33, 24)]),
    ])
    expect(out.map((bs: Bit[]) => bs.map((b) => b.str))).toEqual([['15. expiry date /ɪkˈspaɪəri deɪt/ (n): hạn sử dụng'], ['toàn để ăn)', 'dùng']])
  })
})

describe('SPLIT: two-column word list', () => {
  it('reads the left column, then the right one', () => {
    const bits = [
      bit('1. urbanisation /ˌɜːbənaɪˈzeɪʃn/ (n) sự đô thị hóa', 40, 700, 10),
      bit('9. traffic congestion /ˈtræfɪk/ (n phr) sự', 310, 700, 10),
      bit('2. commute /kəˈmjuːt/ (v) đi lại giữa nhà và', 40, 686, 10),
      bit('tắc nghẽn giao thông', 327, 686, 10),
      bit('nơi làm việc', 57, 672, 10),
      bit('10. pollution /pəˈluːʃn/ (n) sự ô nhiễm', 310, 672, 10),
      bit('3. rent /rent/ (n) tiền thuê nhà', 40, 658, 10),
      bit('11. suburb /ˈsʌbɜːb/ (n) vùng ngoại ô', 310, 658, 10),
    ]
    expect(rows(linesFromBits(bits, { x0: 0, x1: 595 })).map((r: any) => [r[0], r[3], r[4]])).toEqual([
      ['urbanisation', 'sự đô thị hóa', true],
      ['commute', 'đi lại giữa nhà và nơi làm việc', true],
      ['rent', 'tiền thuê nhà', true],
      ['traffic congestion', 'sự tắc nghẽn giao thông', true],
      ['pollution', 'sự ô nhiễm', true],
      ['suburb', 'vùng ngoại ô', true],
    ])
  })
  it('a table with IPA in one column is not split', () => {
    const bits = [0, 1, 2].flatMap((i) => [bit(`word${'abc'[i]}`, 60, 700 - 14 * i), bit('/wɜːd/', 160, 700 - 14 * i), bit('nghĩa của từ', 330, 700 - 14 * i)])
    expect(linesFromBits(bits, { x0: 0, x1: 595 })).toEqual(['worda\t/wɜːd/\tnghĩa của từ', 'wordb\t/wɜːd/\tnghĩa của từ', 'wordc\t/wɜːd/\tnghĩa của từ'])
  })
})

describe('NUM + TOP + JOIN: Word table (centred STT, top-aligned cells)', () => {
  const bits = [
    bit('STT', 91, 600),
    bit('Từ vựng', 150, 600),
    bit('Phiên âm', 260, 600),
    bit('Nghĩa', 380, 600),
    bit('1', 99.4, 576),
    bit('biodegradable', 150, 576),
    bit('/ˌbaɪəʊdɪ', 260, 576),
    bit('có thể phân hủy sinh học', 380, 576),
    bit('ˈɡreɪdəbl/', 260, 562.2),
    bit('2', 99.4, 534.4),
    bit('carbon footprint', 150, 534.4),
    bit('/ˌkɑːbən', 260, 534.4),
    bit('lượng khí thải các-bon mà', 380, 534.4),
    bit('ˈfʊtprɪnt/', 260, 520.6),
    bit('một người thải ra môi', 380, 520.6),
    bit('trường', 380, 506.8),
    bit('3', 99.4, 492.5),
    bit('microplastics', 150, 492.5),
    bit('/', 260, 492.5),
    bit('vi nhựa (túi ni-', 380, 492.5),
    bit('ˈmaɪkrəʊplæstɪk', 260, 478.7),
    bit('lông, cốc nhựa)', 380, 478.7),
    bit('s/', 260, 464.9),
    bit('10', 96.4, 450.6),
    bit('landfill', 150, 450.6),
    bit('/ˈlændfɪl/', 260, 450.6),
    bit('bãi chôn lấp rác', 380, 450.6),
  ]
  it('puts every row back together', () => {
    expect(linesFromBits(bits)).toEqual([
      'STT\tTừ vựng\tPhiên âm\tNghĩa',
      '1\tbiodegradable\t/ˌbaɪəʊdɪˈɡreɪdəbl/\tcó thể phân hủy sinh học',
      '2\tcarbon footprint\t/ˌkɑːbən ˈfʊtprɪnt/\tlượng khí thải các-bon mà một người thải ra môi trường',
      '3\tmicroplastics\t/ˈmaɪkrəʊplæstɪks/\tvi nhựa (túi ni-lông, cốc nhựa)',
      '10\tlandfill\t/ˈlændfɪl/\tbãi chôn lấp rác',
    ])
  })
})

describe('GAP: vertically centred cells', () => {
  // Row number centred on a meaning of 2 lines (±p/2) or 3 lines (±p), p = 13.8.
  const row = (n: string, word: string, ipa: string, y: number, meaning: string[], first: number) => [
    bit(n, 60, y),
    bit(word, 100, y),
    bit(ipa, 200, y),
    ...meaning.map((m, k) => bit(m, 300, first - 13.8 * k)),
  ]
  const header = (y: number) => [bit('STT', 60, y), bit('Từ vựng', 100, y), bit('Phiên âm', 200, y), bit('Nghĩa', 300, y)]
  it('2-line meanings', () => {
    const bits = [
      ...header(530),
      ...row('1', 'pollution', '/pəˈluːʃn/', 500, ['sự ô nhiễm môi', 'trường'], 506.9),
      ...row('2', 'marine', '/məˈriːn/', 470, ['thuộc về biển,', 'đại dương'], 476.9),
    ]
    expect(linesFromBits(bits)).toEqual(['STT\tTừ vựng\tPhiên âm\tNghĩa', '1\tpollution\t/pəˈluːʃn/\tsự ô nhiễm môi trường', '2\tmarine\t/məˈriːn/\tthuộc về biển, đại dương'])
  })
  it('3-line meanings', () => {
    const bits = [
      ...header(540),
      ...row('1', 'pollution', '/pəˈluːʃn/', 500, ['sự ô nhiễm', 'môi trường', 'sống'], 513.8),
      ...row('2', 'marine', '/məˈriːn/', 455, ['thuộc về', 'biển, đại', 'dương'], 468.8),
    ]
    expect(linesFromBits(bits)).toEqual(['STT\tTừ vựng\tPhiên âm\tNghĩa', '1\tpollution\t/pəˈluːʃn/\tsự ô nhiễm môi trường sống', '2\tmarine\t/məˈriːn/\tthuộc về biển, đại dương'])
  })
})

describe('STACK: word with its IPA under it in the same cell', () => {
  it('joins the IPA to the word above, also on the last row', () => {
    const bits = [
      bit('compost', 60, 700),
      bit('n', 200, 700),
      bit('phân hữu cơ, phân ủ', 260, 700),
      bit('/ˈkɒmpɒst/', 60, 688),
      bit('seedling', 60, 670),
      bit('n', 200, 670),
      bit('cây con, cây giống', 260, 670),
      bit('/ˈsiːdlɪŋ/', 60, 658),
      bit('Bài tập về nhà: học thuộc các từ trên.', 60, 620),
    ]
    expect(rows(linesFromBits(bits))).toEqual([
      ['compost', '/ˈkɒmpɒst/', 'n', 'phân hữu cơ, phân ủ', true],
      ['seedling', '/ˈsiːdlɪŋ/', 'n', 'cây con, cây giống', true],
    ])
  })
})

describe('CARDS + PAIR: cards side by side, stacked word / IPA / meaning', () => {
  it('a plain stack', () => {
    expect(rows(['rent out', '/rent aʊt/', '(phr v) cho thuê (nhà,', 'phòng, xe…)'])).toEqual([
      ['rent out', '/rent aʊt/', 'phr v', 'cho thuê (nhà, phòng, xe…)', true],
    ])
  })
  it('a grid of cards', () => {
    const bits = [
      ['rent out', 'income', 'reliable'],
      ['/rent aʊt/', '/ˈɪnkʌm/', '/rɪˈlaɪəbl/'],
      ['(phr v) cho thuê (nhà,', '(n) thu nhập', '(adj) ổn định, đáng tin'],
      ['phòng, xe…)', '', 'cậy (về chất lượng)'],
    ].flatMap((row, i) => row.flatMap((s, c) => (s ? [bit(s, 65 + 295 * c, 400 - 20 * i, 16)] : [])))
    expect(rows(linesFromBits(bits, { x0: 0, x1: 960 }))).toEqual([
      ['rent out', '/rent aʊt/', 'phr v', 'cho thuê (nhà, phòng, xe…)', true],
      ['income', '/ˈɪnkʌm/', 'n', 'thu nhập', true],
      ['reliable', '/rɪˈlaɪəbl/', 'adj', 'ổn định, đáng tin cậy (về chất lượng)', true],
    ])
  })
  it('does not pair a table line with the IPA after it', () => {
    expect(ticked(['n\tmảnh đất nhỏ thuê để trồng rau', '/əˈlɒtmənt/'])).toEqual([])
  })
})

describe('LEAD: meaning before the IPA', () => {
  it('word | meaning | IPA', () => {
    expect(rows(['densely populated\tđông dân cư\t/ˌdensli ˈpɒpjuleɪtɪd/', 'commute\tv\tđi lại hằng ngày (giữa nhà và nơi làm việc)\t/kəˈmjuːt/'])).toEqual([
      ['densely populated', '/ˌdensli ˈpɒpjuleɪtɪd/', '', 'đông dân cư', true],
      ['commute', '/kəˈmjuːt/', 'v', 'đi lại hằng ngày (giữa nhà và nơi làm việc)', true],
    ])
  })
  it('a header merged into a row does not become a word', () => {
    expect(ticked(['STT\t8\thabitat\tTừ vựng\t/ˈhæbɪtæt/\tPhiên âm\tTừ loại\t(n)\tmôi trường sống\tNghĩa'])).toEqual([])
  })
})

describe('LABEL: accent labels between transcriptions', () => {
  it.each([
    '2. water BrE /ˈwɔːtə(r)/ NAmE /ˈwɔːtər/ (n) nước',
    'water /ˈwɔːtə(r)/ NAmE /ˈwɔːtər/ (n) nước',
    'water (UK) /ˈwɔːtə(r)/ (US) /ˈwɔːtər/ (n) nước',
    'water UK: /ˈwɔːtə(r)/ US: /ˈwɔːtər/ (n) nước',
  ])('%s', (line) => {
    expect(rows([line])).toEqual([['water', '/ˈwɔːtə(r)/ /ˈwɔːtər/', 'n', 'nước', true]])
  })
  it('keeps a lower-case "us" that is part of the word', () => {
    expect(parseLine('join us /dʒɔɪn ʌs/ (v) tham gia cùng chúng tôi')[0].word).toBe('join us')
  })
})

describe('POS: idm and Vietnamese abbreviations', () => {
  it.each([
    ['13. take sb/sth for granted (idm) /teɪk fə ˈɡrɑːntɪd/: coi ai/cái gì là điều hiển nhiên', 'take sb/sth for granted', 'idm', 'coi ai/cái gì là điều hiển nhiên'],
    ['18. get rid of sb/sth /ɡet ˈrɪd əv/ (idm): tống khứ, loại bỏ', 'get rid of sb/sth', 'idm', 'tống khứ, loại bỏ'],
    ['21. pastime (dt) /ˈpɑːstaɪm/: trò tiêu khiển (= hobby)', 'pastime', 'dt', 'trò tiêu khiển (= hobby)'],
    ['22. relax (đt) /rɪˈlæks/: thư giãn, nghỉ ngơi cho thoải mái', 'relax', 'đt', 'thư giãn, nghỉ ngơi cho thoải mái'],
    ['23. energetic /ˌenəˈdʒetɪk/ (tt): tràn đầy năng lượng', 'energetic', 'tt', 'tràn đầy năng lượng'],
  ])('%s', (line, word, pos, meaning) => {
    expect(parseLine(line).map((r: any) => [r.word, r.pos, r.meaning])).toEqual([[word, pos, meaning]])
  })
})

describe('TAIL + SURE + OWNROW: continuation lines', () => {
  it('an ASCII tail closing a bracket', () => {
    expect(rows(['7. keep up with (phr.v) /kiːp ˈʌp wɪð/: theo kịp, bắt kịp (= catch up', 'with)'])[0][3]).toBe('theo kịp, bắt kịp (= catch up with)')
    expect(rows(['12. well-known (adj) /ˌwel ˈnəʊn/: nổi tiếng (=', 'famous)'])[0][3]).toBe('nổi tiếng (= famous)')
    expect(rows(['14. (be) keen on /kiːn ɒn/ (adj): say mê (+', 'N/V-ing)'])[0][3]).toBe('say mê (+ N/V-ing)')
  })
  it('a synonym in brackets on its own line', () => {
    expect(rows(['7. keep up with /kiːp ˈʌp wɪð/: theo kịp, bắt kịp (ai/cái gì)', '(= catch up with)'])[0][3]).toBe('theo kịp, bắt kịp (ai/cái gì) (= catch up with)')
  })
  it('an example line is still not part of the meaning', () => {
    expect(rows(['decide /dɪˈsaɪd/ (v): quyết định (+', 'Ex: She decided to stay.)'])[0][3]).toBe('quyết định (+')
  })
  it('a wrapped line with diacritics ticks a first line without them', () => {
    expect(rows(['27. sense of community /sens əv kəˈmjuːnəti/ tinh', 'thần cộng đồng, sự gắn kết'])[0].slice(3)).toEqual(['tinh thần cộng đồng, sự gắn kết', true])
  })
  it('a table row without IPA is not appended to the previous meaning', () => {
    expect(rows(['grow up\t/ɡrəʊ ʌp/\tphr v\tlớn lên, trưởng thành', 'set up\tphr v\tthành lập, xây dựng'])[0][3]).toBe('lớn lên, trưởng thành')
  })
})

describe('DOUBT + COLON + SENT + HEAD: pronunciation and grammar notes', () => {
  it('rows cut short by a dropped transcription are unticked', () => {
    expect(ticked(['a + phụ âm (consonant sound)\ta university\t/ə ˌjuːnɪˈvɜːsəti/\tu đọc là /juː/ (phụ âm /j/)'])).toEqual([])
    expect(ticked(['/t/\tstopped, laughed\t/stɒpt/, /lɑːft/\tsau âm vô thanh', '/ɪd/\twanted, needed\t/ˈwɒntɪd/, /ˈniːdɪd/\tsau /t/ và /d/'])).toEqual([])
  })
  it('an example line cannot fill or tick an entry', () => {
    expect(ticked(['Examples: stopped /stɒpt/, laughed /lɑːft/, washed /wɒʃt/', '(tất cả đều kết thúc bằng âm vô thanh nên đuôi -ed đọc là t)'])).toEqual([])
    expect(ticked(['Remember: live /lɪv/ (sống) ≠ leave /liːv/ (rời đi). /iː/ là âm dài'])).toEqual([])
  })
  it('sentences and headings are not words', () => {
    expect(parseLine('pronunciation changes. The -ed ending is pronounced /t/ after voiceless sounds')).toEqual([])
    expect(parseLine('PART B. MINIMAL PAIRS /ɪ/ and /iː/').map((r: any) => r.word)).not.toContain('PART B. MINIMAL PAIRS')
  })
  it('entry-shaped notes above the vocabulary heading are unticked', () => {
    const lines = [
      'news /njuːz/ [U] – tuy có đuôi -s nhưng là danh từ không đếm được: The news is good.',
      'Exercise 2. Choose a or an.',
      'VOCABULARY TO NOTE – TỪ VỰNG CẦN GHI NHỚ',
      '1. harbour /ˈhɑːbə(r)/ (n): bến cảng',
      '2. cottage /ˈkɒtɪdʒ/ (n): nhà tranh',
    ]
    expect(ticked(lines)).toEqual(['harbour', 'cottage'])
  })
  it('a practice heading under the real list does not untick it', () => {
    const lines = ['1. harbour /ˈhɑːbə(r)/ (n): bến cảng', '2. cottage /ˈkɒtɪdʒ/ (n): nhà tranh', '3. shore /ʃɔː(r)/ (n): bờ biển', 'B. Vocabulary practice', 'pier /pɪə(r)/ cầu tàu']
    expect(ticked(lines)).toEqual(['harbour', 'cottage', 'shore', 'pier'])
  })
})

describe('COUNT: countability labels', () => {
  it.each([
    ['1. advice /ədˈvaɪs/ (n) [U]: lời khuyên', 'n', 'lời khuyên'],
    ['2. luggage /ˈlʌɡɪdʒ/ [U] (n): hành lý', 'n', 'hành lý'],
    ['3. information /ˌɪnfəˈmeɪʃn/ (n, U): thông tin', 'n', 'thông tin'],
  ])('%s', (line, pos, meaning) => {
    expect(parseLine(line).map((r: any) => [r.pos, r.meaning])).toEqual([[pos, meaning]])
  })
})

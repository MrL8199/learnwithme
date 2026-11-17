/** Lower-case, unify quotes and spaces, drop trailing punctuation. */
export function norm(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/, '')
    .trim()
}

/** "to decide" and "decide" are the same answer. */
function core(s: string): string {
  return norm(s).replace(/\s*\/\s*/g, '/').replace(/^to /, '')
}

/**
 * Accepted answers for a word cell:
 * - only the first line ("it is wise + to V⏎(=should)" → "it is wise + to V")
 * - parentheses dropped
 * - "think of/about" → also "think of", "think about"; "was / were" → also "was", "were"
 */
export function answersFor(cell: string): string[] {
  const first = cell.split('\n')[0].replace(/\([^)]*\)/g, ' ')
  const base = first.replace(/\s+/g, ' ').trim()
  const out = new Set<string>()
  if (base) out.add(base)
  if (base.includes('/')) {
    const parts = base.split('/').map((p) => p.trim()).filter(Boolean)
    if (parts.length > 1) {
      const head = parts[0]
      out.add(head)
      const prefix = head.includes(' ') ? head.slice(0, head.lastIndexOf(' ') + 1) : ''
      for (const alt of parts.slice(1)) {
        // "think of/about" → "think about"; "was / were" → "were"
        out.add(alt.includes(' ') || !prefix ? alt : prefix + alt)
      }
    }
  }
  return [...out]
}

export function isCorrect(input: string, answers: string[]): boolean {
  const a = core(input)
  return a.length > 0 && answers.some((x) => core(x) === a)
}

/** Edit distance where swapping two neighbouring letters counts as one edit. */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

/** Wrong but only a small spelling slip (still counted wrong — spelling is the point). */
export function isNear(input: string, answers: string[]): boolean {
  const a = core(input)
  if (!a) return false
  return answers.some((x) => {
    const b = core(x)
    const limit = b.length >= 8 ? 2 : 1
    return editDistance(a, b) <= limit
  })
}

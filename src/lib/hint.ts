const LETTER = /[\p{L}\p{N}]/u

/**
 * Letter hint for recall: the first `level` letters of every word are shown, the rest become "_".
 * Spaces, hyphens, apostrophes and slashes stay visible so the shape of the answer is clear.
 * Level 0 shows only the shape ("_ _ _ _ _").
 */
export function maskHint(answer: string, level: number): string {
  let seen = 0
  return [...answer]
    .map((ch) => {
      if (!LETTER.test(ch)) {
        seen = 0
        return ch
      }
      return seen++ < level ? ch : '_'
    })
    .join('')
}

/** Highest useful level: past it every word would be fully shown (at least one letter stays hidden). */
export function maxHintLevel(answer: string): number {
  const longest = Math.max(0, ...answer.split(/[^\p{L}\p{N}]+/u).map((w) => w.length))
  return Math.max(0, longest - 1)
}

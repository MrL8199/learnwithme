/** Vietnam has no DST, so a fixed offset is safe. */
const TZ_OFFSET_H = 7
/** A study day runs 04:00 → 03:59 next morning (studying at 00:30 counts for the previous evening). */
const DAY_START_H = 4

/** Study date ("YYYY-MM-DD") of an instant. */
export function studyDate(iso: string | number | Date): string {
  const t = new Date(iso).getTime() + (TZ_OFFSET_H - DAY_START_H) * 3_600_000
  return new Date(t).toISOString().slice(0, 10)
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  const p = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((p(b) - p(a)) / 86_400_000)
}

const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** "T2 16/11" */
export function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${WD[wd]} ${d}/${m}`
}

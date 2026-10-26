/**
 * The date in English, in the form the mark in the presentation uses.
 *
 * It has a file of its own because two scripts need it: `prepare-version.ts`
 * writes the mark, and `check-version.ts` checks it. If the month names were
 * in both, they could drift apart, and the guard would then fail on a
 * difference it had made itself.
 */

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/** `2026-09-28` becomes `28 September 2026`. */
export function englishDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)

  if (!match) throw new Error(`"${iso}" is not a date of the form 2026-09-28`)

  const [, year, month, day] = match
  const name = MONTHS[Number(month) - 1]

  /*
   * The form alone is not enough. `2026-13-01` matched the pattern and came
   * out as "1 undefined 2026", an error message that pointed at itself rather
   * than at the typo in the date.
   */
  if (!name) throw new Error(`"${iso}" has no month between 01 and 12`)

  return `${Number(day)} ${name} ${year}`
}

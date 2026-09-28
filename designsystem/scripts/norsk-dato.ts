/**
 * Datoen på norsk, i den formen merket i presentasjonen bruker.
 *
 * Ligger i sin egen fil fordi to skript trenger den: `prepare-version.ts`
 * skriver merket, og `sjekk-versjon.ts` kontrollerer det. Sto månedsnavnene i
 * begge, ville de kunne gli fra hverandre, og da ville vakten felt på en
 * forskjell den selv hadde laget.
 */

const MAANEDER = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
]

/** `2026-09-28` blir `28. september 2026`. */
export function norskDato(iso: string): string {
  const treff = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)

  if (!treff) throw new Error(`«${iso}» er ikke en dato på formen 2026-09-28`)

  const [, aar, maaned, dag] = treff

  return `${Number(dag)}. ${MAANEDER[Number(maaned) - 1]} ${aar}`
}

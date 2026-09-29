import {
  contrastRatio,
  oklchToRgb,
  parseHex,
  rgbToOklch,
  toHex,
} from "./color.js"

/**
 * Fargekontrakten: hva hver rolle er, og hva den lover.
 *
 * Systemet har ett fargelag, ikke to. En farge er et punkt i en matrise av
 * **familie** (hva den betyr) og **rolle** (hva den gjør). Hver familie har de
 * samme rollene, og det er derfor et fareområde og et merkevareområde ser ut
 * som søsken: de er bygd av de samme rollene på de samme lyshetene.
 *
 * Kuløren er konsumentens, lysheten er rollens. Det er den ene regelen som gjør
 * at kontrasten er garantert av konstruksjonen framfor av en sjekk i etterkant.
 * Gir du en lys lilla eller en mørk lilla, får du den samme lilla matrisen.
 *
 * Tallene her er ikke valgt, de er regnet fram: lysheten til hver rolle er den
 * som holder løftet for den vanskeligste kuløren. «Vanskeligste» er ikke
 * systemets egne åtte farger, men et sveip rundt hele fargesirkelen på den
 * høyeste metningen sRGB kan vise for hver kulør. Stiller man tallene inn
 * etter systemets egne farger alene, ryker de for en konsument med en annen
 * kulør, og det gjorde de. Endrer du ett av tallene, er `checkPromises` det
 * som sier fra.
 *
 * To av dem er verdt å kjenne. `fill` styres av at `content` skal kunne leses
 * oppå den, ikke av avstanden til siden: det er det strengeste kravet, og en
 * `fill` valgt etter siden alene blir for lys til å bære tekst. Og `text` er
 * med vilje mørkere enn det løftet krever, siden brødtekst skal ha tyngde,
 * mens `textSubtle` ligger nærmere grensa. Det er hele forskjellen på dem.
 */

/** En rolle er en jobb en farge gjør, og den er lik i hver familie. */
export type Role =
  | "surface"
  | "border"
  | "fill"
  | "content"
  | "text"
  | "textSubtle"
  | "borderSubtle"

/** Lyst eller mørkt. Et tema er det ene eller det andre, aldri begge. */
export type Appearance = "light" | "dark"

/**
 * Hvor mye av kulørens metning hver rolle beholder, og hvilken lyshet den
 * sikter mot i hvert utseende.
 *
 * Metningen er en andel og ikke en verdi, slik at en dus merkefarge gir en dus
 * matrise og en sterk gir en sterk. Flatene tåler minst: en lys flate med mye
 * metning ser skitten ut.
 */
export const ROLES: Record<
  Role,
  { lightness: Record<Appearance, number>; chroma: number }
> = {
  surface: { lightness: { light: 0.96, dark: 0.26 }, chroma: 0.22 },
  borderSubtle: { lightness: { light: 0.88, dark: 0.34 }, chroma: 0.35 },
  border: { lightness: { light: 0.575, dark: 0.625 }, chroma: 0.55 },
  fill: { lightness: { light: 0.53, dark: 0.65 }, chroma: 1 },
  text: { lightness: { light: 0.42, dark: 0.82 }, chroma: 0.85 },
  textSubtle: { lightness: { light: 0.485, dark: 0.73 }, chroma: 0.7 },
  content: { lightness: { light: 0.99, dark: 0.16 }, chroma: 0.04 },
}

/**
 * Sideflaten og den hevede flaten, som bare den nøytrale familien har.
 *
 * `canvas` er siden selv, `surface` er et kort på den, og `raised` ligger over
 * igjen. Tekst må holde mot alle tre, ikke bare mot siden, ellers blir et kort
 * på et kort uleselig uten at noe sier fra.
 */
export const NEUTRAL_LAYERS: Record<
  "canvas" | "raised",
  { lightness: Record<Appearance, number>; chroma: number }
> = {
  canvas: { lightness: { light: 1, dark: 0.18 }, chroma: 0.08 },
  raised: { lightness: { light: 0.92, dark: 0.32 }, chroma: 0.12 },
}

/** Kontrastkravene, med margin over WCAG. Tekst er 4,5 og grafikk er 3. */
export const REQUIREMENT = { text: 4.6, graphic: 3.1 } as const

/** Bygger én familie fra én merkefarge. */
export function buildFamily(
  brand: string,
  appearance: Appearance,
): Record<Role, string> {
  const { c, h } = rgbToOklch(parseHex(brand))
  const out = {} as Record<Role, string>
  for (const [role, spec] of Object.entries(ROLES) as [
    Role,
    (typeof ROLES)[Role],
  ][]) {
    out[role] = toHex(
      oklchToRgb({ l: spec.lightness[appearance], c: c * spec.chroma, h }),
    )
  }
  return out
}

export type Violation = {
  family: string
  promise: string
  ratio: number
  required: number
}

/**
 * Løftene, kontrollert mot de flatene fargen faktisk havner på.
 *
 * Lista er selve kontrakten. Legger du til en rolle som skal stå inne for noe,
 * hører løftet hjemme her.
 *
 * `borderSubtle` står med vilje uten løfte. Den er en dekorativ strek, en
 * skillelinje mellom to rader, og WCAG 1.4.11 gjelder ikke det som ikke er
 * nødvendig for å forstå siden. Trenger kanten å bety noe, er `border` den
 * riktige, og den holder 3,1:1 mot alle tre lagene.
 */
export function promisesFor(
  f: Record<Role, string>,
  layers: Record<"canvas" | "surface" | "raised", string>,
): [string, number, number][] {
  const ratio = (a: string, b: string) =>
    contrastRatio(parseHex(a), parseHex(b))

  return [
    // Tekst leses på siden, på et kort, på en hevet flate og på egen flate.
    ["text mot canvas", ratio(f.text, layers.canvas), REQUIREMENT.text],
    ["text mot surface", ratio(f.text, layers.surface), REQUIREMENT.text],
    ["text mot raised", ratio(f.text, layers.raised), REQUIREMENT.text],
    ["text mot egen surface", ratio(f.text, f.surface), REQUIREMENT.text],
    [
      "textSubtle mot canvas",
      ratio(f.textSubtle, layers.canvas),
      REQUIREMENT.text,
    ],
    [
      "textSubtle mot surface",
      ratio(f.textSubtle, layers.surface),
      REQUIREMENT.text,
    ],
    [
      "textSubtle mot raised",
      ratio(f.textSubtle, layers.raised),
      REQUIREMENT.text,
    ],
    // Kanten er grafikk, ikke tekst, og har det lavere kravet.
    ["border mot canvas", ratio(f.border, layers.canvas), REQUIREMENT.graphic],
    ["border mot raised", ratio(f.border, layers.raised), REQUIREMENT.graphic],
    [
      "border mot egen surface",
      ratio(f.border, f.surface),
      REQUIREMENT.graphic,
    ],
    ["fill mot canvas", ratio(f.fill, layers.canvas), REQUIREMENT.graphic],
    ["fill mot raised", ratio(f.fill, layers.raised), REQUIREMENT.graphic],
    // Og teksten oppå den fylte flaten er det strengeste kravet av alle.
    ["content oppå fill", ratio(f.content, f.fill), REQUIREMENT.text],
  ]
}

/** Alle løfter i alle familier, med dem som ikke holder. */
export function checkPromises(
  families: Record<string, Record<Role, string>>,
  layers: Record<"canvas" | "surface" | "raised", string>,
): Violation[] {
  const violations: Violation[] = []
  for (const [family, f] of Object.entries(families))
    for (const [promise, ratio, required] of promisesFor(f, layers))
      if (ratio < required)
        violations.push({ family, promise, ratio, required })
  return violations
}

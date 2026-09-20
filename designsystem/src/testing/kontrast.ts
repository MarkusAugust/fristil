/**
 * Kontrastkravene systemet lover, på ett sted.
 *
 * Lista brukes av to tester: den som måler Fristils egne farger, og den som
 * måler et tema generatoren har laget av noen andre sine merkefarger. Uten
 * delingen ville generatoren blitt målt mot en kopi som kunne gå fra
 * hverandre, og da måler den ikke lenger det samme løftet.
 */

function lin(kanal: number): number {
  const c = kanal / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminans([r, g, b]: [number, number, number]): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function kontrast(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const la = luminans(a)
  const lb = luminans(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Leser en tokenverdi som utregnet rgb, i det temaet som er satt. */
export function farge(
  token: string,
  tema: "light" | "dark",
): [number, number, number] {
  document.documentElement.setAttribute("data-theme", tema)

  const prove = document.createElement("div")
  prove.style.color = `var(${token})`
  document.body.append(prove)
  const utregnet = getComputedStyle(prove).color
  prove.remove()

  const tall = utregnet.match(/\d+/g)
  if (!tall || tall.length < 3) {
    throw new Error(`Klarte ikke lese ${token} i ${tema}: «${utregnet}»`)
  }
  return [Number(tall[0]), Number(tall[1]), Number(tall[2])]
}

/**
 * Parene som må holde 4,5:1.
 *
 * `disabled` står ikke her: WCAG 1.4.3 unntar inaktive komponenter. Den har
 * sin egen, lavere terskel lenger ned, for teksten i et avslått felt skal
 * fortsatt kunne leses.
 */
export const PAR: Array<[navn: string, forgrunn: string, bakgrunn: string]> = [
  ["brødtekst", "--semantic-page-foreground", "--semantic-page-background"],
  [
    "lenke på flate",
    "--semantic-interactive-main",
    "--semantic-page-background",
  ],
  [
    "besøkt lenke",
    "--semantic-interactive-visited",
    "--semantic-page-background",
  ],
  [
    "tekst på primærknapp",
    "--semantic-interactive-contrast",
    "--semantic-interactive-main",
  ],
  [
    "interaktivt merke",
    "--semantic-interactive-main",
    "--semantic-interactive-background",
  ],
  // Avataren skriver initialer i interactive-foreground på
  // interactive-background. Paret manglet i lista, og ble derfor ikke målt.
  [
    "initialer i avatar",
    "--semantic-interactive-foreground",
    "--semantic-interactive-background",
  ],
  [
    "fare-merke",
    "--semantic-danger-foreground",
    "--semantic-danger-background",
  ],
  [
    "advarsel-merke",
    "--semantic-warning-foreground",
    "--semantic-warning-background",
  ],
  [
    "suksess-merke",
    "--semantic-success-foreground",
    "--semantic-success-background",
  ],
  [
    "nøytralt merke",
    "--semantic-neutral-foreground",
    "--semantic-neutral-background",
  ],
  [
    "feiltekst på flate",
    "--semantic-danger-foreground",
    "--semantic-page-background",
  ],
  [
    "advarselstekst på flate",
    "--semantic-warning-foreground",
    "--semantic-page-background",
  ],
  [
    "suksesstekst på flate",
    "--semantic-success-foreground",
    "--semantic-page-background",
  ],

  // Hover-tilstandene. Danger-knappen lå på 3,52:1 fordi bakgrunnen
  // mørknet mens teksten ble stående, og ble svakere enn hviletilstanden.
  [
    "primærknapp, hover",
    "--semantic-interactive-contrast",
    "--semantic-interactive-foreground",
  ],
  [
    "danger-knapp, hvile",
    "--semantic-danger-foreground",
    "--semantic-danger-background",
  ],
  [
    "danger-knapp, hover",
    "--semantic-danger-contrast",
    "--semantic-danger-main",
  ],
  ["dempet tekst", "--semantic-muted-foreground", "--semantic-page-background"],

  // Innholdet i et felt med tilstand. Feltet beholder brødtekstfargen mens
  // bakgrunnen får statusfargen, så dette er et annet par enn merkene over.
  [
    "tekst i gyldig felt",
    "--semantic-page-foreground",
    "--semantic-success-background",
  ],
  [
    "tekst i ugyldig felt",
    "--semantic-page-foreground",
    "--semantic-danger-background",
  ],
  [
    "tekst i advarselsfelt",
    "--semantic-page-foreground",
    "--semantic-warning-background",
  ],
]

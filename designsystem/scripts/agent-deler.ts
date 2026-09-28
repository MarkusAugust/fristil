/**
 * Delene av regelbøkene som leses av koden, ikke skrives for hånd.
 *
 * Komponentlista, attributtverdiene, tokennavnene og byggerne er data. Skrevet
 * av for hånd ville de glidd fra koden i stillhet, og en agent-instruksjon som
 * nevner en variant som ikke finnes er verre enn ingen instruksjon: den ser
 * autoritativ ut, og agenten skriver den inn i konsumentens app.
 *
 * Kildene er de samme som editorfilene bruker: `classes.ts` og `elements.ts`
 * genereres fra komponentene, og `fs` leses ved å kalle byggerne, ikke ved å
 * lese kildekoden. Tokennavnene leses ut av `tokens.css`, som selv er generert
 * fra `tokens.ts`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { classes } from "../src/diagnostics/classes.js"
import { elements } from "../src/diagnostics/elements.js"
import { fs } from "../src/index.js"

export const PAKKE = fileURLToPath(new URL("../", import.meta.url))

type Pakke = {
  version: string
  exports: Record<string, string | { import?: string }>
}

export const pakke = JSON.parse(
  readFileSync(join(PAKKE, "package.json"), "utf8"),
) as Pakke

export const VERSJON = pakke.version
export const CDN = `https://cdn.jsdelivr.net/npm/@fristil/designsystem@${VERSJON}`

/** Mappa hver komponent ligger i, som avgjør hvem som eier DOM-en. */
function kategorier(): Map<string, string> {
  const kart = new Map<string, string>()

  for (const kategori of ["css", "ramme", "frittstaende"]) {
    const mappe = join(PAKKE, "src/components", kategori)
    for (const navn of readdirSync(mappe)) {
      if (statSync(join(mappe, navn)).isDirectory()) kart.set(navn, kategori)
    }
  }

  return kart
}

export const KATEGORI = kategorier()

/** Stilarket en komponent har i `exports`, eller null når den ikke har noe. */
export function stilark(komponent: string): string | null {
  return `./${komponent}.css` in pakke.exports ? `${komponent}.css` : null
}

/** Modulen `defineFs*` ligger i, slik `exports` peker på den. */
export function modul(komponent: string): string {
  const oppføring = pakke.exports[`./${komponent}`]
  if (!oppføring || typeof oppføring === "string") {
    throw new Error(`${komponent} har ingen JS-inngang i exports`)
  }
  const sti = oppføring.import
  if (!sti) throw new Error(`${komponent} mangler «import» i exports`)
  return sti.replace(/^\.\//, "")
}

/**
 * Hele CDN-adressen til noe `exports` peker på.
 *
 * Eksemplene skrev stien for hånd. Flyttes `fs-field.ts`, oppdateres tabellen
 * av seg selv mens de kopierbare eksemplene blir stående og peke på 404, og det
 * er nettopp den delen konsumenten limer inn.
 */
export function cdnTil(inngang: string): string {
  const oppføring = pakke.exports[`./${inngang}`]
  const sti =
    typeof oppføring === "string" ? oppføring : (oppføring?.import ?? "")

  if (!sti) throw new Error(`${inngang} finnes ikke i exports`)

  return `${CDN}/${sti.replace(/^\.\//, "")}`
}

const stor = (del: string) => del[0].toUpperCase() + del.slice(1)

/** `defineFsSessionTimeout` av `session-timeout`, som navnekonvensjonen sier. */
export function registrering(komponent: string): string {
  return `defineFs${komponent.split("-").map(stor).join("")}`
}

type Klasse = {
  klasser: string[]
  attributter: string[]
}

/** Komponentene som bare er CSS, med klassene og attributtene sine. */
function cssKomponenter(): Map<string, Klasse> {
  const kart = new Map<string, Klasse>()

  for (const [klasse, info] of Object.entries(classes)) {
    if (KATEGORI.get(info.component) !== "css") continue

    const rad = kart.get(info.component) ?? { klasser: [], attributter: [] }
    rad.klasser.push(klasse)

    for (const [navn, attributt] of Object.entries(info.attributes ?? {})) {
      const verdier = attributt.values ?? []
      rad.attributter.push(
        verdier.length > 0
          ? `\`${navn}\`: ${verdier.join(", ")}`
          : `\`${navn}\``,
      )
    }

    kart.set(info.component, rad)
  }

  return kart
}

/** Tabellen over CSS-komponentene, sortert på komponentnavn. */
export function cssTabell(): string {
  const rader = [...cssKomponenter()].sort(([a], [b]) => a.localeCompare(b))

  return [
    "| Klasse | Stilark | Attributter |",
    "| --- | --- | --- |",
    ...rader.map(([navn, rad]) => {
      const ark = stilark(navn)
      if (!ark) throw new Error(`${navn} har ingen stilark i exports`)
      const klasser = rad.klasser.map((klasse) => `\`${klasse}\``).join("<br>")
      const attributter = rad.attributter.join("<br>") || "ingen"
      return `| ${klasser} | \`${ark}\` | ${attributter} |`
    }),
  ].join("\n")
}

/** Klassene som hører til et element, som `fs-tabs__list` under `<fs-tabs>`. */
function klasserUnder(komponent: string): string {
  const treff = Object.entries(classes)
    .filter(([, info]) => info.component === komponent)
    .map(([klasse]) => `\`${klasse}\``)

  return treff.join("<br>") || "ingen"
}

/**
 * Tabellen over web components.
 *
 * `adresse` er stien konsumenten skriver i importen, og den er ikke den samme
 * overalt: en nettleser uten bundles slår ikke opp pakkenavnet, så der må det
 * være en URL. Derfor bestemmer hvert rammeverk sin egen.
 */
export function webTabell(
  adresse: (komponent: string, modul: string) => string,
): string {
  const rader = Object.keys(elements).map((tagg) => {
    const komponent = tagg.replace(/^fs-/, "")
    const ark = stilark(komponent)
    if (!ark) throw new Error(`${komponent} har ingen stilark i exports`)

    const attributter =
      Object.entries(elements[tagg].attributes ?? {})
        .map(([navn, attributt]) =>
          attributt.type === "values"
            ? `\`${navn}\`: ${attributt.values.join(", ")}`
            : `\`${navn}\` (${attributt.type})`,
        )
        .join("<br>") || "ingen"

    const kall = `\`${registrering(komponent)}()\``
    const fra = `\`${adresse(komponent, modul(komponent))}\``

    return `| \`<${tagg}>\` | ${KATEGORI.get(komponent)} | \`${ark}\` | ${kall} fra ${fra} | ${attributter} | ${klasserUnder(komponent)} |`
  })

  return [
    "| Element | Kategori | Stilark | Registrering | Attributter | Klasser inni |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rader,
  ].join("\n")
}

/** Tokennavnene, lest ut av det genererte stilarket. */
function tokennavn(mønster: RegExp): string[] {
  const css = readFileSync(join(PAKKE, "src/tokens/tokens.css"), "utf8")
  return [...new Set(css.match(mønster) ?? [])].sort()
}

/**
 * De semantiske tokenene, i to kolonner.
 *
 * Alle navnene skrives ut. En liste som slutter med «og så videre» er en
 * invitasjon til å finne opp det siste, og oppfunne navn er nettopp det denne
 * regelboka finnes for å hindre.
 */
export function tokenListe(): string {
  const navn = tokennavn(/--semantic-[a-z0-9-]+/g).filter(
    // Linjehøyde og mål hører under skriftdelen, og gjentas ikke her.
    (token) => !token.startsWith("--semantic-line-height"),
  )

  const linjer: string[] = []
  for (let i = 0; i < navn.length; i += 2) {
    const venstre = navn[i].padEnd(34)
    linjer.push((venstre + (navn[i + 1] ?? "")).trimEnd())
  }

  return linjer.join("\n")
}

/** Mål, skrift og linjehøyde, som én setning framfor en liste. */
export function malOgSkrift(): string {
  const liste = (navn: string[]) =>
    navn.map((token) => `\`${token}\``).join(", ")

  return [
    `Mål: ${liste(tokennavn(/--size-[a-z0-9-]+/g))}.`,
    "",
    `Skrift: ${liste(tokennavn(/--font-[a-z0-9-]+/g))}.`,
    "",
    `Linjehøyde: ${liste(tokennavn(/--semantic-line-height-[a-z0-9-]+/g))}.`,
  ].join("\n")
}

/*
 * Nøklene i `fs` som ikke bygger attributter. De hører til typesikkerheten, og
 * ville ellers stått i lista som byggere som ikke finnes.
 */
const HJELPERE = new Set([
  "isMarker",
  "isState",
  "markers",
  "setAttributes",
  "states",
])

/** Byggefunksjonene i `fs`, som er dem et prosjekt med typer kan bruke. */
export function byggere(): string {
  const navn = Object.keys(fs)
    .filter((nøkkel) => !HJELPERE.has(nøkkel))
    .sort()

  return navn.map((bygger) => `\`fs.${bygger}()\``).join(", ")
}

export function antallByggere(): number {
  return Object.keys(fs).filter((nøkkel) => !HJELPERE.has(nøkkel)).length
}

export function antallKomponenter(): number {
  return new Set(Object.values(classes).map((info) => info.component)).size
}

/**
 * Radene i CSS-tabellen.
 *
 * `antallKomponenter()` teller komponenter som har minst én klasse, og `field`
 * har ingen. Tallet passet derfor verken CSS-tabellen, summen av de to
 * tabellene, eller lesningen «så mange komponenter og så mange elementer».
 */
export function antallCssKomponenter(): number {
  return new Set(
    Object.values(classes)
      .filter((info) => KATEGORI.get(info.component) === "css")
      .map((info) => info.component),
  ).size
}

export function antallElementer(): number {
  return Object.keys(elements).length
}

/**
 * Flyter om avsnittene til 78 tegn, og lar det som ikke er prosa stå.
 *
 * Prosaen i oppskriftene står i template-literaler, der indenteringen følger
 * koden framfor teksten. Uten dette måtte hver oppskrift brytes for hånd, og en
 * setning som ble endret ville etterlatt en ujevn kant. Kodeblokker, tabeller
 * og tokenlista står urørt: der betyr hver linje noe.
 */
export function ombrekk(markdown: string): string {
  const BREDDE = 78
  const linjer = markdown.split("\n")
  const ut: string[] = []
  let avsnitt: string[] = []
  let iKode = false

  /** Punktlister henger under sitt eget merke, så teksten står i kolonne. */
  function tøm(): void {
    if (avsnitt.length === 0) return

    const tekst = avsnitt.join(" ").replace(/\s+/g, " ").trim()
    const merke = /^(\d+\.\s+|[-*]\s+)/.exec(tekst)
    const heng = merke ? " ".repeat(merke[1].length) : ""
    /*
     * Et ord er tegn og kodespenn i ett, mellomrommene inne i spennet
     * medregnet. Uten dette ble `npx @fristil/designsystem sjekk side.html`
     * delt etter «sjekk», og en agent som kopierte kommandoen fikk et
     * linjeskift midt i den. Tegnene rundt må være med i samme ord, ellers
     * havner kommaet etter et kodespenn alene på neste linje.
     */
    const ord = tekst.match(/(?:`[^`]*`|\S)+/g) ?? []
    let linje = ""

    for (const del of ord) {
      const kandidat = linje === "" ? del : `${linje} ${del}`
      if (linje !== "" && kandidat.length > BREDDE) {
        ut.push(linje)
        linje = heng + del
      } else {
        linje = kandidat
      }
    }

    if (linje !== "") ut.push(linje)
    avsnitt = []
  }

  for (const linje of linjer) {
    if (linje.startsWith("```")) {
      tøm()
      iKode = !iKode
      ut.push(linje)
      continue
    }

    if (iKode || linje.startsWith("|") || linje.startsWith("#")) {
      tøm()
      ut.push(linje)
      continue
    }

    if (linje.trim() === "") {
      tøm()
      ut.push("")
      continue
    }

    // Et nytt punkt begynner et nytt avsnitt, ellers ville hele lista blitt én.
    if (/^(\d+\.\s|[-*]\s)/.test(linje.trimStart()) && avsnitt.length > 0) tøm()

    avsnitt.push(linje.trim())
  }

  tøm()

  // Aldri to blanke linjer etter hverandre, og aldri en til slutt.
  return `${ut
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`
}

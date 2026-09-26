/**
 * At diagnostikken feller hver feiltype den skal, og bare dem.
 *
 * Elementene leses fra generatoren i minnet, ikke fra `elementer.json` på
 * disk, så sjekken bruker den samme kilden som utvidelsen ville fått etter
 * `bun run generate`. Hvert tilfelle sier hvor mange funn det skal gi og
 * hva meldingen skal nevne, og de rene tilfellene skal gi null. Snippetene
 * fra komponentsidene er med som rene tilfeller: gir en av dem funn, er
 * enten regelen eller oppskriften feil, og begge deler skal fram.
 *
 * Kjør med: bun scripts/sjekk-diagnostikk.ts
 */

import { diagnostiser, type Elementer } from "../src/diagnostikk"
import { elementer, snippets } from "./generate"

const alle: Elementer = elementer()
const feil: string[] = []

type Tilfelle = {
  navn: string
  html: string
  antall: number
  nevner?: string[]
  alvor?: "feil" | "advarsel"
  /** Teksten funnet skal dekke, når posisjonen er poenget. */
  dekker?: string
}

const FELT_OK = `<fs-field id="f"><label>Navn</label><input class="fs-input" name="navn"></fs-field>`

const tilfeller: Tilfelle[] = [
  {
    navn: "et element som ikke finnes",
    html: `<fs-dialog><fs-dialog-header>Tittel</fs-dialog-header></fs-dialog>`,
    antall: 1,
    nevner: ["<fs-dialog-header> finnes ikke", "fs-dialog"],
    alvor: "feil",
    dekker: "fs-dialog-header",
  },
  {
    navn: "et attributt elementet ikke har",
    html: `<fs-popover placemnet="top"></fs-popover>`,
    antall: 1,
    nevner: ["«placemnet»", "placement"],
    alvor: "advarsel",
    dekker: "placemnet",
  },
  {
    navn: "globale attributter, data-, aria- og hendelser slipper gjennom",
    html: `<fs-popover id="p" class="x" data-on-click="@get('/x')" aria-label="Hjelp" onclick="1" role="dialog" hidden></fs-popover>`,
    antall: 0,
  },
  {
    navn: "en verdi utenfor lista",
    html: `<fs-field required-marker="stjerne"><label>N</label><input></fs-field>`,
    antall: 1,
    nevner: ["«stjerne»", "Lovlige verdier"],
    alvor: "feil",
    dekker: "required-marker",
  },
  {
    navn: "et listeattributt uten verdi",
    html: `<fs-field required-marker><label>N</label><input></fs-field>`,
    antall: 1,
    nevner: ["Lovlige verdier"],
    alvor: "feil",
  },
  {
    navn: "et boolsk attributt med «false»",
    html: `<fs-field invalid="false"><label>N</label><input></fs-field>`,
    antall: 1,
    nevner: ["boolsk", 'invalid="false" betyr det samme som invalid'],
    alvor: "advarsel",
  },
  {
    navn: "et boolsk attributt med sitt eget navn eller tom verdi er greit",
    html: `<fs-field invalid="invalid" disabled=""><label>N</label><input></fs-field>`,
    antall: 0,
  },
  {
    navn: "et tall som ikke er et tall",
    html: `<fs-toast duration="lenge"></fs-toast>`,
    antall: 1,
    nevner: ["skal være et tall", "«lenge»"],
    alvor: "feil",
  },
  {
    navn: "et tall som er et tall",
    html: `<fs-toast duration="5000"></fs-toast>`,
    antall: 0,
  },
  {
    navn: "et felt uten kontroll",
    html: `<fs-field><label>Navn</label><p class="fs-help-text">Hjelp</p></fs-field>`,
    antall: 1,
    nevner: ["fant ingen kontroll", "<input>, <textarea> eller <select>"],
    alvor: "advarsel",
    dekker: "fs-field",
  },
  {
    navn: "et felt uten ledetekst",
    html: `<fs-field><input class="fs-input"></fs-field>`,
    antall: 1,
    nevner: ["fant ingen <label>", "uten navn"],
    alvor: "advarsel",
  },
  {
    navn: "et tomt felt er et område serveren ikke har fylt",
    html: `<fs-field id="senere"></fs-field>`,
    antall: 0,
  },
  {
    navn: "ledetekst utenfor, med for",
    html: `<label for="epost">E-post</label><fs-field><input id="epost"></fs-field>`,
    antall: 0,
  },
  {
    navn: "ledetekst utenfor via control-id",
    html: `<label for="epost">E-post</label><fs-field control-id="epost"><input></fs-field>`,
    antall: 0,
  },
  {
    navn: "aria-label på kontrollen",
    html: `<fs-field><input aria-label="Søk"></fs-field>`,
    antall: 0,
  },
  {
    navn: "kommentarer, skript og stilark leses ikke",
    html: `<!-- <fs-finnes-ikke> --><script>"<fs-nei>"</script><style>/* <fs-nei> */</style>${FELT_OK}`,
    antall: 0,
  },
  {
    navn: "posisjonen står selv om en kommentar går over flere linjer",
    html: `<!--\n<fs-nei>\n-->\n<fs-tull></fs-tull>`,
    antall: 1,
    dekker: "fs-tull",
  },
  {
    navn: "store bokstaver og selvlukking",
    html: `<FS-TOAST duration="x"/>`,
    antall: 1,
    nevner: ["skal være et tall"],
  },
  {
    navn: "flere funn i samme tagg meldes hver for seg",
    html: `<fs-popover placemnet="top" open="false"></fs-popover>`,
    antall: 2,
  },
  {
    navn: "en ren fil",
    html: `<!doctype html><html><body>${FELT_OK}<fs-popover placement="top-start" open></fs-popover></body></html>`,
    antall: 0,
  },
]

// Snippetene fra komponentsidene skal være rene.
for (const [tagg, snippet] of Object.entries(snippets()))
  tilfeller.push({
    navn: `snippeten for <${tagg}>`,
    html: snippet.body.join("\n").replace(/\\\$/g, "$").replace(/\\\\/g, "\\"),
    antall: 0,
  })

for (const t of tilfeller) {
  const funn = diagnostiser(t.html, alle)
  const her = (m: string) => feil.push(`${t.navn}: ${m}`)
  if (funn.length !== t.antall) {
    her(
      `ventet ${t.antall} funn, fikk ${funn.length}: ${funn.map((f) => f.melding).join(" | ") || "ingen"}`,
    )
    continue
  }
  if (!funn.length) continue
  const forste = funn[0]
  for (const n of t.nevner ?? [])
    if (!forste.melding.includes(n))
      her(`meldingen nevner ikke «${n}»: ${forste.melding}`)
  if (t.alvor && forste.alvor !== t.alvor)
    her(`ventet ${t.alvor}, fikk ${forste.alvor}`)
  if (t.dekker) {
    const dekket = t.html.slice(forste.start, forste.slutt)
    if (dekket !== t.dekker)
      her(`funnet dekker «${dekket}», ikke «${t.dekker}»`)
  }
  if (!forste.lenke.startsWith("https://fristil.netlify.app/"))
    her(`lenken peker ikke på dokumentasjonen: ${forste.lenke}`)
}

if (feil.length) {
  console.error(
    `Diagnostikken feiler på ${feil.length} punkt:\n  ${feil.join("\n  ")}`,
  )
  process.exit(1)
}
console.log(
  `Diagnostikken består ${tilfeller.length} tilfeller, ${Object.keys(alle).length} elementer.`,
)

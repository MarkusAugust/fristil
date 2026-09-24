/**
 * At koden i «Slik tar du den i bruk» faktisk stemmer.
 *
 * Hver komponentside åpner med den seksjonen, og fanene der er det leseren
 * limer inn. En kodeblokk som ser riktig ut, men peker på et inngangspunkt
 * som ikke finnes, eller kaller en byggefunksjon som heter noe annet, er
 * verre enn ingen kode: den ser autoritativ ut og feiler hos konsumenten.
 *
 * Sjekken leser mdx-filene som tekst og etterprøver hver påstand mot det
 * pakken faktisk sender ut:
 *
 *   - hvert `@fristil/designsystem/…` finnes i `exports`;
 *   - hver `defineFsX` er noe den modulen faktisk eksporterer;
 *   - hver `fs.x()` er en byggefunksjon som finnes;
 *   - hver `fs-`-klasse står i et stilark pakken sender ut;
 *   - et pakkenavn står bare i faner som har en bunter, og en URL bare i dem
 *     som ikke har det.
 *
 * Den siste er ikke pedanteri. `import … from "@fristil/designsystem/dialog"`
 * i et `<script type="module">` slår ikke opp i en nettleser: uten importmap
 * eller bunter finnes ikke pakkenavnet. Sporene «Ren HTML» og «Datastar» er
 * definert ved å ikke ha noe byggesteg, så der må adressen være en URL.
 */

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROT = fileURLToPath(new URL("../..", import.meta.url))
const SIDER = join(ROT, "documentation/src/content/docs/components")
const PAKKE = JSON.parse(
  readFileSync(join(ROT, "designsystem/package.json"), "utf8"),
)

const funn: string[] = []
const si = (side: string, melding: string) => funn.push(`${side}: ${melding}`)

/** Inngangspunktene `exports` lover, uten «./»-prefikset. */
const inngangspunkter = new Set(
  Object.keys(PAKKE.exports).map((k) =>
    k === "." ? "" : k.replace(/^\.\//, ""),
  ),
)

/** Alle klassenavn pakken faktisk definerer. */
const klasser = new Set<string>()
function lesStilark(mappe: string) {
  for (const oppf of readdirSync(mappe, { withFileTypes: true })) {
    const sti = join(mappe, oppf.name)
    if (oppf.isDirectory()) lesStilark(sti)
    else if (oppf.name.endsWith(".css"))
      for (const m of readFileSync(sti, "utf8").matchAll(
        /\.(fs-[a-z0-9-]+(?:__[a-z0-9-]+)?)/g,
      ))
        klasser.add(m[1])
  }
}
lesStilark(join(ROT, "designsystem/src"))

/** Byggefunksjonene som finnes, lest fra pakken selv. */
const { fs } = await import(join(ROT, "designsystem/dist/fs.js"))
const byggere = new Set(Object.keys(fs))

/** `defineFsX`-navnene hver modul eksporterer. */
const definerere = new Map<string, Set<string>>()
for (const inn of inngangspunkter) {
  const mål = PAKKE.exports[inn === "" ? "." : `./${inn}`]
  const js = typeof mål === "string" ? mål : mål?.import
  if (typeof js !== "string" || !js.endsWith(".js")) continue
  try {
    const modul = await import(join(ROT, "designsystem", js))
    definerere.set(inn, new Set(Object.keys(modul)))
  } catch {
    // Et inngangspunkt som ikke lar seg laste er `sjekk-server-import` sin jobb.
  }
}

/**
 * Hver `<Eksempel>` på siden, med alt som hører til.
 *
 * Dette må parses, ikke matches. Et regex på `/>` stopper på den første
 * selvlukkende taggen *inne i* eksempelet, og på ni sider er det et
 * `<input … />` i markupen. Alt bak det punktet ble aldri lest, som er
 * nøyaktig hullet denne funksjonen finnes for å lukke. Første forsøk flyttet
 * feilen fra den ene taggformen til den andre.
 *
 * Så: skann fram til `>` som faktisk avslutter åpningstaggen, altså det som
 * står utenfor `{…}` og utenfor en malstreng. Er tegnet foran en skråstrek,
 * lukker taggen seg selv. Ellers hører alt fram til `</Eksempel>` med.
 */
function eksempler(tekst: string): string[] {
  const ut: string[] = []
  for (let i = tekst.indexOf("<Eksempel"); i !== -1; ) {
    let dybde = 0
    let iMal = false
    let j = i + "<Eksempel".length
    for (; j < tekst.length; j++) {
      const c = tekst[j]
      if (c === "`") iMal = !iMal
      else if (iMal) continue
      else if (c === "{") dybde++
      else if (c === "}") dybde--
      else if (c === ">" && dybde === 0) break
    }
    if (tekst[j - 1] === "/") {
      ut.push(tekst.slice(i, j + 1))
    } else {
      const slutt = tekst.indexOf("</Eksempel>", j)
      ut.push(
        slutt === -1
          ? tekst.slice(i, j + 1)
          : tekst.slice(i, slutt + "</Eksempel>".length),
      )
    }
    i = tekst.indexOf("<Eksempel", j)
  }
  return ut
}

/**
 * Hvilke stilark en `fs-`-klasse krever, med `@import`-lukningen regnet inn.
 *
 * `search.css` henter `input.css` selv, så en oppskrift som bruker
 * `.fs-input` sammen med `.fs-search` trenger ikke begge. Uten lukningen ville
 * regelen krevd stilark som allerede kommer med.
 */
const FRA_STILARK = new Map<string, string>()
const HENTER = new Map<string, Set<string>>()
{
  const lesArk = (mappe: string) => {
    for (const oppf of readdirSync(mappe, { withFileTypes: true })) {
      const p = join(mappe, oppf.name)
      if (oppf.isDirectory()) lesArk(p)
      else if (oppf.name.endsWith(".css")) {
        const tekst = readFileSync(p, "utf8")
        for (const m of tekst.matchAll(/\.(fs-[a-z0-9-]+(?:__[a-z0-9-]+)?)/g))
          if (!FRA_STILARK.has(m[1])) FRA_STILARK.set(m[1], oppf.name)
        HENTER.set(
          oppf.name,
          new Set(
            [...tekst.matchAll(/@import "[^"]*\/([a-z-]+\.css)"/g)].map(
              (m) => m[1],
            ),
          ),
        )
      }
    }
  }
  lesArk(join(ROT, "designsystem/src"))
}

/** Klassen hver byggefunksjon gir, slått opp på funksjonsnavnet. */
const FRA_BYGGER_OMVENDT = new Map<string, string>()

/** Stilarkene et sett med oppgitte ark drar med seg, hele veien ned. */
function lukning(start: string[]): Set<string> {
  const ut = new Set<string>()
  const kø = [...start]
  while (kø.length) {
    const n = kø.pop()
    if (!n || ut.has(n)) continue
    ut.add(n)
    for (const h of HENTER.get(n) ?? []) kø.push(h)
  }
  return ut
}

const MED_BUNTER = new Set(["React", "Astro", "TypeScript"])

/**
 * Verter der byggefunksjonen gir attributter komponenten ikke setter selv.
 *
 * Bare de frittstående: der er verten noe du skriver én gang i appen, og
 * fristelsen til å skrive den for hånd er størst.
 */
const VERTER: Array<[string, string]> = [
  ["fs-toast", "toast"],
  ["fs-connection-status", "connectionStatus"],
  ["fs-session-timeout", "sessionTimeout"],
]

/**
 * Klasser en byggefunksjon faktisk sender ut, og hvilken funksjon det er.
 *
 * Uten denne ville regelen felt hver `fs-`-klasse i en React- eller
 * Astro-fane, også de som ikke har noen funksjon å kalle. `.fs-switch-row`
 * er en slik: den finnes i CSS-en, men ingen bygger gir den, og da er det å
 * skrive den for hånd det eneste alternativet.
 */
const FRA_BYGGER = new Map<string, string>()
for (const [navn, f] of Object.entries(fs)) {
  if (typeof f !== "function") continue
  let svar: unknown
  try {
    svar = (f as (o?: unknown) => unknown)({
      id: "x",
      titleId: "t",
      count: 1,
      label: "L",
    })
  } catch {
    continue
  }
  const samle = (verdi: unknown) => {
    if (Array.isArray(verdi)) return verdi.forEach(samle)
    if (!verdi || typeof verdi !== "object") return
    const o = verdi as Record<string, unknown>
    if (typeof o.class === "string")
      for (const k of o.class.split(/\s+/))
        if (k && !FRA_BYGGER.has(k)) FRA_BYGGER.set(k, navn)
    for (const v of Object.values(o)) if (typeof v === "object") samle(v)
  }
  samle(svar)

  /*
   * Og klassenavnene som henger på selve funksjonen.
   *
   * `fs.switch.row`, `fs.alert.title` og et dusin andre er klasser uten
   * attributter, så de returneres ikke av et kall, men henges på funksjonen
   * med `Object.assign`. Ser man bare på returverdien, ser det ut som et hull
   * i API-et der det ikke er noe. Nitten klasser sto slik, og
   * `.fs-switch-row` var en av dem.
   */
  for (const [nøkkel, verdi] of Object.entries(f))
    if (
      typeof verdi === "string" &&
      verdi.startsWith("fs-") &&
      !FRA_BYGGER.has(verdi)
    )
      FRA_BYGGER.set(verdi, `${navn}.${nøkkel}`)

  for (const [klasse, bygger] of FRA_BYGGER)
    if (!FRA_BYGGER_OMVENDT.has(bygger.replace(/[.(].*$/, "")))
      FRA_BYGGER_OMVENDT.set(bygger.replace(/[.(].*$/, ""), klasse)
}

/** Attributtnavnene en byggefunksjon faktisk sender ut for verten sin. */
function kreves(bygger: string): string[] {
  const svar = (fs as Record<string, (o?: unknown) => Record<string, unknown>>)[
    bygger
  ]()
  const sett = (svar.host ?? svar) as Record<string, unknown>
  return Object.keys(sett).filter((k) => k !== "class")
}

for (const fil of readdirSync(SIDER).filter((f) => f.endsWith(".mdx"))) {
  const side = fil.replace(/\.mdx$/, "")
  const tekst = readFileSync(join(SIDER, fil), "utf8")

  const start = tekst.indexOf("## Slik tar du den i bruk")
  if (start === -1) {
    si(side, "mangler seksjonen «Slik tar du den i bruk»")
    continue
  }
  const neste = tekst.indexOf("\n## ", start + 5)
  const seksjon = tekst.slice(start, neste === -1 ? undefined : neste)

  /*
   * Hver fane på hele siden, med navnet sitt, ikke bare de i oppskriften.
   *
   * Seksjoner om oppførsel har også faner nå, som «Lagring med en gang» på
   * bryteren. Leste sjekken bare oppskriften, gikk en React-fane lenger nede
   * fri, og det er den samme koden en leser limer inn.
   */
  const faner: Array<{ navn: string; kode: string; iOppskrift?: boolean }> = []
  for (const m of tekst.matchAll(
    /<TabItem label="([^"]+)">([\s\S]*?)<\/TabItem>/g,
  ))
    faner.push({ navn: m[1], kode: m[2], iOppskrift: seksjon.includes(m[2]) })

  /*
   * Og hver `<Eksempel>`, uansett om siden også har faner.
   *
   * Dette sto som en reserve som bare slo inn når siden hadde null
   * `<TabItem>`. Da forsvant hele `<Eksempel>`-delen ut av sjekken på de ti
   * sidene som har et `<Tabs>`-blokk et sted, og med den de håndskrevne
   * TypeScript-blokkene. Verst var at det var stille og asymmetrisk: la noen
   * et `<Tabs>` på en av css-sidene, slo det av sjekkingen av den sidens
   * egen oppskrift.
   */
  for (const m of eksempler(tekst)) {
    // De to halvdelene hver for seg: markupen hører til «Ren HTML», og
    // `slot="ts"` til TypeScript. Slått sammen ville kravet om pakkenavn mot
    // URL vært umulig å stille, siden de to har hver sin regel.
    const ts = m.match(/<Fragment slot="ts">([\s\S]*?)<\/Fragment>/)
    faner.push({
      navn: "Ren HTML",
      kode: ts ? m.replace(ts[0], "") : m,
      iOppskrift: seksjon.includes(m),
    })
    // `importer` hører til begge halvdelene: den sier hvilke stilark
    // eksempelet trenger, uansett hvilken fane de vises i.
    const erklaering = m.match(/importer=\{\[[^\]]*\]\}/)?.[0] ?? ""
    if (ts)
      faner.push({
        navn: "TypeScript",
        kode: erklaering + ts[1],
        iOppskrift: seksjon.includes(m),
      })
  }

  /*
   * Og resten av siden.
   *
   * Sjekken leste bare `<TabItem>` og `<Eksempel>`, så en kodeblokk som sto
   * utenfor begge gikk fri. Toast-siden hadde en slik: den gjentok
   * «Ren HTML»-oppskriften i den gamle utgaven, med et pakkenavn i et miljø
   * uten bunter og uten `data-ignore-morph`, tre avsnitt etter at siden
   * skriver at attributtet ikke er valgfritt.
   *
   * Fanenavnet er «resten», ikke et miljø, så regelen om pakkenavn mot URL
   * stilles ikke her: en prosablokk kan med rette nevne pakkenavnet. Det
   * som gjelder er at klasser, byggefunksjoner og adresser finnes.
   */
  let resten = tekst
  for (const f of faner) resten = resten.replace(f.kode, "")
  faner.push({ navn: "resten", kode: resten })

  if (faner.length === 0) faner.push({ navn: "Kode", kode: seksjon })

  for (const fane of faner) {
    const hvor = `«${fane.navn}»`

    for (const m of fane.kode.matchAll(
      /@fristil\/designsystem(?:\/([a-z0-9/.-]+))?/g,
    )) {
      const inn = m[1] ?? ""
      if (!inngangspunkter.has(inn))
        si(
          side,
          `${hvor} importerer «@fristil/designsystem/${inn}», som ikke finnes i exports`,
        )
    }

    for (const m of fane.kode.matchAll(/\b(defineFs[A-Za-z]+)\b/g)) {
      const navn = m[1]
      const finnes = [...definerere.values()].some((sett) => sett.has(navn))
      if (!finnes)
        si(side, `${hvor} kaller ${navn}(), som ingen modul eksporterer`)
    }

    for (const m of fane.kode.matchAll(/\bfs\.([a-zA-Z]+)\s*\(/g)) {
      if (!byggere.has(m[1]))
        si(side, `${hvor} kaller fs.${m[1]}(), som ikke finnes i fs`)
    }

    for (const m of fane.kode.matchAll(/class(?:Name)?="([^"]*)"/g)) {
      for (const k of m[1].split(/\s+/).filter((k) => k.startsWith("fs-")))
        if (!klasser.has(k))
          si(side, `${hvor} bruker klassen .${k}, som ingen stilark definerer`)
    }

    /*
     * Attributter byggefunksjonen sender ut, må stå i markupen.
     *
     * En oppskrift som skriver verten for hånd framfor å spre
     * byggefunksjonen, mister det byggefunksjonen ville gitt. Toast-siden
     * skrev `<fs-toast label="Meldinger">` i alle fire fanene, og da manglet
     * `data-ignore-morph` i alle fire, Datastar-fanen inkludert, der siden
     * selv skriver at attributtet ikke er valgfritt. Komponenten setter
     * `role` og `aria-label` selv, men ikke det, så en patch ville revet
     * meldingene bort.
     */
    for (const [tagg, bygger] of VERTER) {
      const vert = fane.kode.match(new RegExp(`<${tagg}\\b[^>]*>`))
      // Et bart `<fs-toast>` i en setning er prosa, ikke markup. Kravet
      // gjelder en vert som faktisk er skrevet ut, altså en med attributter.
      if (!vert || /\{\.\.\./.test(vert[0]) || !vert[0].includes("=")) continue
      for (const attributt of kreves(bygger)) {
        if (!vert[0].includes(attributt))
          si(
            side,
            `${hvor} skriver <${tagg}> for hånd uten ${attributt}, som fs.${bygger}() gir`,
          )
      }
    }

    /*
     * Lager du markupen med JavaScript, kaller du byggefunksjonen.
     *
     * Det er hele skillet dokumentasjonen skal lære bort, og en fane som
     * skriver `class="fs-input"` for hånd i React eller Astro lærer leseren
     * ingenting om `fs`. Fire faner hadde drevet dit uten at noe sa fra.
     *
     * Regelen gjelder bare der det finnes en bunter. I «Ren HTML» og
     * «Datastar» er det riktige nettopp å skrive klassen: der finnes det
     * ingen funksjon å kalle.
     */
    if (MED_BUNTER.has(fane.navn)) {
      for (const m of fane.kode.matchAll(/class(?:Name)?="(fs-[^"]*)"/g))
        for (const k of m[1].split(/\s+/))
          if (FRA_BYGGER.has(k))
            si(
              side,
              `${hvor} skriver class="${k}" for hånd, men fs.${FRA_BYGGER.get(k)} finnes. Der det er en bunter, bruk den.`,
            )
    }

    /*
     * Stilarkene må dekke klassene fanen bruker, uansett hvordan de oppgis.
     *
     * Dette er den samme feilen tre runder på rad, og hver gang fordi regelen
     * var bundet til én måte å oppgi stilarkene på. Først så den bare
     * `importer` på `<Eksempel>`, og da gikk de ni oppførselssidene fri. Så
     * fikk de håndskrevne `<link>`-blokker, og regelen så ikke dem heller: to
     * av dem manglet `button.css` mens markupen brukte `.fs-button`.
     *
     * Derfor er regelen nå én, og den spør om det som betyr noe: hvilke ark
     * har leseren fått vite om, og hvilke krever klassene i denne fanen.
     * Arkene kan komme fra `importer`, fra en `<link>` eller fra en
     * `import "@fristil/designsystem/x.css"`. Hvor de står er likegyldig.
     */
    const oppgitt = new Set<string>()
    const fraImporter = fane.kode.match(/importer=\{\[([^\]]*)\]\}/)
    if (fraImporter)
      for (const m of fraImporter[1].matchAll(/"([^"]+)"/g)) oppgitt.add(m[1])
    for (const m of fane.kode.matchAll(/href="[^"]*\/([a-z-]+\.css)"/g))
      oppgitt.add(m[1])
    for (const m of fane.kode.matchAll(
      /@fristil\/designsystem\/([a-z-]+\.css)/g,
    ))
      oppgitt.add(m[1])

    const brukteKlasser = new Set<string>()
    for (const m of fane.kode.matchAll(/class(?:Name)?="([^"]*)"/g))
      for (const k of m[1].split(/\s+/))
        if (k.startsWith("fs-")) brukteKlasser.add(k)
    for (const m of fane.kode.matchAll(/\{\.\.\.fs\.([a-zA-Z]+)[.(]/g)) {
      const klasse = FRA_BYGGER_OMVENDT.get(m[1])
      if (klasse) brukteKlasser.add(klasse)
    }

    // «resten» er prosa rundt oppskriften, ikke en oppskrift i seg selv, og
    // skal ikke måtte gjenta stilarkene seksjonen over alt har oppgitt.
    /*
     * `oppgitt.size > 0` sto her, og var det samme stille passet en gang til:
     * en fane som ikke oppga stilark i det hele tatt gikk fri, mens en som
     * oppga for få ble felt. Tabs-fanene for React og Astro sto slik.
     */
    /*
     * Bare oppskriften.
     *
     * Senere eksempler på siden er illustrasjoner, ikke hele oppskrifter, og
     * skal ikke gjenta importene seksjonen øverst alt har gitt. Der er det
     * `stiler` på `<Eksempel>` som styrer hva forhåndsvisningen laster.
     */
    if (fane.iOppskrift && brukteKlasser.size > 0) {
      const har = lukning([...oppgitt])
      const savnet = new Set<string>()
      for (const k of brukteKlasser) {
        const ark = FRA_STILARK.get(k)
        if (ark && !har.has(ark)) savnet.add(ark)
      }
      for (const ark of savnet)
        si(side, `${hvor} bruker en klasse fra ${ark}, som ikke er oppgitt`)
    }

    /*
     * En oppskrift som viser et `<fs-…>` må registrere det.
     *
     * Fem Datastar-faner viste markupen og ingenting mer. Elementet er da en
     * tom vert: ingen tastatur, ingen fokus, ingen hendelser. Registreringen
     * sto i en egen blokk lenger nede på siden, og den kjører ikke i en side
     * uten byggesteg bare fordi den står i teksten.
     *
     * «Prøv den» er unntatt: der er det Astro som har registrert den, og
     * «resten» fordi prosa ikke er en oppskrift.
     */
    if (fane.navn !== "Prøv den" && fane.navn !== "resten") {
      const verter = new Set(
        [...fane.kode.matchAll(/<(fs-[a-z-]+)[\s>]/g)].map((m) => m[1]),
      )
      for (const tagg of verter) {
        const funksjon = `defineFs${tagg
          .slice(3)
          .replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}`
        if (!fane.kode.includes(funksjon))
          si(side, `${hvor} viser <${tagg}> uten å kalle ${funksjon}()`)
      }
    }

    /*
     * Bruker fanen `fs.`, må den importere det.
     *
     * Astro-fanen på feltsiden kalte `fs.input()` og `fs.errorText()` mens
     * frontmatteren bare importerte stilark. Limt inn er `fs` udefinert, og
     * siden feiler ved bygging. Feilen kom av at håndskrevne klasser ble
     * byttet mot byggefunksjoner uten at importen fulgte med.
     */
    if (fane.navn !== "resten" && /\bfs\.[a-zA-Z]/.test(fane.kode)) {
      const importert =
        /import \{[^}]*\bfs\b[^}]*\} from "@fristil\/designsystem/.test(
          fane.kode,
        ) || /<Eksempel\b/.test(fane.kode)
      if (!importert) si(side, `${hvor} bruker fs. uten å importere fs`)
    }

    const pakkenavnIImport = /from\s+\n?\s*"@fristil\/designsystem/.test(
      fane.kode,
    )
    const urlIImport = /from\s+\n?\s*"https:\/\/cdn\./.test(fane.kode)
    if (
      !MED_BUNTER.has(fane.navn) &&
      fane.navn !== "Kode" &&
      fane.navn !== "resten" &&
      fane.navn !== "Prøv den"
    ) {
      if (pakkenavnIImport && !urlIImport)
        si(
          side,
          `${hvor} importerer et pakkenavn i et miljø uten bunter. En nettleser kan ikke slå det opp, så koden virker ikke limt inn. Bruk hele URL-en.`,
        )
    }
  }
}

if (funn.length > 0) {
  console.error(
    `Fant ${funn.length} avvik i oppskriftene:\n${funn.map((f) => `  - ${f}`).join("\n")}`,
  )
  process.exit(1)
}
console.log("Oppskriftene peker på noe som finnes.")

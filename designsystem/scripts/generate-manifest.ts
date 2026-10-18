/**
 * Skriver manifestet: det Fristil lover, som data alle verktøy leser.
 *
 * Tre filer, alle generert og sjekket inn:
 *
 *   - `manifest/manifest.json`: ordforrådet (elementene og klassene, de samme
 *     som `classes.ts` og `elements.ts`) og hver byggefunksjon i `fs` med
 *     valgene og formen på svaret. Den er liten, og hver vert gir den til
 *     Rust-kjernen.
 *   - `manifest/byggetilfeller.json`: hver byggefunksjon kalt med mange
 *     kombinasjoner av valgene, med svaret TypeScript gir. En utgave i et annet
 *     språk skal svare nøyaktig det samme på hvert tilfelle.
 *   - `manifest/filer.json`: regelbøkene og komponentfilene kommandolinja
 *     leser fra pakken.
 *
 * Ingenting her er skrevet for hånd. Valgene og typene deres leses av
 * TypeScript-kompilatoren fra signaturene i `src/fs.ts`, i
 * `byggefunksjoner.ts`, og svarene kommer fra å kalle funksjonene. En ny
 * byggefunksjon, et nytt valg eller en ny variant havner i manifestet ved
 * neste bygg. `bun run build` skriver filene på nytt før det sjekker noe, så
 * en utdatert fil på disk stopper ikke bygget; det er steget «Ingenting er
 * ugenerert» i CI som feller en endring der filene ikke er regenerert og
 * committet.
 *
 * Kjør med: bun scripts/generate-manifest.ts, eller som en del av `generate`.
 */

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { fileURLToPath } from "node:url"
import { fs } from "../src/fs.js"
import { FAMILIES, NEUTRAL_LAYERS, ROLES } from "../src/tokens/matrise.js"
import {
  Breakpoints,
  Containers,
  colorTokens,
  cssTokens,
  FAMILY_DESCRIPTIONS,
  LAYER_DESCRIPTIONS,
  ROLE_DESCRIPTIONS,
} from "../src/tokens/tokens.js"
import { classes } from "../src/vocabulary/classes.js"
import { elements } from "../src/vocabulary/elements.js"
import {
  type Byggefunksjon as Lest,
  lesByggefunksjoner,
  settene,
  type Valg,
  type Valgtype,
} from "./byggefunksjoner.js"

const PAKKE = fileURLToPath(new URL("..", import.meta.url))
const UT = `${PAKKE}manifest/`
const SKJEMAVERSJON = 1
const versjon: string = JSON.parse(
  readFileSync(`${PAKKE}package.json`, "utf8"),
).version

type Byggefunksjon = Lest & { table?: Tabeller }

const byggefunksjoner: Byggefunksjon[] = lesByggefunksjoner()

/*
 * Tilfellene. Hvert valg prøves alene, og så alle kombinasjonene når de er
 * få nok. Er de for mange, trekkes et fast utvalg med et fast frø, så fila er
 * lik fra bygg til bygg. Tekstverdiene har med mellomrom som JavaScript regner
 * som mellomrom og Java ikke gjør som standard, hardt mellomrom og BOM: uten
 * dem ville en utgave som deler på ASCII-mellomrom alene, bestått.
 */
const PRØVER: Record<Valgtype["kind"], unknown[]> = {
  values: [],
  flag: [false, true],
  text: ["x", "a b", ""],
  number: [0, 1, 3],
  textList: [[], ["x"], ["x", "x"], ["  x   y "], ["x y"], ["﻿x"], [""]],
}
const prøver = (v: Valg) => {
  const verdier = v.type.kind === "values" ? v.type.values : PRØVER[v.type.kind]
  // En påkrevd id som er tom, får TypeScript til å lage en tilfeldig id og
  // si fra i konsollen. Svaret er da ulikt fra kjøring til kjøring, og et
  // språk med typer stopper det før det kjører. Den prøves ikke.
  if (v.required)
    return v.type.kind === "text" ? verdier.filter((x) => x !== "") : verdier
  return [undefined, ...verdier]
}

const MAKS_KOMBINASJONER = 512
const UTVALG = 256

type Tilfelle = {
  builder: string
  options: Record<string, unknown>
  expected?: unknown
  throws?: string
}

function kombinasjoner(valg: Valg[]): Record<string, unknown>[] {
  const akser = valg.map(prøver)
  const grunn = Object.fromEntries(
    valg.flatMap((v, i) => (v.required ? [[v.name, akser[i][0]]] : [])),
  )
  const ut: Record<string, unknown>[] = [{ ...grunn }]
  valg.forEach((v, i) => {
    for (const verdi of akser[i]) ut.push({ ...grunn, [v.name]: verdi })
  })
  const antall = akser.reduce((n, a) => n * a.length, 1)
  if (antall <= MAKS_KOMBINASJONER) {
    let alle: Record<string, unknown>[] = [{}]
    valg.forEach((v, i) => {
      alle = alle.flatMap((delvis) =>
        akser[i].map((verdi) => ({ ...delvis, [v.name]: verdi })),
      )
    })
    ut.push(...alle)
  } else {
    let frø = 20261007
    const tilfeldig = (n: number) => {
      frø = (frø * 1103515245 + 12345) % 2 ** 31
      return frø % n
    }
    for (let n = 0; n < UTVALG; n++)
      ut.push(
        Object.fromEntries(
          valg.map((v, i) => [v.name, akser[i][tilfeldig(akser[i].length)]]),
        ),
      )
  }
  // `undefined` betyr utelatt, og to tilfeller som bare skiller seg der, er
  // det samme tilfellet.
  const sett = new Map<string, Record<string, unknown>>()
  for (const o of ut) {
    const renset = Object.fromEntries(
      Object.entries(o).filter(([, x]) => x !== undefined),
    )
    sett.set(JSON.stringify(renset), renset)
  }
  return [...sett.values()]
}

const tilfeller: Tilfelle[] = []
// Byggefunksjonene advarer i konsollen om bruk de ikke liker. Det er en del
// av hva de gjør i nettleseren, ikke av svaret, og her er det støy.
const advar = console.warn
console.warn = () => {}
try {
  for (const b of byggefunksjoner) {
    const bygg = (fs as unknown as Record<string, (o: unknown) => unknown>)[
      b.name
    ]
    for (const options of kombinasjoner(b.options)) {
      try {
        tilfeller.push({ builder: b.name, options, expected: bygg(options) })
      } catch (feil) {
        tilfeller.push({
          builder: b.name,
          options,
          throws: feil instanceof Error ? feil.message : String(feil),
        })
      }
    }
  }
} finally {
  console.warn = advar
}

/*
 * Tabellen: en byggefunksjon der hvert valg legger til faste attributter,
 * uavhengig av de andre valgene, kan beskrives som en grunnmengde og det hvert
 * valg bidrar med. Da kan et annet språk lage den fra manifestet alene, uten
 * at noen skriver den for hånd.
 *
 * Tabellen er utledet av svarene, ikke av koden, og den tas bare med når den
 * gir nøyaktig det TypeScript svarte på hvert eneste tilfelle. En byggefunksjon
 * der valgene virker sammen, som `label`, der `optional` ikke gjelder når
 * `required` er satt, får ingen tabell og skrives for hånd.
 *
 * Verdiene er tekst. Et boolsk attributt som er på, er den tomme strengen, og
 * `null` betyr at valget fjerner et attributt grunnmengden har. En verdi som
 * er nøyaktig `{navn}`, er verdien av valget med det navnet, slik
 * `{ "aria-labelledby": "{titleId}" }` i `dialog`. En byggefunksjon som svarer
 * med flere sett, som `dialog` og `popover`, får én tabell per sett.
 */
type Attributter = Record<string, string | null>
type Tabellvalg = {
  cases: Record<string, Attributter>
  template?: Attributter
  empty?: Attributter
}
type Tabell = { base: Attributter; options: Record<string, Tabellvalg> }
type Tabeller =
  | { kind: "attributes"; table: Tabell }
  | { kind: "group"; fields: Record<string, Tabell> }

const tekst = (verdier: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(verdier).map(([k, v]) => [k, v === true ? "" : String(v)]),
  )

function forskjell(
  grunn: Record<string, string>,
  svar: Record<string, string>,
): Attributter {
  const d: Attributter = {}
  for (const k of new Set([...Object.keys(grunn), ...Object.keys(svar)]))
    if (svar[k] !== grunn[k]) d[k] = svar[k] ?? null
  return d
}

const likt = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
// Rekkefølgen på attributtene betyr ikke noe for svaret.
const sortert = (x: Record<string, string>) =>
  Object.fromEntries(Object.entries(x).sort(([a], [c]) => (a < c ? -1 : 1)))

/** Bytter verdier som er nøyaktig verdien av et påkrevd valg, med `{navn}`. */
function medPlassholdere(
  a: Attributter,
  påkrevde: [string, string][],
): Attributter {
  return Object.fromEntries(
    Object.entries(a).map(([k, x]) => {
      const treff = påkrevde.find(([, verdi]) => verdi === x)
      return [k, treff ? `{${treff[0]}}` : x]
    }),
  )
}

/** Tabellen for ett sett, der `sett` plukker settet ut av svaret. */
function tabellFor(
  b: Byggefunksjon,
  egne: Tilfelle[],
  grunnValg: Record<string, unknown>,
  sett: (svar: unknown) => Record<string, unknown>,
): Tabell | undefined {
  const påkrevde = Object.entries(grunnValg).map(
    ([k, v]) => [k, String(v)] as [string, string],
  )
  const grunnTilfelle = egne.find((t) => likt(t.options, grunnValg))
  if (!grunnTilfelle) return undefined
  const grunn = tekst(sett(grunnTilfelle.expected))

  const options: Record<string, Tabellvalg> = {}
  for (const v of b.options) {
    if (v.required) continue
    const enkle = egne.filter(
      (t) =>
        Object.keys(t.options).length === påkrevde.length + 1 &&
        v.name in t.options &&
        påkrevde.every(([k]) => likt(t.options[k], grunnValg[k])),
    )
    const valg: Tabellvalg = { cases: {} }
    for (const t of enkle) {
      const verdi = t.options[v.name]
      const d = medPlassholdere(
        forskjell(grunn, tekst(sett(t.expected))),
        påkrevde,
      )
      if (v.type.kind === "values" || v.type.kind === "flag") {
        valg.cases[String(verdi)] = d
        continue
      }
      if (v.type.kind === "textList") return undefined
      // Tekst og tall: der verdien står, står plassholderen.
      const s = String(verdi)
      if (s === "") {
        valg.empty = d
        continue
      }
      const mal = Object.fromEntries(
        Object.entries(d).map(([k, x]) => [k, x === s ? `{${v.name}}` : x]),
      )
      if (valg.template && !likt(valg.template, mal)) return undefined
      valg.template = mal
    }
    options[v.name] = valg
  }

  const resultat: Tabell = { base: medPlassholdere(grunn, påkrevde), options }
  for (const t of egne) {
    const fasit = sortert(tekst(sett(t.expected)))
    if (!likt(anvend(resultat, b, t.options), fasit)) return undefined
  }
  return resultat
}

function tabeller(b: Byggefunksjon): Tabeller | undefined {
  const egne = tilfeller.filter((t) => t.builder === b.name)
  if (egne.length === 0 || egne.some((t) => t.throws)) return undefined
  // Grunnen er de påkrevde valgene med sin første prøveverdi, og ingen andre.
  const grunnValg = Object.fromEntries(
    b.options.filter((v) => v.required).map((v) => [v.name, prøver(v)[0]]),
  )
  if (b.returns.kind === "attributes") {
    const table = tabellFor(
      b,
      egne,
      grunnValg,
      (svar) => svar as Record<string, unknown>,
    )
    return table && { kind: "attributes", table }
  }
  if (b.returns.kind !== "group") return undefined
  const fields: Record<string, Tabell> = {}
  for (const [navn, felt] of Object.entries(b.returns.fields)) {
    if (felt.kind !== "attributes" || felt.optional) return undefined
    const table = tabellFor(
      b,
      egne,
      grunnValg,
      (svar) => (svar as Record<string, Record<string, unknown>>)[navn],
    )
    if (!table) return undefined
    fields[navn] = table
  }
  return { kind: "group", fields }
}

/** Svaret tabellen gir for valgene. Brukes til å etterprøve den. */
function anvend(
  t: Tabell,
  b: Byggefunksjon,
  valg: Record<string, unknown>,
): Record<string, string> {
  const fyll = (a: Attributter): Attributter =>
    Object.fromEntries(
      Object.entries(a).map(([k, x]) => {
        const navn = x?.match(/^\{(\w+)\}$/)?.[1]
        return [k, navn !== undefined && navn in valg ? String(valg[navn]) : x]
      }),
    )
  const svar: Attributter = fyll(t.base)
  for (const v of b.options) {
    if (v.required || !(v.name in valg)) continue
    const verdi = valg[v.name]
    const tv = t.options[v.name]
    const bidrag =
      v.type.kind === "values" || v.type.kind === "flag"
        ? tv.cases[String(verdi)]
        : String(verdi) === "" && tv.empty
          ? tv.empty
          : tv.template
    if (!bidrag) return { "\u0000": "mangler" }
    Object.assign(svar, fyll(bidrag))
  }
  const ut: Record<string, string> = {}
  for (const [k, x] of Object.entries(svar)) if (x !== null) ut[k] = x
  return sortert(ut)
}

for (const b of byggefunksjoner) {
  const t = tabeller(b)
  if (t) b.table = t
}

/*
 * Beskrivelsen av et klasseattributt er beskrivelsen av valget med samme
 * navn, `variant` for `data-variant`, og klassen finnes som flaggene over:
 * et tilfelle med valget mot det samme uten. Et valg med et annet navn kan
 * også endre attributtet, som `type` gjør med `data-variant` i `fs.input()`,
 * men da beskriver det noe annet. Skriver flere byggefunksjoner det samme
 * attributtet, vinner den første i alfabetet.
 */
const descriptions = new Map<string, string>()
for (const builder of byggefunksjoner) {
  const own = tilfeller.filter((t) => t.builder === builder.name && t.expected)
  for (const option of builder.options) {
    if (!option.description) continue
    const attribute = `data-${option.name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
    for (const withOption of own.filter(
      (t) => t.options[option.name] !== undefined,
    )) {
      const { [option.name]: _, ...withoutOption } = withOption.options
      const base = own.find((t) => likt(t.options, withoutOption))
      if (!base) continue
      const before = new Map(settene(base.expected))
      for (const [setName, set] of settene(withOption.expected)) {
        if (likt(set[attribute], before.get(setName)?.[attribute])) continue
        const classNames = String(set.class ?? "")
          .split(/\s+/)
          .filter((c) => classes[c])
        for (const className of classNames)
          if (!descriptions.has(`${className} ${attribute}`))
            descriptions.set(`${className} ${attribute}`, option.description)
      }
    }
  }
}
const withDescriptions = (
  className: string,
  attributes: Record<string, object>,
) =>
  Object.fromEntries(
    Object.entries(attributes).map(([attribute, value]) => {
      const description = descriptions.get(`${className} ${attribute}`)
      return [attribute, description ? { ...value, description } : value]
    }),
  )

const klasser = Object.fromEntries(
  Object.entries(classes).map(([navn, klasse]) => [
    navn,
    {
      ...klasse,
      attributes: withDescriptions(
        navn,
        // Flaggene, som `data-interactive` på `fs-card`, står i `classes.ts`
        // med en tom verdiliste, siden editorene leser den fila. Her har et
        // flagg ingen verdier, se `types.ts`. De utledes av byggefunksjonen
        // hver gang ordforrådet skrives, se `flaggFor` i byggefunksjoner.ts,
        // så et flagg som er borte fra funksjonen er borte her også.
        Object.fromEntries(
          Object.entries(klasse.attributes).map(([attributt, verdi]) => [
            attributt,
            verdi.flag ? { flag: true } : verdi,
          ]),
        ),
      ),
    },
  ]),
)

/*
 * Tokenene: det et stilark utenfor pakken kan bygge på uten å finne på egne
 * verdier. Avstandsskalaen, brekkpunktene og containerbreddene leses fra
 * `tokens.ts`, der brekkpunktene og breddene ellers bare finnes i TypeScript.
 * Fargene står som akser med hva de er til, ikke som hex: kuløren er
 * konsumentens, og et tema kan ha andre verdier enn Fristils egne.
 *
 * Komponentvariablene leses fra stilarkene. En variabel er det første leddet
 * i `var(--fs-<komponent>-…, <reserve>)`, og reserven er standardverdien
 * konsumenten overstyrer. Står den samme variabelen med to reserver, som
 * `--fs-list-gap` i en delt liste, er det den første i stilarket som gjelder.
 * Hver hører til komponenten navnet begynner med, ikke til stilarket den
 * leses i: `fieldset.css` leser `--fs-label-required-symbol`, og den er
 * ledetekstens.
 */
const roleToCss = (role: string) =>
  role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
const COMPONENT_DIRS = ["css", "ramme", "frittstaende"].flatMap((kategori) =>
  readdirSync(`${PAKKE}src/components/${kategori}`)
    .filter((navn) =>
      statSync(`${PAKKE}src/components/${kategori}/${navn}`).isDirectory(),
    )
    .sort()
    .map((navn) => ({
      navn,
      sti: `${PAKKE}src/components/${kategori}/${navn}`,
    })),
)
const componentNames = COMPONENT_DIRS.map((d) => d.navn)
/** Komponenten en variabel hører til: det lengste navnet den begynner med. */
const ownerOf = (variable: string, fallback: string) =>
  componentNames
    .filter((navn) => variable.startsWith(`--fs-${navn}-`))
    .sort((a, b) => b.length - a.length)[0] ?? fallback
const TOKEN_KINDS = new Set(
  Object.keys({ ...cssTokens, ...colorTokens }).map(
    (navn) => navn.split("-")[3],
  ),
)
/*
 * Variablene en web-komponent skriver selv, som `--fs-popover-top`, er ikke
 * noe konsumenten overstyrer: inline-stilen slår et stilark. De leses med
 * reserve i CSS-en som alle andre, og kjennes igjen på `setProperty` i
 * komponentens egen kilde.
 */
const setByComponent = new Set<string>()
for (const { sti } of COMPONENT_DIRS)
  for (const fil of readdirSync(sti).filter(
    (f) => f.endsWith(".ts") && !f.includes(".test."),
  ))
    for (const m of readFileSync(`${sti}/${fil}`, "utf8").matchAll(
      /setProperty\(\s*["'](--fs-[a-z0-9-]+)["']/g,
    ))
      setByComponent.add(m[1])
const componentVariables: Record<string, Record<string, string>> = {}
for (const { navn, sti } of COMPONENT_DIRS) {
  for (const fil of readdirSync(sti)
    .filter((f) => f.endsWith(".css"))
    .sort()) {
    const css = readFileSync(`${sti}/${fil}`, "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    )
    const lesing = /var\(\s*(--fs-[a-z0-9-]+)\s*,/g
    for (let m = lesing.exec(css); m; m = lesing.exec(css)) {
      // Reserven går til parentesen som lukker `var(`, også når den har
      // `calc()` eller en annen `var()` i seg.
      let dybde = 1
      let i = lesing.lastIndex
      for (; i < css.length && dybde > 0; i++) {
        if (css[i] === "(") dybde++
        else if (css[i] === ")") dybde--
      }
      const variabel = m[1]
      // Et token hører på tokensiden, ikke her. I dag leser ingen komponent
      // et token med reserve, men gjorde en det, ville det sett ut som en
      // komponentvariabel uten dette.
      if (TOKEN_KINDS.has(variabel.split("-")[3])) continue
      if (setByComponent.has(variabel)) continue
      const reserve = css
        .slice(lesing.lastIndex, i - 1)
        .trim()
        .replace(/\s+/g, " ")
      const eier = ownerOf(variabel, navn)
      componentVariables[eier] ??= {}
      componentVariables[eier][variabel] ??= reserve
    }
  }
}
const tokens = {
  spacing: Object.fromEntries(
    Object.entries(cssTokens).filter(([navn]) =>
      navn.startsWith("--fs-spacing-"),
    ),
  ),
  breakpoints: Breakpoints,
  containers: Containers,
  colors: {
    families: Object.fromEntries(
      FAMILIES.map((familie) => [familie, FAMILY_DESCRIPTIONS[familie]]),
    ),
    roles: Object.fromEntries(
      (Object.keys(ROLES) as (keyof typeof ROLES)[]).map((rolle) => [
        roleToCss(rolle),
        ROLE_DESCRIPTIONS[rolle],
      ]),
    ),
    layers: Object.fromEntries(
      (Object.keys(NEUTRAL_LAYERS) as (keyof typeof NEUTRAL_LAYERS)[]).map(
        (lag) => [lag, LAYER_DESCRIPTIONS[lag]],
      ),
    ),
    tokens: Object.keys(colorTokens).filter((navn) =>
      navn.startsWith("--fs-color-"),
    ),
  },
  components: Object.fromEntries(
    Object.entries(componentVariables).sort(([a], [b]) => a.localeCompare(b)),
  ),
}

const manifest = {
  $schema: "./manifest.schema.json",
  schemaVersion: SKJEMAVERSJON,
  version: versjon,
  elements,
  classes: klasser,
  builders: byggefunksjoner,
  tokens,
}

mkdirSync(UT, { recursive: true })
writeFileSync(`${UT}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(
  `${UT}byggetilfeller.json`,
  `${JSON.stringify({ version: versjon, cases: tilfeller })}\n`,
)

/*
 * Filene kommandolinja leser fra pakken: regelbøkene for `fristil agent` og
 * kildekoden til hver komponent for `fristil overta`, uten testene. Den leser
 * lista framfor mappene, fordi en mappe ikke lot seg lese gjennom Nodes WASI
 * på Windows: `overta` fant ingen komponenter der.
 */
const ls = (mappe: string) => readdirSync(`${PAKKE}${mappe}`).sort()
const filer = {
  agent: ls("agent")
    .filter((fil) => fil.endsWith(".md"))
    .map((fil) => fil.slice(0, -3)),
  components: ["css", "ramme", "frittstaende"].flatMap((kategori) =>
    ls(`src/components/${kategori}`)
      .filter((navn) =>
        statSync(`${PAKKE}src/components/${kategori}/${navn}`).isDirectory(),
      )
      .map((navn) => ({
        category: kategori,
        name: navn,
        files: ls(`src/components/${kategori}/${navn}`).filter(
          (fil) => !fil.includes(".test."),
        ),
      })),
  ),
}
writeFileSync(`${UT}filer.json`, `${JSON.stringify(filer, null, 2)}\n`)

console.log(
  `✓ Manifestet: ${byggefunksjoner.length} byggefunksjoner, ${Object.keys(elements).length} elementer, ${Object.keys(classes).length} klasser, ${tilfeller.length} byggetilfeller, ${Object.values(componentVariables).reduce((n, v) => n + Object.keys(v).length, 0)} komponentvariabler.`,
)

/**
 * At ordforrådet og editorfilene på disk er de `generate-ordforrad.ts` ville
 * skrevet nå, og at
 * `metadata.ts` dekker hvert element pakken registrerer og hver klasse i
 * CSS-en, med deler som treffer markupen på komponentsidene.
 *
 * Typesjekken tar attributtene: `metadata.ts` skriver dem som `Record` over
 * komponentens `observedAttributes`, så et attributt som mangler eller er
 * til overs stopper `tsc`. Det typesjekken ikke kan se, er et helt element
 * som ikke står i lista. Derfor leses `exports` i pakken her, hver modul
 * importeres, og hver klasse med `observedAttributes` må ha sin oppføring.
 * Lista over forventede elementer kommer altså fra pakken, ikke fra
 * metadataen, ellers etterprøver vakten bare seg selv.
 *
 * Kjør med: bun scripts/sjekk-ordforrad.ts, eller som en del av `bun run build`.
 * Krever at `designsystem/dist` er bygd.
 *
 * I bygget har `generate` nettopp skrevet filene, så del 1 sammenligner med
 * det som ble skrevet og finner ingenting; det er steget «Ingenting er
 * ugenerert» i CI som feller en endring der filene ikke er committet. Kjørt
 * alene sier del 1 om filene på disk er utdaterte. Del 2 gjelder i begge
 * tilfeller.
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { classesData, files, ROOT } from "./generate-ordforrad"
import { elements } from "./metadata"

const findings: string[] = []

// 1. Filene på disk er ferske. Generatoren stopper på en klasse uten
// innhold i `classDocs`, og på en rad uten klasse, og da står meldingen her.
let generated: Record<string, string>
try {
  generated = files()
} catch (error) {
  console.error(`  - ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
for (const [path, expected] of Object.entries(generated)) {
  let actual: string | null = null
  try {
    actual = readFileSync(join(ROOT, path), "utf8")
  } catch {
    // Mangler: meldes under.
  }
  if (actual === null)
    findings.push(
      `${path} finnes ikke. Kjør bun --filter @fristil/designsystem ordforrad.`,
    )
  else if (actual !== expected)
    findings.push(
      `${path} er utdatert. Kjør bun --filter @fristil/designsystem ordforrad.`,
    )
}

// 2. Hvert element pakken registrerer har en oppføring i metadata.ts.
type Component = { observedAttributes: readonly string[] }
const pkg = JSON.parse(
  readFileSync(join(ROOT, "designsystem/package.json"), "utf8"),
)
/*
 * Bare modulene som eksporterer nøyaktig ett element teller. Hovedinngangen
 * og `/react` eksporterer alle ni, og der ville «første tagg» og «første
 * klasse» kunne høre til hver sin komponent. Et `Map` gjør samtidig at det
 * samme elementet ikke telles to ganger om det står bak to inngangspunkter.
 */
const registered = new Map<string, readonly string[]>()
/** Delene modulen eksporterer i `FS_…_PARTS`, for elementene som har dem. */
const exportedParts = new Map<string, Record<string, string>>()
/** Hver tagg noen modul eksporterer, hovedinngangen medregnet. */
const allTags = new Set<string>()
for (const target of Object.values(
  pkg.exports as Record<string, string | Record<string, string>>,
)) {
  const js = typeof target === "string" ? target : target.import
  if (typeof js !== "string" || !js.endsWith(".js")) continue
  const module: Record<string, unknown> = await import(
    join(ROOT, "designsystem", js)
  )
  const tags = Object.entries(module)
    .filter(
      ([name, value]) => name.endsWith("_TAG") && typeof value === "string",
    )
    .map(([, value]) => value as string)
  const components = Object.values(module).filter(
    (value): value is Component =>
      typeof value === "function" && "observedAttributes" in value,
  )
  for (const tag of tags) allTags.add(tag)
  if (tags.length !== 1 || components.length !== 1) continue
  registered.set(tags[0], components[0].observedAttributes)
  const parts = Object.entries(module).filter(([name]) =>
    name.endsWith("_PARTS"),
  )
  if (parts.length > 1)
    findings.push(`<${tags[0]}> eksporterer mer enn ett sett deler`)
  if (parts.length === 1)
    exportedParts.set(tags[0], parts[0][1] as Record<string, string>)
}

const documented = new Map(elements.map((e) => [e.tag, e]))
for (const [tag, attributes] of registered) {
  const doc = documented.get(tag)
  if (!doc) {
    findings.push(`<${tag}> er registrert i pakken, men mangler i metadata.ts`)
    continue
  }
  const missing = attributes.filter((a) => !(a in doc.attributes))
  const extra = Object.keys(doc.attributes).filter(
    (a) => !attributes.includes(a),
  )
  if (missing.length)
    findings.push(`<${tag}> mangler attributter i metadata.ts: ${missing}`)
  if (extra.length)
    findings.push(
      `<${tag}> har attributter i metadata.ts som ikke finnes: ${extra}`,
    )
}
// En tagg som bare finnes i en modul med flere elementer, som hovedinngangen,
// ville ellers hoppet stille over både denne sjekken og metadataen.
for (const tag of allTags)
  if (!registered.has(tag))
    findings.push(
      `<${tag}> eksporteres, men ikke fra et inngangspunkt med ett element`,
    )
for (const tag of documented.keys())
  if (!registered.has(tag))
    findings.push(
      `<${tag}> står i metadata.ts, men pakken registrerer det ikke`,
    )

// 2a. Hver del komponenten eksporterer har en beskrivelse i metadata.ts, med
// den samme selektoren. Typen i `parts()` krever det for en komponent som står
// i tabellen; denne ser komponenten som ikke gjør det.
for (const [tag, parts] of exportedParts) {
  const doc = documented.get(tag)?.parts ?? {}
  for (const [name, selector] of Object.entries(parts))
    if (!doc[name])
      findings.push(`<${tag}> har delen «${name}», som mangler i metadata.ts`)
    else if (doc[name].selector !== selector)
      findings.push(
        `<${tag}> har en annen selektor for «${name}» i dist enn i kilden. Bygg pakken.`,
      )
  for (const name of Object.keys(doc))
    if (!(name in parts))
      findings.push(
        `<${tag}> har delen «${name}» i metadata.ts, men eksporterer den ikke`,
      )
}

// 2b. Hendelsene i metadata.ts er de komponenten sender, verken flere eller
// færre. Typesjekken ser ikke dette: navnet står bare i en streng, i
// `new CustomEvent("…")` eller i komponentens egen `emit("…")`.
const kilde = (tag: string): string | null => {
  const slug = tag.replace(/^fs-/, "")
  for (const kategori of ["ramme", "frittstaende"]) {
    try {
      return readFileSync(
        join(ROOT, "designsystem/src/components", kategori, slug, `${tag}.ts`),
        "utf8",
      )
    } catch {
      // Prøv neste kategori.
    }
  }
  return null
}
for (const element of elements) {
  const tekst = kilde(element.tag)
  if (tekst === null) {
    findings.push(`Fant ikke kildekoden til <${element.tag}>`)
    continue
  }
  const sendt = new Set(
    [...tekst.matchAll(/(?:new CustomEvent|emit)\(\s*"([a-z-]+)"/g)].map(
      (m) => m[1],
    ),
  )
  const beskrevet = new Set(Object.keys(element.events))
  for (const navn of sendt)
    if (!beskrevet.has(navn))
      findings.push(
        `<${element.tag}> sender «${navn}», som mangler i metadata.ts`,
      )
  for (const navn of beskrevet)
    if (!sendt.has(navn))
      findings.push(
        `<${element.tag}> har «${navn}» i metadata.ts, men sender den ikke`,
      )
}

// 2c. Hver del en klasse har, treffer markupen på komponentsiden, og
// `partOf` peker på en klasse med en del som treffer denne. Selektorene er
// relative til elementet med klassen, som for elementene, så hver av dem
// settes bak `.klassen` før den prøves. Sidene leses som tekst, og det som
// prøves er hver `kode={…}` og hver ```html-blokk, altså alt leseren ser.
// Treffer en del ingenting der, viser siden ikke delen, eller selektoren
// er skrevet for noe annet enn det siden viser.
const classes = classesData()
const PAGES = join(ROOT, "documentation/src/content/docs")
const markupByPage = new Map<string, string>()
function pageMarkup(component: string): string {
  const path = [
    join(PAGES, "components", `${component}.mdx`),
    join(PAGES, `${component}.mdx`),
  ].find((p) => existsSync(p))
  if (!path) {
    findings.push(`Fant ingen side for komponenten «${component}»`)
    return ""
  }
  let markup = markupByPage.get(path)
  if (markup === undefined) {
    const page = readFileSync(path, "utf8")
    markup = [
      ...[...page.matchAll(/kode=\{`([\s\S]*?)`\}/g)].map((m) => m[1]),
      ...[...page.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1]),
    ].join("\n")
    markupByPage.set(path, markup)
  }
  return markup
}
/** Alternativene i en selektorliste, delt på komma utenfor klammer. */
function alternatives(selector: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i]
    if (c === "(" || c === "[") depth++
    else if (c === ")" || c === "]") depth--
    else if (c === "," && depth === 0) {
      out.push(selector.slice(start, i).trim())
      start = i + 1
    }
  }
  out.push(selector.slice(start).trim())
  return out
}
/** Antall treff for en selektor i markupen, med Buns innebygde parser. */
async function matches(selector: string, markup: string): Promise<number> {
  let count = 0
  await new HTMLRewriter()
    .on(selector, {
      element() {
        count++
      },
    })
    .transform(new Response(markup))
    .text()
  return count
}
let classParts = 0
for (const [name, info] of Object.entries(classes)) {
  if (info.partOf !== undefined) {
    const parent = classes[info.partOf]
    if (!parent)
      findings.push(
        `${name} har partOf «${info.partOf}», som ikke er en klasse`,
      )
    else if (
      !Object.values(parent.parts ?? {}).some((part) =>
        // Hele navnet: `.fs-dialog` skal ikke telle som `.fs-dialog__title`.
        new RegExp(`\\.${name}(?![\\w-])`).test(part.selector),
      )
    )
      findings.push(
        `${name} har partOf «${info.partOf}», men ${info.partOf} har ingen del som treffer .${name}`,
      )
  }
  if (!info.parts) continue
  const markup = pageMarkup(info.component)
  for (const [part, { selector }] of Object.entries(info.parts)) {
    classParts++
    const absolute = alternatives(selector)
      .map((s) => `.${name} ${s}`)
      .join(", ")
    if ((await matches(absolute, markup)) === 0)
      findings.push(
        `${name}: delen «${part}» (${selector}) treffer ikke markupen på siden til ${info.component}`,
      )
  }
}

// 3. Hver snippet viser elementet sitt. «Har markup» holdt ikke: dialogens
// snippet hadde en `<dialog>` og ikke noe `<fs-dialog>`.
const snippets = JSON.parse(generated["designsystem/snippets.json"]) as Record<
  string,
  { body: string[] }
>
for (const element of elements) {
  const body = snippets[element.tag]?.body ?? []
  if (!body.some((line) => line.includes(`<${element.tag}`)))
    findings.push(`Snippeten for <${element.tag}> inneholder ikke elementet`)
}

// 4. Tell, sist. Både likt det forventede og større enn null.
const counted = registered.size
console.log(
  `Sjekket ${counted} elementer i pakken mot ${documented.size} i metadata.ts, ${exportedParts.size} med deler, ${Object.keys(classes).length} klasser med ${classParts} deler, ${Object.keys(snippets).length} snippets og ${Object.keys(generated).length} filer`,
)
if (counted === 0) findings.push("Fant ingen elementer i pakken. Er dist bygd?")
if (exportedParts.size === 0)
  findings.push("Fant ingen deler i pakken. Er dist bygd?")
if (classParts === 0)
  findings.push("Ingen klasse hadde deler, så ingen selektor ble prøvd.")

if (findings.length) {
  console.error(findings.map((f) => `  - ${f}`).join("\n"))
  process.exit(1)
}

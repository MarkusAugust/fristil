/**
 * At editorfilene på disk er de generatoren ville skrevet nå, og at
 * `metadata.ts` dekker hvert element pakken registrerer.
 *
 * Typesjekken tar attributtene: `metadata.ts` skriver dem som `Record` over
 * komponentens `observedAttributes`, så et attributt som mangler eller er
 * til overs stopper `tsc`. Det typesjekken ikke kan se, er et helt element
 * som ikke står i lista. Derfor leses `exports` i pakken her, hver modul
 * importeres, og hver klasse med `observedAttributes` må ha sin oppføring.
 * Lista over forventede elementer kommer altså fra pakken, ikke fra
 * metadataen, ellers etterprøver vakten bare seg selv.
 *
 * Kjør med: bun run sjekk
 * Krever at `designsystem/dist` er bygd.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { elements } from "../metadata"
import { files, ROOT } from "./generate"

const findings: string[] = []

// 1. Filene på disk er ferske.
const generated = files()
for (const [path, expected] of Object.entries(generated)) {
  let actual: string | null = null
  try {
    actual = readFileSync(join(ROOT, path), "utf8")
  } catch {
    // Mangler: meldes under.
  }
  if (actual === null)
    findings.push(`${path} finnes ikke. Kjør bun run generate.`)
  else if (actual !== expected)
    findings.push(`${path} er utdatert. Kjør bun run generate.`)
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

// 3. Hver snippet viser elementet sitt. «Har markup» holdt ikke: dialogens
// snippet hadde en `<dialog>` og ikke noe `<fs-dialog>`.
const snippets = JSON.parse(generated["editor/snippets.json"]) as Record<
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
  `Sjekket ${counted} elementer i pakken mot ${documented.size} i metadata.ts, ${Object.keys(snippets).length} snippets og ${Object.keys(generated).length} filer`,
)
if (counted === 0) findings.push("Fant ingen elementer i pakken. Er dist bygd?")

if (findings.length) {
  console.error(findings.map((f) => `  - ${f}`).join("\n"))
  process.exit(1)
}

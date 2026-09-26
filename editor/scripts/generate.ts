/**
 * Skriver editorfilene fra `metadata.ts` og komponentsidene.
 *
 * Tre filer kommer ut, og ingen av dem skrives for hånd:
 *
 *   - `editor/fristil.html-data.json`: VS Codes eget format for tagger og
 *     attributter. HTML-språktjenesten bruker den til fullføring og hover.
 *   - `editor/snippets.json`: én snippet per element, med markupen som viser
 *     elementet på komponentsiden. Kodeblokkene der er alt etterprøvd av
 *     `sjekk-oppskrifter.ts`, så klassene og elementene i snippeten finnes.
 *   - `editor/elements.json`: det diagnostikken i utvidelsen trenger, tagg
 *     for tagg.
 *   - `editor/classes.json`: hver `fs-`-klasse i pakkens CSS, med komponenten
 *     den hører til, og for hver byggefunksjon i `fs` hvilket attributt en
 *     variant, størrelse, farge eller tilstand blir til. Det leses ved å
 *     kalle funksjonene, ikke ved å lese kildekoden, så det er det pakken
 *     faktisk gir. `html-data` skiller ikke et tall fra en tekst, og har ingen
 *     plass til det, så diagnostikken får sin egen fil fra samme kilde.
 *   - `designsystem/web-types.json`: JetBrains sitt format. Den følger
 *     npm-pakken, og WebStorm finner den selv fra `node_modules`.
 *
 * Kjør med: bun run generate
 * `scripts/sjekk.ts` kjører det samme i minnet og feiler hvis filene på disk
 * er utdaterte.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { fs } from "@fristil/designsystem"
import { type AttributeDoc, type ElementDoc, elements } from "../metadata"
import type { Attribute, Classes, Elements } from "../src/diagnostics"

export const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const DOCS = "https://fristil.netlify.app/components/"
const PAGES = join(ROOT, "documentation/src/content/docs/components")

const docsUrl = (element: ElementDoc) => `${DOCS}${element.slug}/`

/*
 * VS Code: https://github.com/microsoft/vscode-html-languageservice
 *          /blob/main/docs/customData.md
 *
 * `valueSet: "v"` er det innebygde settet for boolske attributter, det samme
 * `hidden` og `disabled` bruker. Editoren foreslår da attributtet uten `=""`.
 */
function htmlDataAttribute(name: string, doc: AttributeDoc) {
  const base = {
    name,
    description: { kind: "markdown", value: doc.description },
  }
  if (doc.value === "flag") return { ...base, valueSet: "v" }
  if (typeof doc.value === "object")
    return {
      ...base,
      values: doc.value.values.map((v) => ({
        name: v.name,
        description: { kind: "markdown", value: v.description },
      })),
    }
  return base
}

export function htmlData() {
  return {
    version: 1.1,
    tags: elements.map((element) => ({
      name: element.tag,
      description: { kind: "markdown", value: element.description },
      attributes: Object.entries(element.attributes).map(([name, doc]) =>
        htmlDataAttribute(name, doc),
      ),
      references: [{ name: "Dokumentasjon", url: docsUrl(element) }],
    })),
  }
}

/*
 * JetBrains: https://github.com/JetBrains/web-types
 *
 * Skjemaet er skrevet etter beskrivelsen der, og etterprøvd i IntelliJ IDEA
 * Ultimate 2026.2: fullføring av elementer, attributter og verdier, og
 * forklaring med lenke, uten annet oppsett enn at pakken står i
 * `package.json`.
 */
function webTypesAttribute(name: string, doc: AttributeDoc) {
  const base = { name, description: doc.description }
  if (doc.value === "flag") return { ...base, value: { kind: "no-value" } }
  if (typeof doc.value === "object")
    return {
      ...base,
      value: { kind: "plain", type: "enum" },
      values: doc.value.values.map((v) => ({
        name: v.name,
        description: v.description,
      })),
    }
  return { ...base, value: { kind: "plain", type: doc.value } }
}

export function webTypes(version: string) {
  return {
    $schema:
      "https://raw.githubusercontent.com/JetBrains/web-types/master/schema/web-types.json",
    name: "@fristil/designsystem",
    version,
    "description-markup": "markdown",
    contributions: {
      html: {
        elements: elements.map((element) => ({
          name: element.tag,
          description: element.description,
          "doc-url": docsUrl(element),
          attributes: Object.entries(element.attributes).map(([name, doc]) =>
            webTypesAttribute(name, doc),
          ),
        })),
      },
    },
  }
}

/**
 * Markupen som viser elementet, fra komponentsiden.
 *
 * Den første kodeblokken med HTML på siden som faktisk inneholder `<fs-…>`,
 * uten stilark og uten Datastar. Som regel er det «Ren HTML»-fanen. På
 * dialogsiden er det ikke: der åpner «Ren HTML»-oppskriften dialogen med
 * `showModal()` fra skript, uten web-komponenten, og en snippet for
 * `<fs-dialog>` uten `<fs-dialog>` i seg var det første reviewfunnet.
 *
 * Snippeten er markupen fram til det første skriptet: stilarkene og
 * registreringen hører i sidemalen, én gang for hele appen, ikke der
 * markøren står.
 */
export function recipe(element: ElementDoc): string {
  const page = readFileSync(join(PAGES, `${element.slug}.mdx`), "utf8")
  const blocks = [...page.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1])
  const markup = blocks.find(
    (b) =>
      b.includes(`<${element.tag}`) &&
      !b.includes('rel="stylesheet"') &&
      !b.includes("data-on"),
  )
  if (!markup)
    throw new Error(
      `${element.slug}.mdx har ingen HTML-blokk med <${element.tag}> i`,
    )

  // Kommentaren rett før skriptet kan gå over flere linjer, men aldri forbi
  // sin egen `-->`: ellers ville den slukt markupen mellom to kommentarer.
  const body = markup.split(
    /\n[ \t]*(?:<!--(?:(?!-->)[\s\S])*-->\n[ \t]*)?<script\b/,
  )[0]
  const lines = body.replace(/\s+$/, "").split("\n")
  const indent = Math.min(
    ...lines
      .filter((l) => l.trim())
      .map((l) => (l.match(/^[ \t]*/)?.[0] ?? "").length),
  )
  return lines.map((l) => l.slice(indent)).join("\n")
}

/*
 * Et snippet-body er et malspråk: `$1` er en tabbstopp og `\` er
 * rømningstegnet. Markupen skal komme ut ordrett, så begge rømmes.
 */
const escapeSnippet = (line: string) =>
  line.replace(/\\/g, "\\\\").replace(/\$/g, "\\$")

export function snippets() {
  const out: Record<
    string,
    { prefix: string; body: string[]; description: string }
  > = {}
  for (const element of elements) {
    out[element.tag] = {
      prefix: element.tag,
      body: recipe(element).split("\n").map(escapeSnippet),
      description: element.description,
    }
  }
  return out
}

/*
 * Diagnostikken: hva hvert attributt tar, i den formen `src/diagnostics.ts`
 * leser. Lenken er komponentsiden, som blir lenke i meldingen.
 */
export function diagnosticsData(): Elements {
  const out: Elements = {}
  for (const element of elements) {
    const attributes: Record<string, Attribute> = {}
    for (const [name, doc] of Object.entries(element.attributes)) {
      attributes[name] =
        typeof doc.value === "object"
          ? { type: "values", values: doc.value.values.map((v) => v.name) }
          : { type: doc.value }
    }
    out[element.tag] = { link: docsUrl(element), attributes }
  }
  return out
}

/*
 * Klassene. Lista kommer fra CSS-filene, én mappe per komponent, og navnet
 * på mappa er adressen til komponentsiden. Tittel og beskrivelse er sidens
 * egen frontmatter. Attributtene kommer fra byggefunksjonene i `fs`: hver
 * funksjon med `variants`, `sizes`, `colors`, `states`, `types` eller
 * `pickers` kalles én gang per verdi, og attributtet den skriver ut er det
 * som noteres, med verdien som ikke gir noe attributt som standard.
 */
const COMPONENT_DIRS = ["css", "ramme", "frittstaende"].map((d) =>
  join(ROOT, "designsystem/src/components", d),
)

const OPTION_LISTS: Record<string, string> = {
  variants: "variant",
  sizes: "size",
  colors: "color",
  states: "state",
  types: "type",
  pickers: "picker",
  // `fs.label({ required: "text" })`: lista heter markers, opsjonen required.
  markers: "required",
}

const frontmatter = (slug: string, key: string) => {
  const page = readFileSync(join(PAGES, `${slug}.mdx`), "utf8")
  return page.match(new RegExp(`^${key}: (.*)$`, "m"))?.[1]?.trim() ?? ""
}

function classesInCss(css: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "")
  return [...new Set(clean.match(/\.fs-[\w-]+/g) ?? [])].map((c) => c.slice(1))
}

/** Klassene i det en byggefunksjon gir, også når svaret er nøstet. */
function classesIn(value: unknown): string[] {
  if (!value || typeof value !== "object") return []
  const out: string[] = []
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (key === "class" && typeof v === "string") out.push(...v.split(/\s+/))
    else if (v && typeof v === "object") out.push(...classesIn(v))
  }
  return out
}

export function classesData(): Classes {
  const out: Classes = {}
  for (const dir of COMPONENT_DIRS) {
    for (const slug of readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      // Sortert: Linux leverer mappene i en annen rekkefølge enn macOS, og
      // fila skal være den samme uansett hvor den genereres.
      .sort()) {
      const files = readdirSync(join(dir, slug))
        .filter((f) => f.endsWith(".css"))
        .sort()
      const link = `${DOCS}${slug}/`
      const title = frontmatter(slug, "title")
      const description = frontmatter(slug, "description")
      for (const file of files) {
        for (const name of classesInCss(
          readFileSync(join(dir, slug, file), "utf8"),
        ))
          out[name] ??= {
            component: slug,
            title,
            description,
            link,
            attributes: {},
          }
      }
    }
  }

  for (const builder of Object.values(fs as Record<string, unknown>)) {
    if (typeof builder !== "function") continue
    const build = builder as (options?: Record<string, unknown>) => unknown
    let base: unknown
    try {
      // En id, så byggefunksjonene som ellers lager en tilfeldig ikke sier fra.
      // Dialogen kaller sin titleId, siden id-en sitter på overskriften.
      base = build({ id: "x", titleId: "x" })
    } catch {
      continue
    }
    const targets = [...new Set(classesIn(base))].filter((c) => out[c])
    if (!targets.length) continue
    for (const [list, option] of Object.entries(OPTION_LISTS)) {
      const values = (builder as unknown as Record<string, unknown>)[list]
      if (!Array.isArray(values)) continue
      // Hvert attributt en verdi blir til: `fs.input({ type: "date" })` gir både
      // `type` og `data-variant`. `type` er HTML sitt eget, og CSS-en leser det
      // ikke, så det noteres ikke: `type="color"` er lovlig HTML på et fs-input.
      const emitted = new Map<string, string[]>()
      const silent: string[] = []
      for (const value of values as string[]) {
        const result = build({
          id: "x",
          titleId: "x",
          [option]: value,
        }) as Record<string, unknown>
        const extra = Object.entries(result).filter(
          ([key, v]) =>
            typeof v === "string" &&
            key !== "class" &&
            key !== "type" &&
            (base as Record<string, unknown>)[key] !== v &&
            v === value,
        )
        if (!extra.length) {
          silent.push(value)
          continue
        }
        for (const [attribute] of extra) {
          emitted.set(attribute, [...(emitted.get(attribute) ?? []), value])
        }
      }
      for (const [attribute, list] of emitted)
        for (const target of targets)
          out[target].attributes[attribute] = {
            values: list,
            // Standardverdien er den ene verdien som ikke gir noe attributt,
            // som `primary` for `data-variant`. Gir flere ingenting, som de
            // fleste typene på et input, betyr fraværet ikke én av dem.
            ...(silent.length === 1 && emitted.size === 1
              ? { default: silent[0] }
              : {}),
          }
    }
  }
  return out
}

/** Hver fil generatoren skriver, med stien fra rota. */
export function files(): Record<string, string> {
  const version: string = JSON.parse(
    readFileSync(join(ROOT, "designsystem/package.json"), "utf8"),
  ).version
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
  return {
    "editor/fristil.html-data.json": json(htmlData()),
    "editor/snippets.json": json(snippets()),
    "editor/elements.json": json(diagnosticsData()),
    "editor/classes.json": json(classesData()),
    "designsystem/web-types.json": json(webTypes(version)),
  }
}

if (import.meta.main) {
  for (const [path, content] of Object.entries(files())) {
    writeFileSync(join(ROOT, path), content)
    console.log(`Skrev ${path}`)
  }
}

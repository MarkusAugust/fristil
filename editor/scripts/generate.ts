/**
 * Skriver editorfilene fra `metadata.ts` og komponentsidene.
 *
 * Tre filer kommer ut, og ingen av dem skrives for hånd:
 *
 *   - `editor/fristil.html-data.json`: VS Codes eget format for tagger og
 *     attributter. HTML-språktjenesten bruker den til fullføring og hover.
 *   - `editor/snippets.json`: én snippet per element, med markupen fra
 *     «Ren HTML»-fanen på komponentsiden. Den fanen er alt etterprøvd av
 *     `sjekk-oppskrifter.ts`, så snippeten kan ikke vise noe som ikke virker.
 *   - `designsystem/web-types.json`: JetBrains sitt format. Den følger
 *     npm-pakken, og WebStorm finner den selv fra `node_modules`.
 *
 * Kjør med: bun run generate
 * `scripts/sjekk.ts` kjører det samme i minnet og feiler hvis filene på disk
 * er utdaterte.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { type AttributeDoc, type ElementDoc, elements } from "../metadata"

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
 * Skjemaet er skrevet etter beskrivelsen der, og er ikke etterprøvd i en
 * JetBrains-IDE ennå. Se README.
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
 * Markupen fra «Ren HTML»-fanen på komponentsiden.
 *
 * Fanen har to kodeblokker med HTML: først `<link>`-ene til stilarkene, så
 * markupen med registreringen og et eksempelskript under. Snippeten er bare
 * markupen, fram til det første skriptet: stilarkene og registreringen
 * hører i sidemalen, én gang for hele appen, ikke der markøren står.
 */
export function recipe(element: ElementDoc): string {
  const page = readFileSync(join(PAGES, `${element.slug}.mdx`), "utf8")
  const start = page.indexOf('label="Ren HTML"')
  if (start === -1)
    throw new Error(`${element.slug}.mdx har ingen «Ren HTML»-fane`)
  const tab = page.slice(start, page.indexOf("</TabItem>", start))
  const blocks = [...tab.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1])
  const markup = blocks.find((b) => !b.includes('rel="stylesheet"'))
  if (!markup)
    throw new Error(`${element.slug}.mdx har ingen markup i «Ren HTML»-fanen`)

  const body = markup.split(/\n[ \t]*(?:<!--[^\n]*-->\n[ \t]*)?<script\b/)[0]
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

/** Hver fil generatoren skriver, med stien fra rota. */
export function files(): Record<string, string> {
  const version: string = JSON.parse(
    readFileSync(join(ROOT, "designsystem/package.json"), "utf8"),
  ).version
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
  return {
    "editor/fristil.html-data.json": json(htmlData()),
    "editor/snippets.json": json(snippets()),
    "designsystem/web-types.json": json(webTypes(version)),
  }
}

if (import.meta.main) {
  for (const [path, content] of Object.entries(files())) {
    writeFileSync(join(ROOT, path), content)
    console.log(`Skrev ${path}`)
  }
}

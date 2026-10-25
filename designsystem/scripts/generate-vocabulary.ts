/**
 * Skriver ordforrådet og editorfilene fra `metadata.ts` og komponentsidene.
 *
 * Filene kommer ut i pakken, og ingen av dem skrives for hånd. Editorene
 * leser dem: VS Code-utvidelsen kopierer de to første når den bygges, og
 * IntelliJ-pluginen leser klassene fra prosjektets manifest, med manifestet
 * i Kotlin-pakken som reserve.
 *
 *   - `html-data.json`: VS Codes eget format for tagger og
 *     attributter. HTML-språktjenesten bruker den til fullføring og hover.
 *   - `snippets.json`: én snippet per element, med markupen som viser
 *     elementet på komponentsiden. Kodeblokkene der er alt etterprøvd av
 *     `check-recipes.ts`, så klassene og elementene i snippeten finnes.
 *   - `designsystem/src/vocabulary/elements.ts`: elementene og attributtene,
 *     tagg for tagg, som manifestet skrives fra.
 *   - `designsystem/src/vocabulary/classes.ts`: hver `lt-`-klasse i pakkens CSS, med komponenten
 *     den hører til, og for hver byggefunksjon i `lt` hvilket attributt en
 *     variant, størrelse, farge eller tilstand blir til. Det leses ved å
 *     kalle funksjonene, ikke ved å lese kildekoden, så det er det pakken
 *     faktisk gir. `html-data` skiller ikke et tall fra en tekst, og har ingen
 *     plass til det, så diagnostikken får sin egen fil fra samme kilde.
 *   - `designsystem/web-types.json`: JetBrains sitt format. Den følger
 *     npm-pakken, og WebStorm finner den selv fra `node_modules`.
 *
 * Kjør med: bun --filter @lo-tek/interfaces vocabulary
 * `check-vocabulary.ts` kjører det samme i minnet og feiler hvis filene på
 * disk er utdaterte.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { lt } from "../src/index.js"
import type {
  Attribute,
  Classes,
  ClassInfo,
  Elements,
} from "../src/vocabulary/types.js"
import { flaggFor, lesByggefunksjoner } from "./builder-functions.js"
import {
  type AttributeDoc,
  type ClassDoc,
  classDocs,
  type ElementDoc,
  elements,
} from "./metadata"

export const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const DOCS = "https://lo-tek.sobernetics.no/components/"
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
    name: "@lo-tek/interfaces",
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
          // Hendelsene, så `addEventListener("dialog-toggle", …)` og
          // `@dialog-toggle` i et rammeverk får fullføring.
          ...(Object.keys(element.events).length
            ? {
                js: {
                  events: Object.entries(element.events).map(([name, doc]) => ({
                    name,
                    description: doc.detail
                      ? `${doc.description}\n\n\`detail\`: \`{ ${Object.entries(
                          doc.detail,
                        )
                          .map(([k, t]) => `${k}: ${t}`)
                          .join(", ")} }\``
                      : doc.description,
                  })),
                },
              }
            : {}),
        })),
      },
      /*
       * Klassene, slik at `class="lt-…"` får fullføring i JetBrains-IDE-ene.
       *
       * Før sto bare de ni elementene her, så en utvikler fikk forslag på
       * `<lt-field>` men ingenting på `lt-button`, enda klassene er den
       * største delen av systemet og den eneste delen en CSS-komponent har.
       *
       * Lista er den samme `classesData()` som skriver `classes.ts`, altså
       * den diagnostikken feller på. Da kan ikke editoren foreslå en klasse
       * sjekken avviser, eller avvise en den foreslår.
       */
      css: {
        classes: Object.entries(classesData()).map(([name, info]) => ({
          name,
          description: `**${info.title}**\n\n${info.description}`,
          "doc-url": info.link,
        })),
      },
    },
  }
}

/**
 * Markupen som viser elementet, fra komponentsiden.
 *
 * Den første kodeblokken med HTML på siden som faktisk inneholder `<lt-…>`,
 * uten stilark og uten Datastar. Som regel er det «Ren HTML»-fanen. På
 * dialogsiden er det ikke: der åpner «Ren HTML»-oppskriften dialogen med
 * `showModal()` fra skript, uten web-komponenten, og en snippet for
 * `<lt-dialog>` uten `<lt-dialog>` i seg var det første reviewfunnet.
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

const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Id-ene i en oppskrift, i rekkefølge, og alt som peker på hver av dem.
 *
 * Id-en er det malen skriver selv etter v6: `for` på ledeteksten og `id` på
 * feltet, `href` på fanen og `id` på panelet. I en snippet blir hver id et
 * tabbestopp, og pekerne speil av det, så den skrives én gang.
 */
function idsIn(body: string): string[] {
  return [...new Set([...body.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))]
}

/**
 * Pekerne på en id: `for`, `aria-labelledby`, `aria-controls` og `href="#…"`.
 * `write(name, value)` skriver attributtet på nytt der verdien er id-en.
 */
function mirror(
  body: string,
  id: string,
  write: (attribute: string, prefix: string) => string,
): string {
  const esc = escapeRegex(id)
  return body
    .replace(
      new RegExp(`\\b(for|aria-labelledby|aria-controls)="${esc}"`, "g"),
      (_, attribute: string) => write(attribute, ""),
    )
    .replace(new RegExp(`\\bhref="#${esc}"`, "g"), () => write("href", "#"))
}

/** Snippeten med tabbestopp: `${1:navn}` der id-en står, `$1` der den pekes på. */
function withTabstops(body: string): string {
  let out = body
  idsIn(body).forEach((id, i) => {
    const n = i + 1
    out = out.replace(
      new RegExp(`\\bid="${escapeRegex(id)}"`, "g"),
      () => `id="\${${n}:${id}}"`,
    )
    out = mirror(
      out,
      id,
      (attribute, prefix) => `${attribute}="${prefix}$${n}"`,
    )
  })
  return out
}

export function snippets() {
  const out: Record<
    string,
    { prefix: string; body: string[]; description: string }
  > = {}
  for (const element of elements) {
    // Tabbestoppene settes inn etter rømmingen, ellers rømmes de også.
    const body = recipe(element).split("\n").map(escapeSnippet).join("\n")
    out[element.tag] = {
      prefix: element.tag,
      body: withTabstops(body).split("\n"),
      description: element.description,
    }
  }
  return out
}

/**
 * Live templates for IntelliJ, fra de samme oppskriftene som snippetene.
 *
 * Formatet er IntelliJs eget: `$navn$` er en variabel, `$$` et dollartegn,
 * og variabelnavnet må være en identifikator, så `okt-tittel` blir
 * `okt_tittel`. Pluginen kopierer fila inn som `liveTemplates/Lotek.xml`.
 */
export function liveTemplates(): string {
  const xml = (text: string) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "&#10;")
  const templates = elements.map((element) => {
    let body = recipe(element).replace(/\$/g, "$$$$")
    const variables = idsIn(body).map((id) => {
      const name = id.replace(/[^A-Za-z0-9_]/g, "_")
      body = body.replace(
        new RegExp(`\\bid="${escapeRegex(id)}"`, "g"),
        () => `id="$${name}$"`,
      )
      body = mirror(
        body,
        id,
        (attribute, prefix) => `${attribute}="${prefix}$${name}$"`,
      )
      return `    <variable name="${name}" expression="" defaultValue="${xml(JSON.stringify(id))}" alwaysStopAt="true" />`
    })
    return [
      `  <template name="${element.tag}" value="${xml(body)}" description="${xml(element.description)}" toReformat="false" toShortenFQNames="false">`,
      ...variables,
      "    <context>",
      '      <option name="HTML" value="true" />',
      "    </context>",
      "  </template>",
    ].join("\n")
  })
  return `<!-- Generert av designsystem/scripts/generate-vocabulary.ts. Ikke rediger. -->\n<templateSet group="LO-TEK">\n${templates.join("\n")}\n</templateSet>\n`
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
      attributes[name] = {
        ...(typeof doc.value === "object"
          ? { type: "values", values: doc.value.values.map((v) => v.name) }
          : { type: doc.value }),
        description: doc.description,
      }
    }
    out[element.tag] = {
      link: docsUrl(element),
      description: element.description,
      attributes,
      parts: element.parts,
      ...(element.removed ? { removed: element.removed } : {}),
      ...(Object.keys(element.events).length
        ? {
            events: Object.fromEntries(
              Object.entries(element.events).map(([name, doc]) => [
                name,
                doc.detail ? { detail: doc.detail } : {},
              ]),
            ),
          }
        : {}),
    }
  }
  return out
}

/*
 * Klassene. Lista kommer fra CSS-filene, én mappe per komponent, og navnet
 * på mappa er adressen til komponentsiden. Tittel og beskrivelse er sidens
 * egen frontmatter. Attributtene kommer fra byggefunksjonene i `lt`: hver
 * funksjon med `variants`, `sizes`, `colors`, `states`, `types` eller
 * `pickers` kalles én gang per verdi, og attributtet den skriver ut er det
 * som noteres, med verdien som ikke gir noe attributt som standard.
 */
const COMPONENT_DIRS = ["css", "frame", "standalone"].map((d) =>
  join(ROOT, "designsystem/src/components", d),
)

/*
 * `tokens.css` har klasser som ikke hører til en komponent.
 *
 * `.lt-theme-control` er den første: den bytter tema, så selektoren bor der
 * tokenverdiene bor framfor i en komponentmappe. Uten denne kilden meldte
 * `diagnoseMarkup` «Klassen finnes ikke i LO-TEK» på riktig markup, og
 * verken VS Code, IntelliJ eller `lotek sjekk` foreslo den.
 */
const TOKEN_CSS = join(ROOT, "designsystem/src/tokens/tokens.css")

const OPTION_LISTS: Record<string, string> = {
  variants: "variant",
  sizes: "size",
  colors: "color",
  states: "state",
  types: "type",
  pickers: "picker",
  // `lt.label({ required: "text" })`: lista heter markers, opsjonen required.
  markers: "required",
}

const frontmatter = (slug: string, key: string) => {
  const page = readFileSync(join(PAGES, `${slug}.mdx`), "utf8")
  return page.match(new RegExp(`^${key}: (.*)$`, "m"))?.[1]?.trim() ?? ""
}

const TOKEN_PAGE = {
  component: "tilpasning",
  // Leses fra siden, som for komponentene. Skrevet av for hånd drev den fra
  // frontmatteren uten at noe sa fra, og hoverboksen i VS Code og JetBrains
  // siterte en beskrivelse som ikke sto noe sted i dokumentasjonen.
  title: frontmatter("../customising", "title"),
  description: frontmatter("../customising", "description"),
  link: "https://lo-tek.sobernetics.no/customising/",
}

function classesInCss(css: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "")
  return [...new Set(clean.match(/\.lt-[\w-]+/g) ?? [])].map((c) => c.slice(1))
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
  /*
   * Klassene fra CSS-en, før innholdet og delene fra `classDocs` legges på.
   * De to settes sammen til slutt, så en klasse som mangler i tabellen kan
   * meldes med navn framfor å få et innhold ingen har skrevet.
   */
  const found: Record<string, Omit<ClassInfo, keyof ClassDoc>> = {}
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
          found[name] ??= {
            component: slug,
            title,
            description,
            link,
            attributes: {},
          }
      }
    }
  }

  for (const name of classesInCss(readFileSync(TOKEN_CSS, "utf8")))
    found[name] ??= { ...TOKEN_PAGE, attributes: {} }

  for (const builder of Object.values(lt as Record<string, unknown>)) {
    if (typeof builder !== "function") continue
    const build = builder as (options?: Record<string, unknown>) => unknown
    let base: unknown
    try {
      // En id, så byggefunksjonene som ellers lager en tilfeldig ikke sier fra.
      // Dialogen kaller sin titleId, siden id-en sitter på overskriften. Og
      // et navn, som fanene krever på raden.
      base = build({ id: "x", titleId: "x", keys: [], label: "x" })
    } catch {
      continue
    }
    /*
     * Settene svaret består av. En byggefunksjon som `button` gir ett, og
     * `dialog` gir ett per del, `host`, `dialog`, `header` og så videre.
     * Hvert sett sjekkes for seg, så `data-color` havner på `lt-dialog`, som
     * står i det samme settet, og ikke på overskriften.
     */
    const parts = (result: unknown): [string, Record<string, unknown>][] => {
      if (typeof result !== "object" || result === null) return []
      const entries = Object.entries(result as Record<string, unknown>)
      return entries.some(([, v]) => typeof v === "object" && v !== null)
        ? (entries.filter(
            ([, v]) => typeof v === "object" && v !== null && !Array.isArray(v),
          ) as [string, Record<string, unknown>][])
        : [["", result as Record<string, unknown>]]
    }
    const baseParts = new Map(parts(base))
    for (const [part, basePart] of baseParts) {
      const targets = [...new Set(classesIn(basePart))].filter((c) => found[c])
      if (!targets.length) continue
      for (const [list, option] of Object.entries(OPTION_LISTS)) {
        const values = (builder as unknown as Record<string, unknown>)[list]
        if (!Array.isArray(values)) continue
        // Hvert attributt en verdi blir til: `lt.input({ type: "date" })` gir både
        // `type` og `data-variant`. `type` er HTML sitt eget, og CSS-en leser det
        // ikke, så det noteres ikke: `type="color"` er lovlig HTML på et lt-input.
        const emitted = new Map<string, string[]>()
        const silent: string[] = []
        for (const value of values as string[]) {
          const result =
            new Map(
              parts(
                build({ id: "x", titleId: "x", keys: [], [option]: value }),
              ),
            ).get(part) ?? {}
          const extra = Object.entries(result).filter(
            ([key, v]) =>
              typeof v === "string" &&
              key !== "class" &&
              key !== "type" &&
              basePart[key] !== v &&
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
            found[target].attributes[attribute] = {
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
  }

  /*
   * Flaggene, som `data-interactive` på `lt-card` og `data-optional` på
   * `lt-label`: et `data-*`-attributt som kommer når et boolsk valg slås på.
   * Uten dem manglet de i editoren og i regelbøkene, mens `lotek sjekk`
   * kjente dem.
   *
   * De leses av byggefunksjonen selv, med valgene TypeScript ser i
   * `src/lt.ts`, ikke fra `manifest.json` på disk. Lest derfra lå de en runde
   * bak: `generate` skriver denne fila før manifestet, så et nytt flagg kom
   * inn i manifestet ved første bygg, men hit først ved det neste, og
   * `check:vocabulary` felte bygget i mellomtiden.
   */
  const flags = new Map<string, Set<string>>()
  for (const builder of lesByggefunksjoner()) {
    const build = (lt as Record<string, unknown>)[builder.name]
    if (typeof build !== "function") continue
    // Kaster byggefunksjonen, skal generate stoppe. Et flagg som stille
    // forsvant fra classes.ts, forsvant fra editorene og diagnostikken med.
    const flagged = flaggFor(
      builder,
      build as (options: Record<string, unknown>) => unknown,
      { id: "x", titleId: "x", keys: [], label: "x" },
      (name) => name in found,
    )
    for (const [name, attributes] of flagged)
      for (const attribute of attributes)
        flags.set(name, (flags.get(name) ?? new Set()).add(attribute))
  }
  for (const [name, attributes] of flags)
    for (const attribute of [...attributes].sort())
      found[name].attributes[attribute] ??= { values: [], flag: true }

  /*
   * Innholdet og delene, fra tabellen i `metadata.ts`. Hver klasse i CSS-en
   * skal stå der, og ingen andre: en ny klasse uten en rad stopper
   * generatoren med navnet, og en rad for en klasse som er borte fra CSS-en
   * stopper den også, ellers ble den stående og love noe som ikke finnes.
   */
  const missing = Object.keys(found).filter((name) => !(name in classDocs))
  const stale = Object.keys(classDocs).filter((name) => !(name in found))
  if (missing.length || stale.length)
    throw new Error(
      [
        missing.length &&
          `classDocs i metadata.ts mangler ${missing.join(", ")}.`,
        stale.length &&
          `classDocs i metadata.ts har klasser som ikke finnes i CSS-en: ${stale.join(", ")}.`,
      ]
        .filter(Boolean)
        .join(" "),
    )
  const out: Classes = {}
  for (const [name, info] of Object.entries(found)) {
    const { content, partOf, parts } = classDocs[name]
    out[name] = {
      component: info.component,
      title: info.title,
      description: info.description,
      link: info.link,
      content,
      ...(partOf ? { partOf } : {}),
      ...(parts ? { parts } : {}),
      attributes: info.attributes,
    }
  }
  return out
}

export function files(): Record<string, string> {
  const version: string = JSON.parse(
    readFileSync(join(ROOT, "designsystem/package.json"), "utf8"),
  ).version
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
  /*
   * Ordforrådet skrives som TypeScript-moduler inn i pakken, ikke som JSON: Node krever `with { type: "json" }` for å importere JSON i
   * ESM, og `tsc` skriver ikke attributtet. Biome hopper over filene, siden
   * `JSON.stringify` ikke setter avsluttende komma.
   */
  const module = (name: string, type: string, value: unknown) =>
    `// Generert av designsystem/scripts/generate-vocabulary.ts. Ikke rediger.\n` +
    `import type { ${type} } from "./types.js"\n\n` +
    `export const ${name}: ${type} = ${JSON.stringify(value, null, 2)}\n`
  return {
    "designsystem/html-data.json": json(htmlData()),
    "designsystem/snippets.json": json(snippets()),
    "designsystem/src/vocabulary/elements.ts": module(
      "elements",
      "Elements",
      diagnosticsData(),
    ),
    "designsystem/src/vocabulary/classes.ts": module(
      "classes",
      "Classes",
      classesData(),
    ),
    "designsystem/web-types.json": json(webTypes(version)),
    "designsystem/live-templates.xml": liveTemplates(),
    "designsystem/src/components/events.ts": eventTypes(),
  }
}

/**
 * Typene til hendelsene web-komponentene sender, for `addEventListener`.
 *
 * `LtEventMap` har hver hendelse som `CustomEvent` med `detail` slik
 * metadataen beskriver den, og `HTMLElementEventMap` utvides med den. Det er
 * DOM-typen TypeScript selv har, så det samme gjelder i ren TypeScript, i et
 * skript i Astro eller Datastar, og i React gjennom en `ref`. Ingenting her
 * importerer React.
 *
 * Sender to elementer en hendelse med samme navn, må `detail` være den
 * samme, ellers kunne bare én av dem få en type. Da stopper generatoren.
 *
 * Fila utvider også `HTMLElementTagNameMap`, så `querySelector("lt-dialog")`
 * gir `LtDialog` og ikke `Element`. Kartet sto i hver `lt-*.ts`, men en
 * inngang som `/register` importerer dem bare i koden, og i `.d.ts`-fila
 * forsvinner importen. Da var `querySelector("lt-dialog")` et `Element`, og
 * `addEventListener` på det ga `Event` uten `detail`, mens siden lovet det
 * motsatte. Hver inngang til web-komponentene tar med denne fila, gjennom
 * `host-element.ts` eller en egen re-eksport, så kartet følger med dem alle.
 */
function eventTypes(): string {
  const seen = new Map<string, { type: string; tag: string }>()
  const lines: string[] = []
  const hosts = hostClasses()
  for (const element of elements) {
    for (const [name, doc] of Object.entries(element.events)) {
      const fields = Object.entries(doc.detail ?? {})
      const type =
        fields.length === 0
          ? "CustomEvent<null>"
          : `CustomEvent<{ ${fields.map(([field, kind]) => `${field}: ${kind}`).join("; ")} }>`
      const earlier = seen.get(name)
      if (earlier && earlier.type !== type)
        throw new Error(
          `${name} har ulik detail på <${earlier.tag}> og <${element.tag}>: ${earlier.type} og ${type}`,
        )
      if (earlier) continue
      seen.set(name, { type, tag: element.tag })
      lines.push(
        `  /** \`<${element.tag}>\`: ${doc.description.replaceAll("*/", "* /")} */`,
        `  "${name}": ${type}`,
      )
    }
  }
  const imports = elements
    .map((element) => {
      const host = hosts.get(element.tag)
      if (!host)
        throw new Error(
          `Fant ingen klasse for <${element.tag}> under src/components`,
        )
      return host
    })
    .sort((a, b) => a.module.localeCompare(b.module))
  const tags = elements
    .map((element) => `    "${element.tag}": ${hosts.get(element.tag)?.name}`)
    .sort()
  return `// Generert av designsystem/scripts/generate-vocabulary.ts fra metadata.ts. Ikke rediger.

${imports.map((host) => `import type { ${host.name} } from "./${host.module}.js"`).join("\n")}

/**
 * Hendelsene web-komponentene sender, med \`detail\` slik komponenten sender
 * den. Alle bobler, og kommer ut av en skyggerot. \`HTMLElementEventMap\` og
 * \`DocumentEventMap\` utvides med dem, så \`addEventListener("dialog-toggle",
 * …)\` gir \`event.detail.open\` som \`boolean\` på ethvert element og på
 * \`document\`.
 *
 * \`HTMLElementTagNameMap\` utvides med elementene, så
 * \`querySelector("lt-dialog")\` gir \`LtDialog | null\`. Kartet står her, og
 * ikke i hver komponent, fordi hver inngang til web-komponentene tar med
 * denne fila: fra \`/register\` alene var \`querySelector("lt-dialog")\` ellers
 * et \`Element\`, og lytteren på det fikk \`Event\` uten \`detail\`.
 */
export interface LtEventMap {
${lines.join("\n")}
}

declare global {
  interface HTMLElementEventMap extends LtEventMap {}
  interface DocumentEventMap extends LtEventMap {}
  interface HTMLElementTagNameMap {
${tags.join("\n")}
  }
}
`
}

/**
 * Klassen bak hvert element, lest fra kilden.
 *
 * Fila heter det samme som taggen, som `frame/dialog/lt-dialog.ts` for
 * `<lt-dialog>`, og klassen står som `export class LtDialog`. Navnet leses
 * derfra, ikke fra en liste her, så et element som bytter mappe eller navn
 * stopper generatoren i stedet for å gi et kart som peker feil.
 */
function hostClasses(): Map<string, { name: string; module: string }> {
  const components = join(ROOT, "designsystem/src/components")
  const hosts = new Map<string, { name: string; module: string }>()
  for (const element of elements) {
    const file = [...new Bun.Glob(`**/${element.tag}.ts`).scanSync(components)]
    if (file.length !== 1)
      throw new Error(
        `Ventet én fil ${element.tag}.ts under src/components, fant ${file.length}`,
      )
    const module = (file[0] as string).replace(/\.ts$/, "")
    const source = readFileSync(join(components, file[0] as string), "utf8")
    const name = /^export class (Lt\w+) extends /m.exec(source)?.[1]
    if (!name)
      throw new Error(`Fant ingen «export class Lt… extends» i ${file[0]}`)
    hosts.set(element.tag, { name, module })
  }
  return hosts
}

if (import.meta.main) {
  for (const [path, content] of Object.entries(files())) {
    writeFileSync(join(ROOT, path), content)
    console.log(`Skrev ${path}`)
  }
}

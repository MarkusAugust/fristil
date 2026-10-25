/**
 * The parts of the rulebooks that are read from the code, not written by hand.
 *
 * The component list, the attribute values, the token names and the builder
 * functions are data. Copied by hand they would drift from the code in
 * silence, and an agent instruction that mentions a variant that does not
 * exist is worse than no instruction: it looks authoritative, and the agent
 * writes it into the consumer's app.
 *
 * The sources are the same ones the editor files use: `classes.ts` and
 * `elements.ts` are generated from the components, and `lt` is read by calling
 * the builder functions, not by reading the source code. The token names are
 * read out of `tokens.css`, which is itself generated from `tokens.ts`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { lt } from "../src/index.js"
import { classes } from "../src/vocabulary/classes.js"
import { elements } from "../src/vocabulary/elements.js"
import { FAMILIES, ROLES, roleToCss } from "./color-contract.js"
import { byggSamletCss, samletStørrelse } from "./css-bundle.js"

export const PAKKE = fileURLToPath(new URL("../", import.meta.url))

/** The role names as they appear in CSS, in the order the contract gives them. */
const ROLE_NAMES = Object.keys(ROLES).map((rolle) => roleToCss(rolle))

type Pakke = {
  version: string
  exports: Record<string, string | { import?: string }>
}

export const pakke = JSON.parse(
  readFileSync(join(PAKKE, "package.json"), "utf8"),
) as Pakke

export const VERSJON = pakke.version
export const CDN = `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@${VERSJON}`

/**
 * The size of `lotek.css`, as the rulebooks state it.
 *
 * The number was hard-coded as "about 75 kB, under 10 kB compressed" on three
 * lines in `generate-agent.ts` while the file was 90 kB and 11 kB compressed.
 * The file is therefore built in memory here, by `css-bundle.ts`, which reads
 * the same `exports` entries the CSS build writes it from. It cannot be read
 * from `dist/lotek.css`, since `generate` runs before the CSS build in the
 * package build.
 */
const SAMLET = samletStørrelse(byggSamletCss().css)

/** "N kB, M kB compressed", as html, templates and datastar state it, worked out when they are written. */
export const SAMLET_STØRRELSE = `${SAMLET.kb} kB, ${SAMLET.gzipKb} kB compressed`

/** The folder each component is in, which decides who creates the markup. */
function kategorier(): Map<string, string> {
  const kart = new Map<string, string>()

  for (const kategori of ["css", "frame", "standalone"]) {
    const mappe = join(PAKKE, "src/components", kategori)
    for (const navn of readdirSync(mappe)) {
      if (statSync(join(mappe, navn)).isDirectory()) kart.set(navn, kategori)
    }
  }

  return kart
}

export const KATEGORI = kategorier()

/** The stylesheet a component has in `exports`, or null when it has none. */
export function stilark(komponent: string): string | null {
  return `./${komponent}.css` in pakke.exports ? `${komponent}.css` : null
}

/** The module `defineLt*` is in, as `exports` points to it. */
export function modul(komponent: string): string {
  const oppføring = pakke.exports[`./${komponent}`]
  if (!oppføring || typeof oppføring === "string") {
    throw new Error(`${komponent} has no JS entry in exports`)
  }
  const sti = oppføring.import
  if (!sti) throw new Error(`${komponent} is missing "import" in exports`)
  return sti.replace(/^\.\//, "")
}

/**
 * The full CDN URL of something `exports` points to.
 *
 * The examples wrote the path by hand. When `lt-field.ts` moves, the table
 * updates itself while the copyable examples are left pointing at a 404, and
 * that is exactly the part the consumer pastes in.
 */
export function cdnTil(inngang: string): string {
  const oppføring = pakke.exports[`./${inngang}`]
  const sti =
    typeof oppføring === "string" ? oppføring : (oppføring?.import ?? "")

  if (!sti) throw new Error(`${inngang} does not exist in exports`)

  return `${CDN}/${sti.replace(/^\.\//, "")}`
}

const stor = (del: string) => del[0].toUpperCase() + del.slice(1)

/** `defineLtSessionTimeout` from `session-timeout`, as the naming convention says. */
export function registrering(komponent: string): string {
  return `defineLt${komponent.split("-").map(stor).join("")}`
}

type Klasse = {
  klasser: string[]
  attributter: string[]
}

/** The components that are only CSS, with their classes and attributes. */
function cssKomponenter(): Map<string, Klasse> {
  const kart = new Map<string, Klasse>()

  for (const [klasse, info] of Object.entries(classes)) {
    if (KATEGORI.get(info.component) !== "css") continue

    const rad = kart.get(info.component) ?? { klasser: [], attributter: [] }
    rad.klasser.push(klasse)

    for (const [navn, a] of Object.entries(info.attributes ?? {})) {
      rad.attributter.push(attributt(navn, a))
    }

    kart.set(info.component, rad)
  }

  return kart
}

/**
 * The table of CSS components, sorted by component name.
 *
 * `stilark` is the address the reader should write, and it is not the same
 * everywhere: without a build step it is a full URL, with one it is the
 * package name. For a long time the column held only the file name, and the
 * reader had to guess the path. An agent that generalised from the button
 * example wrote `src/components/css/field/field.css` for `<lt-field>`, which
 * is under `frame/`, and got a 404.
 */
export function cssTabell(stilark: (komponent: string) => string): string {
  const rader = [...cssKomponenter()].sort(([a], [b]) => a.localeCompare(b))

  return [
    "| Class | Stylesheet | Attributes |",
    "| --- | --- | --- |",
    ...rader.map(([navn, rad]) => {
      const klasser = rad.klasser.map((klasse) => `\`${klasse}\``).join("<br>")
      const attributter = rad.attributter.join("<br>") || "none"
      return `| ${klasser} | \`${stilark(navn)}\` | ${attributter} |`
    }),
  ].join("\n")
}

/**
 * A class attribute as the tables write it: the values, or `(flag)` for an
 * attribute that works by being present, as the element table writes it.
 */
function attributt(
  navn: string,
  a: { values?: readonly string[]; flag?: true },
): string {
  const verdier = a.values ?? []
  if (a.flag) return `\`${navn}\` (flag)`
  return verdier.length > 0
    ? `\`${navn}\`: ${verdier.join(", ")}`
    : `\`${navn}\``
}

/**
 * The classes that belong to an element, such as `lt-tabs__list` under
 * `<lt-tabs>`, with their attributes. `data-color` on `.lt-dialog` used to be
 * nowhere in the rulebooks, since the dialog is not a CSS component.
 */
function klasserUnder(komponent: string): string {
  const treff = Object.entries(classes)
    .filter(([, info]) => info.component === komponent)
    .map(([klasse, info]) => {
      const attributter = Object.entries(info.attributes ?? {}).map(
        ([navn, a]) => attributt(navn, a),
      )
      return attributter.length > 0
        ? `\`${klasse}\` (${attributter.join("; ")})`
        : `\`${klasse}\``
    })

  return treff.join("<br>") || "none"
}

/**
 * The table of web components.
 *
 * `adresse` is the path the consumer writes in the import, and it is not the
 * same everywhere: a browser without a bundler does not resolve the package
 * name, so there it has to be a URL. That is why each framework decides its own.
 */
export function webTabell(
  adresse: (komponent: string, modul: string) => string,
  stilark: (komponent: string) => string,
): string {
  const rader = Object.keys(elements).map((tagg) => {
    const komponent = tagg.replace(/^lt-/, "")

    const attributter =
      Object.entries(elements[tagg].attributes ?? {})
        .map(([navn, attributt]) =>
          attributt.type === "values"
            ? `\`${navn}\`: ${attributt.values.join(", ")}`
            : `\`${navn}\` (${attributt.type})`,
        )
        .join("<br>") || "none"

    const kall = `\`${registrering(komponent)}()\``
    const fra = `\`${adresse(komponent, modul(komponent))}\``

    // The events, with the fields in `detail`. An agent that needed to listen
    // to the dialog used to have to read the component code to find the name.
    const hendelser =
      Object.entries(elements[tagg].events ?? {})
        .map(([navn, hendelse]) =>
          hendelse.detail
            ? `\`${navn}\` (${Object.keys(hendelse.detail).join(", ")})`
            : `\`${navn}\``,
        )
        .join("<br>") || "none"

    return `| \`<${tagg}>\` | ${KATEGORI.get(komponent)} | \`${stilark(komponent)}\` | ${kall} from ${fra} | ${attributter} | ${hendelser} | ${klasserUnder(komponent)} |`
  })

  return [
    "| Element | Category | Stylesheet | Registration | Attributes | Events | Classes inside |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rader,
  ].join("\n")
}

/** The token names, read out of the generated stylesheet. */
function tokennavn(mønster: RegExp): string[] {
  const css = readFileSync(join(PAKKE, "src/tokens/tokens.css"), "utf8")
  return [...new Set(css.match(mønster) ?? [])].sort()
}

/**
 * The colour matrix, as two axes rather than 93 names.
 *
 * The axes are written out in full, and the name is
 * `--lt-color-<family>-<role>`, so every cell can be derived without guessing.
 * A list that ends with "and so on" is an invitation to invent the rest, and
 * invented names are exactly what this rulebook exists to prevent. Two axes
 * are not such a list: they are complete, and the cells follow from them.
 *
 * The axes are read from `FAMILIES` and `ROLES`, not out of the names in
 * `tokens.css`. Deriving them from the names went wrong:
 * `--lt-color-disabled-text` gave `disabled` as a tenth family, and it has
 * only two of the nine roles. Everything in the generated stylesheet that is
 * not a cell is listed separately.
 */
export function tokenListe(): string {
  const celler = new Set(
    FAMILIES.flatMap((familie) =>
      ROLE_NAMES.map((rolle) => `--lt-color-${familie}-${rolle}`),
    ),
  )

  const utenfor = tokennavn(/--lt-(?:color|shadow|focus|icon)-[a-z0-9-]+/g)
    .filter((navn) => !celler.has(navn))
    .sort()

  const liste = (navn: readonly string[]) =>
    navn.map((n) => `\`${n}\``).join(", ")

  return [
    `Families: ${liste(FAMILIES)}.`,
    "",
    `Roles: ${liste(ROLE_NAMES)}.`,
    "",
    `Outside the matrix: ${liste(utenfor)}.`,
  ].join("\n")
}

/** Spacing, font and line height, as one sentence rather than a list. */
export function malOgSkrift(): string {
  const liste = (navn: string[]) =>
    navn.map((token) => `\`${token}\``).join(", ")

  return [
    `Spacing: ${liste(tokennavn(/--lt-spacing-[a-z0-9-]+/g))}.`,
    "",
    `Font: ${liste(tokennavn(/--lt-font-[a-z0-9-]+/g))}.`,
    "",
    `Line height: ${liste(tokennavn(/--lt-line-height-[a-z0-9-]+/g))}.`,
  ].join("\n")
}

/*
 * The keys in `lt` that do not build attributes. They belong to the type
 * safety, and would otherwise be in the list as builder functions that do not
 * exist.
 */
const HJELPERE = new Set([
  "isMarker",
  "isState",
  "markers",
  "setAttributes",
  "states",
])

/** The builder functions in `lt`, which are the ones a project with types can use. */
export function byggefunksjoner(): string {
  const navn = Object.keys(lt)
    .filter((nøkkel) => !HJELPERE.has(nøkkel))
    .sort()

  return navn.map((byggefunksjon) => `\`lt.${byggefunksjon}()\``).join(", ")
}

export function antallByggefunksjoner(): number {
  return Object.keys(lt).filter((nøkkel) => !HJELPERE.has(nøkkel)).length
}

export function antallKomponenter(): number {
  return new Set(Object.values(classes).map((info) => info.component)).size
}

/**
 * The rows in the CSS table.
 *
 * `antallKomponenter()` counts components that have at least one class, and
 * `field` has none. The number therefore matched neither the CSS table, the
 * sum of the two tables, nor the reading "so many components and so many
 * elements".
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
 * Reflows the paragraphs to 78 characters, and leaves what is not prose alone.
 *
 * The prose in the recipes is in template literals, where the indentation
 * follows the code rather than the text. Without this every recipe would have
 * to be wrapped by hand, and a sentence that changed would leave a ragged
 * edge. Code blocks, tables and the token list are left untouched: there every
 * line means something.
 */
export function ombrekk(markdown: string): string {
  const BREDDE = 78
  const linjer = markdown.split("\n")
  const ut: string[] = []
  let avsnitt: string[] = []
  let iKode = false
  let innrykk = ""

  /** List items hang under their own marker, so the text lines up in a column. */
  function tøm(): void {
    if (avsnitt.length === 0) return

    const tekst = avsnitt.join(" ").replace(/\s+/g, " ").trim()
    const merke = /^(\d+\.\s+|[-*]\s+)/.exec(tekst)
    const heng = innrykk + (merke ? " ".repeat(merke[1].length) : "")
    /*
     * A word is characters and code spans together, the spaces inside the
     * span included. Without this, `npx @lo-tek/interfaces check page.html`
     * was split after "check", and an agent that copied the command got a
     * line break in the middle of it. The characters around it must be part
     * of the same word, or the comma after a code span ends up alone on the
     * next line.
     */
    const ord = tekst.match(/(?:`[^`]*`|\S)+/g) ?? []
    let linje = ""

    for (const del of ord) {
      const kandidat = linje === "" ? `${innrykk}${del}` : `${linje} ${del}`
      if (linje !== "" && kandidat.length > BREDDE) {
        ut.push(linje)
        linje = heng + del
      } else {
        linje = kandidat
      }
    }

    if (linje !== "") ut.push(linje)
    avsnitt = []
    innrykk = ""
  }

  for (const linje of linjer) {
    /*
     * Indentation does not count. A fence under a numbered item has three
     * spaces in front, and without this the reflow did not see it: the whole
     * code block was reflowed as prose, and `check-agent` did not find it
     * again, since the pattern requires the fence to be on a line of its own.
     * The same goes for an indented table row.
     */
    const rent = linje.trimStart()

    if (rent.startsWith("```")) {
      tøm()
      iKode = !iKode
      ut.push(linje)
      continue
    }

    // A block quote is line-based: reflowed, `> a` and `> b` become `> a > b`.
    if (
      iKode ||
      rent.startsWith("|") ||
      rent.startsWith("#") ||
      rent.startsWith(">")
    ) {
      tøm()
      ut.push(linje)
      continue
    }

    if (linje.trim() === "") {
      tøm()
      ut.push("")
      continue
    }

    // A new item starts a new paragraph, or the whole list would become one.
    if (/^(\d+\.\s|[-*]\s)/.test(rent) && avsnitt.length > 0) tøm()

    /*
     * The indentation of the first item in the paragraph is kept, so a nested
     * list is not flattened to one level. Without it, "- top / ␣␣- level two"
     * became two items on the same level.
     */
    if (avsnitt.length === 0)
      innrykk = linje.slice(0, linje.length - rent.length)

    avsnitt.push(rent)
  }

  tøm()

  // Never two blank lines in a row, and never one at the end.
  return `${ut
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`
}

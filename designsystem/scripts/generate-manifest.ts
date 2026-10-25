/**
 * Writes the manifest: what LO-TEK promises, as data every tool reads.
 *
 * Three files, all generated and checked in:
 *
 *   - `manifest/manifest.json`: the vocabulary (the elements and the classes,
 *     the same as `classes.ts` and `elements.ts`) and every builder function
 *     in `lt` with its options and the shape of its result. It is small, and
 *     every host hands it to the Rust core.
 *   - `manifest/build-cases.json`: every builder function called with many
 *     combinations of its options, with the result TypeScript gives. A port
 *     in another language must give exactly the same result for every case.
 *   - `manifest/files.json`: the rulebooks and the component files the
 *     command line reads from the package.
 *
 * Nothing here is written by hand. The options and their types are read by
 * the TypeScript compiler from the signatures in `src/lt.ts`, in
 * `builder-functions.ts`, and the results come from calling the functions. A
 * new builder function, option or variant ends up in the manifest on the
 * next build. `bun run build` rewrites the files before it checks anything,
 * so an out-of-date file on disk does not stop the build; it is the CI step
 * that checks nothing is ungenerated that fails a change where the files
 * have not been regenerated and committed.
 *
 * Run with: bun scripts/generate-manifest.ts, or as part of `generate`.
 */

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { fileURLToPath } from "node:url"
import { lt } from "../src/lt.js"
import { FAMILIES, NEUTRAL_LAYERS, ROLES } from "../src/tokens/matrix-cells.js"
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
} from "./builder-functions.js"

const PAKKE = fileURLToPath(new URL("..", import.meta.url))
const UT = `${PAKKE}manifest/`
const SKJEMAVERSJON = 1
const versjon: string = JSON.parse(
  readFileSync(`${PAKKE}package.json`, "utf8"),
).version

type Byggefunksjon = Lest & { table?: Tabeller }

const byggefunksjoner: Byggefunksjon[] = lesByggefunksjoner()

/*
 * The cases. Each option is tried alone, and then all combinations when there
 * are few enough. When there are too many, a fixed sample is drawn with a
 * fixed seed, so the file is the same from build to build. The text values
 * include whitespace that JavaScript counts as whitespace and Java by default
 * does not, a no-break space and a BOM: without them, a port that splits on
 * ASCII whitespace alone would have passed.
 */
const PRØVER: Record<Valgtype["kind"], unknown[]> = {
  values: [],
  flag: [false, true],
  text: ["x", "a b", ""],
  number: [0, 1, 3],
  // `["x", "y"]` is the only valid one with several: without it, the tabs and
  // the options were never tried with more than one key.
  textList: [
    [],
    ["x"],
    ["x", "y"],
    ["x", "x"],
    ["  x   y "],
    ["x y"],
    ["﻿x"],
    [""],
  ],
}
const prøver = (v: Valg) => {
  const verdier = v.type.kind === "values" ? v.type.values : PRØVER[v.type.kind]
  // An empty required id makes TypeScript create a random id and warn in the
  // console. The result then differs from run to run, and a typed language
  // stops it before it runs. It is not tried.
  if (v.required && v.type.kind === "text" && /^id$|Id$/.test(v.name))
    return verdier.filter((x) => x !== "")
  // Another required text, such as `label` in `tabs`, throws when empty, and
  // is also tried with only whitespace, as JavaScript counts it.
  if (v.required && v.type.kind === "text") return [...verdier, " \u00a0\ufeff"]
  if (v.required) return verdier
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
  // `undefined` means left out, and two cases that differ only there are the
  // same case.
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
// The builder functions warn in the console about use they do not like. That
// is part of what they do in the browser, not of the result, and here it is noise.
const advar = console.warn
console.warn = () => {}
try {
  for (const b of byggefunksjoner) {
    const bygg = (lt as unknown as Record<string, (o: unknown) => unknown>)[
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
 * The table: a builder function where each option adds fixed attributes,
 * independent of the other options, can be described as a base set and what
 * each option contributes. Another language can then build it from the
 * manifest alone, without anyone writing it by hand.
 *
 * The table is derived from the results, not from the code, and it is only
 * included when it gives exactly what TypeScript returned for every single
 * case. A builder function where the options interact, such as `label`, where
 * `optional` does not apply when `required` is set, gets no table and is
 * written by hand.
 *
 * The values are text. A boolean attribute that is on is the empty string,
 * and `null` means the option removes an attribute the base set has. A value
 * that is exactly `{name}` is the value of the option with that name, as in
 * `{ "aria-labelledby": "{titleId}" }` in `dialog`. A builder function that
 * returns several sets, such as `dialog` and `popover`, gets one table per set.
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
// The order of the attributes does not matter for the result.
const sortert = (x: Record<string, string>) =>
  Object.fromEntries(Object.entries(x).sort(([a], [c]) => (a < c ? -1 : 1)))

/** Replaces values that are exactly the value of a required option with `{name}`. */
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

/** The table for one set, where `sett` picks the set out of the result. */
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
      // Text and numbers: where the value is, the placeholder goes.
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
  // The base is the required options with their first trial value, and no others.
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

/** The result the table gives for the options. Used to check it. */
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
    if (!bidrag) return { "\u0000": "missing" }
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
 * The description of a class attribute is the description of the option with
 * the same name, `variant` for `data-variant`, and the class is found as for
 * the flags above: a case with the option against the same case without it.
 * An option with a different name can also change the attribute, as `type`
 * does with `data-variant` in `lt.input()`, but then it describes something
 * else. When several builder functions write the same attribute, the first
 * in alphabetical order wins.
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
        // The flags, such as `data-interactive` on `lt-card`, are in
        // `classes.ts` with an empty value list, since the editors read that
        // file. Here a flag has no values, see `types.ts`. They are derived
        // from the builder function each time the vocabulary is written, see
        // `flaggFor` in builder-functions.ts, so a flag that is gone from the
        // function is gone here too.
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
 * The tokens: what a stylesheet outside the package can build on without
 * inventing values of its own. The spacing scale, the breakpoints and the
 * container widths are read from `tokens.ts`, where the breakpoints and the
 * widths otherwise exist only in TypeScript. The colours are listed as axes
 * with what they are for, not as hex: the hue is the consumer's, and a theme
 * can have other values than LO-TEK's own.
 *
 * The component variables are read from the stylesheets. A variable is the
 * first argument of `var(--lt-<component>-…, <fallback>)`, and the fallback is
 * the default the consumer overrides. When the same variable appears with two
 * fallbacks, such as `--lt-list-gap` in a shared list, the first one in the
 * stylesheet applies. Each belongs to the component its name starts with,
 * not to the stylesheet it is read in: `fieldset.css` reads
 * `--lt-label-required-symbol`, and it belongs to the label.
 */
const roleToCss = (role: string) =>
  role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
const COMPONENT_DIRS = ["css", "frame", "standalone"].flatMap((kategori) =>
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
/** The component a variable belongs to: the longest name it starts with. */
const ownerOf = (variable: string, fallback: string) =>
  componentNames
    .filter((navn) => variable.startsWith(`--lt-${navn}-`))
    .sort((a, b) => b.length - a.length)[0] ?? fallback
const TOKEN_KINDS = new Set(
  Object.keys({ ...cssTokens, ...colorTokens }).map(
    (navn) => navn.split("-")[3],
  ),
)
/*
 * The variables a web component writes itself, such as `--lt-popover-top`,
 * are not something the consumer overrides: the inline style beats a
 * stylesheet. They are read with a fallback in the CSS like all the others,
 * and are recognised by `setProperty` in the component's own source.
 */
const setByComponent = new Set<string>()
for (const { sti } of COMPONENT_DIRS)
  for (const fil of readdirSync(sti).filter(
    (f) => f.endsWith(".ts") && !f.includes(".test."),
  ))
    for (const m of readFileSync(`${sti}/${fil}`, "utf8").matchAll(
      /setProperty\(\s*["'](--lt-[a-z0-9-]+)["']/g,
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
    const lesing = /var\(\s*(--lt-[a-z0-9-]+)\s*,/g
    for (let m = lesing.exec(css); m; m = lesing.exec(css)) {
      // The fallback runs to the parenthesis that closes `var(`, also when it
      // has `calc()` or another `var()` in it.
      let dybde = 1
      let i = lesing.lastIndex
      for (; i < css.length && dybde > 0; i++) {
        if (css[i] === "(") dybde++
        else if (css[i] === ")") dybde--
      }
      const variabel = m[1]
      // A token belongs on the token side, not here. Today no component reads
      // a token with a fallback, but if one did, it would look like a
      // component variable without this.
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
      navn.startsWith("--lt-spacing-"),
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
      navn.startsWith("--lt-color-"),
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
  `${UT}build-cases.json`,
  `${JSON.stringify({ version: versjon, cases: tilfeller })}\n`,
)

/*
 * The files the command line reads from the package: the rulebooks for
 * `lotek agent` and the source of each component for `lotek takeover`,
 * without the tests. It reads the list rather than the folders, because a
 * folder could not be read through Node's WASI on Windows: `takeover` found
 * no components there.
 */
const ls = (mappe: string) => readdirSync(`${PAKKE}${mappe}`).sort()
const filer = {
  agent: ls("agent")
    .filter((fil) => fil.endsWith(".md"))
    .map((fil) => fil.slice(0, -3)),
  components: ["css", "frame", "standalone"].flatMap((kategori) =>
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
writeFileSync(`${UT}files.json`, `${JSON.stringify(filer, null, 2)}\n`)

console.log(
  `✓ The manifest: ${byggefunksjoner.length} builder functions, ${Object.keys(elements).length} elements, ${Object.keys(classes).length} classes, ${tilfeller.length} build cases, ${Object.values(componentVariables).reduce((n, v) => n + Object.keys(v).length, 0)} component variables.`,
)

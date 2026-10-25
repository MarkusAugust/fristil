/**
 * Reads the builder functions in `lt` as TypeScript sees them: the name,
 * each option with its type, and the shape of the result.
 *
 * The options and their types are read by the TypeScript compiler from the
 * signatures in `src/lt.ts`, not from the source code as text, so an option
 * added to a component is included without anything having to be written
 * anywhere else.
 *
 * Both `generate-vocabulary.ts` and `generate-manifest.ts` read from here.
 * The vocabulary used to read the flags from `manifest.json` on disk, while
 * the manifest derived them again from the build cases and read the rest
 * from `classes.ts`. The two pointed at each other: a new flag reached the
 * manifest on the first build, but `classes.ts` only on the next, and
 * `check:vocabulary` failed the build in between. Now the flags are derived
 * in one place, from the builder function itself, and the manifest takes
 * them from `classes.ts` like everything else there.
 *
 * The program is built when `lesByggefunksjoner()` is called, not when the
 * module loads, so it costs only whoever actually asks.
 */

import { fileURLToPath } from "node:url"
import ts from "typescript"
import { lt } from "../src/lt.js"

const PAKKE = fileURLToPath(new URL("..", import.meta.url))

export type Valgtype =
  | { kind: "values"; values: string[] }
  | { kind: "flag" }
  | { kind: "text" }
  | { kind: "number" }
  | { kind: "textList" }

export type Valg = {
  name: string
  required: boolean
  type: Valgtype
  /** The JSDoc of the option in the builder function's type, when it has one. */
  description?: string
}

export type Svar =
  | { kind: "attributes" }
  | { kind: "text" }
  | { kind: "values"; values: string[] }
  | { kind: "list"; of: Svar }
  | { kind: "group"; fields: Record<string, Svar & { optional?: boolean }> }

export type Byggefunksjon = {
  name: string
  options: Valg[]
  returns: Svar
}

/*
 * The order of allowed values. TypeScript gives a union in the order the
 * types were created, not the order they are written in, so the order is
 * taken from the lists the builder functions themselves advertise
 * (`lt.button.variants` and the like) when one of them has exactly the same
 * values.
 */
const lister: string[][] = []
for (const verdi of Object.values(lt)) {
  if (Array.isArray(verdi)) lister.push([...verdi])
  if (typeof verdi !== "function") continue
  for (const egen of Object.values(verdi))
    if (Array.isArray(egen) && egen.every((x) => typeof x === "string"))
      lister.push([...egen])
}
function ordnet(verdier: string[]): string[] {
  const sett = [...verdier].sort().join("\u0000")
  return lister.find((l) => [...l].sort().join("\u0000") === sett) ?? verdier
}

let lest: Byggefunksjon[] | undefined

/** The builder functions in `lt`, sorted by name. Read once per process. */
export function lesByggefunksjoner(): Byggefunksjon[] {
  if (lest) return lest

  const konfig = ts.getParsedCommandLineOfConfigFile(
    `${PAKKE}tsconfig.json`,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  )
  if (!konfig) throw new Error("Could not find tsconfig.json")
  const program = ts.createProgram(konfig.fileNames, konfig.options)
  const typer = program.getTypeChecker()
  const kilde = program.getSourceFile(`${PAKKE}src/lt.ts`)
  if (!kilde) throw new Error("Could not find src/lt.ts in the program")

  let ltNavn: ts.Identifier | undefined
  kilde.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return
    for (const d of node.declarationList.declarations)
      if (ts.isIdentifier(d.name) && d.name.text === "lt") ltNavn = d.name
  })
  if (!ltNavn) throw new Error("Could not find `export const lt` in src/lt.ts")

  const vis = (t: ts.Type) => typer.typeToString(t)
  const deler = (t: ts.Type) =>
    (t.isUnion() ? t.types : [t]).filter(
      (d) => !(d.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)),
    )

  function valgtype(t: ts.Type, hvor: string): Valgtype {
    const d = deler(t)
    if (d.every((x) => x.isStringLiteral()))
      return {
        kind: "values",
        values: ordnet(d.map((x) => (x as ts.StringLiteralType).value)),
      }
    if (d.every((x) => x.flags & ts.TypeFlags.BooleanLike))
      return { kind: "flag" }
    if (d.length === 1 && d[0].flags & ts.TypeFlags.String)
      return { kind: "text" }
    if (d.length === 1 && d[0].flags & ts.TypeFlags.Number)
      return { kind: "number" }
    if (
      d.length === 1 &&
      typer.isArrayType(d[0]) &&
      typer.getTypeArguments(d[0] as ts.TypeReference)[0].flags &
        ts.TypeFlags.String
    )
      return { kind: "textList" }
    throw new Error(
      `${hvor} has a type the manifest does not know: ${vis(t)}. Add it to valgtype().`,
    )
  }

  /** Whether the type is an attribute set: every value is text, or `true` for a flag. */
  function erAttributter(t: ts.Type): boolean {
    const props = t.getProperties()
    return (
      props.length > 0 &&
      props.every((p) =>
        deler(typer.getTypeOfSymbol(p)).every(
          (d) =>
            d.flags & ts.TypeFlags.StringLike ||
            (d.flags & ts.TypeFlags.BooleanLiteral && vis(d) === "true"),
        ),
      )
    )
  }

  function svar(t: ts.Type, hvor: string): Svar {
    const d = deler(t)
    if (d.length === 1 && typer.isArrayType(d[0]))
      return {
        kind: "list",
        of: svar(typer.getTypeArguments(d[0] as ts.TypeReference)[0], hvor),
      }
    if (d.every((x) => x.isStringLiteral()))
      return {
        kind: "values",
        values: ordnet(d.map((x) => (x as ts.StringLiteralType).value)),
      }
    if (d.length === 1 && d[0].flags & ts.TypeFlags.String)
      return { kind: "text" }
    if (d.length === 1 && erAttributter(d[0])) return { kind: "attributes" }
    if (d.length === 1 && d[0].flags & ts.TypeFlags.Object) {
      const fields: Record<string, Svar & { optional?: boolean }> = {}
      for (const p of d[0].getProperties()) {
        const valgfri = (p.flags & ts.SymbolFlags.Optional) !== 0
        fields[p.name] = {
          ...svar(typer.getTypeOfSymbol(p), `${hvor}.${p.name}`),
          ...(valgfri ? { optional: true } : {}),
        }
      }
      return { kind: "group", fields }
    }
    throw new Error(
      `${hvor} returns a shape the manifest does not know: ${vis(t)}`,
    )
  }

  const byggefunksjoner: Byggefunksjon[] = []
  for (const p of typer.getTypeAtLocation(ltNavn).getProperties()) {
    const signatur = typer.getTypeOfSymbol(p).getCallSignatures()[0]
    // Lists like `lt.states` and guards like `lt.isState` are not builder
    // functions. `setAttributes` puts a set on a DOM element and has no
    // counterpart outside the browser.
    if (!signatur || p.name.startsWith("is") || p.name === "setAttributes")
      continue
    const parameter = signatur.getParameters()[0]
    const options: Valg[] = []
    if (parameter) {
      const valgType = typer.getNonNullableType(
        typer.getTypeOfSymbol(parameter),
      )
      for (const v of valgType.getProperties()) {
        // Only the first paragraph: the rest is notes for whoever maintains
        // the type, with React advice and history, and does not belong in the contract.
        const description = ts
          .displayPartsToString(v.getDocumentationComment(typer))
          .trim()
          .split(/\n\s*\n/)[0]
          .replace(/\s*\n\s*/g, " ")
        options.push({
          name: v.name,
          required: (v.flags & ts.SymbolFlags.Optional) === 0,
          type: valgtype(
            typer.getTypeOfSymbol(v),
            `lt.${p.name}({ ${v.name} })`,
          ),
          ...(description ? { description } : {}),
        })
      }
    }
    byggefunksjoner.push({
      name: p.name,
      options,
      returns: svar(signatur.getReturnType(), `lt.${p.name}()`),
    })
  }
  byggefunksjoner.sort((a, b) => a.name.localeCompare(b.name))
  lest = byggefunksjoner
  return lest
}

/** The sets a result consists of: one for `button`, one per part for `dialog`. */
export function settene(svar: unknown): [string, Record<string, unknown>][] {
  if (typeof svar !== "object" || svar === null) return []
  const verdier = Object.entries(svar as Record<string, unknown>)
  return verdier.some(([, v]) => typeof v === "object" && v !== null)
    ? (verdier.filter(
        ([, v]) => typeof v === "object" && v !== null && !Array.isArray(v),
      ) as [string, Record<string, unknown>][])
    : [["", svar as Record<string, unknown>]]
}

/**
 * The flags a builder function gives: `data-interactive` on `lt-card` when
 * `interactive` is on, `data-optional` on `lt-label` when `optional` is on.
 * A flag is on when it is present, and the stylesheet only asks whether it
 * exists, so it has no list of values.
 *
 * It is read by calling the function: when a `data-*` attribute is a flag in
 * the result with the boolean option on, but not without, it belongs to the
 * classes in the same set. `grunn` is the options the call needs in order to
 * work, such as an id. Only classes in `kjente` are counted, so a name that
 * is not in the CSS does not get an entry by itself.
 */
export function flaggFor(
  b: Byggefunksjon,
  bygg: (valg: Record<string, unknown>) => unknown,
  grunn: Record<string, unknown>,
  kjente: (klasse: string) => boolean,
): Map<string, Set<string>> {
  const flagg = new Map<string, Set<string>>()
  const uten = new Map(settene(bygg(grunn)))
  for (const valg of b.options) {
    if (valg.type.kind !== "flag") continue
    for (const [navn, sett] of settene(bygg({ ...grunn, [valg.name]: true }))) {
      const klasser = String(sett.class ?? "")
        .split(/\s+/)
        .filter(kjente)
      for (const [attributt, verdi] of Object.entries(sett))
        if (
          attributt.startsWith("data-") &&
          (verdi === true || verdi === "") &&
          uten.get(navn)?.[attributt] === undefined
        )
          for (const klasse of klasser)
            flagg.set(klasse, (flagg.get(klasse) ?? new Set()).add(attributt))
    }
  }
  return flagg
}

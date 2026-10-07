/**
 * Skriver manifestet: det Fristil lover, som data alle verktøy leser.
 *
 * To filer, begge generert og sjekket inn:
 *
 *   - `manifest/manifest.json`: ordforrådet (elementene og klassene, de samme
 *     som `classes.ts` og `elements.ts`) og hver byggefunksjon i `fs` med
 *     valgene og formen på svaret. Den er liten, og Rust-kjernen bærer den
 *     innebygd som standard.
 *   - `manifest/byggetilfeller.json`: hver byggefunksjon kalt med mange
 *     kombinasjoner av valgene, med svaret TypeScript gir. En utgave i et annet
 *     språk skal svare nøyaktig det samme på hvert tilfelle.
 *
 * Ingenting her er skrevet for hånd. Valgene og typene deres leses av
 * TypeScript-kompilatoren fra signaturene i `src/fs.ts`, og svarene kommer
 * fra å kalle funksjonene. En ny byggefunksjon, et nytt valg eller en ny
 * variant havner i manifestet ved neste bygg, og CI feiler hvis fila på disk
 * ikke er den generatoren ville skrevet.
 *
 * Kjør med: bun scripts/generate-manifest.ts, eller som en del av `generate`.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { classes } from "../src/diagnostics/classes.js"
import { elements } from "../src/diagnostics/elements.js"
import { fs } from "../src/fs.js"

const PAKKE = fileURLToPath(new URL("..", import.meta.url))
const UT = `${PAKKE}manifest/`
const SKJEMAVERSJON = 1
const versjon: string = JSON.parse(
  readFileSync(`${PAKKE}package.json`, "utf8"),
).version

type Valgtype =
  | { kind: "values"; values: string[] }
  | { kind: "flag" }
  | { kind: "text" }
  | { kind: "number" }
  | { kind: "textList" }

type Valg = { name: string; required: boolean; type: Valgtype }

type Svar =
  | { kind: "attributes" }
  | { kind: "text" }
  | { kind: "values"; values: string[] }
  | { kind: "list"; of: Svar }
  | { kind: "group"; fields: Record<string, Svar & { optional?: boolean }> }

type Byggefunksjon = { name: string; options: Valg[]; returns: Svar }

/*
 * Rekkefølgen på lovlige verdier. TypeScript gir en union i den rekkefølgen
 * typene ble laget, ikke den de står i, så rekkefølgen hentes fra listene
 * byggefunksjonene selv reklamerer med (`fs.button.variants` og slike) når
 * en av dem har nøyaktig de samme verdiene.
 */
const lister: string[][] = []
for (const verdi of Object.values(fs)) {
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

const konfig = ts.getParsedCommandLineOfConfigFile(
  `${PAKKE}tsconfig.json`,
  {},
  { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
)
if (!konfig) throw new Error("Fant ikke tsconfig.json")
const program = ts.createProgram(konfig.fileNames, konfig.options)
const typer = program.getTypeChecker()
const kilde = program.getSourceFile(`${PAKKE}src/fs.ts`)
if (!kilde) throw new Error("Fant ikke src/fs.ts i programmet")

let fsNavn: ts.Identifier | undefined
kilde.forEachChild((node) => {
  if (!ts.isVariableStatement(node)) return
  for (const d of node.declarationList.declarations)
    if (ts.isIdentifier(d.name) && d.name.text === "fs") fsNavn = d.name
})
if (!fsNavn) throw new Error("Fant ikke `export const fs` i src/fs.ts")

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
    `${hvor} har en type manifestet ikke kjenner: ${vis(t)}. Legg den til i valgtype().`,
  )
}

/** Om typen er et attributtsett: hver verdi er tekst, eller `true` for et flagg. */
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
    `${hvor} returnerer en form manifestet ikke kjenner: ${vis(t)}`,
  )
}

const byggefunksjoner: Byggefunksjon[] = []
for (const p of typer.getTypeAtLocation(fsNavn).getProperties()) {
  const signatur = typer.getTypeOfSymbol(p).getCallSignatures()[0]
  // Lister som `fs.states` og vakter som `fs.isState` er ikke byggefunksjoner.
  // `setAttributes` legger et sett på et DOM-element og har ingen motpart
  // utenfor nettleseren.
  if (!signatur || p.name.startsWith("is") || p.name === "setAttributes")
    continue
  const parameter = signatur.getParameters()[0]
  const options: Valg[] = []
  if (parameter) {
    const valgType = typer.getNonNullableType(typer.getTypeOfSymbol(parameter))
    for (const v of valgType.getProperties())
      options.push({
        name: v.name,
        required: (v.flags & ts.SymbolFlags.Optional) === 0,
        type: valgtype(typer.getTypeOfSymbol(v), `fs.${p.name}({ ${v.name} })`),
      })
  }
  byggefunksjoner.push({
    name: p.name,
    options,
    returns: svar(signatur.getReturnType(), `fs.${p.name}()`),
  })
}
byggefunksjoner.sort((a, b) => a.name.localeCompare(b.name))

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

const manifest = {
  $schema: "./manifest.schema.json",
  schemaVersion: SKJEMAVERSJON,
  version: versjon,
  elements,
  classes,
  builders: byggefunksjoner,
}

mkdirSync(UT, { recursive: true })
writeFileSync(`${UT}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(
  `${UT}byggetilfeller.json`,
  `${JSON.stringify({ version: versjon, cases: tilfeller })}\n`,
)

console.log(
  `✓ Manifestet: ${byggefunksjoner.length} byggefunksjoner, ${Object.keys(elements).length} elementer, ${Object.keys(classes).length} klasser, ${tilfeller.length} byggetilfeller.`,
)

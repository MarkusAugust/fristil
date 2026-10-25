/**
 * Leser byggefunksjonene i `lt` slik TypeScript ser dem: navnet, hvert valg
 * med typen sin, og formen på svaret.
 *
 * Valgene og typene deres leses av TypeScript-kompilatoren fra signaturene i
 * `src/lt.ts`, ikke fra kildekoden som tekst, så et valg som er lagt til i
 * en komponent er med uten at noe må skrives et annet sted.
 *
 * Både `generate-vocabulary.ts` og `generate-manifest.ts` leser herfra. Før
 * leste ordforrådet flaggene fra `manifest.json` på disk, mens manifestet
 * utledet dem på nytt fra byggetilfellene og leste resten fra `classes.ts`.
 * De to pekte på hverandre: et nytt flagg kom inn i manifestet ved første
 * bygg, men i `classes.ts` først ved det neste, og `check:vocabulary` felte
 * bygget i mellomtiden. Nå utledes flaggene ett sted, av byggefunksjonen
 * selv, og manifestet tar dem fra `classes.ts` som alt annet der.
 *
 * Programmet bygges når `lesByggefunksjoner()` kalles, ikke når modulen
 * lastes, så det koster bare den som faktisk spør.
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
  /** JSDoc-en til valget i byggefunksjonens type, når den har en. */
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
 * Rekkefølgen på lovlige verdier. TypeScript gir en union i den rekkefølgen
 * typene ble laget, ikke den de står i, så rekkefølgen hentes fra listene
 * byggefunksjonene selv reklamerer med (`lt.button.variants` og slike) når
 * en av dem har nøyaktig de samme verdiene.
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

/** Byggefunksjonene i `lt`, sortert på navn. Leses én gang per prosess. */
export function lesByggefunksjoner(): Byggefunksjon[] {
  if (lest) return lest

  const konfig = ts.getParsedCommandLineOfConfigFile(
    `${PAKKE}tsconfig.json`,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  )
  if (!konfig) throw new Error("Fant ikke tsconfig.json")
  const program = ts.createProgram(konfig.fileNames, konfig.options)
  const typer = program.getTypeChecker()
  const kilde = program.getSourceFile(`${PAKKE}src/lt.ts`)
  if (!kilde) throw new Error("Fant ikke src/lt.ts i programmet")

  let ltNavn: ts.Identifier | undefined
  kilde.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return
    for (const d of node.declarationList.declarations)
      if (ts.isIdentifier(d.name) && d.name.text === "lt") ltNavn = d.name
  })
  if (!ltNavn) throw new Error("Fant ikke `export const lt` i src/lt.ts")

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
  for (const p of typer.getTypeAtLocation(ltNavn).getProperties()) {
    const signatur = typer.getTypeOfSymbol(p).getCallSignatures()[0]
    // Lister som `lt.states` og vakter som `lt.isState` er ikke byggefunksjoner.
    // `setAttributes` legger et sett på et DOM-element og har ingen motpart
    // utenfor nettleseren.
    if (!signatur || p.name.startsWith("is") || p.name === "setAttributes")
      continue
    const parameter = signatur.getParameters()[0]
    const options: Valg[] = []
    if (parameter) {
      const valgType = typer.getNonNullableType(
        typer.getTypeOfSymbol(parameter),
      )
      for (const v of valgType.getProperties()) {
        // Bare første avsnitt: resten er notater til den som vedlikeholder
        // typen, med React-råd og historikk, og hører ikke i kontrakten.
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

/** Settene et svar består av: ett for `button`, ett per del for `dialog`. */
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
 * Flaggene en byggefunksjon gir: `data-interactive` på `lt-card` når
 * `interactive` er på, `data-optional` på `lt-label` når `optional` er på.
 * Et flagg er på når det står der, og stilarket spør bare om det finnes, så
 * det har ingen liste over verdier.
 *
 * Det leses ved å kalle funksjonen: står et `data-*`-attributt som flagg i
 * svaret med det boolske valget på, men ikke uten, hører det til klassene i
 * det samme settet. `grunn` er valgene som må med for at kallet skal gå, som
 * en id. Bare klasser i `kjente` telles, så et navn som ikke står i CSS-en
 * ikke får en oppføring av seg selv.
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

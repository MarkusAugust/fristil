/**
 * Skriver kontrakten som testtilfeller, fra TypeScript-koden.
 *
 * Byggefunksjonene finnes i TypeScript og i andre språk, foreløpig Kotlin.
 * TypeScript er fasiten. Denne fila kaller hver byggefunksjon som er med i
 * kontrakten, med alle kombinasjoner av valgene, og skriver inndata og svar
 * til `contract/cases.json`. Hver annen utgave må gi nøyaktig det samme svaret
 * på hvert tilfelle, og testene i `kotlin/` leser fila.
 *
 * Kjøres som en del av `generate`, og dermed av hvert bygg. CI feiler hvis
 * bygget endrer en sporet fil, så en endring i TypeScript som ikke er
 * regenerert, stopper der, og en regenerert fil som Kotlin ikke svarer likt
 * på, stopper i Kotlin-testene. Ingen av dem kan gå fra den andre i stillhet.
 *
 * Tilfellene er kombinasjoner, ikke eksempler: et valg som bare er prøvd
 * alene, kan svare riktig alene og feil sammen med et annet. Det er
 * samspillet mellom `invalid`, `error` og `describedBy` som er kontrakten.
 */

import { writeFileSync } from "node:fs"
import { fs } from "../src/fs.js"

type Case = {
  builder: string
  options: Record<string, unknown>
  expected: unknown
}

const cases: Case[] = []

function add(builder: keyof typeof fs, options: Record<string, unknown>) {
  const build = fs[builder] as (o: Record<string, unknown>) => unknown
  cases.push({ builder, options, expected: build(options) })
}

/** Alle kombinasjoner av listene, som objekter. Udefinert betyr utelatt. */
function combinations(
  axes: Record<string, readonly unknown[]>,
): Record<string, unknown>[] {
  let result: Record<string, unknown>[] = [{}]
  for (const [name, values] of Object.entries(axes)) {
    result = result.flatMap((partial) =>
      values.map((value) =>
        value === undefined ? { ...partial } : { ...partial, [name]: value },
      ),
    )
  }
  return result
}

for (const options of combinations({
  id: ["epost"],
  help: [undefined, true],
  error: [undefined, true],
  invalid: [undefined, true],
  required: [undefined, ...fs.label.markers],
  optional: [undefined, true],
  disabled: [undefined, true],
})) {
  add("field", options)
}

// Egne id-er og ekstra id-er i `aria-describedby`: duplikater og mellomrom
// skal slås sammen, og en egen id skal brukes både på teksten og i koblingen.
for (const options of combinations({
  id: ["fodselsdato"],
  help: [true],
  error: [true],
  invalid: [undefined, true],
  helpId: [undefined, "hjelp"],
  errorId: [undefined, "feil"],
  describedBy: [
    undefined,
    ["format"],
    ["format", "format"],
    ["  format   eksempel "],
    ["fodselsdato-help"],
    // JavaScript regner flere tegn som mellomrom enn Java gjør som standard,
    // blant dem hardt mellomrom og BOM. Uten disse to ville en utgave som
    // deler på ASCII-mellomrom alene, bestått.
    ["format\u00a0eksempel"],
    ["\ufeffformat"],
  ],
})) {
  add("field", options)
}

// Kanttilfeller: tomme strenger, en id med mellomrom i, og `describedBy`
// som gjentar hjelpetekstens id. TypeScript beholder en tom `helpId` med `??`,
// men tar den ikke med i koblingen, siden den tomme strengen er usann.
for (const options of combinations({
  id: ["for navn"],
  help: [undefined, true],
  error: [true],
  invalid: [undefined, true],
  helpId: [undefined, ""],
  errorId: [undefined, ""],
  describedBy: [undefined, [""], ["for navn-help"]],
})) {
  add("field", options)
}

for (const options of combinations({
  type: [undefined, ...fs.input.types],
  state: [undefined, ...fs.input.states],
})) {
  add("input", options)
}

for (const options of combinations({
  required: [undefined, ...fs.label.markers],
  optional: [undefined, true],
  disabled: [undefined, true],
})) {
  add("label", options)
}

for (const variant of [undefined, ...fs.helpText.variants]) {
  add("helpText", variant === undefined ? {} : { variant })
}

for (const variant of [undefined, ...fs.errorText.variants]) {
  add("errorText", variant === undefined ? {} : { variant })
}

/*
 * De lovlige verdiene, slik byggefunksjonene reklamerer med dem. En annen
 * utgave skal ha de samme, verken flere eller færre: en ny inputtype i
 * TypeScript som Kotlin ikke kjenner, skal felle Kotlin-testene, ikke bli
 * oppdaget av en bruker.
 */
const values = {
  requiredMarkers: fs.label.markers,
  fieldStates: fs.input.states,
  inputTypes: fs.input.types,
  helpTextVariants: fs.helpText.variants,
  errorTextVariants: fs.errorText.variants,
}

const file = new URL("../../contract/cases.json", import.meta.url)
writeFileSync(file, `${JSON.stringify({ values, cases }, null, 2)}\n`)

const builders = [...new Set(cases.map((c) => c.builder))]
console.log(
  `✓ Kontrakten: ${cases.length} tilfeller for ${builders.length} byggefunksjoner (${builders.join(", ")})`,
)

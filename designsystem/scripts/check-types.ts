/**
 * At typene følger med hver inngang til web-komponentene, alene.
 *
 * Typesikker bruk-siden lover at `querySelector("lt-dialog")` og
 * `addEventListener("dialog-toggle", …)` er typet med det du alt importerer,
 * også fra `/register` og `/react-jsx`. `typecheck:tests` kan ikke se om det
 * holder: der kompileres hele `src` i ett program, så utvidelsene av
 * `HTMLElementTagNameMap` og `HTMLElementEventMap` er alltid med, uansett
 * hvilken fil de står i. Fra `/register` alene var `querySelector("lt-dialog")`
 * et `Element`, og lytteren på det fikk `Event` uten `detail`, fordi tagkartet
 * sto i `lt-*.ts`-filene, og `register.d.ts` importerer dem ikke.
 *
 * Her kompileres én fil per inngang, med bare den importen, mot `dist` slik
 * en konsument ser pakken: hovedinngangen, `/register`, `/react`, `/react-jsx`
 * og hver web-komponent. Ett program per fil, ellers hadde de lånt typer av
 * hverandre, som testene gjør.
 *
 * Kjøres av `bun run build`, etter at `dist` er bygd.
 */

import { join } from "node:path/posix"
import { fileURLToPath } from "node:url"
import ts from "typescript"

/*
 * Med skråstrek også på Windows: TypeScript normaliserer rotfilene til
 * skråstrek før den spør verten om dem, så den virtuelle fila må ligge under
 * samme stavemåte for at oppslaget skal treffe.
 */
const pakke = fileURLToPath(new URL("../", import.meta.url)).replace(/\\/g, "/")
const manifest = (await Bun.file(join(pakke, "package.json")).json()) as {
  name: string
  exports: Record<string, string | { types?: string }>
}

/** Inngangene som skal kjenne web-komponentene: de fire felles og hver `lt-*`. */
const FELLES = [".", "./register", "./react", "./react-jsx"]

const innganger = Object.entries(manifest.exports)
  .filter(
    ([navn, verdi]) =>
      typeof verdi === "object" &&
      typeof verdi.types === "string" &&
      (FELLES.includes(navn) || verdi.types.includes("/lt-")),
  )
  .map(([navn]) => navn)

if (innganger.length < FELLES.length + 9) {
  console.error(
    `Fant bare ${innganger.length} innganger å prøve: ${innganger.join(", ")}. Sjekk formatet på exports.`,
  )
  process.exit(1)
}

/**
 * Det en konsument skriver etter å ha importert inngangen. `querySelector`
 * med tagnavn gir komponentklassen bare når `HTMLElementTagNameMap` er
 * utvidet, og `detail` finnes bare når `HTMLElementEventMap` er det. Lytteren
 * på `document` går gjennom `DocumentEventMap`.
 */
function prøve(inngang: string, feil = false): string {
  const type = feil ? "string" : "boolean"
  return `import "${manifest.name}${inngang.slice(1)}"

const dialog = document.querySelector("lt-dialog")
dialog?.addEventListener("dialog-toggle", (event) => {
  const open: ${type} = event.detail.open
  const returnValue: string = event.detail.returnValue
  void open
  void returnValue
})

const faner = document.querySelector("lt-tabs")
faner?.addEventListener("tab-select", (event) => {
  const index: number = event.detail.index
  void index
})

document.addEventListener("suggestion-select", (event) => {
  const value: string = event.detail.value
  void value
})

const felt: HTMLElement | null = document.querySelector("lt-field")
void felt

export {}
`
}

const options: ts.CompilerOptions = {
  strict: true,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ES2022,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  types: [],
  noEmit: true,
  skipLibCheck: true,
}

/*
 * Fila finnes bare her, ikke på disk, men stien ligger i pakken, så importen
 * av pakkenavnet løses gjennom `exports` i package.json, slik Node gjør det.
 * Kildefilene fra `lib` og `dist` leses én gang og deles mellom programmene;
 * det er programmet, ikke filene, som må være nytt for hver inngang.
 */
const virtuelle = new Map<string, string>()
const lest = new Map<string, ts.SourceFile | undefined>()
const vert = ts.createCompilerHost(options, true)
const hentKilde = vert.getSourceFile
vert.getSourceFile = (fil, språk, vedFeil, skalLage) => {
  const innhold = virtuelle.get(fil)
  if (innhold !== undefined)
    return ts.createSourceFile(fil, innhold, språk, true)
  if (!lest.has(fil)) lest.set(fil, hentKilde(fil, språk, vedFeil, skalLage))
  return lest.get(fil)
}
vert.fileExists = (fil) => virtuelle.has(fil) || ts.sys.fileExists(fil)
vert.readFile = (fil) => virtuelle.get(fil) ?? ts.sys.readFile(fil)

function feilene(inngang: string, innhold: string): string[] {
  const fil = join(
    pakke,
    "check-types",
    `${inngang.replace(/^\.\/?/, "") || "index"}.ts`,
  )
  virtuelle.set(fil, innhold)
  const program = ts.createProgram([fil], options, vert)
  const diagnostikk = ts.getPreEmitDiagnostics(program)
  return diagnostikk.map((d) => {
    const sted = d.file
      ? `${d.file.fileName.replace(pakke, "")}:${d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1}`
      : "tsc"
    return `${sted}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`
  })
}

const feil: string[] = []

for (const inngang of innganger) {
  for (const linje of feilene(inngang, prøve(inngang)))
    feil.push(`${inngang}: ${linje}`)
}

// Sjekken må kunne felle. Ellers beviser et grønt resultat ingenting.
if (
  feilene(innganger[0] as string, prøve(innganger[0] as string, true))
    .length === 0
) {
  feil.push(
    "Prøven med feil type gikk gjennom, så sjekken ser ikke på typene i det hele tatt.",
  )
}

if (feil.length > 0) {
  console.error(
    `Typene følger ikke med hver inngang alene:\n\n${feil.map((f) => `  ${f}`).join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Typene til web-komponentene følger med hver av de ${innganger.length} inngangene alene: ${innganger.join(", ")}.`,
)

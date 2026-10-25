/**
 * Checks that the types come with each entry point to the web components,
 * on its own.
 *
 * The type-safe usage page promises that `querySelector("lt-dialog")` and
 * `addEventListener("dialog-toggle", …)` are typed by what you already
 * import, also from `/register` and `/react-jsx`. `typecheck:tests` cannot
 * see whether that holds: it compiles all of `src` in one program, so the
 * augmentations of `HTMLElementTagNameMap` and `HTMLElementEventMap` are
 * always present, whatever file they are in. From `/register` alone,
 * `querySelector("lt-dialog")` was an `Element`, and its listener got
 * `Event` without `detail`, because the tag map was in the `lt-*.ts` files,
 * and `register.d.ts` does not import them.
 *
 * Here one file per entry point is compiled, with only that import, against
 * `dist` as a consumer sees the package: the main entry point, `/register`,
 * `/react`, `/react-jsx` and every web component. One program per file,
 * otherwise they would have borrowed types from each other, as the tests do.
 *
 * Run by `bun run build`, after `dist` is built.
 */

import { join } from "node:path/posix"
import { fileURLToPath } from "node:url"
import ts from "typescript"

/*
 * With forward slashes on Windows too: TypeScript normalises the root files
 * to forward slashes before it asks the host for them, so the virtual file
 * must be stored under the same spelling for the lookup to hit.
 */
const packageRoot = fileURLToPath(new URL("../", import.meta.url)).replace(
  /\\/g,
  "/",
)
const manifest = (await Bun.file(join(packageRoot, "package.json")).json()) as {
  name: string
  exports: Record<string, string | { types?: string }>
}

/** The entry points that must know the web components: the four shared ones and every `lt-*`. */
const SHARED = [".", "./register", "./react", "./react-jsx"]

const entryPoints = Object.entries(manifest.exports)
  .filter(
    ([name, value]) =>
      typeof value === "object" &&
      typeof value.types === "string" &&
      (SHARED.includes(name) || value.types.includes("/lt-")),
  )
  .map(([name]) => name)

if (entryPoints.length < SHARED.length + 9) {
  console.error(
    `Found only ${entryPoints.length} entry points to try: ${entryPoints.join(", ")}. Check the format of exports.`,
  )
  process.exit(1)
}

/**
 * What a consumer writes after importing the entry point. `querySelector`
 * with a tag name gives the component class only when
 * `HTMLElementTagNameMap` is augmented, and `detail` exists only when
 * `HTMLElementEventMap` is. The listener on `document` goes through
 * `DocumentEventMap`.
 */
function sample(entryPoint: string, wrong = false): string {
  const type = wrong ? "string" : "boolean"
  return `import "${manifest.name}${entryPoint.slice(1)}"

const dialog = document.querySelector("lt-dialog")
dialog?.addEventListener("dialog-toggle", (event) => {
  const open: ${type} = event.detail.open
  const returnValue: string = event.detail.returnValue
  void open
  void returnValue
})

const tabs = document.querySelector("lt-tabs")
tabs?.addEventListener("tab-select", (event) => {
  const index: number = event.detail.index
  void index
})

document.addEventListener("suggestion-select", (event) => {
  const value: string = event.detail.value
  void value
})

const field: HTMLElement | null = document.querySelector("lt-field")
void field

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
 * The file exists only here, not on disk, but its path is inside the
 * package, so the import of the package name resolves through `exports` in
 * package.json, as Node does it. The source files from `lib` and `dist` are
 * read once and shared between the programs; it is the program, not the
 * files, that must be new for each entry point.
 */
const virtualFiles = new Map<string, string>()
const read = new Map<string, ts.SourceFile | undefined>()
const host = ts.createCompilerHost(options, true)
const getSource = host.getSourceFile
host.getSourceFile = (file, languageVersion, onError, shouldCreate) => {
  const content = virtualFiles.get(file)
  if (content !== undefined)
    return ts.createSourceFile(file, content, languageVersion, true)
  if (!read.has(file))
    read.set(file, getSource(file, languageVersion, onError, shouldCreate))
  return read.get(file)
}
host.fileExists = (file) => virtualFiles.has(file) || ts.sys.fileExists(file)
host.readFile = (file) => virtualFiles.get(file) ?? ts.sys.readFile(file)

function errorsFor(entryPoint: string, content: string): string[] {
  const file = join(
    packageRoot,
    "check-types",
    `${entryPoint.replace(/^\.\/?/, "") || "index"}.ts`,
  )
  virtualFiles.set(file, content)
  const program = ts.createProgram([file], options, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  return diagnostics.map((d) => {
    const location = d.file
      ? `${d.file.fileName.replace(packageRoot, "")}:${d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1}`
      : "tsc"
    return `${location}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`
  })
}

const failures: string[] = []

for (const entryPoint of entryPoints) {
  for (const line of errorsFor(entryPoint, sample(entryPoint)))
    failures.push(`${entryPoint}: ${line}`)
}

// The check must be able to fail. Otherwise a green result proves nothing.
if (
  errorsFor(entryPoints[0] as string, sample(entryPoints[0] as string, true))
    .length === 0
) {
  failures.push(
    "The sample with the wrong type passed, so the check is not looking at the types at all.",
  )
}

if (failures.length > 0) {
  console.error(
    `The types do not come with each entry point on its own:\n\n${failures.map((f) => `  ${f}`).join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `The web components' types come with each of the ${entryPoints.length} entry points on its own: ${entryPoints.join(", ")}.`,
)

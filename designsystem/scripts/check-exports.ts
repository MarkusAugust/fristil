/**
 * Checks what the package actually contains.
 *
 * Two things go wrong silently here.
 *
 * An incremental `tsc -b` assumes that `tsconfig.tsbuildinfo` tells the
 * truth about what has already been written. If `dist` is deleted without
 * the buildinfo file going with it, the build skips files it thinks exist,
 * and the package can come out with JavaScript but without `.d.ts`. Type
 * safety then disappears silently for the consumer, which is the last thing
 * we want.
 *
 * And `files` in package.json takes whole folders. The test files sat next to
 * the components and went into the tarball, 43 of them.
 *
 * The maps have the same problem the other way round. `tsconfig.json` writes
 * source maps and declaration maps, and each map points at a source file in
 * `src`. `files` included `src/components`, so the components' maps landed,
 * but not `src/index.ts`, `react.ts` or `register.ts`: "go to definition" on
 * `lt` and a stack trace from `/diagnostics` landed in a file that was not
 * included. Every source a shipped map points at must therefore be included
 * too.
 *
 * Run with: bun scripts/check-exports.ts, or as part of `bun run build`.
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { dirname, join as joinPosix, normalize } from "node:path/posix"
import { fileURLToPath } from "node:url"

const pkg = fileURLToPath(new URL("../", import.meta.url))

type Exports = Record<string, string | Record<string, string>>

const manifest = (await Bun.file(join(pkg, "package.json")).json()) as {
  exports: Exports
}

const errors: string[] = []

/** The files npm would put in the tarball. */
async function packageFiles(): Promise<string[]> {
  // `--ignore-scripts` because `npm pack` otherwise runs the package's
  // lifecycle scripts. A build step that packs to check itself would then
  // call itself again without stopping.
  const run = Bun.spawn(
    ["npm", "pack", "--dry-run", "--json", "--ignore-scripts"],
    {
      cwd: pkg,
      stdout: "pipe",
      stderr: "pipe",
    },
  )

  const [output, errorOutput] = await Promise.all([
    new Response(run.stdout).text(),
    new Response(run.stderr).text(),
  ])
  const code = await run.exited

  if (code !== 0) {
    throw new Error(`npm pack exited with code ${code}:\n${errorOutput.trim()}`)
  }

  return firstPackage(JSON.parse(output)).files.map((file) => file.path)
}

type PackResult = { files: { path: string }[] }

/**
 * npm 11 answers with a list holding one result. npm 12 answers with an
 * object keyed by the package name. The publishing workflow always fetches
 * the latest npm, so the script has to accept both forms. When it only
 * accepted the first, the release stopped on "{} is not iterable", and the
 * error pointed at our own code rather than at npm.
 */
function firstPackage(output: unknown): PackResult {
  const results = Array.isArray(output)
    ? output
    : Object.values(output as Record<string, unknown>)
  const [first] = results as PackResult[]

  if (!Array.isArray(first?.files)) {
    throw new Error(
      `Could not read the answer from npm pack: ${JSON.stringify(output).slice(0, 200)}`,
    )
  }

  return first
}

const files = new Set(await packageFiles())

for (const [name, value] of Object.entries(manifest.exports)) {
  const paths = typeof value === "string" ? [value] : Object.values(value)

  for (const path of paths) {
    const relative = path.replace(/^\.\//, "")

    if (!existsSync(join(pkg, path))) {
      errors.push(`${name} → ${path} does not exist`)
    } else if (!files.has(relative)) {
      errors.push(
        `${name} → ${path} exists, but is not included in the package`,
      )
    }
  }
}

/**
 * The sources the maps point at that are not included. The paths from
 * `npm pack` use forward slashes, also on Windows, so they are resolved as
 * POSIX paths.
 */
const sourcesOutside = new Map<string, string>()
for (const path of files) {
  if (!path.endsWith(".map")) continue
  const map = JSON.parse(readFileSync(join(pkg, path), "utf8")) as {
    sources?: string[]
  }
  for (const source of map.sources ?? []) {
    const relative = normalize(joinPosix(dirname(path), source))
    if (!files.has(relative) && !sourcesOutside.has(relative))
      sourcesOutside.set(relative, path)
  }
}

if (sourcesOutside.size > 0) {
  const [source, map] = [...sourcesOutside][0] as [string, string]
  errors.push(
    `${sourcesOutside.size} source files the maps in the package point at are not included, among them ${source} from ${map}. Add the folder to "files" in package.json.`,
  )
}

const testFiles = [...files].filter((path) => path.includes(".test."))

if (testFiles.length > 0) {
  errors.push(
    `${testFiles.length} test files are included in the package, among them ${testFiles[0]}`,
  )
}

if (errors.length > 0) {
  console.error(
    `The package does not match what it promises:\n\n` +
      errors.map((line) => `  ${line}`).join("\n") +
      "\n\nRun `bun run build` again. If that is not enough, delete" +
      " designsystem/tsconfig.tsbuildinfo and try again.\n",
  )
  process.exit(1)
}

console.log(
  `The package ships all ${Object.keys(manifest.exports).length} entry points,` +
    ` in ${files.size} files, without tests, and every map points at an included file.`,
)

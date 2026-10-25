/**
 * Checks that every entry point can be imported on a server, without a DOM,
 * and that registration does nothing there.
 *
 * `HTMLElement` and `customElements` exist only in the browser, and a
 * `class X extends HTMLElement` is evaluated when the module loads. Nine of
 * the entry points therefore stopped with "HTMLElement is not defined" on a
 * server that only wanted `lt.button()`. The main entry point was one of
 * them, which is exactly the line "Getting started" tells the reader to write.
 *
 * No browser test could see it: `HTMLElement` exists there. This one runs in
 * Bun, without a DOM, as an SSR server does.
 *
 * Run by `bun run build`, after `dist` is built.
 */

const packageRoot = new URL("../", import.meta.url)
const manifest = await Bun.file(new URL("package.json", packageRoot)).json()

if (typeof globalThis.HTMLElement !== "undefined") {
  console.error(
    "This check must run without a DOM. HTMLElement exists here, so it proves nothing.",
  )
  process.exit(1)
}

type ExportEntry = string | { import?: string }

const entryPoints = Object.entries(
  manifest.exports as Record<string, ExportEntry>,
)
  .filter(([name]) => !name.endsWith(".css") && name !== "./package.json")
  .map(([name, value]) => [
    name,
    typeof value === "string" ? value : value.import,
  ])
  .filter((pair): pair is [string, string] => typeof pair[1] === "string")

if (entryPoints.length < 20) {
  console.error(
    `Found only ${entryPoints.length} entry points to try. Check the format of exports.`,
  )
  process.exit(1)
}

const failures: string[] = []
const registrations: Array<[string, () => void]> = []

for (const [name, file] of entryPoints) {
  try {
    // The path is turned into a URL. `import()` with a bare file path is not
    // portable: on Windows, ESM reads `C:\…` as a `c:` scheme, and the check
    // would then have reported every single entry point as failing.
    const module = await import(new URL(file, packageRoot).href)

    for (const [exportName, value] of Object.entries(module)) {
      if (exportName.startsWith("defineLt") && typeof value === "function") {
        registrations.push([`${name} → ${exportName}`, value as () => void])
      }
    }
  } catch (error) {
    failures.push(`  ${name}: ${String(error).split("\n")[0]}`)
  }
}

if (failures.length > 0) {
  console.error(
    `These entry points cannot be imported on a server:\n\n${failures.join("\n")}\n`,
  )
  process.exit(1)
}

/*
 * Importing is not enough. `defineLt*` is called from files that in TanStack
 * Start run both on the server and in the browser, and on the server there
 * is no `customElements` to register in. Without this, the `customElements`
 * guard in `defineElement` could disappear without anything saying so.
 */
const registrationFailures: string[] = []

for (const [name, register] of registrations) {
  try {
    register()
  } catch (error) {
    registrationFailures.push(`  ${name}: ${String(error).split("\n")[0]}`)
  }
}

if (registrations.length < 8) {
  console.error(
    `Found only ${registrations.length} registration functions. Expected one per web component.`,
  )
  process.exit(1)
}

if (registrationFailures.length > 0) {
  console.error(
    `These registrations stop on a server:\n\n${registrationFailures.join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `All ${entryPoints.length} entry points can be imported without a DOM, and all ${registrations.length} registrations are silent there.`,
)

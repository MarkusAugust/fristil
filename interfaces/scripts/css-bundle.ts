/**
 * Builds `lotek.css` in memory: every stylesheet in one file, without `@import`.
 *
 * The individual stylesheets fetch their parts with `@import`, and a browser
 * without a build step has to load and read the outer file before it knows
 * they exist. On a mobile network that is a visible delay, and it hit the
 * fields in particular: the municipality field in the game demo had no
 * border or background until the second round trip arrived. The demo
 * preloaded five files by hand to get round it, and a list every consumer
 * has to maintain is not a solution.
 *
 * Here everything is flattened into one file that is linked on its own. A
 * build step uses the stylesheets as before and loads only what it needs;
 * this one is for those who link from a CDN or `node_modules` and would
 * rather have one round trip than a selection.
 *
 * The list is `exports` in `package.json`, not the folder: the entries are
 * the contract, and a new component is included by itself once it has its
 * entry. `tokens.css` goes first, since everything else builds on it, and
 * `boundary.css` last, since it is the only rule without a layer and would
 * otherwise sit in the middle of the file. The Tailwind theme is left out,
 * since it is a `@theme` block for Tailwind and not a stylesheet for a page.
 *
 * Each file is included once, however many import it, and an import that
 * does not exist stops the build rather than disappearing silently.
 * Comments are stripped; they are written for whoever reads the source, and
 * the source is in the package as before.
 *
 * The calculation lives here rather than in `build-css.ts` because two
 * callers need it: `build-css.ts` writes the file, and `agent-parts.ts`
 * states the size in the rulebooks. The size used to be a hard-coded number
 * in the generator, and said 75 kB when the file was 90 kB. `build:css` also
 * runs after `generate` in the package build, so the generator cannot read
 * `dist/lotek.css`.
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

const PACKAGE = fileURLToPath(new URL("../", import.meta.url))

export interface BundledCss {
  /** The whole file, as it is written to `dist/lotek.css`. */
  css: string
  /** Number of CSS entries in `exports` that were read. */
  entries: number
  /** Number of source files included, the `@import`s counted. */
  files: number
  /** Number of `@import`s flattened. */
  imports: number
}

export function buildBundledCss(): BundledCss {
  const manifest = JSON.parse(
    readFileSync(join(PACKAGE, "package.json"), "utf8"),
  )
  const version: string = manifest.version
  const exports: Record<string, string | Record<string, string>> =
    manifest.exports

  const entries = Object.entries(exports)
    .filter(
      ([name, path]) =>
        name.endsWith(".css") &&
        typeof path === "string" &&
        name !== "./tailwind.css" &&
        name !== "./lotek.css",
    )
    .map(([name, path]) => ({ name, file: resolve(PACKAGE, path as string) }))
    .sort((a, b) => {
      if (a.name === "./tokens.css") return -1
      if (b.name === "./tokens.css") return 1
      if (a.name === "./boundary.css") return 1
      if (b.name === "./boundary.css") return -1
      return a.name.localeCompare(b.name)
    })

  if (entries.length === 0) throw new Error("found no CSS entries in exports")

  const taken = new Set<string>()
  const parts: string[] = []
  let imports = 0

  function take(file: string, from: string | null): void {
    if (taken.has(file)) return
    if (!existsSync(file)) {
      const where = from ? ` (imported from ${relative(PACKAGE, from)})` : ""
      throw new Error(`${relative(PACKAGE, file)} does not exist${where}`)
    }
    taken.add(file)

    // Comments first, so an `@import` inside a comment is not fetched. They
    // are for whoever reads the source, and there are many: without them the
    // file is less than half the size. The source files are in the package
    // as before.
    const withoutComments = readFileSync(file, "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    )

    // The imports, as the browser would read them: what they define has to
    // be there before the file itself. Only the simple form is recognised;
    // an `@import` with a layer or media list is left in place, and the
    // guard below fails on it.
    const without = withoutComments.replace(
      /^\s*@import\s+(?:url\()?["']([^"']+)["']\)?\s*;[ \t]*$/gm,
      (_, path: string) => {
        imports += 1
        take(resolve(dirname(file), path), file)
        return ""
      },
    )

    const tidied = without.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")
    parts.push(`/* ${relative(PACKAGE, file)} */\n${tidied.trim()}\n`)
  }

  for (const { file } of entries) take(file, null)

  const header = [
    `/* @lo-tek/interfaces ${version}. Every stylesheet in one file, without @import,`,
    " * for those who link from a CDN or node_modules. A build step uses the",
    " * stylesheets. Generated by scripts/build-css.ts; edit the sources, not this. */",
    "",
  ].join("\n")

  const css = header + parts.join("\n")

  /*
   * The guard counts what is actually in the result, not what the script
   * thinks it did. Every source file wraps everything in `@layer lotek { … }`,
   * so the number of such blocks in the output must be the number of files
   * taken. One fewer is a file that was fetched without being included, or a
   * source file without a layer; the latter would make consumers' rules lose
   * to ours. And no `@import` may remain, not even an indented one or one
   * with a layer.
   */
  const remaining = css.match(/^\s*@import\b.*$/gm) ?? []
  if (remaining.length > 0)
    throw new Error(
      `lotek.css still has @import: ${remaining[0]?.trim() ?? ""}`,
    )

  /*
   * The boundary towards a host page is the one file without a layer, on
   * purpose; see `boundary.css`. It is subtracted by name, so another file
   * without a layer still fails the guard.
   */
  const withoutLayer = [...taken].filter((file) =>
    file.endsWith(join("src", "tokens", "boundary.css")),
  ).length
  const layers = (css.match(/^@layer lotek \{/gm) ?? []).length
  if (layers !== taken.size - withoutLayer || taken.size < entries.length)
    throw new Error(
      `lotek.css has ${layers} @layer lotek blocks, but ${taken.size} files were taken from ${entries.length} entries`,
    )

  return { css, entries: entries.length, files: taken.size, imports }
}

/**
 * The size of the bundled file, in whole kB, uncompressed and with gzip.
 *
 * `Buffer.byteLength` and not `String.length`: the latter counts UTF-16 code
 * units, and the file has characters outside ASCII. And kB is a thousand
 * bytes, which is the unit a network tab shows; `/1024` is KiB, and was
 * labelled kB here.
 *
 * The numbers are rounded to whole kB because the gzip result depends on
 * which zlib runs: 11 163 bytes in Bun, 11 474 in Node and 11 482 with `gzip`
 * on the command line. A number with a decimal would say three different
 * things about the same file. Rounding only makes them agree as long as they
 * fall within the same half kB, and Node's number is 26 bytes from tipping
 * to 12; the generator always runs under Bun, so Bun's number is the one in
 * the files.
 */
export function bundledSize(css: string): { kb: number; gzipKb: number } {
  const bytes = Buffer.byteLength(css)
  return {
    kb: Math.round(bytes / 1000),
    gzipKb: Math.round(gzipSync(css).length / 1000),
  }
}

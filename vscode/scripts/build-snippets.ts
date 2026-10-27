/**
 * Writes `dist/lotek.code-snippets` from the package's `snippets.json`.
 *
 * The snippets are contributed as one global snippet file, without a
 * `language` in the manifest, and each snippet carries a `scope` with the
 * language ids it applies in. A contribution with a `language` VS Code does
 * not know is an error in the extension's runtime status, "Unknown language
 * in contributes.interfaces.language", one per template language no
 * installed extension registers (VS Code puts the extension's `name` there,
 * `interfaces`, not the name of the contribution point); a `scope` is matched at the time of the
 * completion and never validated. The list of ids is the default of the
 * `lotek.languages` setting, read from the manifest so the two cannot
 * drift apart.
 *
 * Documented: `scope` in a global `.code-snippets` file, "takes one or more
 * language identifiers, which makes the snippet available only for those
 * specified languages",
 * https://code.visualstudio.com/docs/editing/userdefinedsnippets
 *
 * Undocumented: that an extension may leave out `language` in
 * `contributes.snippets` when the path ends in `.code-snippets`. The page on
 * contribution points shows `language` in every example and says nothing
 * about leaving it out,
 * https://code.visualstudio.com/api/references/contribution-points#contributes.snippets.
 * It is in VS Code's source, in the snippets extension point, with the
 * message "When omitting the language, the value of `contributes.{0}.path`
 * must be a `.code-snippets`-file", checked in the 1.90 workbench bundle.
 * `test/suite.cjs` proves it in the lowest supported version on every run,
 * and `vscode-stable.yml` in the newest once a week.
 *
 * Run by `bun run build` in this folder.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const extensionDir = fileURLToPath(new URL("..", import.meta.url))

type Snippet = { prefix: string; body: string[]; description: string }

const manifest = JSON.parse(
  readFileSync(join(extensionDir, "package.json"), "utf8"),
) as {
  contributes: {
    configuration: { properties: { "lotek.languages": { default: string[] } } }
  }
}
const languages =
  manifest.contributes.configuration.properties["lotek.languages"].default
if (languages.length === 0) throw new Error("lotek.languages has no default")

const snippets = JSON.parse(
  readFileSync(join(extensionDir, "../interfaces/snippets.json"), "utf8"),
) as Record<string, Snippet>
if (Object.keys(snippets).length === 0)
  throw new Error("snippets.json has no snippets")

// A snippet is an object with exactly these keys. A scope of its own would be
// widened to every language of the default below without a word, and any
// other key would pass into the snippet file unchecked, so the build stops,
// and says which snippet and what is wrong with it.
const KEYS = ["body", "description", "prefix"]
const problems = Object.entries(snippets as Record<string, unknown>).flatMap(
  ([name, s]) => {
    if (typeof s !== "object" || s === null || Array.isArray(s))
      return [`${name} is not an object`]
    const keys = Object.keys(s)
    const extra = keys.filter((k) => !KEYS.includes(k))
    const missing = KEYS.filter((k) => !keys.includes(k))
    return [
      ...(extra.length ? [`${name} has ${extra.join(", ")}`] : []),
      ...(missing.length ? [`${name} lacks ${missing.join(", ")}`] : []),
    ]
  },
)
if (problems.length > 0)
  throw new Error(
    `snippets.json: every snippet must be an object with exactly ${KEYS.join(", ")}. ${problems.join("; ")}`,
  )

const scoped = Object.fromEntries(
  Object.entries(snippets).map(([name, snippet]) => [
    name,
    { ...snippet, scope: languages.join(",") },
  ]),
)
mkdirSync(join(extensionDir, "dist"), { recursive: true })
writeFileSync(
  join(extensionDir, "dist/lotek.code-snippets"),
  `${JSON.stringify(scoped, null, 2)}\n`,
)

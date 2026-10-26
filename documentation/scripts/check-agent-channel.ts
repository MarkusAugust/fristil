/**
 * That the rulebooks also exist on the website, and that they are the same.
 *
 * The channel exists for the agent that has no `node_modules`: if someone is
 * asked to "make a form with LO-TEK" in an empty folder, the markup is written
 * before `npm install` has run. Two channels with the same content are only an
 * advantage as long as they actually are the same, and nobody would have
 * noticed a route that silently stopped being built until an agent fetched a
 * 404.
 *
 * Run with: bun documentation/scripts/check-agent-channel.ts
 * Requires `documentation/dist` to be built.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const PACKAGE = `${ROOT}interfaces/agent/`
const SITE = `${ROOT}documentation/dist/agent/`

const problems: string[] = []

const books = readdirSync(PACKAGE).filter((file) => file.endsWith(".md"))

if (books.length === 0) problems.push("interfaces/agent/ has no rulebooks")

for (const file of books) {
  let onSite: string | null = null

  try {
    onSite = readFileSync(`${SITE}${file}`, "utf8")
  } catch {
    problems.push(
      `/agent/${file} was not built. The route is src/pages/agent/[name].md.ts`,
    )
    continue
  }

  if (onSite !== readFileSync(`${PACKAGE}${file}`, "utf8"))
    problems.push(`/agent/${file} is not the same as the package's`)
}

/*
 * The build must be newer than the routes and the rulebooks.
 *
 * `test:docs` does not build by itself, and can be run alone. Without this a
 * deleted route or a changed rulebook could pass on the previous build, which
 * is exactly the run that looks green without having looked at anything.
 */
const build = `${ROOT}documentation/dist/llms.txt`
const sources = [
  `${ROOT}documentation/src/pages/llms.txt.ts`,
  `${ROOT}documentation/src/pages/agent/[name].md.ts`,
  ...books.map((file) => `${PACKAGE}${file}`),
]

try {
  const age = statSync(build).mtimeMs
  const newer = sources.filter((source) => statSync(source).mtimeMs > age)

  if (newer.length > 0) {
    problems.push(
      `documentation/dist is older than ${newer.length} of the sources. Run bun run build.`,
    )
  }
} catch {
  // If the build is missing, that is reported below.
}

// `llms.txt` is the entry point. It must mention every rulebook, and the four
// rules.
let llms = ""

try {
  llms = readFileSync(build, "utf8")
} catch {
  problems.push("llms.txt was not built. The route is src/pages/llms.txt.ts")
}

/*
 * An empty file is not a file that matches. The condition was `llms !== ""`,
 * and an `llms.txt` of zero bytes would then have skipped every content check
 * and reported green: a condition that switches the check off.
 */
if (llms.trim() === "") {
  problems.push("llms.txt is empty")
} else {
  for (const file of books) {
    if (!llms.includes(`/agent/${file}`))
      problems.push(`llms.txt does not link to /agent/${file}`)
  }

  for (const part of ["lt-modal", "var(--lt-color-", "defineLt", "check"]) {
    if (!llms.includes(part)) problems.push(`llms.txt does not mention ${part}`)
  }
}

/*
 * The page list in `llms.txt` can vanish silently.
 *
 * It is built from `getCollection("docs")`, and `section()` returns an empty
 * string for an empty list, which `.filter(Boolean)` removes. If the
 * collection becomes empty, because it is renamed or the content folder is
 * moved, `llms.txt` comes out without Guides, Patterns and Components, and
 * everything else in this guard is still green.
 *
 * The count is therefore checked against a plain walk of the content folder,
 * that is, a different mechanism from the one that built the list.
 */
function countPages(folder: string): number {
  let count = 0

  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countPages(`${folder}/${entry.name}`)
    else if (/\.mdx?$/.test(entry.name)) count += 1
  }

  return count
}

/*
 * The 404 page is a document in the content folder, but not a page an agent
 * reads: it gets no Markdown version, so `llms.txt` leaves it out.
 */
const NOT_LISTED = ["404.mdx"]

if (llms.trim() !== "") {
  const pages =
    countPages(`${ROOT}documentation/src/content/docs`) - NOT_LISTED.length
  // The pages link to the Markdown version, and the rulebooks under
  // `/agent/` are not pages.
  const links = [
    ...llms.matchAll(/^- \[[^\]]+\]\((https:\/\/[^)]+\.md)\)/gm),
  ].filter(([, address]) => !address.includes("/agent/"))

  if (links.length !== pages) {
    problems.push(
      `llms.txt links to ${links.length} pages, while the content folder has ${pages}.`,
    )
  }

  /*
   * A count that matches says nothing about where the links go. The 404 page
   * was once listed with a link to `/404.md`, which is never written, and the
   * count above passed because it counted the same page. Every link must
   * therefore be a file in the build.
   */
  const BASE_ADDRESS = /^https:\/\/[^/]+\//
  for (const [, address] of links) {
    const file = `${ROOT}documentation/dist/${address.replace(BASE_ADDRESS, "")}`
    try {
      statSync(file)
    } catch {
      problems.push(`llms.txt links to ${address}, which is not in the build`)
    }
  }
}

if (problems.length > 0) {
  console.error(
    `The channel for coding agents does not match:\n\n${problems
      .map((line) => `  ${line}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `The rulebooks exist on the website too: llms.txt and ${books.length} files, identical to the package's.`,
)

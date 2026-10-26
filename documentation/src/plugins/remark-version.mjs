/**
 * Puts the package version into the documentation, from one source.
 *
 * The CDN addresses in the examples have to point at a version that exists,
 * and they were written by hand in 74 places across 12 files. Every release
 * meant changing all 74, and one that was forgotten would have sent the reader
 * to an old package without anything saying so. Now the placeholder
 * `@lo-tek/interfaces@VERSION` is in the source, and the version is read from
 * `interfaces/package.json` when the site is built.
 *
 * `check-documentation.ts` fails if someone writes the number by hand anyway.
 *
 * The placeholder is replaced in code blocks, in inline code, in body text and
 * in link addresses. That covers every address today.
 *
 * What it does not reach are values outside `children`: JSX attributes such as
 * `code={…}`, image addresses, mdx expressions and frontmatter. If someone
 * writes an address in such a place, the placeholder stays, and
 * `check-built-version.ts` catches it: it requires every address the
 * placeholder appears in to exist in the build with the version filled in.
 */

import { readFileSync } from "node:fs"

const PLACEHOLDER = "@lo-tek/interfaces@VERSION"

const { version } = JSON.parse(
  readFileSync(new URL("../../../interfaces/package.json", import.meta.url)),
)

const WITH_VERSION = `@lo-tek/interfaces@${version}`

// The tarball in the npm registry, for anyone fetching the package without npm.
const TARBALL = "interfaces-VERSION.tgz"

/*
 * The Maven coordinates and the WebJar path on the Kotlin page have the same
 * version as the npm package, and were written as `{versjon}` in the source,
 * which the reader saw literally. The word VERSION is replaced where it comes
 * right after `markusaugust:lo-tek-interfaces:`, `markusaugust.lotek") version "`
 * and `webjars/lo-tek/`, and nowhere else. `check-built-version.ts` requires
 * each of the three to appear with the version in the build, and none of them
 * to be left with the placeholder.
 */
const MAVEN = [
  [
    "io.github.markusaugust:lo-tek-interfaces:VERSION",
    `io.github.markusaugust:lo-tek-interfaces:${version}`,
  ],
  [
    'io.github.markusaugust.lo-tek") version "VERSION"',
    `io.github.markusaugust.lo-tek") version "${version}"`,
  ],
  ["webjars/lo-tek/VERSION/", `webjars/lo-tek/${version}/`],
]

const replaceVersion = (text) => {
  if (typeof text !== "string") return text
  let out = text
    .split(PLACEHOLDER)
    .join(WITH_VERSION)
    .split(TARBALL)
    .join(`interfaces-${version}.tgz`)
  for (const [from, to] of MAVEN) out = out.split(from).join(to)
  return out
}

export function remarkVersion() {
  return (tree) => visit(tree)
}

function visit(node) {
  if (
    node.type === "code" ||
    node.type === "inlineCode" ||
    node.type === "text"
  )
    node.value = replaceVersion(node.value)

  if (node.type === "link" || node.type === "definition")
    node.url = replaceVersion(node.url)

  for (const child of node.children ?? []) visit(child)
}

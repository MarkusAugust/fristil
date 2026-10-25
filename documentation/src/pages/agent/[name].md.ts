/**
 * The rulebooks as files on the website, at a stable address.
 *
 * The most important agent has no `node_modules`. If someone is asked to "make
 * a form with LO-TEK" in an empty folder, the markup is written before
 * `npm install` has run, and the rulebook in the package is then invisible.
 * That is why the same files are here, at `/agent/<name>.md`, fetchable with
 * web access alone.
 *
 * The files are loaded with `import.meta.glob`, which Vite resolves when the
 * site is built, rather than with `readFileSync` and a relative path. A path
 * computed from `import.meta.url` points at the chunk after bundling, not at
 * the source, and only worked because the number of folders up happened to be
 * the same. Here there is no path to get wrong, and the content is the same as
 * the package ships: one source, two channels.
 */

import type { APIRoute, GetStaticPaths } from "astro"

const BOOKS = import.meta.glob("../../../../interfaces/agent/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

const nameOf = (path: string) => path.replace(/^.*\/|\.md$/g, "")

export const getStaticPaths: GetStaticPaths = () =>
  Object.keys(BOOKS).map((path) => ({ params: { name: nameOf(path) } }))

export const GET: APIRoute = ({ params }) => {
  const path = Object.keys(BOOKS).find(
    (candidate) => nameOf(candidate) === params.name,
  )

  if (!path) return new Response("Not found", { status: 404 })

  return new Response(BOOKS[path], {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  })
}

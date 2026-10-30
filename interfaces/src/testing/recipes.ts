/**
 * Reading the recipes on the component pages: the tabs, the HTML blocks in
 * them, and the stylesheets they link.
 *
 * Three scripts read the same pages: `generate-vocabulary.ts` for the
 * snippets, `check-accessibility-tree.ts` for its fixtures and
 * `documentation/scripts/check-recipes.ts` for the check of the recipes.
 * They used to parse the pages each in their own way, and a page that one of
 * them read differently from the others would have gone unnoticed.
 */
/** The tabs on a page, `<TabItem label="…">`, with what is inside them. */
export function tabItems(mdx: string): Array<{ name: string; code: string }> {
  return [
    ...mdx.matchAll(
      /<TabItem\b[^>]*?\slabel="([^"]+)"[^>]*>([\s\S]*?)<\/TabItem>/g,
    ),
  ].map((m) => ({ name: m[1], code: m[2] }))
}

/** The fenced HTML blocks in a text, as written, with their indentation. */
export function htmlBlocks(text: string): string[] {
  return [...text.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1])
}

/** A block without the indentation it has inside a tab, and without trailing space. */
export function dedent(block: string): string {
  const lines = block.replace(/\s+$/, "").split("\n")
  const indent = Math.min(
    ...lines
      .filter((l) => l.trim())
      .map((l) => (l.match(/^[ \t]*/)?.[0] ?? "").length),
  )
  return lines.map((l) => l.slice(indent)).join("\n")
}

/** The package address in the examples. `remark-version.mjs` fills in the version. */
export const VERSION_PLACEHOLDER = "@lo-tek/interfaces@VERSION"

/** Where the examples load the package from, with the placeholder. */
export const CDN = `https://cdn.jsdelivr.net/npm/${VERSION_PLACEHOLDER}/`

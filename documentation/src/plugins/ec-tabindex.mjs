/**
 * Gives every code block keyboard access in the HTML, not only once a script
 * has run.
 *
 * Expressive Code sets `tabindex="0"` and `role="region"` on a `<pre>` that
 * can scroll, and removes them from one that cannot. The script `ec.*.js` does
 * this after a `ResizeObserver` has reported, a 250 ms pause and a
 * `requestIdleCallback` with no timeout. Until then a block wider than the
 * column cannot be reached with the keyboard, and without JavaScript it never
 * can.
 *
 * Once in CI (5 October 2026, `/introduction/`, light theme) none of the four
 * blocks on the page had got `tabindex` after 20 seconds. Locally it came
 * within 300 ms, even with the CPU throttled 30 times, and the cause has not
 * been found.
 *
 * Here both attributes are set on every block when the site is built, and the
 * script removes them where the block fits. It is the same pattern the tables
 * follow, see `rehype-table-scroll.mjs`: the access is in the markup, and the
 * script clears away what is not needed.
 */
export function ecTabindex() {
  return {
    name: "lotek-ec-tabindex",
    hooks: {
      postprocessRenderedBlock: ({ renderData }) => {
        besok(renderData.blockAst)
      },
    },
  }
}

function besok(node) {
  if (node.type === "element" && node.tagName === "pre") {
    node.properties ??= {}
    node.properties.tabindex = "0"
    node.properties.role = "region"
    return
  }
  for (const barn of node.children ?? []) besok(barn)
}

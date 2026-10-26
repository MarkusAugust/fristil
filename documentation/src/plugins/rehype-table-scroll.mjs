/**
 * Puts a scroll container around every table in the documentation.
 *
 * A table with three columns and code in the cells gets wider than a phone.
 * The first attempt was to let long words break, but then `<lt-error-summary>`
 * breaks in the middle of the tag, and the row becomes four lines tall with a
 * code background on every piece. It looks broken, and is harder to read than
 * dragging the table sideways.
 *
 * This is what we ask consumers to do with `.lt-table-scroll`, and we follow
 * the same recipe: `tabindex` so the keyboard can reach the columns beyond the
 * edge, and `role="region"` with a text, so the screen reader says which table
 * focus has landed in. The text is taken from the heading the table sits
 * under, since markdown tables have no `<caption>`.
 *
 * MarkdownContent.astro removes all three again for the tables that fit. A
 * table that does not scroll is neither a tab stop nor a region of its own in
 * the screen reader's list.
 */
export function rehypeTableScroll() {
  return (tree) => {
    visit(tree, { heading: "" })
  }

  function visit(node, state) {
    if (!node.children) return

    node.children = node.children.map((child) => {
      if (child.type === "element" && /^h[1-6]$/.test(child.tagName)) {
        state.heading = textIn(child)
      }

      visit(child, state)

      if (child.type !== "element" || child.tagName !== "table") return child

      return {
        type: "element",
        tagName: "div",
        properties: {
          className: ["table-scroll"],
          tabIndex: 0,
          role: "region",
          ariaLabel: state.heading ? `Table: ${state.heading}` : "Table",
        },
        children: [child],
      }
    })
  }
}

/** The text in a node, without the links Starlight adds to headings. */
function textIn(node) {
  if (node.type === "text") return node.value
  if (!node.children) return ""

  return node.children
    .map((child) => textIn(child))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
}

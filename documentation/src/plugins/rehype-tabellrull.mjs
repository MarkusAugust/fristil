/**
 * Legger et rullefelt rundt hver tabell i dokumentasjonen.
 *
 * En tabell med tre kolonner og kodeord i cellene blir bredere enn en
 * telefon. Det første forsøket var å la lange ord brekke, men da brekker
 * `<fs-error-summary>` midt i taggen, og raden blir fire linjer høy med
 * kodebakgrunn på hver bit. Det ser ødelagt ut, og er vanskeligere å lese
 * enn å dra tabellen sidelengs.
 *
 * Dette er det samme vi ber konsumenter om å gjøre med `.fs-table-scroll`.
 * `tabindex` er ikke valgfri: uten den kommer ingen som navigerer med
 * tastatur til kolonnene utenfor kanten. MarkdownContent.astro tar den bort
 * igjen for de tabellene som får plass, slik at de ikke blir tabbstopp uten
 * grunn.
 */
export function rehypeTabellrull() {
  return (tre) => {
    besok(tre)
  }

  function besok(node) {
    if (!node.children) return

    node.children = node.children.map((barn) => {
      besok(barn)

      if (barn.type !== "element" || barn.tagName !== "table") return barn

      return {
        type: "element",
        tagName: "div",
        properties: { className: ["tabell-rull"], tabIndex: 0 },
        children: [barn],
      }
    })
  }
}

/**
 * Legger et rullefelt rundt hver tabell i dokumentasjonen.
 *
 * En tabell med tre kolonner og kodeord i cellene blir bredere enn en
 * telefon. Det første forsøket var å la lange ord brekke, men da brekker
 * `<fs-error-summary>` midt i taggen, og raden blir fire linjer høy med
 * kodebakgrunn på hver bit. Det ser ødelagt ut, og er vanskeligere å lese
 * enn å dra tabellen sidelengs.
 *
 * Dette er det samme vi ber konsumenter om å gjøre med `.fs-table-scroll`,
 * og vi følger den samme oppskriften: `tabindex` for at tastaturet skal nå
 * kolonnene utenfor kanten, og `role="region"` med en tekst, slik at
 * skjermleseren sier hvilken tabell fokus har havnet i. Teksten hentes fra
 * overskriften tabellen står under, siden markdown-tabeller ikke har
 * `<caption>`.
 *
 * MarkdownContent.astro tar alle tre bort igjen for de tabellene som får
 * plass. En tabell som ikke ruller skal verken være et tabbstopp eller et
 * eget område i skjermleserens liste.
 */
export function rehypeTabellrull() {
  return (tre) => {
    besok(tre, { overskrift: "" })
  }

  function besok(node, tilstand) {
    if (!node.children) return

    node.children = node.children.map((barn) => {
      if (barn.type === "element" && /^h[1-6]$/.test(barn.tagName)) {
        tilstand.overskrift = tekstIn(barn)
      }

      besok(barn, tilstand)

      if (barn.type !== "element" || barn.tagName !== "table") return barn

      return {
        type: "element",
        tagName: "div",
        properties: {
          className: ["tabell-rull"],
          tabIndex: 0,
          role: "region",
          ariaLabel: tilstand.overskrift
            ? `Tabell: ${tilstand.overskrift}`
            : "Tabell",
        },
        children: [barn],
      }
    })
  }
}

/** Teksten i en node, uten lenkene Starlight legger på overskrifter. */
function tekstIn(node) {
  if (node.type === "text") return node.value
  if (!node.children) return ""

  return node.children
    .map((barn) => tekstIn(barn))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
}

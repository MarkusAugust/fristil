/**
 * Gir hvert kodefelt tastaturtilgang i HTML-en, ikke først når et skript
 * har kjørt.
 *
 * Expressive Code setter `tabindex="0"` og `role="region"` på en `<pre>` som
 * kan rulles, og tar dem bort fra en som ikke kan det. Det gjør skriptet
 * `ec.*.js` etter at en `ResizeObserver` har meldt fra, en pause på 250 ms og
 * en `requestIdleCallback` uten frist. Til da kan et felt som er bredere enn
 * spalten ikke nås med tastaturet, og uten JavaScript kan det aldri nås.
 *
 * Én gang i CI (5. oktober 2026, `/introduksjon/`, lyst tema) hadde ingen av
 * de fire feltene på siden fått `tabindex` etter 20 sekunder. Lokalt kom den
 * innen 300 ms, også med 30 ganger strupet CPU, og årsaken er ikke funnet.
 *
 * Her settes begge attributtene på hvert felt når siden bygges, og skriptet
 * tar dem bort der feltet får plass. Det er det samme mønsteret som
 * tabellene følger, se `rehype-tabellrull.mjs`: tilgangen står i markupen, og
 * skriptet rydder bort det som ikke trengs.
 */
export function ecTabindex() {
  return {
    name: "fristil-ec-tabindex",
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

/**
 * Renders `share-card.html` to `public/og.png`, the image a shared link shows.
 *
 * This does not run in the build. The image is committed, and this is what
 * you run when the card has to change: a new name, a new category, another
 * line. `check-share-card.ts` requires the file to exist, be a PNG and be
 * 1200 × 630.
 *
 *   bun documentation/scripts/share-card.ts
 *
 * The browser is the same Playwright Chromium the tests use, fetched with
 * `bun --filter @lo-tek/interfaces browsers`. The card uses the site's own
 * fonts and mark, from `src/styles/profile.css` and `src/mark.mjs`, and the
 * screenshot waits for the fonts.
 */

import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { COLOURS, EDGE, INK, SCAN_LINES, VIEW_BOX } from "../src/mark.mjs"

const HERE = fileURLToPath(new URL(".", import.meta.url))
// A real file URL, so a space or a `#` in the checkout path is escaped.
const CARD = new URL("share-card.html", import.meta.url).href
const OUT = `${HERE}../public/og.png`

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
})
await page.goto(CARD)
await page.evaluate(
  ({ colours, edge, ink, scanLines, viewBox }) => {
    const mark = document.querySelector("svg.mark")
    if (!mark) throw new Error("share-card.html has no svg.mark")
    mark.setAttribute("viewBox", viewBox)
    mark.innerHTML = [
      [colours.edge, edge],
      [colours.shadow, scanLines],
      [colours.ink, ink],
    ]
      .map(([fill, d]) => `<path fill="${fill}" d="${d}" />`)
      .join("")
  },
  {
    colours: COLOURS,
    edge: EDGE,
    ink: INK,
    scanLines: SCAN_LINES,
    viewBox: VIEW_BOX,
  },
)
// The faces load when text first asks for them, so ask for each before
// waiting, or the screenshot can catch a fallback.
await page.evaluate(async () => {
  await Promise.all([
    document.fonts.load('400 104px "Michroma"'),
    document.fonts.load('400 20px "IBM Plex Mono"'),
    document.fonts.load('500 20px "IBM Plex Mono"'),
  ])
  await document.fonts.ready
})
await page.screenshot({ path: OUT, type: "png" })
await browser.close()

const png = await Bun.file(OUT).arrayBuffer()
const width = new DataView(png).getUint32(16)
const height = new DataView(png).getUint32(20)
if (width !== 1200 || height !== 630) {
  throw new Error(`og.png came out ${width} × ${height}, not 1200 × 630`)
}
console.log(`Wrote public/og.png (${Math.round(png.byteLength / 1024)} kB)`)

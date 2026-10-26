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
 * `bun --filter @lo-tek/interfaces browsers`. The card loads two web fonts,
 * so the screenshot waits for them; with `display=block` they are never drawn
 * in a fallback face.
 */

import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const CARD = `file://${HERE}share-card.html`
const OUT = `${HERE}../public/og.png`

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
})
await page.goto(CARD)
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: OUT, type: "png" })
await browser.close()

const png = await Bun.file(OUT).arrayBuffer()
const width = new DataView(png).getUint32(16)
const height = new DataView(png).getUint32(20)
if (width !== 1200 || height !== 630) {
  throw new Error(`og.png came out ${width} × ${height}, not 1200 × 630`)
}
console.log(`Wrote public/og.png (${Math.round(png.byteLength / 1024)} kB)`)

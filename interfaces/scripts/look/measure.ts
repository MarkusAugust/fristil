/**
 * Measures the look page in Chromium, Firefox and WebKit.
 *
 * For each engine: launch, load the sheet with three versions, run the
 * computed-style diff five times, then mutate button.css on disk (padding)
 * and time the hot swap from the WebSocket message to the diff result.
 * Pixels are compared between the frames in the same page, before and after
 * the mutation, to check the claim: equal style and geometry gives equal
 * pixels, and a visible change shows in both.
 *
 * Starts look.ts itself. Restores button.css afterwards.
 */
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  type Browser,
  type BrowserType,
  chromium,
  firefox,
  type Page,
  webkit,
} from "playwright"

const PACKAGE = resolve(import.meta.dir, "../..")
const BUTTON_CSS = resolve(PACKAGE, "src/components/css/button/button.css")
const PORT = 4196
const URL = `http://127.0.0.1:${PORT}/sheet/button`

const server = Bun.spawn(["bun", resolve(import.meta.dir, "look.ts")], {
  env: { ...process.env, LOOK_PORT: String(PORT) },
  stdout: "pipe",
  stderr: "inherit",
})
const serverStarted = performance.now()
await new Promise<void>((done) => {
  const reader = server.stdout.getReader()
  const read = async () => {
    const { value } = await reader.read()
    if (value && new TextDecoder().decode(value).includes("look:")) done()
    else read()
  }
  read()
})
const serverReadyMs = performance.now() - serverStarted
server.exited.then((code) => {
  if (rows.length === 0) {
    console.error(`look.ts exited with ${code}`)
    process.exit(1)
  }
})

const original = await readFile(BUTTON_CSS, "utf8")
const mutated = original.replace(
  "padding: var(--lt-button-padding, var(--lt-spacing-2) var(--lt-spacing-4));",
  "padding: var(--lt-button-padding, var(--lt-spacing-3) var(--lt-spacing-4));",
)
if (mutated === original) throw new Error("The mutation did not apply")

type DiffResult = {
  againstMaster: { key: string; from: string; to: string }[]
  againstReleased: { key: string; from: string; to: string }[]
  keys: number
  snapshotMs: number
  totalMs: number
  swapToDiffMs?: number
}

/** Differing pixels between two frames' sheets, decoded in the page. */
async function pixelDifference(
  page: Page,
  a: string,
  b: string,
): Promise<{ pixels: number; total: number; ms: number }> {
  const t0 = performance.now()
  const [imageA, imageB] = await Promise.all(
    [a, b].map((v) =>
      page
        .frameLocator(`#frame-${v}`)
        .locator("#sheet")
        .screenshot({ animations: "disabled" }),
    ),
  )
  const shot = performance.now() - t0
  const result = await page.evaluate(
    async ([pngA, pngB]) => {
      const decode = async (base64: string) => {
        const image = new Image()
        image.src = `data:image/png;base64,${base64}`
        await image.decode()
        const canvas = document.createElement("canvas")
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext("2d")
        if (!context) throw new Error("no canvas")
        context.drawImage(image, 0, 0)
        return context.getImageData(0, 0, image.width, image.height).data
      }
      const [da, db] = await Promise.all([decode(pngA), decode(pngB)])
      if (da.length !== db.length) return { pixels: -1, total: da.length / 4 }
      let pixels = 0
      for (let i = 0; i < da.length; i += 4) {
        if (
          da[i] !== db[i] ||
          da[i + 1] !== db[i + 1] ||
          da[i + 2] !== db[i + 2] ||
          da[i + 3] !== db[i + 3]
        )
          pixels++
      }
      return { pixels, total: da.length / 4 }
    },
    [imageA.toString("base64"), imageB.toString("base64")],
  )
  return { ...result, ms: performance.now() - t0, shotMs: shot } as {
    pixels: number
    total: number
    ms: number
  }
}

type Row = Record<string, string | number>
const rows: Row[] = []

async function measure(name: string, type: BrowserType): Promise<void> {
  const t0 = performance.now()
  const browser: Browser = await type.launch({ headless: true })
  const launchMs = performance.now() - t0
  try {
    const page = await browser.newPage({
      viewport: { width: 1720, height: 900 },
    })
    const t1 = performance.now()
    await page.goto(URL, { waitUntil: "commit" })
    await page.waitForFunction(
      () => (window as unknown as { lookReady?: boolean }).lookReady === true,
    )
    const loadMs = performance.now() - t1

    // The computed-style diff, five times; the first is cold.
    const diffs: DiffResult[] = []
    for (let i = 0; i < 5; i++)
      diffs.push(
        await page.evaluate(() =>
          (window as unknown as { lookDiff: () => DiffResult }).lookDiff(),
        ),
      )
    const clean = diffs[4]
    const diffMedianMs = [...diffs.slice(1)]
      .map((d) => d.totalMs)
      .sort((a, b) => a - b)[1]

    // Pixels on the clean sheet: branch vs master should be identical.
    const cleanPixels = await pixelDifference(page, "branch", "master")

    // Mutate button.css on disk and wait for the page to swap and diff.
    const swapped = page.evaluate(
      () =>
        new Promise<DiffResult>((done) => {
          document.addEventListener(
            "look-swapped",
            (e) => done((e as CustomEvent<DiffResult>).detail),
            { once: true },
          )
        }),
    )
    const tWrite = performance.now()
    await writeFile(BUTTON_CSS, mutated)
    const afterSwap = await swapped
    const saveToDiffMs = performance.now() - tWrite
    const mutatedPixels = await pixelDifference(page, "branch", "master")

    // Restore, and wait for the swap back.
    const restored = page.evaluate(
      () =>
        new Promise<DiffResult>((done) => {
          document.addEventListener(
            "look-swapped",
            (e) => done((e as CustomEvent<DiffResult>).detail),
            { once: true },
          )
        }),
    )
    await writeFile(BUTTON_CSS, original)
    const back = await restored

    rows.push({
      engine: name,
      "launch ms": launchMs.toFixed(0),
      "load ms": loadMs.toFixed(0),
      values: clean.keys,
      "diff cold ms": diffs[0].totalMs.toFixed(1),
      "diff warm ms": diffMedianMs.toFixed(1),
      "clean vs master": clean.againstMaster.length,
      "clean vs released": clean.againstReleased.length,
      "clean pixels": `${cleanPixels.pixels}/${cleanPixels.total}`,
      "pixel compare ms": cleanPixels.ms.toFixed(0),
      "mutated vs master": afterSwap.againstMaster.length,
      "swap to diff ms": (afterSwap.swapToDiffMs ?? Number.NaN).toFixed(1),
      "save to diff ms": saveToDiffMs.toFixed(0),
      "mutated pixels": `${mutatedPixels.pixels}/${mutatedPixels.total}`,
      "restored vs master": back.againstMaster.length,
    })
    const sample = afterSwap.againstMaster
      .filter((d) => !d.key.includes("|rect"))
      .slice(0, 4)
    console.log(`${name}: first style differences after the mutation:`)
    for (const d of sample) console.log(`  ${d.key}: ${d.from} -> ${d.to}`)
    const released = clean.againstReleased
      .filter((d) => !d.key.includes("rect"))
      .slice(0, 4)
    if (released.length) {
      console.log(`${name}: clean branch vs released, first style differences:`)
      for (const d of released) console.log(`  ${d.key}: ${d.from} -> ${d.to}`)
    }
  } finally {
    await browser.close()
  }
}

try {
  console.log(`server ready in ${serverReadyMs.toFixed(0)} ms`)
  await measure("chromium", chromium)
  await measure("firefox", firefox)
  await measure("webkit", webkit)
} catch (error) {
  console.error(error)
} finally {
  await writeFile(BUTTON_CSS, original)
  server.kill()
}

const columns = Object.keys(rows[0])
console.log(`\n| ${columns.join(" | ")} |`)
console.log(`| ${columns.map(() => "---").join(" | ")} |`)
for (const row of rows)
  console.log(`| ${columns.map((c) => row[c]).join(" | ")} |`)

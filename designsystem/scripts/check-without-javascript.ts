/**
 * Fanene på en side uten JavaScript, i Chromium, Firefox og WebKit.
 *
 * Vitest kan ikke prøve dette: testene kjører selv som skript i siden. Her
 * lastes markupen i en Playwright-kontekst med `javaScriptEnabled: false`,
 * med stilarkene som eneste kode, slik en leser uten JavaScript får den.
 *
 * Markupen kommer fra to kilder: en mal skrevet for hånd, og `lt.tabs()`.
 * Kotlin-utgaven, `Lt.tabs`, er dekket gjennom `ContractTest`, som krever
 * at den gir det samme som `lt.tabs()` for hvert tilfelle i
 * `manifest/build-cases.json`.
 *
 * Kravene er de i `krav-faner.md` (utredningen): A1 alle panelene vises, A2
 * raden er en vanlig liste med lenker som alle kan nås med Tab, A3 axe finner
 * ingen brudd, A8 ingen av panelene blir et landemerke.
 *
 * Kjør med: bun run check:without-javascript
 */

import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { type Browser, chromium, firefox, type Page, webkit } from "playwright"
import { tabs } from "../src/components/frame/tabs/tabs.js"
import { attr } from "../src/testing/markup.js"

const SRC = fileURLToPath(new URL("../src/", import.meta.url))
const css = (
  await Promise.all(
    ["tokens/tokens.css", "components/frame/tabs/tabs.css"].map((fil) =>
      Bun.file(`${SRC}${fil}`).text(),
    ),
  )
).join("\n")
const axeKilde = await Bun.file(
  createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
).text()

const NAVN = ["Søknaden", "Vedlegg", "Meldinger"]
const NOKLER = ["soknaden", "vedlegg", "meldinger"]

const HANDSKREVET = `
  <lt-tabs>
    <ul class="lt-tabs__list" aria-label="Deler av saken">
      ${NAVN.map((n, i) => `<li><a href="#${NOKLER[i]}">${n}</a></li>`).join("")}
    </ul>
    ${NAVN.map((n, i) => `<section class="lt-tabs__panel" id="${NOKLER[i]}"><h2>${n}</h2><p>Innholdet i ${n.toLowerCase()}.</p></section>`).join("")}
  </lt-tabs>`

const faner = tabs({ id: "sak", keys: NOKLER, label: "Deler av saken" })
const fraByggefunksjonen = faner as unknown as {
  list: Record<string, unknown>
  item?: Record<string, unknown>
  tabs: Record<string, unknown>[]
  panels: Record<string, unknown>[]
  headings: Record<string, unknown>[]
}
const BYGGEFUNKSJONEN = `
  <lt-tabs>
    <ul ${attr(fraByggefunksjonen.list)}>
      ${fraByggefunksjonen.tabs.map((t, i) => `<li ${attr(fraByggefunksjonen.item ?? {})}><a ${attr(t)}>${NAVN[i]}</a></li>`).join("")}
    </ul>
    ${fraByggefunksjonen.panels.map((p, i) => `<section ${attr(p)}><h2 ${attr(fraByggefunksjonen.headings[i])}>${NAVN[i]}</h2><p>Innholdet i ${NAVN[i].toLowerCase()}.</p></section>`).join("")}
  </lt-tabs>`

const KILDER = { "skrevet for hånd": HANDSKREVET, "lt.tabs()": BYGGEFUNKSJONEN }

function side(markup: string, stil = css): string {
  return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><title>Uten JavaScript</title>
<style>${stil}</style></head><body><main><h1>Saken</h1>${markup}</main></body></html>`
}

function markupFor(kilde: string): string {
  return KILDER[kilde as keyof typeof KILDER]
}

const feil: string[] = []

async function sjekk(motor: string, page: Page, kilde: string) {
  const si = (krav: string, tekst: string) =>
    feil.push(`${motor}, ${kilde}: ${krav} ${tekst}`)

  // Uten dette kunne alt under gått grønt på en side der skriptene kjørte.
  const forutsetning = await page.evaluate(() => ({
    utenSkript: matchMedia("(scripting: none)").matches,
    definert: customElements.get("lt-tabs") !== undefined,
  }))
  if (!forutsetning.utenSkript || forutsetning.definert) {
    si("forutsetning", "siden kjørte med JavaScript, så ingenting er prøvd.")
    return
  }

  // A1: hvert panel vises, med overskrift og innhold.
  const paneler = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".lt-tabs__panel")].map((p) => ({
      id: p.id,
      vises: p.checkVisibility(),
      topp: p.getBoundingClientRect().top,
      hoyde: p.getBoundingClientRect().height,
      tekst: (p.querySelector("p") as HTMLElement).checkVisibility(),
    })),
  )
  if (paneler.length !== NAVN.length)
    si("A1", `fant ${paneler.length} paneler, ventet ${NAVN.length}.`)
  for (const p of paneler)
    if (!p.vises || p.hoyde === 0 || !p.tekst)
      si("A1", `panelet «${p.id}» vises ikke uten JavaScript.`)
  // I rekkefølge: hvert panel under det forrige, i den rekkefølgen lenkene har.
  const rekkefolge = paneler.map((p) => p.id.replace(/^sak-/, "")).join(" ")
  if (rekkefolge !== NOKLER.join(" "))
    si(
      "A1",
      `panelene står i rekkefølgen ${rekkefolge}, ventet ${NOKLER.join(" ")}.`,
    )
  for (let i = 1; i < paneler.length; i++)
    if (paneler[i].topp <= paneler[i - 1].topp)
      si(
        "A1",
        `panelet «${paneler[i].id}» står ikke under «${paneler[i - 1].id}».`,
      )

  // A2: en vanlig liste med lenker, uten fanerolle og uten noe som tar
  // lenkene ut av Tab-rekkefølgen.
  const raden = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "lt-tabs [role], lt-tabs [aria-selected], lt-tabs [tabindex], lt-tabs [aria-controls]",
      ),
    ].map((e) => e.outerHTML.slice(0, 80)),
  )
  for (const e of raden)
    si("A2", `markupen sier noe den ikke gjør uten JavaScript: ${e}`)

  // WebKit på macOS hopper som Safari over lenker med Tab. Alt+Tab er tasten
  // som går til lenker der.
  const tast = motor === "webkit" ? "Alt+Tab" : "Tab"
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  )
  const besokt: string[] = []
  // Like mange trykk som lenker. Et trykk til tar fokus ut av siden og inn i
  // nettleseren, og da er det ikke lenger siden som svarer.
  for (let i = 0; i < NAVN.length; i++) {
    await page.keyboard.press(tast)
    const href = await page.evaluate(() =>
      document.activeElement?.closest(".lt-tabs__list")
        ? document.activeElement.getAttribute("href")
        : null,
    )
    if (href) besokt.push(href)
  }
  const ventet = NOKLER.map((n) =>
    kilde === "lt.tabs()" ? `#sak-${n}` : `#${n}`,
  )
  if (besokt.join(" ") !== ventet.join(" "))
    si(
      "A2",
      `Tab nådde ${besokt.join(", ") || "ingen lenker"}, ventet ${ventet.join(", ")}.`,
    )

  // A8: ingen av panelene blir et landemerke.
  const landemerker = await page.evaluate(() =>
    [...document.querySelectorAll(".lt-tabs__panel")]
      .filter(
        (p) =>
          p.hasAttribute("role") ||
          p.hasAttribute("aria-label") ||
          p.hasAttribute("aria-labelledby"),
      )
      .map((p) => p.id),
  )
  for (const id of landemerker)
    si(
      "A8",
      `panelet «${id}» har navn eller rolle, og blir et landemerke uten JavaScript.`,
    )
}

/*
 * A3: axe, med kontrast. `axe.run` venter på tidtakere og løfter, og de kjører
 * ikke i en side uten JavaScript. Siden har ingen skript, så den eneste
 * forskjellen på de to kontekstene er medieregelen `scripting`. Den skrives
 * om i stilarket, så axe ser den samme stilen som leseren uten JavaScript.
 */
const cssUtenSkript = css
  .replaceAll("(scripting: enabled)", "not all")
  .replaceAll("(scripting: none)", "all")
if (cssUtenSkript === css || !css.includes("(scripting: enabled)"))
  throw new Error("Fant ikke `scripting` i stilarket. Rett omskrivingen over.")

async function axe(motor: string, page: Page, kilde: string) {
  await page.setContent(side(markupFor(kilde), cssUtenSkript))
  await page.evaluate(axeKilde)
  const brudd = (await page.evaluate(async () => {
    const svar = await (
      window as unknown as {
        axe: {
          run: (
            k: unknown,
            o: unknown,
          ) => Promise<{
            violations: { id: string; nodes: { target: string[] }[] }[]
          }>
        }
      }
    ).axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    })
    return svar.violations.map(
      (v) => `${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
    )
  })) as string[]
  for (const b of brudd) feil.push(`${motor}, ${kilde}: A3 axe: ${b}`)
}

for (const [motor, type] of Object.entries({ chromium, firefox, webkit })) {
  let nettleser: Browser | undefined
  try {
    nettleser = await type.launch()
    for (const [kilde, markup] of Object.entries(KILDER)) {
      const kontekst = await nettleser.newContext({ javaScriptEnabled: false })
      const page = await kontekst.newPage()
      await page.setContent(side(markup))
      await sjekk(motor, page, kilde)
      await kontekst.close()

      const medSkript = await nettleser.newContext()
      await axe(motor, await medSkript.newPage(), kilde)
      await medSkript.close()
    }
  } finally {
    await nettleser?.close()
  }
}

if (feil.length > 0) {
  console.error(`✗ Fanene uten JavaScript, ${feil.length} feil:`)
  for (const f of feil) console.error(`  ${f}`)
  process.exit(1)
}
console.log(
  `✓ Fanene uten JavaScript: ${Object.keys(KILDER).length} kilder i tre motorer, krav A1, A2, A3 og A8.`,
)

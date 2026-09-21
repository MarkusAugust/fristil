/**
 * Kontrollerer at ingen side ruller sidelengs på en mobilskjerm.
 *
 * Siden var bygget for stor skjerm først: overskriften brakk midt i ordet,
 * menyen i toppen stakk utenfor, og kortene på forsiden var bredere enn
 * telefonen. Det er lett å innføre på nytt, siden ingenting sier fra i et
 * vanlig utviklingsvindu.
 *
 * Målingen er den brukeren merker: kan siden faktisk dras sidelengs?
 * `scrollWidth` alene er misvisende, for et kodefelt som er klippet av en
 * `overflow: hidden` teller med der uten at noe kan rulles.
 *
 * Kjør med: bun run test:docs (bygg først)
 */

import { join, relative } from "node:path"
import { chromium } from "playwright"

const DIST = new URL("../dist/", import.meta.url).pathname
const PORT = 4179
/** iPhone SE, den smaleste skjermen det er verdt å ta hensyn til. */
const BREDDE = 375

function finnSider(): string[] {
  const sider: string[] = []
  for (const treff of new Bun.Glob("**/index.html").scanSync(DIST)) {
    sider.push(`/${relative(".", treff).replace(/index\.html$/, "")}`)
  }
  return sider.sort()
}

const MEDIETYPER: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  webp: "image/webp",
  png: "image/png",
  woff2: "font/woff2",
}

const tjener = Bun.serve({
  port: PORT,
  fetch(request) {
    const sti = decodeURIComponent(new URL(request.url).pathname)
    const filsti = sti.endsWith("/")
      ? join(DIST, sti, "index.html")
      : join(DIST, sti)
    const fil = Bun.file(filsti)
    const endelse = filsti.split(".").pop() ?? ""
    return fil.exists().then((finnes) =>
      finnes
        ? new Response(fil, {
            headers: {
              "content-type": MEDIETYPER[endelse] ?? "application/octet-stream",
            },
          })
        : new Response("Ikke funnet", { status: 404 }),
    )
  },
})

const nettleser = await chromium.launch()
const kontekst = await nettleser.newContext({
  viewport: { width: BREDDE, height: 800 },
})
const side = await kontekst.newPage()

type Funn = { side: string; rullet: number; synder: string }
const funn: Funn[] = []

for (const url of finnSider()) {
  await side.goto(`http://localhost:${PORT}${url}`, {
    waitUntil: "networkidle",
  })

  const resultat = await side.evaluate((bredde) => {
    window.scrollTo(bredde, 0)
    const rullet = window.scrollX
    window.scrollTo(0, 0)

    if (rullet === 0) return { rullet, synder: "" }

    // Finn det ytterste elementet som stikker ut, og som ikke ligger i noe
    // som klipper eller kan rulles for seg selv.
    for (const element of document.querySelectorAll("*")) {
      const rute = element.getBoundingClientRect()
      if (rute.width === 0 || rute.right <= bredde + 1) continue

      let forelder = element.parentElement
      let klippet = false
      while (forelder) {
        if (getComputedStyle(forelder).overflowX !== "visible") {
          klippet = true
          break
        }
        forelder = forelder.parentElement
      }
      if (klippet) continue

      const klasse = (element.className || "").toString().split(" ")[0]
      return {
        rullet,
        synder: `${element.tagName.toLowerCase()}${klasse ? `.${klasse}` : ""} er ${Math.round(rute.width)} piksler bred`,
      }
    }

    return { rullet, synder: "fant ikke hvilket element" }
  }, BREDDE)

  if (resultat.rullet > 0) {
    funn.push({ side: url, rullet: resultat.rullet, synder: resultat.synder })
  }
}

await nettleser.close()
tjener.stop()

if (funn.length > 0) {
  console.error(
    `Fant ${funn.length} sider som ruller sidelengs på ${BREDDE} piksler:\n\n` +
      funn
        .map((f) => `  ${f.side}: ${f.rullet} piksler til siden. ${f.synder}`)
        .join("\n") +
      "\n",
  )
  process.exit(1)
}

console.log(`Ingen av sidene ruller sidelengs på ${BREDDE} piksler.`)

/**
 * Kontrollerer at ingen side ruller sidelengs på en mobilskjerm.
 *
 * Siden var bygget for stor skjerm først: overskriften brakk midt i ordet,
 * menyen i toppen stakk utenfor, og kortene på forsiden var bredere enn
 * telefonen. Det er lett å innføre på nytt, siden ingenting sier fra i et
 * vanlig utviklingsvindu.
 *
 * Den ene målingen er den brukeren merker: kan siden faktisk dras sidelengs?
 * `scrollWidth` alene er misvisende, for et kodefelt som er klippet av en
 * `overflow: hidden` teller med der uten at noe kan rulles.
 *
 * Den andre er innhold som stikker utenfor skjermen uten å gjøre siden
 * dragbar, fordi noe lenger ute klipper det. Det synes ikke som en rullefelt,
 * men teksten er borte. Knappen «Fjern <filnavn>» i filopplastingen var
 * nøyaktig dette. Forhåndsvisningene ligger i skyggerøtter, så målingen må
 * gå inn i dem for å se slikt.
 *
 * Kjør med: bun run test:docs (bygg først)
 */

import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const DIST = fileURLToPath(new URL("../dist/", import.meta.url))
const PORT = 4179
/** iPhone SE, den smaleste skjermen det er verdt å ta hensyn til. */
const BREDDE = 375

/*
 * Hver bygde HTML-fil, ikke bare de som heter `index.html`.
 *
 * Globben tok bare `index.html`, og det gjorde vakten nederst blind: den
 * sammenlignet antall besøkte sider mot antall treff fra den samme
 * globben, så alt globben ikke fant var usynlig for begge. `dist/404.html`
 * ble derfor aldri besøkt av noen av sjekkene, og begge meldte grønt.
 *
 * Nå tas hver `.html`-fil, så køen er hele settet av bygde sider, og
 * spørsmålet vakten stiller blir det som betyr noe: ble hver side som
 * ligger i `dist` besøkt?
 */
function finnSider(): string[] {
  const sider: string[] = []
  for (const treff of new Bun.Glob("**/*.html").scanSync(DIST)) {
    const sti = relative(".", treff)
    sider.push(
      sti === "index.html"
        ? "/"
        : sti.endsWith("/index.html")
          ? `/${sti.slice(0, -"index.html".length)}`
          : `/${sti}`,
    )
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

type Funn = { side: string; rullet: number; synder: string }
const funn: Funn[] = []

/*
 * Et tall fra miljøet må etterprøves, ellers kan det slå av sjekken.
 *
 * `Array.from({ length: NaN })` og `{ length: 0 }` gir begge en tom liste, så
 * en verdi som `0` eller `abc` ville startet null arbeidere, sjekket null
 * sider og avsluttet med 0. En vaktpost som melder grønt uten å ha sett på
 * noe er verre enn ingen vaktpost.
 */
function lesAntall(navn: string, standard: number): number {
  const raa = Bun.env[navn]
  if (raa === undefined) return standard
  const tall = Number(raa)
  if (!Number.isInteger(tall) || tall < 1) {
    console.error(`${navn} må være et heltall på minst 1, men var «${raa}».`)
    process.exit(2)
  }
  return tall
}

/*
 * Sidene deles på flere faner, fordi sjekken venter framfor å regne.
 *
 * Med én fane brukte de 59 sidene 32 sekunder, og av det var bare 5 sekunder
 * prosessortid: 19 prosent av én kjerne. Resten var venting på
 * `networkidle`. Derfor skalerer den forbi kjernetallet, og tallet er åtte og
 * ikke fire: 32 s med én fane, 8,7 med fire, 5,0 med åtte, 4,3 med tolv.
 * Etter åtte er det lite igjen å hente.
 */
const PARALLELLE = lesAntall("SIDER_I_PARALLELL", 8)

const koe = finnSider()
let neste = 0
let sjekket = 0

async function sjekkSider() {
  const kontekst = await nettleser.newContext({
    viewport: { width: BREDDE, height: 800 },
  })
  const side = await kontekst.newPage()

  while (true) {
    // `neste++` er trygt uten lås: JavaScript kjører én ting om gangen, og
    // her er det ingen `await` mellom avlesningen og økningen.
    const url = koe[neste++]
    if (url === undefined) break

    await side.goto(`http://localhost:${PORT}${url}`, {
      waitUntil: "networkidle",
    })

    const resultat = await side.evaluate((bredde) => {
      window.scrollTo(bredde, 0)
      const rullet = window.scrollX
      window.scrollTo(0, 0)

      // Alle elementer, også de som ligger inne i en skyggerot.
      const alle: HTMLElement[] = []
      const samle = (rot: ParentNode) => {
        for (const element of rot.querySelectorAll<HTMLElement>("*")) {
          alle.push(element)
          if (element.shadowRoot) samle(element.shadowRoot)
        }
      }
      samle(document.body)

      // Det som stikker ut, og som ikke ligger i noe som kan rulles for seg
      // selv. Et kodefelt og en bred tabell har sitt eget rullefelt, og er
      // dermed i orden. `hidden` og `clip` teller ikke: de klipper uten å gi
      // noen vei til innholdet, og er nettopp feilen vi leter etter.
      const utenfor: string[] = []
      for (const element of alle) {
        const rute = element.getBoundingClientRect()
        if (rute.width === 0 || rute.right <= bredde + 1) continue

        let forelder = element.parentElement
        let egenRull = false
        while (forelder) {
          const overflow = getComputedStyle(forelder).overflowX
          if (overflow === "auto" || overflow === "scroll") {
            egenRull = true
            break
          }
          forelder = forelder.parentElement
        }
        if (egenRull) continue

        const klasse = (element.className || "").toString().split(" ")[0]
        const tekst = (element.textContent ?? "").trim().slice(0, 30)
        utenfor.push(
          `${element.tagName.toLowerCase()}${klasse ? `.${klasse}` : ""} er ${Math.round(rute.width)} piksler bred${tekst ? ` («${tekst}»)` : ""}`,
        )
      }

      return { rullet, synder: [...new Set(utenfor)].slice(0, 3).join("; ") }
    }, BREDDE)

    if (resultat.rullet > 0 || resultat.synder !== "") {
      funn.push({
        side: url,
        rullet: resultat.rullet,
        synder: resultat.synder || "fant ikke hvilket element",
      })
    }

    // Sist i kroppen, ikke først. Telleren skal si hvor mange sider som ble
    // sjekket, ikke hvor mange som ble tatt av køen: et `continue` lagt inn
    // senere ville ellers hoppet over arbeidet uten at vakten merket det.
    sjekket++
  }

  await kontekst.close()
}

await Promise.all(Array.from({ length: PARALLELLE }, () => sjekkSider()))

await nettleser.close()
tjener.stop()

/*
 * Ble hver side faktisk besøkt?
 *
 * Spørsmålet som betyr noe er om arbeidet ble gjort. `lesAntall` validerer
 * bare hvor mange arbeidere som startes, og sier ingenting om køen de skulle
 * tømme, så den lukker ikke dette.
 *
 * Vilkåret krever null sider eksplisitt, og ikke bare at tallene er like:
 * `0 !== 0` er usant, så en tom kø ville ellers passert vakten og gitt en
 * kjøring som melder grønt uten å ha åpnet en side.
 *
 * Utfallet avgjøres nederst, slik at en ufullstendig kjøring ikke skjuler de
 * sidene den faktisk rakk å felle.
 */
const ufullstendig = koe.length === 0 || sjekket !== koe.length

// Arbeiderne blir ferdige i tilfeldig rekkefølge, så rapporten sorteres for
// at to kjøringer av den samme feilen skal se like ut.
funn.sort((a, b) => a.side.localeCompare(b.side))

if (funn.length > 0) {
  console.error(
    `Fant ${funn.length} sider med innhold utenfor skjermen på ${BREDDE} piksler:\n\n` +
      funn
        .map(
          (f) =>
            `  ${f.side}: ${f.rullet > 0 ? `siden kan dras ${f.rullet} piksler til siden. ` : ""}${f.synder}`,
        )
        .join("\n") +
      "\n",
  )
  if (!ufullstendig) process.exit(1)
}

if (ufullstendig) {
  console.error(
    koe.length === 0
      ? `Fant ingen sider i ${DIST}. Er dokumentasjonen bygget? Sjekken har ikke sett på noe.`
      : `Sjekket ${sjekket} av ${koe.length} sider. Sjekken er ikke til å stole på.`,
  )
  process.exit(2)
}

console.log(`Alt holder seg innenfor ${BREDDE} piksler.`)

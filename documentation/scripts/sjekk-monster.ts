/**
 * Kontrollerer at demoene på mønstersidene faktisk virker.
 *
 * Mønstersidene rører mange komponenter samtidig, og råtner derfor fortere
 * enn komponentsidene. En demo som har sluttet å virke er verre enn ingen
 * demo: leseren tror mønsteret er slik, og kopierer noe som ikke gjør det den
 * sier.
 *
 * Sjekken kjører de samme stegene en bruker gjør, i den bygde siden.
 *
 * Kjør med: bun run test:docs (bygg først)
 */

import { join } from "node:path"
import { chromium } from "playwright"

const DIST = new URL("../dist/", import.meta.url).pathname
const PORT = 4183

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
const side = await (await nettleser.newContext()).newPage()
const feil: string[] = []

function krev(påstand: boolean, beskrivelse: string): void {
  if (!påstand) feil.push(beskrivelse)
}

async function apne(sti: string) {
  await side.goto(`http://localhost:${PORT}${sti}`, {
    waitUntil: "networkidle",
  })
}

/** Skriver i et felt i skjemademoen, og forlater det etterpå. */
async function skrivIFelt(id: string, verdi: string) {
  await side.evaluate(
    ([id, verdi]) => {
      const rot = document.getElementById("demo-skjema")?.shadowRoot
      const felt = rot?.getElementById(id) as HTMLInputElement
      felt.focus()
      felt.value = verdi
      felt.dispatchEvent(new Event("input", { bubbles: true }))
      felt.blur()
    },
    [id, verdi],
  )
}

function lesSkjema() {
  return side.evaluate(() => {
    const rot = document.getElementById("demo-skjema")?.shadowRoot
    return {
      lenker: rot?.querySelectorAll("fs-error-summary li a").length ?? 0,
      markerte: rot?.querySelectorAll("[aria-invalid='true']").length ?? 0,
      overskrift:
        rot?.querySelector(".fs-error-summary__title")?.textContent ?? "",
    }
  })
}

// Skjemaet: et tomt skjema skal gi feil i alle feltene og i oppsummeringen
{
  await apne("/monster/skjema/")

  await side.evaluate(() => {
    const rot = document.getElementById("demo-skjema")?.shadowRoot
    const knapp = rot?.querySelector("button[type=submit]") as HTMLElement
    knapp.click()
  })
  await side.waitForTimeout(300)

  const resultat = await side.evaluate(() => {
    const rot = document.getElementById("demo-skjema")?.shadowRoot
    return {
      lenker: rot?.querySelectorAll("fs-error-summary li a").length ?? 0,
      markerte: rot?.querySelectorAll("[aria-invalid='true']").length ?? 0,
      overskrift:
        rot?.querySelector(".fs-error-summary__title")?.textContent ?? "",
      pekerPaFeil:
        rot
          ?.getElementById("demo-epost")
          ?.getAttribute("aria-describedby")
          ?.includes("demo-epost-feil") ?? false,
    }
  })

  krev(
    resultat.lenker === 2,
    `oppsummeringen har ${resultat.lenker} feil, ventet 2`,
  )
  krev(
    resultat.markerte === 2,
    `${resultat.markerte} felt er markert, ventet 2`,
  )
  krev(
    resultat.overskrift.includes("2"),
    `overskriften sier ikke hvor mange feil: «${resultat.overskrift}»`,
  )
  krev(
    resultat.pekerPaFeil,
    "feltet peker ikke på feilmeldingen med aria-describedby",
  )

  // Retter brukeren én av to feil, skal den andre stå igjen alene.
  await skrivIFelt("demo-epost", "ola@eksempel.no")
  await side.waitForTimeout(200)

  const etterRetting = await lesSkjema()

  krev(
    etterRetting.lenker === 1,
    `oppsummeringen har ${etterRetting.lenker} feil etter at én er rettet, ventet 1`,
  )
  krev(
    etterRetting.overskrift.includes("én"),
    `overskriften teller ikke ned: «${etterRetting.overskrift}»`,
  )

  // En adresse uten toppdomene godtas av nettleseren, men ikke av skjemaet.
  await skrivIFelt("demo-epost", "ola@eksempel")
  await side.waitForTimeout(200)

  krev(
    (await lesSkjema()).lenker === 2,
    "«ola@eksempel» ble godtatt som e-postadresse",
  )
}

// Skjemaet: en feil skal komme når feltet forlates, uten innsending først
{
  await apne("/monster/skjema/")

  await skrivIFelt("demo-epost", "ola")
  await side.waitForTimeout(200)

  const etterBlur = await lesSkjema()

  krev(
    etterBlur.markerte === 1,
    `${etterBlur.markerte} felt er markert etter at ett ble forlatt, ventet 1`,
  )
  krev(
    etterBlur.lenker === 1,
    `oppsummeringen viser ${etterBlur.lenker} feil etter blur, ventet 1`,
  )
}

// Lista: fire tilstander, og her kontrolleres treff og tomt
{
  await apne("/monster/liste/")
  await side.waitForTimeout(700)

  const forst = await side.evaluate(() => {
    const rot = document.getElementById("demo-liste")?.shadowRoot
    return {
      rader: rot?.querySelectorAll("tbody tr").length ?? 0,
      status: rot?.getElementById("demo-treff")?.textContent ?? "",
    }
  })

  krev(forst.rader === 4, `lista viser ${forst.rader} rader, ventet 4`)
  krev(
    forst.status.includes("4"),
    `antall treff meldes ikke: «${forst.status}»`,
  )

  await side.evaluate(() => {
    const rot = document.getElementById("demo-liste")?.shadowRoot
    const felt = rot?.getElementById("demo-sok") as HTMLInputElement
    felt.value = "finnes ikke"
    felt.dispatchEvent(new Event("input", { bubbles: true }))
  })
  await side.waitForTimeout(1100)

  const tomt = await side.evaluate(() => {
    const rot = document.getElementById("demo-liste")?.shadowRoot
    return {
      tekst: rot?.getElementById("demo-resultat")?.textContent ?? "",
      status: rot?.getElementById("demo-treff")?.textContent ?? "",
      harNullstill: Boolean(rot?.getElementById("demo-nullstill")),
    }
  })

  krev(
    tomt.tekst.includes("finnes ikke"),
    "den tomme tilstanden sier ikke hva som ble søkt etter",
  )
  krev(tomt.harNullstill, "den tomme tilstanden mangler en vei videre")
  krev(
    tomt.status.includes("Ingen treff"),
    `tomt resultat meldes ikke: «${tomt.status}»`,
  )
}

// Bekreftelsen: dialogen tar fokus, og meldingen kommer etterpå
{
  await apne("/monster/bekreftelse/")

  await side.evaluate(() => {
    const rot = document.getElementById("demo-bekreft")?.shadowRoot
    ;(rot?.getElementById("demo-slett") as HTMLElement).click()
  })
  await side.waitForTimeout(200)

  const apen = await side.evaluate(() => {
    const rot = document.getElementById("demo-bekreft")?.shadowRoot
    const dialog = rot?.getElementById("demo-dialog") as HTMLDialogElement
    return {
      open: dialog.open,
      fokusInne: dialog.contains(rot?.activeElement ?? null),
    }
  })

  krev(apen.open, "dialogen åpnet seg ikke")
  krev(apen.fokusInne, "fokus havnet ikke inne i dialogen")

  await side.evaluate(() => {
    const rot = document.getElementById("demo-bekreft")?.shadowRoot
    const dialog = rot?.getElementById("demo-dialog") as HTMLDialogElement
    dialog.close("slett")
  })
  await side.waitForTimeout(200)

  const melding = await side.evaluate(() => {
    const rot = document.getElementById("demo-bekreft")?.shadowRoot
    return rot?.querySelector(".fs-toast")?.textContent ?? ""
  })

  krev(
    melding.includes("slettet"),
    `meldingen kom ikke etter handlingen: «${melding}»`,
  )
}

// Sideskjelettet: landemerkene og hopplenken
{
  await apne("/demo/sideskjelett/")

  const struktur = await side.evaluate(() => ({
    hopplenke: document.body.firstElementChild?.className ?? "",
    hoved: Boolean(document.querySelector("main#hovedinnhold[tabindex='-1']")),
    navMedNavn: document.querySelectorAll("nav[aria-label]").length,
    h1: document.querySelectorAll("h1").length,
    landemerker: ["header", "main", "footer"].filter((t) =>
      document.querySelector(t),
    ).length,
  }))

  krev(
    struktur.hopplenke.includes("fs-skip-link"),
    "hopplenken er ikke det første i body",
  )
  krev(struktur.hoved, "hovedinnholdet mangler id eller tabindex")
  krev(
    struktur.navMedNavn === 2,
    `${struktur.navMedNavn} navigasjoner har navn, ventet 2`,
  )
  krev(struktur.h1 === 1, `siden har ${struktur.h1} h1-elementer, ventet 1`)
  krev(struktur.landemerker === 3, "siden mangler et landemerke")
}

await nettleser.close()
tjener.stop()

if (feil.length > 0) {
  console.error(
    `Mønsterdemoene virker ikke som de skal:\n\n${feil
      .map((linje) => `  ${linje}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

console.log("Demoene på mønstersidene gjør det de sier.")

/**
 * Kontrollerer at de levende forhåndsvisningene på komponentsidene virker.
 *
 * `sjekk-dokumentasjon.ts` leser mdx-filene som tekst og kontrollerer at hver
 * klasse og variabel er nevnt. Den sier ingenting om at eksempelet virker.
 * Da API-et la om til at serveren skriver markupen, sto tre demoer igjen med
 * `heading=`, `label=` og `<option>`-barn, og begge sjekkene meldte grønt
 * mens de publiserte eksemplene ikke gjorde noe i det hele tatt.
 *
 * Denne gjør det leseren gjør, i den bygde siden. Alle forhåndsvisningene
 * ligger i en skyggerot, så oppslagene går via vertselementet.
 *
 * Kjør med: bun run test:docs (bygg først)
 */

import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium, type Page } from "playwright"

const DIST = fileURLToPath(new URL("../dist/", import.meta.url))
const PORT = 4184

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

const feil: string[] = []
let gjeldende = ""

function krev(påstand: boolean, beskrivelse: string): void {
  if (!påstand) feil.push(`${gjeldende}: ${beskrivelse}`)
}

const nettleser = await chromium.launch()
const kontekst = await nettleser.newContext()
const side = await kontekst.newPage()

side.on("pageerror", (e) => {
  feil.push(`${gjeldende}: skriptfeil «${e.message}»`)
})
side.on("console", (melding) => {
  if (melding.type() === "error") {
    feil.push(`${gjeldende}: konsollfeil «${melding.text()}»`)
  }
})

/**
 * Åpner en komponentside og kontrollerer det som gjelder alle demoer.
 *
 * Deretter kjøres den komponentens egen prøve. Den generelle delen alene er
 * ikke nok: fanedemoen rendret knapper og paneler helt fint, den hadde bare
 * sluttet å få roller.
 */
async function pa(
  komponent: string,
  vertsId: string,
  tagg: string,
  prove: (side: Page, id: string) => Promise<void>,
) {
  gjeldende = komponent
  await side.goto(`http://localhost:${PORT}/components/${komponent}/`, {
    waitUntil: "networkidle",
  })

  const generelt = await side.evaluate(
    ([id, tagg]) => ({
      finnesVert: Boolean(document.getElementById(id)),
      harSkyggerot: Boolean(document.getElementById(id)?.shadowRoot),
      registrert: Boolean(customElements.get(tagg)),
      harInnhold:
        (document.getElementById(id)?.shadowRoot?.textContent ?? "").trim()
          .length > 0,
    }),
    [vertsId, tagg] as const,
  )

  krev(generelt.finnesVert, `fant ikke forhåndsvisningen «${vertsId}»`)
  krev(generelt.harSkyggerot, "forhåndsvisningen har ingen skyggerot")
  krev(generelt.registrert, `elementet <${tagg}> er ikke registrert`)
  krev(generelt.harInnhold, "forhåndsvisningen er tom")

  if (generelt.harSkyggerot) await prove(side, vertsId)
}

await pa("tabs", "demo-tabs", "fs-tabs", async (side, id) => {
  const svar = await side.evaluate((id) => {
    const rot = document.getElementById(id)?.shadowRoot
    const faner = [...(rot?.querySelectorAll("[role='tab']") ?? [])]
    const paneler = [...(rot?.querySelectorAll("[role='tabpanel']") ?? [])]
    ;(faner[1] as HTMLElement | undefined)?.click()
    return {
      antall: faner.length,
      valgt: faner[1]?.getAttribute("aria-selected"),
      synlige: paneler.filter((p) => !(p as HTMLElement).hidden).length,
      tabbestopp: faner.filter((f) => (f as HTMLElement).tabIndex === 0).length,
    }
  }, id)

  krev(svar.antall >= 2, `fant ${svar.antall} faner`)
  krev(svar.valgt === "true", "et klikk velger ikke fanen")
  krev(svar.synlige === 1, `${svar.synlige} paneler er synlige, ventet 1`)
  krev(svar.tabbestopp === 1, "flere enn én fane er en tabbestopp")
})

await pa(
  "error-summary",
  "demo-error-summary",
  "fs-error-summary",
  async (side, id) => {
    const svar = await side.evaluate((id) => {
      const rot = document.getElementById(id)?.shadowRoot
      const boks = rot?.querySelector("fs-error-summary")
      ;(rot?.querySelector("li a") as HTMLElement | undefined)?.click()
      return {
        klasse: boks?.classList.contains("fs-error-summary") ?? false,
        rolle: boks?.getAttribute("role") ?? "",
        tittel: (
          rot?.querySelector(".fs-error-summary__title")?.textContent ?? ""
        ).trim(),
        fokus: (rot?.activeElement as HTMLElement | null)?.id ?? "",
      }
    }, id)

    krev(svar.klasse, "boksen mangler klassen fra serveren")
    krev(svar.rolle === "alert", "boksen er ikke en varsling")
    krev(svar.tittel.length > 0, "overskriften er tom")
    krev(
      svar.fokus === "demo-epost",
      `en lenke ga fokus til «${svar.fokus}», ventet feltet`,
    )
  },
)

await pa("suggestion", "demo-suggestion", "fs-suggestion", async (side, id) => {
  const svar = await side.evaluate((id) => {
    const rot = document.getElementById(id)?.shadowRoot
    const felt = rot?.querySelector("input") as HTMLInputElement | null
    if (felt) {
      felt.value = "bo"
      felt.dispatchEvent(new Event("input", { bubbles: true }))
    }
    const alternativer = [...(rot?.querySelectorAll("[role='option']") ?? [])]
    return {
      harFelt: Boolean(felt),
      navn: felt?.name ?? "",
      apen: felt?.getAttribute("aria-expanded") ?? "",
      treff: alternativer.filter((o) => !(o as HTMLElement).hidden).length,
      alle: alternativer.length,
      status: (rot?.querySelector("[role='status']")?.textContent ?? "").trim(),
    }
  }, id)

  // Et ekte felt med navn er hele poenget: uten det blir ingenting med i
  // innsendingen før skriptet har kjørt.
  krev(svar.harFelt, "demoen har ikke noe inndatafelt")
  krev(svar.navn.length > 0, "feltet mangler name og blir ikke sendt inn")
  krev(svar.alle > 1, "lista har ingen alternativer fra serveren")
  krev(svar.apen === "true", "lista åpner seg ikke når brukeren skriver")
  krev(svar.treff < svar.alle, "filtreringen snevrer ikke inn lista")
  krev(svar.status.length > 0, "antall treff meldes ikke til skjermlesere")
})

await pa("popover", "demo-popover", "fs-popover", async (side, id) => {
  const svar = await side.evaluate((id) => {
    const rot = document.getElementById(id)?.shadowRoot
    const utloser = rot?.querySelector("[slot='trigger']") as HTMLElement | null
    utloser?.click()
    const panel = rot?.querySelector(".fs-popover") as HTMLElement | null
    return {
      apen: utloser?.getAttribute("aria-expanded") ?? "",
      synlig: panel?.matches(":popover-open") ?? false,
      koblet: Boolean(utloser?.getAttribute("aria-controls")),
    }
  }, id)

  krev(svar.koblet, "knappen er ikke koblet til panelet")
  krev(svar.apen === "true", "et klikk åpner ikke panelet")
  krev(svar.synlig, "panelet havner ikke i topplaget")
})

await pa("field", "demo-field", "fs-field", async (side, id) => {
  const svar = await side.evaluate((id) => {
    const rot = document.getElementById(id)?.shadowRoot
    const felt = rot?.querySelector("input") as HTMLInputElement | null
    const ledetekst = rot?.querySelector("label") as HTMLLabelElement | null
    return {
      koblet: Boolean(ledetekst?.htmlFor) && ledetekst?.htmlFor === felt?.id,
      beskrevet: Boolean(felt?.getAttribute("aria-describedby")),
      klasse: ledetekst?.classList.contains("fs-label") ?? false,
    }
  }, id)

  krev(svar.koblet, "ledeteksten peker ikke på feltet")
  krev(svar.beskrevet, "hjelpeteksten er ikke koblet til feltet")
  krev(svar.klasse, "ledeteksten mangler fs-label")
})

await pa("toast", "demo-toast", "fs-toast", async (side, id) => {
  const svar = await side.evaluate((id) => {
    const rot = document.getElementById(id)?.shadowRoot
    ;(rot?.getElementById("demo-toast-knapp") as HTMLElement | null)?.click()
    const ko = rot?.querySelector("fs-toast")
    return {
      rolle: ko?.getAttribute("role") ?? "",
      meldinger: rot?.querySelectorAll(".fs-toast").length ?? 0,
      lukkeknapp: rot?.querySelectorAll(".fs-toast__close").length ?? 0,
    }
  }, id)

  krev(svar.rolle === "status", "regionen er ikke en status-region")
  krev(svar.meldinger === 1, `et klikk ga ${svar.meldinger} meldinger`)
  krev(svar.lukkeknapp === 1, "meldingen har ingen lukkeknapp")
})

await pa(
  "connection-status",
  "demo-samband",
  "fs-connection-status",
  async (side, id) => {
    const svar = await side.evaluate((id) => {
      const rot = document.getElementById(id)?.shadowRoot
      ;(rot?.getElementById("demo-samband-av") as HTMLElement | null)?.click()
      const linje = rot?.querySelector(".fs-connection-status__bar")
      return {
        tekst: (linje?.textContent ?? "").trim(),
        tilstand: (linje as HTMLElement | null)?.dataset.state ?? "",
        rolle: linje?.getAttribute("role") ?? "",
      }
    }, id)

    krev(svar.tekst.length > 0, "linja sier ingenting")
    krev(svar.tilstand === "offline", "linja melder ikke at sambandet er nede")
    krev(svar.rolle === "status", "linja er ikke en status-region")
  },
)

await pa(
  "session-timeout",
  "demo-okt",
  "fs-session-timeout",
  async (side, id) => {
    // Demoen varsler etter fem sekunder. Her ventes det på at dialogen
    // faktisk åpner seg, ikke på klokka: en fast pause ville feilet
    // tilfeldig, og en port som feiler tilfeldig blir ignorert.
    await side.waitForFunction(
      (id) =>
        (
          document
            .getElementById(id)
            ?.shadowRoot?.querySelector("dialog") as HTMLDialogElement | null
        )?.open === true,
      id,
      { timeout: 15000 },
    )

    const svar = await side.evaluate((id) => {
      const rot = document.getElementById(id)?.shadowRoot
      const dialog = rot?.querySelector("dialog")
      return {
        rolle: dialog?.getAttribute("role") ?? "",
        nedtelling: (
          rot?.querySelector(".fs-session-timeout__count")?.textContent ?? ""
        ).trim(),
        skjultForSkjermleser:
          rot
            ?.querySelector(".fs-session-timeout__count")
            ?.getAttribute("aria-hidden") ?? "",
        knapper: rot?.querySelectorAll(".fs-session-timeout__actions button")
          .length,
      }
    }, id)

    krev(svar.rolle === "alertdialog", "dialogen er ikke en alertdialog")
    krev(/^\d+:\d\d$/.test(svar.nedtelling), "nedtellingen viser ikke tid")
    krev(svar.skjultForSkjermleser === "true", "tallet leses opp hvert sekund")
    krev(svar.knapper === 2, `dialogen har ${svar.knapper} knapper, ventet 2`)
  },
)

await nettleser.close()
tjener.stop()

if (feil.length > 0) {
  console.error(
    `Forhåndsvisningene på komponentsidene virker ikke som de skal:\n\n${feil
      .map((linje) => `  ${linje}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

console.log("Forhåndsvisningene på komponentsidene gjør det de sier.")

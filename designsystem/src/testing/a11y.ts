import axe from "axe-core"

/**
 * Hjelpere for tilgjengelighetstesting i nettleser.
 *
 * Systemet lover at tilgjengelighet er løst sentralt. Disse funksjonene gjør
 * løftet til noe som faktisk kontrolleres, slik at en komponent ikke kan
 * sendes ut med for svak kontrast eller manglende kobling mellom ledetekst
 * og felt uten at en test sier fra.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]

/**
 * Setter opp en flate med designsystemets sidefarger og legger HTML-en inn i
 * den.
 *
 * Bakgrunnen må være ugjennomsiktig og satt eksplisitt: axe regner ut
 * kontrast ved å lete oppover etter en bakgrunnsfarge, og finner den ingen,
 * melder den «incomplete» i stedet for å gi et svar. Da hadde testen stilt
 * seg likegyldig til nettopp det vi vil kontrollere.
 */
export function monter(html: string): HTMLElement {
  document.body.style.background = "var(--fs-color-neutral-canvas)"
  document.body.style.color = "var(--fs-color-neutral-text-strong)"
  document.body.innerHTML = `<div id="fs-testflate">${html}</div>`

  const flate = document.getElementById("fs-testflate")
  if (!(flate instanceof HTMLElement)) {
    throw new Error("Klarte ikke å montere testflaten")
  }

  flate.style.background = "var(--fs-color-neutral-canvas)"
  flate.style.color = "var(--fs-color-neutral-text-strong)"
  flate.style.padding = "var(--fs-spacing-4)"

  return flate
}

export type Tilgjengelighetsbrudd = {
  regel: string
  forklaring: string
  elementer: string[]
}

/**
 * Kjører axe mot `rot` og returnerer bruddene på WCAG 2.1 nivå A og AA.
 *
 * Det axe ikke kunne avgjøre («incomplete»), er ikke brudd, og feller ikke
 * testen. Oftest er det kontrast over en gradient, et pseudoelement eller et
 * bilde. Men de telles, og står det noen, skrives én linje med antallet og
 * reglene, så en komponent der axe stille har sluttet å kunne svare, synes.
 * Vitest viser konsollen for en test som består bare med `--silent=false`.
 */
export async function finnTilgjengelighetsbrudd(
  rot: Element = document.body,
): Promise<Tilgjengelighetsbrudd[]> {
  const resultat = await axe.run(rot, {
    runOnly: { type: "tag", values: WCAG_AA },
    resultTypes: ["violations", "incomplete"],
  })
  const uavklarte = resultat.incomplete.reduce(
    (sum, uavklart) => sum + uavklart.nodes.length,
    0,
  )
  if (uavklarte > 0)
    console.info(
      `axe kunne ikke avgjøre ${uavklarte} kontroller (${document.documentElement.getAttribute("data-theme") ?? "uten tema"}): ${resultat.incomplete.map((u) => `${u.id} (${u.nodes.length})`).join(", ")}`,
    )

  return resultat.violations.map((brudd) => ({
    regel: brudd.id,
    forklaring: brudd.help,
    elementer: brudd.nodes.map((node) => node.html),
  }))
}

/**
 * Kaster med en lesbar oppsummering hvis axe finner brudd, i lyst eller
 * mørkt tema.
 *
 * Begge temaene sjekkes hver gang, med `data-theme` på `<html>`. Før ble
 * bare lyst sjekket, og en farge som holdt kontrasten i lyst og ikke i
 * mørkt, slapp gjennom. Står det `data-theme` lenger inne, gjelder det der,
 * som på en ekte side. Temaet på `<html>` settes tilbake etterpå.
 *
 * Feilmeldingen skal si hvilket tema, hvilken regel som ryker og på hvilket
 * element, slik at den som får testen rød slipper å kjøre axe manuelt for å
 * forstå hva som er galt.
 */
export async function forventIngenTilgjengelighetsbrudd(
  rot: Element = document.body,
): Promise<void> {
  const html = document.documentElement
  const before = html.getAttribute("data-theme")
  const brudd: Tilgjengelighetsbrudd[] = []
  // Overgangene av før temaet byttes. En overgang som alt er i gang, stopper
  // ikke av at `transition` settes til `none` etterpå, og axe målte en lenke
  // midt mellom den lyse og den mørke fargen.
  const uten = document.createElement("style")
  uten.textContent = "*, *::before, *::after { transition: none !important }"
  document.head.append(uten)
  try {
    for (const tema of ["light", "dark"]) {
      html.setAttribute("data-theme", tema)
      await ventPaTegning()
      for (const b of await finnTilgjengelighetsbrudd(rot))
        brudd.push({ ...b, regel: `${b.regel} (${tema})` })
    }
  } finally {
    uten.remove()
    if (before === null) html.removeAttribute("data-theme")
    else html.setAttribute("data-theme", before)
  }
  if (brudd.length === 0) return

  const oppsummering = brudd
    .map(
      (b) =>
        `  ${b.regel}: ${b.forklaring}\n${b.elementer
          .map((element) => `    ${element}`)
          .join("\n")}`,
    )
    .join("\n\n")

  throw new Error(
    `Fant ${brudd.length} tilgjengelighetsbrudd:\n\n${oppsummering}\n`,
  )
}

/**
 * Venter til nettleseren har tegnet ferdig.
 *
 * Lit oppdaterer asynkront, og axe leser utregnet stil. Uten denne pausen
 * kan axe rekke å måle et element som ennå ikke har fått stilene sine.
 *
 * Gir du den et element som er en Lit-komponent, ventes det også på at
 * komponenten er ferdig med sin egen oppdatering. Testene kalte den allerede
 * slik, men argumentet ble ignorert, og ventingen var bare to bilder.
 */
export async function ventPaTegning(element?: Element): Promise<void> {
  const oppdatering = (element as { updateComplete?: Promise<unknown> })
    ?.updateComplete
  if (oppdatering) await oppdatering

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

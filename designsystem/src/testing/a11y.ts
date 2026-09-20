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
  document.body.style.background = "var(--semantic-page-background)"
  document.body.style.color = "var(--semantic-page-foreground)"
  document.body.innerHTML = `<div id="fs-testflate">${html}</div>`

  const flate = document.getElementById("fs-testflate")
  if (!(flate instanceof HTMLElement)) {
    throw new Error("Klarte ikke å montere testflaten")
  }

  flate.style.background = "var(--semantic-page-background)"
  flate.style.color = "var(--semantic-page-foreground)"
  flate.style.padding = "var(--size-4)"

  return flate
}

export type Tilgjengelighetsbrudd = {
  regel: string
  forklaring: string
  elementer: string[]
}

/**
 * Kjører axe mot `rot` og returnerer bruddene på WCAG 2.1 nivå A og AA.
 */
export async function finnTilgjengelighetsbrudd(
  rot: Element = document.body,
): Promise<Tilgjengelighetsbrudd[]> {
  const resultat = await axe.run(rot, {
    runOnly: { type: "tag", values: WCAG_AA },
    resultTypes: ["violations"],
  })

  return resultat.violations.map((brudd) => ({
    regel: brudd.id,
    forklaring: brudd.help,
    elementer: brudd.nodes.map((node) => node.html),
  }))
}

/**
 * Kaster med en lesbar oppsummering hvis axe finner brudd.
 *
 * Feilmeldingen skal si hvilken regel som ryker og på hvilket element, slik
 * at den som får testen rød slipper å kjøre axe manuelt for å forstå hva som
 * er galt.
 */
export async function forventIngenTilgjengelighetsbrudd(
  rot: Element = document.body,
): Promise<void> {
  const brudd = await finnTilgjengelighetsbrudd(rot)
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
 */
export function ventPaTegning(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

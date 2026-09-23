/**
 * Grunnlaget web-komponentene arver fra, og registreringen av dem.
 *
 * `HTMLElement` og `customElements` finnes bare i nettleseren. En
 * `class X extends HTMLElement` blir evaluert i det modulen lastes, så en
 * server som bare ville hente `fs.button()` fra pakken stoppet med
 * «HTMLElement is not defined» før den kom så langt. Det rammet ni av
 * inngangspunktene, hovedinngangen inkludert, og gjorde pakken ubrukelig i
 * nettopp den situasjonen den er bygd for: at serveren skriver markupen.
 *
 * Reserven er en tom klasse. Den blir aldri brukt til noe, for uten
 * `customElements` blir ingenting registrert, og uten registrering lager
 * nettleseren aldri en forekomst. Den finnes bare for at modulen skal kunne
 * lastes.
 */
export const HostElement =
  typeof HTMLElement === "undefined"
    ? (class {} as unknown as typeof HTMLElement)
    : HTMLElement

/**
 * Registrerer et egendefinert element, én gang, og bare i nettleseren.
 *
 * Kalles `defineFs*` fra en modul som også kjøres på serveren, som i
 * TanStack Start eller en React-app med server-rendring, skal det ikke skje
 * noe. Der finnes det ingen `customElements` å registrere i.
 */
export function defineElement(
  tagName: string,
  element: CustomElementConstructor,
): void {
  if (typeof customElements === "undefined") return
  if (!customElements.get(tagName)) customElements.define(tagName, element)
}

/**
 * Sier fra når markupen en komponent fikk, ikke henger sammen.
 *
 * En komponent som ikke finner delene sine kan ikke gjøre jobben, og det
 * eneste alternativet til en beskjed er stillhet. Det var stillhet lenge:
 * en mal uten en kontroll i `<fs-field>` ga et felt uten kobling, og
 * ingenting sa fra før noen leste siden med skjermleser.
 *
 * Beskjeden kommer én gang per element og melding. En komponent
 * synkroniserer seg ved hver patch, og en advarsel per patch ville fylt
 * konsollen så fort at den ble ubrukelig. Meldingen må derfor være den
 * samme hver gang: interpolerer du et tall inn i den, er hver runde en ny
 * melding, og dedupliseringen er borte.
 *
 * `stillBroken` er grunnen til at advarselen kan stoles på. Den kalles på
 * nytt når siden har falt til ro, og bare da skrives noe ut. En komponent
 * ser markupen sin i det den kobles til, og der er den ofte halvferdig:
 * HTML som strømmer fra en Go- eller Kotlin-server leveres i pakker, og et
 * brudd midt mellom ledeteksten og feltet er helt vanlig. Uten den siste
 * sjekken advarte komponenten om markup som var i orden et øyeblikk senere,
 * og en advarsel som også kommer på riktig markup blir slått av.
 *
 * Den kommer i alle miljøer, ikke bare under utvikling. Pakken har ingen
 * byggetrinn som kunne fjernet den, og en advarsel som bare utløses av
 * markup som faktisk er gal, hører hjemme der den skjer.
 */
const reported = new WeakMap<Element, Set<string>>()
const queued = new WeakMap<Element, Set<string>>()

export function warnAboutMarkup(
  element: Element,
  message: string,
  stillBroken: () => boolean,
): void {
  if (typeof console === "undefined") return
  if (reported.get(element)?.has(message)) return

  let pending = queued.get(element)
  if (!pending) {
    pending = new Set()
    queued.set(element, pending)
  }
  if (pending.has(message)) return
  pending.add(message)

  whenSettled(() => {
    pending.delete(message)
    if (!element.isConnected || !stillBroken()) return

    let said = reported.get(element)
    if (!said) {
      said = new Set()
      reported.set(element, said)
    }
    if (said.has(message)) return
    said.add(message)

    console.warn(`${element.tagName.toLowerCase()}: ${message}`, element)
  })
}

/**
 * Kjører etter at siden har falt til ro.
 *
 * Først må parseren være ferdig, ellers ser vi bare den delen av markupen
 * som har rukket å komme. Så to tegninger, slik at en morfing, en
 * React-hydrering eller et skript som fyller elementet i neste oppgave
 * rekker å bli ferdig først.
 */
function whenSettled(run: () => void): void {
  let done = false
  const once = () => {
    if (done) return
    done = true
    run()
  }

  const afterTwoFrames = () => {
    if (typeof requestAnimationFrame === "undefined") {
      once()
      return
    }
    /*
     * En reserve, fordi `requestAnimationFrame` ikke alltid fyrer i en ramme
     * som ikke tegnes. Testet i en `<iframe>` med `display: none`: Chromium
     * og WebKit fyrer likevel, Firefox gjør det ikke. Uten reserven ble
     * meldingen stående i køen for alltid der, og sperret en senere, ekte
     * advarsel om det samme.
     *
     * Den avlyses i det første rammen fyrer. Ellers kunne den vunnet kappløpet
     * på en travel maskin, og da ville sjekken kjørt før siden var ferdig, som
     * er akkurat det utsettelsen finnes for å unngå.
     */
    const reserve = setTimeout(once, 500)
    requestAnimationFrame(() => {
      clearTimeout(reserve)
      requestAnimationFrame(once)
    })
  }

  if (typeof document !== "undefined" && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", afterTwoFrames, {
      once: true,
    })
    return
  }

  afterTwoFrames()
}

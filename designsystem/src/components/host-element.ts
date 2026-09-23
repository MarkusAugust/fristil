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
 * Sier fra når markupen komponenten fikk, ikke henger sammen.
 *
 * En komponent som ikke finner delene sine kan ikke gjøre jobben, og det
 * eneste alternativet til en beskjed er stillhet. Det var stillhet lenge:
 * en mal uten en kontroll i `<fs-field>` ga et felt uten kobling, og
 * ingenting sa fra før noen leste siden med skjermleser.
 *
 * Meldingen kommer én gang per element og melding. En komponent synkroniserer
 * seg selv ved hver patch, og en advarsel per patch ville fylt konsollen så
 * fort at den ble ubrukelig.
 *
 * Den kommer i alle miljøer, ikke bare under utvikling. Pakken har ingen
 * byggetrinn som kunne fjernet den, og en advarsel som bare utløses av markup
 * som faktisk er gal, hører hjemme der den skjer.
 */
const meldte = new WeakMap<Element, Set<string>>()

export function meldMangel(element: Element, melding: string): void {
  if (typeof console === "undefined") return

  let sett = meldte.get(element)
  if (!sett) {
    sett = new Set()
    meldte.set(element, sett)
  }
  if (sett.has(melding)) return
  sett.add(melding)

  console.warn(`${element.tagName.toLowerCase()}: ${melding}`, element)
}

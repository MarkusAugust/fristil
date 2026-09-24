/**
 * Å bruke attributtene på et element i vanlig DOM.
 *
 * I JSX sprer du objektet rett inn i elementet. Uten JSX måtte du løkke
 * gjennom det selv, og passe på å fjerne attributter fra forrige tilstand.
 * Går et felt fra ugyldig til gyldig, utelater byggeren `data-state`, og et
 * `setAttribute` alene ville latt den gamle verdien bli stående.
 */

/**
 * Attributtene byggerne kan sende ut.
 *
 * Lista er lukket, og `setAttributes` rydder bare i disse. Konsumentens egne
 * attributter, som `data-testid` og hva det måtte være, røres ikke.
 */
const SYSTEM_ATTRIBUTES = [
  "type",
  "data-variant",
  "data-state",
  "data-color",
  "data-size",
  "data-picker",
  "data-required",
  "data-optional",
  "aria-invalid",
  "aria-disabled",
  "aria-describedby",
  "disabled",
  "multiple",
  "accept",
  "hidden",
  "open",
] as const

/** Klassene systemet eier. Konsumentens egne klasser beholdes. */
const IS_SYSTEM_CLASS = /^fs-/

/**
 * Verdiene en byggefunksjon kan sende ut.
 *
 * `true` og `false` er med fordi flere av dem er boolske HTML-attributter:
 * `disabled` på en bryter, `multiple` på et filfelt, `hidden` på en
 * feilmelding. I HTML er et slikt attributt sant så lenge det finnes, uansett
 * verdi, så `true` settes som tom streng og `false` fjerner det.
 */
export type Attributes = Record<string, string | boolean | undefined>

/**
 * Setter attributtene fra en `fs`-funksjon på et element.
 *
 * ```ts
 * import { fs } from "@fristil/designsystem"
 *
 * const felt = document.querySelector("input")
 * fs.setAttributes(felt, fs.input({ type: "email", state: "invalid" }))
 * ```
 *
 * Kall den på nytt for å endre tilstand. Attributter fra forrige kall som
 * ikke er med i det nye settet, fjernes, men bare systemets egne, og bare
 * `fs-`-klassene. Alt annet på elementet står som det står.
 *
 * Den tar `null`, og gjør da ingenting. `document.querySelector()` gir
 * `Element | null`, så uten det måtte hvert eneste kallsted i en `strict`-app
 * skrive en vakt eller et utropstegn rundt et oppslag som nesten alltid
 * treffer. Det er den samme avveiningen som `element?.classList`.
 */
export function setAttributes(
  element: Element | null | undefined,
  attributes: Attributes,
): void {
  if (!element) return

  const newClass = attributes.class

  if (typeof newClass === "string") {
    const ownClasses = [...element.classList].filter(
      (klasse) => !IS_SYSTEM_CLASS.test(klasse),
    )
    element.className = [...new Set([...newClass.split(/\s+/), ...ownClasses])]
      .filter(Boolean)
      .join(" ")
  }

  for (const name of SYSTEM_ATTRIBUTES) {
    setOrRemove(element, name, attributes[name])
  }

  // Attributter utenfor den lukkede lista settes, men ryddes aldri bort.
  // Systemet kan ikke vite om de er dets egne.
  for (const [name, value] of Object.entries(attributes)) {
    if (name === "class") continue
    if ((SYSTEM_ATTRIBUTES as readonly string[]).includes(name)) continue
    if (value === undefined || value === false) continue
    element.setAttribute(name, value === true ? "" : value)
  }
}

function setOrRemove(
  element: Element,
  name: string,
  value: string | boolean | undefined,
): void {
  if (value === undefined || value === false) {
    element.removeAttribute(name)
  } else {
    element.setAttribute(name, value === true ? "" : value)
  }
}

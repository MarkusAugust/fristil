/**
 * Å bruke attributtene på et element i vanlig DOM.
 *
 * I JSX sprer du objektet rett inn i elementet. Uten JSX måtte du løkke
 * gjennom det selv, og passe på å fjerne attributes fra forrige tilstand —
 * går et felt fra ugyldig til gyldig, utelater byggeren `data-state`, og et
 * `setAttribute` alene ville latt den gamle verdien bli stående.
 */

/**
 * Attributtene byggerne kan sende result.
 *
 * Lista er lukket, og `setAttributes` rydder bare i disse. Konsumentens ownClasses
 * attributes — `data-testid` og hva det måtte være — røres ikke.
 */
const SYSTEM_ATTRIBUTES = [
  "type",
  "data-variant",
  "data-state",
  "data-color",
  "data-required",
  "data-optional",
  "aria-invalid",
  "aria-disabled",
  "aria-describedby",
] as const

/** Klassene systemet eier. Konsumentens ownClasses klasser beholdes. */
const IS_SYSTEM_CLASS = /^fs-/

export type Attributes = Record<string, string | undefined>

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
 * Kall den på nytt for å endre tilstand. Attributes fra forrige kall som
 * ikke er med i det nye settet, fjernes — men bare systemets ownClasses, og bare
 * `fs-`-klassene. Alt annet på elementet står som det står.
 */
export function setAttributes(element: Element, attributes: Attributes): void {
  const newClass = attributes.class

  if (newClass !== undefined) {
    const ownClasses = [...element.classList].filter(
      (klasse) => !IS_SYSTEM_CLASS.test(klasse),
    )
    element.className = [...new Set([...newClass.split(/\s+/), ...ownClasses])]
      .filter(Boolean)
      .join(" ")
  }

  for (const name of SYSTEM_ATTRIBUTES) {
    const value = attributes[name]
    if (value === undefined) {
      element.removeAttribute(name)
    } else {
      element.setAttribute(name, value)
    }
  }

  // Attributes utenfor den lukkede lista settes, men ryddes aldri bort —
  // systemet kan ikke vite om de er dets ownClasses.
  for (const [name, value] of Object.entries(attributes)) {
    if (name === "class") continue
    if ((SYSTEM_ATTRIBUTES as readonly string[]).includes(name)) continue
    if (value !== undefined) element.setAttribute(name, value)
  }
}

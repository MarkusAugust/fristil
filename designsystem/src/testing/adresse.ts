/**
 * Setter adressen før en test, eller tømmer den, uten `history.replaceState`.
 *
 * WebKit kaster etter hundre kall til `replaceState` på ti sekunder, og
 * komponentene bruker av de samme kallene hver gang en fane velges. Da
 * testene selv også brukte dem, nådde fanetestene grensen, og hver test etter
 * det feilte i WebKit. `location.hash` teller ikke med (prøvd i alle tre
 * motorene).
 *
 * Siden tømmes først, så navigasjonen ikke treffer komponenter fra forrige
 * test, og `hashchange` ventes ut, så den ikke kommer inn i testen.
 */
export async function settAdresse(hash: string): Promise<void> {
  document.body.innerHTML = ""
  const fragment = hash.replace(/^#/, "")
  if (location.hash.slice(1) === fragment) return
  const endret = new Promise<void>((ferdig) =>
    window.addEventListener("hashchange", () => ferdig(), { once: true }),
  )
  location.hash = fragment
  await endret
}

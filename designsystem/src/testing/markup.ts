/**
 * Gjør et attributtsett fra en `fs`-bygger om til HTML.
 *
 * Testene skal skrive markupen slik en server ville gjort det, altså med
 * byggeren, og ikke håndskrive attributtene. Gjør de det siste, kan markupen
 * i testen si noe annet enn den byggeren faktisk sender ut, og da måler vi
 * ikke det konsumenten får.
 */
export function attr(values: Record<string, unknown>): string {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([name, value]) =>
      value === true
        ? name
        : `${name}="${String(value).replace(/"/g, "&quot;")}"`,
    )
    .join(" ")
}

/**
 * Adressen til Markdown-utgaven av en side, regnet ut fra sidens egen adresse.
 *
 * `/components/button/` har sin på `/components/button.md`, og forsiden sin på
 * `/index.md`. Det er samme form som regelbøkene på `/agent/<navn>.md`, og den
 * llmstxt.org foreslår: siden med `.md` på, ikke en egen mappe ved siden av.
 *
 * Både `<link rel="alternate">` i sidehodet og lenkene i `llms.txt` regnes ut
 * her. Integrasjonen som skriver filene, leser adressen av lenken i den bygde
 * siden, så det finnes bare én regel for hvor fila ligger.
 */
export function markdownAdresse(sti: string): string {
  const uten = sti.replace(/\/+$/, "")

  return `${uten === "" ? "/index" : uten}.md`
}

/**
 * The address of the Markdown version of a page, computed from the page's own
 * address.
 *
 * `/components/button/` has its own at `/components/button.md`, and the front
 * page at `/index.md`. It is the same form as the rulebooks at
 * `/agent/<name>.md`, and the one llmstxt.org suggests: the page with `.md`
 * added, not a separate folder alongside.
 *
 * Both `<link rel="alternate">` in the page head and the links in `llms.txt`
 * are computed here. The integration that writes the files reads the address
 * from the link in the built page, so there is only one rule for where the
 * file is.
 */
export function markdownAdresse(sti: string): string {
  const uten = sti.replace(/\/+$/, "")

  return `${uten === "" ? "/index" : uten}.md`
}

/**
 * Sjekker markup mot Fristil, utenfor nettleseren.
 *
 * `diagnoseMarkup(html)` er den samme sjekken som editorutvidelsene kjører
 * mens du skriver, og som `fristil sjekk` kjører på kommandolinjen. Den
 * finnes her fordi markup som blir til uten JavaScript, i en Go-mal, en
 * Kotlin-streng eller en Razor-visning, ikke har noen kompilator som ser
 * på attributtene. En test i appen kan da kjøre den over HTML-en serveren
 * faktisk sender:
 *
 * ```ts
 * import { diagnosePage } from "@fristil/designsystem/diagnostics"
 *
 * expect(diagnosePage(html)).toEqual([])
 * ```
 *
 * Sjekken er kjernen, skrevet i Rust og bygget til WebAssembly (se
 * `core.ts`). Modulen følger pakken, og lastes første gang en av funksjonene
 * kalles, i Node, Bun og Deno. I nettleseren, eller der modulen er pakket med
 * på en annen måte, laster `loadCore` den.
 */

import type { Finding } from "./core.js"
import { defaultCore } from "./default-core.js"

export {
  type Core,
  type CoreStyles,
  type CoreTheme,
  type CoreThemeReport,
  type CoreVersion,
  type Finding,
  type Fix,
  loadCore,
  type Severity,
  type Violation,
} from "./core.js"

/** Valg for sjekken. */
export type DiagnoseOptions = {
  /**
   * Stilarkene siden laster, som tekst. Med dem sier sjekken også fra om en
   * klasse ingen av dem styler, som når stilarket til komponenten ikke er
   * lastet, og om en verdi uten regel, som en variant lagt til i en overtatt
   * komponent uten at CSS-en fikk den.
   */
  css?: string[]
}

/** Alle funn i teksten: ordforrådet, for en mal eller en bit av en side. */
export function diagnoseMarkup(
  text: string,
  options: DiagnoseOptions = {},
): Finding[] {
  return options.css
    ? defaultCore().diagnoseStyled(text, options.css, false)
    : defaultCore().diagnoseMarkup(text)
}

/**
 * Alle funn på en hel side: det `diagnoseMarkup` finner, og i tillegg at
 * hver `for`, `aria-describedby`, `aria-labelledby` og `aria-controls` peker
 * på en id som finnes, at ingen id står to ganger, og at hvert Fristil-felt
 * og hver hjelpetekst og feilmelding er koblet.
 *
 * Bruk den på HTML-en serveren sender, ikke på en mal: i en mal som er delt
 * i biter, kan id-en stå i en annen fil.
 *
 * ```ts
 * const html = await (await fetch("http://localhost:8080/skjema")).text()
 * expect(diagnosePage(html)).toEqual([])
 * ```
 */
export function diagnosePage(
  text: string,
  options: DiagnoseOptions = {},
): Finding[] {
  return options.css
    ? defaultCore().diagnoseStyled(text, options.css, true)
    : defaultCore().diagnosePage(text)
}

/** Det `diagnoseRendered` trenger av en side: `evaluate`, som i Playwright. */
export type RenderedPage = {
  evaluate<T>(script: () => Promise<T>): Promise<T>
}

/**
 * Leser den rendrede siden i nettleseren: DOM-en slik den står nå, og
 * teksten i hvert stilark, med det de importerer. Et stilark fra en annen
 * opprinnelse, som et CDN, kan ikke leses gjennom CSSOM uten `crossorigin`,
 * og hentes da på nytt med `fetch`.
 *
 * Funksjonen kjøres i nettleseren, og kan ikke bruke noe utenfor seg selv.
 */
export const READ_RENDERED_PAGE = async (): Promise<{
  html: string
  css: string[]
}> => {
  const sheets: CSSStyleSheet[] = [
    ...document.styleSheets,
    ...document.adoptedStyleSheets,
  ]
  const css: string[] = []
  const read = async (sheet: CSSStyleSheet): Promise<void> => {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      if (!sheet.href) return
      const answer = await fetch(sheet.href)
      if (!answer.ok)
        throw new Error(
          `Stilarket ${sheet.href} kunne ikke leses, og svarte ${answer.status} da det ble hentet på nytt.`,
        )
      css.push(await answer.text())
      return
    }
    for (const rule of rules)
      if (rule instanceof CSSImportRule && rule.styleSheet)
        await read(rule.styleSheet)
    css.push([...rules].map((rule) => rule.cssText).join("\n"))
  }
  for (const sheet of sheets) await read(sheet)
  const doctype = document.doctype ? `<!DOCTYPE ${document.doctype.name}>` : ""
  return { html: doctype + document.documentElement.outerHTML, css }
}

/**
 * Sjekker siden slik nettleseren har rendret den, med stilarkene den har
 * lastet: det `diagnosePage` finner, og det stilarkene ikke styler. Markup
 * web-komponentene har lagt til, og en klasse JavaScript har satt, er med.
 *
 * ```ts
 * import { diagnoseRendered } from "@fristil/designsystem/diagnostics"
 *
 * await page.goto("http://localhost:8080/skjema")
 * expect(await diagnoseRendered(page)).toEqual([])
 * ```
 *
 * `page` er en Playwright-side, eller hva som helst med `evaluate`.
 */
export async function diagnoseRendered(page: RenderedPage): Promise<Finding[]> {
  const { html, css } = await page.evaluate(READ_RENDERED_PAGE)
  return defaultCore().diagnoseStyled(html, css, true)
}

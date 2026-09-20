/**
 * Den lille biten av Vites typer testene trenger.
 *
 * `vite/client` ville tatt med seg hele settet, og med to versjoner av Vite i
 * avhengighetstreet kolliderer de med hverandre. Her står bare `import.meta.glob`,
 * som er det `pakke-css.browser.test.ts` bruker for å lese stilarkene som tekst.
 */
interface ImportMeta {
  glob<T = unknown>(
    pattern: string,
    options?: { query?: string; import?: string; eager?: boolean },
  ): Record<string, T>
}

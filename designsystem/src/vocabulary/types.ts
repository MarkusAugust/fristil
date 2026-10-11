/**
 * Formen på ordforrådet: elementene og klassene Fristil har.
 *
 * `elements.ts` og `classes.ts` ved siden av genereres av
 * `scripts/generate-ordforrad.ts`, og er kilden manifestet skrives fra
 * (`scripts/generate-manifest.ts`). Kjernen og alle verktøyene leser
 * manifestet, ikke disse filene, så de er ikke en del av pakkens API.
 */

export type Attribute = (
  | { type: "flag" | "text" | "number" }
  | { type: "values"; values: readonly string[] }
) & { description?: string }

/**
 * En del av et element, som kontrollen i `<fs-field>`. `selector` er den
 * komponenten finner delen med, relativt til elementet. `content` er hva
 * delen tar: `text` er tekst og frasering uten interaktive elementer, `free`
 * fritt innhold, `parts` bare de andre delene, og `none` ingenting du
 * skriver selv. Uten `multiple` gjelder den første. Uten `optional` trenger
 * elementet delen.
 */
export type Part = {
  selector: string
  description: string
  content: "text" | "free" | "parts" | "none"
  multiple?: true
  optional?: true
}

/**
 * En hendelse et element sender, som `dialog-toggle`. `detail` er feltene i
 * `event.detail` med typen sin, og mangler når hendelsen ikke har noe.
 */
export type ElementEvent = {
  detail?: Record<string, "boolean" | "string" | "number">
}

export type Element = {
  link: string
  description?: string
  attributes: Record<string, Attribute>
  /** Tom for elementene som lager alt innholdet sitt selv. */
  parts?: Record<string, Part>
  events?: Record<string, ElementEvent>
}

/** Innholdet i `elements.ts`: tagg til element. */
export type Elements = Record<string, Element>

/**
 * Et attributt en klasse tar, som `data-variant` på `fs-button`.
 *
 * `flag` er et attributt som virker ved å stå der, som `data-interactive` på
 * `fs-card`. Stilarket spør bare om det finnes, så det har ingen verdier.
 */
export type ClassAttribute = {
  values: readonly string[]
  default?: string
  flag?: true
}

export type ClassInfo = {
  /** Adressen til komponentsiden, som `button`. */
  component: string
  title: string
  description: string
  link: string
  attributes: Record<string, ClassAttribute>
}

/** Innholdet i `classes.ts`: klassenavn til klasse. */
export type Classes = Record<string, ClassInfo>

/**
 * Formen på `manifest.json`, slik `manifest.schema.json` beskriver den.
 * Elementene er de samme som i `elements.ts`. Et klasseattributt i
 * manifestet er enten en verdiliste eller et flagg, og et flagg har ingen
 * verdier, ulikt `classes.ts`, der flagget har en tom liste.
 */
export type Manifest = {
  schemaVersion: number
  version: string
  elements: Elements
  classes: Record<
    string,
    Omit<ClassInfo, "attributes"> & {
      attributes: Record<
        string,
        { values?: readonly string[]; default?: string; flag?: true }
      >
    }
  >
}

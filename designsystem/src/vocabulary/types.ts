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
 * fritt innhold, `parts` bare de andre delene, og `none` ingen tekst: delen
 * er en kontroll, som et `<select>` med sine `<option>`, eller et element
 * komponenten fyller. Uten `multiple` gjelder den første, og med `unique` er en
 * del til av samme slag en feil, ikke vanlig innhold. Uten `optional` trenger
 * elementet delen.
 */
export type Part = {
  selector: string
  description: string
  content: "text" | "free" | "parts" | "none"
  multiple?: true
  /** En del til av samme slag er en feil, ikke vanlig innhold. */
  unique?: true
  optional?: true
  /** Delen må ha en id fra serveren; komponenten skriver aldri en. */
  stableId?: true
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
  /** Attributter som er tatt ut, med hva som gjelder i stedet. */
  removed?: Record<string, string>
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
  /** Hva elementet med klassen tar som innhold, med samme ord som delene. */
  content: Part["content"]
  /**
   * Klassen denne er en del av, når den bare er en del av en annen
   * komponents markup, som `fs-card__title` i `fs-card`. Forelderen har en
   * del som treffer den.
   */
  partOf?: string
  /** Delene markupen består av, for klassene med en fast struktur. */
  parts?: Record<string, Part>
  attributes: Record<string, ClassAttribute>
}

/** Innholdet i `classes.ts`: klassenavn til klasse. */
export type Classes = Record<string, ClassInfo>

/**
 * Tokenene i manifestet: det et stilark utenfor pakken kan bygge på.
 * Fargene står som akser med hva de er til, ikke som verdier, siden et tema
 * kan ha andre verdier enn Fristils egne. `components` er komponentvariablene
 * per komponent, med reserven i stilarket som verdi.
 */
export type ManifestTokens = {
  /** Avstandsskalaen, navn til verdi. */
  spacing: Record<string, string>
  breakpoints: Record<string, string>
  containers: Record<string, string>
  colors: {
    /** Familiene, med hva hver er til. */
    families: Record<string, string>
    /** Rollene slik de skrives i CSS, med hva hver er til. */
    roles: Record<string, string>
    /** Lagene bare den nøytrale familien har. */
    layers: Record<string, string>
    /** Hvert `--fs-color-*`-navn pakken sender ut. */
    tokens: readonly string[]
  }
  /** Komponent til variabelnavn til standardverdien. */
  components: Record<string, Record<string, string>>
}

/** Hva et valg i en byggefunksjon tar. */
export type BuilderOptionType =
  | { kind: "values"; values: readonly string[] }
  | { kind: "flag" | "text" | "number" | "textList" }

/** Formen på det en byggefunksjon gir. */
export type BuilderReturns = { optional?: boolean } & (
  | { kind: "attributes" | "text" }
  | { kind: "values"; values: readonly string[] }
  | { kind: "list"; of: BuilderReturns }
  | { kind: "group"; fields: Record<string, BuilderReturns> }
)

/**
 * En byggefunksjon i `fs`, som `button`, med valgene og formen på svaret.
 * `table`, som generatoren bak Kotlin-utgaven bruker, er utelatt her.
 */
export type Builder = {
  name: string
  options: {
    name: string
    required: boolean
    type: BuilderOptionType
    description?: string
  }[]
  returns: BuilderReturns
}

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
  tokens: ManifestTokens
  builders: Builder[]
  classes: Record<
    string,
    Omit<ClassInfo, "attributes"> & {
      attributes: Record<
        string,
        {
          values?: readonly string[]
          default?: string
          flag?: true
          description?: string
        }
      >
    }
  >
}

/**
 * Regnestykket bak `fristil overta <komponent>`.
 *
 * Kommandoen kopierer kildekoden til én komponent inn i prosjektet ditt.
 * Tilpasning gjennom `@layer`, `--fs-*`-variabler og `::part()` dekker
 * utseendet, men ikke «jeg vil at denne komponenten skal oppføre seg
 * annerledes». Da er alternativet enten å leve med det eller å skrive
 * komponenten på nytt fra bunnen. Denne kommandoen er veien imellom.
 *
 * Fila her gjør ingenting med filsystemet, bare med tekst, slik at
 * omskrivingen kan måles i en test. `cli.ts` leser og skriver filene.
 *
 * Det som må skrives om er henvisningene ut av mappa. En komponent peker på
 * naboene sine med relative stier, og de stiene finnes ikke lenger når mappa
 * står i et annet prosjekt. `../shared.js` blir til
 * `@fristil/designsystem/shared`, som fortsatt virker, og som gjør det synlig
 * hva kopien fremdeles henter fra pakken.
 */

/** En fil i pakken, slik `cli.ts` har lest den. */
export type SourceFile = {
  /** Stien i pakken, som «src/components/css/button/button.ts». */
  path: string
  content: string
}

export type PackageExports = Record<
  string,
  string | { import?: string; types?: string }
>

export type PlannedFile = {
  /** Filnavnet alene, som «button.ts». */
  name: string
  content: string
  /** Henvisninger som ble skrevet om, til utskrift etterpå. */
  rewrites: { from: string; to: string }[]
}

export type TakeoverPlan = {
  files: PlannedFile[]
  /** Pakker kopien trenger i prosjektet, som «lit». */
  dependencies: string[]
  /** Stilark kopien fortsatt henter fra pakken. */
  keptImports: string[]
  /**
   * Inngangspunktene kopien tar over for.
   *
   * Kopien beholder klassenavnene, så importerer prosjektet fortsatt
   * `@fristil/designsystem/button.css` i tillegg, finnes komponenten to
   * ganger, og den ene vinner tilfeldig.
   */
  replacedEntries: string[]
}

/**
 * Bygger oppslaget fra en fil i pakken til inngangspunktet som peker på den.
 *
 * `exports` peker på `dist` for JavaScript og på `src` for CSS. Begge føres
 * tilbake til kilden, siden det er kilden som kopieres.
 */
export function buildEntryPoints(
  name: string,
  exports: PackageExports,
): Map<string, string> {
  const entries = new Map<string, string>()

  for (const [subpath, target] of Object.entries(exports)) {
    const file = typeof target === "string" ? target : target.import
    if (!file) continue

    const source = file
      .replace(/^\.\//, "")
      .replace(/^dist\//, "src/")
      .replace(/\.js$/, ".ts")

    entries.set(source, `${name}${subpath.replace(/^\./, "")}`)
  }

  return entries
}

/** Slår sammen en relativ sti med mappa den står i. */
export function resolvePath(fromDirectory: string, relative: string): string {
  const parts = fromDirectory.split("/").filter(Boolean)

  for (const part of relative.split("/")) {
    if (part === "." || part === "") continue
    if (part === "..") parts.pop()
    else parts.push(part)
  }

  return parts.join("/")
}

const IMPORT_PATTERN = /(from\s+|@import\s+)(["'])([^"']+)\2/g

/**
 * Skriver om henvisningene i én fil.
 *
 * Bare stier som peker ut av mappa røres. En nabo i samme mappe blir med i
 * kopien, og skal fortsatt finnes der.
 */
export function rewriteReferences(
  file: SourceFile,
  entryPoints: Map<string, string>,
  /** Stiene til filene som blir med i kopien, som de står i pakken. */
  ownFiles: Set<string>,
): PlannedFile {
  const directory = file.path.slice(0, file.path.lastIndexOf("/"))
  const rewrites: { from: string; to: string }[] = []

  const content = file.content.replace(
    IMPORT_PATTERN,
    (treff, innledning: string, hermetegn: string, specifier: string) => {
      if (!specifier.startsWith(".")) return treff

      const target = resolvePath(directory, specifier)

      // En fil som blir med i kopien skal stå urørt. Sammenligningen går på
      // hele stien: filnavnet alene ville latt `../shared.js` stå så snart
      // mappa selv hadde en `shared.ts`, og kopien hadde pekt ut av seg selv.
      // Importen i koden peker dessuten på «.js», altså filen etter bygging,
      // mens kilden heter «.ts».
      const asSource = target.replace(/\.js$/, ".ts")
      if (ownFiles.has(target) || ownFiles.has(asSource)) return treff

      const entry =
        entryPoints.get(target) ??
        entryPoints.get(target.replace(/\.js$/, ".ts"))

      if (!entry) return treff

      rewrites.push({ from: specifier, to: entry })
      return `${innledning}${hermetegn}${entry}${hermetegn}`
    },
  )

  return { name: file.path.split("/").pop() ?? file.path, content, rewrites }
}

/**
 * Setter sammen hele planen for én komponent.
 *
 * `files` er alle filene i komponentmappa, uten testene: de hører til
 * pakkens eget oppsett og sier ingenting i et annet prosjekt.
 */
export function planTakeover(
  files: SourceFile[],
  entryPoints: Map<string, string>,
): TakeoverPlan {
  const ownFiles = new Set(files.map((fil) => fil.path))
  const planned = files.map((fil) =>
    rewriteReferences(fil, entryPoints, ownFiles),
  )

  const dependencies = new Set<string>()
  const keptImports = new Set<string>()

  for (const fil of planned) {
    for (const treff of fil.content.matchAll(IMPORT_PATTERN)) {
      const specifier = treff[3]
      if (specifier.startsWith(".")) continue

      if (specifier.startsWith("@fristil/")) {
        keptImports.add(specifier)
        continue
      }

      const deler = specifier.split("/")
      dependencies.add(
        specifier.startsWith("@") ? deler.slice(0, 2).join("/") : deler[0],
      )
    }
  }

  const replacedEntries = files
    .map((fil) => entryPoints.get(fil.path))
    .filter((entry): entry is string => entry !== undefined)

  return {
    files: planned,
    dependencies: [...dependencies].sort(),
    keptImports: [...keptImports].sort(),
    replacedEntries: replacedEntries.sort(),
  }
}

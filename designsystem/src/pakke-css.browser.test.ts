/// <reference path="./types/css.d.ts" />

import { beforeAll, describe, expect, it } from "vitest"

import { fs } from "./fs"

/**
 * At stilarkene pakken sender ut holder seg innenfor sitt eget navnerom.
 *
 * En pakke som skal inn i vilkårlige apper kan ikke eie vanlige ord. Vi hadde
 * `.link` og `.srOnly` liggende i `utilities.css`, uten prefiks og utenfor
 * laget. Begge deler er stille feil hos konsumenten: klassen kolliderer med
 * deres egen, og en regel utenfor laget slår deres uansett spesifisitet.
 *
 * Testene her leser stilarkene som tekst, så en ny komponent blir fanget av
 * seg selv uten at noen husker å legge den til.
 */

const stilark = import.meta.glob("./**/*.css", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

/**
 * Fjerner kommentarer, tekststrenger og `url(...)`.
 *
 * Uten det leses `w3.org` inne i en innebygd SVG som klassen `.org`, og
 * testen sier fra om noe som ikke finnes.
 */
function onlyRules(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/url\([^)]*\)/g, " ")
    .replace(/"[^"]*"/g, " ")
    .replace(/'[^']*'/g, " ")
}

/** Stilark som bare samler andre filer, og derfor ikke har regler selv. */
function isBundle(source: string): boolean {
  return onlyRules(source)
    .split("\n")
    .every((line) => line.trim() === "" || line.trim().startsWith("@import"))
}

/**
 * Teller verdiene i en kortform, uten å telle inni `var()` og `calc()`.
 *
 * `padding: var(--size-2) calc(var(--size-4) + var(--size-2))` er to verdier,
 * ikke fem.
 */
function antallVerdier(verdi: string): number {
  let dybde = 0
  let antall = 0
  let ihvit = true

  for (const tegn of verdi.trim()) {
    if (tegn === "(") dybde += 1
    else if (tegn === ")") dybde -= 1

    const hvit = /\s/.test(tegn)
    if (dybde === 0 && !hvit && ihvit) antall += 1
    if (dybde === 0) ihvit = hvit
  }

  return antall
}

/** Klasseselektorene i en fil, uten duplikater. */
function classNames(source: string): string[] {
  const found = onlyRules(source).match(/\.[a-zA-Z_][\w-]*/g) ?? []
  return [...new Set(found.map((name) => name.slice(1)))]
}

/**
 * Tailwind-temaet er ikke et komponentstilark.
 *
 * Det er en `@theme`-blokk som gir Tailwind Fristils verdier, så det ligger
 * med vilje utenfor laget og definerer variabler i Tailwinds navnerom.
 * Reglene under gjelder derfor ikke der, men fila har sine egne lenger nede.
 */
const erTailwindtema = (navn: string) => navn.includes("/tailwind/")

const filer = Object.entries(stilark).filter(
  ([navn, source]) => !isBundle(source) && !erTailwindtema(navn),
)

describe("stilarkene pakken sender ut", () => {
  it("har stilark å kontrollere", () => {
    expect(filer.length).toBeGreaterThan(5)
  })

  it.each(filer)("%s ligger i @layer fristil", (_navn, source) => {
    // `@import` må stå først i en CSS-fil, så den delen hoppes over.
    const utenImport = onlyRules(source)
      .split("\n")
      .filter((line) => !line.trim().startsWith("@import"))
      .join("\n")

    expect(utenImport.trimStart().startsWith("@layer fristil")).toBe(true)
  })

  it.each(filer)("%s bruker bare fs-prefikserte klasser", (_navn, source) => {
    const uprefiksert = classNames(source).filter(
      (name) => !name.startsWith("fs-"),
    )
    expect(uprefiksert).toEqual([])
  })

  /*
   * Komponentene skal speilvende seg selv i språk som skrives høyre mot
   * venstre. Det krever logiske egenskaper hele veien: `margin-inline-start`
   * framfor `margin-left`. En enkelt `padding-left` er nok til at en
   * komponent står feil, og det synes ikke før noen bytter språk.
   *
   * `background-position` har ingen logisk variant, og snus med `:dir(rtl)`.
   */
  it.each(
    filer,
  )("%s bruker logiske egenskaper, ikke venstre og høyre", (_navn, source) => {
    const fysiske = [
      ...onlyRules(source).matchAll(
        /(?:^|[\s;{])((?:margin|padding|border)-(?:left|right)|left|right|text-align)\s*:\s*([^;}]+)/g,
      ),
    ]
      .filter(([, egenskap, verdi]) =>
        egenskap === "text-align" ? /\b(left|right)\b/.test(verdi) : true,
      )
      .map(([, egenskap]) => egenskap)

    expect([...new Set(fysiske)]).toEqual([])
  })

  /*
   * Fire verdier i `padding`, `margin` eller `inset` er over, høyre, under,
   * venstre. To av dem er fysiske sider, og de snur ikke med språket.
   * `.fs-select` hadde `padding: … calc(…) … var(--size-3)` for å holde av
   * plass til pila si, og i RTL ble plassen liggende på feil side mens
   * teksten la seg oppå pila. Tre verdier er trygt: da er den midterste
   * begge de fysiske sidene, og lik på begge.
   */
  it.each(filer)("%s bruker ikke fysiske firverdier", (_navn, source) => {
    const feil = [
      ...onlyRules(source).matchAll(
        /(?:^|[\s;{])(padding|margin|inset|border-width|border-color|border-style)\s*:\s*([^;}]+)/g,
      ),
    ]
      .filter(([, , verdi]) => antallVerdier(verdi) >= 4)
      .map(([, egenskap, verdi]) => `${egenskap}: ${verdi.trim()}`)

    expect(feil).toEqual([])
  })

  /*
   * Fokusringen skal komme fra `--semantic-focus-ring`, ikke skrives ut.
   *
   * Den sto med bredde og farge i tjue regler fordelt på atten stilark.
   * Selektorene er forskjellige i hver komponent, så det lot seg ikke samle
   * i én regel, men verdien er den samme overalt og hører i et token. En
   * komponent som trenger en annen farge, som hopplenken, skriver
   * `outline-color` etter kortformen og arver bredden.
   */
  it.each(filer)("%s skriver ikke ut fokusringen for hånd", (navn, source) => {
    if (navn.includes("/tokens/")) return

    const skrevet = [
      ...onlyRules(source).matchAll(/outline:\s*([^;}]*\bsolid\b[^;}]*)/g),
    ].map((treff) => treff[1].trim())

    expect(skrevet).toEqual([])
  })

  it.each(filer)("%s navngir klassene i kebab-case", (_navn, source) => {
    const feilform = classNames(source).filter(
      (name) =>
        !/^fs-[a-z0-9]+(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?$/.test(name),
    )
    expect(feilform).toEqual([])
  })
})

describe("variablene komponentene leser", () => {
  const komponentfiler = filer.filter(([navn]) => !navn.includes("/tokens/"))

  it.each(
    komponentfiler,
  )("%s definerer ingen egne variabler utenfor fs-navnerommet", (_navn, source) => {
    const definert = [
      ...onlyRules(source).matchAll(/^\s*(--[\w-]+)\s*:/gm),
    ].map((treff) => treff[1])
    expect(definert.filter((name) => !name.startsWith("--fs-"))).toEqual([])
  })

  it.each(
    komponentfiler,
  )("%s leser bare tokens og egne komponentvariabler", (_navn, source) => {
    const lest = [...onlyRules(source).matchAll(/var\((--[\w-]+)/g)].map(
      (treff) => treff[1],
    )
    const ukjente = lest.filter(
      (name) =>
        !name.startsWith("--fs-") &&
        !name.startsWith("--semantic-") &&
        !name.startsWith("--size") &&
        !name.startsWith("--font-size"),
    )
    expect([...new Set(ukjente)]).toEqual([])
  })
})

describe("tokenene komponentene faller tilbake på", () => {
  const tokens = Object.entries(stilark).find(([navn]) =>
    navn.endsWith("/tokens/tokens.css"),
  )?.[1]

  const definerte = new Set(
    [...(tokens ?? "").matchAll(/^\s*(--[\w-]+)\s*:/gm)].map(
      (treff) => treff[1],
    ),
  )

  const komponentfiler = filer.filter(([navn]) => !navn.includes("/tokens/"))

  it.each(
    komponentfiler,
  )("%s viser bare til tokens som finnes", (_navn, source) => {
    // `var(--fs-x, var(--size-7))` med et token som ikke finnes gir en ugyldig
    // verdi, ikke en reserve. Ikonknappen i datofeltet ble 16 piksler bred i
    // stedet for 28 på nøyaktig denne måten, uten at noe sa fra.
    const lest = [...onlyRules(source).matchAll(/var\((--[\w-]+)/g)].map(
      (treff) => treff[1],
    )
    const manglende = [...new Set(lest)].filter(
      (name) => !name.startsWith("--fs-") && !definerte.has(name),
    )
    expect(manglende).toEqual([])
  })
})

describe("Tailwind-temaet", () => {
  const tema = Object.entries(stilark).find(([navn]) =>
    erTailwindtema(navn),
  )?.[1]

  it("finnes", () => {
    expect(tema).toBeTypeOf("string")
  })

  it("legger bare til navn i fs-navnerommet", () => {
    const definert = [
      ...onlyRules(tema ?? "").matchAll(/^\s*(--[\w-]+)\s*:/gm),
    ].map((treff) => treff[1])

    // `--spacing` er unntaket, og med vilje: det er Tailwinds avstandsenhet,
    // og hele poenget er at `p-4` skal bli `--size-4`.
    const utenfor = definert.filter(
      (navn) =>
        navn !== "--spacing" &&
        !/^--(color|text|container|shadow|font|radius|leading|tracking|breakpoint)-fs-/.test(
          navn,
        ),
    )

    expect(utenfor).toEqual([])
  })

  it("henter alle verdiene fra Fristils tokens", () => {
    const lest = [...onlyRules(tema ?? "").matchAll(/var\((--[\w-]+)/g)].map(
      (treff) => treff[1],
    )

    const fremmede = lest.filter(
      (navn) =>
        !navn.startsWith("--semantic-") &&
        !navn.startsWith("--palette-") &&
        !navn.startsWith("--size") &&
        !navn.startsWith("--font-size"),
    )

    expect([...new Set(fremmede)]).toEqual([])
  })
})

/**
 * At hver lovlige verdi en bygger reklamerer med, finnes i CSS-en.
 *
 * `fs.badge.colors` inneholdt `info` i over et halvt år uten at
 * `badge.css` hadde en regel for den. Attributtet ble skrevet, ingenting
 * skjedde, og merket så ut som standarden. Byggeren lovet altså noe pakken
 * ikke leverte, og ingen prøve så det: `dom.browser.test.ts` sjekker at
 * verdien kan settes og fjernes, ikke at den betyr noe.
 *
 * Standardverdien er unntaket, og den kjenner vi igjen på at byggeren ikke
 * sender ut attributtet i det hele tatt for den.
 */
describe("hver lovlig verdi finnes i CSS-en", () => {
  // Stilarkene må stå i dokumentet for at beregnet stil skal si noe. De
  // hentes fra den samme glob-en som resten av fila leser som tekst, så
  // ingen liste kan komme i utakt.
  /*
   * `onlyRules` fjerner tekststrenger, og en attributtverdi i en selektor er
   * nettopp det: `[data-color="success"]` ble til `[data-color= ]`. Her
   * fjernes bare kommentarer og `url(...)`, som er det som ellers gir falske
   * treff.
   */
  const alleRegler = Object.values(stilark)
    .map((kilde) =>
      kilde.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/url\([^)]*\)/g, " "),
    )
    .join("\n")

  /**
   * Selektorene som faktisk gjelder i denne motoren, hentet fra CSSOM.
   *
   * En regel kan stå i stilarket uten å gjøre noe her: `@supports
   * (appearance: base-select)` finnes ikke i Firefox, og `@media
   * (forced-colors: active)` gjelder ikke før modusen er på. Den stylede
   * nedtrekkslista står i begge, og et tekstsøk ser ingen forskjell på dem og
   * en regel som gjelder. Da meldte prøven feil i én av tre motorer på noe
   * som er helt riktig. Nettleseren vet svaret selv, så vi spør den.
   */
  const virksomme: string[] = []

  function samle(regler: CSSRuleList, gjelder: boolean): void {
    for (const regel of Array.from(regler)) {
      if (regel instanceof CSSStyleRule) {
        if (gjelder) {
          for (const del of regel.selectorText.split(","))
            virksomme.push(del.trim())
        }
        samle(regel.cssRules, gjelder)
      } else if (regel instanceof CSSSupportsRule) {
        samle(regel.cssRules, gjelder && CSS.supports(regel.conditionText))
      } else if (regel instanceof CSSMediaRule) {
        samle(
          regel.cssRules,
          gjelder && matchMedia(regel.conditionText).matches,
        )
      } else if (regel instanceof CSSGroupingRule) {
        samle(regel.cssRules, gjelder)
      }
    }
  }

  beforeAll(() => {
    for (const [sti, kilde] of Object.entries(stilark)) {
      const ark = document.createElement("style")
      ark.dataset.fra = sti
      ark.textContent = kilde
      document.head.append(ark)
      if (ark.sheet) samle(ark.sheet.cssRules, true)
    }
  })

  /**
   * Lista på byggeren, opsjonen som velger verdien, og attributtet den
   * havner i.
   *
   * Alle tre står skrevet ut. Utledet vi opsjonsnavnet av flertalls-s-en,
   * ble `markers` til `marker`, mens opsjonen heter `required`. Kallet ga da
   * ingen attributter, og løkka under tolket det som «dette er
   * standardverdien» og hoppet over. Fire verdier ble aldri kontrollert, og
   * ingenting sa fra.
   */
  const LISTER: [liste: string, opsjon: string, attributt: string][] = [
    ["variants", "variant", "data-variant"],
    ["colors", "color", "data-color"],
    ["sizes", "size", "data-size"],
    ["states", "state", "data-state"],
    ["pickers", "picker", "data-picker"],
    ["markers", "required", "data-required"],
    ["types", "type", "data-variant"],
  ]

  type Bygger = ((valg?: Record<string, unknown>) => Record<string, unknown>) &
    Record<string, unknown>

  /** Ett tilfelle: en bygger, en verdi, og elementet den skal treffe. */
  type Tilfelle = {
    navn: string
    liste: string
    klasser: string[]
    attributt: string
    verdi: string
  }

  const tilfeller: Tilfelle[] = []
  const hoppet: string[] = []

  for (const [navn, verdi] of Object.entries(fs)) {
    if (typeof verdi !== "function") continue
    const bygger = verdi as unknown as Bygger

    for (const [liste, opsjon, attributt] of LISTER) {
      const verdier = bygger[liste]
      if (!Array.isArray(verdier)) continue

      for (const v of verdier) {
        const ut = bygger({ [opsjon]: v })

        // Standardverdien gir ikke noe attributt, og har derfor ingen regel.
        if (ut[attributt] === undefined) {
          hoppet.push(`${navn}.${liste}=${v}`)
          continue
        }

        tilfeller.push({
          navn,
          liste: `${navn}.${liste}`,
          klasser: String(ut.class ?? "")
            .split(" ")
            .filter(Boolean),
          attributt,
          verdi: String(ut[attributt]),
        })
      }
    }
  }

  it("har verdier å kontrollere", () => {
    expect(tilfeller.length).toBeGreaterThan(30)
  })

  it("hopper bare over standardverdier", () => {
    // Uten denne kunne en feilstavet opsjon i `LISTER` ta en hel liste ut av
    // prøven uten at noe sa fra: attributtet mangler både når verdien er
    // standarden og når kallet ikke traff.
    const standardverdier = new Set<string>()
    for (const [navn, verdi] of Object.entries(fs)) {
      if (typeof verdi !== "function") continue
      const bygger = verdi as unknown as Bygger
      let standard: Record<string, unknown>
      try {
        standard = bygger()
      } catch {
        continue
      }
      for (const [liste, opsjon, attributt] of LISTER) {
        const verdier = bygger[liste]
        if (!Array.isArray(verdier)) continue
        for (const v of verdier) {
          const ut = bygger({ [opsjon]: v })
          const uten =
            standard[attributt] === undefined && ut[attributt] === undefined
          if (uten) standardverdier.add(`${navn}.${liste}=${v}`)
        }
      }
    }

    expect([...hoppet].sort()).toEqual([...standardverdier].sort())
  })

  it("dekker hver liste med minst ett tilfelle", () => {
    const lister = new Set<string>()
    for (const [navn, verdi] of Object.entries(fs)) {
      if (typeof verdi !== "function") continue
      const bygger = verdi as unknown as Bygger
      for (const [liste] of LISTER) {
        if (Array.isArray(bygger[liste])) lister.add(`${navn}.${liste}`)
      }
    }

    const dekket = new Set(tilfeller.map((t) => t.liste))
    expect([...lister].filter((l) => !dekket.has(l))).toEqual([])
  })

  /**
   * At verdien faktisk gjør noe, ikke bare at selektoren finnes.
   *
   * Et tekstsøk passerer på en regel med tom blokk, på en som bare gjelder i
   * høykontrastmodus, og på en som blir overstyrt lenger nede. Derfor rendres
   * elementet to ganger, med og uten attributtet, og noe i den beregnede
   * stilen må være forskjellig. Pseudoelementene er med, for `data-required`
   * vises bare gjennom `::after`.
   *
   * Noen tilstander farger et barn framfor elementet selv: feltsettet farger
   * `.fs-legend`, og den stripete tabellen farger radene. Da finnes det
   * ingen regel på elementet å sammenligne, og prøven faller tilbake på at
   * selektoren står i et stilark. Fallet er begrenset til nettopp de
   * tilfellene: finnes det en regel på elementet selv, kreves forskjellen.
   */
  it.each(
    tilfeller.map((t) => [t.liste, t.verdi, t] as const),
  )("%s=%s endrer noe", (_liste, _verdi, tilfelle) => {
    // Den nakne selektoren er med fordi noen regler dekker alle verdiene
    // på én gang: `.fs-label[data-required]` gir stjernen uansett om
    // verdien er `symbol` eller `text`.
    const selektorer = tilfelle.klasser.flatMap((klasse) => [
      `.${klasse}[${tilfelle.attributt}="${tilfelle.verdi}"]`,
      `.${klasse}[${tilfelle.attributt}]`,
    ])

    const finnes = selektorer.some((s) => alleRegler.includes(s))
    expect(finnes, `ingen regel for ${selektorer[0]}`).toBe(true)

    /*
     * Kreves en forskjell i beregnet stil? Bare hvis det finnes en regel
     * som gjelder her og som treffer elementet selv. En regel på et barn
     * (feltsettet farger `.fs-legend`) endrer ingenting på elementet, og
     * en regel i en `@supports` eller `@media` som ikke slår til, gjør
     * ingenting i det hele tatt. I begge tilfellene holder det at
     * selektoren står i et stilark.
     */
    const paSegSelv = virksomme.some((regel) =>
      selektorer.some((selektor) => regel === selektor),
    )
    if (!paSegSelv) return

    const uten = document.createElement("span")
    uten.className = tilfelle.klasser.join(" ")
    const med = document.createElement("span")
    med.className = tilfelle.klasser.join(" ")
    med.setAttribute(tilfelle.attributt, tilfelle.verdi)

    document.body.append(uten, med)
    try {
      const ulik = (pseudo?: string) => {
        const a = getComputedStyle(uten, pseudo)
        const b = getComputedStyle(med, pseudo)
        for (let i = 0; i < a.length; i += 1) {
          const navn = a.item(i)
          if (a.getPropertyValue(navn) !== b.getPropertyValue(navn)) return true
        }
        return false
      }

      expect(ulik() || ulik("::after") || ulik("::before")).toBe(true)
    } finally {
      uten.remove()
      med.remove()
    }
  })
})

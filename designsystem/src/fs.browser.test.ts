import { describe, expect, it, vi } from "vitest"

import { fs } from "./fs"

describe("fs: felles form", () => {
  it("gir samme form for alle komponentene: valgobjekt inn, attributter ut", () => {
    expect(fs.button()).toEqual({ class: "fs-button" })
    expect(fs.badge()).toEqual({ class: "fs-badge" })
    expect(fs.link()).toEqual({ class: "fs-link" })
    expect(fs.label()).toEqual({ class: "fs-label" })
    expect(fs.textarea()).toEqual({ class: "fs-textarea" })
    expect(fs.select()).toEqual({ class: "fs-select" })
    expect(fs.helpText()).toEqual({ class: "fs-help-text" })
    expect(fs.errorText()).toEqual({ class: "fs-error-text" })
  })

  it("utelater attributtet når verdien er standardverdien", () => {
    expect(fs.button({ variant: "primary" })).toEqual({ class: "fs-button" })
    expect(fs.button({ variant: "danger" })).toEqual({
      class: "fs-button",
      "data-variant": "danger",
    })
  })

  it("eksponerer lovlige verdier og en vakt på hver komponent", () => {
    expect(fs.button.variants).toContain("ghost")
    expect(fs.button.isVariant("ghost")).toBe(true)
    expect(fs.button.isVariant("gost")).toBe(false)

    expect(fs.badge.colors).toContain("neutral")
    expect(fs.badge.isColor("neutral")).toBe(true)
  })
})

describe("fs.input", () => {
  it("setter type og ikonvariant fra samme verdi", () => {
    // Den vanligste feilen med håndskrevet markup er at data-variant og
    // type kommer i utakt. Her er det umulig.
    expect(fs.input({ type: "date" })).toEqual({
      class: "fs-input",
      type: "date",
      "data-variant": "date",
    })
  })

  it("gir ikke ikonvariant til typer som ikke har et ikon", () => {
    expect(fs.input({ type: "email" })).toEqual({
      class: "fs-input",
      type: "email",
    })
  })

  it("setter aria-invalid sammen med data-state", () => {
    expect(fs.input({ state: "invalid" })).toEqual({
      class: "fs-input",
      type: "text",
      "data-state": "invalid",
      "aria-invalid": "true",
    })

    expect(fs.input({ state: "success" })).toEqual({
      class: "fs-input",
      type: "text",
      "data-state": "success",
    })
  })

  it("deler tilstandstype med textarea og select", () => {
    const tilstand = fs.isState("invalid") ? "invalid" : "default"
    expect(fs.input({ state: tilstand })["data-state"]).toBe("invalid")
    expect(fs.textarea({ state: tilstand })["data-state"]).toBe("invalid")
    expect(fs.select({ state: tilstand })["data-state"]).toBe("invalid")
  })
})

describe("fs.label", () => {
  it("lar required vinne over optional, så bare én markering vises", () => {
    expect(fs.label({ required: "text", optional: true })).toEqual({
      class: "fs-label",
      "data-required": "text",
    })
  })
})

describe("fs.field", () => {
  it("kobler ledetekst og kontroll", () => {
    const felt = fs.field({ id: "epost" })

    expect(felt.label.for).toBe("epost")
    expect(felt.control.id).toBe("epost")
  })

  it("tar hjelpeteksten med i aria-describedby", () => {
    const felt = fs.field({ id: "epost", help: true })

    expect(felt.control["aria-describedby"]).toBe("epost-help")
    expect(felt.help.id).toBe("epost-help")
  })

  it("tar feilmeldingen med bare når feltet er ugyldig", () => {
    const gyldig = fs.field({ id: "epost", help: true, error: true })
    const ugyldig = fs.field({
      id: "epost",
      help: true,
      error: true,
      invalid: true,
    })

    // En skjult feilmelding skal ikke stå i aria-describedby. Da ville
    // skjermleseren pekt på noe som ikke finnes på skjermen.
    expect(gyldig.control["aria-describedby"]).toBe("epost-help")
    expect(gyldig.error.hidden).toBe(true)
    expect(gyldig.control["aria-invalid"]).toBeUndefined()

    expect(ugyldig.control["aria-describedby"]).toBe("epost-help epost-error")
    expect(ugyldig.error.hidden).toBeUndefined()
    expect(ugyldig.control["aria-invalid"]).toBe("true")
  })

  it("gir en tilstand som kan sendes rett inn i input()", () => {
    const felt = fs.field({ id: "epost", invalid: true })

    expect(fs.input({ type: "email", state: felt.state })).toEqual({
      class: "fs-input",
      type: "email",
      "data-state": "invalid",
      "aria-invalid": "true",
    })
  })

  it("tar med ekstra id-er kalleren oppgir", () => {
    const felt = fs.field({
      id: "epost",
      help: true,
      describedBy: ["vilkaar"],
    })

    expect(felt.control["aria-describedby"]).toBe("epost-help vilkaar")
  })

  it("krever en id i typen", () => {
    /*
     * Kravet er en type, og en type kan bare holdes fast av typesjekken.
     * Tilordningene under er testen, og det er `typecheck:tests` som kjører
     * den: blir `id` valgfri igjen, forsvinner feilen, og `@ts-expect-error`
     * blir selv en feil.
     *
     * Uten dette sto kravet uten vaktpost. Den forrige testen het «krever en
     * id» og sa ingenting om kravet: begge påstandene var grønne også med
     * den gamle, valgfrie id-en.
     */
    // @ts-expect-error id er påkrevd
    const utenNoe = () => fs.field()
    // @ts-expect-error id er påkrevd
    const utenId = () => fs.field({ help: true })

    expect(typeof utenNoe).toBe("function")
    expect(typeof utenId).toBe("function")
  })

  it("lager id-er likevel, og sier fra, når JavaScript utelater dem", () => {
    /*
     * En konsument uten TypeScript ser ingen type, og ren HTML med
     * `<script type="module">` er en førsteklasses måte å bruke Fristil på.
     * Uten reserven ble id-ene til strenger som `undefined-help` og
     * `undefined-list`, og `for`, `aria-controls` og `aria-describedby` pekte
     * dit. Koblingen var brutt, og den så gyldig ut.
     *
     * Hver byggefunksjon som tar en id er med. Første utgave hadde reserven bare i
     * `fs.field()`, og da sa forslagsfeltet «fs.field()» i meldingen og sendte
     * utvikleren til feil sted, mens halve id-ene fortsatt ble `undefined-…`.
     */
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    const utenId = <T>(byggefunksjon: (o: unknown) => T, valg: unknown): T =>
      byggefunksjon(valg)

    const felt = utenId(
      fs.field as (o: unknown) => ReturnType<typeof fs.field>,
      {
        help: true,
        error: true,
      },
    )
    expect(felt.control.id).toMatch(/^fs-field-/)
    expect(felt.label.for).toBe(felt.control.id)
    expect(JSON.stringify(felt)).not.toContain("undefined")

    const forslag = utenId(
      fs.suggestion as (o: unknown) => ReturnType<typeof fs.suggestion>,
      { count: 2 },
    )
    expect(JSON.stringify(forslag)).not.toContain("undefined")
    expect(forslag.control["aria-controls"]).toBe(forslag.list.id)

    const faner = utenId(
      fs.tabs as (o: unknown) => ReturnType<typeof fs.tabs>,
      {
        count: 2,
      },
    )
    expect(JSON.stringify(faner)).not.toContain("undefined")

    const vindu = utenId(
      fs.popover as (o: unknown) => ReturnType<typeof fs.popover>,
      {},
    )
    expect(vindu.trigger["aria-controls"]).toBe(vindu.panel.id)

    const boks = utenId(
      fs.dialog as (o: unknown) => ReturnType<typeof fs.dialog>,
      {},
    )
    expect(boks.dialog["aria-labelledby"]).toBe(boks.title.id)

    const meldinger = advarsel.mock.calls.map((k) => String(k[0])).join("\n")
    for (const navn of [
      "fs.field()",
      "fs.suggestion()",
      "fs.tabs()",
      "fs.popover()",
      "fs.dialog()",
    ]) {
      expect(meldinger, `${navn} sa ikke fra`).toContain(navn)
    }

    advarsel.mockRestore()
  })

  it("regner den tomme strengen som ingen id", () => {
    // `fs.field({ id: "" })` slapp gjennom både typen og reserven, og ga
    // `for=""` og `help.id="-help"`. Koblingen var brutt, og ingenting sa fra.
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})

    const felt = fs.field({ id: "  ", help: true })

    expect(felt.control.id).toMatch(/^fs-field-/)
    expect(felt.help.id).toBe(`${felt.control.id}-help`)
    advarsel.mockRestore()
  })
})

describe("fs.field sammen med feltfunksjonene", () => {
  it("overlapper ikke med input(), så attributter ikke settes dobbelt", () => {
    const felt = fs.field({
      id: "epost",
      help: true,
      error: true,
      invalid: true,
    })
    const input = fs.input({ type: "email" })

    const felles = Object.keys(input).filter((navn) => navn in felt.control)

    // I JSX overskriver den siste spredningen den første, men i maler som
    // skriver ut attributtene bokstavelig, som Astro og ren HTML, blir de
    // stående dobbelt. Da er markupen ugyldig.
    expect(felles, "Disse settes av begge").toEqual([])
  })

  it("lar control bære både tilstandsfargen og aria-invalid", () => {
    const felt = fs.field({ id: "epost", invalid: true })

    expect(felt.control["data-state"]).toBe("invalid")
    expect(felt.control["aria-invalid"]).toBe("true")
  })

  it("setter ingen av dem når feltet er gyldig", () => {
    const felt = fs.field({ id: "epost" })

    expect(felt.control["data-state"]).toBeUndefined()
    expect(felt.control["aria-invalid"]).toBeUndefined()
  })
})

/**
 * Hvor mange byggefunksjoner `fs` har, utenom `setAttributes`, `isState` og
 * `isMarker`.
 *
 * Tallet står skrevet her framfor å bli lest ut av lista det skal kontrollere.
 * Ellers sammenligner vakten køen med seg selv, og halve settet kan forsvinne
 * uten at noe sier fra. Legg til en byggefunksjon, og tallet skal opp i samme
 * endring. Merk at summen alene ikke fanger et bytte: legger du til en byggefunksjon
 * og en hjelper samtidig, står tallet stille, og et omdøpt navn endrer det
 * ikke i det hele tatt.
 */
const ANTALL_BYGGEFUNKSJONER = 45

/** De som gir attributter per del framfor ett flatt sett. */
const SAMMENSATTE_NAVN = [
  "dialog",
  "errorSummary",
  "field",
  "popover",
  "sessionTimeout",
  "suggestion",
  "tableSort",
  "tabs",
  "toast",
]

describe("formen på navnerommet", () => {
  /** Byggefunksjonene, altså alt i `fs` som kan kalles uten argumenter. */
  const byggefunksjoner = Object.entries(fs).filter(
    ([navn, verdi]) =>
      typeof verdi === "function" &&
      navn !== "setAttributes" &&
      navn !== "isState" &&
      navn !== "isMarker" &&
      // De sammensatte byggefunksjonene gir ett attributtsett per element i stedet
      // for ett flatt sett, og krever en id for å kunne koble dem sammen.
      !SAMMENSATTE_NAVN.includes(navn),
  ) as [string, () => Record<string, unknown>][]

  it("har byggefunksjoner å kontrollere", () => {
    expect(byggefunksjoner.length).toBe(
      ANTALL_BYGGEFUNKSJONER - SAMMENSATTE_NAVN.length,
    )
  })

  it.each(
    byggefunksjoner,
  )("fs.%s() gir en fs-prefikset klasse uten argumenter", (_navn, byggefunksjon) => {
    const attributter = byggefunksjon()

    expect(typeof attributter.class).toBe("string")
    for (const klasse of String(attributter.class).split(" ")) {
      expect(klasse.startsWith("fs-")).toBe(true)
    }
  })

  it.each(
    byggefunksjoner,
  )("fs.%s() setter ingen tomme attributter", (_navn, byggefunksjon) => {
    const tomme = Object.entries(byggefunksjon())
      .filter(([, verdi]) => verdi === undefined)
      .map(([navn]) => navn)

    // Et attributt med verdien undefined blir «undefined» som streng i maler
    // som skriver ut attributtene bokstavelig, som Astro og ren HTML.
    expect(tomme).toEqual([])
  })
})

describe("attributter bare morferen leser", () => {
  /*
   * Fredning og «ikke rør dette» er ikke egenskaper ved morfing. De er
   * `data-*`-attributter, og et slikt attributt betyr bare noe for koden som
   * leser det. Reparasjonen trenger ingen av dem: komponenten leser markupen.
   *
   * Unntaket er de som eier innholdet sitt selv. En komponent kan sette et
   * attributt tilbake, men den kan ikke gjette seg fram til meldinger den
   * selv lagde og en patch tømte. Der må serverens markup si fra, og navnet
   * på attributtet er morferens.
   *
   * Testen er en folketelling og ikke et forbud. Den feller både et nytt sted
   * attributtet dukker opp, og et sted det forsvinner fra, siden begge er en
   * endring i hva malen må skrive.
   */
  const MORFERATTRIBUTTER = ["data-ignore-morph", "data-preserve-attr"]

  /** Alt i `fs` som ikke er en byggefunksjon. */
  const HJELPERE = ["setAttributes", "isState", "isMarker"]

  /**
   * Ett gyldig kall per byggefunksjon som gir attributter per del framfor ett flatt
   * sett. De fleste av dem krever argumenter. `toast` gjør ikke det, og står
   * her for at lista skal være hele settet.
   */
  const SAMMENSATTE: Record<string, () => unknown> = Object.assign(
    Object.create(null),
    {
      dialog: () => fs.dialog({ titleId: "tittel" }),
      errorSummary: () => fs.errorSummary({ count: 2, id: "feil" }),
      field: () => fs.field({ id: "epost", help: true, error: true }),
      popover: () => fs.popover({ id: "panel" }),
      sessionTimeout: () => fs.sessionTimeout({ titleId: "okt" }),
      suggestion: () => fs.suggestion({ id: "sok", count: 2, open: true }),
      tableSort: () => fs.tableSort({ direction: "ascending" }),
      tabs: () => fs.tabs({ id: "faner", count: 2 }),
      toast: () => fs.toast(),
    },
  )

  const byggefunksjoner = Object.entries(fs).filter(
    ([navn, verdi]) => typeof verdi === "function" && !HJELPERE.includes(navn),
  ) as [string, () => unknown][]

  const kall = ([navn, byggefunksjon]: [string, () => unknown]) =>
    (SAMMENSATTE[navn] ?? byggefunksjon)()

  /** Hvert attributtnavn i svaret, uansett hvor dypt det ligger. */
  function attributtnavn(verdi: unknown, ut: string[] = []): string[] {
    if (Array.isArray(verdi)) {
      for (const del of verdi) attributtnavn(del, ut)
      return ut
    }
    if (verdi && typeof verdi === "object") {
      for (const [navn, del] of Object.entries(verdi)) {
        ut.push(navn)
        attributtnavn(del, ut)
      }
    }
    return ut
  }

  it("har hver byggefunksjon i fs, og bare byggefunksjoner", () => {
    // Uten dette kunne tabellen under vært tom, eller mistet en byggefunksjon som
    // fikk nytt navn, og folketellingen ville stemt likevel. Og en ny vakt i
    // `fs`, som `isColor`, ville blitt kalt som en byggefunksjon og gitt `false`,
    // altså ingen attributter å telle.
    expect(byggefunksjoner.length).toBe(ANTALL_BYGGEFUNKSJONER)
    expect(Object.keys(SAMMENSATTE).sort()).toEqual(
      [...SAMMENSATTE_NAVN].sort(),
    )

    for (const navn of SAMMENSATTE_NAVN) {
      expect(
        byggefunksjoner.map(([n]) => n),
        `fs.${navn} finnes ikke`,
      ).toContain(navn)
    }

    for (const byggefunksjon of byggefunksjoner) {
      // At svaret er et objekt er for lite: `typeof null` er også «object»,
      // og et tomt objekt ville passert. Påstanden må være at traverseringen
      // finner noe, for det er den folketellingen under hviler på: «ingen
      // morferattributter» skal betyde at de ikke er der, ikke at ingen så.
      expect(
        attributtnavn(kall(byggefunksjon)).length,
        `fs.${byggefunksjon[0]}() ga ingen attributter`,
      ).toBeGreaterThan(0)
    }
  })

  it("sender dem ut fra nøyaktig de fire som eier innholdet sitt", () => {
    const funn: Record<string, string[]> = {}
    let kalt = 0

    for (const byggefunksjon of byggefunksjoner) {
      const svar = kall(byggefunksjon)
      const treff = [
        ...new Set(
          attributtnavn(svar).filter((n) => MORFERATTRIBUTTER.includes(n)),
        ),
      ].sort()
      if (treff.length > 0) funn[byggefunksjon[0]] = treff
      kalt += 1
    }

    expect(kalt).toBe(ANTALL_BYGGEFUNKSJONER)
    expect(funn).toEqual({
      connectionStatus: ["data-ignore-morph"],
      sessionTimeout: ["data-ignore-morph"],
      suggestion: ["data-ignore-morph"],
      toast: ["data-ignore-morph"],
    })
  })
})

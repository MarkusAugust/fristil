import { describe, expect, it } from "vitest"

import { contrastRatio, parseHex, rgbToOklch } from "./color"
import {
  buildFamily,
  checkPromises,
  promisesFor,
  REQUIREMENT,
  ROLES,
} from "./contract"
import { buildMatrix, FAMILIES, FRISTIL_BRANDS, roleToCss } from "./matrix"
import { checkTheme, inspectTheme, parseBlocks } from "./theme-check"

/**
 * At kontrakten holder, og at sjekken som skal si fra faktisk sier fra.
 *
 * Løftene er garantert av konstruksjonen og ikke av et justeringspass, så
 * testen her er hele garantien. Ryker et av tallene i `ROLES`, er det denne
 * som skal bli rød.
 */

const temaer = ["light", "dark"] as const

describe.each(temaer)("Fristils eget tema i %s", (utseende) => {
  it("holder hvert løfte", () => {
    const { violations } = buildMatrix(FRISTIL_BRANDS, utseende)

    expect(violations).toEqual([])
  })

  it("har hver familie med hver rolle", () => {
    const { tokens } = buildMatrix(FRISTIL_BRANDS, utseende)
    const forventet = FAMILIES.length * Object.keys(ROLES).length + 2

    expect(Object.keys(tokens)).toHaveLength(forventet)
    for (const familie of FAMILIES)
      for (const rolle of Object.keys(ROLES))
        expect(
          tokens[`--fs-color-${familie}-${roleToCss(rolle as never)}`],
        ).toMatch(/^#[0-9a-f]{6}$/)
  })
})

/**
 * Kontrakten skal holde for en hvilken som helst kulør, ikke bare for våre.
 *
 * Uten denne ville tallene kunne vært stilt inn etter nøyaktig de åtte
 * fargene Fristil bruker, og en konsument med en annen kulør ville fått et
 * tema som ikke holdt. Kulørene under dekker hele sirkelen, og de ekstreme
 * er med med vilje: neon og magenta er der sRGB oppfører seg verst.
 */
describe.each(temaer)("en vilkårlig kulør i %s", (utseende) => {
  const merker = [
    "#ff0000",
    "#ff8800",
    "#ffd600",
    "#39ff14",
    "#00e676",
    "#00bcd4",
    "#0062ba",
    "#5b3fa0",
    "#ff00ff",
    "#ff2d6f",
    "#8a5a00",
    "#24272b",
  ]

  it.each(merker)("holder løftene med %s som merkefarge", (merke) => {
    const { violations } = buildMatrix(
      { ...FRISTIL_BRANDS, accent: merke, neutral: "#24272b" },
      utseende,
    )

    expect(violations).toEqual([])
  })
})

describe("løftene kan feile", () => {
  /*
   * Uten denne kunne `checkPromises` returnert tom liste uansett hva den fikk,
   * og alle testene over ville meldt grønt på en sjekk som ikke sjekket.
   */
  it("melder fra når teksten er for lys", () => {
    const familie = buildFamily(FRISTIL_BRANDS.danger, "light")
    const lag = {
      canvas: "#ffffff",
      surface: "#f1f2f3",
      raised: "#e4e4e5",
    }

    const rent = checkPromises({ danger: familie }, lag)
    const ødelagt = checkPromises(
      { danger: { ...familie, text: "#ff9999" } },
      lag,
    )

    expect(rent).toEqual([])
    expect(ødelagt.length).toBeGreaterThan(0)
    expect(ødelagt[0].promise).toContain("text")
  })

  it("melder fra når teksten oppå den fylte flaten ikke holder", () => {
    const familie = buildFamily(FRISTIL_BRANDS.accent, "light")
    const lag = { canvas: "#ffffff", surface: "#f1f2f3", raised: "#e4e4e5" }

    const ødelagt = checkPromises(
      { accent: { ...familie, content: "#9ab8d8" } },
      lag,
    )

    expect(ødelagt.map((b) => b.promise)).toContain("content oppå fill")
  })
})

describe("kravet ligger over WCAG", () => {
  it("har margin, slik at en liten justering ikke bryter noe", () => {
    // WCAG krever 4,5 og 3. Ligger kravet vårt på grensa, ryker et par av en
    // endring ingen oppdager. Marginen er derfor en del av kontrakten.
    expect(REQUIREMENT.text).toBeGreaterThan(4.5)
    expect(REQUIREMENT.graphic).toBeGreaterThan(3)
  })

  it("gir hver rolle en lyshet som ligger innenfor skalaen", () => {
    // `toBeGreaterThan(0)` alene slipper 0,001 gjennom, og det er ikke en
    // lyshet noen rolle kan ha.
    for (const spec of Object.values(ROLES)) {
      expect(spec.lightness.light).toBeGreaterThan(0.1)
      expect(spec.lightness.light).toBeLessThanOrEqual(1)
      expect(spec.lightness.dark).toBeGreaterThan(0.1)
      expect(spec.lightness.dark).toBeLessThanOrEqual(1)
    }
  })
})

describe("sjekken av et tema noen har skrevet selv", () => {
  const somCss = (utseende: "light" | "dark", selektor: string) => {
    const { tokens } = buildMatrix(FRISTIL_BRANDS, utseende)
    const linjer = Object.entries(tokens)
      .map(([navn, verdi]) => `  ${navn}: ${verdi};`)
      .join("\n")
    return `${selektor} {\n  color-scheme: ${utseende};\n${linjer}\n}`
  }

  it("sier ingenting om et tema som holder", () => {
    const css = `${somCss("light", ":root")}\n${somCss("dark", '[data-theme="dark"]')}`

    expect(checkTheme(css)).toEqual([])
  })

  it("finner cella som ryker, og sier hvor den står", () => {
    const css = somCss("light", ":root").replace(
      /--fs-color-danger-text: #[0-9a-f]+/,
      "--fs-color-danger-text: #ff9999",
    )

    const problemer = checkTheme(css)

    expect(problemer.length).toBeGreaterThan(0)
    expect(problemer[0].selector).toBe(":root")
    expect(problemer[0].message).toContain("danger")
  })

  it("leser en mørk blokk inne i en @media riktig", () => {
    const inni = somCss("dark", ":root")
    const css = `@media (prefers-color-scheme: dark) {\n${inni}\n}`

    const blokker = parseBlocks(css)

    expect(blokker).toHaveLength(1)
    expect(blokker[0].appearance).toBe("dark")
    expect(checkTheme(css)).toEqual([])
  })

  it("melder en verdi den ikke kan regne på, framfor å hoppe over den", () => {
    const css = somCss("light", ":root").replace(
      /--fs-color-accent-fill: #[0-9a-f]+/,
      "--fs-color-accent-fill: var(--noe-annet)",
    )

    const problemer = checkTheme(css)

    expect(problemer).toHaveLength(1)
    expect(problemer[0].message).toContain("ikke kontrollert")
  })

  it("melder en ufullstendig familie framfor å kaste", () => {
    const css =
      ":root { color-scheme: light; --fs-color-brand4-fill: #336699; }"

    const problemer = checkTheme(css)

    expect(problemer).toHaveLength(1)
    expect(problemer[0].message).toContain("brand4 mangler")
  })

  it("sier fra når fila ikke inneholder et tema i det hele tatt", () => {
    expect(checkTheme("body { color: red }")[0].message).toContain("Fant ingen")
  })
})

describe("matrisen krever en nøytral familie", () => {
  it("kaster med en forklaring framfor å bygge halve systemet", () => {
    expect(() => buildMatrix({ accent: "#1362ae" }, "light")).toThrow(/nøytral/)
  })
})

describe("lysheten er rollens, ikke merkefargens", () => {
  /*
   * Den forrige utgaven av denne testen sammenlignet to lilla og krevde at
   * kontrasten mellom dem var under 1,6. Den kunne ikke feile: `buildFamily`
   * låser lysheten, og WCAG-kontrast mellom to farger med samme lyshet er
   * alltid nær 1, også for rødt mot grønt. Den påstanden sa altså ingenting.
   *
   * Det som faktisk skal holde er at lysheten er rollens. Da er den lik for
   * hver merkefarge, og det er et tall som beveger seg hvis noen bytter det.
   */
  it("gir hver rolle den samme lysheten uansett merkefarge", () => {
    for (const rolle of Object.keys(ROLES) as (keyof typeof ROLES)[]) {
      const lysheter = ["#ff0000", "#00ff00", "#0000ff", "#808080"].map(
        (merke) => rgbToOklch(parseHex(buildFamily(merke, "light")[rolle])).l,
      )

      for (const l of lysheter)
        expect(l).toBeCloseTo(ROLES[rolle].lightness.light, 2)
    }
  })

  it("tar kuløren fra merkefargen", () => {
    const rød = rgbToOklch(parseHex(buildFamily("#ff0000", "light").fill)).h
    const blå = rgbToOklch(parseHex(buildFamily("#0000ff", "light").fill)).h

    expect(Math.abs(rød - blå)).toBeGreaterThan(60)
  })
})

describe("den hevede flaten er med i løftene", () => {
  /*
   * `raised` er det vanskeligste laget: mørkest i lyst tema og lysest i mørkt.
   * Først kontrollerte bare `text` mot den, og da lå `border` under 3:1 mot et
   * hevet kort i åtte av åtte familier i mørkt tema, uten at noe sa fra. Det
   * er nettopp det laget finnes for å fange.
   */
  it.each(
    temaer,
  )("holder border, fill og textSubtle mot raised i %s", (utseende) => {
    const { tokens, violations } = buildMatrix(FRISTIL_BRANDS, utseende)
    const raised = tokens["--fs-color-neutral-raised"]

    expect(violations).toEqual([])
    for (const familie of FAMILIES)
      for (const [rolle, krav] of [
        ["border", REQUIREMENT.graphic],
        ["fill", REQUIREMENT.graphic],
        ["text-subtle", REQUIREMENT.text],
      ] as const) {
        const farge = tokens[`--fs-color-${familie}-${rolle}`]
        expect(
          contrastRatio(parseHex(farge), parseHex(raised)),
        ).toBeGreaterThanOrEqual(krav)
      }
  })

  it("felles når kanten er for svak mot den hevede flaten", () => {
    const familie = buildFamily(FRISTIL_BRANDS.accent, "light")
    const lag = { canvas: "#ffffff", surface: "#f1f2f3", raised: "#e4e4e5" }

    const brudd = checkPromises(
      { accent: { ...familie, border: "#d8d8d8" } },
      lag,
    )

    expect(brudd.map((b) => b.promise)).toContain("border mot raised")
  })
})

describe("sjekken leser CSS slik den faktisk skrives", () => {
  it("mister ikke en verdi som står før en nøstet regel", () => {
    // Første utgave leste alt før `&:hover` som en del av selektoren, så
    // overstyringen forsvant og fila ble meldt grønn.
    const css =
      ":root { --fs-color-danger-text: #ff9999; &:hover { color: red } }"

    const blokker = parseBlocks(css)

    expect(blokker).toHaveLength(1)
    expect(blokker[0].declarations["--fs-color-danger-text"]).toBe("#ff9999")
    expect(checkTheme(css).length).toBeGreaterThan(0)
  })

  it("leser en @media inne i :root som sin egen blokk", () => {
    const css =
      ":root { --fs-color-danger-text: #ff9999; @media print { --fs-color-accent-fill: #123456 } }"

    expect(parseBlocks(css)).toHaveLength(2)
  })

  it("leser «color-scheme: light dark» som ikke oppgitt", () => {
    // Formen sier at blokka virker i begge, ikke at den er ett av dem. Lest
    // som «light» ble et mørkt tema kontrollert mot lyse standardverdier.
    const css =
      '[data-theme="dark"] { color-scheme: light dark; --fs-color-danger-text: #ff9999 }'

    expect(parseBlocks(css)[0].appearance).toBe("dark")
  })

  it("lar seg ikke lure av en klasse som heter darkmode", () => {
    expect(
      parseBlocks(".darkmode-toggle { --fs-color-danger-text: #123456 }")[0]
        .appearance,
    ).toBe("light")
  })

  it("melder et tokennavn systemet ikke har", () => {
    const problemer = checkTheme(":root { --fs-color-danger-txt: #ff0000 }")

    expect(problemer).toHaveLength(1)
    expect(problemer[0].message).toContain("ikke et token i systemet")
  })

  it("kontrollerer en familie med bindestrek i navnet", () => {
    // Rollen leses som endelsen. Med familien som begynnelsen falt sju
    // gyldige roller på «min-merkevare» utenfor uten et ord.
    const roller = [
      "surface",
      "border-subtle",
      "border",
      "fill",
      "content",
      "text",
      "text-subtle",
    ]
    const css = `:root {${roller
      .map((r) => `--fs-color-min-merkevare-${r}: #ff0000;`)
      .join("")}}`

    const problemer = checkTheme(css)

    expect(problemer.length).toBeGreaterThan(0)
    expect(problemer.some((p) => p.message.includes("min-merkevare"))).toBe(
      true,
    )
  })

  it("melder en heksfarge med alfa framfor å kaste", () => {
    // `#rrggbbaa` er gyldig CSS, men `parseHex` leser den ikke, og porten
    // slapp den gjennom til et kast som drepte hele kommandoen.
    const problemer = checkTheme(":root { --fs-color-danger-text: #ff9999cc }")

    expect(problemer).toHaveLength(1)
    expect(problemer[0].message).toContain("ikke kontrollert")
  })
})

describe("sjekken teller hva den gjorde", () => {
  it("rapporterer blokker og løfter, ikke bare filer", () => {
    const { tokens } = buildMatrix(FRISTIL_BRANDS, "light")
    const css = `:root { color-scheme: light; ${Object.entries(tokens)
      .map(([navn, verdi]) => `${navn}: ${verdi};`)
      .join(" ")} }`

    const rapport = inspectTheme(css)

    expect(rapport.blocks).toBe(1)
    // Antallet løfter per familie leses av kontrakten, ikke skrevet av.
    expect(rapport.promises).toBe(
      FAMILIES.length *
        promisesFor(buildFamily(FRISTIL_BRANDS.danger, "light"), {
          canvas: "#ffffff",
          surface: "#f1f2f3",
          raised: "#e4e4e5",
        }).length,
    )
    expect(rapport.problems).toEqual([])
  })

  it("teller null løfter i en fil uten tokens", () => {
    const rapport = inspectTheme("body { color: red }")

    expect(rapport.promises).toBe(0)
    expect(rapport.problems).toHaveLength(1)
  })
})

describe("sjekken sier fra om det den ikke kunne lese", () => {
  it("leser color-scheme også som siste deklarasjon uten semikolon", () => {
    // `}` havner aldri i blokkas tekst, så et krav om `;` eller `}` etter
    // verdien bommet på den formen, og et riktig mørkt tema fikk fire
    // falske brudd mot lyse standardverdier.
    const { tokens } = buildMatrix(FRISTIL_BRANDS, "dark")
    const linjer = Object.entries(tokens)
      .map(([navn, verdi]) => `${navn}: ${verdi};`)
      .join(" ")

    const css = `[data-theme="mork"] { ${linjer} color-scheme: dark }`

    expect(parseBlocks(css)[0].appearance).toBe("dark")
    expect(checkTheme(css)).toEqual([])
  })

  it.each([
    "only dark",
    "dark only",
    "dark !important",
    "dark only !important",
    "ONLY DARK",
    "Only Dark",
  ])("leser «color-scheme: %s» som mørkt", (verdi) => {
    // Grammatikken er `[light | dark]+ && only?`, så `only` kan stå på begge
    // sider. Tre runder lappet den samme linja for den samme feilklassen før
    // verdien ble lest framfor mønstermatchet.
    const css = `:root { color-scheme: ${verdi}; --fs-color-danger-text: #f1a7ab }`

    expect(parseBlocks(css)[0].appearance).toBe("dark")
  })

  it("lar den siste color-scheme-deklarasjonen vinne", () => {
    // Som i kaskaden. `match` ga den første, og da leste vi det motsatte av
    // hva nettleseren gjør.
    const css =
      ":root { color-scheme: light; color-scheme: dark; --fs-color-danger-text: #f1a7ab }"

    expect(parseBlocks(css)[0].appearance).toBe("dark")
  })

  it("leser ikke --my-color-scheme som blokkas color-scheme", () => {
    // Uttrykket hadde ingen venstregrense, så en egendefinert variabel med
    // «color-scheme» i navnet ble lest som blokkas eget.
    const css =
      ":root { --my-color-scheme: dark; --fs-color-danger-text: #7a1f28 }"

    expect(parseBlocks(css)[0].appearance).toBe("light")
  })

  it("beholder klammemeldingen i en fil som bare er avkuttet", () => {
    // Uten dette forsvant meldingen om den ulukkede blokka, og konsumenten
    // satt igjen med «er dette et Fristil-tema?» alene.
    const problemer = checkTheme(":root { --fs-color-danger-text: #7a1f28")

    expect(problemer.some((p) => p.message.includes("ikke er lukket"))).toBe(
      true,
    )
  })

  it("melder en blokk som ikke er lukket", () => {
    // En avkuttet fil mistet hele den siste blokka uten et ord.
    const css =
      ':root { --fs-color-danger-text: #7a1f28 } [data-theme="dark"] {'

    expect(
      checkTheme(css).some((p) => p.message.includes("ikke er lukket")),
    ).toBe(true)
  })

  it("melder et lag satt på en annen familie enn neutral", () => {
    // `canvas` og `raised` finnes bare på den nøytrale familien.
    const problemer = checkTheme(":root { --fs-color-danger-canvas: #ff0000 }")

    expect(problemer).toHaveLength(1)
    expect(problemer[0].message).toContain("ikke et token i systemet")
  })

  it("leser en verdi med !important", () => {
    const rapport = inspectTheme(
      ":root { --fs-color-danger-text: #7a1f28 !important }",
    )

    expect(rapport.declarations).toBe(1)
    expect(rapport.problems).toEqual([])
  })

  it("teller konsumentens egne verdier, ikke standardverdiene", () => {
    // Løftetallet alene duger ikke: standarden fyller hullene, så én linje
    // gir like mange løfter som et helt tema.
    const enLinje = inspectTheme(":root { --fs-color-neutral-canvas: #ffffff }")
    const { tokens } = buildMatrix(FRISTIL_BRANDS, "light")
    const helt = inspectTheme(
      `:root { color-scheme: light; ${Object.entries(tokens)
        .map(([navn, verdi]) => `${navn}: ${verdi};`)
        .join(" ")} }`,
    )

    expect(enLinje.promises).toBe(helt.promises)
    expect(enLinje.declarations).toBe(1)
    expect(helt.declarations).toBe(
      FAMILIES.length * Object.keys(ROLES).length + 2,
    )
  })
})

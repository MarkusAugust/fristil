import { describe, expect, it } from "vitest"

import {
  buildEntryPoints,
  type PackageExports,
  planTakeover,
  resolvePath,
  rewriteReferences,
  type SourceFile,
} from "./takeover"

/**
 * `fristil overta` kopierer kildekoden til én komponent inn i et annet
 * prosjekt. Det som kan gå galt er stiene: en henvisning som ikke blir skrevet
 * om, peker på en mappe som ikke finnes der kopien havner, og kopien virker
 * ikke. Det er verre enn at kommandoen nekter, for feilen viser seg først i
 * byggingen hos konsumenten.
 */

const EXPORTS: PackageExports = {
  ".": { import: "./dist/index.js" },
  "./shared": { import: "./dist/components/css/shared.js" },
  "./input": { import: "./dist/components/css/input/input.js" },
  "./calendar": {
    import: "./dist/components/frittstaende/calendar/fs-calendar.js",
  },
  "./field-core": { import: "./dist/components/ramme/field/field-core.js" },
  "./button.css": "./src/components/css/button/button.css",
  "./input.css": "./src/components/css/input/input.css",
}

const INNGANGER = buildEntryPoints("@fristil/designsystem", EXPORTS)

describe("overta", () => {
  it("fører et inngangspunkt tilbake til kilden det er bygget av", () => {
    expect(INNGANGER.get("src/components/css/shared.ts")).toBe(
      "@fristil/designsystem/shared",
    )
    expect(INNGANGER.get("src/components/css/button/button.css")).toBe(
      "@fristil/designsystem/button.css",
    )
  })

  it("slår sammen en relativ sti med mappa den står i", () => {
    expect(resolvePath("src/components/css/button", "../shared.js")).toBe(
      "src/components/css/shared.js",
    )
    expect(
      resolvePath(
        "src/components/frittstaende/date-field",
        "../../css/input/input.css",
      ),
    ).toBe("src/components/css/input/input.css")
  })

  it("skriver om henvisninger ut av mappa", () => {
    const fil: SourceFile = {
      path: "src/components/css/button/button.ts",
      content: `import { attributes } from "../shared.js"\n`,
    }

    const planlagt = rewriteReferences(fil, INNGANGER, new Set(["button.ts"]))

    expect(planlagt.content).toContain(`from "@fristil/designsystem/shared"`)
    expect(planlagt.rewrites).toEqual([
      { from: "../shared.js", to: "@fristil/designsystem/shared" },
    ])
  })

  it("lar en nabo i samme mappe stå, siden den blir med i kopien", () => {
    const fil: SourceFile = {
      path: "src/components/ramme/field/fs-field.ts",
      content: `import { computeFieldAttributes } from "./field-core.js"\n`,
    }

    // Importen peker på «.js», altså filen etter bygging, mens kilden som
    // kopieres heter «.ts». Uten den sammenligningen ble naboen skrevet om
    // til pakken, og kopien hentet koden sin utenfra likevel.
    const planlagt = rewriteReferences(
      fil,
      INNGANGER,
      new Set(["fs-field.ts", "field-core.ts"]),
    )

    expect(planlagt.content).toContain(`from "./field-core.js"`)
    expect(planlagt.rewrites).toEqual([])
  })

  it("skriver om @import i stilark", () => {
    const fil: SourceFile = {
      path: "src/components/css/search/search.css",
      content: `@import "../input/input.css";\n\n@layer fristil {}\n`,
    }

    const planlagt = rewriteReferences(fil, INNGANGER, new Set(["search.css"]))

    expect(planlagt.content).toContain(
      `@import "@fristil/designsystem/input.css";`,
    )
  })

  it("sier hvilke pakker kopien trenger, og hva den tar over for", () => {
    const plan = planTakeover(
      [
        {
          path: "src/components/frittstaende/calendar/fs-calendar.ts",
          content:
            `import { html, LitElement } from "lit"\n` +
            `import { ifDefined } from "lit/directives/if-defined.js"\n` +
            `import { attributes } from "../../css/shared.js"\n`,
        },
      ],
      INNGANGER,
    )

    expect(plan.dependencies).toEqual(["lit"])
    expect(plan.keptImports).toEqual(["@fristil/designsystem/shared"])
    expect(plan.replacedEntries).toEqual(["@fristil/designsystem/calendar"])
  })
})

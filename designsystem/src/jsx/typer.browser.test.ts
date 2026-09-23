import type { JSX } from "react"
import { describe, expect, it } from "vitest"

import { fs } from "../react"

import "./react"

/**
 * At det byggerne sender ut, passer i pakkens egne JSX-deklarasjoner.
 *
 * De to er begge offentlig API, og de kan gå fra hverandre uten at noe sier
 * fra. `fs.popover().host` ga `open: ""`, mens deklarasjonen sa
 * `open?: true | undefined`. Da var det byggefunksjonen som tok feil: React
 * 19 setter egenskapen, og `el.open = ""` er usant, så panelet åpnet seg
 * ikke. Begge sender nå `true`.
 *
 * Tilordningene under er testen, og det er `typecheck:tests` som kjører den.
 * Det som kjøres i nettleseren er bare at verdiene faktisk er der.
 */
describe("byggerne passer i JSX-deklarasjonene", () => {
  it("sprettoppvinduets vert", () => {
    const host: JSX.IntrinsicElements["fs-popover"] = fs.popover({
      id: "h",
      open: true,
    }).host

    expect(host.open).toBe(true)
  })

  it("dialogens vert", () => {
    const host: JSX.IntrinsicElements["fs-dialog"] = fs.dialog({
      titleId: "t",
      open: true,
    }).host

    expect(host.open).toBe(true)
  })

  it("fanene, som har tabIndex", () => {
    const faner = fs.tabs({ id: "sak", count: 2 })
    const [forste] = faner.tabs
    const fane: JSX.IntrinsicElements["button"] = forste ?? {}

    expect(fane.tabIndex).toBe(0)
  })
})

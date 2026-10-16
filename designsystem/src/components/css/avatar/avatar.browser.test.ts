/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { piksel } from "../../../testing/piksel"
import { avatar } from "./avatar"
import avatarCss from "./avatar.css?inline"

import "../../../tokens/tokens.css"
import "./avatar.css"

describe("fs-avatar", () => {
  beforeEach(() => {
    monter(`
      <span class="fs-avatar" data-size="small" id="liten" aria-hidden="true">ON</span>
      <span class="fs-avatar" id="vanlig" aria-hidden="true">ON</span>
      <span class="fs-avatar" data-size="large" id="stor" aria-hidden="true">ON</span>
      <span class="fs-avatar" data-variant="square" id="firkant" aria-hidden="true">KB</span>
      <p>Ola Nordmann</p>
    `)
  })

  it("skiller størrelsene", () => {
    const bredder = ["liten", "vanlig", "stor"].map(
      (id) =>
        (document.getElementById(id) as HTMLElement).getBoundingClientRect()
          .width,
    )

    expect(bredder[0]).toBeLessThan(bredder[1])
    expect(bredder[1]).toBeLessThan(bredder[2])
  })

  it("er rund som standard og avrundet som firkant", () => {
    const rund = getComputedStyle(document.getElementById("vanlig") as Element)
    const firkant = getComputedStyle(
      document.getElementById("firkant") as Element,
    )

    expect(rund.borderRadius).toMatch(/50%|9999px/)
    expect(firkant.borderRadius).not.toMatch(/50%/)
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(avatar()).toEqual({ class: "fs-avatar" })
    expect(avatar({ size: "large", variant: "square" })).toEqual({
      class: "fs-avatar",
      "data-size": "large",
      "data-variant": "square",
    })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fs-avatar som knapp", () => {
  /*
   * Ringen rundt bildet er en `outline` i laget, og den slo nettleserens egen
   * fokusmarkering. En avatar som er en knapp fikk da bare den tynne ringen
   * innenfor kanten når den hadde fokus. Om `:focus-visible` treffer etter et
   * programmert `focus()`, avgjør nettleseren selv, så testen bytter det med
   * et attributt i en kopi av reglene, slik testen for besøkte lenker gjør.
   */
  it("viser fokusringen og ikke ringen rundt bildet", () => {
    monter(`
      <style>${avatarCss.replaceAll(":focus-visible", "[data-fokus]")}</style>
      <button class="fs-avatar" id="profil" aria-label="Profil">ON</button>
    `)
    const knapp = document.getElementById("profil") as HTMLButtonElement
    expect(getComputedStyle(knapp).outlineWidth).toBe("1px")

    knapp.setAttribute("data-fokus", "")
    const stil = getComputedStyle(knapp)
    expect(stil.outlineWidth).toBe("2px")
    expect(stil.outlineOffset).toBe("2px")
  })
})

describe("fs-avatar med bilde", () => {
  it("tegner ringen over et lyst bilde", async () => {
    // Ringen var en skygge innover, og den males under innholdet. Et bilde
    // som fylte flaten dekket den, så ringen fantes bare med initialer. Ringen
    // får en farge her som ikke finnes ellers, så den ikke kan forveksles med
    // bakgrunnen som skinner gjennom i kanten av en avrundet flate.
    const hvitt = `data:image/svg+xml,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="white"/></svg>',
    )}`
    const stil =
      "--fs-avatar-size: 96px; --fs-color-neutral-border-subtle: rgb(255, 0, 0)"
    monter(`
      <span class="fs-avatar" id="rund" style="${stil}"><img src="${hvitt}" alt="" /></span>
      <span class="fs-avatar" data-variant="square" id="firkant" style="${stil}"><img src="${hvitt}" alt="" /></span>
    `)
    for (const bilde of document.querySelectorAll("img")) await bilde.decode()
    await ventPaTegning()

    for (const id of ["rund", "firkant"]) {
      const element = document.getElementById(id) as HTMLElement
      expect(await piksel(element, 0.5), id).toEqual([255, 255, 255])
      // De ytterste pikslene, siden kanten av en sirkel er utjevnet mot siden.
      let rødest = 0
      for (const x of [0, 0.01, 0.02, 0.03]) {
        const [r, g, b] = await piksel(element, x)
        rødest = Math.max(rødest, r - Math.max(g, b))
      }
      expect(rødest, id).toBeGreaterThan(60)
    }
  })
})

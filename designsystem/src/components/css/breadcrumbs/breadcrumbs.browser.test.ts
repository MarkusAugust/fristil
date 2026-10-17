/// <reference path="../../../types/css.d.ts" />

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import side from "../../../../../documentation/src/content/docs/components/breadcrumbs.mdx?raw"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { breadcrumbs } from "./breadcrumbs"

import "../../../tokens/tokens.css"
import "./breadcrumbs.css"

describe("fs-breadcrumbs", () => {
  afterEach(() => {
    document.getElementById("oppskrift")?.remove()
  })

  beforeEach(() => {
    monter(`
      <nav aria-label="Du er her">
        <ol class="fs-breadcrumbs">
          <li><a href="#">Forsiden</a></li>
          <li><a href="#">Mine saker</a></li>
          <li><a href="#" aria-current="page" id="her">Søknad 2026-0481</a></li>
        </ol>
      </nav>
    `)
  })

  it("gir skilletegnet en tom alternativ tekst, så det ikke leses opp", () => {
    // Generert innhold leses opp, og skjermleseren sa «skråstrek» mellom
    // hvert steg. Nettlesere uten formen beholder streken.
    const ledd = document.querySelectorAll(".fs-breadcrumbs li")[1] as Element
    const innhold = getComputedStyle(ledd, "::before").content

    if (CSS.supports("content", '"/" / ""')) {
      expect(innhold).toBe('"/" / ""')
    } else {
      expect(innhold).toBe('"/"')
    }
  })

  it("lar oppskriften på siden bytte tegn uten at det leses opp", () => {
    // Siden viser hvordan skilletegnet byttes. Snutten står utenfor laget
    // og slår stilarket, så glemmer den alternativteksten, er «›» tilbake i
    // tilgjengelighetstreet, og skjermleseren leser det opp mellom hvert
    // steg igjen. Snutten leses fra siden, så den kan ikke drive fra koden.
    const snutt = /```css\n([\s\S]*?)```/.exec(side)?.[1]
    if (snutt === undefined) throw new Error("Fant ingen CSS-snutt på siden")
    const stil = document.createElement("style")
    stil.id = "oppskrift"
    stil.textContent = snutt
    document.head.append(stil)

    const ledd = document.querySelectorAll(".fs-breadcrumbs li")[1] as Element
    const innhold = getComputedStyle(ledd, "::before").content

    // Tegnet er byttet, og alternativteksten står der nettleseren kan den.
    expect(/^"(.)"/.exec(innhold)?.[1]).not.toBe("/")
    if (CSS.supports("content", '"/" / ""')) {
      expect(innhold).toMatch(/^"."\s*\/\s*""$/)
    } else {
      expect(innhold).toMatch(/^"."$/)
    }
  })

  it("legger skilletegnet inn med CSS, ikke i markupen", () => {
    const andre = document.querySelectorAll(".fs-breadcrumbs li")[1]
    const skille = getComputedStyle(andre, "::before")

    // Sto skråstreken i markupen, ville skjermlesere lest den opp mellom
    // hvert steg.
    expect(skille.content).toContain("/")
    expect(
      document.querySelector(".fs-breadcrumbs")?.textContent,
    ).not.toContain("/")
  })

  it("skiller gjeldende side fra lenkene", () => {
    const her = getComputedStyle(document.getElementById("her") as Element)
    const foran = getComputedStyle(
      document.querySelector(".fs-breadcrumbs a") as Element,
    )

    expect(her.color).not.toBe(foran.color)
    expect(her.textDecorationLine).toBe("none")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(breadcrumbs()).toEqual({ class: "fs-breadcrumbs" })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

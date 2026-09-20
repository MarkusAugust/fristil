/// <reference path="../../../types/css.d.ts" />

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { dialog } from "./dialog"

import "../../../tokens/tokens.css"
import "./dialog.css"
import "../button/button.css"

describe("fs-dialog", () => {
  beforeEach(() => {
    monter(`
      <button class="fs-button" id="apne" type="button">Slett søknaden</button>
      <dialog class="fs-dialog" id="dialog" aria-labelledby="dialog-tittel">
        <h2 class="fs-dialog__title" id="dialog-tittel">Slette søknaden?</h2>
        <div class="fs-dialog__body">
          <p>Søknaden og vedleggene blir borte. Dette kan ikke angres.</p>
        </div>
        <div class="fs-dialog__footer">
          <button class="fs-button" data-variant="secondary" id="avbryt" type="button">Avbryt</button>
          <button class="fs-button" data-variant="danger" id="slett" type="button">Slett søknaden</button>
        </div>
      </dialog>
    `)
  })

  afterEach(() => {
    const d = document.getElementById("dialog") as HTMLDialogElement | null
    if (d?.open) d.close()
  })

  it("flytter fokus inn i dialogen når den åpnes med showModal", () => {
    const d = document.getElementById("dialog") as HTMLDialogElement
    d.showModal()

    expect(d.open).toBe(true)
    // showModal() flytter fokus selv. Et <dialog open> i markupen gjør ikke
    // det, og er derfor bare en boks på siden.
    expect(d.contains(document.activeElement)).toBe(true)
  })

  it("lukkes med Escape uten at vi skriver noe for det", () => {
    const d = document.getElementById("dialog") as HTMLDialogElement
    d.showModal()

    d.dispatchEvent(new Event("cancel", { cancelable: true }))
    d.close()

    expect(d.open).toBe(false)
  })

  it("melder tilbake hva brukeren valgte", () => {
    const d = document.getElementById("dialog") as HTMLDialogElement
    d.showModal()
    d.close("slett")

    expect(d.returnValue).toBe("slett")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(dialog()).toEqual({ class: "fs-dialog" })
    expect(dialog.title).toBe("fs-dialog__title")
    expect(dialog.body).toBe("fs-dialog__body")
    expect(dialog.footer).toBe("fs-dialog__footer")
  })

  it("har ingen tilgjengelighetsbrudd når den er åpen", async () => {
    const d = document.getElementById("dialog") as HTMLDialogElement
    d.showModal()

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

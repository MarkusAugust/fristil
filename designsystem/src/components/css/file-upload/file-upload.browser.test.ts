/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { fileUpload } from "./file-upload"

import "../../../tokens/tokens.css"
import "./file-upload.css"
import "../label/label.css"
import "../help-text/help-text.css"

describe("fs-file-upload", () => {
  beforeEach(() => {
    monter(`
      <label class="fs-label" for="vedlegg">Last opp vedlegg</label>
      <input class="fs-file-upload" type="file" id="vedlegg" multiple
        accept=".pdf,.jpg" aria-describedby="vedlegg-hjelp" />
      <p class="fs-help-text" id="vedlegg-hjelp">PDF eller bilde, opptil 10 MB per fil.</p>

      <ul class="fs-file-upload-list">
        <li>fodselsattest.pdf <button type="button">Fjern fodselsattest.pdf</button></li>
      </ul>
    `)
  })

  it("er et vanlig filfelt", () => {
    const felt = document.getElementById("vedlegg") as HTMLInputElement

    expect(felt.type).toBe("file")
    expect(felt.multiple).toBe(true)
    expect(felt.accept).toBe(".pdf,.jpg")
  })

  it("styler nettleserens egen knapp inne i feltet", () => {
    const knapp = getComputedStyle(
      document.getElementById("vedlegg") as Element,
      "::file-selector-button",
    )

    expect(knapp.borderTopWidth).toBe("1px")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(fileUpload()).toEqual({ class: "fs-file-upload", type: "file" })
    expect(
      fileUpload({ multiple: true, accept: ".pdf", state: "invalid" }),
    ).toEqual({
      class: "fs-file-upload",
      type: "file",
      multiple: true,
      accept: ".pdf",
      "data-state": "invalid",
      "aria-invalid": "true",
    })
    expect(fileUpload.list).toBe("fs-file-upload-list")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

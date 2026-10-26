/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { fileUpload } from "./file-upload"

import "../../../tokens/tokens.css"
import "./file-upload.css"
import "../label/label.css"
import "../help-text/help-text.css"
import "../button/button.css"

describe("lt-file-upload", () => {
  beforeEach(() => {
    mount(`
      <label class="lt-label" for="attachments">Upload attachments</label>
      <input class="lt-file-upload" type="file" id="attachments" multiple
        accept=".pdf,.jpg" aria-describedby="attachments-help" />
      <p class="lt-help-text" id="attachments-help">PDF or image, up to 10 MB per file.</p>

      <ul class="lt-file-upload-list">
        <li>birth-certificate.pdf <button class="lt-button" data-variant="ghost" type="button">Remove birth-certificate.pdf</button></li>
      </ul>
    `)
  })

  it("is a plain file input", () => {
    const input = document.getElementById("attachments") as HTMLInputElement

    expect(input.type).toBe("file")
    expect(input.multiple).toBe(true)
    expect(input.accept).toBe(".pdf,.jpg")
  })

  it("styles the browser's own button inside the input", () => {
    const button = getComputedStyle(
      document.getElementById("attachments") as Element,
      "::file-selector-button",
    )

    expect(button.borderTopWidth).toBe("1px")
  })

  it("sets the attributes from the builder function", () => {
    expect(fileUpload()).toEqual({ class: "lt-file-upload", type: "file" })
    expect(
      fileUpload({ multiple: true, accept: ".pdf", state: "invalid" }),
    ).toEqual({
      class: "lt-file-upload",
      type: "file",
      multiple: true,
      accept: ".pdf",
      "data-state": "invalid",
      "aria-invalid": "true",
    })
    expect(fileUpload.list).toBe("lt-file-upload-list")
  })

  it("has no accessibility violations", async () => {
    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})

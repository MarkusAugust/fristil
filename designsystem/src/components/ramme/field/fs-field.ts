import { html, LitElement } from "lit"

import { computeFieldAttributes } from "./field-core.js"

export const FS_FIELD_TAG = "fs-field" as const

function uniqueId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export class FsField extends LitElement {
  static properties = {
    invalid: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    optional: { type: Boolean, reflect: true },
    requiredMarker: { type: String, attribute: "required-marker" },
    controlId: { type: String, attribute: "control-id" },
    describedBy: { type: String, attribute: "described-by" },
  }

  invalid = false
  disabled = false
  optional = false
  requiredMarker: "none" | "symbol" | "text" = "none"
  controlId?: string
  describedBy?: string

  createRenderRoot() {
    return this
  }

  render() {
    return html`<slot @slotchange=${this.handleSlotChange}></slot>`
  }

  firstUpdated() {
    this.syncA11y()
  }

  updated() {
    this.syncA11y()
  }

  private handleSlotChange = () => {
    this.syncA11y()
  }

  private syncA11y() {
    const label = this.querySelector("label") as HTMLLabelElement | null
    const control = this.querySelector(
      "input:not([type='hidden']), textarea, select",
    ) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
    const help = this.querySelector(
      ".fs-help-text, [data-role='help']",
    ) as HTMLElement | null
    const error = this.querySelector(
      ".fs-error-text, [data-role='error']",
    ) as HTMLElement | null

    if (!control) return

    if (help && !help.id) help.id = uniqueId("fs-field-help")
    if (error && !error.id) error.id = uniqueId("fs-field-error")

    // Selve kontrakten regnes result av den delte kjernen, som fs.field() også
    // bruker. Denne komponenten gjør bare én ting utover det: å sette
    // resultatet på elementer som allerede står i DOM-en.
    const computed = computeFieldAttributes({
      id: this.controlId || control.id || uniqueId("fs-field-control"),
      help: Boolean(help),
      error: Boolean(error),
      helpId: help?.id,
      errorId: error?.id,
      required:
        this.requiredMarker === "symbol" || this.requiredMarker === "text"
          ? this.requiredMarker
          : undefined,
      optional: this.optional,
      invalid: this.invalid,
      disabled: this.disabled,
      describedBy: [
        control.getAttribute("aria-describedby") ?? "",
        this.describedBy ?? "",
      ].filter(Boolean),
    })

    control.id = computed.control.id

    if (label) {
      label.classList.add(computed.label.class)
      if (!label.htmlFor) label.htmlFor = computed.label.for
      setOrRemove(label, "data-required", computed.label["data-required"])
      setOrRemove(label, "data-optional", computed.label["data-optional"])
      setOrRemove(label, "aria-disabled", computed.label["aria-disabled"])
    }

    if (error) {
      error.hidden = Boolean(computed.error.hidden)
      error.setAttribute("aria-hidden", String(Boolean(computed.error.hidden)))
    }

    setOrRemove(
      control,
      "aria-describedby",
      computed.control["aria-describedby"],
    )
    setOrRemove(control, "aria-invalid", computed.control["aria-invalid"])

    if (this.disabled) {
      control.setAttribute("disabled", "")
      control.setAttribute("aria-disabled", "true")
    } else {
      control.removeAttribute("disabled")
      control.removeAttribute("aria-disabled")
    }

    // data-state settes bare når konsumenten ikke har satt den selv.
    const isSystemField =
      control.classList.contains("fs-input") ||
      control.classList.contains("fs-textarea") ||
      control.classList.contains("fs-select")

    const tilstand = computed.control["data-state"]
    if (tilstand && isSystemField && !control.hasAttribute("data-state")) {
      control.setAttribute("data-state", tilstand)
    } else if (!tilstand && control.getAttribute("data-state") === "invalid") {
      control.removeAttribute("data-state")
    }
  }
}

function setOrRemove(
  element: HTMLElement,
  name: string,
  value: string | undefined,
) {
  if (value === undefined) {
    element.removeAttribute(name)
  } else {
    element.setAttribute(name, value)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-field": FsField
  }
}

export function defineFsField(tagName = FS_FIELD_TAG): void {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, FsField)
  }
}

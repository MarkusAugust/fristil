import { html, LitElement } from "lit"

export const FS_FIELD_TAG = "fs-field" as const

function uniqueId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function mergeTokens(...values: Array<string | null | undefined>): string {
  const set = new Set<string>()
  for (const value of values) {
    if (!value) continue
    for (const token of value.split(/\s+/)) {
      if (token) set.add(token)
    }
  }
  return [...set].join(" ")
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

    const controlId =
      this.controlId || control.id || uniqueId("fs-field-control")
    control.id = controlId

    if (label) {
      if (!label.htmlFor) {
        label.htmlFor = controlId
      }

      // Markeringen under settes som data-required, og CSS-regelen for den
      // er .fs-label[data-required]. Uten klassen treffer ingen regel, og
      // ledeteksten blir stående ustilet med et attributt som ikke gjør noe.
      label.classList.add("fs-label")

      if (this.requiredMarker === "symbol" || this.requiredMarker === "text") {
        label.setAttribute("data-required", this.requiredMarker)
        label.removeAttribute("data-optional")
      } else if (this.optional) {
        label.setAttribute("data-optional", "")
        label.removeAttribute("data-required")
      }

      if (this.disabled) {
        label.setAttribute("aria-disabled", "true")
      }
    }

    if (this.disabled) {
      control.setAttribute("disabled", "")
      control.setAttribute("aria-disabled", "true")
    } else {
      control.removeAttribute("disabled")
      control.removeAttribute("aria-disabled")
    }

    const helpId = help ? help.id || uniqueId("fs-field-help") : ""
    if (help && !help.id) help.id = helpId

    const errorId = error ? error.id || uniqueId("fs-field-error") : ""
    if (error && !error.id) error.id = errorId

    if (error) {
      const shouldShowError = this.invalid
      error.hidden = !shouldShowError
      error.setAttribute("aria-hidden", String(!shouldShowError))
    }

    if (this.invalid) {
      control.setAttribute("aria-invalid", "true")
      if (
        control.classList.contains("fs-input") ||
        control.classList.contains("fs-textarea") ||
        control.classList.contains("fs-select")
      ) {
        if (!control.hasAttribute("data-state")) {
          control.setAttribute("data-state", "invalid")
        }
      }
    } else {
      control.removeAttribute("aria-invalid")
      if (control.getAttribute("data-state") === "invalid") {
        control.removeAttribute("data-state")
      }
    }

    const describedBy = mergeTokens(
      control.getAttribute("aria-describedby"),
      helpId,
      this.invalid ? errorId : undefined,
      this.describedBy,
    )
    if (describedBy) {
      control.setAttribute("aria-describedby", describedBy)
    } else {
      control.removeAttribute("aria-describedby")
    }
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

import { LitElement, html } from "lit"

export const DS_FIELD_TAG = "ds-field" as const

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

export class DsField extends LitElement {
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
    const control = this.querySelector("input:not([type='hidden']), textarea, select") as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null
    const help = this.querySelector(".ds-help-text, [data-role='help']") as HTMLElement | null
    const error = this.querySelector(".ds-error-text, [data-role='error']") as HTMLElement | null

    if (!control) return

    const controlId = this.controlId || control.id || uniqueId("ds-field-control")
    control.id = controlId

    if (label) {
      if (!label.htmlFor) {
        label.htmlFor = controlId
      }

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

    const helpId = help ? help.id || uniqueId("ds-field-help") : ""
    if (help && !help.id) help.id = helpId

    const errorId = error ? error.id || uniqueId("ds-field-error") : ""
    if (error && !error.id) error.id = errorId

    if (error) {
      const shouldShowError = this.invalid
      error.hidden = !shouldShowError
      error.setAttribute("aria-hidden", String(!shouldShowError))
    }

    if (this.invalid) {
      control.setAttribute("aria-invalid", "true")
      if (
        control.classList.contains("ds-input") ||
        control.classList.contains("ds-textarea") ||
        control.classList.contains("ds-select")
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
    "ds-field": DsField
  }
}

export function defineDsField(tagName = DS_FIELD_TAG): void {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, DsField)
  }
}

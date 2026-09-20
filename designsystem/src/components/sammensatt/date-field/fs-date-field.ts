import { html, LitElement } from "lit"

import { defineFsCalendar } from "../calendar/fs-calendar.js"

export const FS_DATE_FIELD_TAG = "fs-date-field" as const

function uniqueId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function isoToDisplay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  return `${match[3]}-${match[2]}-${match[1]}`
}

/** Returns ISO string, or null if display is not a valid calendar date. */
function displayToIso(display: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(display)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  // Date.UTC overflow reveals invalid dates: 32-06-2026 rolls to 2026-07-02
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
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

export class FsDateField extends LitElement {
  static properties = {
    label: { type: String },
    value: { type: String, reflect: true },
    name: { type: String },
    placeholder: { type: String },
    helpText: { type: String, attribute: "help-text" },
    errorText: { type: String, attribute: "error-text" },
    required: { type: Boolean, reflect: true },
    optional: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    readonly: { type: Boolean, reflect: true },
    invalid: { type: Boolean, reflect: true },
    controlId: { type: String, attribute: "control-id" },
    describedBy: { type: String, attribute: "described-by" },
  }

  label = "Dato"
  value = ""
  name?: string
  placeholder = "DD-MM-YYYY"
  helpText?: string
  errorText?: string
  required = false
  optional = false
  disabled = false
  readonly = false
  invalid = false
  controlId?: string
  describedBy?: string

  /** True when the user has typed a date that is not a valid calendar date. */
  private _inputInvalid = false

  private readonly uid = uniqueId("fs-date-field")

  constructor() {
    super()
    defineFsCalendar()
  }

  createRenderRoot() {
    return this
  }

  render() {
    return html`
      <div class="fs-date-field">
        <label class="fs-label" for=${this.inputId}>${this.label}</label>
        <div class="fs-date-field__field">
          <input
            id=${this.inputId}
            class="fs-input"
            type="text"
            .value=${isoToDisplay(this.value)}
            name=${this.name ?? ""}
            placeholder=${this.placeholder}
            ?required=${this.required}
            ?disabled=${this.disabled}
            ?readonly=${this.readonly}
            @input=${this.handleInput}
            @blur=${this.handleInputBlur}
            @keydown=${this.handleInputKeydown}
          />
          <button
            type="button"
            class="fs-date-field__icon-btn"
            aria-label="Åpne kalender"
            tabindex="-1"
            ?disabled=${this.disabled}
            @click=${this.handleIconClick}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              width="1rem"
              height="1rem"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </button>
          <fs-calendar
            id=${this.calendarId}
            .value=${this.value}
            ?disabled=${this.disabled}
            trigger-hidden
            class="fs-date-field__calendar"
          ></fs-calendar>
        </div>

        ${this.helpText ? html`<p class="fs-help-text" id=${this.helpId}>${this.helpText}</p>` : null}
        ${
          this.errorText
            ? html`<p class="fs-error-text" id=${this.errorId} ?hidden=${!(this.invalid || this._inputInvalid)}>${this.errorText}</p>`
            : null
        }
      </div>
    `
  }

  firstUpdated() {
    this.syncA11y()
    this.attachCalendarListener()
  }

  updated() {
    this.syncA11y()
    this.syncControlValues()
    this.attachCalendarListener()
  }

  private get inputId() {
    return this.controlId || `${this.uid}-input`
  }

  private get calendarId() {
    return `${this.uid}-calendar`
  }

  private get helpId() {
    return `${this.uid}-help`
  }

  private get errorId() {
    return `${this.uid}-error`
  }

  private get inputElement() {
    return this.querySelector(`#${this.inputId}`) as HTMLInputElement | null
  }

  private get calendarElement() {
    return this.querySelector(`#${this.calendarId}`) as HTMLElement | null
  }

  private attachCalendarListener() {
    const calendar = this.calendarElement
    if (!calendar) return

    calendar.removeEventListener(
      "date-select",
      this.handleCalendarSelect as EventListener,
    )
    calendar.addEventListener(
      "date-select",
      this.handleCalendarSelect as EventListener,
    )
  }

  private syncControlValues() {
    const input = this.inputElement
    if (input && input.value !== isoToDisplay(this.value)) {
      input.value = isoToDisplay(this.value)
    }

    const calendar = this.calendarElement as
      | (HTMLElement & { value?: string })
      | null
    if (calendar && calendar.value !== this.value) {
      calendar.value = this.value
    }
  }

  private syncA11y() {
    const label = this.querySelector("label")
    const input = this.inputElement
    const help = this.helpText
      ? (this.querySelector(`#${this.helpId}`) as HTMLElement | null)
      : null
    const error = this.errorText
      ? (this.querySelector(`#${this.errorId}`) as HTMLElement | null)
      : null

    if (!input || !label) return

    if (this.required) {
      label.setAttribute("data-required", "symbol")
      label.removeAttribute("data-optional")
    } else if (this.optional) {
      label.setAttribute("data-optional", "")
      label.removeAttribute("data-required")
    } else {
      label.removeAttribute("data-required")
      label.removeAttribute("data-optional")
    }

    if (this.disabled) {
      label.setAttribute("aria-disabled", "true")
      input.setAttribute("aria-disabled", "true")
    } else {
      label.removeAttribute("aria-disabled")
      input.removeAttribute("aria-disabled")
    }

    const isInvalid = this.invalid || this._inputInvalid
    if (isInvalid) {
      input.setAttribute("data-state", "invalid")
      input.setAttribute("aria-invalid", "true")
    } else {
      if (input.getAttribute("data-state") === "invalid") {
        input.removeAttribute("data-state")
      }
      input.removeAttribute("aria-invalid")
    }

    const describedBy = mergeTokens(
      this.describedBy,
      help ? this.helpId : undefined,
      isInvalid && error ? this.errorId : undefined,
    )
    if (describedBy) {
      input.setAttribute("aria-describedby", describedBy)
    } else {
      input.removeAttribute("aria-describedby")
    }
  }

  private handleIconClick = (event: Event) => {
    event.stopPropagation()
    const calendar = this.calendarElement as
      | (HTMLElement & {
          open?: boolean
          openPopup?: () => void
          closePopup?: () => void
        })
      | null
    if (!calendar) return
    if (calendar.open) {
      calendar.closePopup?.()
    } else {
      calendar.openPopup?.()
    }
  }

  private handleInputKeydown = (event: KeyboardEvent) => {
    if (event.key === " " || event.key === "ArrowDown") {
      event.preventDefault()
      const calendar = this.calendarElement as
        | (HTMLElement & { openPopup?: () => void })
        | null
      calendar?.openPopup?.()
    }
  }

  private handleInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement
    const iso = displayToIso(target.value)
    if (iso !== null) {
      this._inputInvalid = false
      this.value = iso
      this.requestUpdate()
    }
    // Don't update this.value on invalid input — keep last known good ISO
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
  }

  private handleInputBlur = (event: FocusEvent) => {
    const target = event.currentTarget as HTMLInputElement
    const raw = target.value
    if (raw === "") {
      this._inputInvalid = false
    } else {
      this._inputInvalid = displayToIso(raw) === null
    }
    this.requestUpdate()
    this.syncA11y()
  }

  private handleCalendarSelect = (event: Event) => {
    const custom = event as CustomEvent<{ value?: string }>
    const selected = custom.detail?.value
    if (!selected) return

    this._inputInvalid = false
    this.value = selected
    this.requestUpdate()
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))

    queueMicrotask(() => {
      this.inputElement?.focus()
    })
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-date-field": FsDateField
  }
}

export function defineFsDateField(tagName = FS_DATE_FIELD_TAG): void {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, FsDateField)
  }
}

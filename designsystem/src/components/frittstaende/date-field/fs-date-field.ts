import { html, LitElement } from "lit"
import { ifDefined } from "lit/directives/if-defined.js"
import { live } from "lit/directives/live.js"

import { computeFieldAttributes } from "../../ramme/field/field-core.js"
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

/** ISO-streng, eller null om teksten ikke er en dato som finnes. */
function displayToIso(display: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(display)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  // Date.UTC ruller over ved ugyldige datoer: 32-06-2026 blir 2026-07-02
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

  /** Sann når brukeren har skrevet en dato som ikke finnes. */
  private _inputInvalid = false

  /**
   * Teksten brukeren har skrevet, når den ikke er en gyldig dato.
   *
   * Halvskrevet tekst som «01-01-20» kan ikke bli til en ISO-dato, så
   * `value` står stille mens den skrives. Uten at teksten er en del av
   * tilstanden her, ville malen tegnet feltet tomt igjen ved neste
   * oppdatering, og brukeren mistet det de holdt på med.
   */
  private _typed: string | null = null

  /** Det feltet skal vise: brukerens egen tekst, ellers `value`. */
  private get displayValue() {
    return this._typed ?? isoToDisplay(this.value)
  }

  /**
   * Settes `value` utenfra, er brukerens tekst ikke lenger gyldig.
   *
   * Det gjelder også når komponenten setter `value` selv etter at teksten
   * ble en fullstendig dato, og det er riktig: da viser `value` det samme.
   */
  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("value")) this._typed = null
  }

  private readonly uid = uniqueId("fs-date-field")

  constructor() {
    super()
    defineFsCalendar()
  }

  createRenderRoot() {
    return this
  }

  render() {
    const invalid = this.invalid || this._inputInvalid

    // Tilgjengelighetskontrakten regnes ut ett sted, det samme som
    // `<fs-field>` og `fs.field()` bruker. Komponenten hadde tidligere sin
    // egen utgave av den samme logikken, og de to kunne gå fra hverandre.
    const field = computeFieldAttributes({
      id: this.inputId,
      help: Boolean(this.helpText),
      error: Boolean(this.errorText),
      required: this.required ? "symbol" : undefined,
      optional: this.optional,
      invalid,
      disabled: this.disabled,
      describedBy: this.describedBy ? [this.describedBy] : [],
      helpId: this.helpId,
      errorId: this.errorId,
    })

    return html`
      <div class="fs-date-field">
        <label
          class="fs-label"
          for=${field.label.for}
          data-required=${ifDefined(field.label["data-required"])}
          data-optional=${ifDefined(field.label["data-optional"])}
          aria-disabled=${ifDefined(field.label["aria-disabled"])}
          >${this.label}</label
        >
        <div class="fs-date-field__field">
          <input
            id=${field.control.id}
            class="fs-input"
            type="text"
            aria-describedby=${ifDefined(field.control["aria-describedby"])}
            aria-invalid=${ifDefined(field.control["aria-invalid"])}
            data-state=${ifDefined(field.control["data-state"])}
            .value=${live(this.displayValue)}
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
            @date-select=${this.handleCalendarSelect}
          ></fs-calendar>
        </div>

        ${this.helpText ? html`<p class="fs-help-text" id=${this.helpId}>${this.helpText}</p>` : null}
        ${
          this.errorText
            ? html`<p class="fs-error-text" id=${field.error.id} ?hidden=${Boolean(field.error.hidden)}>${this.errorText}</p>`
            : null
        }
      </div>
    `
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
      this._typed = null
      this.value = iso
      this.requestUpdate()
    } else {
      this._typed = target.value
      this.requestUpdate()
    }
    // Ugyldig inndata skal ikke endre this.value. Behold siste gyldige ISO.
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
  }

  private handleCalendarSelect = (event: Event) => {
    const custom = event as CustomEvent<{ value?: string }>
    const selected = custom.detail?.value
    if (!selected) return

    this._inputInvalid = false
    this._typed = null
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

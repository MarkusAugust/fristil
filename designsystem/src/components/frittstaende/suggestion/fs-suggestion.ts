import { html, LitElement } from "lit"
import { ifDefined } from "lit/directives/if-defined.js"
import { live } from "lit/directives/live.js"

import { computeFieldAttributes } from "../../ramme/field/field-core.js"

export const FS_SUGGESTION_TAG = "fs-suggestion" as const

type Option = { value: string; label: string }

/**
 * Et tekstfelt med forslag som snevres inn mens brukeren skriver.
 *
 * Alternativene skrives som `<option>`-barn, slik de ville stått i en
 * `<datalist>`. Komponenten leser dem én gang og bygger lista selv, fordi
 * nettleserens egen `<datalist>` ikke kan styles, oppfører seg ulikt i hver
 * nettleser, og ikke melder antall treff til skjermlesere.
 *
 * Feltet er et fritekstfelt, ikke en nedtrekksliste. Brukeren kan skrive noe
 * som ikke står i lista. Skal bare gitte verdier godtas, er
 * [Select](../../css/select/select.js) riktig.
 *
 * ```html
 * <fs-suggestion label="Kommune" name="kommune">
 *   <option>Bergen</option>
 *   <option>Oslo</option>
 * </fs-suggestion>
 * ```
 */
export class FsSuggestion extends LitElement {
  static properties = {
    label: { type: String },
    value: { type: String, reflect: true },
    name: { type: String },
    placeholder: { type: String },
    helpText: { type: String, attribute: "help-text" },
    errorText: { type: String, attribute: "error-text" },
    invalid: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    optional: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    controlId: { type: String, attribute: "control-id" },
    describedBy: { type: String, attribute: "described-by" },
    noResultsText: { type: String, attribute: "no-results-text" },
    open: { type: Boolean, reflect: true },
  }

  label = ""
  value = ""
  name?: string
  placeholder?: string
  helpText?: string
  errorText?: string
  invalid = false
  required = false
  optional = false
  disabled = false
  controlId?: string
  describedBy?: string
  noResultsText = "Ingen treff"
  open = false

  /** Alternativet som er markert med piltastene. */
  private activeIndex = -1
  private options: Option[] = []
  private readonly uid =
    `fs-suggestion-${Math.random().toString(36).slice(2, 9)}`

  createRenderRoot() {
    return this
  }

  private observer?: MutationObserver

  connectedCallback() {
    super.connectedCallback()
    this.readOptions()
    document.addEventListener("click", this.handleOutsideClick, true)

    // Alternativene byttes ofte ut mens brukeren skriver, for eksempel med
    // treff fra en server. Uten dette ville bare det første settet telt.
    this.observer = new MutationObserver(() => {
      if (this.querySelector("option")) {
        this.readOptions()
        this.requestUpdate()
      }
    })
    this.observer.observe(this, { childList: true })
  }

  disconnectedCallback() {
    document.removeEventListener("click", this.handleOutsideClick, true)
    this.observer?.disconnect()
    this.observer = undefined
    super.disconnectedCallback()
  }

  /** Leser `<option>`-barna og fjerner dem fra visningen. */
  private readOptions() {
    const options = [...this.querySelectorAll("option")]
    if (options.length === 0) return

    this.options = options.map((option) => ({
      value: option.value || (option.textContent ?? "").trim(),
      label: (option.textContent ?? "").trim() || option.value,
    }))

    for (const option of options) option.remove()
  }

  /** Alternativene som passer med det som står i feltet. */
  private get filteredOptions(): Option[] {
    const query = this.value.trim().toLowerCase()
    if (query === "") return this.options
    return this.options.filter((option) =>
      option.label.toLowerCase().includes(query),
    )
  }

  private get inputId() {
    return this.controlId || `${this.uid}-input`
  }

  private get listId() {
    return `${this.uid}-list`
  }

  private get statusId() {
    return `${this.uid}-status`
  }

  render() {
    const field = computeFieldAttributes({
      id: this.inputId,
      help: Boolean(this.helpText),
      error: Boolean(this.errorText),
      helpId: `${this.uid}-help`,
      errorId: `${this.uid}-error`,
      required: this.required ? "symbol" : undefined,
      optional: this.optional,
      invalid: this.invalid,
      disabled: this.disabled,
      describedBy: [this.statusId, this.describedBy ?? ""].filter(Boolean),
    })

    const matches = this.filteredOptions
    const open = this.open && !this.disabled

    return html`
      <label class="fs-label" for=${field.label.for}
        data-required=${ifDefined(field.label["data-required"])}
        data-optional=${ifDefined(field.label["data-optional"])}
        aria-disabled=${ifDefined(field.label["aria-disabled"])}
        >${this.label}</label
      >

      <div class="fs-suggestion__field">
        <input
          class="fs-input"
          id=${field.control.id}
          name=${ifDefined(this.name)}
          type="text"
          role="combobox"
          autocomplete="off"
          .value=${live(this.value)}
          placeholder=${ifDefined(this.placeholder)}
          aria-expanded=${String(open)}
          aria-controls=${this.listId}
          aria-autocomplete="list"
          aria-activedescendant=${ifDefined(
            open && this.activeIndex >= 0
              ? `${this.uid}-option-${this.activeIndex}`
              : undefined,
          )}
          aria-describedby=${ifDefined(field.control["aria-describedby"])}
          aria-invalid=${ifDefined(field.control["aria-invalid"])}
          data-state=${ifDefined(field.control["data-state"])}
          ?disabled=${this.disabled}
          @input=${this.handleInput}
          @keydown=${this.handleKeydown}
          @focus=${this.handleFocus}
        />

        <ul
          class="fs-suggestion__list"
          id=${this.listId}
          role="listbox"
          ?hidden=${!open}
        >
          ${matches.map(
            (option, index) => html`<li
              class="fs-suggestion__option"
              id=${`${this.uid}-option-${index}`}
              role="option"
              aria-selected=${String(index === this.activeIndex)}
              @mousedown=${(event: Event) => this.handleOptionClick(event, option)}
            >
              ${option.label}
            </li>`,
          )}
          ${
            matches.length === 0
              ? html`<li class="fs-suggestion__empty" role="presentation">
                ${this.noResultsText}
              </li>`
              : null
          }
        </ul>
      </div>

      ${
        this.helpText
          ? html`<p class="fs-help-text" id=${field.help.id}>${this.helpText}</p>`
          : null
      }
      ${
        this.errorText
          ? html`<p
            class="fs-error-text"
            id=${field.error.id}
            ?hidden=${Boolean(field.error.hidden)}
          >
            ${this.errorText}
          </p>`
          : null
      }

      <p class="fs-sr-only" id=${this.statusId} role="status">
        ${open ? this.statusText(matches.length) : ""}
      </p>
    `
  }

  /** Antall treff, som tekst skjermleseren leser opp. */
  private statusText(count: number): string {
    if (count === 0) return this.noResultsText
    return count === 1 ? "1 forslag" : `${count} forslag`
  }

  private handleFocus = () => {
    if (!this.disabled) this.show()
  }

  private handleInput = (event: Event) => {
    const input = event.target as HTMLInputElement
    this.value = input.value
    this.activeIndex = -1
    this.show()
  }

  private handleKeydown = (event: KeyboardEvent) => {
    const matches = this.filteredOptions

    if (event.key === "Escape") {
      event.preventDefault()
      this.hide()
      return
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!this.open) this.show()
      if (matches.length === 0) return

      const step = event.key === "ArrowDown" ? 1 : -1
      const next = this.activeIndex + step

      this.activeIndex =
        next < 0 ? matches.length - 1 : next >= matches.length ? 0 : next
      this.requestUpdate()
      return
    }

    if (event.key === "Enter" && this.open && this.activeIndex >= 0) {
      event.preventDefault()
      this.select(matches[this.activeIndex])
    }
  }

  private handleOptionClick = (event: Event, option: Option) => {
    // mousedown og ikke click: feltet mister ellers fokus før valget rekker
    // å skje, og lista lukker seg med den.
    event.preventDefault()
    this.select(option)
  }

  private handleOutsideClick = (event: Event) => {
    if (!this.open) return
    if (this.contains(event.target as Node)) return
    this.hide()
  }

  /** Velger et alternativ og melder fra. */
  select(option: Option) {
    this.value = option.value
    this.hide()

    const input = this.querySelector("input")
    if (input) input.value = option.value

    this.dispatchEvent(
      new CustomEvent("suggestion-select", {
        detail: { value: option.value, label: option.label },
        bubbles: true,
        composed: true,
      }),
    )
    this.dispatchEvent(new Event("change", { bubbles: true }))
  }

  /** Åpner forslagslista. */
  show() {
    this.open = true
  }

  /** Lukker forslagslista. */
  hide() {
    this.open = false
    this.activeIndex = -1
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-suggestion": FsSuggestion
  }
}

export function defineFsSuggestion(tagName = FS_SUGGESTION_TAG): void {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, FsSuggestion)
  }
}

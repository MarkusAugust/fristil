import { css, html, LitElement } from "lit"

export const FS_CALENDAR_TAG = "fs-calendar" as const

type CalendarCell = {
  date: Date
  iso: string
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
}

/**
 * Deler dagene inn i weeks på sju.
 *
 * role="grid" krever role="row" mellom seg og cellene sine. Uten radene
 * melder skjermlesere rutenettet som tomt, og cellene som løsrevne knapper.
 */
function splitInWeeks(cells: CalendarCell[]): CalendarCell[][] {
  const weeks: CalendarCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
}

const weekdayFormatter = new Intl.DateTimeFormat("nb-NO", {
  weekday: "short",
  timeZone: "UTC",
})

const monthFormatter = new Intl.DateTimeFormat("nb-NO", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

function parseIsoDate(value: string | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  return new Date(Date.UTC(year, month, day))
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addDays(date: Date, delta: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + delta,
    ),
  )
}

function addMonths(date: Date, delta: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1),
  )
}

function mondayBasedWeekday(date: Date): number {
  return (date.getUTCDay() + 6) % 7
}

function getToday(): Date {
  const today = new Date()
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
}

function getCalendarCells(
  monthDate: Date,
  selectedIso?: string,
): CalendarCell[] {
  const selectedDate = parseIsoDate(selectedIso)
  const todayIso = formatIsoDate(getToday())
  const monthStart = startOfMonth(monthDate)
  const firstVisible = addDays(monthStart, -mondayBasedWeekday(monthStart))

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstVisible, index)
    const iso = formatIsoDate(date)
    return {
      date,
      iso,
      inMonth: date.getUTCMonth() === monthStart.getUTCMonth(),
      isToday: iso === todayIso,
      isSelected: selectedDate ? iso === formatIsoDate(selectedDate) : false,
    }
  })
}

export class FsCalendar extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    value: { type: String, reflect: true },
    triggerHidden: {
      type: Boolean,
      reflect: true,
      attribute: "trigger-hidden",
    },
  }

  static styles = css`
    :host {
      display: inline-block;
      font-family: inherit;
      color: var(--semantic-page-foreground);
      position: relative;
    }

    .trigger {
      display: inline-grid;
      place-items: center;
      min-width: var(--size-10);
      min-height: var(--size-10);
      padding: 0 var(--size-3);
      font-family: inherit;
      font-size: var(--font-size-m);
      line-height: 1;
      color: var(--semantic-page-foreground);
      background: var(--semantic-page-background);
      border: 1px solid var(--semantic-field-border);
      border-radius: var(--size-1);
      cursor: pointer;
    }

    .trigger:hover:not(:disabled) {
      background: var(--semantic-interactive-background);
      border-color: var(--semantic-interactive-main);
    }

    .trigger:focus-visible,
    .month-button:focus-visible,
    .day:focus-visible {
      outline: 2px solid var(--semantic-interactive-main);
      outline-offset: 2px;
    }

    .popup {
      position: absolute;
      inset-inline-start: 0;
      inset-block-start: calc(100% + var(--size-1));
      z-index: 30;
      width: min(20rem, 92vw);
      padding: var(--size-3);
      border: 1px solid var(--semantic-field-border);
      border-radius: var(--size-1);
      background: var(--semantic-page-background);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
    }

    .popup[hidden] {
      display: none;
    }

    .popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--size-2);
      margin-bottom: var(--size-2);
    }

    .month-label {
      font-size: var(--font-size-s);
      font-weight: 700;
      text-transform: capitalize;
    }

    .month-controls {
      display: inline-flex;
      gap: var(--size-1);
    }

    .month-button,
    .day {
      font-family: inherit;
      border: 1px solid var(--semantic-field-border);
      background: var(--semantic-page-background);
      color: var(--semantic-page-foreground);
      border-radius: var(--size-1);
    }

    .month-button {
      min-width: var(--size-8);
      min-height: var(--size-8);
      cursor: pointer;
    }

    .weekday-row,
    .day-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: var(--size-1);
    }

    /* Ukeradene finnes for ARIA-strukturens skyld. display: contents lar
       dagene ligge rett i rutenettet, så oppsettet er uendret. */
    .week {
      display: contents;
    }

    .weekday {
      text-align: center;
      font-size: var(--font-size-xxs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--semantic-muted-foreground);
      padding-block: var(--size-1);
    }

    .day {
      min-height: var(--size-8);
      cursor: pointer;
      font-size: var(--font-size-xs);
    }

    /* Dagene fra nabomåneden er dempet, men fullt klikkbare. De er altså
       ikke deaktiverte kontroller, og må derfor ha lesbar kontrast. */
    .day[data-outside="true"] {
      color: var(--semantic-neutral-foreground);
      background: var(--semantic-neutral-background);
    }

    .day[data-today="true"] {
      border-color: var(--semantic-interactive-main);
    }

    .day[data-selected="true"] {
      background: var(--semantic-interactive-main);
      color: var(--semantic-interactive-contrast);
      border-color: var(--semantic-interactive-main);
    }

    :host([disabled]) .trigger {
      background: var(--semantic-disabled-background);
      color: var(--semantic-disabled-foreground);
      border-color: var(--semantic-disabled-background);
      cursor: not-allowed;
      pointer-events: none;
    }

    :host([trigger-hidden]) .trigger {
      display: none;
    }

    :host([trigger-hidden]) .popup {
      inset-block-start: var(--size-1);
    }
  `

  /** @attr */
  open = false
  /** @attr */
  disabled = false
  /** @attr */
  value = ""
  /** @attr trigger-hidden */
  triggerHidden = false

  private viewMonth = getToday()

  connectedCallback() {
    super.connectedCallback()
    this.ownerDocument.addEventListener("click", this.handleDocumentClick)
  }

  disconnectedCallback() {
    this.ownerDocument.removeEventListener("click", this.handleDocumentClick)
    super.disconnectedCallback()
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has("value")) {
      this.viewMonth = parseIsoDate(this.value) ?? this.viewMonth
    }
  }

  render() {
    const monthCells = this.open
      ? getCalendarCells(this.viewMonth, this.value)
      : []

    return html`
      <button
        class="trigger"
        part="trigger"
        type="button"
        aria-label="Åpne kalender"
        aria-expanded=${this.open ? "true" : "false"}
        ?disabled=${this.disabled}
        @click=${this.togglePopup}
      >
        📅
      </button>

      <div class="popup" part="popup" ?hidden=${!this.open} @keydown=${this.handlePopupKeydown}>
        <div class="popup-header">
          <div class="month-label" aria-live="polite">${monthFormatter.format(this.viewMonth)}</div>
          <div class="month-controls">
            <button class="month-button" type="button" aria-label="Forrige måned" @click=${this.goToPreviousMonth}>‹</button>
            <button class="month-button" type="button" aria-label="Neste måned" @click=${this.goToNextMonth}>›</button>
          </div>
        </div>

        <div class="weekday-row" aria-hidden="true">
          ${[0, 1, 2, 3, 4, 5, 6].map(
            (index) =>
              html`<div class="weekday">${weekdayFormatter.format(new Date(Date.UTC(2024, 0, 1 + index)))}</div>`,
          )}
        </div>

        <div class="day-grid" role="grid" aria-label=${monthFormatter.format(this.viewMonth)}>
          ${splitInWeeks(monthCells).map(
            (uke) => html`
              <div class="week" role="row">
                ${uke.map(
                  (cell) => html`
                    <button
                      class="day"
                      type="button"
                      role="gridcell"
                      data-date=${cell.iso}
                      data-outside=${String(!cell.inMonth)}
                      data-today=${String(cell.isToday)}
                      data-selected=${String(cell.isSelected)}
                      aria-selected=${String(cell.isSelected)}
                      @click=${this.selectCalendarDate}
                    >
                      ${cell.date.getUTCDate()}
                    </button>
                  `,
                )}
              </div>
            `,
          )}
        </div>
      </div>
    `
  }

  openPopup() {
    if (this.disabled) return
    this.viewMonth = parseIsoDate(this.value) ?? getToday()
    this.open = true
    this.requestUpdate()
    queueMicrotask(() => {
      const selected = this.renderRoot.querySelector<HTMLButtonElement>(
        `.day[data-selected="true"]`,
      )
      selected?.focus()
    })
  }

  closePopup() {
    if (!this.open) return

    // Panelet skjules med [hidden]. Står fokus på en dag inne i det, mister
    // nettleseren fokus til <body>, og en tastaturbruker havner på toppen av
    // siden. Fokus skal derfor tilbake til knappen som åpnet panelet.
    // Lukkes panelet fordi brukeren klikket eller tabbet result, står fokus
    // allerede et annet sted, og da skal vi ikke rive det til oss.
    const fokusStoInniPanelet =
      (this.renderRoot as ShadowRoot).activeElement !== null

    this.open = false
    this.requestUpdate()

    if (fokusStoInniPanelet) {
      queueMicrotask(() => {
        this.renderRoot.querySelector<HTMLButtonElement>(".trigger")?.focus()
      })
    }
  }

  private togglePopup = () => {
    if (this.open) {
      this.closePopup()
    } else {
      this.openPopup()
    }
  }

  private goToPreviousMonth = () => {
    this.viewMonth = addMonths(this.viewMonth, -1)
    this.requestUpdate()
  }

  private goToNextMonth = () => {
    this.viewMonth = addMonths(this.viewMonth, 1)
    this.requestUpdate()
  }

  private selectCalendarDate = (event: Event) => {
    const target = event.currentTarget as HTMLButtonElement | null
    const iso = target?.dataset.date
    if (!iso) return

    this.value = iso
    this.viewMonth = parseIsoDate(iso) ?? this.viewMonth

    // Lukk før hendelsene sendes. closePopup køer et mikrotaskkall som
    // flytter fokus til knappen; en lytter som selv vil flytte fokus — slik
    // fs-date-field gjør til inputfeltet — køer sitt etterpå og vinner.
    this.closePopup()

    this.dispatchEvent(
      new CustomEvent("date-select", {
        detail: { value: iso },
        bubbles: true,
        composed: true,
      }),
    )
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
  }

  private handlePopupKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      this.closePopup()
      return
    }

    const current = event.target as HTMLButtonElement | null
    if (!current?.classList.contains("day")) return

    const iso = current.dataset.date
    if (!iso) return

    const targetDate = parseIsoDate(iso)
    if (!targetDate) return

    let nextDate: Date | null = null
    if (event.key === "ArrowLeft") nextDate = addDays(targetDate, -1)
    if (event.key === "ArrowRight") nextDate = addDays(targetDate, 1)
    if (event.key === "ArrowUp") nextDate = addDays(targetDate, -7)
    if (event.key === "ArrowDown") nextDate = addDays(targetDate, 7)
    if (event.key === "Home") nextDate = startOfMonth(targetDate)
    if (event.key === "End")
      nextDate = addDays(addMonths(startOfMonth(targetDate), 1), -1)

    if (!nextDate) return

    event.preventDefault()
    this.viewMonth = startOfMonth(nextDate)
    this.requestUpdate()

    queueMicrotask(() => {
      const nextButton = this.renderRoot.querySelector<HTMLButtonElement>(
        `.day[data-date="${formatIsoDate(nextDate)}"]`,
      )
      nextButton?.focus()
    })
  }

  private handleDocumentClick = (event: Event) => {
    if (!this.open) return
    const path = event.composedPath()
    if (path.includes(this)) return
    this.closePopup()
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-calendar": FsCalendar
  }
}

export function defineFsCalendar(tagName = FS_CALENDAR_TAG): void {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, FsCalendar)
  }
}

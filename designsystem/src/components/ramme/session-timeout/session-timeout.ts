import { attributes, idOrFallback } from "../../css/shared.js"

export const SESSION_TIMEOUT_CLASS = "fs-session-timeout" as const
export const SESSION_TIMEOUT_DIALOG_CLASS =
  "fs-session-timeout__dialog" as const
export const SESSION_TIMEOUT_TITLE_CLASS = "fs-session-timeout__title" as const
export const SESSION_TIMEOUT_TEXT_CLASS = "fs-session-timeout__text" as const
export const SESSION_TIMEOUT_COUNT_CLASS = "fs-session-timeout__count" as const
export const SESSION_TIMEOUT_ACTIONS_CLASS =
  "fs-session-timeout__actions" as const

/** `value` på knappen som forlenger økten. */
export const SESSION_EXTEND = "extend" as const
/** `value` på knappen som logger ut. */
export const SESSION_LOGOUT = "logout" as const

export type SessionTimeoutOptions = {
  /** Id på overskriften. Dialogen navngis av den med `aria-labelledby`. */
  titleId: string
  /** Sekunder uten aktivitet før varselet kommer. Standard: 25 minutter. */
  warnAt?: number
  /** Sekunder uten aktivitet før økten er ute. Standard: 30 minutter. */
  expiresAt?: number
}

export type SessionTimeoutAttributes = {
  host: {
    class: typeof SESSION_TIMEOUT_CLASS
    "warn-at"?: string
    "expires-at"?: string
    "data-ignore-morph": ""
  }
  dialog: {
    class: typeof SESSION_TIMEOUT_DIALOG_CLASS
    role: "alertdialog"
    "aria-labelledby": string
  }
  title: { class: typeof SESSION_TIMEOUT_TITLE_CLASS; id: string }
  /** Avsnittet med tallet i. Opplesningen er dette avsnittet, med tallet uttalt. */
  text: { class: typeof SESSION_TIMEOUT_TEXT_CLASS }
  /** Tallet. Står tomt i markupen, og komponenten fyller det inn. */
  count: { class: typeof SESSION_TIMEOUT_COUNT_CLASS; "aria-hidden": "true" }
  /** Opplesningen for skjermleser. Står tom i markupen. */
  live: { class: "fs-sr-only"; role: "status" }
  /** Skjemaet rundt knappene. `method="dialog"` lukker dialogen uten skript. */
  actions: { class: typeof SESSION_TIMEOUT_ACTIONS_CLASS; method: "dialog" }
  extend: { class: "fs-button"; value: typeof SESSION_EXTEND }
  logout: {
    class: "fs-button"
    "data-variant": "secondary"
    value: typeof SESSION_LOGOUT
  }
}

/**
 * Attributtene for varselet om at innlogget økt går ut.
 *
 * Den som rendrer, skriver dialogen og hele teksten, på sitt eget språk og
 * med sitt eget oversettelsesverktøy. Komponenten tar bare tiden: den åpner
 * og lukker dialogen, fyller inn tallet og leser opp nedtellingen.
 *
 * Knappene er vanlige knapper i et `<form method="dialog">`. Nettleseren
 * lukker dialogen og setter `returnValue` til knappens `value`, og
 * komponenten leser det. `data-ignore-morph` ber Datastars morfing la
 * varselet være. Uten den tar morfingen `open` og tallet mens dialogen står i
 * topplaget. Komponenten setter `open` tilbake og tallet kommer igjen ved
 * neste tikk. Med attributtet står tallet hele tiden.
 *
 * ```ts
 * const okt = fs.sessionTimeout({ titleId: "okt-tittel" })
 * ```
 * ```html
 * <fs-session-timeout {...okt.host}>
 *   <dialog {...okt.dialog}>
 *     <h2 {...okt.title}>Du blir snart logget ut</h2>
 *     <p {...okt.text}>
 *       Vi logger deg ut om <span {...okt.count}></span>.
 *     </p>
 *     <span {...okt.live}></span>
 *     <form {...okt.actions}>
 *       <button {...okt.extend}>Fortsett å være innlogget</button>
 *       <button {...okt.logout}>Logg ut nå</button>
 *     </form>
 *   </dialog>
 * </fs-session-timeout>
 * ```
 */
export const sessionTimeout = Object.assign(
  ({
    titleId: givenId,
    warnAt = 25 * 60,
    expiresAt = 30 * 60,
  }: SessionTimeoutOptions): SessionTimeoutAttributes => {
    // Reserven gjelder bare den som ikke har en typesjekk.
    const titleId = idOrFallback("fs.sessionTimeout()", givenId, "titleId")

    return {
      host: attributes({
        class: SESSION_TIMEOUT_CLASS,
        "warn-at": warnAt === 25 * 60 ? undefined : String(warnAt),
        "expires-at": expiresAt === 30 * 60 ? undefined : String(expiresAt),
        "data-ignore-morph": "" as const,
      }),
      dialog: attributes({
        class: SESSION_TIMEOUT_DIALOG_CLASS,
        // alertdialog og ikke dialog: varselet er en avbrytelse brukeren ikke
        // ba om, og da skal skjermleseren lese hele innholdet når det åpnes.
        role: "alertdialog" as const,
        "aria-labelledby": titleId,
      }),
      title: attributes({ class: SESSION_TIMEOUT_TITLE_CLASS, id: titleId }),
      text: attributes({ class: SESSION_TIMEOUT_TEXT_CLASS }),
      count: attributes({
        class: SESSION_TIMEOUT_COUNT_CLASS,
        "aria-hidden": "true" as const,
      }),
      live: attributes({
        class: "fs-sr-only" as const,
        role: "status" as const,
      }),
      actions: attributes({
        class: SESSION_TIMEOUT_ACTIONS_CLASS,
        method: "dialog" as const,
      }),
      extend: attributes({
        class: "fs-button" as const,
        value: SESSION_EXTEND,
      }),
      logout: attributes({
        class: "fs-button" as const,
        "data-variant": "secondary" as const,
        value: SESSION_LOGOUT,
      }),
    }
  },
  {
    /** Klassen på selve `<dialog>`. */
    dialog: SESSION_TIMEOUT_DIALOG_CLASS,
    /** Klassen på overskriften. */
    title: SESSION_TIMEOUT_TITLE_CLASS,
    /** Klassen på avsnittet med tallet i. */
    text: SESSION_TIMEOUT_TEXT_CLASS,
    /** Klassen på tallet komponenten fyller inn. */
    count: SESSION_TIMEOUT_COUNT_CLASS,
    /** Klassen på skjemaet med knappene. */
    actions: SESSION_TIMEOUT_ACTIONS_CLASS,
  },
)

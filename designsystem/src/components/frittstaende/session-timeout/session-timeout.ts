import { attributes } from "../../css/shared.js"

export const SESSION_TIMEOUT_CLASS = "fs-session-timeout" as const
export const SESSION_TIMEOUT_DIALOG_CLASS =
  "fs-session-timeout__dialog" as const

export type SessionTimeoutOptions = {
  /** Sekunder uten aktivitet før varselet kommer. Standard: 25 minutter. */
  warnAt?: number
  /** Sekunder uten aktivitet før økten er ute. Standard: 30 minutter. */
  expiresAt?: number
}

export type SessionTimeoutAttributes = {
  class: typeof SESSION_TIMEOUT_CLASS
  "warn-at"?: string
  "expires-at"?: string
  "data-ignore-morph": ""
}

/**
 * Attributtene for varselet om at innlogget økt går ut.
 *
 * Nedtellingen er klientens klokke, og endrer seg hvert sekund ut fra når
 * brukeren sist rørte tastaturet. Det er en tilstand ingen server kan sende,
 * og derfor eier komponenten alt inni seg. `data-ignore-morph` er ikke
 * valgfri: uten den river Datastars morfing dialogen bort mens den står åpen.
 *
 * ```ts
 * <fs-session-timeout {...fs.sessionTimeout({ warnAt: 1500, expiresAt: 1800 })} />
 * ```
 */
export const sessionTimeout = ({
  warnAt = 25 * 60,
  expiresAt = 30 * 60,
}: SessionTimeoutOptions = {}): SessionTimeoutAttributes =>
  attributes({
    class: SESSION_TIMEOUT_CLASS,
    "warn-at": warnAt === 25 * 60 ? undefined : String(warnAt),
    "expires-at": expiresAt === 30 * 60 ? undefined : String(expiresAt),
    "data-ignore-morph": "" as const,
  })

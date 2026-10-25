import { attributes } from "../../css/shared.js"

export const CONNECTION_STATUS_CLASS = "fs-connection-status" as const
export const CONNECTION_STATUS_BAR_CLASS = "fs-connection-status__bar" as const

export type ConnectionStatusOptions = {
  /** Teksten når forbindelsen er borte. */
  offlineText?: string
  /** Teksten når den kommer tilbake. Vises en kort stund. */
  onlineText?: string
}

export type ConnectionStatusAttributes = {
  class: typeof CONNECTION_STATUS_CLASS
  "offline-text"?: string
  "online-text"?: string
  "data-ignore-morph": ""
}

/**
 * Attributtene for linja som sier fra at forbindelsen er borte.
 *
 * Serveren kan per definisjon ikke fortelle deg at den er utilgjengelig. Er
 * den nede, kommer det ingenting derfra å rendre. Derfor eier komponenten
 * alt innholdet, og `data-ignore-morph` hindrer at en senere patch river det
 * bort i det øyeblikket forbindelsen er tilbake.
 *
 * ```ts
 * <fs-connection-status {...fs.connectionStatus()} />
 * ```
 */
export const connectionStatus = ({
  offlineText,
  onlineText,
}: ConnectionStatusOptions = {}): ConnectionStatusAttributes =>
  attributes({
    class: CONNECTION_STATUS_CLASS,
    "offline-text": offlineText,
    "online-text": onlineText,
    "data-ignore-morph": "" as const,
  })

import { attributes, idEllerReserve } from "../../css/shared.js"

export const POPOVER_CLASS = "fs-popover" as const

export type PopoverOptions = {
  /** Id på panelet. Kobler knappen til panelet med `aria-controls`. */
  id: string
  /** Panelet er åpent. Standard: lukket. */
  open?: boolean
}

export type PopoverAttributes = {
  host: {
    open?: true
  }
  trigger: {
    "aria-expanded": "true" | "false"
    "aria-controls": string
  }
  panel: {
    class: typeof POPOVER_CLASS
    id: string
    popover: "manual"
  }
}

/**
 * Attributtene for et sprettoppvindu.
 *
 * Serveren skriver både knappen og panelet med koblingen mellom dem.
 * `<fs-popover>` regner ut posisjonen og lukker ved klikk utenfor.
 *
 * ```ts
 * const boks = fs.popover({ id: "hjelp" })
 * ```
 * ```html
 * <fs-popover>
 *   <button {...boks.trigger}>Hva betyr dette?</button>
 *   <div {...boks.panel}>Vi bruker fødselsdatoen til å finne riktig sats.</div>
 * </fs-popover>
 * ```
 */
export const popover = ({
  id: oppgittId,
  open = false,
}: PopoverOptions): PopoverAttributes => {
  // Reserven gjelder bare den som ikke har en typesjekk.
  const id = idEllerReserve("fs.popover()", oppgittId)

  return {
    host: attributes({
      // `open` må stå på verten, ikke bare i knappens aria-expanded. Uten det
      // sa markupen at panelet var åpent mens komponenten mente det var lukket.
      // Ingen bevaringsliste: river en patch attributtet bort, setter
      // komponenten det tilbake, og `server-controlled` slår av reparasjonen
      // når serveren skal eie tilstanden.
      open: open ? (true as const) : undefined,
    }),
    trigger: attributes({
      "aria-expanded": (open ? "true" : "false") as "true" | "false",
      "aria-controls": id,
    }),
    panel: attributes({
      class: POPOVER_CLASS,
      id,
      // `manual` og ikke `auto`: komponenten lukker selv, slik at knappen kan
      // brukes til å lukke igjen uten at nettleseren rekker å lukke først.
      popover: "manual" as const,
    }),
  }
}

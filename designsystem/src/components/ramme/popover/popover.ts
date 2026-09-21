import { attributes } from "../../css/shared.js"

export const POPOVER_CLASS = "fs-popover" as const

export type PopoverOptions = {
  /** Id på panelet. Kobler knappen til panelet med `aria-controls`. */
  id: string
  /** Panelet er åpent. Standard: lukket. */
  open?: boolean
}

export type PopoverAttributes = {
  host: {
    "data-preserve-attr": "open"
  }
  trigger: {
    slot: "trigger"
    "aria-expanded": "true" | "false"
    "aria-controls": string
    "data-preserve-attr": "aria-expanded"
  }
  panel: {
    class: typeof POPOVER_CLASS
    id: string
    popover: "manual"
    "data-preserve-attr": "style"
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
  id,
  open = false,
}: PopoverOptions): PopoverAttributes => ({
  // Om panelet er åpent står som `open` på verten, og det er brukerens
  // tilstand, ikke serverens. Uten dette lukker morfingen panelet i det
  // serveren patcher området rundt.
  host: { "data-preserve-attr": "open" },
  trigger: attributes({
    slot: "trigger" as const,
    "aria-expanded": (open ? "true" : "false") as "true" | "false",
    "aria-controls": id,
    // Komponenten endrer aria-expanded når panelet åpnes. Uten dette fjerner
    // Datastars morfing det igjen, siden serverens utgave sier noe annet.
    "data-preserve-attr": "aria-expanded" as const,
  }),
  panel: attributes({
    class: POPOVER_CLASS,
    id,
    // `manual` og ikke `auto`: komponenten lukker selv, slik at knappen kan
    // brukes til å lukke igjen uten at nettleseren rekker å lukke først.
    popover: "manual" as const,
    // Posisjonen regnes ut mot knappens plass på skjermen og settes som
    // `--fs-popover-top` og `--fs-popover-left` i style-attributtet. Uten
    // dette river morfingen posisjonen bort, og panelet hopper til hjørnet.
    "data-preserve-attr": "style" as const,
  }),
})

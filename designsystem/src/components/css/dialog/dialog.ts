import { attributes } from "../shared.js"

export const DIALOG_CLASS = "fs-dialog" as const
export const DIALOG_TITLE_CLASS = "fs-dialog__title" as const
export const DIALOG_BODY_CLASS = "fs-dialog__body" as const
export const DIALOG_FOOTER_CLASS = "fs-dialog__footer" as const

export type DialogAttributes = {
  class: typeof DIALOG_CLASS
}

/**
 * Attributtene for en dialog.
 *
 * Klassen hører på et `<dialog>`. Åpne den med `showModal()`, ikke ved å
 * sette `open`: bare den første flytter fokus inn, holder fokus inne i
 * dialogen, lukker på Escape og gjør resten av siden utilgjengelig. Et
 * `<dialog open>` i markupen er en boks på siden, ikke en dialog.
 *
 * ```ts
 * <dialog {...dialog()} aria-labelledby="tittel">
 *   <h2 {...{ class: dialog.title }} id="tittel">Slette søknaden?</h2>
 * </dialog>
 * ```
 */
export const dialog = Object.assign(
  (): DialogAttributes => attributes({ class: DIALOG_CLASS }),
  {
    /** Klassen på overskriften i dialogen. */
    title: DIALOG_TITLE_CLASS,
    /** Klassen på innholdet, som ruller når dialogen blir for høy. */
    body: DIALOG_BODY_CLASS,
    /** Klassen på raden med knapper nederst. */
    footer: DIALOG_FOOTER_CLASS,
  },
)

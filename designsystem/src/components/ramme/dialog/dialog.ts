import { attributes } from "../../css/shared.js"

export const DIALOG_CLASS = "fs-dialog" as const
export const DIALOG_TITLE_CLASS = "fs-dialog__title" as const
export const DIALOG_BODY_CLASS = "fs-dialog__body" as const
export const DIALOG_FOOTER_CLASS = "fs-dialog__footer" as const

export type DialogOptions = {
  /** Id på overskriften. Dialogen navngis av den med `aria-labelledby`. */
  titleId: string
  /** Dialogen er åpen. Standard: lukket. */
  open?: boolean
}

export type DialogAttributes = {
  host: {
    open?: true
  }
  dialog: {
    class: typeof DIALOG_CLASS
    "aria-labelledby": string
    "data-preserve-attr": "open"
  }
  title: {
    class: typeof DIALOG_TITLE_CLASS
    id: string
  }
  body: { class: typeof DIALOG_BODY_CLASS }
  footer: { class: typeof DIALOG_FOOTER_CLASS }
}

/**
 * Attributtene for en dialog.
 *
 * Å åpne en dialog er et kall, ikke et attributt: bare `showModal()` flytter
 * fokus inn, holder fokus inne i dialogen, lukker på Escape og gjør resten
 * av siden utilgjengelig. Et `<dialog open>` i markupen er en boks på siden.
 *
 * Det er et problem for en server som bare sender HTML, for den kan ikke
 * kalle noe i nettleseren. Derfor sier serveren at dialogen er åpen, og
 * `<fs-dialog>` gjør kallet.
 *
 * De to `open`-ene er ikke det samme, og det er verdt å holde dem fra hverandre:
 *
 * - `open` på **verten** er serverens beskjed om at dialogen skal vises. Den
 *   er ikke fredet. Hadde den vært det, kunne serveren aldri åpnet dialogen
 *   igjen etter at brukeren hadde lukket den én gang. Sender serveren
 *   området på nytt med `open` fortsatt satt, åpnes dialogen altså igjen.
 *   Skal en avvisning vare, må appen si fra til serveren.
 * - `open` på **`<dialog>`** setter nettleseren selv når `showModal()`
 *   kalles. Serveren skriver det aldri, så det må fredes, ellers river
 *   morfingen det bort og lukker dialogen igjen ved neste patch.
 *
 * ```ts
 * const boks = fs.dialog({ titleId: "slett-tittel", open: true })
 * ```
 * ```html
 * <fs-dialog {...boks.host}>
 *   <dialog {...boks.dialog}>
 *     <h2 {...boks.title}>Slette søknaden?</h2>
 *     <div {...boks.body}>Søknaden og vedleggene blir borte.</div>
 *     <form method="dialog" {...boks.footer}>
 *       <button class="fs-button" value="avbryt">Avbryt</button>
 *     </form>
 *   </dialog>
 * </fs-dialog>
 * ```
 */
export const dialog = Object.assign(
  ({ titleId, open = false }: DialogOptions): DialogAttributes => ({
    host: attributes({
      open: open ? (true as const) : undefined,
    }),
    dialog: attributes({
      class: DIALOG_CLASS,
      "aria-labelledby": titleId,
      // `showModal()` setter `open` på selve `<dialog>`. Serveren skriver
      // det aldri, så uten fredningen river morfingen det bort og lukker
      // dialogen i det øyeblikket den åpnet den.
      "data-preserve-attr": "open" as const,
    }),
    title: attributes({ class: DIALOG_TITLE_CLASS, id: titleId }),
    body: attributes({ class: DIALOG_BODY_CLASS }),
    footer: attributes({ class: DIALOG_FOOTER_CLASS }),
  }),
  {
    /** Klassen på selve `<dialog>`. */
    dialog: DIALOG_CLASS,
    /** Klassen på overskriften i dialogen. */
    title: DIALOG_TITLE_CLASS,
    /** Klassen på innholdet, som ruller når dialogen blir for høy. */
    body: DIALOG_BODY_CLASS,
    /** Klassen på raden med knapper nederst. */
    footer: DIALOG_FOOTER_CLASS,
  },
)

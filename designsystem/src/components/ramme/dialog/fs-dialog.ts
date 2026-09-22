import { defineElement, HostElement } from "../../host-element.js"

export const FS_DIALOG_TAG = "fs-dialog" as const

/**
 * En modal dialog en server kan åpne.
 *
 * Å åpne en `<dialog>` er et kall og ikke et attributt. `showModal()` flytter
 * fokus inn, holder fokus inne i dialogen, lukker på Escape og gjør resten av
 * siden utilgjengelig. `<dialog open>` gjør ingen av delene: det er en boks
 * på siden.
 *
 * En server som bare sender HTML kan ikke kalle noe. Uten denne komponenten
 * kunne en app i Datastar, htmx eller en Go-mal altså ikke åpne en dialog i
 * det hele tatt, uten å skrive sitt eget skript ved siden av. Her sier
 * serveren i stedet at dialogen er åpen, og komponenten gjør kallet.
 *
 * Lukker brukeren dialogen, med Escape, med en knapp i en
 * `<form method="dialog">` eller med et klikk på flaten bak, fjernes `open`
 * fra verten igjen, slik at markupen sier det samme som skjermen. Det er
 * derfor `open` står i `data-preserve-attr` fra `fs.dialog()`: uten det
 * ville morfingen åpnet dialogen igjen ved neste patch.
 *
 * ```html
 * <fs-dialog open data-preserve-attr="open">
 *   <dialog class="fs-dialog" aria-labelledby="tittel">
 *     <h2 class="fs-dialog__title" id="tittel">Vedtaket er registrert</h2>
 *     <div class="fs-dialog__body">Saken er ferdigbehandlet.</div>
 *     <form method="dialog" class="fs-dialog__footer">
 *       <button class="fs-button" value="lukk">Lukk</button>
 *     </form>
 *   </dialog>
 * </fs-dialog>
 * ```
 */
export class FsDialog extends HostElement {
  static observedAttributes = ["open"]

  private observer?: MutationObserver

  /** Om dialogen er åpen. Speiler `open`-attributtet. */
  get open(): boolean {
    return this.hasAttribute("open")
  }

  set open(value: boolean) {
    if (value) this.setAttribute("open", "")
    else this.removeAttribute("open")
  }

  connectedCallback(): void {
    // Serveren kan sende dialogen inn i et område som allerede står i siden,
    // og da finnes ikke `<dialog>` ennå når komponenten kobles til.
    this.observer = new MutationObserver(() => this.sync())
    this.observer.observe(this, { childList: true, subtree: true })
    this.sync()
  }

  disconnectedCallback(): void {
    this.observer?.disconnect()
    this.observer = undefined
    this.dialog?.removeEventListener("close", this.handleClose)
  }

  attributeChangedCallback(): void {
    this.sync()
  }

  private get dialog(): HTMLDialogElement | null {
    return this.querySelector("dialog")
  }

  private handleClose = (): void => {
    // Brukeren lukket den. Markupen skal si det samme som skjermen, ellers
    // ville neste patch åpnet dialogen igjen.
    this.removeAttribute("open")
    this.dispatchEvent(
      new CustomEvent("dialog-toggle", {
        bubbles: true,
        detail: { open: false },
      }),
    )
  }

  private sync(): void {
    const dialog = this.dialog

    // `showModal()` kaster «The element is not in a Document» hvis dialogen
    // ikke står i siden. Det er ikke teoretisk: en morfer bygger serverens
    // utgave i et løsrevet tre før den sammenlignes, og et egendefinert
    // element tas i bruk der også. Uten denne linja kastet komponenten ved
    // hver eneste patch som rørte dialogen. Står den løsrevet nå, kjøres
    // `sync()` uansett på nytt når den kobles til.
    if (!dialog?.isConnected) return

    dialog.removeEventListener("close", this.handleClose)
    dialog.addEventListener("close", this.handleClose)

    // `showModal()` kaster hvis dialogen alt er åpen, og `close()` på en
    // lukket dialog utløser en `close`-hendelse som ville fjernet `open`
    // under beina på oss. Derfor sammenlignes det med den faktiske
    // tilstanden framfor å kalle blindt.
    if (this.open && !dialog.open) {
      dialog.showModal()
      this.dispatchEvent(
        new CustomEvent("dialog-toggle", {
          bubbles: true,
          detail: { open: true },
        }),
      )
    } else if (!this.open && dialog.open) {
      dialog.close()
    }
  }
}

export function defineFsDialog(): void {
  defineElement(FS_DIALOG_TAG, FsDialog)
}

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
 * Lukker brukeren dialogen, med Escape eller med en knapp i en
 * `<form method="dialog">`, fjernes `open` fra verten igjen, slik at
 * markupen sier det samme som skjermen. Komponenten melder fra med
 * `dialog-toggle`, som bærer `open` og `returnValue`. Et klikk på flaten bak
 * lukker den ikke: det gjør heller ikke en vanlig `<dialog>`, og komponenten
 * legger ingenting til.
 *
 * `open` er serverens. Sender serveren området på nytt med `open` fortsatt
 * satt, åpnes dialogen igjen. Hadde attributtet stått i
 * `data-preserve-attr`, kunne serveren aldri åpnet dialogen på nytt etter
 * første lukking.
 *
 * Skriv `open` på selve `<dialog>` også når dialogen skal vises. Uten
 * JavaScript er en `<dialog>` uten `open` skjult, og da finnes ikke
 * innholdet i det hele tatt. `fs.dialog({ open: true })` gir begge.
 *
 * ```html
 * <fs-dialog open>
 *   <dialog class="fs-dialog" aria-labelledby="tittel" open data-preserve-attr="open">
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
  private dialogElement?: HTMLDialogElement

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
    // og da finnes ikke `<dialog>` ennå når komponenten kobles til. Bare
    // egne barn observeres: dialogen er alltid et direkte barn, og
    // innholdet inni den endrer seg ved hver patch.
    this.observer = new MutationObserver(() => this.sync())
    this.observer.observe(this, { childList: true })
    this.sync()
  }

  disconnectedCallback(): void {
    this.observer?.disconnect()
    this.observer = undefined
    this.dialogElement?.removeEventListener("close", this.handleClose)
    this.dialogElement = undefined
  }

  attributeChangedCallback(): void {
    this.sync()
  }

  /**
   * Dialogen komponenten styrer.
   *
   * Bare et direkte barn. En `<dialog>` lenger ned i treet kan tilhøre noe
   * annet, og skal ikke åpnes av denne komponenten.
   */
  private get dialog(): HTMLDialogElement | null {
    return this.querySelector(":scope > dialog")
  }

  private meld(open: boolean, returnValue = ""): void {
    this.dispatchEvent(
      new CustomEvent("dialog-toggle", {
        bubbles: true,
        // Uten `composed` stopper hendelsen i en skyggerot, og en lytter
        // utenfor får aldri vite at dialogen ble lukket.
        composed: true,
        detail: { open, returnValue },
      }),
    )
  }

  private handleClose = (): void => {
    // `close` er køet, ikke synkron. Rekker serveren å lukke og åpne igjen i
    // samme oppgave, gjelder ikke denne hendelsen lenger, og uten sperren
    // lukket komponenten dialogen den nettopp hadde åpnet.
    if (this.dialog?.matches(":modal")) return

    // Lukket serveren den, er verten alt i takt, og `sync()` har meldt fra.
    if (!this.open) return

    this.removeAttribute("open")
    this.meld(false, this.dialog?.returnValue ?? "")
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

    if (dialog !== this.dialogElement) {
      this.dialogElement?.removeEventListener("close", this.handleClose)
      this.dialogElement = dialog
      dialog.addEventListener("close", this.handleClose)
    }

    // `:modal` og ikke `open`. De to er ikke det samme: et `<dialog open>`
    // i markupen, og en dialog som har vært flyttet i DOM-en mens den var
    // åpen, har `open` uten å være modal. Da er den en boks på siden, uten
    // fokusfelle og uten Escape, altså nøyaktig det komponenten finnes for å
    // hindre.
    const modal = dialog.matches(":modal")

    if (this.open && !modal) {
      /*
       * `showModal()` kaster `InvalidStateError` når `open` står der fra før
       * uten at dialogen er modal. Attributtet må altså bort først.
       *
       * Men ikke med `close()`. Den sender en ekte `close`-hendelse, og
       * siden serveren nå skriver `open` på `<dialog>` selv, ville den
       * hendelsen kommet ved hver eneste lasting av en dialog som er åpen.
       * En app som melder lukkingen til serveren, slik dokumentasjonen viser,
       * fikk da en spøkelseslukking før brukeren hadde sett dialogen.
       * `removeAttribute` gir den samme tillatelsen uten hendelsen.
       */
      dialog.removeAttribute("open")
      dialog.showModal()
      this.meld(true)
    } else if (!this.open && dialog.open) {
      dialog.close()
      this.meld(false, dialog.returnValue)
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-dialog": FsDialog
  }
}

export function defineFsDialog(tagName = FS_DIALOG_TAG): void {
  defineElement(tagName, FsDialog)
}

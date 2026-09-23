/**
 * Monterer markup i en shadow root, uten noen CSS-reset.
 *
 * Et designsystem kan ikke regne med at konsumenten har en reset. Testsider
 * og rammeverk har som regel en. Tailwind setter for eksempel
 * `box-sizing: border-box` på alt, og det skjuler feil i komponentene våre.
 * `.fs-textarea` hadde `width: 100%` uten `box-sizing`, og ble derfor bredere
 * enn boksen sin hos alle uten reset. Ingen test fanget det, fordi alle
 * testene kjørte på sider som tilfeldigvis hadde en.
 *
 * Inne i en shadow root gjelder bare nettleserens egne standardverdier pluss
 * stilarket vi sender inn. Det er den ærligste testen.
 */

export type IsolertFlate = {
  /** Shadow rooten innholdet ligger i. */
  rot: ShadowRoot
  /** Boksen innholdet ligger i, med den bredden testen ba om. */
  boks: HTMLElement
}

/**
 * @param css  Stilarket komponenten trenger, som tekst (`import "...css?inline"`)
 * @param html Markupen som skal prøves
 * @param bredde Bredden på boksen rundt, for eksempel "300px"
 */
export function monterIsolert(
  css: string,
  html: string,
  bredde = "300px",
): IsolertFlate {
  document.body.innerHTML = '<div id="fs-isolert"></div>'

  const vert = document.getElementById("fs-isolert")
  if (!(vert instanceof HTMLElement)) {
    throw new Error("Klarte ikke å montere den isolerte flaten")
  }

  const rot = vert.attachShadow({ mode: "open" })
  rot.innerHTML = `<style>${css}</style><div id="boks" style="width: ${bredde}">${html}</div>`

  const boks = rot.getElementById("boks")
  if (!(boks instanceof HTMLElement)) {
    throw new Error("Klarte ikke å finne boksen")
  }

  return { rot, boks }
}

export type Overflyt = {
  merke: string
  piksler: number
}

/**
 * Finner elementer som stikker utenfor boksen sin.
 *
 * Returnerer tom liste når alt holder seg innenfor.
 */
export function finnOverflyt(boks: HTMLElement): Overflyt[] {
  const ramme = boks.getBoundingClientRect()

  return [...boks.querySelectorAll("*")]
    .map((element) => ({ element, mål: element.getBoundingClientRect() }))
    .filter(({ mål }) => mål.width > 0 && mål.right > ramme.right + 0.5)
    .map(({ element, mål }) => ({
      merke:
        element.tagName.toLowerCase() +
        (element.className
          ? `.${String(element.className).split(" ")[0]}`
          : ""),
      piksler: Math.round(mål.right - ramme.right),
    }))
}

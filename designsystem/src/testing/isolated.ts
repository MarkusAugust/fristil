/**
 * Mounts markup in a shadow root, without any CSS reset.
 *
 * A design system cannot count on the consumer having a reset. Test pages
 * and frameworks usually have one. Tailwind, for example, sets
 * `box-sizing: border-box` on everything, and that hides bugs in our
 * components. `.lt-textarea` had `width: 100%` without `box-sizing`, and so
 * was wider than its box for everyone without a reset. No test caught it,
 * because all the tests ran on pages that happened to have one.
 *
 * Inside a shadow root only the browser's defaults apply, plus the
 * stylesheet we pass in. That is the most honest test.
 */

export type IsolertFlate = {
  /** The shadow root the content is in. */
  rot: ShadowRoot
  /** The box the content is in, with the width the test asked for. */
  boks: HTMLElement
}

/**
 * @param css  The stylesheet the component needs, as text (`import "...css?inline"`)
 * @param html The markup to test
 * @param bredde The width of the surrounding box, for example "300px"
 */
export function monterIsolert(
  css: string,
  html: string,
  bredde = "300px",
): IsolertFlate {
  document.body.innerHTML = '<div id="lt-isolert"></div>'

  const vert = document.getElementById("lt-isolert")
  if (!(vert instanceof HTMLElement)) {
    throw new Error("Could not mount the isolated surface")
  }

  const rot = vert.attachShadow({ mode: "open" })
  rot.innerHTML = `<style>${css}</style><div id="boks" style="width: ${bredde}">${html}</div>`

  const boks = rot.getElementById("boks")
  if (!(boks instanceof HTMLElement)) {
    throw new Error("Could not find the box")
  }

  return { rot, boks }
}

export type Overflyt = {
  merke: string
  piksler: number
}

/**
 * Finds elements that stick out of their box.
 *
 * Returns an empty list when everything stays inside.
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

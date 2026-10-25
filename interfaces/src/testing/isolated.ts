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

export type IsolatedSurface = {
  /** The shadow root the content is in. */
  root: ShadowRoot
  /** The box the content is in, with the width the test asked for. */
  box: HTMLElement
}

/**
 * @param css  The stylesheet the component needs, as text (`import "...css?inline"`)
 * @param html The markup to test
 * @param width The width of the surrounding box, for example "300px"
 */
export function mountIsolated(
  css: string,
  html: string,
  width = "300px",
): IsolatedSurface {
  document.body.innerHTML = '<div id="lt-isolated"></div>'

  const host = document.getElementById("lt-isolated")
  if (!(host instanceof HTMLElement)) {
    throw new Error("Could not mount the isolated surface")
  }

  const root = host.attachShadow({ mode: "open" })
  root.innerHTML = `<style>${css}</style><div id="box" style="width: ${width}">${html}</div>`

  const box = root.getElementById("box")
  if (!(box instanceof HTMLElement)) {
    throw new Error("Could not find the box")
  }

  return { root: root, box: box }
}

export type Overflow = {
  label: string
  pixels: number
}

/**
 * Finds elements that stick out of their box.
 *
 * Returns an empty list when everything stays inside.
 */
export function findOverflow(box: HTMLElement): Overflow[] {
  const bounds = box.getBoundingClientRect()

  return [...box.querySelectorAll("*")]
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0 && rect.right > bounds.right + 0.5)
    .map(({ element, rect }) => ({
      label:
        element.tagName.toLowerCase() +
        (element.className
          ? `.${String(element.className).split(" ")[0]}`
          : ""),
      pixels: Math.round(rect.right - bounds.right),
    }))
}

/**
 * The page as markup, with what the browser computed written on each
 * element, for the core's accessibility tree (`accessibility.ts`).
 *
 * The core computes what the specifications define (roles, names,
 * descriptions, states) and nothing a browser computes: it has no style
 * engine, and it cannot see focus or a field's value. This writes those
 * facts on a copy of the page, never on the page itself, where the
 * components' observers would see them. The names are the core's `FACTS`;
 * the model tests require this to write exactly those.
 *
 * - `data-lt-ax-visible`: "1" when the element is rendered and not
 *   `visibility: hidden`. A `display: contents` element has no box of its
 *   own, so `checkVisibility()` is false for it; it counts as rendered when
 *   its parent is.
 * - `data-lt-ax-display`: the computed `display`.
 * - `data-lt-ax-before`, `data-lt-ax-after`: the computed `content` of the
 *   two pseudo-elements.
 * - `data-lt-ax-focused`, `-checked`, `-mixed`, `-disabled`, `-modal`: "1"
 *   on the focused element, a checked or indeterminate checkbox or radio, an
 *   element that matches `:disabled`, and a modal dialog.
 * - `data-lt-ax-value`: a text field's value, or the chosen option's text.
 * - `data-lt-ax-invalid`, `data-lt-ax-selected`: "1" on a field that fails a
 *   constraint other than being empty, or matches `:user-invalid`, and on a
 *   chosen option.
 *
 * The function is self-contained, with no imports and nothing from the
 * scope around it, because Playwright sends its source to the page as it is.
 */
export function renderedMarkup(): string {
  const root = document.documentElement
  const live = [root, ...root.querySelectorAll("*")]
  const copy = root.cloneNode(true) as Element
  const copies = [copy, ...copy.querySelectorAll("*")]
  let focused: Element | null = document.activeElement
  while (focused?.shadowRoot?.activeElement)
    focused = focused.shadowRoot.activeElement
  const rendered = (element: Element): boolean => {
    const style = getComputedStyle(element)
    if (style.display === "contents")
      return (
        style.visibility === "visible" &&
        (element.parentElement === null || rendered(element.parentElement))
      )
    return element.checkVisibility({ visibilityProperty: true })
  }
  live.forEach((element, i) => {
    const out = copies[i]
    const style = getComputedStyle(element)
    const write = (name: string, value: string) =>
      out.setAttribute(`data-lt-ax-${name}`, value)
    write("visible", rendered(element) ? "1" : "0")
    write("display", style.display)
    write("before", getComputedStyle(element, "::before").content)
    write("after", getComputedStyle(element, "::after").content)
    if (element === focused) write("focused", "1")
    if (element instanceof HTMLInputElement) {
      if (element.checked) write("checked", "1")
      // Only a checkbox is mixed: a radio ignores `indeterminate`.
      if (element.indeterminate && element.type === "checkbox")
        write("mixed", "1")
    }
    if (element instanceof HTMLOptionElement && element.selected)
      write("selected", "1")
    // A field that fails a constraint other than being empty, or that the
    // user has touched (HTML-AAM does not expose an untouched empty
    // required field as invalid).
    if (
      "validity" in element &&
      element.validity instanceof ValidityState &&
      !element.validity.valid &&
      (!element.validity.valueMissing || element.matches(":user-invalid"))
    )
      write("invalid", "1")
    if (element.matches(":disabled")) write("disabled", "1")
    if (element.matches("dialog:modal")) write("modal", "1")
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    )
      write("value", element.value)
    if (element instanceof HTMLSelectElement)
      write("value", [...element.selectedOptions].map((o) => o.text).join(" "))
  })
  // The core leaves out what is in `<head>`, and serialising it was most of
  // the time a model test took.
  copy.querySelector("head")?.replaceChildren()
  return copy.outerHTML
}

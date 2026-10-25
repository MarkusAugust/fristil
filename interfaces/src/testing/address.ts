/**
 * Sets the address before a test, or clears it, without
 * `history.replaceState`.
 *
 * WebKit throws after a hundred calls to `replaceState` in ten seconds, and
 * the components use up the same calls every time a tab is selected. When
 * the tests used them too, the tab tests hit the limit, and every test after
 * that failed in WebKit. `location.hash` does not count (tried in all three
 * engines).
 *
 * The page is cleared first, so the navigation does not reach components
 * from the previous test, and `hashchange` is awaited, so it does not arrive
 * during the test.
 */
export async function setAddress(hash: string): Promise<void> {
  document.body.innerHTML = ""
  await goTo(hash)
}

/**
 * Navigates to a fragment in the current page, as the browser does when the
 * page loads with the address: the element exists, and becomes `:target`.
 *
 * `:target` is set when the browser navigates. An element that arrives
 * afterwards does not become it, so a test of `:target` must mount first and
 * navigate afterwards.
 */
export async function goTo(hash: string): Promise<void> {
  const fragment = hash.replace(/^#/, "")
  if (location.hash.slice(1) === fragment) return
  const changed = new Promise<void>((done) =>
    window.addEventListener("hashchange", () => done(), { once: true }),
  )
  location.hash = fragment
  await changed
}

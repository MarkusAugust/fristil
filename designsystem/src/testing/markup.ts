/**
 * Turns an attribute set from an `lt` builder function into HTML.
 *
 * The tests should write the markup the way a server would, with the
 * builder function, not write the attributes by hand. If they do the latter,
 * the markup in the test can say something other than what the builder
 * function actually outputs, and then we are not testing what the consumer
 * gets.
 */
export function attr(values: Record<string, unknown>): string {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([name, value]) =>
      value === true
        ? name
        : `${name}="${String(value).replace(/"/g, "&quot;")}"`,
    )
    .join(" ")
}

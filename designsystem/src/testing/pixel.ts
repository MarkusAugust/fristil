import { page } from "vitest/browser"

/**
 * The colour of one pixel in an element, as it is actually painted.
 *
 * For what computed style cannot answer: a pseudo-element such as
 * `::-webkit-progress-value`, or what lies on top when two layers are
 * painted over each other. `x` and `y` are fractions of the width and
 * height, from 0 to 1.
 */
export async function pixel(
  element: HTMLElement,
  x: number,
  y = 0.5,
): Promise<[number, number, number]> {
  const bilde = new Image()
  bilde.src = `data:image/png;base64,${await page.screenshot({ element, save: false })}`
  await bilde.decode()
  const lerret = document.createElement("canvas")
  lerret.width = bilde.width
  lerret.height = bilde.height
  const tegning = lerret.getContext("2d")
  if (tegning === null) throw new Error("Could not draw on the canvas")
  tegning.drawImage(bilde, 0, 0)
  const [r, g, b] = tegning.getImageData(
    Math.min(Math.floor(bilde.width * x), bilde.width - 1),
    Math.min(Math.floor(bilde.height * y), bilde.height - 1),
    1,
    1,
  ).data
  return [r, g, b]
}

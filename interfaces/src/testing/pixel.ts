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
  const image = new Image()
  image.src = `data:image/png;base64,${await page.screenshot({ element, save: false })}`
  await image.decode()
  const canvas = document.createElement("canvas")
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext("2d")
  if (context === null) throw new Error("Could not draw on the canvas")
  context.drawImage(image, 0, 0)
  const [r, g, b] = context.getImageData(
    Math.min(Math.floor(image.width * x), image.width - 1),
    Math.min(Math.floor(image.height * y), image.height - 1),
    1,
    1,
  ).data
  return [r, g, b]
}

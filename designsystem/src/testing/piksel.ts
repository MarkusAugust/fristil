import { page } from "vitest/browser"

/**
 * Fargen på én piksel i et element, slik den faktisk er tegnet.
 *
 * For det computed style ikke kan svare på: et pseudoelement som
 * `::-webkit-progress-value`, eller hva som ligger øverst når to lag tegnes
 * oppå hverandre. `x` og `y` er andeler av bredden og høyden, fra 0 til 1.
 */
export async function piksel(
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
  if (tegning === null) throw new Error("Fikk ikke tegne på lerretet")
  tegning.drawImage(bilde, 0, 0)
  const [r, g, b] = tegning.getImageData(
    Math.min(Math.floor(bilde.width * x), bilde.width - 1),
    Math.min(Math.floor(bilde.height * y), bilde.height - 1),
    1,
    1,
  ).data
  return [r, g, b]
}

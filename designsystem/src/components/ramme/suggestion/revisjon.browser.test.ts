import { beforeAll, describe, expect, it } from "vitest"
import { monter, ventPaTegning } from "../../../testing/a11y"
import { defineFsSuggestion } from "./fs-suggestion"

/**
 * Etterligner Reacts inputValueTracking (react-dom: trackValueOnNode +
 * updateValueIfChanged): en egen `value`-egenskap på noden som husker siste
 * verdi satt gjennom den, og `onChange` bare når den faktiske verdien
 * (prototypens getter) avviker fra den husket.
 */
function reactKontrollert(node: HTMLInputElement | HTMLTextAreaElement) {
  const proto = Object.getPrototypeOf(node)
  const desc = Object.getOwnPropertyDescriptor(
    proto,
    "value",
  ) as PropertyDescriptor
  let current = `${node.value}`
  Object.defineProperty(node, "value", {
    configurable: true,
    enumerable: desc.enumerable,
    get() {
      return desc.get?.call(this)
    },
    set(v) {
      current = `${v}`
      desc.set?.call(this, v)
    },
  })
  ;(node as unknown as { _valueTracker: unknown })._valueTracker = {
    getValue: () => current,
    setValue: (v: string) => {
      current = `${v}`
    },
  }
  const onChange: string[] = []
  node.addEventListener("input", () => {
    const actual = desc.get?.call(node) as string
    if (actual !== current) {
      current = actual
      onChange.push(actual)
    }
  })
  return onChange
}

function markup(kontroll: string) {
  return `<fs-suggestion><label for="k">Kommune</label>
    <div class="fs-suggestion__field">${kontroll}
      <ul class="fs-suggestion__list" role="listbox" id="k-liste" hidden>
        <li role="option" id="k-0">Bergen</li><li role="option" id="k-1">Oslo</li>
      </ul></div></fs-suggestion>`
}

async function velgForste(kontroll: HTMLElement) {
  await customElements.whenDefined("fs-suggestion")
  await ventPaTegning()
  kontroll.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
  )
  await ventPaTegning()
  kontroll.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  )
  await ventPaTegning()
}

describe("revisjon 4.6", () => {
  beforeAll(() => defineFsSuggestion())

  it("input: React onChange får valgt verdi", async () => {
    monter(
      markup(
        `<input id="k" role="combobox" aria-controls="k-liste" aria-expanded="false" aria-autocomplete="list">`,
      ),
    )
    const input = document.getElementById("k") as HTMLInputElement
    const onChange = reactKontrollert(input)
    await velgForste(input)
    expect(input.value).toBe("Bergen")
    expect(onChange).toEqual(["Bergen"])
  })

  it("textarea: React onChange får valgt verdi", async () => {
    monter(
      markup(
        `<textarea id="k" role="combobox" aria-controls="k-liste" aria-expanded="false" aria-autocomplete="list"></textarea>`,
      ),
    )
    const ta = document.getElementById("k") as HTMLTextAreaElement
    const onChange = reactKontrollert(ta)
    const feil: unknown[] = []
    window.addEventListener("error", (e) => feil.push(e.message))
    await velgForste(ta)
    expect(feil).toEqual([])
    expect(ta.value).toBe("Bergen")
    expect(onChange).toEqual(["Bergen"])
  })
})

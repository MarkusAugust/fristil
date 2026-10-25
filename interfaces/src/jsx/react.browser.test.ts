import { describe, expect, it } from "vitest"
import { LtDialog } from "../components/frame/dialog/lt-dialog"
import { LtErrorSummary } from "../components/frame/error-summary/lt-error-summary"
import { LtField } from "../components/frame/field/lt-field"
import { LtPopover } from "../components/frame/popover/lt-popover"
import { LtSessionTimeout } from "../components/frame/session-timeout/lt-session-timeout"
import { LtSuggestion } from "../components/frame/suggestion/lt-suggestion"
import { LtTabs } from "../components/frame/tabs/lt-tabs"
import { LtConnectionStatus } from "../components/standalone/connection-status/lt-connection-status"
import { LtToast } from "../components/standalone/toast/lt-toast"
import { lt } from "../lt"
import { toReactAttributes } from "../react"
import source from "./react?raw"

/**
 * The JSX declarations are written by hand, so they can fall out of step
 * with the components they describe. If someone adds a property to
 * `<lt-suggestion>` without adding it here, it is invisible to TypeScript,
 * and typos go straight through again.
 *
 * The test reads `static observedAttributes` from the components and requires
 * every attribute to be in the declaration file.
 */

/**
 * Attributes React already knows through `HTMLAttributes`.
 *
 * `hidden` is not here, even though `<lt-error-summary>` only observes it
 * because the server can remove it to show the box. `HTMLAttributes` types it
 * as `boolean`, and `hidden={false}` compiled, while React 18 writes it as
 * `hidden="false"` on a web component, which is true. The declaration
 * narrows it to `Flag`, and the test below requires that it does.
 */
const STANDARD = new Set(["id", "class", "title", "lang", "dir", "slot"])

/** The attributes the component actually listens to, apart from the standard ones. */
function attributeNames(componentClass: {
  observedAttributes?: unknown
}): string[] {
  return [...((componentClass.observedAttributes ?? []) as string[])].filter(
    (name) => !STANDARD.has(name),
  )
}

describe("the JSX declarations follow the components", () => {
  it.each([
    ["lt-field", LtField],
    ["lt-tabs", LtTabs],
    ["lt-error-summary", LtErrorSummary],
    ["lt-popover", LtPopover],
    ["lt-toast", LtToast],
    ["lt-session-timeout", LtSessionTimeout],
    ["lt-connection-status", LtConnectionStatus],
    ["lt-suggestion", LtSuggestion],
    ["lt-dialog", LtDialog],
  ])("%s has all its attributes declared", (tag, componentClass) => {
    const attributes = attributeNames(componentClass)

    // The tag itself must be in IntrinsicElements
    expect(source).toContain(`"${tag}"`)

    const missing = attributes.filter(
      (name) => !new RegExp(`(^|\\W)"?${name}"?\\??:`, "m").test(source),
    )

    expect(
      missing,
      `These attributes on <${tag}> are missing from src/jsx/react.ts`,
    ).toEqual([])
  })

  it("declares no attributes the components do not have", () => {
    const known = new Set([
      ...attributeNames(LtField),
      ...attributeNames(LtTabs),
      ...attributeNames(LtErrorSummary),
      ...attributeNames(LtPopover),
      ...attributeNames(LtToast),
      ...attributeNames(LtSessionTimeout),
      ...attributeNames(LtConnectionStatus),
      ...attributeNames(LtSuggestion),
      ...attributeNames(LtDialog),
    ])

    // Only the attribute blocks. The tag names in IntrinsicElements are under
    // `declare module`, and are left out.
    const attributeBlocks = source.slice(0, source.indexOf("declare module"))
    const declared = [
      ...attributeBlocks.matchAll(/^\s+"?([a-z-]+)"?\??: /gm),
    ].map((match) => match[1] as string)

    const unknown = declared.filter((name) => !known.has(name))

    expect(
      unknown,
      "These are declared in src/jsx/react.ts, but exist on no component",
    ).toEqual([])
  })
})

describe("the React entry point covers every attribute the builder functions emit", () => {
  /**
   * `autocomplete` slipped through to the React demo and gave "Invalid DOM
   * property `autocomplete`. Did you mean `autoComplete`?" in the console.
   * `tabindex` had slipped through the same way a round earlier.
   *
   * The test collects every attribute name `lt` actually emits, and requires
   * that none of them is one React spells with a capital letter inside
   * without `react.ts` renaming it.
   */
  const CAMEL_CASE: Record<string, string> = {
    class: "className",
    for: "htmlFor",
    tabindex: "tabIndex",
    autocomplete: "autoComplete",
    maxlength: "maxLength",
    minlength: "minLength",
    readonly: "readOnly",
    colspan: "colSpan",
    rowspan: "rowSpan",
    inputmode: "inputMode",
    novalidate: "noValidate",
    spellcheck: "spellCheck",
    datetime: "dateTime",
    crossorigin: "crossOrigin",
  }

  /** Every attribute name a builder function can emit. */
  function allAttributeNames(): string[] {
    const found = new Set<string>()
    const collect = (value: unknown) => {
      if (!value || typeof value !== "object") return
      if (Array.isArray(value)) {
        for (const part of value) collect(part)
        return
      }
      for (const [name, child] of Object.entries(value)) {
        if (child && typeof child === "object") collect(child)
        else found.add(name)
      }
    }

    const withArguments: Record<string, unknown> = {
      popover: { id: "x" },
      tabs: { id: "x", keys: ["a", "b"], label: "Tabs" },
      suggestion: { id: "x", keys: ["a", "b"] },
      field: { id: "x", help: true, error: true },
    }

    for (const [name, value] of Object.entries(lt)) {
      if (typeof value !== "function") continue
      try {
        const builder = value as (options?: unknown) => unknown
        collect(builder(withArguments[name]))
      } catch {
        // Guards and helper functions cannot be called like this. They emit
        // no attributes, so they do not matter here.
      }
    }
    return [...found]
  }

  it("renames every name React spells differently", () => {
    // Checks what the function does, not what the source text says. The name
    // is in the type and in the comment anyway, so a text search would pass
    // even if the renaming were missing.
    const missing = allAttributeNames()
      .filter((name) => name in CAMEL_CASE)
      .filter((name) => {
        const out = toReactAttributes({ [name]: "x" })
        return !(CAMEL_CASE[name] in out)
      })

    expect(
      missing,
      "These must go into the REACT_NAMES table in src/react.ts, or React warns",
    ).toEqual([])
  })

  it("leaves aria- and data- attributes alone", () => {
    // React passes them on unchanged, so renaming them would give invalid
    // HTML. Here every name is run through the function and checked to come
    // out with the same key. The previous version only filtered on names
    // that were in CAMEL_CASE, and since no aria- or data- name is there, it
    // could never fail.
    const names = allAttributeNames().filter(
      (name) => name.startsWith("aria-") || name.startsWith("data-"),
    )

    expect(names.length, "found nothing to check").toBeGreaterThan(5)

    const renamed = names.filter(
      (name) => !(name in toReactAttributes({ [name]: "x" })),
    )

    expect(renamed, "These must stay as they are in React").toEqual([])
  })
})

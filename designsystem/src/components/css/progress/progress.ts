import { attributes, createGuard } from "../shared.js"

export const PROGRESS_CLASS = "lt-progress" as const

export const progressColors = ["success", "warning", "danger"] as const

export type ProgressColor = (typeof progressColors)[number]

export type ProgressOptions = {
  /** How far it has come. Leave it out, and the bar is indeterminate. */
  value?: number
  /** What counts as full. Default: `100`. */
  max?: number
  /** What the number means. The default is the accent colour, meaning "this is in progress". */
  color?: ProgressColor
  /** What is in progress. Becomes `aria-label`, so the bar has a name. */
  label?: string
  /**
   * How far it has come, in words. Becomes `aria-valuetext`, which the
   * screen reader reads instead of the percentage: "Step 3 of 7" says more
   * than "43 percent", and `max` is rarely announced.
   */
  valueText?: string
}

export type ProgressAttributes = {
  class: typeof PROGRESS_CLASS
  value?: string
  max: string
  "data-color"?: ProgressColor
  "aria-label"?: string
  "aria-valuetext"?: string
}

/**
 * The attributes for a progress bar on a `<progress>`.
 *
 * The element has the semantics built in: the browser exposes it as
 * `role="progressbar"` and announces how far it has come. You need neither a
 * role, `aria-valuenow` nor `aria-valuemax`.
 *
 * Leave out `value`, and the bar becomes indeterminate: "something is going
 * on, we do not know for how long". That is the same as `lt.spinner()` says,
 * so choose one of them.
 *
 * ```ts
 * <progress {...progress({ value: 3, max: 7, label: "Step 3 of 7" })} />
 * ```
 *
 * `max` defaults to 100 and is always written out, against the rule that a
 * default gives no attribute. The reason is that the rule is about
 * appearance, where the CSS already has the answer. `max` is semantics, and
 * HTML's own default is `1`: a `<progress value="40">` without `max` shows a
 * full bar, without anything saying so.
 */
export const progress = Object.assign(
  ({
    value,
    max = 100,
    color,
    label,
    valueText,
  }: ProgressOptions = {}): ProgressAttributes =>
    attributes({
      class: PROGRESS_CLASS,
      // The numbers are sent out as strings, like the rest of the return
      // values: that is the HTML form, and it is what `setAttributes` accepts.
      value: value === undefined ? undefined : String(value),
      max: String(max),
      "data-color": color,
      "aria-label": label,
      "aria-valuetext": valueText,
    }),
  {
    colors: progressColors,
    isColor: createGuard(progressColors),
  },
)

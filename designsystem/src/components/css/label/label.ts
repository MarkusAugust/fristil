export const LABEL_CLASS = "fs-label" as const

export const labelRequiredMarkers = ["symbol", "text"] as const

export type LabelRequiredMarker = (typeof labelRequiredMarkers)[number]

export type LabelStyleAttributes = {
  class: typeof LABEL_CLASS
  "data-required"?: LabelRequiredMarker
  "data-optional"?: ""
}

export function isLabelRequiredMarker(
  value: string,
): value is LabelRequiredMarker {
  return (labelRequiredMarkers as readonly string[]).includes(value)
}

/**
 * Returns only the Fristil label style attributes.
 * Other HTML attributes (for, id, aria-*, etc.) are owned by the app.
 */
export function getLabelStyleAttributes(options?: {
  required?: LabelRequiredMarker
  optional?: boolean
}): LabelStyleAttributes {
  const attrs: LabelStyleAttributes = { class: LABEL_CLASS }
  if (options?.required) {
    attrs["data-required"] = options.required
  }
  if (options?.optional) {
    attrs["data-optional"] = ""
  }
  return attrs
}

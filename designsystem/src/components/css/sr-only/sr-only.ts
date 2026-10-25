import { attributes } from "../shared.js"

export const SR_ONLY_CLASS = "lt-sr-only" as const

export type SrOnlyAttributes = {
  class: typeof SR_ONLY_CLASS
}

/**
 * The attributes for text that only screen readers should get.
 *
 * ```ts
 * <span {...srOnly()}>Opens in a new tab</span>
 * ```
 *
 * Use it when a label or explanation is needed by someone listening to the
 * page, but would be noise to someone looking at it. If the content should
 * be gone for everyone, use `hidden` instead.
 */
export const srOnly = (): SrOnlyAttributes =>
  attributes({ class: SR_ONLY_CLASS })

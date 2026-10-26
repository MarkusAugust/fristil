/** Typene til den leverte idiomorph-fila, bare det testene bruker. */
export declare const Idiomorph: {
  morph(
    oldNode: Element,
    newContent: string,
    config?: {
      morphStyle?: "outerHTML" | "innerHTML"
      ignoreActiveValue?: boolean
    },
  ): unknown
}

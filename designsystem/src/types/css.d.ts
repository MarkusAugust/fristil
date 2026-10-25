declare module "*.css"

/** A stylesheet imported as text, the way the previews and the tests read them. */
declare module "*.css?inline" {
  const source: string
  export default source
}

/** Any file imported as text. */
declare module "*?raw" {
  const source: string
  export default source
}

declare module "*.css"

/** Stilark hentet som tekst, slik forhåndsvisningene og testene leser dem. */
declare module "*.css?inline" {
  const source: string
  export default source
}

/** Hvilken som helst fil hentet som tekst. */
declare module "*?raw" {
  const source: string
  export default source
}

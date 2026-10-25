/**
 * Fargekontrakten, som `@lo-tek/interfaces/contract`: hva hver rolle er, og
 * hva den lover.
 *
 * Ett fargelag, ikke to. En farge er et punkt i en matrise av **familie** (hva
 * den betyr) og **rolle** (hva den gjør), og hver familie har de samme
 * rollene. Kuløren er konsumentens, lysheten er rollens, og da er kontrasten
 * garantert av konstruksjonen framfor av en sjekk i etterkant.
 *
 * Tallene står i `color-contract.json`, som kjernen leser, og regningen skjer
 * der. Her er dataene, for den som vil lese dem. Et tema bygges med
 * `buildTheme` fra `@lo-tek/interfaces/theme`, og et håndskrevet tema
 * kontrolleres med `inspectTheme` fra `@lo-tek/interfaces/theme-check`.
 */

export {
  type Appearance,
  NEUTRAL_LAYERS,
  REQUIREMENT,
  ROLES,
  type Role,
} from "./matrix-cells.js"

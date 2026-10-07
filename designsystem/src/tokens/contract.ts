/**
 * Fargekontrakten, som `@fristil/designsystem/kontrakt`: hva hver rolle er, og
 * hva den lover.
 *
 * Ett fargelag, ikke to. En farge er et punkt i en matrise av **familie** (hva
 * den betyr) og **rolle** (hva den gjør), og hver familie har de samme
 * rollene. Kuløren er konsumentens, lysheten er rollens, og da er kontrasten
 * garantert av konstruksjonen framfor av en sjekk i etterkant.
 *
 * Tallene står i `fargekontrakt.json`, som kjernen leser, og regningen skjer
 * der. Her er dataene, for den som vil lese dem. Et tema bygges med
 * `buildTheme` fra `@fristil/designsystem/tema`, og et håndskrevet tema
 * kontrolleres med `inspectTheme` fra `@fristil/designsystem/tema-sjekk`.
 */

export {
  type Appearance,
  NEUTRAL_LAYERS,
  REQUIREMENT,
  ROLES,
  type Role,
} from "./matrise.js"

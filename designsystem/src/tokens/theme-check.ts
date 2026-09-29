import {
  type Appearance,
  checkPromises,
  promisesFor,
  ROLES,
  type Role,
} from "./contract.js"
import { buildMatrix, FRISTIL_BRANDS, roleToCss, tokenName } from "./matrix.js"

/**
 * Kontrollerer et tema en konsument har skrevet selv.
 *
 * Generatoren holder løftene av konstruksjon. Skriver noen inn sine egne
 * verdier, er løftene deres å holde, og da skylder vi dem et svar på hvilken
 * celle som ryker og hvorfor. Uten dette er «du kan overstyre hva som helst»
 * en felle.
 *
 * Fila leses som tekst og ikke som CSS. Det holder, fordi det eneste som betyr
 * noe er hvilke `--fs-color-*` som står i hvilken blokk, og en verdi som ikke
 * er en heksfarge kan vi uansett ikke regne på. En verdi vi ikke forstår
 * meldes som nettopp det, framfor å bli hoppet over i stillhet.
 */

export type ParsedBlock = {
  /** Selektoren blokka sto under, brukt i meldingene. */
  selector: string
  /** Utseendet blokka gjelder, lest av `color-scheme` eller selektoren. */
  appearance: Appearance
  /** Tokennavn til verdi, slik de sto skrevet. */
  declarations: Record<string, string>
}

/*
 * Bare det `parseHex` faktisk kan lese.
 *
 * Porten godtok en gang `#rrggbbaa` også, og da kastet `parseHex` lenger inne
 * og hele kommandoen døde med stakkspor. En verdi vi ikke kan regne på skal
 * meldes, ikke slippes videre.
 */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/**
 * Deler CSS-teksten i blokker, med klammedybde.
 *
 * `@media`-regler nøster, så en teller er nødvendig: uten den ville
 * deklarasjonene i en mørk blokk inne i en `@media` blitt lest som om de sto i
 * `:root`, og temaet ville blitt kontrollert mot feil utseende.
 */
export function parseBlocks(css: string): ParsedBlock[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const blocks: ParsedBlock[] = []
  /*
   * Hver ramme holder sin egen tekst, ikke bare selektoren.
   *
   * Første utgave nullstilte bufferet ved `{`, så alt som sto før en nøstet
   * regel ble lest som en del av selektoren. `:root { --fs-color-danger-text:
   * #ff9999; &:hover { … } }` ga da null problemer: overstyringen forsvant, og
   * kommandoen skrev «Temaet holder hvert løfte». Nesting og en `@media` inni
   * `:root` er begge vanlige måter å skrive dette på.
   */
  const stack: { selector: string; text: string }[] = []
  let buffer = ""

  for (const char of withoutComments) {
    if (char === "{") {
      const split = buffer.lastIndexOf(";")
      if (stack.length > 0)
        stack[stack.length - 1].text += buffer.slice(0, split + 1)
      stack.push({ selector: buffer.slice(split + 1).trim(), text: "" })
      buffer = ""
      continue
    }
    if (char === "}") {
      const frame = stack.pop()
      if (!frame) continue
      frame.text += buffer
      const declarations = readDeclarations(frame.text)
      if (Object.keys(declarations).length > 0) {
        const path = [...stack.map((f) => f.selector), frame.selector]
        blocks.push({
          selector: path.filter(Boolean).join(" "),
          appearance: readAppearance(path.join(" "), frame.text),
          declarations,
        })
      }
      buffer = ""
      continue
    }
    buffer += char
  }
  return blocks
}

function readDeclarations(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of text.split(";")) {
    const separator = part.indexOf(":")
    if (separator < 0) continue
    const name = part.slice(0, separator).trim()
    if (!name.startsWith("--fs-color-")) continue
    // `!important` er lovlig og plausibelt i et håndskrevet tema, og sier
    // ingenting om fargen.
    out[name] = part
      .slice(separator + 1)
      .replace(/\s*!important\s*$/i, "")
      .trim()
  }
  return out
}

/**
 * Mørkt eller lyst, lest av `color-scheme` først og av selektoren ellers.
 *
 * `color-scheme` er det temaet selv sier, og det er det riktigste svaret.
 * Uten den er `prefers-color-scheme: dark` og en selektor som nevner `dark`
 * de to formene i bruk, og begge er utvetydige nok til å leses.
 */
function readAppearance(selector: string, body: string): Appearance {
  /*
   * Siste deklarasjon vinner, som i kaskaden.
   *
   * `match` ga den første, og da leste vi `light` av
   * `color-scheme: light; color-scheme: dark`, altså det motsatte av hva
   * nettleseren gjør.
   */
  const found = [...body.matchAll(/(?:^|[\s;{])color-scheme\s*:([^;}]*)/gi)]
  const declared = found[found.length - 1]
  if (declared) {
    /*
     * Verdien leses, den mønstermatches ikke.
     *
     * Tre ganger ble den samme linja lappet for den samme feilklassen: først
     * manglet avslutningen `$`, så `only dark`, så `dark only`. Grammatikken
     * er `normal | [ light | dark | <custom-ident> ]+ && only?`, og `&&`
     * betyr at `only` kan stå på begge sider. Et regulært uttrykk som skal
     * dekke hver rekkefølge blir en ny lapp hver gang noen skriver den
     * lovlige formen vi ikke tenkte på.
     *
     * Spørsmålet som betyr noe er hvilke av de to nøkkelordene som står der.
     * Står begge, sier blokka at den virker i begge, ikke at den er ett av
     * dem, og da er selektoren det beste svaret. Står ingen, likeså.
     */
    const words = declared[1]
      .toLowerCase()
      .replace(/!important/g, "")
      .split(/\s+/)
      .filter(Boolean)
    const light = words.includes("light")
    const dark = words.includes("dark")
    if (light !== dark) return dark ? "dark" : "light"
  }

  // `dark` må stå som eget ord: `.darkmode-toggle` er ikke et mørkt tema.
  return /(?<![a-z])dark(?![a-z])/i.test(selector) ? "dark" : "light"
}

/** Rollenavnene slik de skrives i CSS, lengste først. */
const ROLE_NAMES = (Object.keys(ROLES) as Role[])
  .map(roleToCss)
  .sort((a, b) => b.length - a.length)

/** De to lagene bare den nøytrale familien har. De er ikke roller. */
const LAYER_NAMES = ["canvas", "raised"]

/**
 * Deler `--fs-color-min-merkevare-text` i familie og rolle.
 *
 * Rollen leses som **endelsen**, ikke familien som begynnelsen. Med det
 * motsatte falt et familienavn med bindestrek utenfor uten et ord: sju
 * gyldige roller på `--fs-color-min-merkevare-*` ga null problemer og
 * «Temaet holder hvert løfte».
 *
 * Lista er sortert med lengste navn først. Det avgjør ingenting i dag, siden
 * ingen rollenavn er endelse av et annet, men det bestemmer rekkefølgen
 * rollene listes i feilmeldingen, og det holder oppslaget riktig hvis en rolle
 * en gang skulle ende på navnet til en annen.
 *
 * `null` som rolle betyr et kjent lag, altså `canvas` eller `raised`. De
 * hører bare til den nøytrale familien, så `--fs-color-danger-canvas` er
 * ukjent og skal meldes.
 */
function splitToken(
  token: string,
): { family: string; role: Role | null } | undefined {
  const rest = token.startsWith("--fs-color-") ? token.slice(11) : undefined
  if (!rest) return undefined

  for (const layer of LAYER_NAMES) {
    if (!rest.endsWith(`-${layer}`)) continue
    const family = rest.slice(0, -layer.length - 1)
    return family === "neutral" ? { family, role: null } : undefined
  }

  for (const name of ROLE_NAMES) {
    if (!rest.endsWith(`-${name}`)) continue
    const family = rest.slice(0, -name.length - 1)
    if (!family) return undefined
    const role = (Object.keys(ROLES) as Role[]).find(
      (r) => roleToCss(r) === name,
    )
    return role ? { family, role } : undefined
  }
  return undefined
}

export type ThemeReport = {
  problems: ThemeProblem[]
  /** Blokker som faktisk ble lest. */
  blocks: number
  /**
   * Verdier konsumenten selv skrev, og som ble forstått.
   *
   * Løftetallet alene duger ikke som mål på arbeid: standardverdiene fyller
   * hullene, så én linje gir like mange løfter som et helt tema. Dette tallet
   * teller det fila faktisk inneholdt.
   */
  declarations: number
  /** Løfter som faktisk ble kontrollert. */
  promises: number
}

export type ThemeProblem = {
  selector: string
  message: string
}

/**
 * Leser et tema og kontrollerer hvert løfte i hver blokk.
 *
 * Verdier som mangler fylles fra Fristils eget tema, slik at en konsument som
 * bare har overstyrt én celle får den kontrollert mot resten av systemet sitt
 * framfor mot ingenting.
 */
export function inspectTheme(css: string): ThemeReport {
  const problems: ThemeProblem[] = []
  const blocks = parseBlocks(css)

  let checkedPromises = 0
  let understood = 0

  /*
   * En blokk som ikke er lukket forsvinner uten et ord.
   *
   * En avkuttet fil, eller et `{` som har forskjøvet dybden, gjorde at hele
   * den mørke blokka falt ut og fila ble meldt grønn. Klammene telles derfor
   * for seg, framfor å stole på at parsingen sier fra.
   */
  const withoutCss = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const opened = (withoutCss.match(/{/g) ?? []).length
  const closed = (withoutCss.match(/}/g) ?? []).length
  if (opened !== closed)
    problems.push({
      selector: "(hele fila)",
      message: `Fila har ${opened} «{» og ${closed} «}». En blokk som ikke er lukket blir ikke lest, så deler av temaet kan være ukontrollert.`,
    })

  if (blocks.length === 0) {
    /*
     * Klammemeldingen skal med her også.
     *
     * En fil som bare er avkuttet, `:root {` uten `}`, gir null blokker. Bygde
     * vi da en ny liste, forsvant meldingen om at en blokk ikke er lukket, og
     * konsumenten satt igjen med «er dette et Fristil-tema?» alene. Den står
     * fortsatt, og den er riktig nok, men den sier ikke hvorfor fila ikke ble
     * lest.
     */
    problems.push({
      selector: "(hele fila)",
      message:
        "Fant ingen --fs-color-*-verdier. Er dette et Fristil-tema, og " +
        "står verdiene i en blokk?",
    })
    return { blocks: 0, declarations: 0, promises: 0, problems }
  }

  for (const block of blocks) {
    const defaults = buildMatrix(FRISTIL_BRANDS, block.appearance).tokens
    const values: Record<string, string> = { ...defaults }

    for (const [name, value] of Object.entries(block.declarations)) {
      if (!HEX.test(value)) {
        problems.push({
          selector: block.selector,
          message: `${name} er «${value}». Kontrasten kan bare regnes på en heksfarge, så denne er ikke kontrollert.`,
        })
        continue
      }
      values[name] = value
      if (splitToken(name)) understood++
    }

    const families: Record<string, Record<Role, string>> = {}
    for (const name of Object.keys(values)) {
      const split = splitToken(name)
      if (!split) {
        // Bare navn konsumenten selv skrev meldes. Standardverdiene er våre
        // egne, og de deles alltid.
        if (name in block.declarations)
          problems.push({
            selector: block.selector,
            message: `${name} er ikke et token i systemet. Navnet er --fs-color-<familie>-<rolle>, og rollene er ${ROLE_NAMES.join(", ")}.`,
          })
        continue
      }
      if (split.role === null) continue
      families[split.family] ??= {} as Record<Role, string>
      families[split.family][split.role] = values[name]
    }

    /*
     * En familie konsumenten har funnet på selv fylles ikke av standarden, og
     * kan derfor ha hull. Den meldes som ufullstendig framfor å bli kontrollert
     * med tomme celler: uten dette kastet sjekken på `undefined`, og
     * konsumenten fikk en stakksporing i stedet for et svar.
     */
    const allRoles = Object.keys(ROLES) as Role[]
    for (const [name, family] of Object.entries(families)) {
      const missing = allRoles.filter((r) => !family[r])
      if (missing.length === 0) continue
      delete families[name]
      problems.push({
        selector: block.selector,
        message: `${name} mangler ${missing.map(roleToCss).join(", ")}. En familie må ha alle rollene for at løftene skal kunne kontrolleres.`,
      })
    }

    const layers = {
      canvas: values[tokenName("neutral", "canvas")],
      surface: values[tokenName("neutral", "surface")],
      raised: values[tokenName("neutral", "raised")],
    }

    for (const family of Object.values(families))
      checkedPromises += promisesFor(family, layers).length

    for (const violation of checkPromises(families, layers)) {
      problems.push({
        selector: block.selector,
        message: `${violation.family}: ${violation.promise} er ${violation.ratio.toFixed(2)}:1, kravet er ${violation.required}:1.`,
      })
    }
  }
  return {
    problems,
    blocks: blocks.length,
    declarations: understood,
    promises: checkedPromises,
  }
}

/** Bare problemene, for den som ikke trenger tellingen. */
export function checkTheme(css: string): ThemeProblem[] {
  return inspectTheme(css).problems
}

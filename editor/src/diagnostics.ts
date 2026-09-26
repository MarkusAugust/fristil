/**
 * Sier fra om markup som ikke stemmer med Fristil.
 *
 * Fullføringen og forklaringen kommer fra VS Codes egen HTML-tjeneste, og
 * den validerer ingenting: et element som ikke finnes er lovlig HTML, og et
 * attributt komponenten aldri leser står der like stille. Dette er den
 * andre halvdelen. Det leser hver `<fs-…>`-tagg i dokumentet og sjekker den
 * mot `elements.json`, som genereres fra den samme `metadata.ts` som
 * fullføringen, så de to kan ikke sprike.
 *
 * Fila har ingen avhengighet til VS Code. Da kan `scripts/sjekk-diagnostikk.ts`
 * kjøre den med bun over kjente feil og se at hver av dem felles.
 *
 * Det som sjekkes, i rekkefølgen det meldes:
 *
 *   1. Elementet finnes. `<fs-dialog-header>` finnes ikke, og nettleseren
 *      sier ingenting om det.
 *   2. Attributtet finnes på elementet. Globale HTML-attributter, `data-*`,
 *      `aria-*`, hendelser og rammeverkenes egne (`hx-`, `x-`, `v-`, og alt
 *      med `:`, `@`, klammer eller parenteser i navnet) slipper gjennom.
 *   3. Verdien er lovlig: i den lukkede lista der det finnes en, et tall der
 *      det skal være et tall, og ikke `="false"` på et boolsk attributt, som
 *      betyr på.
 *   4. `<fs-field>` har en kontroll og en ledetekst, med de samme
 *      unntakene og den samme teksten som komponenten selv bruker i
 *      nettleseren.
 *
 * Markup som blir til på en server er ofte en mal, og en mal er ikke hel:
 * `{{ if .Feil }}invalid{{ end }}` i en tagg, `{{ template "input" . }}`
 * der kontrollen skulle stått. Der det står malsyntaks, Go, Jinja, PHP, ASP
 * eller Razor, holder diagnostikken seg unna: attributtnavn sjekkes ikke i
 * en tagg med mal i, en verdi med mal i sjekkes ikke, og et felt med mal i
 * regnes som ufylt. Elementnavnet sjekkes alltid: det står aldri i en mal.
 *
 * Posisjonene er tegnindekser i den opprinnelige teksten. Kommentarer,
 * skript og stilark blankes ut med like mange tegn før lesingen, så en
 * `<fs-…>` i en kommentar ikke meldes og ingen posisjon forskyves.
 */

export type Severity = "error" | "warning"

export type Finding = {
  start: number
  end: number
  message: string
  severity: Severity
  /** Komponentsiden, som lenke i meldingen. */
  link: string
}

export type Attribute =
  | { type: "flag" | "text" | "number" }
  | { type: "values"; values: readonly string[] }

export type Element = {
  link: string
  attributes: Record<string, Attribute>
}

/** Innholdet i `elements.json`: tagg til element. */
export type Elements = Record<string, Element>

const DOCS = "https://fristil.netlify.app/components/"

/*
 * Attributter ethvert element kan ha, uten at komponenten leser dem: de
 * globale attributtene i HTML. Prefiksene under er `data-*`, `aria-*`,
 * hendelsene, og HTMX, Alpine og Vue. Svelte, Angular og Alpines korte
 * former har `:`, `@`, klammer eller parenteser i navnet, og det har aldri
 * et Fristil-attributt. Et navn utenfor alt dette som komponenten ikke
 * kjenner, er nesten alltid en skrivefeil.
 */
const GLOBAL = new Set([
  "accesskey",
  "autocapitalize",
  "autofocus",
  "class",
  "contenteditable",
  "dir",
  "draggable",
  "enterkeyhint",
  "exportparts",
  "hidden",
  "id",
  "inert",
  "inputmode",
  "is",
  "itemid",
  "itemprop",
  "itemref",
  "itemscope",
  "itemtype",
  "lang",
  "nonce",
  "part",
  "popover",
  "role",
  "slot",
  "spellcheck",
  "style",
  "tabindex",
  "title",
  "translate",
  "xmlns",
])

const isGlobal = (name: string) =>
  GLOBAL.has(name) ||
  /^(data-|aria-|on|hx-|x-|v-)/.test(name) ||
  /[:@[\](){}%$#?<>]/.test(name)

/*
 * Go, Jinja, PHP, ASP, JS-maler og Razor. Razors `@Navn` regnes bare i en
 * verdi og i innhold, ikke i en tagg: der er `@click` Alpine, et attributt
 * som skal slippe gjennom uten å gjøre resten av taggen til en mal.
 */
const TEMPLATE = /\{\{|\{%|<\?|<%|\$\{|@\(/
const isTemplated = (text: string) => TEMPLATE.test(text)
const isTemplatedValue = (text: string) =>
  isTemplated(text) || /^\s*@[A-Za-z]/.test(text)
const isTemplatedContent = (text: string) =>
  isTemplated(text) || /(^|[\s>])@[A-Za-z]/.test(text)

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Bytter hvert treff med like mange mellomrom, så posisjonene står. */
const blankOut = (text: string, pattern: RegExp) =>
  text.replace(pattern, (hit) => hit.replace(/[^\n]/g, " "))

/** Teksten uten kommentarer, skript og stilark, med samme lengde. */
export function withoutHidden(text: string): string {
  let out = blankOut(text, /<!--[\s\S]*?(?:-->|$)/g)
  out = blankOut(out, /<script\b[\s\S]*?(?:<\/script\s*>|$)/gi)
  out = blankOut(out, /<style\b[\s\S]*?(?:<\/style\s*>|$)/gi)
  return out
}

/** Der taggen som begynner på `from` slutter: indeksen til `>`, eller -1. */
function tagEnd(text: string, from: number): number {
  let quote: string | null = null
  for (let i = from; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === quote) quote = null
    } else if (char === '"' || char === "'") quote = char
    else if (char === ">") return i
  }
  return -1
}

type ReadAttribute = {
  name: string
  value: string | undefined
  start: number
  end: number
}

/** Attributtene i en tagg, lest fra teksten mellom navnet og `>`. */
function readAttributes(body: string, offset: number): ReadAttribute[] {
  const out: ReadAttribute[] = []
  const pattern =
    /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  for (const hit of body.matchAll(pattern)) {
    out.push({
      name: hit[1].toLowerCase(),
      value: hit[2] ?? hit[3] ?? hit[4],
      start: offset + (hit.index ?? 0),
      end: offset + (hit.index ?? 0) + hit[1].length,
    })
  }
  return out
}

const list = (names: readonly string[]) => names.join(", ")

const NUMBER = /^-?\d+(\.\d+)?$/

function checkAttribute(
  tag: string,
  element: Element,
  attribute: ReadAttribute,
  templatedTag: boolean,
): Finding | undefined {
  const { name, value } = attribute
  const base = {
    start: attribute.start,
    end: attribute.end,
    link: element.link,
  }
  const known = element.attributes[name]
  if (!known) {
    // I en tagg med mal i er navnene ikke til å stole på: `{{ if }}` blir
    // til «if» og «end», og ingen av dem er en skrivefeil.
    if (templatedTag || isGlobal(name)) return undefined
    return {
      ...base,
      severity: "warning",
      message:
        `<${tag}> har ikke attributtet «${name}», og komponenten leser ` +
        `det ikke. Attributtene er ${list(Object.keys(element.attributes))}.`,
    }
  }
  if (value !== undefined && isTemplatedValue(value)) return undefined
  if (known.type === "flag") {
    // `hidden="until-found"` er HTML, ikke en feil.
    if (name === "hidden" && value === "until-found") return undefined
    if (value !== undefined && value !== "" && value.toLowerCase() !== name)
      return {
        ...base,
        severity: "warning",
        message:
          `${name} er et boolsk attributt: det står der eller ikke. ` +
          `${name}="${value}" betyr det samme som ${name}. Ta det bort ` +
          "for å slå det av.",
      }
    return undefined
  }
  if (known.type === "values") {
    if (value === undefined || !known.values.includes(value))
      return {
        ...base,
        severity: "error",
        message:
          `${name} kan ikke være «${value ?? ""}». Lovlige verdier: ` +
          `${list(known.values)}.`,
      }
    return undefined
  }
  if (known.type === "number" && value !== undefined && !NUMBER.test(value))
    return {
      ...base,
      severity: "error",
      message: `${name} skal være et tall, ikke «${value}».`,
    }
  return undefined
}

/*
 * Det `<fs-field>` selv sier fra om i nettleseren, med den samme teksten.
 * Komponenten godtar tre måter å gi feltet et navn: en `<label>` inni, en
 * `<label for>` utenfor som peker på kontrollen, eller `aria-label` og
 * `aria-labelledby` på kontrollen. Et tomt element er et område serveren
 * ikke har fylt ennå, og meldes ikke. Det samme gjelder et element med mal
 * i: kontrollen kan stå i en partial.
 */
const CONTROL = /<(input|textarea|select)\b/gi

/** Den første kontrollen i innholdet, slik komponenten teller dem: ikke `type="hidden"`. */
function findControl(content: string): ReadAttribute[] | undefined {
  for (const hit of content.matchAll(CONTROL)) {
    const from = (hit.index ?? 0) + hit[0].length
    const attributes = readAttributes(
      content.slice(from, tagEnd(content, from)),
      0,
    )
    const type = attributes.find((a) => a.name === "type")?.value
    if (hit[1].toLowerCase() === "input" && type?.toLowerCase() === "hidden")
      continue
    return attributes
  }
  return undefined
}

function checkField(
  text: string,
  tag: string,
  nameStart: number,
  nameEnd: number,
  content: string,
  attributes: ReadAttribute[],
  link: string,
): Finding[] {
  if (!/<[a-z]/i.test(content) || isTemplatedContent(content)) return []
  const base = { start: nameStart, end: nameEnd, link }
  const control = findControl(content)
  if (!control)
    return [
      {
        ...base,
        severity: "warning",
        message:
          `<${tag}> fant ingen kontroll å koble til. Ledeteksten, ` +
          "hjelpeteksten og feilmeldingen står uten et felt, og koblingen " +
          "kan ikke lages. Sett inn et <input>, <textarea> eller <select>.",
      },
    ]
  if (/<label\b/i.test(content)) return []

  const has = (name: string) => control.find((a) => a.name === name)
  if (has("aria-label") || has("aria-labelledby")) return []

  const id =
    attributes.find((a) => a.name === "control-id")?.value ?? has("id")?.value
  if (id) {
    const quoted = escapeRegExp(id)
    const outside = new RegExp(
      `<label\\b[^>]*\\sfor\\s*=\\s*(?:"${quoted}"|'${quoted}'|${quoted}(?=[\\s>]))`,
      "i",
    )
    if (outside.test(text)) return []
  }
  return [
    {
      ...base,
      severity: "warning",
      message:
        `<${tag}> fant ingen <label>. Feltet får da ingen ledetekst, og en ` +
        "skjermleser leser det opp uten navn.",
    },
  ]
}

/** Alle funn i teksten, i den rekkefølgen de står. */
export function diagnose(text: string, elements: Elements): Finding[] {
  const source = withoutHidden(text)
  const findings: Finding[] = []
  const known = Object.keys(elements)

  for (const hit of source.matchAll(/<(fs-[a-z0-9-]*)(?=[\s/>])/gi)) {
    const tag = hit[1].toLowerCase()
    const nameStart = (hit.index ?? 0) + 1
    const nameEnd = nameStart + tag.length
    const element = elements[tag]
    if (!element) {
      findings.push({
        start: nameStart,
        end: nameEnd,
        severity: "error",
        link: DOCS,
        message: `<${tag}> finnes ikke i Fristil. Elementene er ${list(known)}.`,
      })
      continue
    }

    const end = tagEnd(source, nameEnd)
    if (end < 0) continue
    const body = source.slice(nameEnd, end).replace(/\/$/, "")
    const templatedTag = isTemplated(body)
    const attributes = readAttributes(body, nameEnd)
    for (const attribute of attributes) {
      const finding = checkAttribute(tag, element, attribute, templatedTag)
      if (finding) findings.push(finding)
    }

    if (tag === "fs-field") {
      const close = source.indexOf(`</${tag}`, end)
      const content = source.slice(end + 1, close < 0 ? source.length : close)
      findings.push(
        ...checkField(
          source,
          tag,
          nameStart,
          nameEnd,
          content,
          attributes,
          element.link,
        ),
      )
    }
  }
  return findings
}

/**
 * Koblingen på en hel side: at hver id det pekes på finnes, og at hvert felt
 * og hver tekst er koblet.
 *
 * `diagnoseMarkup` sjekker ordforrådet: elementer, klasser og verdier. Den
 * sjekker ikke om `for` og `aria-describedby` peker på noe, og kan ikke: i en
 * mal som er delt i biter kan id-en stå i en annen fil. På en side slik
 * serveren sender den, er alt med, og da kan det kreves. Det er koblingen en
 * skjermleser lever av, og den en kodeagent oftest bommer på.
 *
 * Markup inni `<fs-field>` meldes ikke for manglende kobling: web-komponenten
 * setter den i nettleseren, og bar markup der er riktig. `<fs-suggestion>`
 * setter `for` på ledeteksten sin på samme måte, så et felt inni den meldes
 * heller ikke uten ledetekst. En id som er skrevet og peker feil, meldes
 * uansett hvor den står.
 */

import {
  type Finding,
  type ReadAttribute,
  readAttributes,
  tagEnd,
  withoutHidden,
} from "./diagnostics.js"

const LINK = "https://fristil.sobernetics.no/components/field/"
const SUMMARY_LINK = "https://fristil.sobernetics.no/components/error-summary/"

const HOW =
  "Lag koblingen med fs.field({ id }) der koden kan kalle en JavaScript-funksjon, " +
  "eller legg feltet i <fs-field>, som setter den i nettleseren."

/** Attributtene som peker på id-er, og hva skjermleseren mister når de bommer. */
const REFERENCES: Record<string, string> = {
  for: "ledeteksten",
  "aria-describedby": "beskrivelsen",
  "aria-labelledby": "navnet",
  "aria-controls": "koblingen til det elementet styrer",
}

/** Kontroller som ikke trenger en ledetekst. */
const UNLABELLED_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
])

/** Elementene en `<label for>` kan peke på, etter HTML-standarden. */
const LABELABLE = new Set([
  "button",
  "input",
  "meter",
  "output",
  "progress",
  "select",
  "textarea",
])

/** Elementer uten lukketagg. */
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
])

type Node = {
  name: string
  nameStart: number
  nameEnd: number
  attributes: ReadAttribute[]
  parent?: Node
}

const value = (node: Node, name: string) =>
  node.attributes.find((a) => a.name === name)

const hasClass = (node: Node, test: (token: string) => boolean) =>
  (value(node, "class")?.value ?? "").split(/\s+/).some(test)

/** Noden selv eller en forfar som oppfyller vilkåret. */
function within(node: Node, test: (n: Node) => boolean): boolean {
  for (let n: Node | undefined = node; n; n = n.parent) if (test(n)) return true
  return false
}

/** Om nettleseren skjuler noden, selv eller gjennom en forfar. */
const isHidden = (node: Node) =>
  within(
    node,
    (n) =>
      value(n, "hidden") !== undefined ||
      (n.name === "dialog" && value(n, "open") === undefined) ||
      (n.name === "details" &&
        n !== node &&
        value(n, "open") === undefined &&
        node.name !== "summary"),
  )

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

/** En attributtverdi slik nettleseren leser den, med entitetene dekodet. */
function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (hit, code) => {
    const lower = code.toLowerCase()
    if (lower.startsWith("#x"))
      return String.fromCodePoint(Number.parseInt(lower.slice(2), 16))
    if (lower.startsWith("#"))
      return String.fromCodePoint(Number.parseInt(lower.slice(1), 10))
    return ENTITIES[lower] ?? hit
  })
}

/** Bytter hvert tegn med mellomrom, unntatt linjeskift, så posisjonene står. */
const blank = (hit: string) => hit.replace(/[^\n]/g, " ")

const TAG = /<(\/?)([a-z][a-z0-9-]*)(?=[\s/>])/gi

/**
 * Hver tagg på siden, i rekkefølge. Lesingen hopper til der taggen slutter, så
 * en `<` inne i en attributtverdi ikke leses som en ny tagg. Det er et ekstra
 * vern: `pageSource` har alt blanket ut slike verdier, og ingen test feller
 * om hoppet fjernes.
 */
function* scan(
  source: string,
): Generator<{ closing: boolean; name: string; start: number; end: number }> {
  const pattern = new RegExp(TAG)
  for (let hit = pattern.exec(source); hit; hit = pattern.exec(source)) {
    const start = hit.index
    const end = tagEnd(source, start + hit[0].length)
    if (end < 0) return
    yield { closing: hit[1] === "/", name: hit[2].toLowerCase(), start, end }
    pattern.lastIndex = end + 1
  }
}

/**
 * Siden slik den leses som en hel side, med samme lengde: uten kommentarer,
 * skript og stilark, uten innholdet i `<template>` og `<textarea>`, og uten
 * markup som står i en attributtverdi. Alt dette er tekst for nettleseren,
 * ikke elementer på siden.
 *
 * Innholdet i en `<template>` er ikke i dokumentet. Er den en shadow root
 * (`shadowrootmode`), har den sine egne id-er, og en id der kan verken
 * kollidere med eller pekes på fra siden utenfor. Den sjekkes derfor ikke.
 *
 * En kopieringsknapp har gjerne hele kodeeksempelet i et attributt, med `<`
 * uescapet, som HTML tillater. Uten dette ble eksempelet lest som ekte
 * markup. Verdiene blankes tagg for tagg: et regulært uttrykk over hele siden
 * løp over taggrenser fra en verdi som sluttet på `=`, som base64 i en `src`.
 */
export function pageSource(text: string): string {
  let out = withoutHidden(text)
  out = out.replace(/<template\b[\s\S]*?<\/template\s*>/gi, blank)
  out = out.replace(
    /(<textarea\b[^>]*>)([\s\S]*?)(<\/textarea\s*>)/gi,
    (_, open, content, close) => `${open}${blank(content)}${close}`,
  )
  const ranges: Array<[number, number]> = []
  for (const tag of scan(out)) {
    if (tag.closing) continue
    const nameEnd = tag.start + 1 + tag.name.length
    for (const attribute of readAttributes(
      out.slice(nameEnd, tag.end),
      nameEnd,
    ))
      if (attribute.value?.includes("<"))
        ranges.push([
          attribute.valueStart,
          attribute.valueStart + attribute.value.length,
        ])
  }
  let result = ""
  let from = 0
  for (const [start, end] of ranges) {
    result += out.slice(from, start) + blank(out.slice(start, end))
    from = end
  }
  return result + out.slice(from)
}

/** Elementene på siden som et tre, i den rekkefølgen de står. */
function tree(source: string): Node[] {
  const nodes: Node[] = []
  const stack: Node[] = []
  for (const tag of scan(source)) {
    if (tag.closing) {
      // Lukker det nærmeste åpne elementet med samme navn, og alt som står
      // åpent inni det, slik nettleseren gjør med en tagg som mangler.
      let at = stack.length - 1
      while (at >= 0 && stack[at].name !== tag.name) at--
      if (at >= 0) stack.length = at
      continue
    }
    const nameStart = tag.start + 1
    const nameEnd = nameStart + tag.name.length
    const body = source.slice(nameEnd, tag.end)
    const node: Node = {
      name: tag.name,
      nameStart,
      nameEnd,
      attributes: readAttributes(body.replace(/\/$/, ""), nameEnd),
      parent: stack[stack.length - 1],
    }
    nodes.push(node)
    if (!VOID.has(tag.name) && !body.endsWith("/")) stack.push(node)
  }
  return nodes
}

/** Alle funn om koblingen på siden, i den rekkefølgen de står. */
export function checkReferences(text: string): Finding[] {
  const nodes = tree(pageSource(text))

  const findings: Finding[] = []
  const ids = new Map<string, Node>()
  const labelFor = new Set<string>()
  const describedBy = new Set<string>()

  for (const node of nodes) {
    const id = value(node, "id")
    if (id?.value) {
      const decoded = decode(id.value)
      if (ids.has(decoded)) {
        findings.push({
          start: id.valueStart,
          end: id.valueStart + id.value.length,
          severity: "error",
          link: LINK,
          message:
            `id="${id.value}" står mer enn én gang på siden. for og ` +
            "aria-describedby peker da på det første elementet, og koblingen " +
            "til dette er brutt. Hver id må være unik.",
        })
      } else ids.set(decoded, node)
    }
    if (node.name === "label") {
      const target = value(node, "for")?.value
      if (target) labelFor.add(decode(target))
    }
    for (const part of decode(
      value(node, "aria-describedby")?.value ?? "",
    ).split(/\s+/))
      if (part) describedBy.add(part)
  }

  for (const node of nodes) {
    // Hver id det pekes på, må finnes.
    for (const [name, loses] of Object.entries(REFERENCES)) {
      const attribute = value(node, name)
      if (!attribute?.value) continue
      for (const target of attribute.value.split(/\s+/)) {
        if (!target) continue
        const at = attribute.valueStart + attribute.value.indexOf(target)
        const found = ids.get(decode(target))
        if (!found) {
          findings.push({
            start: at,
            end: at + target.length,
            severity: "error",
            link: LINK,
            message:
              `${name}="${attribute.value}" peker på id-en «${target}», som ` +
              `ikke finnes på siden. Skjermleseren mister ${loses}. ` +
              (name === "aria-controls" ? "" : HOW),
          })
        } else if (
          name === "for" &&
          node.name === "label" &&
          !LABELABLE.has(found.name) &&
          !found.name.includes("-")
        ) {
          // En web component kan være knyttet til skjema og ha en
          // ledetekst; det kan ikke sjekkes her, så det får passere.
          findings.push({
            start: at,
            end: at + target.length,
            severity: "error",
            link: LINK,
            message:
              `for="${attribute.value}" peker på et <${found.name}>, som ikke ` +
              "kan ha en ledetekst. for må peke på feltet selv: <input>, " +
              `<select>, <textarea> eller en knapp. ${HOW}`,
          })
        }
      }
    }

    // Lenkene i feiloppsummeringen skal gå til et felt som finnes.
    if (
      node.name === "a" &&
      within(
        node,
        (n) =>
          n.name === "fs-error-summary" ||
          hasClass(n, (c) => c === "fs-error-summary"),
      )
    ) {
      const href = value(node, "href")
      const target = href?.value?.startsWith("#") ? href.value.slice(1) : ""
      if (href && target && !ids.has(decode(target))) {
        findings.push({
          start: href.valueStart + 1,
          end: href.valueStart + target.length + 1,
          severity: "error",
          link: SUMMARY_LINK,
          message:
            `Lenken i feiloppsummeringen går til «#${target}», som ikke finnes ` +
            "på siden. Den skal gå til feltet som feilet, slik at brukeren " +
            "havner der feilen kan rettes.",
        })
      }
    }

    if (within(node, (n) => n.name === "fs-field")) continue

    // Et Fristil-felt uten ledetekst.
    if (
      (node.name === "input" ||
        node.name === "textarea" ||
        node.name === "select") &&
      hasClass(node, (c) => c.startsWith("fs-")) &&
      !UNLABELLED_TYPES.has((value(node, "type")?.value ?? "").toLowerCase())
    ) {
      const id = value(node, "id")?.value
      const named =
        within(node, (n) => n.name === "fs-suggestion" || n.name === "label") ||
        (id && labelFor.has(decode(id))) ||
        value(node, "aria-label") ||
        value(node, "aria-labelledby")
      if (!named) {
        findings.push({
          start: node.nameStart,
          end: node.nameEnd,
          severity: "warning",
          link: LINK,
          message:
            `<${node.name}> har ingen ledetekst: ingen <label for> som peker på ` +
            "det, ingen <label> rundt, og verken aria-label eller " +
            `aria-labelledby. En skjermleser leser feltet opp uten navn. ${HOW}`,
        })
      }
    }

    // En synlig hjelpetekst eller feilmelding som ikke er koblet til noe felt.
    const kind = hasClass(node, (c) => c === "fs-error-text")
      ? "Feilmeldingen"
      : hasClass(node, (c) => c === "fs-help-text")
        ? "Hjelpeteksten"
        : undefined
    if (kind && !isHidden(node)) {
      const id = value(node, "id")?.value
      if (!id || !describedBy.has(decode(id))) {
        findings.push({
          start: node.nameStart,
          end: node.nameEnd,
          severity: "warning",
          link: LINK,
          message:
            `${kind} er ikke koblet til noe felt: ` +
            (id
              ? `id-en «${id}» står ikke i aria-describedby på noe felt. `
              : "den har ingen id, så ingen aria-describedby kan peke på den. ") +
            `En skjermleser leser den ikke opp sammen med feltet. ${HOW}`,
        })
      }
    }
  }

  return findings.sort((a, b) => a.start - b.start)
}

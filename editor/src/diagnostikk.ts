/**
 * Sier fra om markup som ikke stemmer med Fristil.
 *
 * Fullføringen og forklaringen kommer fra VS Codes egen HTML-tjeneste, og
 * den validerer ingenting: et element som ikke finnes er lovlig HTML, og et
 * attributt komponenten aldri leser står der like stille. Dette er den
 * andre halvdelen. Det leser hver `<fs-…>`-tagg i dokumentet og sjekker den
 * mot `elementer.json`, som genereres fra den samme `metadata.ts` som
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
 *      `aria-*` og hendelser slipper gjennom, resten meldes.
 *   3. Verdien er lovlig: i den lukkede lista der det finnes en, et tall der
 *      det skal være et tall, og ikke `="false"` på et boolsk attributt, som
 *      betyr på.
 *   4. `<fs-field>` har en kontroll og en ledetekst, med de samme
 *      unntakene og den samme teksten som komponenten selv bruker i
 *      nettleseren.
 *
 * Posisjonene er tegnindekser i den opprinnelige teksten. Kommentarer,
 * skript og stilark blankes ut med like mange tegn før lesingen, så en
 * `<fs-…>` i en kommentar ikke meldes og ingen posisjon forskyves.
 */

export type Alvor = "feil" | "advarsel"

export type Funn = {
  start: number
  slutt: number
  melding: string
  alvor: Alvor
  /** Komponentsiden, som lenke i meldingen. */
  lenke: string
}

export type Attributt =
  | { type: "flag" | "text" | "number" }
  | { type: "values"; verdier: readonly string[] }

export type Element = {
  lenke: string
  attributter: Record<string, Attributt>
}

/** Innholdet i `elementer.json`: tagg til element. */
export type Elementer = Record<string, Element>

const DOKUMENTASJON = "https://fristil.netlify.app/components/"

/*
 * Attributter ethvert element kan ha, uten at komponenten leser dem. Lista
 * er de globale attributtene i HTML, og de tre prefiksene er `data-*`,
 * `aria-*` og hendelsene. Et attributt utenfor dette som komponenten ikke
 * kjenner, er nesten alltid en skrivefeil.
 */
const GLOBALE = new Set([
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

const globalt = (navn: string) =>
  GLOBALE.has(navn) ||
  navn.startsWith("data-") ||
  navn.startsWith("aria-") ||
  navn.startsWith("on")

/** Bytter hvert treff med like mange mellomrom, så posisjonene står. */
const blank = (tekst: string, monster: RegExp) =>
  tekst.replace(monster, (treff) => treff.replace(/[^\n]/g, " "))

/** Teksten uten kommentarer, skript og stilark, med samme lengde. */
export function utenSkjult(tekst: string): string {
  let ut = blank(tekst, /<!--[\s\S]*?(?:-->|$)/g)
  ut = blank(ut, /<script\b[\s\S]*?(?:<\/script\s*>|$)/gi)
  ut = blank(ut, /<style\b[\s\S]*?(?:<\/style\s*>|$)/gi)
  return ut
}

/** Der taggen som begynner på `fra` slutter: indeksen til `>`, eller -1. */
function taggSlutt(tekst: string, fra: number): number {
  let anfor: string | null = null
  for (let i = fra; i < tekst.length; i++) {
    const tegn = tekst[i]
    if (anfor) {
      if (tegn === anfor) anfor = null
    } else if (tegn === '"' || tegn === "'") anfor = tegn
    else if (tegn === ">") return i
  }
  return -1
}

type LestAttributt = {
  navn: string
  verdi: string | undefined
  start: number
  slutt: number
}

/** Attributtene i en tagg, lest fra teksten mellom navnet og `>`. */
function lesAttributter(kropp: string, forskyvning: number): LestAttributt[] {
  const ut: LestAttributt[] = []
  const monster =
    /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  for (const treff of kropp.matchAll(monster)) {
    const navn = treff[1].toLowerCase()
    ut.push({
      navn,
      verdi: treff[2] ?? treff[3] ?? treff[4],
      start: forskyvning + (treff.index ?? 0),
      slutt: forskyvning + (treff.index ?? 0) + treff[1].length,
    })
  }
  return ut
}

const liste = (navn: string[]) => navn.join(", ")

const TALL = /^-?\d+(\.\d+)?$/

function sjekkAttributt(
  tagg: string,
  element: Element,
  a: LestAttributt,
): Funn | undefined {
  const felles = { start: a.start, slutt: a.slutt, lenke: element.lenke }
  const kjent = element.attributter[a.navn]
  if (!kjent) {
    if (globalt(a.navn)) return undefined
    return {
      ...felles,
      alvor: "advarsel",
      melding:
        `<${tagg}> har ikke attributtet «${a.navn}», og komponenten leser ` +
        `det ikke. Attributtene er ${liste(Object.keys(element.attributter))}.`,
    }
  }
  if (kjent.type === "flag") {
    if (
      a.verdi !== undefined &&
      a.verdi !== "" &&
      a.verdi.toLowerCase() !== a.navn
    )
      return {
        ...felles,
        alvor: "advarsel",
        melding:
          `${a.navn} er et boolsk attributt: det står der eller ikke. ` +
          `${a.navn}="${a.verdi}" betyr det samme som ${a.navn}. Ta det ` +
          "bort for å slå det av.",
      }
    return undefined
  }
  if (kjent.type === "values") {
    if (a.verdi === undefined || !kjent.verdier.includes(a.verdi))
      return {
        ...felles,
        alvor: "feil",
        melding:
          `${a.navn} kan ikke være «${a.verdi ?? ""}». Lovlige verdier: ` +
          `${liste([...kjent.verdier])}.`,
      }
    return undefined
  }
  if (kjent.type === "number" && a.verdi !== undefined && !TALL.test(a.verdi))
    return {
      ...felles,
      alvor: "feil",
      melding: `${a.navn} skal være et tall, ikke «${a.verdi}».`,
    }
  return undefined
}

/*
 * Det `<fs-field>` selv sier fra om i nettleseren, med den samme teksten.
 * Komponenten godtar tre måter å gi feltet et navn: en `<label>` inni, en
 * `<label for>` utenfor som peker på kontrollen, eller `aria-label` og
 * `aria-labelledby` på kontrollen. Et tomt element er et område serveren
 * ikke har fylt ennå, og meldes ikke.
 */
const KONTROLL = /<(input|textarea|select)\b/i

function sjekkFelt(
  tekst: string,
  tagg: string,
  navnStart: number,
  navnSlutt: number,
  innhold: string,
  attributter: LestAttributt[],
  lenke: string,
): Funn[] {
  if (!/<[a-z]/i.test(innhold)) return []
  const felles = { start: navnStart, slutt: navnSlutt, lenke }
  const kontroll = KONTROLL.exec(innhold)
  if (!kontroll)
    return [
      {
        ...felles,
        alvor: "advarsel",
        melding:
          `<${tagg}> fant ingen kontroll å koble til. Ledeteksten, ` +
          "hjelpeteksten og feilmeldingen står uten et felt, og koblingen " +
          "kan ikke lages. Sett inn et <input>, <textarea> eller <select>.",
      },
    ]
  if (/<label\b/i.test(innhold)) return []

  const kontrollSlutt = taggSlutt(innhold, kontroll.index)
  const kontrollAttributter = lesAttributter(
    innhold.slice(kontroll.index + kontroll[0].length, kontrollSlutt),
    0,
  )
  const har = (navn: string) => kontrollAttributter.find((a) => a.navn === navn)
  if (har("aria-label") || har("aria-labelledby")) return []

  const id =
    attributter.find((a) => a.navn === "control-id")?.verdi ?? har("id")?.verdi
  if (id) {
    const utenfor = new RegExp(
      `<label\\b[^>]*\\sfor\\s*=\\s*(?:"${id}"|'${id}'|${id}(?=[\\s>]))`,
      "i",
    )
    if (utenfor.test(tekst)) return []
  }
  return [
    {
      ...felles,
      alvor: "advarsel",
      melding:
        `<${tagg}> fant ingen <label>. Feltet får da ingen ledetekst, og en ` +
        "skjermleser leser det opp uten navn.",
    },
  ]
}

/** Alle funn i teksten, i den rekkefølgen de står. */
export function diagnostiser(tekst: string, elementer: Elementer): Funn[] {
  const kilde = utenSkjult(tekst)
  const funn: Funn[] = []
  const kjente = Object.keys(elementer)

  for (const treff of kilde.matchAll(/<(fs-[a-z0-9-]*)(?=[\s/>])/gi)) {
    const tagg = treff[1].toLowerCase()
    const navnStart = (treff.index ?? 0) + 1
    const navnSlutt = navnStart + tagg.length
    const element = elementer[tagg]
    if (!element) {
      funn.push({
        start: navnStart,
        slutt: navnSlutt,
        alvor: "feil",
        lenke: DOKUMENTASJON,
        melding: `<${tagg}> finnes ikke i Fristil. Elementene er ${liste(kjente)}.`,
      })
      continue
    }

    const slutt = taggSlutt(kilde, navnSlutt)
    if (slutt < 0) continue
    const kropp = kilde.slice(navnSlutt, slutt).replace(/\/$/, "")
    const attributter = lesAttributter(kropp, navnSlutt)
    for (const a of attributter) {
      const f = sjekkAttributt(tagg, element, a)
      if (f) funn.push(f)
    }

    if (tagg === "fs-field") {
      const lukk = kilde.indexOf(`</${tagg}`, slutt)
      const innhold = kilde.slice(slutt + 1, lukk < 0 ? kilde.length : lukk)
      funn.push(
        ...sjekkFelt(
          kilde,
          tagg,
          navnStart,
          navnSlutt,
          innhold,
          attributter,
          element.lenke,
        ),
      )
    }
  }
  return funn
}

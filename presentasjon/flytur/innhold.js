/*
 * Teksten i flyturen, trukket ut av lysbildene.
 *
 * Flyturen har ingen egen kopi av presentasjonen. Den henter
 * designsystemarkitektur.html, leser lysbildene med DOMParser og tar ut
 * teksten: overskrifter, avsnitt, punkter, kode, tabeller og linjene om hva
 * kravet koster. Endres et lysbilde, endres flyturen.
 *
 * Teksten deles i små scener. Hver scene er så kort at den kan leses
 * mens kameraet står stille, og henger som tekst i byen, ikke på et kort.
 *
 * Avhengighetsgrafen er tegnet av et skript i lysbildet. Her leses
 * datasettet ut av det samme skriptet, og hvert designsystem blir et eget
 * scene med grafen bygget i tre dimensjoner.
 */

const KILDE = "designsystemarkitektur.html"

const HOPP_TAGGER = new Set([
  "script",
  "style",
  "svg",
  "button",
  "input",
  "select",
  "textarea",
  "template",
])
const HOPP_KLASSER = [
  "avh-forklaring",
  "avh-liste",
  "avh-scene",
  "avh-tabeller",
  "morf-panel",
  "morf-styring",
  "styring",
]

const hopp = (el) => {
  const tag = el.tagName.toLowerCase()
  if (HOPP_TAGGER.has(tag) || tag.includes("-")) return true
  for (const k of el.classList)
    if (HOPP_KLASSER.includes(k) || k.startsWith("fs-")) return true
  return false
}

/* Løpende tekst med stil: vanlig, sterk, kode, lenke og kommentar. */
function løp(node, stil = "vanlig", ut = [], pre = false) {
  for (const b of node.childNodes) {
    if (b.nodeType === 3) {
      const t = pre ? b.textContent : b.textContent.replace(/\s+/g, " ")
      if (t) ut.push({ t, s: stil })
    } else if (b.nodeType === 1) {
      if (hopp(b)) continue
      const tag = b.tagName.toLowerCase()
      if (tag === "br") ut.push({ t: "\n", s: stil })
      else if (b.classList.contains("fristil-merke"))
        ut.push({ t: `${b.textContent.trim()} · `, s: "merke" })
      else {
        let ny = stil
        if (tag === "strong" || tag === "b") ny = pre ? "uthevet" : "sterk"
        else if (tag === "code") ny = "kode"
        else if (tag === "a") ny = "lenke"
        else if (tag === "i" && pre) ny = "kommentar"
        løp(b, ny, ut, pre)
      }
    }
  }
  return ut
}

function rens(l) {
  const ut = []
  for (const x of l) {
    const forrige = ut[ut.length - 1]
    if (forrige && forrige.s === x.s) forrige.t += x.t
    else ut.push({ ...x })
  }
  if (ut.length) {
    ut[0].t = ut[0].t.replace(/^\s+/, "")
    ut[ut.length - 1].t = ut[ut.length - 1].t.replace(/\s+$/, "")
  }
  return ut.filter((x) => x.t)
}

export const ren = (l) => l.map((x) => x.t).join("")

function blokker(rot) {
  const ut = []
  const gå = (el, gruppe) => {
    for (const b of el.children) {
      if (hopp(b)) continue
      const tag = b.tagName.toLowerCase()
      const k = b.classList
      const legg = (type, l, ekstra = {}) => {
        const r = rens(l)
        if (r.length) ut.push({ type, løp: r, gruppe, ...ekstra })
      }
      if (k.contains("merke") || k.contains("kapittelmerke")) legg("merke", løp(b))
      else if (tag === "h1") legg("tittel", løp(b), { stor: true })
      else if (tag === "h2") legg("tittel", løp(b))
      else if (tag === "h3" || k.contains("kodetittel")) legg("etikett", løp(b))
      else if (k.contains("tall")) legg("tall", løp(b))
      else if (tag === "pre")
        legg("kode", løp(b, "vanlig", [], true).map((x) => x))
      else if (tag === "p" && b.querySelector(":scope > .rolle")) {
        const [rolle, tekst] = b.children
        legg("rolle", løp(tekst ?? b), {
          rolle: rolle.textContent.trim(),
          art: rolle.classList.contains("rolle-fristil")
            ? "fristil"
            : rolle.classList.contains("rolle-forvalter")
              ? "forvalter"
              : "team",
        })
      } else if (tag === "p")
        legg(
          k.contains("ingress") ? "ingress" : k.contains("dempet") ? "dempet" : "avsnitt",
          løp(b),
        )
      else if (tag === "ul" || tag === "ol") {
        const nummerert = tag === "ol"
        const liste = k.contains("kapittelliste") ? "kapittel" : ""
        ;[...b.children].forEach((li, i) => {
          // Oversikten over kapitlene: navnet og hvor mange lysbilder det har.
          const sterk = li.querySelector("strong")
          const spenn = li.querySelector("div > span")
          if (k.contains("beslutninger") && sterk && spenn)
            legg("punkt", [
              { t: sterk.textContent.trim(), s: "sterk" },
              { t: `  ·  ${spenn.textContent.trim()}`, s: "vanlig" },
            ], { nr: i + 1 })
          else legg("punkt", løp(li), { nr: nummerert ? i + 1 : null, liste })
        })
      } else if (tag === "table") {
        const rader = [...b.querySelectorAll("tr")].map((tr) =>
          [...tr.children].map((c) => rens(løp(c))),
        )
        ut.push({ type: "tabell", rader, gruppe })
      } else if (k.contains("boks") || k.contains("perspektiv")) gå(b, b)
      else gå(b, gruppe)
    }
  }
  gå(rot, null)
  return ut
}

const lengde = (b) =>
  b.type === "tabell"
    ? b.rader.flat().reduce((s, c) => s + ren(c).length, 0)
    : ren(b.løp).length

/*
 * Scenene i ett lysbilde.
 *
 * Teksten deles i små biter, og hver bit får en form etter hva den er:
 *
 * - tittel: overskriften, bygget av partikler som samler seg
 * - ord: en kort setning, ord for ord
 * - setninger: et langt avsnitt, én setning om gangen i en trapp innover
 * - utrop: et punkt med uthevet start, som stor overskrift og forklaring
 * - konstellasjon: en liste med korte punkter, som noder i en ring
 * - satellitter: rollene nederst på lysbildet, som kretser rundt et senter
 * - kode: kodelinjer som skrives fram på et buet bånd
 * - tabell: tallkolonner som søyler, og resten som et rutenett i rommet
 * - tall: et stort tall med det det teller i bane rundt seg
 * - graf: avhengighetsgrafen i tre dimensjoner
 */
const KORT = 75

const startSterk = (b) => b.løp[0]?.s === "sterk" && b.løp.length > 1

function delUtrop(b) {
  const leder = b.løp[0].t.trim().replace(/[.:]$/, "")
  const resten = rens(b.løp.slice(1))
  return { leder: [{ t: leder, s: "vanlig" }], kropp: resten }
}

function scener(bl) {
  const ut = []
  let i = 0
  let etikett = null
  const legg = (sc) => {
    if (etikett) {
      sc.etikett = etikett
      etikett = null
    }
    ut.push(sc)
  }
  const merker = []
  while (bl[i]?.type === "merke") merker.push(bl[i++])
  if (bl[i]?.type === "tittel") legg({ form: "tittel", blokker: [...merker, bl[i++]] })
  else if (merker.length) legg({ form: "ord", blokker: merker })

  while (i < bl.length) {
    const b = bl[i]
    const l = lengde(b)
    if (b.type === "etikett") {
      etikett = b.løp
      i++
    } else if (b.type === "merke") {
      // Et merke i en boks, som CSR og SSR, er overskriften til det som følger.
      const neste = bl[i + 1]
      if (neste && neste.gruppe === b.gruppe && neste.løp) {
        legg({ form: "utrop", blokker: [b, neste], leder: b.løp, kropp: neste.løp })
        i += 2
      } else {
        legg({ form: "ord", blokker: [b] })
        i++
      }
    } else if (b.type === "tall") {
      const neste = bl[i + 1]
      legg({ form: "tall", blokker: neste ? [b, neste] : [b], tall: ren(b.løp), kropp: neste?.løp ?? [] })
      i += neste ? 2 : 1
    } else if (b.type === "kode") {
      legg({ form: "kode", blokker: [b] })
      i++
    } else if (b.type === "tabell") {
      legg({ form: "tabell", blokker: [b] })
      i++
    } else if (b.type === "rolle") {
      const roller = []
      while (bl[i]?.type === "rolle") roller.push(bl[i++])
      legg({ form: "satellitter", blokker: roller })
    } else if (b.type === "punkt") {
      const liste = []
      const g = b.gruppe
      while (bl[i]?.type === "punkt" && bl[i].gruppe === g && (liste.length === 0 || bl[i].nr !== 1)) liste.push(bl[i++])
      const korte = liste.every((x) => lengde(x) <= KORT) || b.liste === "kapittel"
      if (korte && liste.length > 1) {
        for (let k = 0; k < liste.length; k += 8)
          legg({ form: "konstellasjon", blokker: liste.slice(k, k + 8) })
      } else
        for (const p of liste) {
          if (startSterk(p)) legg({ form: "utrop", blokker: [p], ...delUtrop(p), nr: p.nr })
          else legg({ form: lengde(p) > 170 ? "setninger" : "ord", blokker: [p] })
        }
    } else {
      // Avsnitt, ingress og dempet tekst.
      const sitat = l < 130 && b.løp.every((x) => x.s === "sterk" || !x.t.trim())
      legg({ form: l > 170 ? "setninger" : "ord", blokker: [b], sitat })
      i++
    }
  }
  return ut
}

/* Avhengighetsgrafen: datasettet fra skriptet i lysbildet. */
function grafdata(kilde) {
  const treff = /const DATA = (\{.*\})\s*\n/.exec(kilde)
  if (!treff) return null
  try {
    return JSON.parse(treff[1])
  } catch {
    return null
  }
}

const mb = (b) =>
  b >= 1024 * 1024
    ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
    : `${Math.round(b / 1024)} kB`
const kb = (b) => `${(b / 1024).toFixed(1).replace(".", ",")} kB`

function grafsteder(data) {
  return Object.values(data).map((sys) => {
    const nye = sys.n.filter((n) => n[2] === "system" || n[2] === "annen")
    const byte = nye.reduce((s, n) => s + n[3], 0)
    const linje = [
      { t: `${nye.length}`, s: "sterk" },
      { t: nye.length === 1 ? " ny pakke  ·  " : " nye pakker  ·  ", s: "vanlig" },
      { t: `${sys.e.length}`, s: "sterk" },
      { t: sys.e.length === 1 ? " kobling  ·  " : " koblinger  ·  ", s: "vanlig" },
      { t: mb(byte), s: "sterk" },
      { t: " utpakket", s: "vanlig" },
    ]
    if (sys.knapp)
      linje.push({ t: "  ·  ", s: "vanlig" }, { t: kb(sys.knapp), s: "sterk" }, {
        t: " CSS til knappen",
        s: "vanlig",
      })
    return {
      form: "graf",
      blokker: [
        { type: "tittel", løp: [{ t: sys.navn, s: "vanlig" }] },
        { type: "kode", løp: [{ t: sys.kommando, s: "vanlig" }] },
        { type: "avsnitt", løp: linje },
      ],
      graf: sys,
    }
  })
}

export async function hentInnhold() {
  const svar = await fetch(KILDE)
  if (!svar.ok) throw new Error(`Fant ikke ${KILDE}`)
  const kilde = await svar.text()
  const dok = new DOMParser().parseFromString(kilde, "text/html")
  const lysbilder = [...dok.querySelectorAll("section.lysbilde")]
  const data = grafdata(kilde)

  const punkter = []
  let kapittel = 0
  let igjen = 0
  lysbilder.forEach((l, nr) => {
    const forside = l.classList.contains("kapittel")
    let distrikt
    if (forside) {
      kapittel++
      igjen = l.querySelectorAll(".kapittelliste li").length
      distrikt = kapittel
    } else if (kapittel > 0 && igjen > 0) {
      igjen--
      distrikt = kapittel
    } else distrikt = kapittel === 0 ? 0 : 9

    const steder = scener(blokker(l))
    // Grafen settes inn etter hodet og avsnittet som forklarer den.
    if (l.classList.contains("avh") && data) steder.splice(2, 0, ...grafsteder(data))

    if (forside && steder[0])
      steder[0].kapittelNr = /(\d+)/.exec(l.querySelector(".merke")?.textContent ?? "")?.[1] ?? ""
    steder.forEach((s, i) => {
      punkter.push({
        ...s,
        lysbilde: nr,
        distrikt,
        forside: forside && i === 0,
        nyttLysbilde: i === 0,
        hode: i === 0,
      })
    })
  })
  return { punkter, antallLysbilder: lysbilder.length }
}

export function ordIPunkt(p) {
  let n = 0
  for (const b of p.blokker) {
    const tekst =
      b.type === "tabell" ? b.rader.flat().map(ren).join(" ") : ren(b.løp)
    n += tekst.split(/\s+/).filter(Boolean).length
  }
  return n
}

export function klartekst(p) {
  return p.blokker
    .map((b) =>
      b.type === "tabell"
        ? b.rader.map((r) => r.map(ren).join(", ")).join(". ")
        : (b.rolle ? `${b.rolle}: ` : "") + ren(b.løp),
    )
    .join("\n")
}

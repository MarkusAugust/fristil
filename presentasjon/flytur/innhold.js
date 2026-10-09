/*
 * Teksten i flyturen, trukket ut av lysbildene.
 *
 * Flyturen har ingen egen kopi av presentasjonen. Den henter
 * designsystemarkitektur.html, leser lysbildene med DOMParser og tar ut
 * teksten: overskrifter, avsnitt, punkter, kode, tabeller og linjene om hva
 * kravet koster. Endres et lysbilde, endres flyturen.
 *
 * Teksten deles i stoppesteder. Hvert stoppested er så kort at det kan leses
 * mens kameraet står stille, og henger som tekst i byen, ikke på et kort.
 *
 * Avhengighetsgrafen er tegnet av et skript i lysbildet. Her leses
 * datasettet ut av det samme skriptet, og hvert designsystem blir et eget
 * stoppested med grafen bygget i tre dimensjoner.
 */

const KILDE = "designsystemarkitektur.html"
const BUDSJETT = 330

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
 * Stoppestedene i ett lysbilde. Det første er alltid hodet: merket og
 * overskriften, og ingressen om den er kort. Resten fylles opp til
 * budsjettet, men en ny boks, en etikett, kode og tabeller begynner alltid
 * på et nytt sted.
 */
function stoppesteder(bl) {
  const ut = []
  let nå = []
  let sum = 0
  const ferdig = () => {
    if (nå.length) ut.push(nå)
    nå = []
    sum = 0
  }
  let i = 0
  while (i < bl.length && bl[i].type === "merke") nå.push(bl[i++])
  if (bl[i]?.type === "tittel") nå.push(bl[i++])
  if (bl[i]?.type === "ingress" && lengde(bl[i]) < 260) nå.push(bl[i++])
  ferdig()
  let gruppe = null
  for (; i < bl.length; i++) {
    const b = bl[i]
    const l = lengde(b)
    const nyGruppe = b.gruppe !== gruppe
    gruppe = b.gruppe
    const alene = b.type === "kode" || b.type === "tabell"
    const forrige = nå[nå.length - 1]
    const etterEtikett = forrige?.type === "etikett" || forrige?.type === "tall"
    if (
      !etterEtikett &&
      nå.length &&
      (sum + l > BUDSJETT || nyGruppe || alene || b.type === "etikett" || b.type === "tall" ||
        forrige?.type === "kode" || forrige?.type === "tabell")
    )
      ferdig()
    nå.push(b)
    sum += l
    // Kapittellista på forsidene leses som én.
    if (b.liste === "kapittel") sum = Math.min(sum, BUDSJETT - 80)
  }
  ferdig()
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

    const steder = stoppesteder(blokker(l)).map((b) => ({ blokker: b }))
    // Grafen settes inn etter hodet og avsnittet som forklarer den.
    if (l.classList.contains("avh") && data) steder.splice(2, 0, ...grafsteder(data))

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

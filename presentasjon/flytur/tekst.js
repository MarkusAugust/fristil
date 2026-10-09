/*
 * Teksten som henger i byen.
 *
 * Hvert stoppested tegnes på et eget lerret og blir en tekstur på en flate
 * i rommet. Det er ingen ramme og ingen bakgrunn, bare tekst med en mørk
 * glorie som gjør den lesbar mot lysene bak.
 *
 * Oppsettet regnes ut én gang. Deretter kan teksten tegnes med en grad av
 * dekoding mellom 0 og 1: under 1 står noen av tegnene som tilfeldige
 * katakana og sifre, slik skjermene i filmen leser inn data. Teksten foran
 * kameraet dekodes når det kommer fram.
 */

const BREDDE = 1600
const SMAL_BREDDE = 940
const MARG = 110
const SANS = "Helvetica, Arial, sans-serif"
const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
const STØY = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789"

const FARGE = {
  tekst: "#e8f1f8",
  dempet: "#9fb2c4",
  hvit: "#ffffff",
  cyan: "#6ff2d0",
  blå: "#9ccff2",
  kode: "#8fe3ff",
  kommentar: "#7f9bb5",
  team: "#9ccff2",
  forvalter: "#f0d2b6",
  fristil: "#b9e1c8",
}

const hash = (a, b) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/* Stilen for et løp, gitt grunnstilen til blokken. */
function font(grunn, s) {
  const st = grunn.størrelse
  if (s === "sterk") return { f: `700 ${st}px ${SANS}`, c: FARGE.hvit }
  if (s === "kode") return { f: `500 ${Math.round(st * 0.88)}px ${MONO}`, c: FARGE.kode }
  if (s === "lenke") return { f: `${grunn.vekt} ${st}px ${grunn.familie}`, c: FARGE.blå, strek: true }
  if (s === "merke") return { f: `700 ${Math.round(st * 0.8)}px ${MONO}`, c: FARGE.cyan }
  if (s === "kommentar") return { f: `400 ${st}px ${MONO}`, c: FARGE.kommentar }
  if (s === "uthevet") return { f: `700 ${st}px ${MONO}`, c: FARGE.hvit }
  return { f: `${grunn.vekt} ${st}px ${grunn.familie}`, c: grunn.farge }
}

function grunnstil(b, skala, sitat) {
  const s = (n) => Math.round(n * skala)
  switch (b.type) {
    case "merke":
      return { størrelse: s(27), vekt: 600, familie: MONO, farge: FARGE.cyan, linje: 1.4, store: true, etter: s(14) }
    case "tittel":
      return { størrelse: s(b.stor ? 96 : 76), vekt: 700, familie: SANS, farge: FARGE.hvit, linje: 1.1, etter: s(30) }
    case "etikett":
      return { størrelse: s(28), vekt: 600, familie: MONO, farge: FARGE.blå, linje: 1.4, store: true, etter: s(16) }
    case "ingress":
      return { størrelse: s(48), vekt: 400, familie: SANS, farge: FARGE.tekst, linje: 1.34, etter: s(26) }
    case "dempet":
      return { størrelse: s(40), vekt: 400, familie: SANS, farge: FARGE.dempet, linje: 1.38, etter: s(24) }
    case "tall":
      return { størrelse: s(160), vekt: 700, familie: SANS, farge: FARGE.cyan, linje: 1, etter: s(10) }
    case "kode":
      return { størrelse: s(34), vekt: 400, familie: MONO, farge: "#cfe9ff", linje: 1.45, etter: s(24), pre: true }
    case "rolle":
      return { størrelse: s(42), vekt: 400, familie: SANS, farge: FARGE.tekst, linje: 1.34, etter: s(30) }
    default:
      return sitat
        ? { størrelse: s(68), vekt: 700, familie: SANS, farge: FARGE.hvit, linje: 1.2, etter: s(20) }
        : { størrelse: s(43), vekt: 400, familie: SANS, farge: FARGE.tekst, linje: 1.36, etter: s(24) }
  }
}

/* Bryter løpene i ord og legger dem ut på linjer. */
function settUt(g, løp, grunn, x0, y0, bredde, ops) {
  let x = x0
  let y = y0
  const lh = grunn.størrelse * grunn.linje
  for (const l of løp) {
    const st = font(grunn, l.s)
    g.font = st.f
    const tekst = grunn.store ? l.t.toUpperCase() : l.t
    const biter = grunn.pre ? tekst.split(/(\n)/) : tekst.split(/(\s+)/)
    for (const bit of biter) {
      if (!bit) continue
      if (bit === "\n") {
        x = x0
        y += lh
        continue
      }
      const w = g.measureText(bit).width
      if (!grunn.pre && /^\s+$/.test(bit)) {
        if (x > x0) x += w
        continue
      }
      if (x + w > x0 + bredde && x > x0 && !grunn.pre) {
        x = x0
        y += lh
      }
      ops.push({ x, y, t: bit, f: st.f, c: st.c, strek: st.strek, w })
      x += w
    }
  }
  return y + lh
}

function oppsett(g, punkt, skala, BREDDE) {
  const ops = []
  const streker = []
  let y = MARG
  const innhold = BREDDE - 2 * MARG
  const tegn = punkt.blokker.reduce((s, b) => s + (b.løp ? b.løp.map((l) => l.t).join("").length : 200), 0)
  const sitat = punkt.blokker.length === 1 && punkt.blokker[0].type === "avsnitt" && tegn < 120
  for (const b of punkt.blokker) {
    const grunn = grunnstil(b, skala, sitat)
    if (b.type === "punkt") {
      const merke = b.nr ? String(b.nr).padStart(2, "0") : "▸"
      g.font = `600 ${Math.round(grunn.størrelse * 0.7)}px ${MONO}`
      ops.push({ x: MARG, y: y + grunn.størrelse * 0.12, t: merke, f: g.font, c: FARGE.cyan, w: 0 })
      y = settUt(g, b.løp, grunn, MARG + grunn.størrelse * 1.7, y, innhold - grunn.størrelse * 1.7, ops)
      y += grunn.etter * 0.6
    } else if (b.type === "rolle") {
      const etikett = { størrelse: Math.round(26 * skala), vekt: 600, familie: MONO, farge: FARGE[b.art], linje: 1.5, store: true }
      y = settUt(g, [{ t: b.rolle, s: "vanlig" }], etikett, MARG, y, innhold, ops)
      y = settUt(g, b.løp, grunn, MARG, y, innhold, ops) + grunn.etter
    } else if (b.type === "kode") {
      const topp = y
      y = settUt(g, b.løp, grunn, MARG + 30, y, innhold - 30, ops) + grunn.etter * 0.3
      streker.push({ x: MARG + 4, y0: topp, y1: y - grunn.etter * 0.3 })
      y += grunn.etter
    } else if (b.type === "tabell") {
      const st = Math.round(32 * skala)
      const kol = b.rader[0]?.length ?? 1
      // Første kolonne får plass til navnet, resten deler likt.
      const første = Math.min(innhold * 0.36, innhold / kol + 80)
      const resten = (innhold - første) / Math.max(1, kol - 1)
      b.rader.forEach((rad, ri) => {
        const hode = ri === 0
        const grunnRad = hode
          ? { størrelse: Math.round(st * 0.8), vekt: 600, familie: MONO, farge: FARGE.cyan, linje: 1.4, store: true }
          : { størrelse: st, vekt: 400, familie: SANS, farge: FARGE.tekst, linje: 1.35 }
        let maks = y
        rad.forEach((celle, ci) => {
          const x = ci === 0 ? MARG : MARG + første + (ci - 1) * resten
          const w = (ci === 0 ? første : resten) - 24
          maks = Math.max(maks, settUt(g, celle, grunnRad, x, y, w, ops))
        })
        y = maks + st * 0.35
        streker.push({ x: MARG, y0: y - st * 0.18, x1: BREDDE - MARG, vannrett: true })
      })
      y += 20
    } else {
      y = settUt(g, b.løp, grunn, MARG, y, innhold, ops) + grunn.etter
    }
  }
  const bredest = ops.reduce((m, op) => Math.max(m, op.x + op.w), 0)
  return { ops, streker, høyde: Math.ceil(y + MARG), bredest }
}

export function lagTekst(punkt, smal = false) {
  const BREDDE_HER = smal ? SMAL_BREDDE : BREDDE
  const MAKS_HØYDE = smal ? 1900 : 1250
  const lerret = document.createElement("canvas")
  const g = lerret.getContext("2d")
  let skala = 1
  let o = oppsett(g, punkt, skala, BREDDE_HER)
  while ((o.høyde > MAKS_HØYDE || o.bredest > BREDDE_HER - MARG / 2) && skala > 0.45) {
    skala *= 0.9
    o = oppsett(g, punkt, skala, BREDDE_HER)
  }
  lerret.width = BREDDE_HER
  lerret.height = Math.max(200, o.høyde)
  let sist = -1

  function tegn(p) {
    const grad = Math.round(p * 40) / 40
    if (grad === sist) return false
    sist = grad
    g.clearRect(0, 0, lerret.width, lerret.height)
    // Et mykt mørke bak teksten, uten kanter, så den leses mot lysene bak.
    // Det er skyggen av et rektangel utenfor lerretet, så kantene blir uskarpe.
    g.save()
    g.shadowColor = `rgba(0, 8, 10, ${0.6 * Math.max(0.35, grad)})`
    g.shadowBlur = 70
    g.shadowOffsetX = 10000
    g.fillStyle = "#000"
    g.fillRect(MARG * 0.55 - 10000, MARG * 0.55, lerret.width - MARG * 1.1, lerret.height - MARG * 1.1)
    g.restore()
    g.textBaseline = "top"
    const fase = Math.floor(performance.now() / 70)
    for (const pass of [0, 1]) {
      g.shadowColor = pass ? "rgba(120, 255, 230, 0.32)" : "rgba(0, 6, 8, 0.95)"
      g.shadowBlur = pass ? 16 : 22
      for (let i = 0; i < o.ops.length; i++) {
        const op = o.ops[i]
        g.font = op.f
        let t = op.t
        let c = op.c
        if (grad < 1) {
          let ny = ""
          for (let k = 0; k < t.length; k++) {
            const h = hash(i, k)
            if (h * 0.85 + 0.15 > grad * 1.05) {
              ny += h < 0.12 + (1 - grad) * 0.4 && t[k] !== " " ? STØY[Math.floor(hash(k + fase, i) * STØY.length)] : " "
            } else ny += t[k]
          }
          t = ny
          c = grad < 0.6 ? FARGE.cyan : c
        }
        g.fillStyle = c
        g.fillText(t, op.x, op.y)
        if (op.strek && pass && grad === 1) g.fillRect(op.x, op.y + parseInt(op.f.match(/(\d+)px/)[1], 10) * 1.05, op.w, 2)
      }
    }
    g.shadowBlur = 0
    g.globalAlpha = 0.7 * grad
    g.fillStyle = FARGE.cyan
    for (const s of o.streker) {
      if (s.vannrett) g.fillRect(s.x, s.y0, s.x1 - s.x, 1.5)
      else g.fillRect(s.x, s.y0, 3, s.y1 - s.y0)
    }
    g.globalAlpha = 1
    return true
  }

  return { lerret, forhold: lerret.width / lerret.height, tegn }
}

/*
 * Tekst som bygges av ord.
 *
 * Teksten legges ut på et lerret, men hvert ord husker hvor det står. Da kan
 * formene i former.js gjøre hvert ord til en egen flate i rommet: ordene kan
 * komme flygende hver for seg, regne ned, skrives fram eller sprenges ut, og
 * likevel lande der de skal så teksten kan leses.
 *
 * Ingen ramme og ingen bakgrunn. Hvert ord har en mørk glorie som gjør det
 * lesbart mot lysene bak, og et svakt lys i fargen til distriktet.
 */

export const SANS = "Helvetica, Arial, sans-serif"
export const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'

export const FARGE = {
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
  rav: "#ffc27a",
}

/* Stilene, i piksler på lerretet. */
export function stil(navn, skala = 1) {
  const s = (n) => Math.round(n * skala)
  const S = {
    merke: { størrelse: s(30), vekt: 600, familie: MONO, farge: FARGE.cyan, linje: 1.4, store: true },
    tittel: { størrelse: s(96), vekt: 700, familie: SANS, farge: FARGE.hvit, linje: 1.08 },
    sitat: { størrelse: s(78), vekt: 700, familie: SANS, farge: FARGE.hvit, linje: 1.16 },
    leder: { størrelse: s(70), vekt: 700, familie: SANS, farge: FARGE.hvit, linje: 1.12 },
    etikett: { størrelse: s(30), vekt: 600, familie: MONO, farge: FARGE.blå, linje: 1.4, store: true },
    ingress: { størrelse: s(54), vekt: 400, familie: SANS, farge: FARGE.tekst, linje: 1.3 },
    avsnitt: { størrelse: s(48), vekt: 400, familie: SANS, farge: FARGE.tekst, linje: 1.32 },
    kropp: { størrelse: s(44), vekt: 400, familie: SANS, farge: FARGE.tekst, linje: 1.34 },
    dempet: { størrelse: s(44), vekt: 400, familie: SANS, farge: FARGE.dempet, linje: 1.34 },
    node: { størrelse: s(36), vekt: 600, familie: SANS, farge: FARGE.tekst, linje: 1.25 },
    celle: { størrelse: s(36), vekt: 400, familie: SANS, farge: FARGE.tekst, linje: 1.3 },
    kode: { størrelse: s(38), vekt: 400, familie: MONO, farge: "#cfe9ff", linje: 1.5, pre: true },
    tall: { størrelse: s(300), vekt: 700, familie: SANS, farge: FARGE.cyan, linje: 1 },
  }
  return S[navn] ?? S.avsnitt
}

function font(grunn, s) {
  const st = grunn.størrelse
  if (s === "sterk") return { f: `700 ${st}px ${grunn.familie === MONO ? MONO : SANS}`, c: FARGE.hvit }
  if (s === "kode") return { f: `500 ${Math.round(st * 0.9)}px ${MONO}`, c: FARGE.kode }
  if (s === "lenke") return { f: `${grunn.vekt} ${st}px ${grunn.familie}`, c: FARGE.blå }
  if (s === "merke") return { f: `700 ${Math.round(st * 0.8)}px ${MONO}`, c: FARGE.cyan }
  if (s === "kommentar") return { f: `400 ${st}px ${MONO}`, c: FARGE.kommentar }
  if (s === "uthevet") return { f: `700 ${st}px ${MONO}`, c: FARGE.hvit }
  return { f: `${grunn.vekt} ${st}px ${grunn.familie}`, c: grunn.farge }
}

const måler = document.createElement("canvas").getContext("2d")

/*
 * Legger ut løpene i ord på linjer innenfor en bredde. Kode brytes bare der
 * koden selv har linjeskift, og hver linje blir ett «ord».
 */
export function settOpp(løp, grunn, bredde) {
  const ops = []
  let x = 0
  let y = 0
  let linje = 0
  const lh = grunn.størrelse * grunn.linje
  for (const l of løp) {
    const st = font(grunn, l.s)
    måler.font = st.f
    const tekst = grunn.store ? l.t.toUpperCase() : l.t
    const biter = grunn.pre ? tekst.split(/(\n)/) : tekst.split(/(\s+)/)
    for (const bit of biter) {
      if (!bit) continue
      if (bit === "\n") {
        x = 0
        y += lh
        linje++
        continue
      }
      const w = måler.measureText(bit).width
      if (!grunn.pre && /^\s+$/.test(bit)) {
        if (x > 0) x += w
        continue
      }
      if (x + w > bredde && x > 0 && !grunn.pre) {
        x = 0
        y += lh
        linje++
      }
      // Kodelinjer på rad hører sammen, og slås sammen til én flate per linje.
      const forrige = ops[ops.length - 1]
      if (grunn.pre && forrige && forrige.linje === linje && forrige.f === st.f && forrige.c === st.c) {
        forrige.t += bit
        forrige.w += w
      } else ops.push({ x, y, t: bit, f: st.f, c: st.c, w, h: grunn.størrelse, linje })
      x += w
    }
  }
  const bredest = ops.reduce((m, op) => Math.max(m, op.x + op.w), 0)
  return { ops, høyde: y + lh, bredde: bredest, linjer: linje + 1 }
}

/*
 * Tegner et oppsett på et lerret med marg til glorien. Returnerer lerretet
 * og ordene med plass i piksler, så hvert ord kan bli sin egen flate.
 */
export function tegnLerret(oppsett, marg = 34) {
  const lerret = document.createElement("canvas")
  const skala = Math.min(1, 4096 / (oppsett.bredde + 2 * marg), 4096 / (oppsett.høyde + 2 * marg))
  lerret.width = Math.ceil((oppsett.bredde + 2 * marg) * skala)
  lerret.height = Math.ceil((oppsett.høyde + 2 * marg) * skala)
  const g = lerret.getContext("2d")
  g.scale(skala, skala)
  g.textBaseline = "top"
  for (const pass of [0, 1]) {
    g.shadowColor = pass ? "rgba(120, 255, 230, 0.35)" : "rgba(0, 6, 8, 0.96)"
    g.shadowBlur = pass ? 14 : 24
    for (const op of oppsett.ops) {
      g.font = op.f
      g.fillStyle = op.c
      g.fillText(op.t, op.x + marg, op.y + marg)
      if (!pass) g.fillText(op.t, op.x + marg, op.y + marg)
    }
  }
  return { lerret, marg, skala, bredde: oppsett.bredde + 2 * marg, høyde: oppsett.høyde + 2 * marg }
}

/* Tekst til partikler: punktene der bokstavene er. */
export function partikkelpunkter(tekst, grunn, bredde, steg = 4) {
  const o = settOpp([{ t: tekst, s: "vanlig" }], grunn, bredde)
  const l = document.createElement("canvas")
  l.width = Math.ceil(o.bredde + 8)
  l.height = Math.ceil(o.høyde + 8)
  const g = l.getContext("2d")
  g.textBaseline = "top"
  g.fillStyle = "#fff"
  for (const op of o.ops) {
    g.font = op.f
    g.fillText(op.t, op.x + 4, op.y + 4)
  }
  const data = g.getImageData(0, 0, l.width, l.height).data
  const punkter = []
  for (let y = 0; y < l.height; y += steg)
    for (let x = 0; x < l.width; x += steg) if (data[(y * l.width + x) * 4] > 140) punkter.push(x, y)
  return { punkter, bredde: l.width, høyde: l.height }
}

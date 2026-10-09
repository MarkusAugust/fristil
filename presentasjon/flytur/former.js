/*
 * Formene innholdet tar i byen.
 *
 * Ingen scene er et lysbilde. Hver bit av teksten har en form som passer det
 * den er, og ordene kommer inn på ulike måter fra scene til scene: fra
 * virvelen, ned fra oven som tegnregn, fra dypet, sprengt ut fra midten eller
 * skrevet fram der de står. Alle lander likevel der de skal, så teksten kan
 * leses når kameraet sirkler rundt den.
 *
 * Hver form gir to grupper: tekst, som tegnes etter bloom og aldri skjules av
 * byen, og rom, som er en del av byen og lyser med den. Verdenen plasserer
 * begge og vender dem mot kameraet. Formen styrer selv hvordan den kommer og
 * går, ut fra hvor lenge det er siden kameraet kom fram eller dro.
 */
import * as THREE from "./vendor/three-0.186.1.min.js"
import { ren } from "./innhold.js"
import { FARGE, partikkelpunkter, settOpp, stil, tegnLerret } from "./tekst.js"

// Hvor stor en piksel på lerretet er i rommet.
const E = 0.021

const MODUSER = ["virvel", "regn", "dybde", "eksplosjon", "skriv", "venstre"]

const klem = (x, a, b) => Math.min(b, Math.max(a, x))
const glatt = (k) => k * k * (3 - 2 * k)

/* ---------- Ordflaten: tekst der hvert ord er en egen flate ---------- */

const ORD_VERTEX = /* glsl */ `
  attribute vec3 start;
  attribute vec3 senter;
  attribute vec2 lokal;
  attribute float forsinkelse;
  attribute float fro;
  attribute float linjeNr;
  uniform float uInn;
  uniform float uUt;
  uniform float uSkriv;
  uniform float uTid;
  varying vec2 vUv;
  varying vec2 vLokal;
  varying float vE;
  varying float vU;
  varying float vLinje;
  void main() {
    vUv = uv;
    vLokal = lokal;
    vLinje = linjeNr;
    float e = clamp((uInn * 1.6 - forsinkelse) / 0.6, 0.0, 1.0);
    e = e * e * (3.0 - 2.0 * e);
    float u = clamp((uUt * 1.5 - fro * 0.5) / 0.9, 0.0, 1.0);
    vE = e;
    vU = u;
    float skala = mix(uSkriv > 0.5 ? 1.0 : 0.2, 1.0, e);
    vec3 p = senter + (position - senter) * skala;
    float r = (1.0 - e);
    float vri = r * r * (fro - 0.5) * 6.0;
    vec3 s = start * r * r;
    p += vec3(s.x * cos(vri) - s.z * sin(vri), s.y, s.x * sin(vri) + s.z * cos(vri));
    p += vec3((fro - 0.5) * 40.0, 6.0 + fro * 26.0, 30.0 + fro * 30.0) * u * u;
    p.y += sin(uTid * 0.9 + fro * 9.0) * 0.06;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const ORD_FRAGMENT = /* glsl */ `
  uniform sampler2D kart;
  uniform float uOpasitet;
  uniform float uSkriv;
  uniform float uTidInn;
  uniform vec3 uAksent;
  varying vec2 vUv;
  varying vec2 vLokal;
  varying float vE;
  varying float vU;
  varying float vLinje;
  void main() {
    vec4 f = texture2D(kart, vUv);
    vec3 c = f.rgb;
    if (uSkriv > 0.5) {
      float r = clamp((uTidInn - vLinje * 0.32) / 0.7, 0.0, 1.0);
      if (vLokal.x > r) discard;
      c += uAksent * smoothstep(r - 0.04, r, vLokal.x) * step(r, 0.999) * 2.5 * f.a;
    }
    c += uAksent * (1.0 - vE) * 1.8 * f.a;
    float a = f.a * vE * (1.0 - vU) * uOpasitet;
    if (a < 0.003) discard;
    gl_FragColor = vec4(c, a);
  }
`

/*
 * Lager en ordflate. Teksten sentreres om origo med mindre noe annet er
 * valgt, og kan bøyes rundt en sylinder så den ligger rundt kameraet.
 */
function ordflate(løp, grunn, bredde, valg = {}) {
  const { modus = "virvel", kurve = 0, juster = "senter", skriv = false, spredning = 0.7, F } = valg
  const o = settOpp(løp, grunn, bredde)
  const t = tegnLerret(o)
  const kart = new THREE.CanvasTexture(t.lerret)
  kart.colorSpace = THREE.SRGBColorSpace
  kart.anisotropy = 8
  const W = o.bredde * E
  const H = o.høyde * E
  const dx = juster === "venstre" ? 0 : juster === "høyre" ? -W : -W / 2
  const pos = []
  const uv = []
  const start = []
  const senter = []
  const lokal = []
  const forsinkelse = []
  const fro = []
  const linjeNr = []
  const indekser = []
  const N = o.ops.length
  const pad = 10
  o.ops.forEach((op, i) => {
    const x0 = op.x - pad
    const x1 = op.x + op.w + pad
    const y0 = op.y - pad
    const y1 = op.y + op.h * 1.3 + pad
    const tilV = (x, y) => {
      const X = x * E + dx
      const Y = H / 2 - y * E
      const Z = kurve ? -(X * X) / (2 * kurve) : 0
      return [X, Y, Z]
    }
    const hjørner = [tilV(x0, y1), tilV(x1, y1), tilV(x1, y0), tilV(x0, y0)]
    const lok = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
    const sx = hjørner.reduce((s, h) => s + h[0], 0) / 4
    const sy = hjørner.reduce((s, h) => s + h[1], 0) / 4
    const sz = hjørner.reduce((s, h) => s + h[2], 0) / 4
    const f = Math.abs(Math.sin(i * 12.9898 + N * 78.233) * 43758.5453) % 1
    const a = f * Math.PI * 2
    let st
    if (modus === "regn") st = [0, 30 + f * 30, -4]
    else if (modus === "dybde") st = [sx * 0.6, sy * 0.6, -70 - f * 60]
    else if (modus === "eksplosjon") st = [sx * 3 + Math.cos(a) * 8, sy * 3 + Math.sin(a) * 8, 18 + f * 10]
    else if (modus === "venstre") st = [-50 - f * 30, Math.sin(a) * 6, -10]
    else if (modus === "skriv") st = [0, 0, 0]
    else st = [Math.cos(a) * (22 + f * 30), Math.sin(a) * (14 + f * 10), -30 - f * 40]
    const forsink = (modus === "regn" ? f * 0.6 : i / Math.max(1, N)) * spredning
    const base = pos.length / 3
    hjørner.forEach((h, k) => {
      pos.push(...h)
      const px = (k === 0 || k === 3 ? x0 : x1) + t.marg
      const py = (k === 0 || k === 1 ? y1 : y0) + t.marg
      uv.push((px * t.skala) / t.lerret.width, 1 - (py * t.skala) / t.lerret.height)
      start.push(...st)
      senter.push(sx, sy, sz)
      lokal.push(...lok[k])
      forsinkelse.push(forsink)
      fro.push(f)
      linjeNr.push(op.linje)
    })
    indekser.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
  geo.setAttribute("start", new THREE.Float32BufferAttribute(start, 3))
  geo.setAttribute("senter", new THREE.Float32BufferAttribute(senter, 3))
  geo.setAttribute("lokal", new THREE.Float32BufferAttribute(lokal, 2))
  geo.setAttribute("forsinkelse", new THREE.Float32BufferAttribute(forsinkelse, 1))
  geo.setAttribute("fro", new THREE.Float32BufferAttribute(fro, 1))
  geo.setAttribute("linjeNr", new THREE.Float32BufferAttribute(linjeNr, 1))
  geo.setIndex(indekser)
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      kart: { value: kart },
      uInn: { value: 0 },
      uUt: { value: 0 },
      uSkriv: { value: skriv ? 1 : 0 },
      uTidInn: { value: 0 },
      uOpasitet: { value: 1 },
      uTid: F.uTid,
      uAksent: F.uAksent,
    },
    vertexShader: ORD_VERTEX,
    fragmentShader: ORD_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  return {
    mesh,
    bredde: W,
    høyde: H,
    // Animasjonen: sekunder siden flaten skulle komme, og siden den skulle gå.
    sett(inn, ut, varighet = 1.6) {
      mat.uniforms.uInn.value = klem(inn / varighet, 0, 1)
      mat.uniforms.uUt.value = ut < 0 ? 0 : klem(ut / 1.3, 0, 1)
      mat.uniforms.uTidInn.value = Math.max(0, inn)
    },
    fjern() {
      geo.dispose()
      mat.dispose()
      kart.dispose()
    },
  }
}

/* ---------- Partikler: tekst og tall bygget av lys ---------- */

const PARTIKKEL_VERTEX = /* glsl */ `
  attribute vec3 start;
  attribute float fro;
  uniform float uInn;
  uniform float uUt;
  uniform float uTid;
  uniform float uSkala;
  uniform float uStr;
  varying float vA;
  varying float vE;
  void main() {
    float d = position.x * 0.012 + fro * 0.35;
    float e = clamp((uInn * 1.7 - d - 0.2) / 0.8, 0.0, 1.0);
    e = e * e * (3.0 - 2.0 * e);
    float r = 1.0 - e;
    float vri = r * 5.0 + fro;
    vec3 s = start;
    vec3 sv = vec3(s.x * cos(vri) - s.z * sin(vri), s.y + sin(uTid + fro * 9.0) * 3.0 * r, s.x * sin(vri) + s.z * cos(vri));
    vec3 p = mix(sv, position, e);
    float u = clamp(uUt * 1.4 - fro * 0.4, 0.0, 1.0);
    float a = u * 7.0 + fro * 6.28;
    p += vec3(cos(a) * u * 40.0, u * u * 30.0 * (fro - 0.3), sin(a) * u * 40.0);
    p += vec3(0.0, 0.0, sin(uTid * 1.3 + position.x * 0.2) * 0.12 * e);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uStr * uSkala / max(-mv.z, 1.0) * (1.0 + r * 1.5);
    vA = (0.25 + e * 0.75) * (1.0 - u) * smoothstep(0.0, 0.15, uInn);
    vE = e;
  }
`
const PARTIKKEL_FRAGMENT = /* glsl */ `
  uniform vec3 uFarge;
  uniform vec3 uAksent;
  uniform float uLys;
  varying float vA;
  varying float vE;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.15, r);
    vec3 c = mix(uAksent * 1.6, uFarge, vE) * uLys;
    gl_FragColor = vec4(c * a * vA, 1.0);
  }
`

function partikler(tekst, grunn, bredde, valg = {}) {
  const { steg = 4, farge = "#ffffff", lys = 0.85, størrelse = 0.13, F, spredning = 1 } = valg
  const { punkter, bredde: pw, høyde: ph } = partikkelpunkter(tekst, grunn, bredde, steg)
  const n = punkter.length / 2
  const pos = new Float32Array(n * 3)
  const start = new Float32Array(n * 3)
  const fro = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (punkter[i * 2] - pw / 2) * E
    const y = (ph / 2 - punkter[i * 2 + 1]) * E
    pos[i * 3] = x
    pos[i * 3 + 1] = y
    const f = Math.abs(Math.sin(i * 91.7) * 43758.5453) % 1
    fro[i] = f
    const a = f * Math.PI * 2 * 3
    const R = (20 + f * 50) * spredning
    start[i * 3] = Math.cos(a) * R
    start[i * 3 + 1] = (f - 0.5) * 40 * spredning
    start[i * 3 + 2] = Math.sin(a) * R - 20
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  geo.setAttribute("start", new THREE.BufferAttribute(start, 3))
  geo.setAttribute("fro", new THREE.BufferAttribute(fro, 1))
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uInn: { value: 0 },
      uUt: { value: 0 },
      uTid: F.uTid,
      uSkala: F.uSkala,
      uStr: { value: størrelse },
      uFarge: { value: new THREE.Color(farge) },
      uAksent: F.uAksent,
      uLys: { value: lys },
    },
    vertexShader: PARTIKKEL_VERTEX,
    fragmentShader: PARTIKKEL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const p = new THREE.Points(geo, mat)
  p.frustumCulled = false
  return {
    mesh: p,
    bredde: pw * E,
    høyde: ph * E,
    sett(inn, ut, varighet = 2.4) {
      mat.uniforms.uInn.value = klem(inn / varighet, 0, 1)
      mat.uniforms.uUt.value = ut < 0 ? 0 : klem(ut / 1.6, 0, 1)
    },
    fjern() {
      geo.dispose()
      mat.dispose()
    },
  }
}

/* ---------- Små byggeklosser i rommet ---------- */

function lysmat(farge, opasitet = 0.8) {
  return new THREE.MeshBasicMaterial({
    color: farge,
    transparent: true,
    opacity: opasitet,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
}

function strekmat(farge, opasitet = 0.7) {
  return new THREE.LineBasicMaterial({
    color: farge,
    transparent: true,
    opacity: opasitet,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
}

function linje(punkter, farge, opasitet) {
  const g = new THREE.BufferGeometry().setFromPoints(punkter)
  return new THREE.Line(g, strekmat(farge, opasitet))
}

function node(r, farge) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), lysmat(farge, 0.85)))
  g.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(r * 1.7, 0)),
      strekmat(farge, 0.6),
    ),
  )
  return g
}

function ring(r, farge, opasitet = 0.5, n = 96) {
  const pk = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    pk.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0))
  }
  return linje(pk, farge, opasitet)
}

/* Deler løpene i setninger, med stilene i behold. */
function setninger(løp) {
  const ut = [[]]
  for (const l of løp) {
    const biter = l.t.split(/(?<=[.!?])\s+(?=[A-ZÆØÅ«0-9<])/)
    biter.forEach((b, i) => {
      if (i > 0) ut.push([])
      if (b) ut[ut.length - 1].push({ t: i < biter.length - 1 ? b : b, s: l.s })
    })
  }
  return ut.filter((s) => ren(s).trim())
}

const tallFra = (tekst) => {
  const m = /(\d+(?:[,.]\d+)?)\s*(kB|MB)/.exec(tekst)
  if (!m) return null
  const v = Number(m[1].replace(",", "."))
  return { verdi: m[2] === "MB" ? v * 1024 : v, tekst: `${m[1]} ${m[2]}` }
}

const STIL_FOR = { ingress: "ingress", dempet: "dempet", merke: "merke", tittel: "leder" }

/* ---------- Formene ---------- */

/*
 * Bygger formen til en scene. ctx har F (felles uniformer), smal (stående
 * skjerm), modus (hvordan ordene kommer) og lagGraf.
 */
export function lagForm(punkt, ctx) {
  const { F } = ctx
  const tekst = new THREE.Group()
  const rom = new THREE.Group()
  const deler = []
  const animer = []
  const B = (n) => Math.round(n * (ctx.smal ? 0.5 : 1))
  const modus = ctx.modus
  let størrelse = { b: 20, h: 10 }

  const flate = (løp, grunn, bredde, valg = {}) => {
    const f = ordflate(løp, grunn, bredde, { modus, F, ...valg })
    tekst.add(f.mesh)
    deler.push(f)
    return f
  }

  const etikettOver = (y, x = 0, juster = "senter") => {
    if (!punkt.etikett) return 0
    const f = flate(punkt.etikett, stil("etikett"), B(1300), { modus: "skriv", juster })
    f.mesh.position.set(x, y + f.høyde / 2, 0.5)
    f.forsinkelse = 0
    return f.høyde
  }

  switch (punkt.form) {
    case "tittel": {
      const merke = punkt.blokker.filter((b) => b.type === "merke")
      const tittel = punkt.blokker.find((b) => b.type === "tittel")
      const stor = punkt.forside || tittel?.stor
      const grunn = stil("tittel", stor ? 1.25 : 1)
      const p = partikler(ren(tittel.løp), grunn, B(stor ? 1500 : 1400), {
        F,
        steg: 3,
        størrelse: 0.08,
        lys: 0.5,
      })
      rom.add(p.mesh)
      deler.push(p)
      p.varighet = 2.6
      let h = p.høyde
      if (merke.length) {
        const m = flate(
          merke.flatMap((b, i) => (i ? [{ t: "  ·  ", s: "vanlig" }, ...b.løp] : b.løp)),
          stil("merke"),
          B(1500),
          { modus: "skriv" },
        )
        m.mesh.position.set(0, p.høyde / 2 + 1.4 + m.høyde / 2, 1)
        h += m.høyde + 1.4
      }
      if (punkt.kapittelNr) {
        // Kapittelnummeret står stort og svakt bak tittelen.
        const n = partikler(punkt.kapittelNr, stil("tall", 2.2), 1400, {
          F,
          steg: 7,
          størrelse: 0.22,
          lys: 0.35,
          spredning: 2.2,
        })
        n.mesh.position.set(0, 0, -16)
        n.varighet = 3.2
        rom.add(n.mesh)
        deler.push(n)
        const ringer = new THREE.Group()
        for (let i = 0; i < 3; i++) {
          const r = ring(14 + i * 5, i === 1 ? "#cde1f9" : "#6ff2d0", 0.35)
          r.rotation.set(1.1 + i * 0.3, i * 0.7, 0)
          ringer.add(r)
        }
        ringer.position.z = -16
        rom.add(ringer)
        animer.push((dt) => {
          ringer.children.forEach((r, i) => {
            r.rotation.z += dt * (0.15 + i * 0.07) * (i % 2 ? -1 : 1)
          })
        })
      }
      størrelse = { b: p.bredde, h }
      break
    }

    case "ord": {
      const b = punkt.blokker[punkt.blokker.length - 1]
      const sitat = punkt.sitat
      const navn = sitat ? "sitat" : STIL_FOR[b.type] ?? (b.type === "punkt" ? "kropp" : "avsnitt")
      const f = flate(b.løp, stil(navn), B(sitat ? 1300 : 1250), { kurve: sitat ? 0 : 70 })
      const h = etikettOver(f.høyde / 2 + 0.8)
      if (sitat) {
        // Et sitat får to lysende streker som rammer det inn oppe og nede.
        for (const y of [f.høyde / 2 + 1, -f.høyde / 2 - 1]) {
          const l = linje([new THREE.Vector3(-f.bredde / 2, y, 0), new THREE.Vector3(f.bredde / 2, y, 0)], "#6ff2d0", 0.8)
          l.scale.x = 0.001
          rom.add(l)
          animer.push((dt, inn) => {
            l.scale.x = Math.max(0.001, glatt(klem((inn - 0.2) / 1.2, 0, 1)))
          })
        }
      }
      størrelse = { b: f.bredde, h: f.høyde + h + (sitat ? 2 : 0) }
      break
    }

    case "setninger": {
      const b = punkt.blokker[0]
      const navn = STIL_FOR[b.type] ?? "avsnitt"
      const deler2 = setninger(b.løp)
      let y = 0
      let maksB = 0
      const flater = deler2.map((s, j) => {
        const f = flate(s, stil(navn), B(1150), { modus: j % 2 ? "dybde" : modus, spredning: 0.5 })
        f.forsinkelse = j * 0.9
        f.mesh.position.set((j % 2 ? 1.2 : -1.2) + j * 0.3, y - f.høyde / 2, -j * 2.6)
        y -= f.høyde + 0.9
        maksB = Math.max(maksB, f.bredde)
        return f
      })
      // Trappen sentreres i høyden.
      const total = -y
      for (const f of flater) f.mesh.position.y += total / 2
      const h = etikettOver(total / 2 + 0.4)
      // En lysende søm som går gjennom setningene, i den rekkefølgen de leses.
      const pk = flater.map((f) => new THREE.Vector3(-maksB / 2 - 1.5, f.mesh.position.y, f.mesh.position.z))
      if (pk.length > 1) rom.add(linje(pk, "#6ff2d0", 0.55))
      størrelse = { b: maksB + 4, h: total + h }
      break
    }

    case "utrop": {
      const l = flate(punkt.leder, stil(punkt.nr ? "leder" : "sitat", 0.95), B(1200), { juster: "venstre" })
      const k = flate(punkt.kropp, stil("kropp"), B(1100), {
        juster: "venstre",
        modus: modus === "venstre" ? "dybde" : "venstre",
        spredning: 0.5,
      })
      k.forsinkelse = 0.7
      const bredde = Math.max(l.bredde, k.bredde + 3)
      const total = l.høyde + 1.2 + k.høyde
      const x0 = -bredde / 2 + 1.5
      l.mesh.position.set(x0, total / 2 - l.høyde / 2, 2)
      k.mesh.position.set(x0 + 3, total / 2 - l.høyde - 1.2 - k.høyde / 2, -2)
      // Noden og streken som binder overskriften til forklaringen.
      const n = node(0.5, "#6ff2d0")
      n.position.set(x0 - 1.6, total / 2 - l.høyde / 2, 2)
      rom.add(n)
      rom.add(
        linje(
          [
            n.position.clone(),
            new THREE.Vector3(x0 - 1.6, k.mesh.position.y + k.høyde / 2 - 0.5, -2),
            new THREE.Vector3(x0 + 2.2, k.mesh.position.y + k.høyde / 2 - 0.5, -2),
          ],
          "#6ff2d0",
          0.6,
        ),
      )
      animer.push((dt, inn, t) => {
        n.rotation.y += dt
        n.scale.setScalar(glatt(klem(inn / 0.6, 0, 1)) * (1 + Math.sin(t * 3) * 0.08))
      })
      if (punkt.nr) {
        const tall = partikler(String(punkt.nr).padStart(2, "0"), stil("tall", 1.3), 1000, {
          F,
          steg: 6,
          størrelse: 0.2,
          lys: 0.3,
        })
        tall.mesh.position.set(x0 + tall.bredde / 2 - 3, 0, -12)
        tall.varighet = 2
        rom.add(tall.mesh)
        deler.push(tall)
      }
      etikettOver(total / 2 + 0.6, x0, "venstre")
      størrelse = { b: bredde + 4, h: total + 2 }
      break
    }

    case "konstellasjon": {
      const n = punkt.blokker.length
      const rx = ctx.smal ? 7 : 11
      const ry = ctx.smal ? 9 : 7
      const gruppe = new THREE.Group()
      gruppe.rotation.x = -0.32
      rom.add(gruppe)
      const posisjoner = []
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 - (i / n) * Math.PI * 2
        posisjoner.push(new THREE.Vector3(Math.cos(a) * rx, Math.sin(a) * ry, 0))
      }
      gruppe.add(linje([...posisjoner, posisjoner[0]], "#6ff2d0", 0.35))
      const kjerne = node(0.9, "#cde1f9")
      gruppe.add(kjerne)
      for (const p of posisjoner) gruppe.add(linje([new THREE.Vector3(), p], "#6ff2d0", 0.15))
      const noder = posisjoner.map((p) => {
        const nd = node(0.45, "#6ff2d0")
        nd.position.copy(p)
        nd.scale.setScalar(0.001)
        gruppe.add(nd)
        return nd
      })
      const labeler = punkt.blokker.map((b, i) => {
        const løp = b.nr && b.liste === "kapittel" ? [{ t: `${String(b.nr).padStart(2, "0")}  `, s: "merke" }, ...b.løp] : b.løp
        const p = posisjoner[i]
        const venstre = p.x < -0.5
        const midt = Math.abs(p.x) <= 0.5
        const f = flate(løp, stil("node"), B(620), {
          juster: midt ? "senter" : venstre ? "høyre" : "venstre",
          modus: "skriv",
        })
        const v = p.clone().applyEuler(gruppe.rotation)
        f.mesh.position.set(v.x + (midt ? 0 : venstre ? -1.3 : 1.3), v.y + (midt ? (p.y > 0 ? 1.4 + f.høyde / 2 : -1.4 - f.høyde / 2) : 0), v.z)
        f.forsinkelse = 0.4 + i * 0.28
        return f
      })
      animer.push((dt, inn, t) => {
        kjerne.rotation.y += dt * 0.6
        noder.forEach((nd, i) => {
          const e = glatt(klem((inn - 0.4 - i * 0.28) / 0.4, 0, 1))
          nd.scale.setScalar(Math.max(0.001, e * (1 + Math.sin(t * 2 + i) * 0.1)))
          nd.rotation.y += dt
        })
        gruppe.rotation.z = Math.sin(t * 0.15) * 0.04
      })
      const maksL = Math.max(...labeler.map((l) => l.bredde))
      størrelse = { b: rx * 2 + maksL * 2 + 3, h: ry * 2 + 4 }
      break
    }

    case "satellitter": {
      const roller = punkt.blokker
      const n = roller.length
      const R = n === 1 ? 0 : ctx.smal ? 6 : 9
      const bane = new THREE.Group()
      bane.rotation.x = 1.15
      rom.add(bane)
      bane.add(ring(Math.max(R, 3), "#9ccff2", 0.35))
      const senter = node(0.8, "#cde1f9")
      rom.add(senter)
      const sat = roller.map((b, i) => {
        const farge = FARGE[b.art]
        const nd = node(0.75, farge)
        rom.add(nd)
        const g = { ...stil("etikett"), farge }
        const etikett = flate([{ t: b.rolle, s: "vanlig" }], g, B(700), { juster: "venstre", modus: "skriv" })
        const kropp = flate(b.løp, stil("kropp", 0.9), B(n === 1 ? 1100 : 700), { juster: "venstre" })
        etikett.forsinkelse = 0.3 + i * 0.5
        kropp.forsinkelse = 0.5 + i * 0.5
        return { nd, etikett, kropp, a0: Math.PI / 2 + (i / n) * Math.PI * 2 + 0.5 }
      })
      const v = new THREE.Vector3()
      const plasser = (t) => {
        for (const s of sat) {
          const a = s.a0 + t * 0.035
          // Rollene går rundt en sirkel som sees på skrå, og teksten står
          // alltid på utsiden av noden.
          v.set(Math.cos(a) * R * 1.4, Math.sin(a) * R * 0.9, -Math.sin(a) * R * 0.5)
          s.nd.position.copy(v)
          const høyre = v.x >= -0.5
          const x = v.x + (høyre ? 1.3 : -1.3 - Math.max(s.etikett.bredde, s.kropp.bredde))
          s.etikett.mesh.position.set(x, v.y + s.etikett.høyde / 2 + 0.2, v.z)
          s.kropp.mesh.position.set(x, v.y - s.kropp.høyde / 2, v.z)
        }
      }
      plasser(0)
      animer.push((dt, inn, t) => {
        plasser(t)
        senter.rotation.y += dt * 0.5
        for (const s of sat) s.nd.rotation.y += dt * 1.2
      })
      const maks = Math.max(...sat.map((s) => Math.max(s.etikett.bredde, s.kropp.bredde)))
      const maksH = Math.max(...sat.map((s) => s.etikett.høyde + s.kropp.høyde))
      størrelse = { b: R * 2.8 + maks * 2 + 3, h: R * 1.8 + maksH * 1.6 }
      break
    }

    case "kode": {
      const b = punkt.blokker[0]
      const f = flate(b.løp, stil("kode"), 1700, { modus: "skriv", kurve: 34, juster: "senter", skriv: true })
      f.varighet = 0.01
      const h = etikettOver(f.høyde / 2 + 0.6)
      // Båndet: to buede lysstreker over og under koden.
      for (const y of [f.høyde / 2 + 0.3, -f.høyde / 2 - 0.3]) {
        const pk = []
        for (let i = 0; i <= 40; i++) {
          const x = (i / 40 - 0.5) * (f.bredde + 3)
          pk.push(new THREE.Vector3(x, y, -(x * x) / 68))
        }
        rom.add(linje(pk, "#6ff2d0", 0.5))
      }
      const markør = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.8), lysmat("#6ff2d0", 0.9))
      rom.add(markør)
      const linjer = b.løp.map((l) => l.t).join("").split("\n").length
      animer.push((dt, inn, t) => {
        const ferdig = inn > linjer * 0.32 + 0.8
        markør.visible = Math.sin(t * 8) > 0 || !ferdig
        const lin = Math.min(linjer - 1, Math.max(0, Math.floor(inn / 0.32)))
        const y = f.høyde / 2 - (lin + 0.5) * (f.høyde / linjer)
        markør.position.set(ferdig ? f.bredde / 2 + 0.6 : -f.bredde / 2 + 0.4 + klem((inn - lin * 0.32) / 0.7, 0, 1) * f.bredde * 0.6, y, 0.2)
      })
      størrelse = { b: f.bredde + 3, h: f.høyde + h + 1 }
      break
    }

    case "tabell": {
      const rader = punkt.blokker[0].rader
      const hode = rader[0]
      const data = rader.slice(1)
      const tallkolonner = hode
        .map((_, c) => c)
        .filter((c) => c > 0 && data.filter((r) => r[c] && tallFra(ren(r[c]))).length >= 2)
      if (tallkolonner.length) {
        // Søyler: hver tallkolonne en farge, hver rad en gruppe.
        const FARGER = ["#6ff2d0", "#ffc27a", "#b78cff"]
        const maks = Math.max(...data.flatMap((r) => tallkolonner.map((c) => tallFra(ren(r[c] ?? []))?.verdi ?? 0)))
        const gruppeB = 9
        const søyleB = 2.2
        const H = 14
        const base = new THREE.Group()
        base.position.y = -6
        rom.add(base)
        const bredde = data.length * gruppeB
        base.add(linje([new THREE.Vector3(-bredde / 2, 0, 0), new THREE.Vector3(bredde / 2, 0, 0)], "#9ccff2", 0.6))
        for (let i = 1; i <= 4; i++)
          base.add(linje([new THREE.Vector3(-bredde / 2, (i * H) / 4, -2), new THREE.Vector3(bredde / 2, (i * H) / 4, -2)], "#9ccff2", 0.1))
        data.forEach((rad, r) => {
          const gx = (r - (data.length - 1) / 2) * gruppeB
          tallkolonner.forEach((c, k) => {
            const t = tallFra(ren(rad[c] ?? []))
            if (!t) return
            const h = Math.max(0.12, (t.verdi / maks) * H)
            const x = gx + (k - (tallkolonner.length - 1) / 2) * (søyleB + 0.6)
            const s = new THREE.Group()
            s.add(new THREE.Mesh(new THREE.BoxGeometry(søyleB, 1, søyleB), lysmat(FARGER[k], 0.18)))
            s.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(søyleB, 1, søyleB)), strekmat(FARGER[k], 0.95)))
            s.children.forEach((m) => {
              m.position.y = 0.5
            })
            s.position.set(x, 0, 0)
            s.scale.y = 0.001
            base.add(s)
            const verdi = flate([{ t: t.tekst, s: "sterk" }], stil("node", 0.9), 400, { modus: "skriv" })
            verdi.forsinkelse = 0.6 + r * 0.3 + k * 0.15
            animer.push((dt, inn) => {
              const e = glatt(klem((inn - 0.3 - r * 0.3 - k * 0.15) / 1.1, 0, 1))
              s.scale.y = Math.max(0.001, e * h)
              verdi.mesh.position.set(x, base.position.y + e * h + 0.9, 0.5)
            })
          })
          const navn = [rad[0], ...rad.filter((_, c) => c > 0 && !tallkolonner.includes(c))].filter((c) => c && ren(c).trim())
          const etikett = flate(
            navn.flatMap((c, i) => (i ? [{ t: "\n", s: "vanlig" }, ...c] : c.map((x) => ({ ...x, s: "sterk" })))),
            { ...stil("celle", 0.85), pre: true },
            900,
            { modus: "regn" },
          )
          etikett.mesh.position.set(gx, base.position.y - 1 - etikett.høyde / 2, 0.5)
          etikett.forsinkelse = 0.2 + r * 0.2
        })
        // Forklaringen: kolonnenavnene med fargen sin.
        const forkl = flate(
          tallkolonner.flatMap((c, k) => [
            { t: k ? "     ■ " : "■ ", s: "merke" },
            ...hode[c].map((x) => ({ ...x, s: "vanlig" })),
          ]),
          stil("etikett"),
          2000,
          { modus: "skriv" },
        )
        forkl.mesh.position.set(0, base.position.y + H + 2.4, 0)
        const h = etikettOver(base.position.y + H + 3.6)
        størrelse = { b: Math.max(bredde + 4, forkl.bredde), h: H + 10 + h }
      } else {
        // Et rutenett av celler som står i lag bakover i rommet.
        const kol = hode.length
        const KB = B(560)
        let y = 0
        let maksB = 0
        rader.forEach((rad, r) => {
          let radH = 0
          const celler = rad.map((celle, c) => {
            const g = r === 0 ? stil("etikett") : c === 0 ? { ...stil("celle"), vekt: 700, farge: FARGE.hvit } : stil("celle")
            const f = flate(celle, g, KB, { juster: "venstre", modus: r === 0 ? "skriv" : "eksplosjon", spredning: 0.3 })
            f.forsinkelse = r * 0.4 + c * 0.15
            radH = Math.max(radH, f.høyde)
            return f
          })
          celler.forEach((f, c) => {
            const x = (c - kol / 2) * KB * E * 1.04
            f.mesh.position.set(x, y - f.høyde / 2, -c * 1.8)
            maksB = Math.max(maksB, x + f.bredde)
          })
          y -= radH + 0.6
          rom.add(linje([new THREE.Vector3((-kol / 2) * KB * E, y + 0.3, 0), new THREE.Vector3((kol / 2) * KB * E, y + 0.3, -kol * 1.8)], "#6ff2d0", 0.25))
        })
        tekst.position.y = -y / 2
        rom.position.y = -y / 2
        etikettOver(0.6, (-kol / 2) * KB * E, "venstre")
        størrelse = { b: kol * KB * E * 1.05 + 2, h: -y + 2 }
      }
      break
    }

    case "tall": {
      const t = punkt.tall
      const p = partikler(t, stil("tall"), 900, { F, steg: 5, størrelse: 0.16, lys: 1.1, farge: "#6ff2d0" })
      p.mesh.position.set(-p.bredde / 2 - 1, 0, 0)
      rom.add(p.mesh)
      deler.push(p)
      const antall = Math.min(12, Math.max(1, Number.parseInt(t, 10) || 3))
      const baner = []
      for (let i = 0; i < antall; i++) {
        const nd = node(0.4, i % 2 ? "#cde1f9" : "#6ff2d0")
        rom.add(nd)
        baner.push(nd)
      }
      const k = flate(punkt.kropp, stil("kropp"), B(900), { juster: "venstre", modus: "venstre" })
      // Tallet og teksten sentreres sammen.
      const midt = (1.5 + k.bredde - p.bredde - 1) / 2
      p.mesh.position.x -= midt
      k.mesh.position.set(1.5 - midt, 0, 0)
      k.forsinkelse = 0.8
      const cx = -p.bredde / 2 - 1 - midt
      animer.push((dt, inn, tid) => {
        baner.forEach((nd, i) => {
          const a = tid * 0.6 + (i / antall) * Math.PI * 2
          const e = glatt(klem((inn - 0.5) / 1.2, 0, 1))
          nd.position.set(cx + Math.cos(a) * 6 * e, Math.sin(a) * 2.2 * e, Math.sin(a) * 4)
        })
      })
      størrelse = { b: p.bredde + k.bredde + 6, h: Math.max(p.høyde, k.høyde) + 2 }
      break
    }

    case "graf": {
      const [navn, kommando, linjen] = punkt.blokker
      const n = flate(navn.løp, stil("leder"), B(1300))
      const k = flate(kommando.løp, stil("kode", 0.9), 2000, { modus: "skriv", skriv: true })
      const l = flate(linjen.løp, stil("kropp"), B(1500), { modus: "regn" })
      k.forsinkelse = 0.4
      l.forsinkelse = 0.8
      let y = 9
      for (const f of [n, k, l]) {
        f.mesh.position.set(0, y - f.høyde / 2, 0.5)
        y -= f.høyde + 0.4
      }
      const g = ctx.lagGraf(punkt.graf)
      g.position.set(0, y - 9, -6)
      rom.add(g)
      animer.push((dt, inn, t) => {
        g.rotation.y = Math.sin(t * 0.2) * 0.35
        g.scale.setScalar(Math.max(0.001, glatt(klem((inn - 0.3) / 1.4, 0, 1))))
      })
      størrelse = { b: Math.max(n.bredde, k.bredde, l.bredde, 44), h: 9 - y + 20 }
      break
    }
  }

  let tid = 0
  return {
    tekst,
    rom,
    størrelse,
    /* inn: sekunder siden kameraet kom fram (negativt før), ut: siden det dro (-1 om det er her). */
    oppdater(dt, inn, ut) {
      tid += dt
      for (const d of deler) d.sett(inn - (d.forsinkelse ?? 0), ut, d.varighet)
      for (const a of animer) a(dt, inn, tid, ut)
      if (ut > 0) {
        const s = Math.max(0.001, 1 - glatt(klem(ut / 1.4, 0, 1)))
        for (const m of rom.children) if (!m.isPoints) m.scale.setScalar(s * (m.userData.s0 ?? (m.userData.s0 = m.scale.x)))
      }
    },
    fjern() {
      for (const d of deler) d.fjern()
      rom.traverse((o) => {
        o.geometry?.dispose?.()
        o.material?.dispose?.()
      })
    },
  }
}

export const MODUSLISTE = MODUSER

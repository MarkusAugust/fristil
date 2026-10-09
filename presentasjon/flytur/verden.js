/*
 * Verdenen: en by av data sett innenfra, bygget som en malstrøm.
 *
 * I tradisjonen fra Ghost in the Shell: mørke tårn med lysende kanter,
 * kretsbaner som pulserer, kolonner av tegn som faller, og skilt som henger
 * i lufta. Byen er en skål rundt en kjerne, og tre spiralarmer av lys
 * roterer rundt den. Scenene ligger på en spiral som går rundt kjernen og
 * nedover, så kameraet virvler inn mot midten gjennom hele presentasjonen.
 * Ved hver scene sirkler kameraet langsomt rundt innholdet, i en bane som
 * skifter fra scene til scene.
 *
 * Hvert kapittel er et eget distrikt med sin farge og sitt motiv, hentet fra
 * ikonet på kapittelforsiden: nettleservinduer, markup i en ramme, to kilder
 * som blir én, et DOM-tre, porter av klammer, stablede lag, pakker med vei
 * ut, og varseltrekanter for fellene.
 *
 * Verdenen er bygget av et frø, så den er den samme hver gang presentasjonen
 * åpnes. Det er bare musikken som skal være ny hver gang.
 */
import { lagForm, MODUSLISTE } from "./former.js"
import * as THREE from "./vendor/three-0.186.1.min.js"
import {
  EffectComposer,
  OutputPass,
  RenderPass,
  ShaderPass,
  UnrealBloomPass,
} from "./vendor/three-0.186.1.min.js"

/* ---------- Distriktene ---------- */

export const DISTRIKTER = [
  { navn: "Ankomst", farge: "#5fe8ff", taake: "#03141a" },
  { navn: "Plattformen", farge: "#46ffb0", taake: "#021a14" },
  { navn: "Markupen", farge: "#6fb8ff", taake: "#04111f" },
  { navn: "Tilgjengeligheten", farge: "#b78cff", taake: "#0c0a1e" },
  { navn: "DOM-en", farge: "#3dffd8", taake: "#021916" },
  { navn: "Typene", farge: "#9ccff2", taake: "#06121c" },
  { navn: "Kaskaden", farge: "#7dd3fc", taake: "#041420" },
  { navn: "Overtakelsen", farge: "#8affc1", taake: "#031a10" },
  { navn: "Fellene", farge: "#ffae42", taake: "#1a0a06" },
  { navn: "Fristil i bruk", farge: "#e4f6ff", taake: "#08141c" },
]

for (const d of DISTRIKTER) {
  d.fargeC = new THREE.Color(d.farge)
  d.taakeC = new THREE.Color(d.taake)
}

/* ---------- Tilfeldighet med frø ---------- */

function frø(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const tilf = frø(1995)
const mellom = (a, b) => a + (b - a) * tilf()
const velg = (liste) => liste[Math.floor(tilf() * liste.length)]

const klem = (x, a, b) => Math.min(b, Math.max(a, x))
const glatt = (k) => k * k * k * (k * (k * 6 - 15) + 10)

/* ---------- Felles uniformer ---------- */

const F = {
  uTid: { value: 0 },
  uTaakeFarge: { value: new THREE.Color("#03141a") },
  uTaakeTetthet: { value: 0.0042 },
  uPuls: { value: 0 },
  uAksent: { value: new THREE.Color("#5fe8ff") },
  uKamera: { value: new THREE.Vector3() },
  uSkala: { value: 600 },
}

const TAAKE_GLSL = /* glsl */ `
  uniform vec3 uTaakeFarge;
  uniform float uTaakeTetthet;
  float taake(float d) {
    float f = uTaakeTetthet * d;
    return 1.0 - exp(-f * f);
  }
`

/* ---------- Tegn ---------- */

// Halvbredde katakana, sifre og noen tegn, speilvendt som på skjermene i
// filmen. Fonten er den systemet har; mangler den katakana, blir det sifre
// og firkanter, og regnet virker likevel.
const GLYFER =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789<>/=:{}"

function glyfatlas() {
  const n = 8
  const cel = 64
  const lerret = document.createElement("canvas")
  lerret.width = lerret.height = n * cel
  const g = lerret.getContext("2d")
  g.fillStyle = "#000"
  g.fillRect(0, 0, lerret.width, lerret.height)
  g.fillStyle = "#fff"
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.font = `600 ${cel * 0.78}px ui-monospace, "MS Gothic", "Hiragino Kaku Gothic ProN", "Noto Sans Mono CJK JP", monospace`
  for (let i = 0; i < n * n; i++) {
    const x = (i % n) * cel + cel / 2
    const y = Math.floor(i / n) * cel + cel / 2
    g.save()
    g.translate(x, y)
    g.scale(-1, 1)
    g.fillText(GLYFER[i % GLYFER.length], 0, 2)
    g.restore()
  }
  const tekstur = new THREE.CanvasTexture(lerret)
  tekstur.colorSpace = THREE.NoColorSpace
  tekstur.minFilter = THREE.LinearMipmapLinearFilter
  tekstur.generateMipmaps = true
  return tekstur
}

function skilt(tekst, loddrett) {
  const lerret = document.createElement("canvas")
  const str = 96
  const tegn = [...tekst]
  lerret.width = loddrett ? str * 1.3 : str * tegn.length * 0.95 + str * 0.4
  lerret.height = loddrett ? str * tegn.length + str * 0.4 : str * 1.4
  const g = lerret.getContext("2d")
  g.fillStyle = "#fff"
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.font = `700 ${str * 0.82}px "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif`
  tegn.forEach((t, i) => {
    if (loddrett) g.fillText(t, lerret.width / 2, str * 0.7 + i * str)
    else g.fillText(t, str * 0.7 + i * str * 0.95, lerret.height / 2)
  })
  g.strokeStyle = "rgba(255,255,255,0.6)"
  g.lineWidth = 3
  g.strokeRect(4, 4, lerret.width - 8, lerret.height - 8)
  const tekstur = new THREE.CanvasTexture(lerret)
  return { tekstur, forhold: lerret.width / lerret.height }
}

/* ---------- Linjer ---------- */

class Strek {
  constructor() {
    this.p = []
  }
  linje(a, b) {
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z)
    return this
  }
  bane(punkter, lukket = false) {
    for (let i = 0; i < punkter.length - 1; i++)
      this.linje(punkter[i], punkter[i + 1])
    if (lukket) this.linje(punkter[punkter.length - 1], punkter[0])
    return this
  }
  ring(r, n = 64, y = 0) {
    const pk = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      pk.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
    }
    return this.bane(pk, true)
  }
  geometri() {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3))
    return g
  }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z)

function linjemateriale(farge, styrke = 1) {
  return new THREE.LineBasicMaterial({
    color: new THREE.Color(farge).multiplyScalar(styrke),
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true,
  })
}

function flatemateriale(farge, opasitet = 0.12) {
  return new THREE.MeshBasicMaterial({
    color: farge,
    transparent: true,
    opacity: opasitet,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  })
}

/* ---------- Motivene, ett per distrikt ---------- */

function nettleservindu(farge) {
  const g = new THREE.Group()
  const s = new Strek()
  const b = 12
  const h = 8
  s.bane([V(-b, -h, 0), V(b, -h, 0), V(b, h, 0), V(-b, h, 0)], true)
  s.linje(V(-b, h - 2.4, 0), V(b, h - 2.4, 0))
  for (const [y, l] of [
    [1.8, 14],
    [-1.4, 19],
    [-4.6, 10],
  ])
    s.linje(V(-b + 3, y, 0), V(-b + 3 + l, y, 0))
  for (let i = 0; i < 3; i++) {
    const r = new Strek().ring(0.55, 12)
    const m = new THREE.LineSegments(r.geometri(), linjemateriale(farge, 1.4))
    m.rotation.x = Math.PI / 2
    m.position.set(-b + 1.6 + i * 1.6, h - 1.2, 0)
    g.add(m)
  }
  g.add(new THREE.LineSegments(s.geometri(), linjemateriale(farge, 1.2)))
  const flate = new THREE.Mesh(
    new THREE.PlaneGeometry(b * 2, h * 2),
    flatemateriale(farge, 0.05),
  )
  g.add(flate)
  return g
}

function rammetMarkup(farge) {
  const g = new THREE.Group()
  const ytre = new THREE.EdgesGeometry(new THREE.BoxGeometry(16, 16, 16))
  const stiplet = new THREE.LineDashedMaterial({
    color: farge,
    dashSize: 1.4,
    gapSize: 1,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const ramme = new THREE.LineSegments(ytre, stiplet)
  ramme.computeLineDistances()
  g.add(ramme)
  const indre = new THREE.Mesh(
    new THREE.BoxGeometry(8, 8, 8),
    flatemateriale("#1362ae", 0.55),
  )
  g.add(indre)
  g.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(8, 8, 8)),
      linjemateriale("#cde1f9", 1.3),
    ),
  )
  g.userData.snurr = 0.18
  return g
}

function toKilder(farge) {
  const g = new THREE.Group()
  const kurve = (fra) =>
    new THREE.CubicBezierCurve3(fra, V(fra.x, 0, -2), V(0, 2, -6), V(0, -6, -14))
  const s = new Strek()
  for (const fra of [V(-14, 10, 6), V(14, 10, 6)])
    s.bane(kurve(fra).getPoints(40))
  s.linje(V(0, -6, -14), V(0, -18, -22))
  g.add(new THREE.LineSegments(s.geometri(), linjemateriale(farge, 1.3)))
  const node = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.2, 1),
    flatemateriale("#cde1f9", 0.5),
  )
  node.position.set(0, -6, -14)
  g.add(node)
  for (const x of [-14, 14]) {
    const k = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6),
      flatemateriale(farge, 0.6),
    )
    k.position.set(x, 10, 6)
    g.add(k)
  }
  return g
}

function domTre(farge) {
  const g = new THREE.Group()
  const s = new Strek()
  const noder = []
  const gren = (p, nivå, bredde) => {
    noder.push(p)
    if (nivå === 0) return
    const n = nivå > 2 ? 2 : 3
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + nivå
      const q = V(
        p.x + Math.cos(a) * bredde,
        p.y - 7,
        p.z + Math.sin(a) * bredde,
      )
      s.linje(p, V(p.x, p.y - 3.5, p.z))
      s.linje(V(p.x, p.y - 3.5, p.z), V(q.x, p.y - 3.5, q.z))
      s.linje(V(q.x, p.y - 3.5, q.z), q)
      gren(q, nivå - 1, bredde * 0.5)
    }
  }
  gren(V(0, 14, 0), 3, 16)
  g.add(new THREE.LineSegments(s.geometri(), linjemateriale(farge, 1.1)))
  const geo = new THREE.BoxGeometry(2.4, 1.6, 2.4)
  const mat = flatemateriale(farge, 0.45)
  for (const p of noder) {
    const m = new THREE.Mesh(geo, mat)
    m.position.copy(p)
    g.add(m)
  }
  g.userData.snurr = 0.06
  return g
}

function klammeport(farge) {
  const g = new THREE.Group()
  const s = new Strek()
  const klamme = (retning) => {
    const pk = []
    for (let i = 0; i <= 48; i++) {
      const v = i / 48
      const y = (v - 0.5) * 26
      const bølge = Math.abs(v - 0.5) < 0.05 ? (1 - Math.abs(v - 0.5) / 0.05) * 3 : 0
      const kurv = Math.cos((v - 0.5) * Math.PI) * 2
      pk.push(V(retning * (11 - kurv + bølge), y, 0))
    }
    return pk
  }
  s.bane(klamme(-1))
  s.bane(klamme(1))
  s.bane([V(-4, 0, 0), V(-1, -3, 0), V(5, 4, 0)])
  g.add(new THREE.LineSegments(s.geometri(), linjemateriale(farge, 1.4)))
  return g
}

function lagene(farge) {
  const g = new THREE.Group()
  const form = new THREE.Shape()
  form.moveTo(0, -12)
  form.lineTo(18, 0)
  form.lineTo(0, 12)
  form.lineTo(-18, 0)
  form.lineTo(0, -12)
  const geo = new THREE.ShapeGeometry(form)
  const kant = new THREE.EdgesGeometry(geo)
  for (let i = 0; i < 4; i++) {
    const lag = new THREE.Group()
    const topp = i === 3
    lag.add(
      new THREE.Mesh(
        geo,
        flatemateriale(topp ? "#1362ae" : farge, topp ? 0.5 : 0.08),
      ),
    )
    lag.add(
      new THREE.LineSegments(
        kant,
        linjemateriale(topp ? "#cde1f9" : farge, topp ? 1.4 : 0.8),
      ),
    )
    lag.rotation.x = -Math.PI / 2
    lag.position.y = i * 5
    lag.userData.grunn = i * 5
    g.add(lag)
  }
  g.userData.lag = true
  return g
}

function pakke(farge) {
  const g = new THREE.Group()
  const kasse = new THREE.EdgesGeometry(new THREE.BoxGeometry(14, 9, 14))
  const k = new THREE.LineSegments(kasse, linjemateriale(farge, 1.2))
  k.position.y = -4.5
  g.add(k)
  const lokk = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(16, 1.6, 16)),
    linjemateriale(farge, 1.2),
  )
  lokk.position.set(0, 3, 0)
  lokk.rotation.z = 0.25
  g.add(lokk)
  const stråle = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 3.6, 120, 24, 1, true),
    flatemateriale("#cde1f9", 0.16),
  )
  stråle.position.y = 60
  g.add(stråle)
  const pil = new Strek().bane([V(-4, 14, 0), V(0, 19, 0), V(4, 14, 0)])
  pil.linje(V(0, 19, 0), V(0, 2, 0))
  g.add(new THREE.LineSegments(pil.geometri(), linjemateriale("#cde1f9", 1.6)))
  return g
}

function varsel(farge) {
  const g = new THREE.Group()
  const s = new Strek()
  s.bane([V(0, 13, 0), V(14, -11, 0), V(-14, -11, 0)], true)
  s.linje(V(0, 6, 0), V(0, -3, 0))
  s.ring(0.8, 10, 0)
  const m = new THREE.LineSegments(s.geometri(), linjemateriale(farge, 1.6))
  g.add(m)
  const prikk = new THREE.Mesh(
    new THREE.CircleGeometry(1, 16),
    flatemateriale(farge, 0.9),
  )
  prikk.position.y = -6.5
  g.add(prikk)
  const flate = new THREE.Mesh(
    new THREE.CircleGeometry(16, 3),
    flatemateriale("#ff4a3a", 0.08),
  )
  flate.rotation.z = Math.PI / 2
  flate.position.y = -1.5
  g.add(flate)
  g.userData.flimmer = true
  return g
}

function kjerne(farge, r = 22) {
  const g = new THREE.Group()
  const kule = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(r, 3)),
    linjemateriale(farge, 0.55),
  )
  g.add(kule)
  const indre = new THREE.Mesh(
    new THREE.IcosahedronGeometry(r * 0.42, 2),
    flatemateriale(farge, 0.05),
  )
  g.add(indre)
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.LineSegments(
      new Strek().ring(r * (1.3 + i * 0.22), 128).geometri(),
      linjemateriale(i % 2 ? "#cde1f9" : farge, 1.2),
    )
    ring.rotation.set(mellom(-1, 1), mellom(-1, 1), mellom(-1, 1))
    ring.userData.akse = V(mellom(-1, 1), 1, mellom(-1, 1)).normalize()
    ring.userData.fart = mellom(0.1, 0.35) * (i % 2 ? -1 : 1)
    g.add(ring)
  }
  g.userData.kjerne = true
  return g
}

const MOTIVER = [
  (f) => kjerne(f),
  nettleservindu,
  rammetMarkup,
  toKilder,
  domTre,
  klammeport,
  lagene,
  pakke,
  varsel,
  (f) => kjerne(f, 26),
]

const hash2 = (a, b) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/* Linjer med lys som går langs dem. Fasen over 0,4 gir stiplet linje. */
function pulslinjer(pos, avstand, fase, farge) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute("avstand", new THREE.Float32BufferAttribute(avstand, 1))
  geo.setAttribute("fase", new THREE.Float32BufferAttribute(fase, 1))
  geo.setAttribute("farge", new THREE.Float32BufferAttribute(farge, 3))
  const mat = new THREE.ShaderMaterial({
    uniforms: F,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float avstand;
      attribute float fase;
      attribute vec3 farge;
      varying float vA;
      varying float vF;
      varying vec3 vFarge;
      void main() {
        vA = avstand; vF = fase; vFarge = farge;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTid;
      varying float vA;
      varying float vF;
      varying vec3 vFarge;
      void main() {
        if (vF > 0.4 && fract(vA * 0.12) > 0.55) discard;
        float puls = pow(fract(vA * 0.01 - uTid * 0.6 + vF), 14.0) * 2.5;
        gl_FragColor = vec4(vFarge * (0.6 + puls), 1.0);
      }
    `,
  })
  return new THREE.LineSegments(geo, mat)
}

export function lagVerden(lerret, punkter, valg = {}) {
  const redusert = valg.redusert ?? false
  const smal = () => innerWidth < innerHeight * 0.9

  const renderer = new THREE.WebGLRenderer({
    canvas: lerret,
    antialias: false,
    powerPreference: "high-performance",
  })
  let pikselforhold = Math.min(devicePixelRatio || 1, innerWidth <= 860 ? 1 : 1.5)
  renderer.setPixelRatio(pikselforhold)
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0

  const scene = new THREE.Scene()
  F.uTaakeTetthet.value = 0.0026
  scene.fog = new THREE.FogExp2(F.uTaakeFarge.value.clone(), 0.0026)
  scene.background = F.uTaakeFarge.value.clone()

  const kamera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.5, 1800)

  /* ---------- Virvelen ---------- */

  // Scenene ligger på en spiral som går rundt kjernen i midten av byen og
  // nedover mot den, som en malstrøm. Innenfor et lysbilde er stegene korte,
  // et nytt lysbilde er en lengre sving, og et nytt kapittel er et sprang
  // opp og rundt før dykket.
  const n = punkter.length
  const θ = []
  const R = []
  const Y = []
  const YB = []
  {
    let a = 0
    punkter.forEach((p, k) => {
      if (k > 0) a += p.forside ? 1.25 : p.nyttLysbilde ? 0.62 : 0.34
      const s = k / Math.max(1, n - 1)
      θ.push(a)
      R.push(330 - 255 * s ** 0.85)
      YB.push(30 + 120 * (1 - s) ** 1.1)
      Y.push(YB[k] + (p.forside ? 26 : 0) + Math.sin(k * 0.9) * 4)
    })
  }
  const startpunkt = V(Math.cos(θ[0] - 0.9) * (R[0] + 200), 260, Math.sin(θ[0] - 0.9) * (R[0] + 200))

  // Et punkt på spiralen for et flyttall mellom to scener. Under 0 er det
  // på vei inn fra startpunktet høyt over byen.
  const H = (u, mål = new THREE.Vector3()) => {
    if (u < 0) {
      const t = klem(u + 1, 0, 1)
      H(0, mål)
      return mål.lerp(startpunkt, 1 - glatt(t))
    }
    const a = Math.min(Math.floor(u), n - 1)
    const b = Math.min(a + 1, n - 1)
    const f = klem(u - a, 0, 1)
    const t = θ[a] + (θ[b] - θ[a]) * f
    const r = R[a] + (R[b] - R[a]) * f
    const y = Y[a] + (Y[b] - Y[a]) * f
    return mål.set(Math.cos(t) * r, y, Math.sin(t) * r)
  }

  // Ankeret er der innholdet står: litt foran og innenfor spiralen, så
  // kameraet ser innover mot kjernen med innholdet foran seg.
  const ankre = []
  const retninger = []
  const STILER = ["sving", "løft", "spiral", "dykk"]
  const banestil = []
  const ordmodus = []
  for (let k = 0; k < n; k++) {
    const P = H(k)
    const T = V(-Math.sin(θ[k]), 0, Math.cos(θ[k]))
    const I = V(-Math.cos(θ[k]), 0, -Math.sin(θ[k]))
    const A = P.clone().addScaledVector(T, 7).addScaledVector(I, 26)
    A.y += Math.sin(k * 1.7) * 3 - (punkter[k].forside ? 10 : 0)
    ankre.push(A)
    // Kameraet ser på skrå inn i virvelen, ikke rett mot kjernen, så byen
    // buer seg bort på den ene siden og kjernen lyser på den andre.
    retninger.push(V(0, 0, 0).addScaledVector(I, -0.55).addScaledVector(T, -0.8).add(V(0, 0.18, 0)).normalize())
    let st
    do st = velg(STILER)
    while (k > 0 && st === banestil[k - 1])
    banestil.push(st)
    let md
    do md = velg(MODUSLISTE)
    while (k > 0 && md === ordmodus[k - 1])
    ordmodus.push(md)
  }

  // Radius til scene, for å vite hvilket distrikt et sted i byen hører til
  // og hvor høyt kameraet flyr der.
  const sceneVedRadius = (r) => {
    let beste = 0
    for (let k = 0; k < n; k++) if (Math.abs(R[k] - r) < Math.abs(R[beste] - r)) beste = k
    return beste
  }
  const distriktVedRadius = (r) => punkter[sceneVedRadius(r)].distrikt
  const høydeVedRadius = (r) => {
    if (r > R[0] + 30) return 400
    if (r < R[n - 1] - 20) return YB[n - 1]
    return YB[sceneVedRadius(r)]
  }

  /* ---------- Bakken ---------- */

  const bakke = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 2600, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: { ...F, uRing: { value: -1 } },
      vertexShader: /* glsl */ `
        varying vec3 vVerden;
        void main() {
          vec4 v = modelMatrix * vec4(position, 1.0);
          vVerden = v.xyz;
          gl_Position = projectionMatrix * viewMatrix * v;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTid;
        uniform float uPuls;
        uniform float uRing;
        uniform vec3 uAksent;
        uniform vec3 uKamera;
        varying vec3 vVerden;
        ${TAAKE_GLSL}
        float strek(float q) {
          float g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
          return 1.0 - min(g, 1.0);
        }
        void main() {
          vec2 p = vVerden.xz;
          float r = length(p);
          float a = atan(p.y, p.x);
          // Ringer og eiker rundt kjernen, og et fint rutenett under.
          float ringer = strek(r / 30.0);
          float eiker = strek(a / 6.2831853 * 48.0) * smoothstep(20.0, 60.0, r);
          float fint = max(strek(p.x / 6.0), strek(p.y / 6.0)) * 0.25;
          float spiral = strek((a / 6.2831853) * 6.0 + log(r + 1.0) * 1.6 - uTid * 0.08) * 0.5;
          float d = length(vVerden - uKamera);
          float bolge = exp(-abs(r - uRing) * 0.12) * step(0.0, uRing) * max(0.0, 1.0 - uRing / 900.0);
          vec3 c = vec3(0.004, 0.012, 0.014);
          c += uAksent * (ringer * 0.6 + eiker * 0.35 + fint + spiral * 0.5) * (0.7 + uPuls * 0.5);
          c += uAksent * bolge * 2.0;
          gl_FragColor = vec4(mix(c, uTaakeFarge, taake(d)), 1.0);
        }
      `,
      extensions: { derivatives: true },
    }),
  )
  bakke.rotation.x = -Math.PI / 2
  scene.add(bakke)

  /* ---------- Tårnene ---------- */

  // Byen er en skål: høye tårn i en mur ytterst, og lavere jo nærmere
  // kjernen, alltid under spiralen kameraet flyr i.
  const tårnGeo = new THREE.BoxGeometry(1, 1, 1)
  tårnGeo.translate(0, 0.5, 0)
  const tårnMat = new THREE.ShaderMaterial({
    uniforms: F,
    vertexShader: /* glsl */ `
      varying vec3 vQ;
      varying vec3 vS;
      varying vec3 vN;
      varying vec3 vVerden;
      varying vec3 vFarge;
      varying float vFro;
      void main() {
        vec3 s = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vS = s;
        vQ = (position - vec3(0.0, 0.5, 0.0)) * s;
        vN = normal;
        vFarge = instanceColor;
        vFro = fract(instanceMatrix[3].x * 0.137 + instanceMatrix[3].z * 0.071);
        vec4 v = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vVerden = v.xyz;
        gl_Position = projectionMatrix * viewMatrix * v;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTid;
      uniform float uPuls;
      uniform vec3 uKamera;
      varying vec3 vQ;
      varying vec3 vS;
      varying vec3 vN;
      varying vec3 vVerden;
      varying vec3 vFarge;
      varying float vFro;
      ${TAAKE_GLSL}
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 a = abs(vN);
        vec3 h = vS * 0.5 - abs(vQ);
        float kant;
        vec2 flate;
        if (a.x > 0.5) { kant = min(h.y, h.z); flate = vQ.zy; }
        else if (a.y > 0.5) { kant = min(h.x, h.z); flate = vQ.xz; }
        else { kant = min(h.x, h.y); flate = vQ.xy; }
        float d = length(vVerden - uKamera);
        float bredde = 0.04 + d * 0.0012;
        float glo = smoothstep(bredde * 3.0, 0.0, kant);
        vec2 celle = floor(flate / vec2(1.4, 1.1));
        float vindu = step(0.82, hash(celle + vFro * 31.0)) * step(0.25, fract(flate.x / 1.4)) * step(0.3, fract(flate.y / 1.1));
        vindu *= 0.5 + 0.5 * sin(uTid * (0.4 + hash(celle) * 2.0) + hash(celle * 1.7) * 6.28);
        float skann = smoothstep(0.985, 1.0, fract(vVerden.y * 0.012 - uTid * 0.07 + vFro));
        vec3 c = vFarge * 0.025 + vec3(0.002, 0.006, 0.008);
        c += vFarge * glo * (0.7 + uPuls * 0.4);
        c += vFarge * vindu * 0.16 * (1.0 - a.y);
        c += vFarge * skann * 0.8;
        gl_FragColor = vec4(mix(c, uTaakeFarge, taake(d)), 1.0);
      }
    `,
  })
  const tårnListe = []
  for (let i = 0; i < 5200; i++) {
    const r = 60 + Math.sqrt(tilf()) * 600
    const a = tilf() * Math.PI * 2
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const b = mellom(4, 12) * (r > 380 ? 1.6 : 1)
    const d = mellom(4, 12) * (r > 380 ? 1.6 : 1)
    let h = Math.pow(tilf(), 2.2) * 110 + mellom(3, 14)
    if (r > 370) h = mellom(40, 190) * (0.6 + 0.4 * Math.sin(a * 7) ** 2)
    else h = Math.min(h, Math.max(2, høydeVedRadius(r) - 20))
    tårnListe.push({ x, z, b, d, h, distrikt: r > 370 ? 0 : distriktVedRadius(r) })
  }
  const tårn = new THREE.InstancedMesh(tårnGeo, tårnMat, tårnListe.length)
  {
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    tårnListe.forEach((t, i) => {
      m.makeScale(t.b, t.h, t.d)
      m.setPosition(t.x, 0, t.z)
      tårn.setMatrixAt(i, m)
      c.set(DISTRIKTER[t.distrikt].farge)
      if (tilf() < 0.12) c.lerp(new THREE.Color("#cde1f9"), 0.6)
      // Muren ytterst er mørkere, så den ikke blender når kameraet ser utover.
      if (t.h > 60) c.multiplyScalar(0.45)
      tårn.setColorAt(i, c)
    })
  }
  tårn.frustumCulled = false
  scene.add(tårn)

  /* ---------- Kretsbanene ---------- */

  // Buer og eiker på bakken og i lufta, med lys som går langs dem.
  {
    const pos = []
    const avstand = []
    const fase = []
    const farge = []
    const c = new THREE.Color()
    for (let i = 0; i < 320; i++) {
      let r = mellom(30, 560)
      let a = tilf() * Math.PI * 2
      const y = tilf() < 0.6 ? 0.1 : Math.min(høydeVedRadius(r) - 8, mellom(12, 90))
      c.set(DISTRIKTER[distriktVedRadius(r)].farge).multiplyScalar(0.45)
      let lengde = 0
      const legg = (p, q) => {
        pos.push(p.x, p.y, p.z, q.x, q.y, q.z)
        const l = p.distanceTo(q)
        avstand.push(lengde, lengde + l)
        lengde += l
        fase.push(0.2, 0.2)
        farge.push(c.r, c.g, c.b, c.r, c.g, c.b)
      }
      const punkt = (aa, rr) => V(Math.cos(aa) * rr, y, Math.sin(aa) * rr)
      for (let k = 0; k < 10; k++) {
        if (k % 2 === 0) {
          // En bue rundt kjernen, tegnet som korte stykker.
          const a1 = a + mellom(-0.5, 0.5)
          for (let s = 0; s < 8; s++) legg(punkt(a + ((a1 - a) * s) / 8, r), punkt(a + ((a1 - a) * (s + 1)) / 8, r))
          a = a1
        } else {
          // En eike inn mot kjernen eller ut fra den.
          const r1 = Math.max(25, r + mellom(-50, 50))
          legg(punkt(a, r), punkt(a, r1))
          r = r1
        }
      }
    }
    const baner = pulslinjer(pos, avstand, fase, farge)
    baner.frustumCulled = false
    scene.add(baner)
  }

  /* ---------- Tegnregnet ---------- */

  const regnFelt = 280
  const regn = (() => {
    const kolonner = 560
    const lengde = 22
    const antall = kolonner * lengde
    const pos = new Float32Array(antall * 3)
    const kol = new Float32Array(antall * 3)
    const data = new Float32Array(antall * 2)
    for (let c = 0; c < kolonner; c++) {
      const x = mellom(-regnFelt / 2, regnFelt / 2)
      const zz = mellom(-regnFelt / 2, regnFelt / 2)
      const f = tilf()
      for (let k = 0; k < lengde; k++) {
        const i = c * lengde + k
        kol[i * 3] = x
        kol[i * 3 + 1] = zz
        kol[i * 3 + 2] = f
        data[i * 2] = k
        data[i * 2 + 1] = tilf()
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    geo.setAttribute("kolonne", new THREE.BufferAttribute(kol, 3))
    geo.setAttribute("data", new THREE.BufferAttribute(data, 2))
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...F,
        uAtlas: { value: glyfatlas() },
        uSkala: { value: 600 },
        uFelt: { value: regnFelt },
        uFart: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 kolonne;
        attribute vec2 data;
        uniform float uTid;
        uniform float uSkala;
        uniform float uFelt;
        uniform float uFart;
        uniform vec3 uKamera;
        varying float vLys;
        varying float vGlyf;
        varying float vD;
        void main() {
          vec2 xz = mod(kolonne.xy - uKamera.xz + uFelt * 0.5, uFelt) - uFelt * 0.5 + uKamera.xz;
          float fart = (5.0 + kolonne.z * 14.0) * uFart;
          float hoyde = 130.0;
          float hode = 110.0 - mod(kolonne.z * 977.0 + uTid * fart, hoyde);
          float y = hode + data.x * 1.7;
          vec4 mv = modelViewMatrix * vec4(xz.x, y, xz.y, 1.0);
          vD = -mv.z;
          gl_Position = projectionMatrix * mv;
          float synlig = step(0.0, y) * step(y, 120.0);
          gl_PointSize = synlig * 1.7 * uSkala / max(-mv.z, 1.0);
          vLys = data.x < 0.5 ? 1.6 : (1.0 - data.x / 22.0);
          vGlyf = floor(mod(data.y * 64.0 + floor(uTid * (2.0 + data.y * 6.0) + kolonne.z * 40.0), 64.0));
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uAtlas;
        uniform vec3 uAksent;
        varying float vLys;
        varying float vGlyf;
        varying float vD;
        ${TAAKE_GLSL}
        void main() {
          vec2 celle = vec2(mod(vGlyf, 8.0), floor(vGlyf / 8.0));
          vec2 uv = (celle + vec2(gl_PointCoord.x, gl_PointCoord.y)) / 8.0;
          float a = texture2D(uAtlas, uv).r;
          vec3 gronn = mix(vec3(0.22, 1.0, 0.55), uAksent, 0.35);
          vec3 c = mix(gronn, vec3(0.85, 1.0, 0.95), step(1.2, vLys)) * a * max(vLys, 0.0);
          c *= (1.0 - taake(vD * 0.9)) * 0.9;
          if (dot(c, c) < 0.00001) discard;
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    })
    const p = new THREE.Points(geo, mat)
    p.frustumCulled = false
    scene.add(p)
    return mat
  })()

  /* ---------- Støv ---------- */

  const støv = (() => {
    const antall = 1800
    const pos = new Float32Array(antall * 3)
    for (let i = 0; i < antall; i++) {
      pos[i * 3] = mellom(-90, 90)
      pos[i * 3 + 1] = mellom(0, 90)
      pos[i * 3 + 2] = mellom(-90, 90)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...F, uSkala: { value: 600 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform vec3 uKamera;
        uniform float uSkala;
        uniform float uTid;
        varying float vD;
        void main() {
          vec3 p = position;
          p.y += sin(uTid * 0.3 + position.x) * 2.0;
          p.xz = mod(p.xz - uKamera.xz + 90.0, 180.0) - 90.0 + uKamera.xz;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vD = -mv.z;
          gl_Position = projectionMatrix * mv;
          gl_PointSize = 0.22 * uSkala / max(-mv.z, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uAksent;
        varying float vD;
        ${TAAKE_GLSL}
        void main() {
          float r = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(uAksent * a * 0.9 * (1.0 - taake(vD)), 1.0);
        }
      `,
    })
    const p = new THREE.Points(geo, mat)
    p.frustumCulled = false
    scene.add(p)
    return mat
  })()


  /* ---------- Malstrømmen ---------- */

  // Tre spiralarmer av lys som roterer rundt kjernen, raskere jo nærmere
  // midten, og løfter seg i en trakt som følger kameraets vei ned.
  const virvel = (() => {
    const antall = 26000
    const data = new Float32Array(antall * 4)
    for (let i = 0; i < antall; i++) {
      const r0 = 45 + Math.pow(tilf(), 1.15) * 480
      const arm = i % 3
      const a0 = (arm / 3) * Math.PI * 2 + Math.log(r0) * 2.3 + (tilf() - 0.5) * 0.7
      data[i * 4] = r0
      data[i * 4 + 1] = a0
      data[i * 4 + 2] = tilf()
      data[i * 4 + 3] = tilf()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(antall * 3), 3))
    geo.setAttribute("data", new THREE.BufferAttribute(data, 4))
    const mat = new THREE.ShaderMaterial({
      uniforms: F,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec4 data;
        uniform float uTid;
        uniform float uSkala;
        uniform float uPuls;
        varying float vA;
        varying float vD;
        void main() {
          float r = data.x;
          float a = data.y + uTid * (6.0 / (r + 14.0) + 0.012);
          float y = 8.0 + pow(r / 330.0, 1.35) * 150.0 + (data.z - 0.5) * (6.0 + r * 0.06);
          vec4 mv = modelViewMatrix * vec4(cos(a) * r, y, sin(a) * r, 1.0);
          vD = -mv.z;
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(6.0, (0.35 + data.w * 0.5) * uSkala / max(-mv.z, 1.0));
          vA = (0.2 + data.w * 0.4) * (0.7 + uPuls * 0.4) * smoothstep(4.0, 30.0, -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uAksent;
        varying float vA;
        varying float vD;
        ${TAAKE_GLSL}
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(mix(uAksent, vec3(0.85, 1.0, 1.0), 0.35) * a * vA * (1.0 - taake(vD) * 0.7), 1.0);
        }
      `,
    })
    const p = new THREE.Points(geo, mat)
    p.frustumCulled = false
    scene.add(p)
    return p
  })()
  void virvel

  // Kjernen i midten: en kule av tråd, en lyssøyle og ringer som går rundt.
  const sentrum = new THREE.Group()
  {
    const k = kjerne("#cde1f9", 22)
    k.position.y = 46
    sentrum.add(k)
    const søyle = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 7, 900, 32, 1, true),
      flatemateriale("#9ccff2", 0.035),
    )
    søyle.position.y = 400
    sentrum.add(søyle)
    for (let i = 0; i < 7; i++) {
      const r = 60 + i * 55
      const ring = new THREE.LineSegments(
        new Strek().ring(r, 180).geometri(),
        linjemateriale(i % 2 ? "#6ff2d0" : "#9ccff2", 0.35),
      )
      ring.position.y = 6 + Math.pow(r / 330, 1.35) * 150
      ring.userData.fart = (0.02 + 0.03 / (i + 1)) * (i % 2 ? -1 : 1)
      sentrum.add(ring)
    }
    sentrum.userData.kjerne = k
    scene.add(sentrum)
  }


  /* ---------- Skiltene ---------- */

  const ORD = ["電脳", "情報網", "攻性防壁", "記憶", "義体", "外部記憶", "接続", "構造", "公安", "網", "電脳空間", "解析"]
  const skiltListe = []
  for (let i = 0; i < 80; i++) {
    const r = mellom(70, 460)
    const a = tilf() * Math.PI * 2
    const loddrett = tilf() < 0.6
    const { tekstur, forhold } = skilt(velg(ORD), loddrett)
    const h = loddrett ? mellom(22, 44) : mellom(8, 14)
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(h * forhold, h),
      new THREE.MeshBasicMaterial({
        map: tekstur,
        color: new THREE.Color(DISTRIKTER[distriktVedRadius(r)].farge),
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
      }),
    )
    m.position.set(Math.cos(a) * r, mellom(16, Math.max(20, høydeVedRadius(r) + 30)), Math.sin(a) * r)
    m.lookAt(0, m.position.y, 0)
    m.userData.fase = tilf() * 10
    skiltListe.push(m)
    scene.add(m)
  }

  /* ---------- Landemerkene ---------- */

  // Hvert kapittel har sitt motiv stort bak forsiden, og ekko av det rundt
  // spiralen ved hvert nytt lysbilde, så distriktet kjennes igjen i flukt.
  const motivListe = []
  const leggMotiv = (m, pos, skala) => {
    m.position.copy(pos)
    m.scale.setScalar(skala)
    if (!m.userData.kjerne && !m.userData.lag) m.lookAt(0, pos.y, 0)
    m.userData.fase = tilf() * 10
    m.userData.grunnY = pos.y
    motivListe.push(m)
    scene.add(m)
  }
  punkter.forEach((p, k) => {
    const farge = DISTRIKTER[p.distrikt].farge
    const lag = MOTIVER[p.distrikt]
    const P = H(k)
    const ut = V(Math.cos(θ[k]), 0, Math.sin(θ[k]))
    if (p.forside) {
      const q = ankre[k].clone().addScaledVector(ut, -55)
      q.y -= 14
      leggMotiv(lag(farge), q, 2.6)
    }
    if (p.nyttLysbilde && p.distrikt !== 0 && p.distrikt !== 9) {
      leggMotiv(lag(farge), P.clone().addScaledVector(ut, mellom(40, 70)).add(V(0, mellom(-6, 16), 0)), mellom(0.7, 1.2))
      leggMotiv(lag(farge), P.clone().addScaledVector(ut, -mellom(70, 110)).add(V(0, mellom(-20, 0), 0)), mellom(0.8, 1.3))
    }
    // Portene i typedistriktet står rundt selve spiralen, så kameraet
    // flyr gjennom dem.
    if (p.distrikt === 5 && p.nyttLysbilde && k < n - 1) {
      const q = H(k + 0.5)
      const ring = new THREE.LineSegments(new Strek().ring(16, 6).geometri().rotateX(Math.PI / 2), linjemateriale(farge, 1.2))
      ring.position.copy(q)
      ring.lookAt(H(k + 0.55))
      ring.userData.fase = k
      ring.userData.grunnY = q.y
      ring.userData.snurrZ = 0.25
      motivListe.push(ring)
      scene.add(ring)
    }
  })


  /* ---------- Formene ---------- */

  // Innholdet tegnes i en egen scene etter bloom, så det aldri blør ut og
  // aldri skjules av et tårn. Det som er en del av byen, som partikler,
  // noder og søyler, står i byen og lyser med den.
  const tekstScene = new THREE.Scene()
  const former = new Map()

  function hentForm(k) {
    let f = former.get(k)
    if (f) return f
    const form = lagForm(punkter[k], { F, smal: smal(), modus: ordmodus[k], lagGraf })
    form.tekst.position.copy(ankre[k])
    form.rom.position.copy(ankre[k])
    const q = new THREE.Object3D()
    q.position.copy(ankre[k])
    q.lookAt(ankre[k].clone().add(retninger[k]))
    form.tekst.quaternion.copy(q.quaternion)
    form.rom.quaternion.copy(q.quaternion)
    tekstScene.add(form.tekst)
    scene.add(form.rom)
    f = { form, k, qBase: q.quaternion.clone(), ankomst: Infinity, avreise: null }
    former.set(k, f)
    return f
  }

  function fjernForm(f) {
    tekstScene.remove(f.form.tekst)
    scene.remove(f.form.rom)
    f.form.fjern()
    former.delete(f.k)
  }

  // Hvor langt unna kameraet må stå for at formen fyller skjermen uten å
  // gå utenfor.
  function avstandFor(k) {
    const { b, h } = hentForm(k).form.størrelse
    const t = Math.tan((56 * Math.PI) / 360)
    return Math.max(16, b / 2 / (t * kamera.aspect * 0.8), h / 2 / (t * 0.78))
  }

  // Der kameraet står ved en scene: rundt ankeret i en langsom bane, med
  // en stil som skifter fra scene til scene.
  function hvilested(k, tA, mål = new THREE.Vector3()) {
    let yaw = 0
    let pitch = 0.04
    let d = avstandFor(k)
    const st = redusert ? "ingen" : banestil[k]
    if (st === "sving") yaw = 0.32 * Math.sin(tA * 0.12 + k)
    else if (st === "løft") {
      yaw = 0.08 * Math.sin(tA * 0.1)
      pitch = 0.08 + 0.16 * Math.sin(tA * 0.11)
    } else if (st === "spiral") {
      yaw = 0.26 * Math.sin(tA * 0.1)
      pitch = 0.04 + 0.13 * Math.cos(tA * 0.1)
    } else if (st === "dykk") {
      d *= 1.2 - 0.2 * glatt(klem(tA / 14, 0, 1))
      yaw = 0.12 * Math.sin(tA * 0.09)
    }
    const r = retninger[k].clone()
    r.applyAxisAngle(V(0, 1, 0), yaw)
    const side = V(0, 1, 0).cross(r).normalize()
    r.applyAxisAngle(side, -pitch)
    return mål.copy(ankre[k]).addScaledVector(r, d)
  }

  /* ---------- Avhengighetsgrafene ---------- */

  // Hvert designsystem fra lysbildet om node_modules blir en konstellasjon
  // under teksten sin. Lagene er som i lysbildet: rangen er lengste vei fra
  // appen, og alle grafene har samme målestokk.
  function lagGraf(sys) {
    const g = new THREE.Group()
    const antall = sys.n.length
    const rang = new Array(antall).fill(0)
    for (let runde = 0; runde < antall; runde++)
      for (const [a, b] of sys.e) if (rang[b] < rang[a] + 1 && rang[a] < antall) rang[b] = Math.min(antall, rang[a] + 1)
    const lagene = []
    sys.n.forEach((_, i) => (lagene[rang[i]] ??= []).push(i))
    const plass = []
    const DX = 7.2
    const DY = 2.8
    const bredde = (lagene.length - 1) * DX
    lagene.forEach((l, r) =>
      l.forEach((i, k) => {
        plass[i] = V(r * DX - bredde / 2, ((l.length - 1) / 2 - k) * DY, (hash2(i, r) - 0.5) * 6)
      }),
    )
    const FARGER = { system: "#6fb8ff", annen: "#f0b47a", grunn: "#7d8a99", app: "#ffffff" }
    for (let i = 0; i < antall; i++) {
      const [navn, , type, byte] = sys.n[i]
      const r = 0.38 + Math.cbrt(byte) / 190
      const farge = FARGER[type]
      const node =
        type === "grunn"
          ? new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(r * 2, r * 2, r * 2)), linjemateriale(farge, 1))
          : new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), flatemateriale(farge, type === "app" ? 0.9 : 0.75))
      node.position.copy(plass[i])
      g.add(node)
      const etikett = lagEtikett(navn, farge)
      etikett.position.copy(plass[i]).add(V(0, r + 0.75, 0))
      g.add(etikett)
    }
    const pos = []
    const avst = []
    const fase = []
    const farge = []
    const c = new THREE.Color()
    for (const [a, b, peer] of sys.e) {
      const p = plass[a]
      const q = plass[b]
      pos.push(p.x, p.y, p.z, q.x, q.y, q.z)
      const l = p.distanceTo(q)
      avst.push(0, l * 18)
      fase.push(peer ? 0.5 : 0.1, peer ? 0.5 : 0.1)
      c.set(peer ? "#b5cbee" : "#9ccff2").multiplyScalar(peer ? 0.45 : 0.9)
      farge.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
    g.add(pulslinjer(pos, avst, fase, farge))
    g.userData.graf = true
    return g
  }

  function lagEtikett(tekst, farge) {
    const l = document.createElement("canvas")
    const g = l.getContext("2d")
    const str = 40
    g.font = `500 ${str}px ui-monospace, Menlo, Consolas, monospace`
    l.width = Math.ceil(g.measureText(tekst).width + 24)
    l.height = str + 16
    g.font = `500 ${str}px ui-monospace, Menlo, Consolas, monospace`
    g.fillStyle = farge
    g.textBaseline = "middle"
    g.fillText(tekst, 12, l.height / 2)
    const t = new THREE.CanvasTexture(l)
    t.colorSpace = THREE.SRGBColorSpace
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.85, fog: true }),
    )
    const h = 0.62
    s.scale.set((h * l.width) / l.height, h, 1)
    return s
  }


  /* ---------- Etterbehandling ---------- */

  const komponist = new EffectComposer(renderer)
  komponist.addPass(new RenderPass(scene, kamera))
  const blomst = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.6, 0.2)
  komponist.addPass(blomst)
  const tekstPass = new RenderPass(tekstScene, kamera)
  tekstPass.clear = false
  tekstPass.clearDepth = true
  komponist.addPass(tekstPass)
  const skjerm = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTid: { value: 0 },
      uAberrasjon: { value: 0.004 },
      uOppl: { value: new THREE.Vector2(innerWidth, innerHeight) },
      uGlitch: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTid;
      uniform float uAberrasjon;
      uniform float uGlitch;
      uniform vec2 uOppl;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 uv = vUv;
        float band = floor(uv.y * 40.0 + floor(uTid * 18.0) * 7.0);
        uv.x += (hash(vec2(band, floor(uTid * 18.0))) - 0.5) * 0.04 * uGlitch * step(0.7, hash(vec2(band, 3.0)));
        vec2 c = uv - 0.5;
        float a = uAberrasjon * (0.4 + dot(c, c) * 4.0);
        vec3 f;
        f.r = texture2D(tDiffuse, uv + c * a).r;
        f.g = texture2D(tDiffuse, uv).g;
        f.b = texture2D(tDiffuse, uv - c * a).b;
        f *= 0.93 + 0.07 * sin(vUv.y * uOppl.y * 1.6);
        f *= mix(0.42, 1.0, smoothstep(0.82, 0.22, length(c * vec2(1.0, 0.85))));
        f += (hash(vUv * uOppl + fract(uTid) * 91.0) - 0.5) * 0.025;
        f = mix(f, f * vec3(0.9, 1.04, 1.0), 0.6);
        gl_FragColor = vec4(max(f, 0.0), 1.0);
      }
    `,
  })
  komponist.addPass(skjerm)
  komponist.addPass(new OutputPass())

  /* ---------- Flukten ---------- */

  // u er plassen på spiralen: -1 er høyt over byen før start, og scene k
  // ligger på u = k.
  let u = -1
  let fra = -1
  let til = -1
  let start = 0
  let varighet = 0
  let klokke = performance.now() / 1000
  let tid = 0
  let ringStart = -100
  let fart = 0
  const lyd = { puls: () => 0 }
  const forskyvFra = new THREE.Vector3()
  const blikkFra = new THREE.Vector3()
  const blikk = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  const tmp2 = new THREE.Vector3()
  const hvile = new THREE.Vector3()
  let fov = 56
  let rull = 0
  const farge = new THREE.Color(DISTRIKTER[0].farge)
  const taakeFarge = new THREE.Color(DISTRIKTER[0].taake)

  function flyTil(k, sekunder) {
    k = klem(k, 0, n - 1)
    const avstand = Math.abs(k - u)
    // Flukten begynner der kameraet er nå, også midt i en annen flukt.
    H(u, tmp)
    forskyvFra.copy(kamera.position).sub(tmp)
    blikkFra.copy(blikk)
    fra = u
    til = k
    start = tid
    const lang = punkter[k].forside ? 1 : 0
    varighet =
      redusert || avstand < 0.001 ? 0 : (sekunder ?? klem(1.9 + lang + 0.5 * Math.sqrt(avstand), 1.9, 5.5))
    if (varighet === 0) u = k
    const f = hentForm(k)
    f.avreise = null
    f.ankomst = tid + varighet * 0.6
    return varighet
  }

  const aktiv = () => Math.round(til)

  function oppdaterFormer(dt) {
    const a = aktiv()
    for (const f of former.values()) {
      if (f.k !== a && f.avreise === null) f.avreise = tid
      const inn = tid - f.ankomst
      const ut = f.avreise === null ? -1 : tid - f.avreise
      if (ut > 2.4) {
        fjernForm(f)
        continue
      }
      f.form.oppdater(dt, inn, ut)
      // Formen vender seg mest mot kameraet, men ikke helt, så dybden i den
      // synes når kameraet sirkler.
      tmp2.copy(kamera.position)
      const q = f.form.tekst.quaternion
      q.copy(f.qBase).slerp(kamera.quaternion, 0.7)
      f.form.rom.quaternion.copy(q)
    }
  }

  function oppdater() {
    const nå = performance.now() / 1000
    const dt = Math.min(nå - klokke, 0.25)
    klokke = nå
    tid += dt
    F.uTid.value = tid

    let e = 1
    let iFlukt = 0
    if (varighet > 0) {
      const k = klem((tid - start) / varighet, 0, 1)
      e = glatt(k)
      const forrige = u
      u = fra + (til - fra) * e
      fart = Math.abs(u - forrige) / Math.max(dt, 1e-4)
      iFlukt = Math.sin(e * Math.PI)
      if (k >= 1) varighet = 0
    } else fart *= 0.9
    const warp = klem(fart / 2.2, 0, 1)
    const framme = varighet === 0 || (tid - start) / varighet > 0.7

    // Posisjonen: spiralen, pluss det som skiller hvilestedene fra den, og
    // en sving opp og ut midt i flukten.
    if (til < 0) {
      kamera.position.copy(startpunkt)
      kamera.position.x += Math.sin(tid * 0.06) * 40
      kamera.position.z += Math.cos(tid * 0.06) * 40
      blikk.set(0, 40, 0)
    } else {
      const tA = tid - (former.get(til)?.ankomst ?? tid)
      hvilested(til, Math.max(0, tA), hvile)
      H(til, tmp)
      const forskyvTil = hvile.clone().sub(tmp)
      H(u, kamera.position)
      kamera.position.add(forskyvFra.clone().lerp(forskyvTil, e))
      const ut = V(Math.cos(θ[Math.round(klem(u, 0, n - 1))]), 0, Math.sin(θ[Math.round(klem(u, 0, n - 1))]))
      const sprang = Math.min(4, Math.abs(til - fra))
      kamera.position.y += iFlukt * (6 + sprang * 4)
      kamera.position.addScaledVector(ut, iFlukt * (8 + sprang * 3))
      // Blikket glir fra forrige innhold til det neste, og ser framover langs
      // spiralen midt i flukten.
      const be = glatt(klem((e - 0.15) / 0.75, 0, 1))
      blikk.copy(blikkFra).lerp(ankre[til], varighet === 0 ? 1 : be)
      H(u + 0.9, tmp)
      blikk.lerp(tmp, iFlukt * 0.45)
      if (!redusert) {
        kamera.position.y += Math.sin(tid * 0.47) * 0.25
      }
    }
    kamera.lookAt(blikk)
    // Kameraet legger seg inn i svingen rundt kjernen.
    const målRull = iFlukt * 0.32 + (redusert ? 0 : Math.sin(tid * 0.17) * 0.03)
    rull += (målRull - rull) * Math.min(1, dt * 3)
    kamera.rotateZ(rull)

    const nyFov = 56 + warp * 18
    if (Math.abs(nyFov - fov) > 0.01) {
      fov += (nyFov - fov) * Math.min(1, dt * 6)
      kamera.fov = fov
      kamera.updateProjectionMatrix()
    }
    F.uKamera.value.copy(kamera.position)

    const d = DISTRIKTER[punkter[klem(Math.round(u), 0, n - 1)].distrikt]
    farge.lerp(d.fargeC, Math.min(1, dt * 1.2))
    taakeFarge.lerp(d.taakeC, Math.min(1, dt * 1.2))
    F.uAksent.value.copy(farge)
    F.uTaakeFarge.value.copy(taakeFarge)
    scene.fog.color.copy(taakeFarge)
    scene.background.copy(taakeFarge)

    const puls = lyd.puls()
    F.uPuls.value = puls
    bakke.material.uniforms.uRing.value = (tid - ringStart) * 140

    const skala = renderer.domElement.height / (2 * Math.tan((fov * Math.PI) / 360))
    F.uSkala.value = skala
    regn.uniforms.uSkala.value = skala
    regn.uniforms.uFart.value = 1 + warp * 3
    støv.uniforms.uSkala.value = skala

    sentrum.userData.kjerne.rotation.y += dt * 0.08
    for (const r of sentrum.userData.kjerne.children)
      if (r.userData.akse) r.rotateOnAxis(r.userData.akse, r.userData.fart * dt)
    sentrum.userData.kjerne.children[1].scale.setScalar(1 + puls * 0.15)
    for (const r of sentrum.children) if (r.userData.fart) r.rotation.y += r.userData.fart * dt

    for (const m of motivListe) {
      const f = m.userData.fase
      m.position.y = m.userData.grunnY + Math.sin(tid * 0.6 + f) * 1.2
      if (m.userData.snurr) m.rotation.y += m.userData.snurr * dt
      if (m.userData.snurrZ) m.rotateZ(m.userData.snurrZ * dt)
      if (m.userData.kjerne) {
        m.rotation.y += dt * 0.08
        for (const r of m.children) if (r.userData.akse) r.rotateOnAxis(r.userData.akse, r.userData.fart * dt)
      }
      if (m.userData.lag)
        m.children.forEach((l, i) => {
          l.position.y = l.userData.grunn * (1 + 0.35 * Math.sin(tid * 0.5 + f)) + i * puls
        })
      if (m.userData.flimmer) m.visible = Math.sin(tid * 13 + f * 5) > -0.92 || Math.random() > 0.4
    }
    for (const s of skiltListe)
      s.material.opacity =
        0.42 + 0.18 * Math.sin(tid * 1.3 + s.userData.fase) + (Math.sin(tid * 31 + s.userData.fase * 7) > 0.96 ? -0.35 : 0)

    oppdaterFormer(dt)

    blomst.strength = 0.65 + puls * 0.3 + warp * 0.25
    skjerm.uniforms.uTid.value = tid
    skjerm.uniforms.uAberrasjon.value = 0.003 + warp * 0.03
    skjerm.uniforms.uGlitch.value = Math.max(0, warp - 0.75) * 2

    komponist.render()
    return { k: varighet ? (tid - start) / varighet : 1, warp, framme }
  }

  function størrelse() {
    const b = innerWidth
    const h = innerHeight
    kamera.aspect = b / h
    kamera.updateProjectionMatrix()
    renderer.setSize(b, h, false)
    komponist.setSize(b, h)
    komponist.setPixelRatio(pikselforhold)
    skjerm.uniforms.uOppl.value.set(b * pikselforhold, h * pikselforhold)
  }
  addEventListener("resize", størrelse)
  størrelse()

  // Blir bildene for trege, senkes oppløsningen litt om gangen.
  let måling = []
  function tilpass(dt) {
    måling.push(dt)
    if (måling.length < 90) return
    måling.sort((a, b) => a - b)
    const median = måling[45]
    måling = []
    if (median > 0.024 && pikselforhold > 0.6) {
      pikselforhold = Math.max(0.6, pikselforhold - 0.15)
      renderer.setPixelRatio(pikselforhold)
      størrelse()
    }
  }

  let forrigeBilde = performance.now()
  function løkke() {
    requestAnimationFrame(løkke)
    if (document.hidden) return
    const nå = performance.now()
    tilpass((nå - forrigeBilde) / 1000)
    forrigeBilde = nå
    valg.vedBilde?.(oppdater())
  }

  return {
    kamera,
    aktiv,
    flyTil,
    start: () => requestAnimationFrame(løkke),
    plasserUmiddelbart(k) {
      k = klem(k, 0, n - 1)
      u = fra = til = k
      varighet = 0
      const f = hentForm(k)
      f.ankomst = tid - 0.5
      hvilested(k, 0, kamera.position)
      H(k, tmp)
      forskyvFra.copy(kamera.position).sub(tmp)
      blikk.copy(ankre[k])
      blikkFra.copy(blikk)
    },
    ring() {
      ringStart = tid
    },
    koblLyd(l) {
      lyd.puls = l.puls
    },
  }
}

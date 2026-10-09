/*
 * Verdenen bak lysbildene.
 *
 * En by av data sett innenfra, i tradisjonen fra Ghost in the Shell: mørke
 * tårn med lysende kanter, kretsbaner som pulserer langs bakken, kolonner av
 * tegn som faller, og hologrammer som henger i lufta. Kameraet følger én
 * kurve gjennom hele byen, og hvert lysbilde er et stoppested på den.
 *
 * Hvert kapittel er et eget distrikt med sin farge og sitt motiv, hentet fra
 * ikonet på kapittelforsiden: nettleservinduer, markup i en ramme, to kilder
 * som blir én, et DOM-tre, porter av klammer, stablede lag, pakker med vei
 * ut, og varseltrekanter for fellene.
 *
 * Verdenen er bygget av et frø, så den er den samme hver gang presentasjonen
 * åpnes. Det er bare musikken som skal være ny hver gang.
 */
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

/* ---------- Verdenen ---------- */

export function lagVerden(lerret, punkter, valg = {}) {
  const redusert = valg.redusert ?? false
  const smal = () => innerWidth <= 860

  const renderer = new THREE.WebGLRenderer({
    canvas: lerret,
    antialias: false,
    powerPreference: "high-performance",
  })
  let pikselforhold = Math.min(devicePixelRatio || 1, smal() ? 1 : 1.5)
  renderer.setPixelRatio(pikselforhold)
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(F.uTaakeFarge.value.clone(), 0.0042)
  scene.background = F.uTaakeFarge.value.clone()

  const kamera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 900)

  /* ---------- Stoppestedene ---------- */

  // Hvert stoppested er et punkt på kurven kameraet følger. Innenfor et
  // lysbilde ligger de tett, et nytt lysbilde er et lengre stykke, og et
  // nytt kapittel er et langt sprang opp over byen.
  const n = punkter.length
  const stasjoner = []
  {
    let pos = V(0, 16, 0)
    let retning = 0
    punkter.forEach((p, i) => {
      if (i > 0) {
        const steg = p.forside ? 150 : p.nyttLysbilde ? 84 : 46
        retning = klem(retning * 0.55 + mellom(-0.5, 0.5), -0.65, 0.65)
        pos = pos.clone().add(V(Math.sin(retning) * steg, 0, -Math.cos(retning) * steg))
        pos.y = p.forside ? 34 : 15 + Math.sin(i * 0.7) * 3
      }
      stasjoner.push({ ...p, pos })
    })
  }
  // Teksten står mellom stoppestedet og det neste, rett foran kameraet.
  // Kameraet flyr gjennom den på vei videre, mens den løser seg opp.
  const AVSTAND = 26
  stasjoner.forEach((s, i) => {
    const neste = stasjoner[i + 1]?.pos ?? s.pos.clone().add(V(0, 0, -60))
    const r = neste.clone().sub(s.pos)
    r.y = 0
    r.normalize()
    s.blikk = r
    s.tvers = V(-r.z, 0, r.x)
    s.tekst = s.pos.clone().addScaledVector(r, AVSTAND)
    if (s.forside) s.tekst.y -= 3
    if (s.graf) s.tekst.y += 6.5
    s.fokus = s.graf ? s.tekst.clone().add(V(0, -6.5, 0)) : s.tekst.clone()
  })

  const s0 = stasjoner[0].pos
  const sist = stasjoner[n - 1].pos
  const kurvepunkter = [
    V(s0.x - 40, 130, s0.z + 220),
    ...stasjoner.map((s) => s.pos),
    V(sist.x, sist.y + 30, sist.z - 160),
  ]
  const kurve = new THREE.CatmullRomCurve3(kurvepunkter, false, "centripetal")
  const M = kurvepunkter.length - 1
  const punktPå = (u, mål = new THREE.Vector3()) =>
    kurve.getPoint(klem(u, 0, M) / M, mål)

  // Banen slått opp etter z, så byen kan holde den fri.
  const prøver = []
  for (let i = 0; i <= 6000; i++) prøver.push(kurve.getPoint(i / 6000))
  const baneVed = (zz) => {
    let lav = 0
    let høy = prøver.length - 1
    while (høy - lav > 1) {
      const m = (lav + høy) >> 1
      if (prøver[m].z > zz) lav = m
      else høy = m
    }
    return prøver[lav]
  }
  const distriktVed = (zz) => {
    let d = stasjoner[0].distrikt
    for (const s of stasjoner) {
      if (s.pos.z + 30 < zz) break
      d = s.distrikt
    }
    return d
  }
  const zStart = kurvepunkter[0].z + 120
  const zSlutt = kurvepunkter[kurvepunkter.length - 1].z - 260

  /* ---------- Bakken ---------- */

  const bakke = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: { ...F, uRing: { value: 0 } },
      transparent: false,
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
        float strek(vec2 p, float s) {
          vec2 q = p / s;
          vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
          return 1.0 - min(min(g.x, g.y), 1.0);
        }
        void main() {
          vec2 p = vVerden.xz;
          float stor = strek(p, 24.0);
          float liten = strek(p, 4.0) * 0.35;
          float d = length(vVerden - uKamera);
          float ring = exp(-abs(length(p - uKamera.xz) - uRing) * 0.18) * step(0.0, uRing);
          float skann = pow(0.5 + 0.5 * sin(p.y * 0.05 + uTid * 1.4), 12.0) * 0.5;
          vec3 c = vec3(0.004, 0.012, 0.014);
          c += uAksent * (stor * (0.55 + uPuls * 0.6) + liten * 0.4) * (0.6 + skann);
          c += uAksent * ring * 1.6 * max(0.0, 1.0 - uRing / 320.0);
          gl_FragColor = vec4(mix(c, uTaakeFarge, taake(d)), 1.0);
        }
      `,
      extensions: { derivatives: true },
    }),
  )
  bakke.rotation.x = -Math.PI / 2
  scene.add(bakke)

  /* ---------- Tårnene ---------- */

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
  for (let zz = zStart; zz > zSlutt; zz -= 9) {
    const bane = baneVed(zz)
    for (let k = 0; k < 7; k++) {
      const x = bane.x + mellom(-220, 220)
      const dz = zz + mellom(-4.5, 4.5)
      const dx = Math.abs(x - bane.x)
      const b = mellom(4, 13)
      const d = mellom(4, 13)
      let h = Math.pow(tilf(), 2.4) * 95 + mellom(3, 12)
      if (dx < 22 + b) h = Math.min(h, Math.max(1.5, bane.y - 12))
      else if (dx < 46) h = Math.min(h, bane.y + 14)
      tårnListe.push({ x, z: dz, b, d, h, distrikt: distriktVed(dz) })
    }
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
      tårn.setColorAt(i, c)
    })
  }
  tårn.frustumCulled = false
  scene.add(tårn)

  /* ---------- Kretsbanene ---------- */

  {
    const pos = []
    const avstand = []
    const fase = []
    const farge = []
    const c = new THREE.Color()
    for (let i = 0; i < 260; i++) {
      const zz = mellom(zStart, zSlutt)
      const bane = baneVed(zz)
      const høyde = tilf() < 0.55 ? 0.08 : mellom(18, 70)
      let p = V(bane.x + mellom(-200, 200), høyde, zz)
      let lengde = 0
      const f = tilf()
      c.set(DISTRIKTER[distriktVed(zz)].farge)
      for (let k = 0; k < 14; k++) {
        const steg = mellom(6, 34)
        const q = p.clone()
        if (k % 2) q.x += steg * (tilf() < 0.5 ? -1 : 1)
        else q.z -= steg
        pos.push(p.x, p.y, p.z, q.x, q.y, q.z)
        avstand.push(lengde, lengde + steg)
        lengde += steg
        fase.push(f, f)
        farge.push(c.r, c.g, c.b, c.r, c.g, c.b)
        p = q
      }
    }
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
        varying float vD;
        uniform vec3 uKamera;
        void main() {
          vA = avstand; vF = fase; vFarge = farge;
          vec4 v = modelMatrix * vec4(position, 1.0);
          vD = length(v.xyz - uKamera);
          gl_Position = projectionMatrix * viewMatrix * v;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTid;
        uniform float uPuls;
        varying float vA;
        varying float vF;
        varying vec3 vFarge;
        varying float vD;
        ${TAAKE_GLSL}
        void main() {
          float x = fract(vA * 0.006 - uTid * (0.12 + vF * 0.2) + vF * 7.0);
          float puls = pow(smoothstep(0.0, 1.0, x), 18.0) * 3.0;
          float x2 = fract(vA * 0.011 - uTid * (0.2 + vF * 0.1) + vF * 3.0);
          puls += pow(x2, 30.0) * 2.0;
          vec3 c = vFarge * (0.16 + puls + uPuls * 0.2);
          gl_FragColor = vec4(c * (1.0 - taake(vD)), 1.0);
        }
      `,
    })
    const baner = new THREE.LineSegments(geo, mat)
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

  /* ---------- Skiltene ---------- */

  const ORD = [
    "電脳",
    "情報網",
    "攻性防壁",
    "記憶",
    "義体",
    "外部記憶",
    "接続",
    "構造",
    "公安",
    "網",
    "電脳空間",
    "解析",
  ]
  const skiltListe = []
  for (let i = 0; i < 70; i++) {
    const zz = mellom(zStart - 100, zSlutt + 100)
    const bane = baneVed(zz)
    const side = tilf() < 0.5 ? -1 : 1
    const loddrett = tilf() < 0.6
    const { tekstur, forhold } = skilt(velg(ORD), loddrett)
    const h = loddrett ? mellom(18, 34) : mellom(7, 12)
    const farge = new THREE.Color(DISTRIKTER[distriktVed(zz)].farge)
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(h * forhold, h),
      new THREE.MeshBasicMaterial({
        map: tekstur,
        color: farge,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
      }),
    )
    m.position.set(bane.x + side * mellom(34, 110), mellom(14, 60), zz)
    m.lookAt(bane.x, m.position.y, zz + 60)
    m.userData.fase = tilf() * 10
    skiltListe.push(m)
    scene.add(m)
  }


  /* ---------- Landemerkene ---------- */

  // Hvert kapittel har et stort motiv bak forsiden, og ekko av det langs
  // sidene ved hvert nytt lysbilde, så distriktet kjennes igjen i flukt.
  const motivListe = []
  const leggMotiv = (m, pos, skala, mot) => {
    m.position.copy(pos)
    m.scale.setScalar(skala)
    if (!m.userData.kjerne && !m.userData.lag) m.lookAt(mot.x, pos.y, mot.z)
    m.userData.fase = tilf() * 10
    m.userData.grunnY = pos.y
    motivListe.push(m)
    scene.add(m)
  }
  stasjoner.forEach((s, i) => {
    const farge = DISTRIKTER[s.distrikt].farge
    const lag = MOTIVER[s.distrikt]
    if (s.forside || i === 0) {
      const p = s.pos.clone().addScaledVector(s.blikk, i === 0 ? 170 : 125)
      p.y = i === 0 ? 40 : 20
      leggMotiv(lag(farge), p, i === 0 ? 2.2 : 2.6, s.pos)
    }
    if (s.nyttLysbilde && s.distrikt !== 0 && s.distrikt !== 9) {
      for (const side of [-1, 1]) {
        const p = s.pos
          .clone()
          .addScaledVector(s.tvers, side * mellom(52, 84))
          .addScaledVector(s.blikk, mellom(20, 70))
        p.y = mellom(22, 46)
        leggMotiv(lag(farge), p, mellom(0.6, 1.1), s.pos)
      }
    }
  })
  {
    const s = stasjoner[n - 1]
    const p = s.pos.clone().addScaledVector(s.blikk, 150)
    p.y = 36
    leggMotiv(kjerne(DISTRIKTER[9].farge, 26), p, 2, s.pos)
  }
  // Portene i typedistriktet ligger rundt selve banen, så kameraet flyr
  // gjennom dem.
  stasjoner.forEach((s, i) => {
    if (s.distrikt !== 5 || i === n - 1 || !s.nyttLysbilde) return
    for (let k = 1; k <= 2; k++) {
      const p = punktPå(i + 1 + k / 3)
      const ring = new THREE.LineSegments(
        new Strek().ring(15, 6).geometri(),
        linjemateriale(DISTRIKTER[5].farge, 1.2),
      )
      ring.position.copy(p)
      ring.lookAt(punktPå(i + 1 + k / 3 + 0.05))
      ring.userData.fase = k
      ring.userData.grunnY = p.y
      ring.userData.snurrZ = 0.25
      motivListe.push(ring)
      scene.add(ring)
    }
  })

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

  stasjoner.forEach((s) => {
    if (!s.graf) return
    const g = lagGraf(s.graf)
    g.position.copy(s.tekst).addScaledVector(s.blikk, 10).add(V(0, -12.5, 0))
    g.lookAt(s.pos.x, g.position.y, s.pos.z)
    g.userData.fase = tilf() * 10
    g.userData.grunnY = g.position.y
    motivListe.push(g)
    scene.add(g)
  })

  /* ---------- Teksten ---------- */

  // Teksten tegnes i en egen scene etter bloom, så den aldri blør ut og
  // aldri skjules av et tårn.
  const tekstScene = new THREE.Scene()
  const tekstGeo = new THREE.PlaneGeometry(1, 1)
  const flater = new Map()
  const TEKSTBREDDE = 30
  const TEKSTHØYDE = 23

  function lagFlate(k) {
    const s = stasjoner[k]
    const t = valg.lagTekst(k)
    const kart = new THREE.CanvasTexture(t.lerret)
    kart.colorSpace = THREE.SRGBColorSpace
    kart.anisotropy = renderer.capabilities.getMaxAnisotropy()
    // Samme skriftstørrelse i rommet uansett hvor bredt lerretet er.
    let b = (t.lerret.width * TEKSTBREDDE) / 1600
    let h = b / t.forhold
    const maksH = t.lerret.width < 1600 ? TEKSTHØYDE * 1.6 : TEKSTHØYDE
    if (h > maksH) {
      h = maksH
      b = h * t.forhold
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        kart: { value: kart },
        uOpasitet: { value: 0 },
        uOppl: { value: 0 },
        uGlitch: { value: 0 },
        uTid: F.uTid,
        uAksent: F.uAksent,
        uCeller: { value: new THREE.Vector2(150, 150 / t.forhold) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D kart;
        uniform float uOpasitet;
        uniform float uOppl;
        uniform float uGlitch;
        uniform float uTid;
        uniform vec3 uAksent;
        uniform vec2 uCeller;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          vec2 uv = vUv;
          float rad = floor(uv.y * 48.0);
          float t = floor(uTid * 20.0);
          uv.x += (hash(vec2(rad, t)) - 0.5) * 0.05 * uGlitch * step(0.72, hash(vec2(rad, t * 0.37)));
          vec4 f = texture2D(kart, uv);
          float n = hash(floor(vUv * uCeller));
          if (n < uOppl) discard;
          float kant = 1.0 - smoothstep(uOppl, uOppl + 0.1, n);
          vec3 c = f.rgb + uAksent * kant * step(0.001, uOppl) * 2.0 * f.a;
          gl_FragColor = vec4(c, f.a * uOpasitet);
        }
      `,
    })
    const mesh = new THREE.Mesh(tekstGeo, mat)
    mesh.scale.set(b, h, 1)
    mesh.position.copy(s.tekst)
    mesh.lookAt(s.pos)
    tekstScene.add(mesh)
    t.tegn(0.15)
    const flate = { mesh, mat, kart, tekst: t, p: 0.15, høyde: h, bredde: b }
    flater.set(k, flate)
    return flate
  }

  function fjernFlate(k) {
    const f = flater.get(k)
    if (!f) return
    tekstScene.remove(f.mesh)
    f.mat.dispose()
    f.kart.dispose()
    flater.delete(k)
  }

  /* ---------- Etterbehandling ---------- */

  const komponist = new EffectComposer(renderer)
  komponist.addPass(new RenderPass(scene, kamera))
  const blomst = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    0.85,
    0.6,
    0.2,
  )
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
  komponist.addPass(blomst)
  const tekstPass = new RenderPass(tekstScene, kamera)
  tekstPass.clear = false
  tekstPass.clearDepth = true
  komponist.addPass(tekstPass)
  komponist.addPass(skjerm)
  komponist.addPass(new OutputPass())

  /* ---------- Flukten ---------- */

  // u er posisjonen på kurven: 0 er høyt over byen før start, og
  // stoppested k ligger på u = k + 1.
  let u = 0
  let fra = 0
  let til = 0
  let start = 0
  let varighet = 0
  let klokke = performance.now() / 1000
  let tid = 0
  let ringStart = -10
  let fart = 0
  const lyd = { puls: () => 0 }

  function flyTil(k, sekunder) {
    const mål = klem(k, 0, n - 1) + 1
    const avstand = Math.abs(mål - u)
    fra = u
    til = mål
    start = tid
    const lang = stasjoner[mål - 1].forside ? 0.9 : 0
    varighet =
      redusert || avstand < 0.001
        ? 0
        : (sekunder ?? klem(1.5 + lang + 0.45 * Math.sqrt(avstand), 1.5, 4.8))
    if (varighet === 0) u = mål
    return varighet
  }

  const aktiv = () => Math.round(til) - 1

  const blikk = new THREE.Vector3()
  const foran = new THREE.Vector3()
  const hvile = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const tangent2 = new THREE.Vector3()
  let fov = 62
  let rull = 0
  const farge = new THREE.Color(DISTRIKTER[0].farge)
  const taakeFarge = new THREE.Color(DISTRIKTER[0].taake)

  function fokusVed(uu, mål) {
    const s = uu - 1
    if (s <= 0) return mål.copy(stasjoner[0].fokus)
    const a = Math.min(Math.floor(s), n - 1)
    const b = Math.min(a + 1, n - 1)
    return mål.copy(stasjoner[a].fokus).lerp(stasjoner[b].fokus, glatt(klem(s - a, 0, 1)))
  }

  // Synsfeltet: teksten skal fylle omtrent 80 prosent av bredden også på
  // en stående telefon, og aldri gå ut over toppen og bunnen.
  function grunnFov() {
    const f = flater.get(aktiv())
    const b = f?.bredde ?? TEKSTBREDDE
    const h = (f?.høyde ?? 16) + (stasjoner[aktiv()]?.graf ? 26 : 0)
    const vannrett = 2 * Math.atan(b / 0.92 / (2 * AVSTAND * kamera.aspect))
    const loddrett = 2 * Math.atan(h / 0.84 / (2 * AVSTAND))
    return klem((Math.max(vannrett, loddrett) * 180) / Math.PI, 44, 118)
  }

  function oppdaterTekst(dt, framme, k) {
    const a = aktiv()
    if (a >= 0 && !flater.has(a)) lagFlate(a)
    else if (a + 1 < n && !flater.has(a + 1) && k > 0.2) lagFlate(a + 1)
    for (const [i, f] of flater) {
      const m = f.mat.uniforms
      let mål = 0
      let dekode = 0.15
      if (i === a) {
        mål = 1
        dekode = framme ? 1 : 0.25
        m.uOppl.value = Math.max(0, m.uOppl.value - dt * 1.6)
      } else if (i === a + 1) {
        mål = 0.14
        m.uOppl.value = Math.max(0, m.uOppl.value - dt)
      } else {
        mål = 1
        dekode = Math.min(f.p, 0.6)
        m.uOppl.value += dt / (redusert ? 0.3 : 1.1)
        if (m.uOppl.value >= 1) {
          fjernFlate(i)
          continue
        }
      }
      m.uOpasitet.value += (mål - m.uOpasitet.value) * Math.min(1, dt * 4)
      const steg = dt / (redusert ? 0.15 : 0.95)
      f.p = f.p < dekode ? Math.min(dekode, f.p + steg) : Math.max(dekode, f.p - steg * 2)
      if (f.tekst.tegn(f.p)) f.kart.needsUpdate = true
      m.uGlitch.value = (1 - f.p) * 0.7 + (i !== a ? m.uOppl.value : 0)
      f.mesh.renderOrder = -Math.round(f.mesh.position.distanceTo(kamera.position))
    }
  }

  function oppdater() {
    const nå = performance.now() / 1000
    const dt = Math.min(nå - klokke, 0.25)
    klokke = nå
    tid += dt
    F.uTid.value = tid

    let k = 1
    let iFlukt = 0
    if (varighet > 0) {
      k = klem((tid - start) / varighet, 0, 1)
      const forrige = u
      u = fra + (til - fra) * glatt(k)
      fart = Math.abs(u - forrige) / Math.max(dt, 1e-4)
      iFlukt = Math.sin(k * Math.PI)
      if (k >= 1) varighet = 0
    } else fart *= 0.9
    const warp = klem(fart / 1.6, 0, 1)
    const framme = k > 0.72

    punktPå(u, kamera.position)
    if (!redusert) {
      kamera.position.x += Math.sin(tid * 0.31) * 0.5
      kamera.position.y += Math.sin(tid * 0.47) * 0.35
    }
    if (til < 0.01) {
      kamera.position.x += Math.sin(tid * 0.05) * 30
      kamera.position.z += Math.cos(tid * 0.05) * 20
    }

    fokusVed(u, hvile)
    punktPå(u + 0.55, foran)
    foran.y -= 3
    blikk.copy(hvile).lerp(foran, Math.max(iFlukt * 0.8, warp * 0.7))
    kamera.lookAt(blikk)

    kurve.getTangent(klem(u / M, 0, 1), tangent)
    kurve.getTangent(klem((u + 0.3) / M, 0, 1), tangent2)
    const sving = klem((tangent2.x - tangent.x) * 4, -0.4, 0.4)
    rull += (-sving * Math.max(iFlukt, warp) - rull) * Math.min(1, dt * 3)
    kamera.rotateZ(rull)

    const nyFov = grunnFov() + warp * 16
    if (Math.abs(nyFov - fov) > 0.01) {
      fov += (nyFov - fov) * Math.min(1, dt * 6)
      kamera.fov = fov
      kamera.updateProjectionMatrix()
    }
    F.uKamera.value.copy(kamera.position)

    const d = DISTRIKTER[distriktVed(kamera.position.z - 20)]
    farge.lerp(d.fargeC, Math.min(1, dt * 1.2))
    taakeFarge.lerp(d.taakeC, Math.min(1, dt * 1.2))
    F.uAksent.value.copy(farge)
    F.uTaakeFarge.value.copy(taakeFarge)
    scene.fog.color.copy(taakeFarge)
    scene.background.copy(taakeFarge)

    const puls = lyd.puls()
    F.uPuls.value = puls
    bakke.position.set(
      Math.round(kamera.position.x / 24) * 24,
      0,
      Math.round(kamera.position.z / 24) * 24,
    )
    bakke.material.uniforms.uRing.value = (tid - ringStart) * 90

    const skala = renderer.domElement.height / (2 * Math.tan((fov * Math.PI) / 360))
    regn.uniforms.uSkala.value = skala
    regn.uniforms.uFart.value = 1 + warp * 3
    støv.uniforms.uSkala.value = skala

    for (const m of motivListe) {
      const f = m.userData.fase
      m.position.y = m.userData.grunnY + Math.sin(tid * 0.6 + f) * (m.userData.graf ? 0.4 : 1.2)
      if (m.userData.snurr) m.rotation.y += m.userData.snurr * dt
      if (m.userData.snurrZ) m.rotateZ(m.userData.snurrZ * dt)
      if (m.userData.kjerne) {
        m.rotation.y += dt * 0.08
        for (const r of m.children)
          if (r.userData.akse) r.rotateOnAxis(r.userData.akse, r.userData.fart * dt)
        m.children[1].scale.setScalar(1 + puls * 0.12)
      }
      if (m.userData.lag)
        m.children.forEach((l, i) => {
          l.position.y = l.userData.grunn * (1 + 0.35 * Math.sin(tid * 0.5 + f)) + i * puls
        })
      if (m.userData.flimmer)
        m.visible = Math.sin(tid * 13 + f * 5) > -0.92 || Math.random() > 0.4
    }
    for (const s of skiltListe) {
      s.material.opacity =
        0.42 + 0.18 * Math.sin(tid * 1.3 + s.userData.fase) +
        (Math.sin(tid * 31 + s.userData.fase * 7) > 0.96 ? -0.35 : 0)
    }

    oppdaterTekst(dt, framme, k)

    blomst.strength = 0.8 + puls * 0.3 + warp * 0.25
    skjerm.uniforms.uTid.value = tid
    skjerm.uniforms.uAberrasjon.value = 0.003 + warp * 0.03
    skjerm.uniforms.uGlitch.value = Math.max(0, warp - 0.75) * 2

    komponist.render()
    return { k, warp, framme }
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
    stasjoner,
    kamera,
    aktiv,
    flyTil,
    start: () => requestAnimationFrame(løkke),
    plasserUmiddelbart(k) {
      u = fra = til = klem(k, 0, n - 1) + 1
      varighet = 0
    },
    ring() {
      ringStart = tid
    },
    koblLyd(l) {
      lyd.puls = l.puls
    },
  }
}

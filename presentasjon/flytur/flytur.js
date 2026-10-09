/*
 * Flyturen: limet mellom teksten, byen og musikken.
 *
 * Teksten hentes fra lysbildene (innhold.js), og hvert stoppested blir et
 * sted i byen (verden.js). Autopiloten flyr videre når teksten har stått
 * lenge nok til å bli lest, regnet ut fra antall ord. Piltastene tar over
 * når som helst, og mellomrom setter autopiloten på pause.
 *
 * Instrumentpanelet er Datastar-signaler, og de oppdateres med den samme
 * sammenslåingen som en patch-signals fra serveren ville brukt.
 */
import { getPath, mergePatch } from "./vendor/datastar-1.0.4.js"
import { hentInnhold, klartekst, ordIPunkt, ren } from "./innhold.js"
import { lagMusikk } from "./lyd.js"
import { lagTekst } from "./tekst.js"
import { DISTRIKTER, lagVerden } from "./verden.js"

const rot = document.documentElement
const redusert = matchMedia("(prefers-reduced-motion: reduce)").matches
const opplest = document.getElementById("opplest")

let punkter
let antallLysbilder
let verden
try {
  ;({ punkter, antallLysbilder } = await hentInnhold())
  verden = lagVerden(document.getElementById("verden"), punkter, {
    redusert,
    vedBilde,
    lagTekst: (k) => lagTekst(punkter[k], innerWidth < innerHeight * 0.9),
  })
} catch (feil) {
  console.warn("Flyturen kunne ikke starte.", feil)
  rot.classList.add("flytur-feil")
}

let musikk = null
let startet = false
let gjeldende = -1
let framme = false
let nesteTid = Infinity
let oppholdNå = 1
let sistHud = 0

const opphold = (k) =>
  Math.min(24, Math.max(4.5, 2.6 + ordIPunkt(punkter[k]) * 0.36)) + (punkter[k].graf ? 3 : 0)

function musikken() {
  if (!musikk) {
    try {
      musikk = lagMusikk()
      verden.koblLyd(musikk)
    } catch (feil) {
      console.warn("Lyden kunne ikke startes.", feil)
    }
  }
  return musikk
}

function settLyd(på) {
  const m = musikken()
  if (!m) return
  m.slå(på)
  mergePatch({ lyd: på })
}

function gå(k, sekunder) {
  if (!verden) return
  k = Math.max(0, Math.min(k, punkter.length - 1))
  if (k === gjeldende) return
  const forrige = gjeldende
  gjeldende = k
  framme = false
  nesteTid = Infinity
  const tid = verden.flyTil(k, sekunder)
  const p = punkter[k]
  const nyttKapittel = forrige >= 0 && p.distrikt !== punkter[forrige]?.distrikt
  if (tid > 0) musikk?.flyr(tid, nyttKapittel, p.nyttLysbilde)
  if (nyttKapittel || forrige < 0) setTimeout(() => verden.ring(), tid * 850)
  history.replaceState(null, "", `#punkt-${k + 1}`)
  opplest.textContent = klartekst(p)
}

const lysbildeStart = (l) => punkter.findIndex((p) => p.lysbilde === l)

function start(medLyd) {
  if (startet || !verden) return
  startet = true
  rot.classList.add("flytur-i-gang")
  mergePatch({ startet: true, lyd: !!medLyd })
  if (medLyd) settLyd(true)
  gå(fraAdressen(), redusert ? 0 : 5.5)
  document.querySelector(".hud button")?.focus({ preventScroll: true })
}

function fraAdressen() {
  const punkt = /^#punkt-(\d+)$/.exec(location.hash)
  if (punkt) return Number(punkt[1]) - 1
  // Lenker til lysbildene virker også: de lander på lysbildets første punkt.
  const lysbilde = /^#lysbilde-(\d+)$/.exec(location.hash)
  if (lysbilde) return Math.max(0, lysbildeStart(Number(lysbilde[1]) - 1))
  return 0
}

function vedBilde({ warp, framme: kommetFram }) {
  const nå = performance.now()
  if (startet && kommetFram && !framme) {
    framme = true
    oppholdNå = opphold(gjeldende) * 1000
    nesteTid = nå + oppholdNå
    if (punkter[gjeldende].nyttLysbilde) musikk?.ankommet()
  }
  const auto = getPath("autopilot")
  if (startet && auto && framme && nå > nesteTid && gjeldende < punkter.length - 1)
    gå(gjeldende + 1)
  if (nå - sistHud < 160) return
  sistHud = nå
  const k = verden.kamera.position
  const i = Math.max(0, gjeldende)
  const p = punkter[i]
  const iLysbildet = punkter.filter((x) => x.lysbilde === p.lysbilde)
  const f = (x) => (x < 0 ? "−" : "+") + Math.abs(x).toFixed(1).padStart(6, "0")
  const fremdrift = framme && auto ? Math.min(1, 1 - (nesteTid - nå) / oppholdNå) : 0
  mergePatch({
    hud: {
      lysbilde: p.lysbilde + 1,
      sektor: String(p.lysbilde + 1).padStart(2, "0"),
      antall: String(antallLysbilder).padStart(2, "0"),
      punkt: `${iLysbildet.indexOf(p) + 1} / ${iLysbildet.length}`,
      distrikt: DISTRIKTER[p.distrikt].navn,
      koordinater: `X ${f(k.x)}  Y ${f(k.y)}  Z ${f(k.z)}`,
      fart: (warp * 9.9).toFixed(1),
      fremdrift: Math.round(fremdrift * 1000) / 10,
    },
  })
}

document.addEventListener("keydown", (e) => {
  if (!verden || e.altKey || e.ctrlKey || e.metaKey) return
  const påKontroll = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement
  if (påKontroll && (e.key === " " || e.key === "Enter")) return
  const tast = e.key
  const handlinger = {
    ArrowRight: () => gå(gjeldende + 1),
    ArrowDown: () => gå(gjeldende + 1),
    Enter: () => gå(gjeldende + 1),
    ArrowLeft: () => gå(gjeldende - 1),
    ArrowUp: () => gå(gjeldende - 1),
    PageDown: () => {
      const l = punkter[Math.max(0, gjeldende)].lysbilde
      const neste = lysbildeStart(l + 1)
      if (neste >= 0) gå(neste)
    },
    PageUp: () => {
      const p = punkter[Math.max(0, gjeldende)]
      gå(lysbildeStart(p.hode ? Math.max(0, p.lysbilde - 1) : p.lysbilde))
    },
    Home: () => gå(0),
    End: () => gå(punkter.length - 1),
    " ": () => mergePatch({ autopilot: !getPath("autopilot") }),
    m: () => settLyd(!getPath("lyd")),
    M: () => settLyd(!getPath("lyd")),
  }
  const h = handlinger[tast]
  if (!h) return
  e.preventDefault()
  if (!startet) {
    // Tastene starter flyturen uten lyd, slik «Uten lyd» gjør.
    start(tast === "m" || tast === "M")
    return
  }
  h()
  // Etter et manuelt hopp får teksten full lesetid før autopiloten går videre.
  if (tast !== " " && framme) nesteTid = performance.now() + opphold(gjeldende) * 1000
})

window.flytur = {
  start,
  lyd: settLyd,
  neste: () => gå(gjeldende + 1),
  forrige: () => gå(gjeldende - 1),
}

if (verden) {
  rot.classList.add("flytur")
  const tittel = punkter[0].blokker.find((b) => b.type === "tittel")
  mergePatch({ tittel: tittel ? ren(tittel.løp) : "", startet: false })
  verden.start()
  document.querySelector(".start-knapp")?.focus()
}

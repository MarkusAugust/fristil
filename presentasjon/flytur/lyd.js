/*
 * Musikken til flyturen.
 *
 * Alt lages i nettleseren mens det spilles, med Web Audio og ingen
 * lydfiler. Stilen er britisk ambient-techno fra tidlig nittitall: varme
 * flater i dur, kaskader av arpeggio, en lett svingende breakbeat og en
 * stemme som sveller opp baklengs. Ingen takt er skrevet på forhånd.
 *
 * At den ikke gjentar seg, er bygget inn på tre nivåer:
 *
 * - Harmonikken vandrer i en Markov-kjede over akkordene i tonearten, med
 *   ulik harmonisk rytme fra frase til frase, og modulerer jevnlig og ved
 *   hvert nytt kapittel.
 * - Hver frase på åtte takter får nye mønstre for trommer, bass og
 *   arpeggio, enten helt nye eller mutert fra de forrige, og hver takt
 *   endrer noen spøkelsesslag.
 * - Energien går som en tilfeldig vandring, og kapittelforsidene utløser
 *   et brudd, en oppbygging og et fall, så arrangementet følger
 *   presentasjonen.
 */

const TEMPO = 126

const AKKORDER = {
  I: { rot: 0, iv: [0, 4, 7, 11, 14] },
  ii: { rot: 2, iv: [0, 3, 7, 10, 14] },
  iii: { rot: 4, iv: [0, 3, 7, 10] },
  IV: { rot: 5, iv: [0, 4, 7, 11, 14] },
  V: { rot: 7, iv: [0, 5, 7, 10, 14] },
  vi: { rot: 9, iv: [0, 3, 7, 10, 14] },
  bVII: { rot: 10, iv: [0, 4, 7, 14] },
  iv: { rot: 5, iv: [0, 3, 7, 10] },
  bVI: { rot: 8, iv: [0, 4, 7, 11] },
}

const OVERGANGER = {
  I: { IV: 3, vi: 2.5, ii: 1.5, V: 1, bVII: 1, iii: 1 },
  ii: { V: 4, IV: 2, I: 1.5, iii: 1.5, bVII: 1 },
  iii: { vi: 4, IV: 4, ii: 2 },
  IV: { I: 3, V: 2, ii: 1.5, iv: 1, vi: 1.5, bVII: 1 },
  V: { I: 4, vi: 3, IV: 2, iii: 1 },
  vi: { IV: 3.5, ii: 2, V: 1.5, iii: 1.5, I: 1.5 },
  bVII: { I: 5, IV: 3, bVI: 2 },
  iv: { I: 7, bVII: 3 },
  bVI: { bVII: 6, IV: 4 },
}

const PENTATON = [0, 2, 4, 7, 9]
const VOKALER = {
  a: [800, 1150, 2900],
  o: [450, 800, 2830],
  u: [325, 700, 2530],
  e: [400, 1600, 2700],
}

const r = Math.random
const mellom = (a, b) => a + (b - a) * r()
const velg = (l) => l[Math.floor(r() * l.length)]
const sjanse = (p) => r() < p
const mtof = (m) => 440 * 2 ** ((m - 69) / 12)
const klem = (x, a, b) => Math.min(b, Math.max(a, x))

function vektet(tabell) {
  const sum = Object.values(tabell).reduce((a, b) => a + b, 0)
  let x = r() * sum
  for (const [k, v] of Object.entries(tabell)) {
    x -= v
    if (x <= 0) return k
  }
  return Object.keys(tabell)[0]
}

export function lagMusikk(gittKontekst) {
  const ctx =
    gittKontekst ?? new (window.AudioContext || window.webkitAudioContext)()
  const spb = 60 / TEMPO
  const s16 = spb / 4

  /* ---------- Lydkjeden ---------- */

  const master = ctx.createGain()
  master.gain.value = 0
  const kompressor = ctx.createDynamicsCompressor()
  kompressor.threshold.value = -18
  kompressor.ratio.value = 3
  kompressor.attack.value = 0.01
  kompressor.release.value = 0.2
  const analysator = ctx.createAnalyser()
  analysator.fftSize = 512
  kompressor.connect(master)
  master.connect(analysator)
  master.connect(ctx.destination)

  const sum = ctx.createGain()
  sum.gain.value = 0.85
  const varme = ctx.createBiquadFilter()
  varme.type = "lowshelf"
  varme.frequency.value = 180
  varme.gain.value = 2
  sum.connect(varme)
  varme.connect(kompressor)

  // Romklang fra syntetisert støy som dør ut.
  const klang = ctx.createConvolver()
  klang.buffer = (() => {
    const lengde = Math.floor(ctx.sampleRate * 4.2)
    const b = ctx.createBuffer(2, lengde, ctx.sampleRate)
    for (let k = 0; k < 2; k++) {
      const d = b.getChannelData(k)
      for (let i = 0; i < lengde; i++) {
        const t = i / lengde
        d[i] = (r() * 2 - 1) * (1 - t) ** 2.8 * (i < 600 ? i / 600 : 1)
      }
    }
    return b
  })()
  const klangInn = ctx.createGain()
  klangInn.gain.value = 0.9
  const klangUt = ctx.createGain()
  klangUt.gain.value = 0.55
  klangInn.connect(klang)
  klang.connect(klangUt)
  klangUt.connect(sum)

  // Ping-pong-ekko på punktert åttendedel.
  const ekkoInn = ctx.createGain()
  const ekkoV = ctx.createDelay(2)
  const ekkoH = ctx.createDelay(2)
  ekkoV.delayTime.value = spb * 0.75
  ekkoH.delayTime.value = spb * 0.75
  const ekkoTilbake = ctx.createGain()
  ekkoTilbake.gain.value = 0.42
  const ekkoFilter = ctx.createBiquadFilter()
  ekkoFilter.type = "lowpass"
  ekkoFilter.frequency.value = 3200
  const panV = ctx.createStereoPanner()
  panV.pan.value = -0.7
  const panH = ctx.createStereoPanner()
  panH.pan.value = 0.7
  ekkoInn.connect(ekkoV)
  ekkoV.connect(panV)
  ekkoV.connect(ekkoFilter)
  ekkoFilter.connect(ekkoH)
  ekkoH.connect(panH)
  ekkoH.connect(ekkoTilbake)
  ekkoTilbake.connect(ekkoV)
  const ekkoUt = ctx.createGain()
  ekkoUt.gain.value = 0.5
  panV.connect(ekkoUt)
  panH.connect(ekkoUt)
  ekkoUt.connect(sum)
  ekkoUt.connect(klangInn)

  // Det som dukker for basstromma, slik flatene puster i takt.
  const dukk = ctx.createGain()
  dukk.connect(sum)

  const buss = (mål, klangSend = 0, ekkoSend = 0) => {
    const g = ctx.createGain()
    g.gain.value = 0
    g.connect(mål)
    if (klangSend) {
      const k = ctx.createGain()
      k.gain.value = klangSend
      g.connect(k)
      k.connect(klangInn)
    }
    if (ekkoSend) {
      const e = ctx.createGain()
      e.gain.value = ekkoSend
      g.connect(e)
      e.connect(ekkoInn)
    }
    return g
  }

  const busser = {
    pad: buss(dukk, 0.7),
    vox: buss(sum, 1.1, 0.2),
    arp: buss(dukk, 0.35, 0.55),
    lead: buss(sum, 0.8, 0.45),
    bass: buss(sum, 0.04),
    trommer: buss(sum, 0.12),
    fx: buss(sum, 0.6, 0.3),
  }

  const padFilter = ctx.createBiquadFilter()
  padFilter.type = "lowpass"
  padFilter.Q.value = 0.8
  padFilter.frequency.value = 1200
  padFilter.connect(busser.pad)
  const padLfo = ctx.createOscillator()
  padLfo.frequency.value = 0.045
  const padLfoGain = ctx.createGain()
  padLfoGain.gain.value = 500
  padLfo.connect(padLfoGain)
  padLfoGain.connect(padFilter.frequency)
  padLfo.start()

  const støy = (() => {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1
    return b
  })()

  /* ---------- Instrumentene ---------- */

  function konvolutt(g, t, topp, a, h, rel) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(topp, t + a)
    g.gain.setValueAtTime(topp, t + a + h)
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + rel)
  }

  function støykilde(t, varighet) {
    const s = ctx.createBufferSource()
    s.buffer = støy
    s.loop = true
    s.start(t, r() * 1.5)
    s.stop(t + varighet + 0.05)
    return s
  }

  const kickTider = []
  const snareTider = []

  function kick(t, styrke) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(46, t + 0.09)
    g.gain.setValueAtTime(styrke, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42)
    o.connect(g)
    g.connect(busser.trommer)
    o.start(t)
    o.stop(t + 0.45)
    const klikk = støykilde(t, 0.015)
    const kf = ctx.createBiquadFilter()
    kf.type = "highpass"
    kf.frequency.value = 3000
    const kg = ctx.createGain()
    konvolutt(kg, t, styrke * 0.12, 0.001, 0, 0.012)
    klikk.connect(kf)
    kf.connect(kg)
    kg.connect(busser.trommer)
    dukk.gain.cancelScheduledValues(t)
    dukk.gain.setValueAtTime(0.5, t)
    dukk.gain.linearRampToValueAtTime(1, t + 0.28)
    kickTider.push(t)
  }

  function snare(t, styrke) {
    const s = støykilde(t, 0.25)
    const f = ctx.createBiquadFilter()
    f.type = "bandpass"
    f.frequency.value = 1900
    f.Q.value = 0.7
    const g = ctx.createGain()
    konvolutt(g, t, styrke * 0.5, 0.001, 0.01, 0.17)
    s.connect(f)
    f.connect(g)
    g.connect(busser.trommer)
    const o = ctx.createOscillator()
    o.type = "triangle"
    o.frequency.setValueAtTime(200, t)
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08)
    const og = ctx.createGain()
    konvolutt(og, t, styrke * 0.35, 0.001, 0, 0.1)
    o.connect(og)
    og.connect(busser.trommer)
    o.start(t)
    o.stop(t + 0.15)
    if (styrke > 0.5) snareTider.push(t)
  }

  function hihat(t, styrke, åpen) {
    const lengde = åpen ? 0.28 : mellom(0.025, 0.05)
    const s = støykilde(t, lengde)
    const f = ctx.createBiquadFilter()
    f.type = "highpass"
    f.frequency.value = åpen ? 6500 : 7800
    const g = ctx.createGain()
    konvolutt(g, t, styrke * 0.16, 0.001, 0, lengde)
    const p = ctx.createStereoPanner()
    p.pan.value = mellom(-0.3, 0.3)
    s.connect(f)
    f.connect(g)
    g.connect(p)
    p.connect(busser.trommer)
  }

  function rasle(t, styrke) {
    const s = støykilde(t, 0.08)
    const f = ctx.createBiquadFilter()
    f.type = "bandpass"
    f.frequency.value = 5200
    f.Q.value = 2.5
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(styrke * 0.12, t + 0.025)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
    const p = ctx.createStereoPanner()
    p.pan.value = 0.45
    s.connect(f)
    f.connect(g)
    g.connect(p)
    p.connect(busser.trommer)
  }

  function bass(t, note, lengde, styrke) {
    const f = mtof(note)
    const o = ctx.createOscillator()
    o.type = "sawtooth"
    o.frequency.value = f
    const sub = ctx.createOscillator()
    sub.type = "sine"
    sub.frequency.value = f
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.Q.value = 4
    filter.frequency.setValueAtTime(f * (3 + styrke * 6), t)
    filter.frequency.exponentialRampToValueAtTime(f * 1.5, t + lengde * 0.9)
    const g = ctx.createGain()
    konvolutt(g, t, 0.2 * styrke, 0.006, lengde * 0.6, lengde * 0.5)
    const sg = ctx.createGain()
    konvolutt(sg, t, 0.32 * styrke, 0.006, lengde * 0.6, lengde * 0.5)
    o.connect(filter)
    filter.connect(g)
    g.connect(busser.bass)
    sub.connect(sg)
    sg.connect(busser.bass)
    o.start(t)
    sub.start(t)
    o.stop(t + lengde * 1.2 + 0.05)
    sub.stop(t + lengde * 1.2 + 0.05)
  }

  function pad(noter, t, varighet) {
    const a = mellom(0.4, 1.4)
    const rel = mellom(1.4, 2.6)
    for (const n of noter) {
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.035, t + a)
      g.gain.setValueAtTime(0.035, t + varighet)
      g.gain.linearRampToValueAtTime(0.0001, t + varighet + rel)
      g.connect(padFilter)
      for (const d of [-9, 0, 9]) {
        const o = ctx.createOscillator()
        o.type = d === 0 ? "triangle" : "sawtooth"
        o.frequency.value = mtof(n)
        o.detune.value = d + mellom(-2, 2)
        o.connect(g)
        o.start(t)
        o.stop(t + varighet + rel + 0.1)
      }
    }
  }

  function pluck(t, note, styrke, lengde = 0.35) {
    const f = mtof(note)
    const bær = ctx.createOscillator()
    bær.type = "sine"
    bær.frequency.value = f
    const mod = ctx.createOscillator()
    mod.frequency.value = f * (velgFm === 3 ? 3 : 2)
    const mg = ctx.createGain()
    mg.gain.setValueAtTime(f * 2.2, t)
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.18)
    mod.connect(mg)
    mg.connect(bær.frequency)
    const g = ctx.createGain()
    konvolutt(g, t, 0.075 * styrke, 0.003, 0.01, lengde)
    const p = ctx.createStereoPanner()
    p.pan.value = Math.sin(t * 1.7) * 0.5
    bær.connect(g)
    g.connect(p)
    p.connect(busser.arp)
    bær.start(t)
    mod.start(t)
    bær.stop(t + lengde + 0.1)
    mod.stop(t + lengde + 0.1)
  }
  let velgFm = 2

  function klokke(t, note, lengde, styrke) {
    const f = mtof(note)
    const o = ctx.createOscillator()
    o.type = "sine"
    o.frequency.value = f
    const o2 = ctx.createOscillator()
    o2.type = "triangle"
    o2.frequency.value = f * 2.005
    const vib = ctx.createOscillator()
    vib.frequency.value = 5.2
    const vg = ctx.createGain()
    vg.gain.setValueAtTime(0, t)
    vg.gain.linearRampToValueAtTime(f * 0.006, t + lengde * 0.6)
    vib.connect(vg)
    vg.connect(o.frequency)
    const g = ctx.createGain()
    konvolutt(g, t, 0.11 * styrke, 0.01, lengde * 0.3, lengde + 0.6)
    const g2 = ctx.createGain()
    g2.gain.value = 0.25
    o.connect(g)
    o2.connect(g2)
    g2.connect(g)
    g.connect(busser.lead)
    for (const x of [o, o2, vib]) {
      x.start(t)
      x.stop(t + lengde * 1.3 + 0.8)
    }
  }

  // Stemmen: en sagtann gjennom tre formantfiltre, med en konvolutt som
  // sveller opp og kuttes brått, som et opptak spilt baklengs.
  function stemme(t, noter, varighet, baklengs, vokal1, vokal2) {
    const kilde = ctx.createGain()
    const ut = ctx.createGain()
    if (baklengs) {
      ut.gain.setValueAtTime(0.0001, t)
      ut.gain.exponentialRampToValueAtTime(0.16, t + varighet * 0.96)
      ut.gain.linearRampToValueAtTime(0.0001, t + varighet + 0.04)
    } else {
      ut.gain.setValueAtTime(0.0001, t)
      ut.gain.linearRampToValueAtTime(0.11, t + varighet * 0.3)
      ut.gain.linearRampToValueAtTime(0.0001, t + varighet + 0.8)
    }
    const slutt = t + varighet + 1
    const v1 = VOKALER[vokal1]
    const v2 = VOKALER[vokal2]
    for (let i = 0; i < 3; i++) {
      const f = ctx.createBiquadFilter()
      f.type = "bandpass"
      f.Q.value = 9
      f.frequency.setValueAtTime(v1[i], t)
      f.frequency.linearRampToValueAtTime(v2[i], t + varighet)
      const fg = ctx.createGain()
      fg.gain.value = [1, 0.6, 0.25][i]
      kilde.connect(f)
      f.connect(fg)
      fg.connect(ut)
    }
    ut.connect(busser.vox)
    const del = varighet / noter.length
    noter.forEach((n, i) => {
      for (const d of [-6, 6]) {
        const o = ctx.createOscillator()
        o.type = "sawtooth"
        o.frequency.value = mtof(n)
        o.detune.value = d
        const vib = ctx.createOscillator()
        vib.frequency.value = mellom(4.6, 5.6)
        const vg = ctx.createGain()
        vg.gain.value = 9
        vib.connect(vg)
        vg.connect(o.detune)
        const g = ctx.createGain()
        const t0 = t + i * del
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.linearRampToValueAtTime(0.5, t0 + 0.06)
        g.gain.setValueAtTime(0.5, t0 + del - 0.02)
        g.gain.linearRampToValueAtTime(0.0001, t0 + del + (i === noter.length - 1 ? 0.8 : 0.04))
        o.connect(g)
        g.connect(kilde)
        o.start(t0)
        vib.start(t0)
        o.stop(Math.min(slutt, t0 + del + 0.9))
        vib.stop(Math.min(slutt, t0 + del + 0.9))
      }
    })
  }

  function sus(t, varighet, styrke = 1, opp = true) {
    const s = støykilde(t, varighet + 0.2)
    const f = ctx.createBiquadFilter()
    f.type = "bandpass"
    f.Q.value = 1.4
    const lav = 280
    const høy = mellom(3200, 5200)
    f.frequency.setValueAtTime(opp ? lav : høy, t)
    f.frequency.exponentialRampToValueAtTime(opp ? høy : lav, t + varighet * 0.55)
    f.frequency.exponentialRampToValueAtTime(opp ? 600 : 200, t + varighet)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.22 * styrke, t + varighet * 0.5)
    g.gain.exponentialRampToValueAtTime(0.0001, t + varighet)
    const p = ctx.createStereoPanner()
    const side = r() < 0.5 ? -1 : 1
    p.pan.setValueAtTime(-0.8 * side, t)
    p.pan.linearRampToValueAtTime(0.8 * side, t + varighet)
    s.connect(f)
    f.connect(g)
    g.connect(p)
    p.connect(busser.fx)
  }

  function stiger(t, varighet) {
    const s = støykilde(t, varighet)
    const f = ctx.createBiquadFilter()
    f.type = "highpass"
    f.frequency.setValueAtTime(300, t)
    f.frequency.exponentialRampToValueAtTime(7000, t + varighet)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.14, t + varighet * 0.98)
    g.gain.linearRampToValueAtTime(0.0001, t + varighet + 0.02)
    s.connect(f)
    f.connect(g)
    g.connect(busser.fx)
  }

  /* ---------- Harmonikken ---------- */

  let tone = Math.floor(mellom(46, 53))
  let akkord = "I"
  let stemmeføring = []
  let taktPerAkkord = 2

  function nyAkkord() {
    akkord = vektet(OVERGANGER[akkord])
    const a = AKKORDER[akkord]
    const rot = tone + a.rot
    // Hver tone legges i oktaven nærmest der forrige akkord lå, så flaten
    // glir i stedet for å hoppe.
    const midt = stemmeføring.length
      ? stemmeføring.reduce((x, y) => x + y, 0) / stemmeføring.length
      : 64
    stemmeføring = a.iv
      .map((iv) => {
        let n = rot + iv + 12
        while (n < midt - 6) n += 12
        while (n > midt + 6) n -= 12
        return n
      })
      .sort((x, y) => x - y)
    return a
  }

  function akkordtoner(oktaver = 2, bunn = 64) {
    const a = AKKORDER[akkord]
    const rot = tone + a.rot
    const ut = []
    for (let o = 0; o < oktaver; o++)
      for (const iv of a.iv.slice(0, 4)) {
        let n = rot + iv + o * 12
        while (n < bunn) n += 12
        ut.push(n)
      }
    return [...new Set(ut)].sort((x, y) => x - y)
  }

  /* ---------- Mønstrene ---------- */

  const m = {
    kick: [],
    snare: [],
    spøkelse: [],
    hat: [],
    åpen: [],
    rasle: [],
    bass: [],
    arp: { modus: "opp", hver: 1, oktaver: 2, hull: 0.1, start: 0 },
    motiv: [],
  }

  function nyeTrommer(mutasjon) {
    const kick = Array(16).fill(0)
    kick[0] = 1
    kick[10] = sjanse(0.75) ? 1 : 0
    for (const [s, p] of [
      [3, 0.2],
      [6, 0.15],
      [7, 0.3],
      [8, 0.35],
      [11, 0.2],
      [14, 0.25],
    ])
      if (sjanse(p)) kick[s] = 0.8
    const snare = Array(16).fill(0)
    snare[4] = 1
    snare[12] = 1
    const spøkelse = Array(16).fill(0)
    for (const s of [2, 7, 9, 10, 14, 15]) if (sjanse(0.3)) spøkelse[s] = mellom(0.15, 0.32)
    const hat = Array(16)
      .fill(0)
      .map((_, i) => (i % 2 ? (sjanse(0.85) ? 0.9 : 0) : sjanse(0.5) ? 0.45 : 0))
    const åpen = Array(16).fill(0)
    åpen[velg([6, 14, 10])] = sjanse(0.6) ? 0.8 : 0
    const rasle = Array(16)
      .fill(0)
      .map((_, i) => (sjanse(i % 4 === 2 ? 0.9 : 0.4) ? mellom(0.4, 1) : 0))
    if (mutasjon && m.kick.length) {
      // Behold omtrent halvparten av det gamle.
      const bland = (gml, ny) => gml.map((v, i) => (sjanse(0.5) ? v : ny[i]))
      m.kick = bland(m.kick, kick)
      m.kick[0] = 1
      m.spøkelse = bland(m.spøkelse, spøkelse)
      m.hat = bland(m.hat, hat)
      m.rasle = bland(m.rasle, rasle)
      m.åpen = sjanse(0.5) ? m.åpen : åpen
    } else Object.assign(m, { kick, spøkelse, hat, åpen, rasle })
    m.snare = snare
  }

  function nyBass(mutasjon) {
    const b = Array(16).fill(null)
    b[0] = { iv: 0, l: velg([2, 3, 4]) }
    for (const s of [2, 6, 10, 14]) if (sjanse(0.65)) b[s] = { iv: velg([0, 0, 12, 7]), l: 1 }
    for (const s of [3, 7, 8, 11, 13, 15])
      if (sjanse(0.18)) b[s] = { iv: velg([0, 12, 7, 10]), l: 1 }
    m.bass = mutasjon && m.bass.length ? m.bass.map((v, i) => (sjanse(0.6) ? v : b[i])) : b
    m.bass[0] = b[0]
  }

  function nyArp() {
    m.arp = {
      modus: velg(["opp", "ned", "oppned", "tilfeldig", "brutt", "spenn"]),
      hver: velg([1, 1, 2, 2, 3]),
      oktaver: velg([1, 2, 2, 3]),
      hull: mellom(0, 0.25),
      start: Math.floor(mellom(0, 4)),
      lengde: mellom(0.18, 0.6),
    }
    velgFm = velg([2, 2, 3])
  }

  function nyttMotiv(utvikle) {
    if (utvikle && m.motiv.length) {
      const grep = velg(["flytt", "snu", "baklengs", "rytme", "forleng"])
      if (grep === "flytt") {
        const d = velg([-2, -1, 1, 2])
        m.motiv = m.motiv.map((x) => ({ ...x, trinn: x.trinn + d }))
      } else if (grep === "snu") {
        const a = m.motiv[0].trinn
        m.motiv = m.motiv.map((x) => ({ ...x, trinn: a - (x.trinn - a) }))
      } else if (grep === "baklengs") {
        const l = m.motiv.map((x) => x.l)
        m.motiv = m.motiv
          .slice()
          .reverse()
          .map((x, i) => ({ ...x, l: l[i] }))
      } else if (grep === "rytme") {
        const i = Math.floor(r() * m.motiv.length)
        m.motiv[i] = { ...m.motiv[i], l: velg([2, 3, 4, 6]) }
      } else {
        const siste = m.motiv[m.motiv.length - 1]
        m.motiv.push({ trinn: siste.trinn + velg([-1, 1, 2]), l: velg([4, 6, 8]) })
      }
      return
    }
    const lengde = Math.floor(mellom(4, 8))
    let trinn = Math.floor(mellom(3, 7))
    m.motiv = []
    for (let i = 0; i < lengde; i++) {
      m.motiv.push({ trinn, l: velg([2, 3, 4, 4, 6, 8]) })
      trinn += velg([-2, -1, -1, 1, 1, 2, 3])
    }
  }

  /* ---------- Arrangementet ---------- */

  let energi = 0.25
  let målEnergi = 0.3
  let plan = []
  const lag = {
    pad: 1,
    vox: 0,
    arp: 0,
    lead: 0,
    bass: 0,
    kick: 0,
    snare: 0,
    hat: 0,
    rasle: 0,
  }
  let sving = 0.08
  let fill = false
  let frase = 0
  let ønsketModulasjon = false

  function settBuss(navn, mål, t, tid = 2) {
    const g = busser[navn].gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(mål, t + tid)
  }

  function nyFrase(t) {
    frase++
    const neste = plan.shift()
    if (neste === "brudd") målEnergi = 0.1
    else if (neste === "bygg") målEnergi = 0.45
    else if (neste === "fall") målEnergi = 0.92
    else målEnergi = klem(målEnergi * 0.6 + 0.62 * 0.4 + mellom(-0.28, 0.28), 0.18, 0.95)
    energi = målEnergi
    const e = energi

    if (ønsketModulasjon || (frase > 2 && sjanse(0.14))) {
      ønsketModulasjon = false
      tone += velg([5, 7, -5, 2, -2, 3, -3])
      while (tone > 54) tone -= 12
      while (tone < 43) tone += 12
      akkord = velg(["vi", "ii", "IV", "V"])
    }

    taktPerAkkord = velg([1, 2, 2, 2, 4])
    sving = velg([0, 0.06, 0.1, 0.14])
    const mut = sjanse(0.6)
    nyeTrommer(mut)
    nyBass(mut)
    if (sjanse(0.55) || frase === 1) nyArp()
    nyttMotiv(sjanse(0.65))

    const på = (terskel, ekstra = 0) => (e > terskel || sjanse(ekstra) ? 1 : 0)
    lag.pad = 1
    lag.kick = neste === "bygg" ? 0 : på(0.38)
    lag.snare = neste === "bygg" ? 0 : på(0.5, 0.05)
    lag.hat = på(0.3, 0.2)
    lag.rasle = på(0.6, 0.15)
    lag.bass = neste === "bygg" ? 1 : på(0.34)
    lag.arp = på(0.24, 0.5)
    lag.lead = e > 0.3 && e < 0.85 && sjanse(0.45) ? 1 : 0
    lag.vox = e < 0.55 || sjanse(0.35) ? 1 : 0
    fill = lag.snare && (sjanse(0.45) || plan[0] === "fall")

    settBuss("pad", 0.9 - e * 0.35, t)
    settBuss("vox", lag.vox * 0.9, t)
    settBuss("arp", lag.arp * (0.5 + e * 0.5), t, 1)
    settBuss("lead", lag.lead * 0.85, t)
    settBuss("bass", lag.bass * 0.95, t, 0.3)
    settBuss("trommer", lag.hat || lag.kick ? 0.95 : 0, t, 0.05)
    settBuss("fx", 0.9, t)
    padFilter.frequency.setTargetAtTime(700 + e * 2200, t, 1.5)

    if (neste === "bygg") stiger(t, 8 * 16 * s16)
  }

  let motivPeker = 0
  let motivNeste = 0

  function planleggSteg(steg, t) {
    const iTakt = steg % 16
    const takt = Math.floor(steg / 16)
    const iFrase = takt % 8
    const tt = t + (steg % 2 ? sving * s16 : 0)

    if (iTakt === 0) {
      if (iFrase === 0) {
        nyFrase(t)
        motivPeker = 0
        motivNeste = steg + 16 * velg([0, 1, 2])
      }
      if (takt % taktPerAkkord === 0 || iFrase === 0) {
        nyAkkord()
        const varighet = taktPerAkkord * 16 * s16
        pad(stemmeføring.slice(0, 4), t, varighet)
        if (lag.vox && sjanse(0.55)) {
          const toner = akkordtoner(1, 67)
          const valgte = sjanse(0.5)
            ? [toner[2] ?? toner[0], toner[1]]
            : [toner[1], toner[2] ?? toner[0], toner[0]]
          stemme(
            t,
            valgte,
            Math.min(varighet, 2 * 16 * s16),
            sjanse(0.7),
            velg(["u", "o"]),
            velg(["a", "e", "o"]),
          )
        }
      }
      // Spøkelsesslagene flyttes litt for hver takt.
      if (sjanse(0.5)) {
        const s = velg([2, 7, 9, 10, 14, 15])
        m.spøkelse[s] = m.spøkelse[s] ? 0 : mellom(0.15, 0.3)
      }
    }

    const sisteTakt = iFrase === 7
    if (lag.kick && m.kick[iTakt] && !(sisteTakt && fill && iTakt > 8))
      kick(t, 0.95 * m.kick[iTakt])
    if (lag.snare) {
      if (sisteTakt && fill && iTakt >= 8) {
        if (iTakt >= 12 || iTakt % 2 === 0) snare(tt, 0.25 + (iTakt - 8) * 0.08)
      } else {
        if (m.snare[iTakt]) snare(tt, 0.85)
        else if (m.spøkelse[iTakt]) snare(tt, m.spøkelse[iTakt])
      }
    }
    if (lag.hat && m.hat[iTakt]) hihat(tt, m.hat[iTakt], false)
    if (lag.hat && m.åpen[iTakt] && energi > 0.5) hihat(tt, m.åpen[iTakt], true)
    if (lag.rasle && m.rasle[iTakt]) rasle(tt, m.rasle[iTakt])

    if (lag.bass) {
      const b = m.bass[iTakt]
      if (b) {
        const rot = tone + AKKORDER[akkord].rot - 24
        bass(tt, rot + b.iv + (rot + b.iv < 28 ? 12 : 0), b.l * s16 * 0.95, iTakt === 0 ? 1 : 0.8)
      }
    }

    if (lag.arp) {
      const a = m.arp
      if ((steg - a.start) % a.hver === 0 && !sjanse(a.hull)) {
        const toner = akkordtoner(a.oktaver, 62)
        const i = Math.floor(steg / a.hver)
        let n
        const L = toner.length
        if (a.modus === "opp") n = toner[i % L]
        else if (a.modus === "ned") n = toner[L - 1 - (i % L)]
        else if (a.modus === "oppned") {
          const p = i % (2 * L - 2 || 1)
          n = toner[p < L ? p : 2 * L - 2 - p]
        } else if (a.modus === "brutt") n = toner[(Math.floor(i / 2) + (i % 2) * 2) % L]
        else if (a.modus === "spenn") n = toner[(i * 3) % L]
        else n = velg(toner)
        pluck(tt, n, iTakt % 4 === 0 ? 1 : 0.7, a.lengde)
      }
    }

    if (lag.lead && steg >= motivNeste && m.motiv.length) {
      const x = m.motiv[motivPeker % m.motiv.length]
      const oktav = Math.floor(x.trinn / 5)
      const trinn = ((x.trinn % 5) + 5) % 5
      let note = tone + 24 + PENTATON[trinn] + oktav * 12
      // På tunge slag dras tonen til nærmeste akkordtone.
      if (iTakt % 4 === 0) {
        const toner = akkordtoner(3, 60)
        note = toner.reduce((best, n) => (Math.abs(n - note) < Math.abs(best - note) ? n : best), toner[0])
      }
      while (note > 88) note -= 12
      while (note < 64) note += 12
      klokke(tt, note, x.l * s16, 0.9)
      motivPeker++
      motivNeste = steg + x.l
      if (motivPeker % m.motiv.length === 0) motivNeste += 16 * velg([1, 1, 2])
    }
  }

  /* ---------- Planleggeren ---------- */

  let steg = 0
  let nesteTid = 0
  let på = false
  let tidtaker = null

  function planleggTil(grense) {
    while (nesteTid < grense) {
      planleggSteg(steg, nesteTid)
      steg++
      nesteTid += s16
    }
  }

  function tikk() {
    if (!på) return
    const forut = document.hidden ? 1.5 : 0.15
    if (nesteTid < ctx.currentTime) nesteTid = ctx.currentTime + 0.05
    planleggTil(ctx.currentTime + forut)
  }

  function slå(påSkru) {
    const t = ctx.currentTime
    if (påSkru) {
      if (ctx.state === "suspended" && !(ctx instanceof OfflineAudioContext)) ctx.resume()
      if (!på) {
        på = true
        if (steg === 0) {
          plan = ["", "", ""]
          energi = 0.2
        }
        nesteTid = ctx.currentTime + 0.1
        tidtaker = setInterval(tikk, 25)
      }
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(master.gain.value, t)
      master.gain.linearRampToValueAtTime(0.62, t + 1.5)
    } else if (på) {
      på = false
      clearInterval(tidtaker)
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(master.gain.value, t)
      master.gain.linearRampToValueAtTime(0, t + 0.4)
    }
  }

  function siste(tider, nå) {
    let s = -10
    while (tider.length && tider[0] <= nå) s = tider.shift()
    return s
  }
  let sistKick = -10
  let sistSnare = -10

  return {
    kontekst: ctx,
    planleggTil,
    slå,
    erPå: () => på,
    energi: () => energi,
    puls() {
      if (!på) return 0
      const nå = ctx.currentTime
      const k = siste(kickTider, nå)
      if (k > 0) sistKick = k
      const s = siste(snareTider, nå)
      if (s > 0) sistSnare = s
      return Math.exp(-(nå - sistKick) * 7) + Math.exp(-(nå - sistSnare) * 9) * 0.5
    },
    // Hva presentasjonen gjør, og hva musikken svarer.
    flyr(varighet, nyttKapittel, nyttLysbilde = true) {
      if (!på) return
      const t = ctx.currentTime + 0.02
      sus(t, Math.max(0.8, varighet * 0.9), nyttLysbilde ? 1 : 0.45)
      if (nyttKapittel) {
        plan = ["brudd", "bygg", "fall"]
        ønsketModulasjon = true
      }
    },
    ankommet() {
      if (!på) return
      const t = ctx.currentTime + 0.02
      const toner = akkordtoner(2, 76)
      for (let i = 0; i < 3; i++) pluck(t + i * s16 * 1.5, toner[(i * 2) % toner.length], 0.6, 0.8)
    },
  }
}

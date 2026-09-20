/// <reference path="./types/css.d.ts" />

import { describe, expect, it } from "vitest"

/**
 * At stilarkene pakken sender ut holder seg innenfor sitt eget navnerom.
 *
 * En pakke som skal inn i vilkårlige apper kan ikke eie vanlige ord. Vi hadde
 * `.link` og `.srOnly` liggende i `utilities.css`, uten prefiks og utenfor
 * laget. Begge deler er stille feil hos konsumenten: klassen kolliderer med
 * deres egen, og en regel utenfor laget slår deres uansett spesifisitet.
 *
 * Testene her leser stilarkene som tekst, så en ny komponent blir fanget av
 * seg selv uten at noen husker å legge den til.
 */

const stilark = import.meta.glob("./**/*.css", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

/**
 * Fjerner kommentarer, tekststrenger og `url(...)`.
 *
 * Uten det leses `w3.org` inne i en innebygd SVG som klassen `.org`, og
 * testen sier fra om noe som ikke finnes.
 */
function onlyRules(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/url\([^)]*\)/g, " ")
    .replace(/"[^"]*"/g, " ")
    .replace(/'[^']*'/g, " ")
}

/** Stilark som bare samler andre filer, og derfor ikke har regler selv. */
function isBundle(source: string): boolean {
  return onlyRules(source)
    .split("\n")
    .every((line) => line.trim() === "" || line.trim().startsWith("@import"))
}

/** Klasseselektorene i en fil, uten duplikater. */
function classNames(source: string): string[] {
  const found = onlyRules(source).match(/\.[a-zA-Z_][\w-]*/g) ?? []
  return [...new Set(found.map((name) => name.slice(1)))]
}

/**
 * Tailwind-temaet er ikke et komponentstilark.
 *
 * Det er en `@theme`-blokk som gir Tailwind Fristils verdier, så det ligger
 * med vilje utenfor laget og definerer variabler i Tailwinds navnerom.
 * Reglene under gjelder derfor ikke der, men fila har sine egne lenger nede.
 */
const erTailwindtema = (navn: string) => navn.includes("/tailwind/")

const filer = Object.entries(stilark).filter(
  ([navn, source]) => !isBundle(source) && !erTailwindtema(navn),
)

describe("stilarkene pakken sender ut", () => {
  it("har stilark å kontrollere", () => {
    expect(filer.length).toBeGreaterThan(5)
  })

  it.each(filer)("%s ligger i @layer fristil", (_navn, source) => {
    // `@import` må stå først i en CSS-fil, så den delen hoppes over.
    const utenImport = onlyRules(source)
      .split("\n")
      .filter((line) => !line.trim().startsWith("@import"))
      .join("\n")

    expect(utenImport.trimStart().startsWith("@layer fristil")).toBe(true)
  })

  it.each(filer)("%s bruker bare fs-prefikserte klasser", (_navn, source) => {
    const uprefiksert = classNames(source).filter(
      (name) => !name.startsWith("fs-"),
    )
    expect(uprefiksert).toEqual([])
  })

  it.each(filer)("%s navngir klassene i kebab-case", (_navn, source) => {
    const feilform = classNames(source).filter(
      (name) =>
        !/^fs-[a-z0-9]+(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?$/.test(name),
    )
    expect(feilform).toEqual([])
  })
})

describe("variablene komponentene leser", () => {
  const komponentfiler = filer.filter(([navn]) => !navn.includes("/tokens/"))

  it.each(
    komponentfiler,
  )("%s definerer ingen egne variabler utenfor fs-navnerommet", (_navn, source) => {
    const definert = [
      ...onlyRules(source).matchAll(/^\s*(--[\w-]+)\s*:/gm),
    ].map((treff) => treff[1])
    expect(definert.filter((name) => !name.startsWith("--fs-"))).toEqual([])
  })

  it.each(
    komponentfiler,
  )("%s leser bare tokens og egne komponentvariabler", (_navn, source) => {
    const lest = [...onlyRules(source).matchAll(/var\((--[\w-]+)/g)].map(
      (treff) => treff[1],
    )
    const ukjente = lest.filter(
      (name) =>
        !name.startsWith("--fs-") &&
        !name.startsWith("--semantic-") &&
        !name.startsWith("--size") &&
        !name.startsWith("--font-size"),
    )
    expect([...new Set(ukjente)]).toEqual([])
  })
})

describe("tokenene komponentene faller tilbake på", () => {
  const tokens = Object.entries(stilark).find(([navn]) =>
    navn.endsWith("/tokens/tokens.css"),
  )?.[1]

  const definerte = new Set(
    [...(tokens ?? "").matchAll(/^\s*(--[\w-]+)\s*:/gm)].map(
      (treff) => treff[1],
    ),
  )

  const komponentfiler = filer.filter(([navn]) => !navn.includes("/tokens/"))

  it.each(
    komponentfiler,
  )("%s viser bare til tokens som finnes", (_navn, source) => {
    // `var(--fs-x, var(--size-7))` med et token som ikke finnes gir en ugyldig
    // verdi, ikke en reserve. Ikonknappen i datofeltet ble 16 piksler bred i
    // stedet for 28 på nøyaktig denne måten, uten at noe sa fra.
    const lest = [...onlyRules(source).matchAll(/var\((--[\w-]+)/g)].map(
      (treff) => treff[1],
    )
    const manglende = [...new Set(lest)].filter(
      (name) => !name.startsWith("--fs-") && !definerte.has(name),
    )
    expect(manglende).toEqual([])
  })
})

describe("Tailwind-temaet", () => {
  const tema = Object.entries(stilark).find(([navn]) =>
    erTailwindtema(navn),
  )?.[1]

  it("finnes", () => {
    expect(tema).toBeTypeOf("string")
  })

  it("legger bare til navn i fs-navnerommet", () => {
    const definert = [
      ...onlyRules(tema ?? "").matchAll(/^\s*(--[\w-]+)\s*:/gm),
    ].map((treff) => treff[1])

    // `--spacing` er unntaket, og med vilje: det er Tailwinds avstandsenhet,
    // og hele poenget er at `p-4` skal bli `--size-4`.
    const utenfor = definert.filter(
      (navn) =>
        navn !== "--spacing" &&
        !/^--(color|text|container|shadow|font|radius|leading|tracking|breakpoint)-fs-/.test(
          navn,
        ),
    )

    expect(utenfor).toEqual([])
  })

  it("henter alle verdiene fra Fristils tokens", () => {
    const lest = [...onlyRules(tema ?? "").matchAll(/var\((--[\w-]+)/g)].map(
      (treff) => treff[1],
    )

    const fremmede = lest.filter(
      (navn) =>
        !navn.startsWith("--semantic-") &&
        !navn.startsWith("--palette-") &&
        !navn.startsWith("--size") &&
        !navn.startsWith("--font-size"),
    )

    expect([...new Set(fremmede)]).toEqual([])
  })
})

/**
 * That the identifiers in the code that ships are English.
 *
 * The rule is in CONTRIBUTING.md: functions, variables, types and constants
 * are named in English, local variables too, and never mixed in one name.
 * The rule long stood without a guard, and a review found nine Norwegian
 * names in three components that nobody had seen, among them `gått`,
 * `forrigeFokus` and `bundne`. Review rounds catch such things only when
 * someone reads that exact file.
 *
 * The check reads text. It removes comments, strings and regular
 * expressions, splits each identifier into words at capital letters and
 * underscores, and fails on two things: æ, ø or å in the name, and a word
 * from the list below. æ, ø and å alone would not have found a single one of
 * the nine; the list is what catches them. The words are chosen because they
 * are not English words: `rot`, `rad`, `side`, `tom`, `tall`, `del`, `sett`,
 * `vis` and `meld` are not in it, since they are both. If you find a
 * Norwegian word the list does not know, add it in the same change.
 *
 * Test files and `src/testing/` are exempt, as the rule says, and
 * `src/types/` is declarations without names of their own. The scripts in
 * `scripts/` do not ship and are not read.
 */
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

const REPO = new URL("../..", import.meta.url).pathname

const SOURCES = [
  {
    root: new URL("../src", import.meta.url).pathname,
    exempt: ["testing", "types"],
  },
  { root: new URL("../../vscode/src", import.meta.url).pathname, exempt: [] },
  { root: new URL("../../core/src", import.meta.url).pathname, exempt: [] },
  {
    root: new URL("../../kotlin/src/main", import.meta.url).pathname,
    exempt: [],
  },
]

/**
 * Files that are Norwegian throughout, each cleaned up in its own pull
 * request.
 *
 * They are not exempt: the check reads them, and the number is the count of
 * findings today. More findings than the number fail, so a new Norwegian name
 * does not vanish in the crowd, and fewer findings fail too, until the number
 * is written down in the same change. The day a file is clean, it is taken
 * out. The list can only shrink, and there is no condition that switches the
 * check off.
 */
const KNOWN_DEBT = new Map<string, number>([])
const NORWEGIAN_WORDS = new Set([
  "aktiv",
  "aktive",
  "alle",
  "antall",
  "attributt",
  "attributter",
  "boks",
  "bundet",
  "bundne",
  "bygger",
  "byggere",
  "deler",
  "egen",
  "eller",
  "fane",
  "faner",
  "fant",
  "farge",
  "farger",
  "feil",
  "felter",
  "ferdig",
  "fil",
  "finnes",
  "flate",
  "flater",
  "fokus",
  "forrige",
  "forste",
  "gammel",
  "gamle",
  "grunn",
  "hendelse",
  "hendelser",
  "hermetegn",
  "hjelp",
  "hver",
  "igjen",
  "ikke",
  "innhold",
  "innledning",
  "kilde",
  "klokke",
  "knapp",
  "knapper",
  "kontrast",
  "kontroll",
  "kontrollen",
  "krav",
  "kropp",
  "laget",
  "ledetekst",
  "lenke",
  "lenker",
  "linje",
  "linjer",
  "lista",
  "liste",
  "lukk",
  "lukke",
  "lukket",
  "mappe",
  "melde",
  "melding",
  "meldinger",
  "navn",
  "navnet",
  "neste",
  "omskrevet",
  "oppgitt",
  "pakke",
  "palett",
  "ramme",
  "sagt",
  "siste",
  "sjekk",
  "skille",
  "skjul",
  "skjult",
  "sti",
  "stil",
  "synlig",
  "synlige",
  "tekst",
  "tittel",
  "tomt",
  "treff",
  "trinn",
  "utmappe",
  "uten",
  "valg",
  "valgt",
  "valgte",
  "varsel",
  "varsler",
  "verdi",
  "verdier",
  "vert",
  "verten",
  "vises",
])

function sourceFiles(root: string, exempt: string[]): string[] {
  const files: string[] = []
  const read = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name)
      const rel = relative(root, path)
      if (exempt.some((e) => rel === e || rel.startsWith(`${e}/`))) continue
      if (entry.isDirectory()) {
        read(path)
        continue
      }
      if (!/\.(ts|rs|kt)$/.test(entry.name)) continue
      if (entry.name.endsWith(".d.ts")) continue
      if (entry.name.includes(".test.")) continue
      files.push(path)
    }
  }
  read(root)
  return files
}

/**
 * Lifetimes (`'static`) and characters (`'a'`, `b'x'`) in Rust, replaced with
 * spaces.
 *
 * The scanner below is written for TypeScript, where `'` opens a string. In
 * Rust it stands alone before a lifetime, and the rest of the line would be
 * read as a string that never closes. Kotlin has characters in `'…'` where
 * TypeScript has strings, so it is not needed there.
 */
function withoutRustChars(file: string, content: string): string {
  if (!file.endsWith(".rs")) return content
  // Raw strings too, `r#"…"#`: the scanner below pairs the quotes inside
  // them wrongly, and the words in a JSON text in a test were read as
  // identifiers.
  const blank = (match: string) => match.replace(/[^\n]/g, " ")
  return content
    .replace(/\br(#+)"[\s\S]*?"\1/g, blank)
    .replace(/\br"[^"\n]*"/g, blank)
    .replace(/b?'(\\.|[^'\\\n])'/g, (match) => " ".repeat(match.length))
    .replace(/'[a-z_]+\b(?!')/g, (match) => " ".repeat(match.length))
}

/**
 * The code without strings, template strings, regular expressions and
 * comments.
 *
 * A scanner and not regular expressions: a template string can have a
 * template string inside `${…}`, and then a regular expression pairs the
 * quotes wrongly for the rest of the file. The first version reported 13
 * "identifiers" in `diagnostics.ts` that were all words in messages to the
 * user. The characters are replaced with spaces rather than removed, so the
 * line numbers stay.
 *
 * A regular expression is recognised by what stands before the slash: after
 * a value, `/` is division; after `(`, `,`, `=`, `:`, `[`, `!`, `&`, `|`,
 * `?`, `{`, `}`, `;`, `>`, `return`, `typeof` or `case` it is an expression.
 */
function codeOnly(content: string): string {
  const out: string[] = []
  const blank = (char: string) => (char === "\n" ? "\n" : " ")
  let i = 0
  // How deep we are in `${…}` inside template strings. Each level remembers
  // how many braces are open, so a `}` that closes an object is not taken for
  // the end of the expression.
  const expressions: number[] = []
  let lastCode = ""

  const peek = () => content[i]
  const skip = (text: string) => {
    for (const char of text) {
      out.push(blank(char))
      i += 1
    }
  }

  function templateString(): void {
    skip("`")
    while (i < content.length) {
      const char = peek()
      if (char === "\\") {
        skip(content.slice(i, i + 2))
      } else if (char === "`") {
        skip("`")
        // A string is a value: a `/` right after it is division.
        lastCode = "v"
        return
      } else if (char === "$" && content[i + 1] === "{") {
        skip("${")
        expressions.push(0)
        code()
      } else {
        skip(char)
      }
    }
  }

  function string(terminator: string): void {
    skip(terminator)
    while (i < content.length) {
      const char = peek()
      if (char === "\\") skip(content.slice(i, i + 2))
      else if (char === terminator || char === "\n") {
        skip(char)
        lastCode = "v"
        return
      } else skip(char)
    }
  }

  function regularExpression(): void {
    skip("/")
    let inClass = false
    while (i < content.length) {
      const char = peek()
      if (char === "\\") skip(content.slice(i, i + 2))
      else if (char === "\n") return
      else if (inClass) {
        if (char === "]") inClass = false
        skip(char)
      } else if (char === "[") {
        inClass = true
        skip(char)
      } else if (char === "/") {
        skip(char)
        while (/[a-z]/.test(content[i] ?? "")) skip(content[i])
        lastCode = "v"
        return
      } else skip(char)
    }
  }

  function isExpressionStart(): boolean {
    if (lastCode === "") return true
    // `>` is included for `=>`: an arrow function returning a regular
    // expression. Without it, `(s) => /\`/.test(s)` was read as division, the
    // backtick opened a template string, and the rest of the file became
    // invisible to the check.
    if (/[(,=:[!&|?{};>]/.test(lastCode)) return true
    const behind = out.join("").slice(-12)
    return /\breturn\s*$|\btypeof\s*$|\bcase\s*$/.test(behind)
  }

  function code(): void {
    while (i < content.length) {
      const char = peek()
      const next = content[i + 1]
      if (char === "/" && next === "/") {
        while (i < content.length && peek() !== "\n") skip(peek())
      } else if (char === "/" && next === "*") {
        const end = content.indexOf("*/", i + 2)
        skip(content.slice(i, end === -1 ? content.length : end + 2))
      } else if (char === '"' || char === "'") {
        string(char)
      } else if (char === "`") {
        templateString()
      } else if (char === "/" && isExpressionStart()) {
        regularExpression()
      } else if (expressions.length > 0 && char === "{") {
        expressions[expressions.length - 1] += 1
        out.push(char)
        lastCode = char
        i += 1
      } else if (expressions.length > 0 && char === "}") {
        if (expressions[expressions.length - 1] === 0) {
          expressions.pop()
          skip("}")
          return
        }
        expressions[expressions.length - 1] -= 1
        out.push(char)
        lastCode = char
        i += 1
      } else {
        out.push(char)
        if (!/\s/.test(char)) lastCode = char
        i += 1
      }
    }
  }

  code()
  return out.join("")
}

/** `forrigeFokus` becomes `forrige` and `fokus`; `LT_FIELD_TAG` becomes three words. */
function words(identifier: string): string[] {
  return identifier
    .split(/_|(?<=[a-zæøå0-9])(?=[A-ZÆØÅ])|(?<=[A-ZÆØÅ])(?=[A-ZÆØÅ][a-zæøå])/)
    .map((part) => part.toLowerCase())
    .filter(Boolean)
}

const IDENTIFIER = /[A-Za-z_$æøåÆØÅ][\w$æøåÆØÅ]*/g

const findings: string[] = []
const debt = new Map<string, number>()
let read = 0

for (const { root, exempt } of SOURCES) {
  for (const file of sourceFiles(root, exempt)) {
    read += 1
    const rel = relative(REPO, file)
    const code = codeOnly(withoutRustChars(file, readFileSync(file, "utf8")))
    code.split("\n").forEach((line, i) => {
      for (const match of line.matchAll(IDENTIFIER)) {
        const name = match[0]
        const norwegian =
          /[æøåÆØÅ]/.test(name) ||
          words(name).some((w) => NORWEGIAN_WORDS.has(w))
        if (!norwegian) continue
        if (KNOWN_DEBT.has(rel)) {
          debt.set(rel, (debt.get(rel) ?? 0) + 1)
        } else {
          findings.push(`${rel}:${i + 1}  ${name}`)
        }
      }
    })
  }
}

// The debt has to match the number, both ways.
for (const [file, allowed] of KNOWN_DEBT) {
  const count = debt.get(file) ?? 0
  if (count === 0) {
    findings.push(
      `${file}  is in KNOWN_DEBT, but is clean. Take it out of the list.`,
    )
  } else if (count > allowed) {
    findings.push(
      `${file}  has ${count} Norwegian identifiers, but KNOWN_DEBT allows ${allowed}. New Norwegian names are not allowed, not there either.`,
    )
  } else if (count < allowed) {
    findings.push(
      `${file}  has ${count} Norwegian identifiers, but KNOWN_DEBT says ${allowed}. Write the number down to ${count}.`,
    )
  }
}

// Count what was actually read. Zero files is a fault in the check, not a
// clean codebase.
if (read === 0) {
  console.error("✗ check-identifiers read no files.")
  process.exit(1)
}

if (findings.length > 0) {
  const unique = [...new Set(findings)]
  console.error(
    `\n✗ ${unique.length} Norwegian identifiers in ${read} files read. ` +
      "Identifiers in the code that ships must be English.\n",
  )
  for (const f of unique) console.error(`  ${f}`)
  process.exit(1)
}

const debtList = [...debt]
  .map(([file, count]) => `${file} (${count})`)
  .join(", ")
console.log(
  `The identifiers are English in ${read} files. ${debtList ? `Known debt: ${debtList}.` : "No known debt."}`,
)

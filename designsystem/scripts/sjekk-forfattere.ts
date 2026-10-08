/**
 * At ingen commit i historikken har en kodeagent som forfatter.
 *
 * Commitene i dette repoet skrives i eierens navn, også når en kodeagent har
 * skrevet koden. Det er en regel, og den står i CONTRIBUTING.md, men en regel som
 * bare står skrevet, ble brutt: et miljø der git var satt opp med agentens
 * navn, ga 33 commits med Claude som forfatter før noen så det.
 *
 * Sjekken går gjennom hele historikken fra HEAD, og feiler på:
 *
 *   - en forfatter eller committer med en adresse hos anthropic.com, eller
 *     som heter Claude;
 *   - en linje i meldingen som gir en agent æren: `Co-Authored-By` med
 *     Claude eller Anthropic, `Claude-Session` og «Generated with Claude
 *     Code».
 *
 * Kjør med: bun designsystem/scripts/sjekk-forfattere.ts. CI trenger hele
 * historikken (`fetch-depth: 0`).
 */

const SKILLE = "\u0001"
const FELT = "\u0000"

const logg = Bun.spawnSync([
  "git",
  "log",
  // git setter inn skilletegnene selv: et argument kan ikke ha en nullbyte.
  "--format=%h%x00%an%x00%ae%x00%cn%x00%ce%x00%B%x01",
])
if (logg.exitCode !== 0) {
  console.error(`git log feilet: ${logg.stderr.toString()}`)
  process.exit(1)
}

const agent = (navn: string, adresse: string) =>
  /@anthropic\.com$/i.test(adresse) || /^claude$/i.test(navn.trim())

const ÆRESLINJE =
  /^(co-authored-by:.*(claude|anthropic)|claude-session:|.*generated with \[claude code\])/im

const funn: string[] = []
let antall = 0
for (const post of logg.stdout.toString().split(SKILLE)) {
  const [hash, an, ae, cn, ce, melding = ""] = post.trim().split(FELT)
  if (!hash) continue
  antall += 1
  const tittel = melding.split("\n")[0]
  if (agent(an, ae))
    funn.push(`${hash} har ${an} <${ae}> som forfatter: ${tittel}`)
  if (agent(cn, ce))
    funn.push(`${hash} har ${cn} <${ce}> som committer: ${tittel}`)
  const linje = ÆRESLINJE.exec(melding)
  if (linje)
    funn.push(
      `${hash} gir en agent æren i meldingen («${linje[0].trim()}»): ${tittel}`,
    )
}

if (funn.length > 0) {
  console.error(
    `✗ ${new Set(funn.map((f) => f.split(" ")[0])).size} commits bryter regelen om forfatter i CONTRIBUTING.md:\n\n${funn.map((f) => `  ${f}`).join("\n")}\n\n` +
      "Sett git config user.name og user.email til eierens, og skriv commitene om før de flettes inn.\n",
  )
  process.exit(1)
}
console.log(`Ingen av de ${antall} commitene har en agent som forfatter.`)

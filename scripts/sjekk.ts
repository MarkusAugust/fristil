/**
 * `bun run sjekk`: stegene i `.github/workflows/ci.yml`, kjørt her.
 *
 * Rekka sto før skrevet av for hånd i `package.json`, og gled fra CI uten at
 * noe sa fra. Den rendrede siden, språkserveren, VS Code, jar-en, Rust-lint
 * og «Ingenting er ugenerert» manglet, så en push som var grønn lokalt kunne
 * feile i CI på noe den lokale rekka aldri kjørte. Nå leses stegene fra
 * `ci.yml`, og hvert `run:` kjøres som CI kjører det: med bash, `-eo
 * pipefail`, i `working-directory`, i den rekkefølgen jobbene og stegene står.
 *
 * Det som ikke kjøres her, står i `SKIPPED` med grunnen. Et navn der som ikke
 * finnes i `ci.yml`, feller kjøringen, så lista kan ikke råtne: et steg som
 * får nytt navn, kjøres her fra da av.
 *
 * Kjør med: bun run sjekk
 */

import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))

type Step = {
  name?: string
  run?: string
  uses?: string
  "working-directory"?: string
}
type Job = { name?: string; steps: Step[] }

/** Jobb og steg som ikke kjøres lokalt, med grunnen. */
const SKIPPED: Record<string, string> = {
  windows:
    "jobben kjører på Windows, og stiene og stasjonene den tester finnes ikke her",
  "sjekk/Oppdater npm": "endrer den globale npm-en på maskinen",
  "sjekk/Installer nettlesere":
    "henter nettlesere fra nettet; hent dem én gang med `bun --filter @fristil/designsystem nettlesere`",
}

const workflow = Bun.YAML.parse(
  await Bun.file(`${ROOT}.github/workflows/ci.yml`).text(),
) as { jobs: Record<string, Job> }

const used = new Set<string>()
const steps: { key: string; run: string; cwd: string }[] = []
for (const [jobId, job] of Object.entries(workflow.jobs)) {
  if (jobId in SKIPPED) {
    used.add(jobId)
    continue
  }
  for (const step of job.steps) {
    if (step.run === undefined) continue
    const key = `${jobId}/${step.name ?? step.run.split("\n")[0]}`
    if (key in SKIPPED) {
      used.add(key)
      continue
    }
    // VS Code trenger en skjerm. På Linux uten skjerm gir xvfb-run den, her
    // har maskinen sin egen.
    const run =
      process.platform === "linux"
        ? step.run
        : step.run.replace(/^xvfb-run -a /gm, "")
    steps.push({
      key,
      run,
      cwd: `${ROOT}${step["working-directory"] ?? ""}`,
    })
  }
}

const unknown = Object.keys(SKIPPED).filter((key) => !used.has(key))
if (unknown.length > 0) {
  console.error(
    `✗ Unntakene i scripts/sjekk.ts finnes ikke i ci.yml: ${unknown.join(", ")}. Rett navnet, eller ta unntaket bort.`,
  )
  process.exit(1)
}
if (steps.length === 0) {
  console.error("✗ Fant ingen steg å kjøre i ci.yml.")
  process.exit(1)
}

let done = 0
const started = performance.now()
for (const step of steps) {
  console.log(`\n▶ ${step.key}`)
  const at = performance.now()
  const result = Bun.spawnSync(
    ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", step.run],
    {
      cwd: step.cwd,
      stdio: ["inherit", "inherit", "inherit"],
    },
  )
  const seconds = ((performance.now() - at) / 1000).toFixed(1)
  if (result.exitCode !== 0) {
    console.error(
      `\n✗ ${step.key} feilet etter ${seconds} s, som steg ${done + 1} av ${steps.length}.`,
    )
    process.exit(result.exitCode ?? 1)
  }
  console.log(`✓ ${step.key} (${seconds} s)`)
  done += 1
}

const minutes = ((performance.now() - started) / 60000).toFixed(1)
console.log(
  `\n${done} av ${steps.length} steg fra ci.yml er grønne, på ${minutes} min. Hoppet over: ${Object.keys(SKIPPED).join(", ")}.`,
)

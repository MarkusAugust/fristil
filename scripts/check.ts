/**
 * `bun run check`: the steps in `.github/workflows/ci.yml`, run here.
 *
 * The sequence used to be copied out by hand in `package.json`, and drifted
 * from CI without anything saying so. The rendered page, the language
 * server, VS Code, the jar, Rust lint and "Generated files are up to date"
 * were missing, so a push that was green locally could fail in CI on
 * something the local sequence never ran. Now the steps are read from
 * `ci.yml`, and every `run:` is run the way CI runs it: with bash, `-eo
 * pipefail`, in `working-directory`, in the order the jobs and steps appear.
 *
 * What is not run here is in `SKIPPED` with the reason. A name there that
 * does not exist in `ci.yml` fails the run, so the list cannot rot: a step
 * that is renamed runs here from then on.
 *
 * Run with: bun run check
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

/** Jobs and steps that are not run locally, with the reason. */
const SKIPPED: Record<string, string> = {
  windows:
    "the job runs on Windows, and the paths and drives it tests do not exist here",
  "check/Update npm": "changes the global npm on the machine",
  "check/Install browsers":
    "downloads browsers. Fetch them once with `bun --filter @lo-tek/interfaces browsers`",
}

/*
 * What the script understands of a step. Anything else, such as `env`, `if`,
 * `shell` or `continue-on-error`, or `defaults` on the job, would make the
 * script run the step differently from CI without saying so. It stops
 * instead, and has to be taught.
 */
const STEP_KEYS = new Set([
  "name",
  "id",
  "run",
  "uses",
  "with",
  "working-directory",
])
const JOB_KEYS = new Set([
  "name",
  "runs-on",
  "steps",
  "needs",
  "timeout-minutes",
  "permissions",
])
const WORKFLOW_KEYS = new Set([
  "name",
  "on",
  "concurrency",
  "jobs",
  "permissions",
])

/** Whether the machine has a display VS Code can open on. See the use below. */
const HAS_DISPLAY =
  process.platform !== "linux" ||
  Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY)

const workflow = Bun.YAML.parse(
  await Bun.file(`${ROOT}.github/workflows/ci.yml`).text(),
) as { jobs: Record<string, Job> }

const unknown: string[] = []
for (const key of Object.keys(workflow))
  if (!WORKFLOW_KEYS.has(key)) unknown.push(key)

const used = new Set<string>()
let actions = 0
const steps: { key: string; run: string; cwd: string }[] = []
for (const [jobId, job] of Object.entries(workflow.jobs)) {
  if (jobId in SKIPPED) {
    used.add(jobId)
    continue
  }
  for (const key of Object.keys(job))
    if (!JOB_KEYS.has(key)) unknown.push(`${jobId}: ${key}`)
  for (const step of job.steps) {
    for (const key of Object.keys(step))
      if (!STEP_KEYS.has(key))
        unknown.push(`${jobId}/${step.name ?? step.uses ?? step.run}: ${key}`)
    // A step with `uses` sets up something the CI machine lacks, such as Java
    // or a cache. The machine here has it already.
    if (step.run === undefined) {
      actions += 1
      continue
    }
    const key = `${jobId}/${step.name ?? step.run.split("\n")[0]}`
    if (key in SKIPPED) {
      used.add(key)
      continue
    }
    // VS Code needs a display. On Linux without one, as in CI, xvfb-run
    // provides it. If the machine has its own, on macOS or on Linux with
    // `DISPLAY` or `WAYLAND_DISPLAY` set, xvfb-run is removed: it used to run
    // on all Linux, and a machine with a display but without xvfb installed
    // stopped on "xvfb-run: command not found".
    const run = HAS_DISPLAY ? step.run.replace(/^xvfb-run -a /gm, "") : step.run
    steps.push({
      key,
      run,
      cwd: `${ROOT}${step["working-directory"] ?? ""}`,
    })
  }
}

if (unknown.length > 0) {
  console.error(
    `✗ ci.yml has something scripts/check.ts does not know how to run: ${unknown.join(", ")}. Teach the script, so the steps run as in CI.`,
  )
  process.exit(1)
}

const stale = Object.keys(SKIPPED).filter((key) => !used.has(key))
if (stale.length > 0) {
  console.error(
    `✗ The exceptions in scripts/check.ts do not exist in ci.yml: ${stale.join(", ")}. Fix the name, or remove the exception.`,
  )
  process.exit(1)
}
if (steps.length === 0) {
  console.error("✗ Found no steps to run in ci.yml.")
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
      `\n✗ ${step.key} failed after ${seconds} s, as step ${done + 1} of ${steps.length}.`,
    )
    if (step.key.endsWith("Generated files are up to date"))
      console.error(
        "  The step asks git whether anything has changed. Locally that includes what you have not committed yet, so commit first and run again.",
      )
    process.exit(result.exitCode ?? 1)
  }
  console.log(`✓ ${step.key} (${seconds} s)`)
  done += 1
}

const minutes = ((performance.now() - started) / 60000).toFixed(1)
console.log(
  `\n${done} of ${steps.length} steps from ci.yml are green, in ${minutes} min. Skipped: ${Object.keys(SKIPPED).join(", ")}, and ${actions} steps that set up the CI machine.`,
)

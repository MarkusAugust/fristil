/**
 * Checks that no commit in the history has a coding agent as its author.
 *
 * The commits in this repository are written in the owner's name, also when
 * a coding agent wrote the code. That is a rule, and it is in CONTRIBUTING.md,
 * but a rule that is only written down was broken: an environment where git
 * was set up with the agent's name gave 33 commits with Claude as author
 * before anyone noticed.
 *
 * The check walks the whole history from HEAD, and fails on:
 *
 *   - an author or committer with an address at anthropic.com, or named
 *     Claude;
 *   - a line in the message that gives an agent the credit: `Co-Authored-By`
 *     with Claude or Anthropic, `Claude-Session` and "Generated with Claude
 *     Code".
 *
 * Run with: bun designsystem/scripts/check-authors.ts. CI needs the whole
 * history (`fetch-depth: 0`).
 */

const RECORD_SEPARATOR = "\u0001"
const FIELD_SEPARATOR = "\u0000"

const log = Bun.spawnSync([
  "git",
  "log",
  // git inserts the separators itself: an argument cannot contain a null byte.
  "--format=%h%x00%an%x00%ae%x00%cn%x00%ce%x00%B%x01",
])
if (log.exitCode !== 0) {
  console.error(`git log failed: ${log.stderr.toString()}`)
  process.exit(1)
}

const isAgent = (name: string, address: string) =>
  /@anthropic\.com$/i.test(address) || /^claude$/i.test(name.trim())

/*
 * The square brackets are optional. The pattern used to require the markdown
 * link "[Claude Code](…)", as the tool writes it in a PR description, and let
 * the plain text CONTRIBUTING.md forbids through.
 */
const CREDIT_LINE =
  /^(co-authored-by:.*(claude|anthropic)|claude-session:|.*generated with \[?claude code\]?)/im

/*
 * The pattern is tested against itself before the history, so a tightening
 * or a new spelling is not left untested. The messages below are not in the
 * history; they are what the check must fail, and what it must let through.
 */
const MUST_FAIL = [
  "Co-Authored-By: Claude <noreply@anthropic.com>",
  "Co-authored-by: Claude Opus <claude@anthropic.com>",
  "Claude-Session: https://claude.ai/code/session_x",
  "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
  "Generated with Claude Code",
  "🤖 Generated with Claude Code (https://claude.com/claude-code)",
]
const MUST_PASS = [
  "Fix focus in the error summary",
  "Co-Authored-By: Jane Smith <jane@example.com>",
  "The rulebook says the agent reads the manifest, not guesses",
  "The check was generated from a template, not written by hand",
]
const selfTest = [
  ...MUST_FAIL.filter((m) => !CREDIT_LINE.test(`Title\n\n${m}`)).map(
    (m) => `lets "${m}" through`,
  ),
  ...MUST_PASS.filter((m) => CREDIT_LINE.test(`Title\n\n${m}`)).map(
    (m) => `fails "${m}"`,
  ),
]
if (selfTest.length > 0) {
  console.error(
    `✗ The pattern in check-authors.ts ${selfTest.join(", and ")}. Fix the pattern before the history is checked.`,
  )
  process.exit(1)
}

const findings: string[] = []
let count = 0
for (const entry of log.stdout.toString().split(RECORD_SEPARATOR)) {
  const [hash, an, ae, cn, ce, message = ""] = entry
    .trim()
    .split(FIELD_SEPARATOR)
  if (!hash) continue
  count += 1
  const title = message.split("\n")[0]
  if (isAgent(an, ae))
    findings.push(`${hash} has ${an} <${ae}> as author: ${title}`)
  if (isAgent(cn, ce))
    findings.push(`${hash} has ${cn} <${ce}> as committer: ${title}`)
  const line = CREDIT_LINE.exec(message)
  if (line)
    findings.push(
      `${hash} gives an agent the credit in the message ("${line[0].trim()}"): ${title}`,
    )
}

if (findings.length > 0) {
  console.error(
    `✗ ${new Set(findings.map((f) => f.split(" ")[0])).size} commits break the authorship rule in CONTRIBUTING.md:\n\n${findings.map((f) => `  ${f}`).join("\n")}\n\n` +
      "Set git config user.name and user.email to the owner's, and rewrite the commits before they are merged.\n",
  )
  process.exit(1)
}
console.log(`None of the ${count} commits has an agent as author.`)

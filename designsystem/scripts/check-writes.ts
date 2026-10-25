/**
 * That the components write attributes through `setAttr`, not raw.
 *
 * The components observe the attributes they set themselves, so they can set
 * them back after a patch from the server. If one of them writes a value that
 * is already there, it counts as a change, the observer calls itself, writes
 * again, and the microtask queue never empties. The page freezes.
 *
 * That is why this check exists, and why it is a script and not a browser
 * test: when a component breaks the rule, a test run **hangs** instead of
 * failing. No stack trace, no assertion, just silence, and a run that has to
 * be killed by hand. A rule that can only be broken that way has to be
 * enforced in the source, and it has to fail in seconds.
 *
 * Six ways of writing trigger a mutation record without the value changing,
 * and five of them have been used in these components. Looking for
 * `setAttribute` is therefore not enough:
 *
 * | Write | Use instead |
 * | --- | --- |
 * | `el.setAttribute(n, v)` | `setAttr(el, n, v)` |
 * | `el.hidden = x`, `el.disabled = x` | `setFlag(el, "hidden", x)` |
 * | `el.tabIndex = n`, `el.id = s`, `el.htmlFor = s` | `setAttr(el, …)` |
 * | `el.textContent = s`, `el.innerText = s` | `setText(el, s)` |
 * | `el.classList.add(k)` | `addClass(el, k)` |
 * | `el.style.cssText = s` | `el.style.setProperty(…)` |
 *
 * `removeAttribute`, `toggleAttribute` and `style.setProperty` give no record
 * when nothing changes, and are safe.
 *
 * **The host is not an exception.** The previous version let `this.…` pass,
 * on the grounds that the host is only observed through `observedAttributes`.
 * That is not true: each of the components calls `observe(this, …)`, and an
 * observer on a node sees the node's own attributes and its own children.
 * `this.classList.add()` in `<lt-field>`, which has `class` in its filter,
 * would have hung a run just as well as a write on a child.
 *
 * The one thing allowed on the host is assigning a property the component
 * itself declares with `set`. `this.open = true` then calls the setter in the
 * same file, and that is what writes, through `setFlag`. The setter names are
 * read from the file rather than listed here, so a new setter does not have
 * to be remembered in two places.
 *
 * The check reads text, and it does not catch everything.
 * `Object.assign(el, { … })`, a `setAttribute` stored in a variable and
 * `replaceChildren()` slip past. None of them are in use, and a text check
 * that caught them would take as much correct code with it. What it catches
 * are the forms that actually appear in these files, and the ones closest to
 * hand next time.
 *
 * Only `frame/` is read. The standalone components create their own content
 * and do not observe it, so a write there cannot call any observer.
 *
 */
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = new URL("../src/components/frame", import.meta.url).pathname

function componentFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return componentFiles(path)
    if (!entry.name.startsWith("lt-")) return []
    if (!entry.name.endsWith(".ts")) return []
    if (entry.name.includes(".test.")) return []
    return [path]
  })
}

/**
 * The ways of writing that give a mutation record even when the value is the
 * same.
 *
 * `(?<!\bthis)` is the exception for the host, and it has to sit on the
 * receiver itself. A check on whether the line contains `this.` was too
 * broad: `this.panel.setAttribute(...)` slipped past, and that is exactly how
 * a component would write it.
 */
const FORBIDDEN: { pattern: RegExp; use: string }[] = [
  { pattern: /\.setAttribute\(/, use: "setAttr()" },
  { pattern: /\.classList\.(add|remove|toggle)\(/, use: "addClass()" },
  { pattern: /\.(hidden|disabled|open|checked)\s*=[^=]/, use: "setFlag()" },
  { pattern: /\.(tabIndex|id|className|htmlFor)\s*=[^=]/, use: "setAttr()" },
  { pattern: /\.(textContent|innerText)\s*=[^=]/, use: "setText()" },
  { pattern: /\.style\.cssText\s*=[^=]/, use: "style.setProperty()" },
]

const findings: string[] = []

for (const file of componentFiles(ROOT)) {
  const content = readFileSync(file, "utf8")
  // The properties the file itself declares. `this.open = x` then goes
  // through the setter.
  const setters = [...content.matchAll(/^\s*set ([a-zA-Z]+)\(/gm)].map(
    (match) => match[1],
  )

  const lines = content.split("\n")
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    // Comments are not code. Both `//` and the lines inside a `/** … */`.
    if (trimmed.startsWith("*") || trimmed.startsWith("/*")) return
    const code = line.split("//")[0]

    // A `set` accessor declares a property, it does not write.
    if (/^\s*(set|get) /.test(code)) return
    if (setters.some((name) => code.includes(`this.${name} =`))) return

    for (const { pattern, use } of FORBIDDEN) {
      if (!pattern.test(code)) continue
      findings.push(
        `${file.replace(`${ROOT}/`, "")}:${i + 1}  ${trimmed}   → ${use}`,
      )
      break
    }
  })
}

if (findings.length > 0) {
  console.error(
    `\n✗ ${findings.length} raw writes. Use the helpers in host-element.ts, which\n` +
      "  compare first. Without them the observer calls itself, and the run hangs.\n",
  )
  for (const f of findings) console.error(`  ${f}`)
  process.exit(1)
}

console.log("The components write through the helpers that compare first.")

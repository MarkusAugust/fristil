import { cssTokens } from "../src/tokens/tokens"

const sections: Record<string, string[]> = {}

for (const key of Object.keys(cssTokens) as (keyof typeof cssTokens)[]) {
  const section = key
    .replace(/^--/, "")
    .split("-")
    .slice(
      0,
      key.startsWith("--semantic") ? 2 : key.startsWith("--palette") ? 2 : 1,
    )
    .join("-")

  if (!sections[section]) sections[section] = []
  sections[section].push(`  ${key}: ${cssTokens[key]};`)
}

const lines = ["/* Generated — edit tokens.ts, not this file */", ":root {"]
for (const [section, props] of Object.entries(sections)) {
  lines.push(`\n  /* ${section} */`)
  lines.push(...props)
}
lines.push("}")

await Bun.write(
  new URL("../src/tokens/tokens.css", import.meta.url),
  lines.join("\n") + "\n",
)

console.log("✓ tokens.css generated")

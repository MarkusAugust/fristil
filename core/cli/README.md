# lotek, kommandolinja

Kommandolinja til LO-TEK, skrevet én gang i Rust:

```bash
lotek sjekk templates/*.html
lotek sjekk http://localhost:8080/form
lotek sjekk-tema theme.css
lotek tema --aksent=#7c3aed --ut=theme.css
lotek agent
lotek overta button --ut=src/ui
```

`lotek --hjelp` har resten.

Den samme koden kjører på to måter:

- **Som kjørbar fil**, bygget for maskinen: `cargo build --release -p lotek`.
  Den henter `http://`-adresser selv, som en app under utvikling på
  `localhost`. En `https://`-adresse hentes med `curl` og sendes inn:
  `curl -s https://… | lotek sjekk --rendret`.
- **Som WASI-modul**, `cargo build --release -p lotek --target wasm32-wasip1`,
  som `npx @lo-tek/interfaces`, `java -jar` og wasmtime kjører. WASI har
  ikke nettverk, så der henter verten siden og gir den til modulen med
  `--hentet=<fil>`. Se `src/fetch.rs`.

Programmet bærer ingen data. Manifestet, fargekontrakten, regelbøkene for
`agent` og kildekoden til komponentene for `overta` leses fra
`@lo-tek/interfaces`: fra mappa `LOTEK_PACKAGE` peker på, som npm-pakken,
jar-en og VS Code-utvidelsen setter selv, eller fra `node_modules` i
arbeidsmappa eller en mappe over den. Svaret gjelder altså versjonen prosjektet
har installert. Finnes ingen pakke, sier programmet fra og stopper. Se
`src/package.rs`.

Installert fra repoet: `cargo install --git https://github.com/MarkusAugust/lo-tek lotek`.

## At den svarer det samme

Kommandolinja var skrevet i TypeScript. Hver vert svarer det samme, byte for
byte, på utdata, feilkanalen og feilkoden, i hver kjøring i
`designsystem/scripts/check-cli.ts`:

```bash
cargo build --release -p lotek
LOTEK_SAMMENLIGN=$PWD/target/release/lotek bun ../designsystem/scripts/check-cli.ts
LOTEK_SAMMENLIGN='["java", "-jar", "/sti/til/lotek.jar"]' bun ../designsystem/scripts/check-cli.ts
```

To forklaringer kommer fra verten og er ikke like: hva som er galt i en
JSON-fil, og hvorfor ingen svarte på en adresse.

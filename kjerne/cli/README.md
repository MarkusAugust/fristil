# fristil, kommandolinja

Kommandolinja til Fristil, skrevet én gang i Rust:

```bash
fristil sjekk maler/*.html
fristil sjekk http://localhost:8080/skjema
fristil sjekk-tema tema.css
fristil tema --aksent=#7c3aed --ut=tema.css
fristil agent
```

`fristil --hjelp` har resten.

Den samme koden kjører på to måter:

- **Som kjørbar fil**, bygget for maskinen: `cargo build --release -p fristil`.
  Den henter `http://`-adresser selv, som en app under utvikling på
  `localhost`. En `https://`-adresse hentes med `curl` og sendes inn:
  `curl -s https://… | fristil sjekk --rendret`.
- **Som WASI-modul**, `cargo build --release -p fristil --target wasm32-wasip1`,
  som `npx @fristil/designsystem`, `java -jar` og wasmtime kjører. WASI har
  ikke nettverk, så der henter verten siden og gir den til modulen med
  `--hentet=<fil>`. Se `src/fetch.rs`.

Regelbøkene for `agent` og manifestet sjekken leser, er bygget inn, så
programmet svarer for den versjonen av Fristil det er bygget fra.

## At den svarer det samme

Kommandolinja var skrevet i TypeScript (`designsystem/src/cli.ts`). Rust-utgaven
svarer det samme, byte for byte, på utdata, feilkanalen og feilkoden:

```bash
cargo build --release -p fristil
FRISTIL_SAMMENLIGN=$PWD/target/release/fristil bun ../designsystem/scripts/sjekk-cli.ts
```

To forklaringer kom fra JavaScript-motoren og er ikke like: hva som er galt i
en JSON-fil, og hvorfor ingen svarte på en adresse. `overta` skrives i Rust i
neste trinn, og finnes til da bare i npm-utgaven.

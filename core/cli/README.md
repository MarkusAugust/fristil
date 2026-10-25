# lotek, the CLI

LO-TEK's command line, written once in Rust:

```bash
lotek check templates/*.html
lotek check http://localhost:8080/form
lotek check-theme theme.css
lotek theme --accent=#7c3aed --out=theme.css
lotek agent
lotek takeover button --out=src/ui
```

`lotek --help` has the rest.

The same code runs in two ways:

- **As an executable**, built for the machine: `cargo build --release -p lotek`.
  It fetches `http://` URLs itself, such as an app in development on
  `localhost`. An `https://` URL is fetched with `curl` and piped in:
  `curl -s https://… | lotek check --rendered`.
- **As a WASI module**, `cargo build --release -p lotek --target wasm32-wasip1`,
  which `npx @lo-tek/interfaces`, `java -jar` and wasmtime run. WASI has
  no network, so there the host fetches the page and gives it to the module with
  `--hentet=<file>`. See `src/fetch.rs`.

The program carries no data. The manifest, the colour contract, the rulebooks for
`agent` and the source code of the components for `takeover` are read from
`@lo-tek/interfaces`: from the folder `LOTEK_PACKAGE` points to, which the npm package,
the jar and the VS Code extension set themselves, or from `node_modules` in
the working directory or a directory above it. The answer therefore applies to the version the project
has installed. If there is no package, the program says so and stops. See
`src/package.rs`.

Installed from the repository: `cargo install --git https://github.com/MarkusAugust/lo-tek lotek`.

## Every host answers the same

The CLI used to be written in TypeScript. Every host gives the same answer, byte for
byte, on standard output, standard error and the exit code, in every run in
`designsystem/scripts/check-cli.ts`:

```bash
cargo build --release -p lotek
LOTEK_SAMMENLIGN=$PWD/target/release/lotek bun ../designsystem/scripts/check-cli.ts
LOTEK_SAMMENLIGN='["java", "-jar", "/path/to/lotek.jar"]' bun ../designsystem/scripts/check-cli.ts
```

Two explanations come from the host and are not identical: what is wrong in a
JSON file, and why nothing answered at a URL.

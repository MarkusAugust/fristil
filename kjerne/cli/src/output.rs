//! Utdata slik `console.log` og `console.error` skriver dem: teksten og et
//! linjeskift. Svarene skal være de samme byte for byte som da kommandolinja
//! var skrevet i TypeScript, så en test eller et skript som leser dem, ikke
//! merker byttet.

use std::io::Write;

/// `console.log`: til utdata, med linjeskift.
pub fn log(text: &str) {
    let mut out = std::io::stdout().lock();
    let _ = out.write_all(text.as_bytes());
    let _ = out.write_all(b"\n");
    let _ = out.flush();
}

/// `console.error`: til feilkanalen, med linjeskift.
pub fn error(text: &str) {
    let mut err = std::io::stderr().lock();
    let _ = err.write_all(text.as_bytes());
    let _ = err.write_all(b"\n");
    let _ = err.flush();
}

/// `console.error(tekst)` og `process.exit(1)`.
pub fn fail(text: &str) -> ! {
    error(text);
    std::process::exit(1);
}

/// `process.stdout.write`: til utdata, uten noe lagt til.
pub fn write(text: &str) {
    let mut out = std::io::stdout().lock();
    let _ = out.write_all(text.as_bytes());
    let _ = out.flush();
}

/// «1 fil» eller «3 filer».
pub fn count(n: usize, one: &str, many: &str) -> String {
    format!("{n} {}", if n == 1 { one } else { many })
}

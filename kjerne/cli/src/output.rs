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

/// En sti slik brukeren skrev den.
///
/// På Windows gjør verten `C:\\prosjekt\\a.html` om til `/c/prosjekt/a.html`,
/// som WASI-modulen forstår, og setter `FRISTIL_WINDOWS`. I meldingene skal
/// stien se ut som den brukeren kjenner igjen.
pub fn shown(path: &str) -> String {
    shown_with(path, std::env::var("FRISTIL_WINDOWS").as_deref() == Ok("1"))
}

fn shown_with(path: &str, windows: bool) -> String {
    if !windows || path.contains("://") {
        return path.to_string();
    }
    let b = path.as_bytes();
    if b.len() >= 2 && b[0] == b'/' && b[1].is_ascii_lowercase() && (b.len() == 2 || b[2] == b'/') {
        format!(
            "{}:\\{}",
            (b[1] as char).to_ascii_uppercase(),
            path.get(3..).unwrap_or("").replace('/', "\\")
        )
    } else {
        path.replace('/', "\\")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shows_windows_paths_as_written() {
        assert_eq!(
            shown_with("/c/Users/a/galt.html", true),
            r"C:\Users\a\galt.html"
        );
        assert_eq!(shown_with("/d", true), r"D:\");
        assert_eq!(shown_with("maler/a.html", true), r"maler\a.html");
        assert_eq!(shown_with("http://localhost/x", true), "http://localhost/x");
        assert_eq!(shown_with("stdin", true), "stdin");
        assert_eq!(shown_with("/c/Users/a.html", false), "/c/Users/a.html");
    }
}

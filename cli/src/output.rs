//! Output as `console.log` and `console.error` write it: the text and a line
//! break. The answers were the same byte for byte as when the command line
//! was written in TypeScript, so a test or a script reading them did not
//! notice the switch.

use std::io::Write;

/// `console.log`: to standard output, with a line break.
pub fn log(text: &str) {
    let mut out = std::io::stdout().lock();
    let _ = out.write_all(text.as_bytes());
    let _ = out.write_all(b"\n");
    let _ = out.flush();
}

/// `console.error`: to standard error, with a line break.
pub fn error(text: &str) {
    let mut err = std::io::stderr().lock();
    let _ = err.write_all(text.as_bytes());
    let _ = err.write_all(b"\n");
    let _ = err.flush();
}

/// `console.error(text)` and `process.exit(1)`.
pub fn fail(text: &str) -> ! {
    error(text);
    std::process::exit(1);
}

/// `process.stdout.write`: to standard output, with nothing added.
pub fn write(text: &str) {
    let mut out = std::io::stdout().lock();
    let _ = out.write_all(text.as_bytes());
    let _ = out.flush();
}

/// "1 file" or "3 files".
pub fn count(n: usize, one: &str, many: &str) -> String {
    format!("{n} {}", if n == 1 { one } else { many })
}

/// A path as the user wrote it.
///
/// On Windows the host turns `C:\\project\\a.html` into `/c/project/a.html`,
/// which the WASI module understands, and sets `LOTEK_WINDOWS`. In the
/// messages the path should look like the one the user recognises.
pub fn shown(path: &str) -> String {
    shown_with(path, std::env::var("LOTEK_WINDOWS").as_deref() == Ok("1"))
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
            shown_with("/c/Users/a/wrong.html", true),
            r"C:\Users\a\wrong.html"
        );
        assert_eq!(shown_with("/d", true), r"D:\");
        assert_eq!(shown_with("templates/a.html", true), r"templates\a.html");
        assert_eq!(shown_with("http://localhost/x", true), "http://localhost/x");
        assert_eq!(shown_with("stdin", true), "stdin");
        assert_eq!(shown_with("/c/Users/a.html", false), "/c/Users/a.html");
    }
}

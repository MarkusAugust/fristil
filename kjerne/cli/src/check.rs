//! `fristil sjekk <fil|adresse…>`: den samme sjekken som editoren kjører mens
//! du skriver, over ferdige filer.
//!
//! Uten filer leses standard inn, så en test kan sende HTML-en serveren
//! faktisk sender. En adresse hentes og sjekkes som en hel side: da kreves det
//! i tillegg at hver id det pekes på finnes, og at hvert felt er koblet. Det
//! samme gjør `--rendret` for filer og standard inn. En mal sjekkes ikke slik
//! uten flagget, siden en id i en mal kan stå i en annen fil.

use std::io::{IsTerminal, Read};

use crate::fetch;
use crate::output::{count, error, fail, log, shown};
use fristil_kjerne::styles::{read_styles, Styles};
use fristil_kjerne::text::utf16;
use fristil_kjerne::types::Severity;
use fristil_kjerne::{diagnose_markup, diagnose_page, diagnose_styled, manifest, Lines};

/// Hele standard inn. Er røret i ikke-blokkerende modus, ventes det og
/// leses igjen til skriveren er ferdig, i stedet for å gi opp med det som
/// tilfeldigvis var kommet.
fn read_all_input() -> Vec<u8> {
    let mut bytes = Vec::new();
    let mut buffer = [0u8; 64 * 1024];
    let mut stdin = std::io::stdin().lock();
    loop {
        match stdin.read(&mut buffer) {
            Ok(0) => return bytes,
            Ok(n) => bytes.extend_from_slice(&buffer[..n]),
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => {}
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(std::time::Duration::from_millis(5));
            }
            Err(_) => return bytes,
        }
    }
}

/// Fragmentene i filene, hvert av dem kontrollert for seg, så en feil sier
/// hvilken fil den står i.
pub fn read_fragments(manifests: &[&str]) -> Vec<String> {
    let mut texts = Vec::new();
    for path in manifests {
        let Ok(bytes) = std::fs::read(path) else {
            fail(&format!(
                "Fant ikke manifestet «{}».\n\nFragmentet skrives av fristil overta, ved siden av kopien.\n",
                shown(path)
            ));
        };
        let text = String::from_utf8_lossy(&bytes).into_owned();
        if let Err(reason) = manifest::with_fragments(&[&text]) {
            fail(&format!(
                "«{}» kan ikke leses som et manifest: {reason}\n",
                shown(path)
            ));
        }
        texts.push(text);
    }
    texts
}

/// Ordforrådet: Fristils eget, med fragmentene lagt til.
fn vocabulary(manifests: &[&str]) -> std::rc::Rc<fristil_kjerne::types::Vocabulary> {
    if manifests.is_empty() {
        return manifest::current();
    }
    let texts = read_fragments(manifests);
    let all: Vec<&str> = texts.iter().map(String::as_str).collect();
    match manifest::with_fragments(&all) {
        Ok(vocabulary) => std::rc::Rc::new(vocabulary),
        Err(reason) => fail(&format!("Manifestene kan ikke leses sammen: {reason}\n")),
    }
}

/// Stien uten `.` og `..`, så to stier til samme fil er like. Uten dette
/// ble `a/../b/y.css` og `a/../b/../b/y.css` to filer, og to stilark som
/// importerer hverandre gjennom `../`, ga en løkke uten ende.
fn normalized(path: &std::path::Path) -> std::path::PathBuf {
    use std::path::Component;
    let mut out = std::path::PathBuf::new();
    for part in path.components() {
        match part {
            Component::CurDir => {}
            Component::ParentDir => {
                if matches!(out.components().next_back(), Some(Component::Normal(_))) {
                    out.pop();
                } else {
                    out.push("..");
                }
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// Fila en pakkesti som `@fristil/designsystem/fristil.css` peker på.
///
/// Leter etter `node_modules/<pakke>` oppover fra stilarkets mappe, og slår
/// opp underveien i `exports` i pakkens `package.json`: en nøyaktig nøkkel,
/// ellers et mønster som `./*`, og verdien som streng eller som
/// betingelsesobjekt (`style`, `default`). En pakke importert ved navn alene
/// bruker `.` og så `style`. Uten treff brukes den direkte stien.
///
/// En sti som begynner med `.` eller `/` er en fil, ikke en pakke, og gir
/// `None`.
fn package_file(folder: &std::path::Path, spec: &str) -> Option<std::path::PathBuf> {
    use fristil_kjerne::json::{parse, Json};
    let spec = spec.strip_prefix('~').unwrap_or(spec);
    if spec.starts_with('.') || spec.starts_with('/') || spec.starts_with('\\') {
        return None;
    }
    let mut parts = spec.splitn(if spec.starts_with('@') { 3 } else { 2 }, '/');
    let name = if spec.starts_with('@') {
        format!("{}/{}", parts.next()?, parts.next()?)
    } else {
        parts.next()?.to_string()
    };
    let sub = parts.next().unwrap_or("");
    let start = if folder.is_absolute() {
        folder.to_path_buf()
    } else {
        std::env::current_dir().ok()?.join(folder)
    };
    fn pick(entry: &Json) -> Option<String> {
        match entry {
            Json::String(s) => Some(s.clone()),
            Json::Object(_) => ["style", "default", "import"]
                .iter()
                .find_map(|c| entry.get(c).and_then(pick)),
            _ => None,
        }
    }
    let lookup = |pkg: &Json| -> Option<String> {
        let key = if sub.is_empty() {
            ".".to_string()
        } else {
            format!("./{sub}")
        };
        let exports = pkg.get("exports");
        if let Some(found) = exports.and_then(|e| e.get(&key)).and_then(pick) {
            return Some(found);
        }
        // Et mønster, som `"./*": "./dist/*"`.
        if let Some(Json::Object(entries)) = exports {
            for (pattern, value) in entries {
                let Some((before, after)) = pattern.split_once('*') else {
                    continue;
                };
                let Some(middle) = key
                    .strip_prefix(before)
                    .and_then(|rest| rest.strip_suffix(after))
                else {
                    continue;
                };
                if let Some(target) = pick(value) {
                    return Some(target.replace('*', middle));
                }
            }
        }
        if sub.is_empty() {
            return pkg.get("style").and_then(pick);
        }
        None
    };
    let mut dir = Some(normalized(&start));
    while let Some(here) = dir {
        let root = here.join("node_modules").join(&name);
        if let Ok(text) = std::fs::read_to_string(root.join("package.json")) {
            let target = parse(&text).ok().and_then(|pkg| lookup(&pkg));
            return Some(normalized(&root.join(target.as_deref().unwrap_or(sub))));
        }
        dir = here.parent().map(std::path::Path::to_path_buf);
    }
    None
}

/// Stilarkene, med det de importerer.
///
/// `@import` følges til en fil ved siden av, og til en pakke i
/// `node_modules`, som `@fristil/designsystem/fristil.css`. En adresse på
/// nettet hentes ikke.
fn read_style_sheets(paths: &[&str]) -> Styles {
    let mut styles = Styles::default();
    let mut seen: Vec<std::path::PathBuf> = Vec::new();
    let mut queue: Vec<(std::path::PathBuf, bool)> = paths
        .iter()
        .map(|p| (normalized(std::path::Path::new(p)), true))
        .collect();
    while let Some((path, given)) = queue.pop() {
        if seen.contains(&path) {
            continue;
        }
        seen.push(path.clone());
        let Ok(bytes) = std::fs::read(&path) else {
            if given {
                fail(&format!(
                    "Fant ikke stilarket «{}».",
                    shown(&path.display().to_string())
                ));
            }
            continue;
        };
        let read = read_styles(&String::from_utf8_lossy(&bytes));
        let folder = path
            .parent()
            .map(std::path::Path::to_path_buf)
            .unwrap_or_default();
        for import in &read.imports {
            if import.contains("://") || import.starts_with("data:") {
                continue;
            }
            let beside = normalized(&folder.join(import));
            queue.push((
                if beside.exists() {
                    beside
                } else {
                    package_file(&folder, import).unwrap_or_else(|| {
                        if import.starts_with('.') || import.starts_with('/') {
                            beside
                        } else {
                            normalized(&std::path::Path::new("node_modules").join(import))
                        }
                    })
                },
                false,
            ));
        }
        styles.extend(read);
    }
    styles
}

struct Source {
    name: String,
    text: String,
    page: bool,
}

pub fn run(arguments: &[String]) {
    let rendered = arguments.iter().any(|a| a == "--rendret");
    let mut sources: Vec<Source> = Vec::new();
    let mut missing: Vec<String> = Vec::new();
    let mut unreachable: Vec<String> = Vec::new();

    // Fragmentene fra `fristil overta`, så markupen for en kopi sjekkes også.
    let manifests: Vec<&str> = arguments
        .iter()
        .filter_map(|a| a.strip_prefix("--manifest="))
        .collect();
    let inputs: Vec<&String> = arguments
        .iter()
        .filter(|a| *a != "--rendret" && !a.starts_with("--manifest=") && !a.starts_with("--css="))
        .collect();
    let vocabulary = vocabulary(&manifests);
    // Stilarkene, så sjekken også ser det som ikke er stylet.
    let style_sheets: Vec<&str> = arguments
        .iter()
        .filter_map(|a| a.strip_prefix("--css="))
        .collect();
    let styles = (!style_sheets.is_empty()).then(|| read_style_sheets(&style_sheets));

    if inputs.is_empty() {
        // WASI kan ikke se om standard inn er en terminal, så verten sier
        // det. Chicory melder et rør som en terminal, så som WASI-modul
        // stoler kommandolinja bare på verten.
        let terminal = if cfg!(target_os = "wasi") {
            std::env::var("FRISTIL_TERMINAL").is_ok_and(|v| v == "1")
        } else {
            std::io::stdin().is_terminal()
        };
        if terminal {
            error("Leser markup fra standard inn. Avslutt med Ctrl-D.");
        }
        let bytes = read_all_input();
        let text = String::from_utf8_lossy(&bytes).into_owned();
        // Tom inndata er ikke markup som stemmer. Et glob som ikke traff noe,
        // ville ellers meldt grønt uten å ha sett på noe.
        if text.trim().is_empty() {
            fail("Ingen markup å sjekke: standard inn var tom.");
        }
        sources.push(Source {
            name: "stdin".into(),
            text,
            page: rendered,
        });
    }

    for input in inputs {
        // En side verten alt har hentet, i stedet for adressen. Se
        // `fetch::from_host`.
        let answer = if let Some(file) = input.strip_prefix("--hentet=") {
            Some(fetch::from_host(file))
        } else if fetch::is_address(input) {
            Some(fetch::page(input))
        } else {
            None
        };
        match answer {
            Some(Ok((address, text))) => sources.push(Source {
                name: address,
                text,
                page: true,
            }),
            Some(Err(reason)) => unreachable.push(reason),
            None => match std::fs::read(input) {
                Ok(bytes) => sources.push(Source {
                    name: input.clone(),
                    text: String::from_utf8_lossy(&bytes).into_owned(),
                    page: rendered,
                }),
                Err(_) => missing.push(input.clone()),
            },
        }
    }

    if !missing.is_empty() || !unreachable.is_empty() {
        for path in &missing {
            error(&format!("Fant ikke fila «{}».", shown(path)));
        }
        for reason in &unreachable {
            error(reason);
        }
        std::process::exit(1);
    }

    let mut found = 0;
    for source in &sources {
        let text = utf16(&source.text);
        let findings = match &styles {
            Some(styles) => diagnose_styled(&text, &vocabulary, styles, source.page),
            None if source.page => diagnose_page(&text, &vocabulary),
            None => diagnose_markup(&text, &vocabulary),
        };
        let lines = Lines::new(&text);
        for finding in findings {
            found += 1;
            let (line, column) = lines.line_and_column(finding.start);
            let kind = match finding.severity {
                Severity::Error => "feil",
                Severity::Warning => "advarsel",
            };
            log(&format!(
                "{}:{line}:{column}: {kind}: {}",
                shown(&source.name),
                finding.message
            ));
        }
    }

    let files = count(sources.len(), "fil", "filer");
    if found > 0 {
        fail(&format!("\n{found} funn i {files}."));
    }
    log(&format!("Markupen stemmer med Fristil i {files}."));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_paths() {
        assert_eq!(
            normalized(std::path::Path::new("a/../b/./y.css")),
            std::path::PathBuf::from("b/y.css")
        );
        assert_eq!(
            normalized(std::path::Path::new("../a/x.css")),
            std::path::PathBuf::from("../a/x.css")
        );
        assert_eq!(
            normalized(std::path::Path::new("/r/a/../b")),
            std::path::PathBuf::from("/r/b")
        );
    }

    #[test]
    fn style_sheets_that_import_each_other_are_read_once() {
        let root = std::env::temp_dir().join(format!("fristil-import-{}", std::process::id()));
        std::fs::create_dir_all(root.join("a")).unwrap();
        std::fs::create_dir_all(root.join("b")).unwrap();
        std::fs::write(root.join("a/x.css"), "@import \"../b/y.css\";\n.fs-a { }").unwrap();
        std::fs::write(root.join("b/y.css"), "@import \"../a/x.css\";\n.fs-b { }").unwrap();
        let start = root.join("a/x.css");
        let styles = read_style_sheets(&[start.to_str().unwrap()]);
        assert!(styles.classes.contains("fs-a") && styles.classes.contains("fs-b"));
        assert_eq!(styles.imports.len(), 2, "hvert stilark leses én gang");
        std::fs::remove_dir_all(root).unwrap();
    }
}

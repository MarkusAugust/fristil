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
use crate::output::{count, error, fail, log};
use fristil_kjerne::text::utf16;
use fristil_kjerne::types::Severity;
use fristil_kjerne::{diagnose_markup, diagnose_page, manifest, Lines};

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
                "Fant ikke manifestet «{path}».\n\nFragmentet skrives av fristil overta, ved siden av kopien.\n"
            ));
        };
        let text = String::from_utf8_lossy(&bytes).into_owned();
        if let Err(reason) = manifest::with_fragments(&[&text]) {
            fail(&format!(
                "«{path}» kan ikke leses som et manifest: {reason}\n"
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
        .filter(|a| *a != "--rendret" && !a.starts_with("--manifest="))
        .collect();
    let vocabulary = vocabulary(&manifests);

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
            error(&format!("Fant ikke fila «{path}»."));
        }
        for reason in &unreachable {
            error(reason);
        }
        std::process::exit(1);
    }

    let mut found = 0;
    for source in &sources {
        let text = utf16(&source.text);
        let findings = if source.page {
            diagnose_page(&text, &vocabulary)
        } else {
            diagnose_markup(&text, &vocabulary)
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
                source.name, finding.message
            ));
        }
    }

    let files = count(sources.len(), "fil", "filer");
    if found > 0 {
        fail(&format!("\n{found} funn i {files}."));
    }
    log(&format!("Markupen stemmer med Fristil i {files}."));
}

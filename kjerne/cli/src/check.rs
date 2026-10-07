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

    let inputs: Vec<&String> = arguments.iter().filter(|a| *a != "--rendret").collect();

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

    let vocabulary = manifest::current();
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

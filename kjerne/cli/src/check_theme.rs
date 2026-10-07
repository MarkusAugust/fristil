//! `fristil sjekk-tema <fil…>`: kontrollerer et tema noen har skrevet selv.
//!
//! Generatoren holder løftene av konstruksjon, men et tema skrevet for hånd er
//! konsumentens ansvar. Uten denne kommandoen er «du kan overstyre hvilken som
//! helst celle» en felle.
//!
//! Tellingen står sist og krever at tallet er større enn null. En kjøring som
//! ikke fant en eneste fil skal ikke kunne se ut som en kjøring uten funn.

use std::io::ErrorKind;

use crate::output::{count, error, fail, log};
use fristil_kjerne::theme::check::inspect_theme;

pub fn run(arguments: &[String]) {
    // Et ukjent flagg skal stoppe kjøringen, ikke forsvinne: en skrivefeil i
    // et flagg ser ut som om kommandoen gjorde det du ba om.
    let unknown: Vec<&str> = arguments
        .iter()
        .filter(|a| a.starts_with('-'))
        .map(String::as_str)
        .collect();
    if !unknown.is_empty() {
        fail(&format!(
            "Ukjent flagg: {}.\n\n`fristil sjekk-tema` tar bare filnavn.\n",
            unknown.join(", ")
        ));
    }
    if arguments.is_empty() {
        fail("Oppgi minst én CSS-fil: `fristil sjekk-tema tema.css`.\n\nKommandoen leser --fs-color-*-verdiene i fila og kontrollerer at hvert kontrastløfte holder, i hver blokk.\n");
    }

    // Filer som ikke lot seg lese samles og meldes samlet.
    let mut sources: Vec<(&str, String)> = Vec::new();
    let mut unreadable: Vec<String> = Vec::new();
    for path in arguments {
        let read = std::fs::metadata(path).and_then(|m| {
            if m.is_dir() {
                Err(std::io::Error::from(ErrorKind::IsADirectory))
            } else {
                std::fs::read(path)
            }
        });
        match read {
            Ok(bytes) => sources.push((path, String::from_utf8_lossy(&bytes).into_owned())),
            Err(e) => unreadable.push(match e.kind() {
                ErrorKind::IsADirectory => format!("{path} (er en mappe)"),
                ErrorKind::NotFound => format!("{path} (finnes ikke)"),
                ErrorKind::PermissionDenied => format!("{path} (EACCES)"),
                _ => format!("{path} (kunne ikke leses)"),
            }),
        }
    }
    if !unreadable.is_empty() {
        fail(&format!("Klarte ikke lese: {}.", unreadable.join(", ")));
    }

    let (mut problems, mut blocks, mut declarations, mut promises) = (0, 0, 0, 0);
    for (path, css) in &sources {
        let report = inspect_theme(css);
        for problem in &report.problems {
            error(&format!(
                "{path}  {}\n  {}",
                problem.selector, problem.message
            ));
            problems += 1;
        }
        blocks += report.blocks;
        declarations += report.declarations;
        promises += report.promises;
    }

    // Tellingen står sist, og teller konsumentens egne verdier: standardverdiene
    // fyller hullene, så én linje gir like mange løfter som et helt tema.
    let files = count(sources.len(), "fil", "filer");
    let summary = format!(
        "{} i {}, mot {}, i {files}",
        count(declarations, "verdi", "verdier"),
        count(blocks, "blokk", "blokker"),
        count(promises, "løfte", "løfter"),
    );
    if declarations == 0 && problems == 0 {
        fail(&format!(
            "Fant ingen --fs-color-*-verdier i {files}. Sjekken har ikke sett på noe."
        ));
    }
    if problems > 0 {
        fail(&format!(
            "\n{}. Kontrollerte {summary}.",
            count(problems, "problem", "problemer")
        ));
    }
    log(&format!(
        "Temaet holder hvert løfte. Kontrollerte {summary}."
    ));
}

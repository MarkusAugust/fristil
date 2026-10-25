//! `lotek manifest`: manifestet sjekken bruker, med fragmentene fra
//! `lotek overta` lagt til.
//!
//! ```bash
//! lotek manifest --manifest=src/ui/button/lotek-manifest.json --ut=build/lotek/manifest.json
//! ```
//!
//! Det er det Gradle-pluginen skriver til `build/lotek/`, så en editor kan
//! lese ordforrådet prosjektet faktisk har, med de overtatte komponentene.

use crate::check::read_fragments;
use crate::output::{count, error, fail, log, shown};
use crate::{refuse_without_value, Arguments};
use lotek_core::json::Json;
use lotek_core::manifest::merged;

pub fn run(arguments: &[String]) {
    let parsed = Arguments::read(arguments);
    refuse_without_value(&parsed);
    let manifests: Vec<&str> = arguments
        .iter()
        .filter_map(|a| a.strip_prefix("--manifest="))
        .collect();
    let unknown: Vec<String> = parsed
        .flags
        .iter()
        .map(|(n, _)| n.as_str())
        .filter(|n| !["manifest", "ut"].contains(n))
        .map(|n| format!("--{n}"))
        .chain(parsed.files.iter().cloned())
        .collect();
    if !unknown.is_empty() {
        fail(&format!(
            "Ukjent argument: {}\n\nKjente flagg: --manifest, --ut\n\nHele oversikten: lotek --hjelp\n",
            unknown.join(", ")
        ));
    }

    let base = crate::package::manifest();
    let texts = read_fragments(&base, &manifests);
    let all: Vec<&str> = texts.iter().map(String::as_str).collect();
    let json = match merged(&base, &all) {
        // Skjemaet er oppgitt med en sti ved siden av manifestet i pakken,
        // og den finnes ikke der denne fila skrives.
        Ok(Json::Object(entries)) => format!(
            "{}\n",
            Json::Object(
                entries
                    .into_iter()
                    .filter(|(k, _)| k != "$schema")
                    .collect()
            )
            .to_pretty()
        ),
        Ok(json) => format!("{}\n", json.to_pretty()),
        Err(reason) => fail(&format!("Manifestene kan ikke leses sammen: {reason}\n")),
    };
    match parsed.flag("ut") {
        Some(path) => {
            if let Some(folder) = std::path::Path::new(path).parent() {
                let _ = std::fs::create_dir_all(folder);
            }
            if let Err(e) = std::fs::write(path, &json) {
                fail(&format!("Klarte ikke skrive {}: {e}", shown(path)));
            }
            error(&format!(
                "Skrev {}, med {}.",
                shown(path),
                count(manifests.len(), "fragment", "fragmenter")
            ));
        }
        None => log(json.trim_end()),
    }
}

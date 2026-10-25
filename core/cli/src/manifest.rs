//! `lotek manifest`: the manifest the check uses, with the fragments from
//! `lotek takeover` added.
//!
//! ```bash
//! lotek manifest --manifest=src/ui/button/lotek-manifest.json --out=build/lotek/manifest.json
//! ```
//!
//! That is what the Gradle plugin writes to `build/lotek/`, so an editor can
//! read the vocabulary the project actually has, with the taken-over
//! components.

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
        .filter(|n| !["manifest", "out"].contains(n))
        .map(|n| format!("--{n}"))
        .chain(parsed.files.iter().cloned())
        .collect();
    if !unknown.is_empty() {
        fail(&format!(
            "Unknown argument: {}\n\nKnown flags: --manifest, --out\n\nFull overview: lotek --help\n",
            unknown.join(", ")
        ));
    }

    let base = crate::package::manifest();
    let texts = read_fragments(&base, &manifests);
    let all: Vec<&str> = texts.iter().map(String::as_str).collect();
    let json = match merged(&base, &all) {
        // The schema is given as a path next to the manifest in the package,
        // and that path does not exist where this file is written.
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
        Err(reason) => fail(&format!(
            "The manifests cannot be read together: {reason}\n"
        )),
    };
    match parsed.flag("out") {
        Some(path) => {
            if let Some(folder) = std::path::Path::new(path).parent() {
                let _ = std::fs::create_dir_all(folder);
            }
            if let Err(e) = std::fs::write(path, &json) {
                fail(&format!("Could not write {}: {e}", shown(path)));
            }
            error(&format!(
                "Wrote {}, with {}.",
                shown(path),
                count(manifests.len(), "fragment", "fragments")
            ));
        }
        None => log(json.trim_end()),
    }
}

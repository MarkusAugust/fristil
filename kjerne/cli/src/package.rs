//! Pakken kommandolinja leser manifestet, fargekontrakten, regelbøkene og
//! komponentene fra: `FRISTIL_PACKAGE`, som verten setter, ellers
//! `node_modules/@fristil/designsystem` i arbeidsmappa eller over den. Se
//! `README.md`.

use std::path::{Path, PathBuf};

use crate::output::{fail, shown};

const INSTALLED: &str = "node_modules/@fristil/designsystem";

/// Mappa verten har gitt i `FRISTIL_PACKAGE`, om den har gitt en. Testene
/// leser pakken i repoet, som bygget aldri gjør.
pub fn given() -> Option<PathBuf> {
    let given = std::env::var_os("FRISTIL_PACKAGE").map(PathBuf::from);
    #[cfg(test)]
    let given = given.or_else(|| {
        Some(PathBuf::from(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../designsystem"
        )))
    });
    given
}

/// Den nærmeste `node_modules/@fristil/designsystem` fra `start` og oppover.
fn installed_from(start: &Path) -> Option<PathBuf> {
    start
        .ancestors()
        .map(|here| here.join(INSTALLED))
        .find(|candidate| candidate.is_dir())
}

/// Mappa med pakken, om den finnes.
pub fn dir() -> Option<PathBuf> {
    if let Some(given) = given() {
        return Some(given);
    }
    installed_from(&std::env::current_dir().ok()?)
}

/// Mappa med pakken, eller en forklaring og feilkode.
pub fn require() -> PathBuf {
    dir().unwrap_or_else(|| {
        fail("Fant ikke @fristil/designsystem. Kommandolinja leser manifestet, fargekontrakten, regelbøkene og komponentene fra pakken.\n\nInstaller pakken i prosjektet, eller sett FRISTIL_PACKAGE til mappa den ligger i.\n")
    })
}

/// Teksten i en fil i pakken, eller en forklaring og feilkode.
pub fn read(path: &str) -> String {
    let file = require().join(path);
    match std::fs::read(&file) {
        Ok(bytes) => String::from_utf8_lossy(&bytes).into_owned(),
        Err(_) => fail(&format!(
            "Fant ikke {}. Pakken mangler fila, eller er ikke @fristil/designsystem.\n",
            shown(&file.to_string_lossy())
        )),
    }
}

/// Manifestet i pakken.
pub fn manifest() -> String {
    read("manifest/manifest.json")
}

/// Lista over regelbøkene og komponentfilene i pakken, `manifest/filer.json`.
/// Kommandolinja leser den framfor mappene, som ikke lot seg lese gjennom
/// Nodes WASI på Windows.
pub fn files() -> fristil_kjerne::json::Json {
    fristil_kjerne::json::parse(&read("manifest/filer.json")).unwrap_or_else(|e| {
        fail(&format!(
            "manifest/filer.json i pakken kan ikke leses: {e}\n"
        ))
    })
}

/// Gir kjernen fargekontrakten i pakken, før et tema bygges eller sjekkes.
pub fn load_contract() {
    let text = read("src/tokens/fargekontrakt.json");
    if let Err(reason) = fristil_kjerne::theme::contract::load(&text) {
        fail(&format!(
            "Fargekontrakten i pakken kan ikke leses: {reason}\n"
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_the_nearest_installed_package_and_nothing_without_one() {
        let root = std::env::temp_dir().join(format!("fristil-pakke-test-{}", std::process::id()));
        let deep = root.join("apps/web/src");
        std::fs::create_dir_all(&deep).unwrap();
        assert_eq!(installed_from(&deep), None, "ingen pakke skal gi ingenting");

        let package = root.join("apps/web").join(INSTALLED);
        std::fs::create_dir_all(&package).unwrap();
        std::fs::create_dir_all(root.join(INSTALLED)).unwrap();
        assert_eq!(installed_from(&deep), Some(package), "den nærmeste vinner");
        std::fs::remove_dir_all(&root).unwrap();
    }
}

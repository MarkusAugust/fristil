//! Pakken kommandolinja leser manifestet, fargekontrakten, regelbøkene og
//! komponentene fra: `FRISTIL_PACKAGE`, som verten setter, ellers
//! `node_modules/@fristil/designsystem` i arbeidsmappa eller over den. Se
//! `README.md`.

use std::path::PathBuf;

use crate::output::{fail, shown};

const INSTALLED: &str = "node_modules/@fristil/designsystem";

/// Mappa med pakken, om den finnes.
pub fn dir() -> Option<PathBuf> {
    if let Ok(given) = std::env::var("FRISTIL_PACKAGE") {
        return Some(PathBuf::from(given));
    }
    let start = std::env::current_dir().ok()?;
    if let Some(found) = start
        .ancestors()
        .map(|here| here.join(INSTALLED))
        .find(|candidate| candidate.is_dir())
    {
        return Some(found);
    }
    // Testene leser pakken i repoet, som bygget aldri gjør.
    #[cfg(test)]
    return Some(PathBuf::from(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../designsystem"
    )));
    #[cfg(not(test))]
    None
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

/// Gir kjernen fargekontrakten i pakken, før et tema bygges eller sjekkes.
pub fn load_contract() {
    let text = read("src/tokens/fargekontrakt.json");
    if let Err(reason) = fristil_kjerne::theme::contract::load(&text) {
        fail(&format!(
            "Fargekontrakten i pakken kan ikke leses: {reason}\n"
        ));
    }
}

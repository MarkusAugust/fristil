//! The package the command line reads the manifest, the colour contract, the
//! rulebooks and the components from: `LOTEK_PACKAGE`, which the host sets,
//! otherwise `node_modules/@lo-tek/interfaces` in the working directory or
//! above it. See `README.md`.

use std::path::{Path, PathBuf};

use crate::output::{fail, shown};

const INSTALLED: &str = "node_modules/@lo-tek/interfaces";

/// The folder the host has given in `LOTEK_PACKAGE`, if it has given one. The
/// tests read the package in the repository, which the build never does.
pub fn given() -> Option<PathBuf> {
    let given = std::env::var_os("LOTEK_PACKAGE").map(PathBuf::from);
    #[cfg(test)]
    let given = given.or_else(|| {
        Some(PathBuf::from(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../interfaces"
        )))
    });
    given
}

/// The nearest `node_modules/@lo-tek/interfaces` from `start` upwards.
fn installed_from(start: &Path) -> Option<PathBuf> {
    start
        .ancestors()
        .map(|here| here.join(INSTALLED))
        .find(|candidate| candidate.is_dir())
}

/// The folder with the package, if it exists.
pub fn dir() -> Option<PathBuf> {
    if let Some(given) = given() {
        return Some(given);
    }
    installed_from(&std::env::current_dir().ok()?)
}

/// The folder with the package, or an explanation and an error code.
pub fn require() -> PathBuf {
    dir().unwrap_or_else(|| {
        fail("@lo-tek/interfaces not found. The command line reads the manifest, the colour contract, the rulebooks and the components from the package.\n\nInstall the package in the project, or set LOTEK_PACKAGE to the folder it is in.\n")
    })
}

/// The text of a file in the package, or an explanation and an error code.
pub fn read(path: &str) -> String {
    let file = require().join(path);
    match std::fs::read(&file) {
        Ok(bytes) => String::from_utf8_lossy(&bytes).into_owned(),
        Err(_) => fail(&format!(
            "File not found: {}. The package is missing the file, or is not @lo-tek/interfaces.\n",
            shown(&file.to_string_lossy())
        )),
    }
}

/// The manifest in the package.
pub fn manifest() -> String {
    read("manifest/manifest.json")
}

/// The list of rulebooks and component files in the package,
/// `manifest/files.json`. The command line reads it rather than the folders,
/// which could not be read through Node's WASI on Windows.
pub fn files() -> lotek_core::json::Json {
    lotek_core::json::parse(&read("manifest/files.json")).unwrap_or_else(|e| {
        fail(&format!(
            "manifest/files.json in the package cannot be read: {e}\n"
        ))
    })
}

/// Gives the core the colour contract in the package, before a theme is built
/// or checked.
pub fn load_contract() {
    let text = read("src/tokens/color-contract.json");
    if let Err(reason) = lotek_core::theme::contract::load(&text) {
        fail(&format!(
            "The colour contract in the package cannot be read: {reason}\n"
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_the_nearest_installed_package_and_nothing_without_one() {
        let root = std::env::temp_dir().join(format!("lotek-package-test-{}", std::process::id()));
        let deep = root.join("apps/web/src");
        std::fs::create_dir_all(&deep).unwrap();
        assert_eq!(installed_from(&deep), None, "no package gives nothing");

        let package = root.join("apps/web").join(INSTALLED);
        std::fs::create_dir_all(&package).unwrap();
        std::fs::create_dir_all(root.join(INSTALLED)).unwrap();
        assert_eq!(installed_from(&deep), Some(package), "the nearest wins");
        std::fs::remove_dir_all(&root).unwrap();
    }
}

//! Bygger kildekoden til komponentene inn i kommandolinja, så `fristil overta`
//! virker likt i npm, på JVM-en, i wasmtime og som kjørbar fil, uten å lete
//! etter pakken på disken.
//!
//! Komponentene ligger i `designsystem/src/components/<kategori>/<navn>/`.
//! Testene tas ikke med: de hører til pakkens eget oppsett.

use std::fmt::Write;
use std::path::Path;

const CATEGORIES: [&str; 3] = ["css", "ramme", "frittstaende"];

fn main() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../designsystem");
    let components = root.join("src/components");
    println!("cargo:rerun-if-changed={}", components.display());

    let mut out = String::from("pub static COMPONENTS: &[Component] = &[\n");
    for category in CATEGORIES {
        let directory = components.join(category);
        println!("cargo:rerun-if-changed={}", directory.display());
        let Ok(entries) = std::fs::read_dir(&directory) else {
            continue;
        };
        let mut names: Vec<String> = entries
            .flatten()
            .filter(|e| e.path().is_dir())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        for name in names {
            let folder = directory.join(&name);
            println!("cargo:rerun-if-changed={}", folder.display());
            let mut files: Vec<String> = std::fs::read_dir(&folder)
                .unwrap()
                .flatten()
                .filter(|e| e.path().is_file())
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .filter(|f| !f.contains(".test."))
                .collect();
            files.sort();
            writeln!(
                out,
                "    Component {{ category: {category:?}, name: {name:?}, files: &["
            )
            .unwrap();
            for file in files {
                let path = folder.join(&file).canonicalize().unwrap();
                println!("cargo:rerun-if-changed={}", path.display());
                writeln!(
                    out,
                    "        ({file:?}, include_str!({:?})),",
                    path.display().to_string()
                )
                .unwrap();
            }
            out.push_str("    ] },\n");
        }
    }
    out.push_str("];\n");

    let target = Path::new(&std::env::var("OUT_DIR").unwrap()).join("components.rs");
    std::fs::write(target, out).unwrap();
}

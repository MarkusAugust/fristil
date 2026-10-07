//! `fristil agent`: regelboka for dette prosjektet, til utdata.
//!
//! Til utdata, ikke til en fil. `AGENTS.md`, `CLAUDE.md` og
//! `.github/copilot-instructions.md` er konsumentens egne filer. Vil noen ha
//! regelboka på disk, er det ett rør unna, og da er det deres beslutning.
//!
//! Regelbøkene er bygget inn, så de følger versjonen av programmet. Valget av
//! miljø skrives til feilkanalen, så utdata kan pipes rent.

use crate::output::{error, fail, write};
use crate::{refuse_without_value, Arguments};
use fristil_kjerne::json::{parse, Json};

const RULEBOOKS: [(&str, &str); 6] = [
    ("html", include_str!("../../../designsystem/agent/html.md")),
    (
        "maler",
        include_str!("../../../designsystem/agent/maler.md"),
    ),
    (
        "bundles",
        include_str!("../../../designsystem/agent/bundles.md"),
    ),
    (
        "react",
        include_str!("../../../designsystem/agent/react.md"),
    ),
    (
        "astro",
        include_str!("../../../designsystem/agent/astro.md"),
    ),
    (
        "datastar",
        include_str!("../../../designsystem/agent/datastar.md"),
    ),
];

/// Rammeverk som deler regelbok: Vue, Svelte, Solid og Lit gjør det samme med
/// stilarkene, attributtnavnene og registreringen.
const ALIASES: [(&str, &str); 6] = [
    ("vue", "bundles"),
    ("svelte", "bundles"),
    ("solid", "bundles"),
    ("solid-js", "bundles"),
    ("lit", "bundles"),
    ("vite", "bundles"),
];

/// Avhengigheten som avgjør miljøet, i den rekkefølgen den leses. Astro står
/// først, siden en Astro-app med React-øyer har begge, og `vite` sist.
const DEPENDENCY_HINTS: [(&str, &str); 8] = [
    ("astro", "astro"),
    ("react", "react"),
    ("vue", "bundles"),
    ("svelte", "bundles"),
    ("solid-js", "bundles"),
    ("lit", "bundles"),
    ("@starfederation/datastar-sdk", "datastar"),
    ("vite", "bundles"),
];

/// Navnene i et objekt, slik `{ ...verdi }` ser dem.
fn keys(value: Option<&Json>) -> Vec<String> {
    match value {
        Some(Json::Object(entries)) => entries.iter().map(|(k, _)| k.clone()).collect(),
        Some(Json::Array(items)) => (0..items.len()).map(|i| i.to_string()).collect(),
        Some(Json::String(s)) => (0..s.encode_utf16().count())
            .map(|i| i.to_string())
            .collect(),
        _ => Vec::new(),
    }
}

/// Miljøet prosjektet i arbeidsmappa bruker, og hvorfor vi tror det.
fn detect_framework() -> (String, String) {
    let Ok(text) = std::fs::read_to_string("package.json") else {
        // Go, Kotlin, PHP og Razor har ingen package.json. Da er markupen
        // serverens, og malregelboka er den som forteller hvordan sjekken
        // leser malsyntaks.
        return ("maler".into(), "ingen package.json i denne mappa".into());
    };
    let manifest = match parse(&text) {
        Ok(Json::Null | Json::Bool(_) | Json::Number(_) | Json::String(_)) => {
            return ("maler".into(), "package.json er ikke et objekt".into())
        }
        Ok(value) => value,
        Err(_) => return ("maler".into(), "package.json kunne ikke leses".into()),
    };
    let mut dependencies = keys(manifest.get("dependencies"));
    dependencies.extend(keys(manifest.get("devDependencies")));
    for (dependency, framework) in DEPENDENCY_HINTS {
        if dependencies.iter().any(|d| d == dependency) {
            return (
                framework.into(),
                format!("{dependency} står i package.json"),
            );
        }
    }
    // Det finnes en package.json, så det finnes et byggesteg. Da importeres
    // stilarkene, og `<link>`-regelboka ville sendt agenten feil vei.
    (
        "bundles".into(),
        "package.json nevner ingen kjent rammeverk".into(),
    )
}

pub fn run(arguments: &[String]) {
    let arguments = Arguments::read(arguments);
    refuse_without_value(&arguments);

    let (chosen, reason) = match arguments.flag("rammeverk") {
        Some(requested) => (requested.to_string(), "oppgitt med --rammeverk".to_string()),
        None => detect_framework(),
    };
    let name = if RULEBOOKS.iter().any(|(n, _)| *n == chosen) {
        Some(chosen.as_str())
    } else {
        ALIASES.iter().find(|(a, _)| *a == chosen).map(|(_, n)| *n)
    };
    let Some((name, book)) = name.and_then(|n| RULEBOOKS.iter().find(|(r, _)| *r == n)) else {
        let names: Vec<&str> = RULEBOOKS.iter().map(|(n, _)| *n).collect();
        fail(&format!(
            "Kjenner ikke «{chosen}».\n\nVelg mellom: {}\n\nVue, Svelte, Solid og Lit deler «bundles», siden de gjør det samme med\nstilarkene, attributtnavnene og registreringen.\n",
            names.join(", ")
        ));
    };
    // Aliaset skal være synlig: den som ba om «svelte» skal se at svaret er
    // bundles-regelboka.
    let via = if *name == chosen {
        String::new()
    } else {
        format!(" via {chosen}")
    };
    error(&format!("Regelboka for {name}{via} ({reason})."));
    write(book);
}

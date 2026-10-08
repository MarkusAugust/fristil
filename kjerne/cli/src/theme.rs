//! `fristil tema`: et fargetema av merkefargene, skriften og formen din.
//!
//! ```bash
//! fristil tema --aksent=#7c3aed --fare=#b3261e --ut=tema.css
//! fristil tema fristil.tema.json --ut=tema.css
//! ```
//!
//! Temaet bygges av kjernen, og løftene holder av konstruksjon. Holder et par
//! likevel ikke, avsluttes kjøringen med feil framfor å levere et tema som ser
//! riktig ut. Et flagg eller en nøkkel som ikke finnes, stopper kjøringen: en
//! skrivefeil skal ikke se ut som om kommandoen gjorde det du ba om.

use crate::output::{error, fail, log, shown};
use crate::Arguments;
use fristil_kjerne::json::{parse, Json};
use fristil_kjerne::theme::{build_theme, js_number, to_fixed2};

/// Fargene, med flaggets norske navn og familiens engelske.
const COLORS: [(&str, &str); 9] = [
    ("aksent", "accent"),
    ("fare", "danger"),
    ("suksess", "success"),
    ("advarsel", "warning"),
    ("noytral", "neutral"),
    ("besokt", "visited"),
    ("merke1", "brand1"),
    ("merke2", "brand2"),
    ("merke3", "brand3"),
];

const TYPOGRAPHY_FLAGS: [(&str, &str); 1] = [("skrift", "fontFamily")];

const SHAPE_FLAGS: [(&str, &str); 5] = [
    ("knapp-hjorner", "buttonRadius"),
    ("felt-hjorner", "fieldRadius"),
    ("flate-hjorner", "surfaceRadius"),
    ("knapp-ramme", "buttonBorderWidth"),
    ("knapp-vekt", "buttonFontWeight"),
];

const TYPOGRAPHY_KEYS: [&str; 3] = ["fontFamily", "weights", "lineHeights"];
const WEIGHT_KEYS: [&str; 4] = ["regular", "medium", "semibold", "bold"];
const LINE_KEYS: [&str; 4] = ["default", "heading", "article", "compact"];
const SHAPE_KEYS: [&str; 5] = [
    "buttonRadius",
    "fieldRadius",
    "surfaceRadius",
    "buttonBorderWidth",
    "buttonFontWeight",
];

type Object = Vec<(String, Json)>;

fn set(object: &mut Object, key: &str, value: Json) {
    match object.iter_mut().find(|(k, _)| k == key) {
        Some(existing) => existing.1 = value,
        None => object.push((key.to_string(), value)),
    }
}

/// `{ ...verdi }`: navnene og verdiene slik JavaScript sprer dem.
fn spread(value: Option<&Json>) -> Object {
    match value {
        Some(Json::Object(entries)) => entries.clone(),
        Some(Json::Array(items)) => items
            .iter()
            .enumerate()
            .map(|(i, v)| (i.to_string(), v.clone()))
            .collect(),
        Some(Json::String(s)) => s
            .encode_utf16()
            .enumerate()
            .map(|(i, u)| (i.to_string(), Json::String(String::from_utf16_lossy(&[u]))))
            .collect(),
        _ => Vec::new(),
    }
}

/// `a ?? b`: `b` når `a` mangler eller er `null`.
fn coalesce<'a>(a: Option<&'a Json>, b: Option<&'a Json>) -> Option<&'a Json> {
    match a {
        None | Some(Json::Null) => b,
        some => some,
    }
}

/// Nøklene i et objekt som ikke står i lista, med stien foran.
fn unknown_keys(value: Option<&Json>, allowed: &[&str], path: &str) -> Vec<String> {
    let keys: Vec<String> = match value {
        Some(Json::Object(entries)) => entries.iter().map(|(k, _)| k.clone()).collect(),
        Some(Json::Array(items)) => (0..items.len()).map(|i| i.to_string()).collect(),
        _ => Vec::new(),
    };
    keys.into_iter()
        .filter(|k| !allowed.contains(&k.as_str()))
        .map(|k| format!("{path}.{k}"))
        .collect()
}

/// Oppskriften i en JSON-fil, eller en forklaring og feilkode.
fn read_recipe(file: &str) -> Object {
    let path = shown(file);
    let Ok(bytes) = std::fs::read(file) else {
        fail(&format!(
            "Fant ikke fila «{path}».\n\nOppgi en JSON-fil med fargene, eller sett dem som flagg. Se `fristil --hjelp`.\n"
        ));
    };
    match parse(&String::from_utf8_lossy(&bytes)) {
        Ok(Json::Object(entries)) => entries,
        // `null`, en liste og en streng er alle gyldig JSON, og ingen av dem
        // er en oppskrift.
        Ok(_) => fail(&format!(
            "«{path}» er gyldig JSON, men ikke en oppskrift.\n\nFila skal være et objekt med fargene i seg, for eksempel:\n  {{\"aksent\": \"#7c3aed\", \"fare\": \"#b3261e\"}}\n"
        )),
        Err(reason) => fail(&format!("«{path}» er ikke gyldig JSON: {reason}\n")),
    }
}

pub fn run(arguments: &[String]) {
    let arguments = Arguments::read(arguments);
    let recipe: Object = match arguments.files.first() {
        Some(path) => read_recipe(path),
        None => Vec::new(),
    };
    let from_file = Json::Object(recipe.clone());

    let mut input: Object = Vec::new();
    for (norwegian, english) in COLORS {
        let value = match arguments.flag(norwegian) {
            Some(v) => Some(Json::String(v.to_string())),
            None => coalesce(from_file.get(norwegian), from_file.get(english)).cloned(),
        };
        if let Some(Json::String(s)) = value {
            if !s.is_empty() {
                set(&mut input, english, Json::String(s));
            }
        }
    }

    // Skrift og form kan komme fra fila eller fra flagg, og flagget vinner.
    // Fila kan skrive dem på norsk eller engelsk, som fargene.
    let mut typography = spread(coalesce(
        from_file.get("typography"),
        from_file.get("typografi"),
    ));
    for (flag, key) in TYPOGRAPHY_FLAGS {
        if let Some(v) = arguments.flag(flag) {
            set(&mut typography, key, Json::String(v.to_string()));
        }
    }
    let mut shape = spread(coalesce(from_file.get("shape"), from_file.get("form")));
    for (flag, key) in SHAPE_FLAGS {
        if let Some(v) = arguments.flag(flag) {
            set(&mut shape, key, Json::String(v.to_string()));
        }
    }
    let typography = Json::Object(typography);
    let shape = Json::Object(shape);
    if typography.as_object().is_some_and(|o| !o.is_empty()) {
        set(&mut input, "typography", typography.clone());
    }
    if shape.as_object().is_some_and(|o| !o.is_empty()) {
        set(&mut input, "shape", shape.clone());
    }

    let known: Vec<&str> = COLORS
        .iter()
        .map(|(n, _)| *n)
        .chain(TYPOGRAPHY_FLAGS.iter().map(|(n, _)| *n))
        .chain(SHAPE_FLAGS.iter().map(|(n, _)| *n))
        .chain(["ut"])
        .collect();
    let unknown_flags: Vec<&str> = arguments
        .flags
        .iter()
        .map(|(n, _)| n.as_str())
        .filter(|n| !known.contains(n))
        .collect();

    // Nøklene i oppskriftsfila, som kan komme fra et annet repo, der en
    // skrivefeil er vanskeligere å oppdage enn en på kommandolinja.
    let top_level: Vec<&str> = COLORS
        .iter()
        .flat_map(|(n, e)| [*n, *e])
        .chain(["typografi", "typography", "form", "shape", "$schema"])
        .collect();
    let mut unknown: Vec<String> = recipe
        .iter()
        .map(|(k, _)| k.clone())
        .filter(|k| !top_level.contains(&k.as_str()))
        .collect();
    unknown.extend(unknown_keys(
        Some(&typography),
        &TYPOGRAPHY_KEYS,
        "typografi",
    ));
    unknown.extend(unknown_keys(
        typography.get("weights"),
        &WEIGHT_KEYS,
        "typografi.weights",
    ));
    unknown.extend(unknown_keys(
        typography.get("lineHeights"),
        &LINE_KEYS,
        "typografi.lineHeights",
    ));
    unknown.extend(unknown_keys(Some(&shape), &SHAPE_KEYS, "form"));

    if !unknown.is_empty() {
        fail(&format!(
            "Ukjent nøkkel i oppskriften: {}\n\nHele oversikten: fristil --hjelp\n",
            unknown.join(", ")
        ));
    }
    if !unknown_flags.is_empty() {
        let shown: Vec<String> = unknown_flags.iter().map(|n| format!("--{n}")).collect();
        let all: Vec<String> = known.iter().map(|n| format!("--{n}")).collect();
        fail(&format!(
            "Ukjent flagg: {}\n\nKjente flagg: {}\n\nHele oversikten: fristil --hjelp\n",
            shown.join(", "),
            all.join(", ")
        ));
    }

    let theme = match build_theme(&Json::Object(input)) {
        Ok(theme) => theme,
        Err(message) => {
            // Hintet om heksadesimale farger står bare når feilen handler om
            // en farge, ikke om en verdi som kunne bryte ut av CSS-regelen.
            let about_colors = !message.contains("CSS-regel");
            fail(&format!(
                "\n{message}\n{}",
                if about_colors {
                    "\nFargene skrives som heksadesimale verdier, for eksempel #7c3aed.\n"
                } else {
                    ""
                }
            ));
        }
    };

    if !theme.violations.is_empty() {
        let lines: Vec<String> = theme
            .violations
            .iter()
            .map(|v| {
                format!(
                    "  {}: {} er {}:1, kravet er {}:1",
                    v.family,
                    v.promise,
                    to_fixed2(v.ratio),
                    js_number(v.required)
                )
            })
            .collect();
        fail(&format!(
            "\nTemaet holder ikke kontrastkravet:\n\n{}\n",
            lines.join("\n")
        ));
    }

    match arguments.flag("ut") {
        Some(path) => {
            if let Err(e) = std::fs::write(path, &theme.css) {
                fail(&format!("Klarte ikke skrive {}: {e}", shown(path)));
            }
            error(&format!(
                "\nSkrev {}. {} farger i hvert tema, alle løfter holder.",
                shown(path),
                theme.light.len()
            ));
        }
        None => log(&theme.css),
    }
}

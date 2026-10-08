//! Temaet: et helt fargetema av noen få merkefarger, og kontrollen av et tema
//! en konsument har skrevet selv.
//!
//! Temaet er kontrakten anvendt på konsumentens kulører. Kuløren er deres,
//! lysheten er rollens, og løftene holder av konstruksjon. Derfor finnes det
//! ikke noe justeringspass her: det er ingenting å flytte på.

pub mod check;
pub mod color;
pub mod contract;
#[cfg(test)]
mod tests;

use crate::json::Json;
use contract::{build_matrix, contract, Appearance, Violation};

/// `String.prototype.trim` i JavaScript: mellomrom slik JavaScript ser dem.
pub fn js_trim(s: &str) -> &str {
    s.trim_matches(is_js_space)
}

pub fn is_js_space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200a}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{3000}'
                | '\u{feff}'
    )
}

/// Et tall skrevet slik `String(tall)` gjør det i JavaScript: `600`, ikke `600.0`.
pub fn js_number(n: f64) -> String {
    if n == 0.0 {
        "0".into()
    } else if n.fract() == 0.0 && n.abs() < 1e21 {
        format!("{}", n as i128)
    } else {
        format!("{n}")
    }
}

/// `tall.toFixed(2)` i JavaScript: likt avstand rundes opp, ikke til partall.
pub fn to_fixed2(n: f64) -> String {
    let scaled = n * 100.0;
    let floor = scaled.floor();
    if scaled - floor == 0.5 {
        let up = (floor + 1.0) / 100.0;
        return format!("{up:.2}");
    }
    format!("{n:.2}")
}

/// Knappene, feltene og flatene som deler hjørne i temaet.
const BUTTONS: [&str; 3] = ["button", "pagination", "skip-link"];
const FIELDS: [&str; 3] = ["input", "select", "textarea"];
const SURFACES: [&str; 11] = [
    "card",
    "dialog",
    "popover",
    "alert",
    "accordion",
    "error-summary",
    "file-upload",
    "session-timeout",
    "suggestion",
    "toast",
    "tooltip",
];

/// Navnet brukeren skrev, til feilmeldingen.
///
/// Verdien lander i `--fs-button-radius`, men det var `buttonRadius` som ble
/// skrevet. En feilmelding som navngir vår egen variabel sender leseren til
/// feil sted i sin egen fil.
fn recipe_name(variable: &str) -> String {
    let named = match variable {
        "--fs-font-family-base" => "fontFamily",
        "--fs-font-weight-regular" => "weights.regular",
        "--fs-font-weight-medium" => "weights.medium",
        "--fs-font-weight-semibold" => "weights.semibold",
        "--fs-font-weight-bold" => "weights.bold",
        "--fs-line-height-default" => "lineHeights.default",
        "--fs-line-height-heading" => "lineHeights.heading",
        "--fs-line-height-article" => "lineHeights.article",
        "--fs-line-height-compact" => "lineHeights.compact",
        "--fs-button-border-width" => "buttonBorderWidth",
        "--fs-button-font-weight" => "buttonFontWeight",
        _ => "",
    };
    if !named.is_empty() {
        return named.into();
    }
    if let Some(name) = variable
        .strip_prefix("--fs-")
        .and_then(|v| v.strip_suffix("-radius"))
    {
        return if BUTTONS.contains(&name) {
            "buttonRadius"
        } else if FIELDS.contains(&name) {
            "fieldRadius"
        } else {
            "surfaceRadius"
        }
        .into();
    }
    variable.into()
}

/// Om parenteser og anførselstegn går opp.
///
/// En ubalansert `(` er nok alene: `1px (` åpner en blokk som sluker
/// semikolonet, begge krøllparentesene og alt som står etter i fila. Testet i
/// Chromium, der både temaet og konsumentens eget stilark forsvant.
fn balanced(value: &str) -> bool {
    let mut depth = 0i32;
    let mut quote: Option<char> = None;
    for c in value.chars() {
        if let Some(q) = quote {
            if c == q {
                quote = None;
            }
            continue;
        }
        if c == '"' || c == '\'' {
            quote = Some(c);
        } else if c == '(' {
            depth += 1;
        } else if c == ')' {
            depth -= 1;
            if depth < 0 {
                return false;
            }
        }
    }
    depth == 0 && quote.is_none()
}

/// Avviser en verdi som kan bryte ut av regelen den skrives inn i.
///
/// Oppskriften kan komme fra et annet repo eller et byggesteg. Fire veier ut
/// er etterprøvd i nettleser: `4px; } html { display: none } :root { --x: 1`
/// lukket blokka, `1px (` slukte resten av fila, `Arial\` lot baksnabelen
/// spise semikolonet, og `Arial</style><script>…` kjørte skriptet der CSS-en
/// står inline i et `<style>`. Derfor både en liste over farlige tegn og et
/// krav om at parenteser og anførselstegn går opp. `calc(1rem + 2px)` og
/// `"Segoe UI", Arial` er fortsatt lovlige.
fn checked(name: &str, value: &str) -> Result<String, String> {
    let dangerous = value.contains([';', '{', '}', '<', '>', '\\'])
        || value.contains("/*")
        || value.contains("*/")
        || value.chars().any(|c| (c as u32) < 0x20);
    if dangerous {
        return Err(format!(
            "Verdien til {} kan ikke inneholde «;», «{{», «}}», «<», «>», «\\», «/*» eller styretegn. Den skrives rett inn i en CSS-regel. Fikk: {value}",
            recipe_name(name)
        ));
    }
    if !balanced(value) {
        return Err(format!(
            "Verdien til {} har en parentes eller et anførselstegn som ikke går opp. En parentes som ikke lukkes sluker resten av stilarket. Fikk: {value}",
            recipe_name(name)
        ));
    }
    Ok(value.to_string())
}

/// Verdien som tekst, slik `String(verdi)` gir den, eller ingenting når den
/// ikke er oppgitt. `0` er oppgitt.
fn given(value: Option<&Json>) -> Option<String> {
    match value? {
        Json::String(s) if s.is_empty() => None,
        Json::String(s) => Some(s.clone()),
        Json::Number(n) => Some(js_number(*n)),
        Json::Bool(b) => Some(b.to_string()),
        Json::Null => Some("null".into()),
        _ => None,
    }
}

type Declarations = Vec<(String, String)>;

fn maybe(out: &mut Declarations, name: &str, value: Option<&Json>) -> Result<(), String> {
    if let Some(v) = given(value) {
        let v = checked(name, &v)?;
        match out.iter_mut().find(|(n, _)| n == name) {
            Some(existing) => existing.1 = v,
            None => out.push((name.to_string(), v)),
        }
    }
    Ok(())
}

fn path<'a>(value: Option<&'a Json>, key: &str) -> Option<&'a Json> {
    value?.get(key)
}

fn typography_declarations(t: &Json) -> Result<Declarations, String> {
    let mut out = Vec::new();
    let t = Some(t);
    maybe(&mut out, "--fs-font-family-base", path(t, "fontFamily"))?;
    let weights = path(t, "weights");
    maybe(
        &mut out,
        "--fs-font-weight-regular",
        path(weights, "regular"),
    )?;
    maybe(&mut out, "--fs-font-weight-medium", path(weights, "medium"))?;
    maybe(
        &mut out,
        "--fs-font-weight-semibold",
        path(weights, "semibold"),
    )?;
    maybe(&mut out, "--fs-font-weight-bold", path(weights, "bold"))?;
    let heights = path(t, "lineHeights");
    maybe(
        &mut out,
        "--fs-line-height-default",
        path(heights, "default"),
    )?;
    maybe(
        &mut out,
        "--fs-line-height-heading",
        path(heights, "heading"),
    )?;
    maybe(
        &mut out,
        "--fs-line-height-article",
        path(heights, "article"),
    )?;
    maybe(
        &mut out,
        "--fs-line-height-compact",
        path(heights, "compact"),
    )?;
    Ok(out)
}

fn shape_declarations(f: &Json) -> Result<Declarations, String> {
    let mut out = Vec::new();
    for (key, names) in [
        ("buttonRadius", &BUTTONS[..]),
        ("fieldRadius", &FIELDS[..]),
        ("surfaceRadius", &SURFACES[..]),
    ] {
        for name in names {
            maybe(&mut out, &format!("--fs-{name}-radius"), f.get(key))?;
        }
    }
    maybe(
        &mut out,
        "--fs-button-border-width",
        f.get("buttonBorderWidth"),
    )?;
    maybe(
        &mut out,
        "--fs-button-font-weight",
        f.get("buttonFontWeight"),
    )?;
    Ok(out)
}

fn lines(declarations: &Declarations, indent: &str) -> String {
    declarations
        .iter()
        .map(|(n, v)| format!("{indent}{n}: {v};"))
        .collect::<Vec<_>>()
        .join("\n")
}

/// Temavelgeren må stå i konsumentens tema også, ellers byttet
/// `.fs-theme-control` til Fristils egne farger inne i et tema.
fn control(name: &str) -> String {
    format!(":root:has(.fs-theme-control[value=\"{name}\"]:checked)")
}

/// Setter temaet sammen, i sitt eget lag, `fristil-tema`, erklært etter
/// `fristil`. Erklæringen avgjør rekkefølgen uavhengig av når stilarkene
/// lastes: både Astro og TanStack Start legger bundlet CSS inn rett før
/// `</head>`, etter en `<link>` appen selv har skrevet.
fn to_css(
    light: &Declarations,
    dark: &Declarations,
    typography: Option<&Json>,
    shape: Option<&Json>,
) -> Result<String, String> {
    let typographic = typography
        .map(typography_declarations)
        .transpose()?
        .unwrap_or_default();
    let formal = shape
        .map(shape_declarations)
        .transpose()?
        .unwrap_or_default();
    let mut root: Declarations = light.clone();
    for (n, v) in typographic.into_iter().chain(formal) {
        match root.iter_mut().find(|(k, _)| *k == n) {
            Some(existing) => existing.1 = v,
            None => root.push((n, v)),
        }
    }

    let mut parts: Vec<String> = Vec::new();
    if !root.is_empty() {
        parts.push(format!("  :root {{\n{}\n  }}", lines(&root, "    ")));
    }
    // Skriften settes som en ekte regel: Fristil arver skrift med vilje, så et
    // token alene ville ikke endret én eneste bokstav.
    if given(path(typography, "fontFamily")).is_some() {
        parts.push("  :root {\n    font-family: var(--fs-font-family-base);\n  }".into());
    }
    // Begge attributtene skrives, ikke bare det mørke: `data-theme` er en
    // temagrense og virker på et hvilket som helst element.
    if !dark.is_empty() {
        parts.push(format!(
            "  @media (prefers-color-scheme: dark) {{\n    :root:not([data-theme=\"light\"]) {{\n{}\n    }}\n  }}",
            lines(dark, "      ")
        ));
        parts.push(format!(
            "  [data-theme=\"light\"],\n  {} {{\n{}\n  }}",
            control("light"),
            lines(light, "    ")
        ));
        parts.push(format!(
            "  [data-theme=\"dark\"],\n  {} {{\n{}\n  }}",
            control("dark"),
            lines(dark, "    ")
        ));
    }

    Ok([
        "/* Generert av @fristil/designsystem. Rediger oppskriften, ikke denne fila. */",
        "",
        "@layer fristil, fristil-tema;",
        "",
        "@layer fristil-tema {",
        &parts.join("\n\n"),
        "}",
        "",
    ]
    .join("\n"))
}

pub struct Theme {
    pub light: Declarations,
    pub dark: Declarations,
    pub violations: Vec<Violation>,
    pub css: String,
}

/// Bygger temaet, og kontrollerer hvert løfte mens det bygges.
///
/// `input` er oppskriften: merkefargene per familie, og `typography` og
/// `shape`. En familie som utelates, arver Fristils egen kulør.
pub fn build_theme(input: &Json) -> Result<Theme, String> {
    let given_families: Vec<(&str, String)> = contract()
        .families
        .iter()
        .filter_map(|name| match input.get(name) {
            Some(Json::String(s)) if !s.is_empty() => Some((name.as_str(), s.clone())),
            Some(Json::Number(n)) if *n != 0.0 && !n.is_nan() => {
                Some((name.as_str(), js_number(*n)))
            }
            Some(Json::Bool(true)) => Some((name.as_str(), "true".into())),
            Some(Json::Array(_)) | Some(Json::Object(_)) => Some((name.as_str(), String::new())),
            _ => None,
        })
        .collect();
    let typography = input.get("typography").filter(|v| truthy(v));
    let shape = input.get("shape").filter(|v| truthy(v));

    if given_families.is_empty() && typography.is_none() && shape.is_none() {
        return Err("Temaet er tomt. Oppgi enten merkefarger, eller skrift og form.".into());
    }
    // Et tema uten farger er ikke en kuriositet: bruker organisasjonen
    // Fristils farger fra før, er det skriften og hjørnene som skiller.
    if given_families.is_empty() {
        return Ok(Theme {
            light: vec![],
            dark: vec![],
            violations: vec![],
            css: to_css(&vec![], &vec![], typography, shape)?,
        });
    }

    let mut brands = contract().brands.clone();
    for (name, value) in given_families {
        if let Some(entry) = brands.iter_mut().find(|(n, _)| n == name) {
            entry.1 = value;
        }
    }
    let light = build_matrix(&brands, Appearance::Light)?;
    let dark = build_matrix(&brands, Appearance::Dark)?;
    let css = to_css(&light.tokens, &dark.tokens, typography, shape)?;
    Ok(Theme {
        violations: light
            .violations
            .into_iter()
            .chain(dark.violations)
            .collect(),
        light: light.tokens,
        dark: dark.tokens,
        css,
    })
}

fn truthy(v: &Json) -> bool {
    match v {
        Json::Null => false,
        Json::Bool(b) => *b,
        Json::Number(n) => *n != 0.0 && !n.is_nan(),
        Json::String(s) => !s.is_empty(),
        _ => true,
    }
}

#[cfg(test)]
mod recipe_tests {
    use super::*;
    use crate::json::parse;

    fn theme(recipe: &str) -> Result<Theme, String> {
        build_theme(&parse(recipe).unwrap())
    }

    #[test]
    fn fristils_own_colors_keep_every_promise() {
        let t = theme(r##"{"accent": "#1362ae"}"##).unwrap();
        assert!(t.violations.is_empty(), "{:?}", t.violations);
        assert!(t
            .light
            .iter()
            .any(|(n, _)| n == "--fs-color-neutral-canvas"));
        assert_eq!(t.light.len(), t.dark.len());
    }

    #[test]
    fn says_which_value_is_dangerous_by_the_name_in_the_recipe() {
        let error = theme(r#"{"shape": {"buttonRadius": "4px; } html { display: none }"}}"#)
            .err()
            .unwrap();
        assert!(error.starts_with("Verdien til buttonRadius"), "{error}");
        let error = theme(r#"{"typography": {"fontFamily": "Arial ("}}"#)
            .err()
            .unwrap();
        assert!(error.contains("parentes"), "{error}");
    }

    #[test]
    fn writes_numbers_like_javascript() {
        let t =
            theme(r#"{"typography": {"weights": {"bold": 700}, "lineHeights": {"default": 1.5}}}"#)
                .unwrap();
        assert!(t.css.contains("--fs-font-weight-bold: 700;"), "{}", t.css);
        assert!(
            t.css.contains("--fs-line-height-default: 1.5;"),
            "{}",
            t.css
        );
    }

    #[test]
    fn the_theme_control_stands_in_a_consumer_theme_too() {
        // Den samme asymmetrien som rammet `[data-theme="light"]` i 0.23.0:
        // uten disse byttet velgeren til Fristils egne farger inne i et
        // konsumenttema, siden bare attributtblokkene hadde temaets verdier.
        let css = theme(r##"{"accent": "#7c3aed"}"##).unwrap().css;
        assert!(css.contains(r#":root:has(.fs-theme-control[value="light"]:checked)"#));
        assert!(css.contains(r#":root:has(.fs-theme-control[value="dark"]:checked)"#));
    }

    #[test]
    fn an_empty_recipe_is_an_error() {
        assert!(theme("{}").err().unwrap().starts_with("Temaet er tomt"));
        assert!(theme(r##"{"accent": "#zzz"}"##)
            .err()
            .unwrap()
            .contains("gyldig heksadesimal"));
    }

    #[test]
    fn the_check_finds_a_broken_promise() {
        let report = check::inspect_theme(":root { --fs-color-accent-text: #ffffff; }");
        assert_eq!(report.blocks, 1);
        assert!(
            report
                .problems
                .iter()
                .any(|p| p.message.starts_with("accent: text mot canvas er 1.00:1")),
            "{:?}",
            report
                .problems
                .iter()
                .map(|p| &p.message)
                .collect::<Vec<_>>()
        );
    }
}

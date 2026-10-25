//! The theme: a whole colour theme from a few brand colours, and the check of
//! a theme a consumer has written themselves.
//!
//! The theme is the contract applied to the consumer's hues. The hue comes
//! from them, the lightness from the role, and the promises hold by
//! construction. That is why there is no adjustment pass here: there is
//! nothing to move.

pub mod check;
pub mod color;
pub mod contract;
#[cfg(test)]
mod tests;

use crate::json::Json;
use contract::{build_matrix, contract, Appearance, Violation};

/// `String.prototype.trim` in JavaScript: whitespace as JavaScript sees it.
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

/// A number written the way `String(number)` does it in JavaScript: `600`,
/// not `600.0`, `1e-7` and `1e+21` with an exponent, and `Infinity` and `NaN`.
///
/// The rules are Number::toString in ECMA-262: the shortest digits that read
/// back to the same number, which Rust also finds, with an exponent when the
/// number is below 1e-6 or at least 1e21.
pub fn js_number(n: f64) -> String {
    if n.is_nan() {
        return "NaN".into();
    }
    if n.is_infinite() {
        return if n > 0.0 { "Infinity" } else { "-Infinity" }.into();
    }
    // `-0` is written `0` in JavaScript.
    if n == 0.0 {
        return "0".into();
    }
    // `{:e}` gives the shortest digits, like `1.2345e-7`.
    let scientific = format!("{:e}", n.abs());
    let (mantissa, exponent) = scientific.split_once('e').unwrap_or((&scientific, "0"));
    let digits = mantissa.replace('.', "");
    let k = digits.len() as i32;
    // The number is 0.`digits` times 10 to the power of `point`.
    let point = exponent.parse::<i32>().unwrap_or(0) + 1;
    let text = if (k..=21).contains(&point) {
        format!("{digits}{}", "0".repeat((point - k) as usize))
    } else if (1..=21).contains(&point) {
        let (whole, fraction) = digits.split_at(point as usize);
        format!("{whole}.{fraction}")
    } else if (-5..=0).contains(&point) {
        format!("0.{}{digits}", "0".repeat(-point as usize))
    } else {
        let exponent = point - 1;
        let sign = if exponent >= 0 { '+' } else { '-' };
        let mantissa = if k == 1 {
            digits
        } else {
            format!("{}.{}", &digits[..1], &digits[1..])
        };
        format!("{mantissa}e{sign}{}", exponent.abs())
    };
    if n < 0.0 {
        format!("-{text}")
    } else {
        text
    }
}

/// `number.toFixed(2)` in JavaScript: a tie rounds up, not to even.
pub fn to_fixed2(n: f64) -> String {
    let scaled = n * 100.0;
    let floor = scaled.floor();
    if scaled - floor == 0.5 {
        let up = (floor + 1.0) / 100.0;
        return format!("{up:.2}");
    }
    format!("{n:.2}")
}

/// The buttons, fields and surfaces that share a corner radius in the theme.
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

/// The name the user wrote, for the error message.
///
/// The value ends up in `--lt-button-radius`, but what was written was
/// `buttonRadius`. An error message that names our own variable sends the
/// reader to the wrong place in their own file.
fn recipe_name(variable: &str) -> String {
    let named = match variable {
        "--lt-font-family-base" => "fontFamily",
        "--lt-font-weight-regular" => "weights.regular",
        "--lt-font-weight-medium" => "weights.medium",
        "--lt-font-weight-semibold" => "weights.semibold",
        "--lt-font-weight-bold" => "weights.bold",
        "--lt-line-height-default" => "lineHeights.default",
        "--lt-line-height-heading" => "lineHeights.heading",
        "--lt-line-height-article" => "lineHeights.article",
        "--lt-line-height-compact" => "lineHeights.compact",
        "--lt-button-border-width" => "buttonBorderWidth",
        "--lt-button-font-weight" => "buttonFontWeight",
        _ => "",
    };
    if !named.is_empty() {
        return named.into();
    }
    if let Some(name) = variable
        .strip_prefix("--lt-")
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

/// Whether parentheses and quotes are balanced.
///
/// An unbalanced `(` is enough on its own: `1px (` opens a block that
/// swallows the semicolon, both braces and everything after it in the file.
/// Tested in Chromium, where both the theme and the consumer's own style
/// sheet disappeared.
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

/// Refuses a value that can break out of the rule it is written into.
///
/// The recipe can come from another repository or a build step. Four ways
/// out were checked in a browser: `4px; } html { display: none } :root { --x: 1`
/// closed the block, `1px (` swallowed the rest of the file, `Arial\` let the
/// backslash eat the semicolon, and `Arial</style><script>…` ran the script
/// where the CSS is inline in a `<style>`. Hence both a list of dangerous
/// characters and a requirement that parentheses and quotes are balanced.
/// `calc(1rem + 2px)` and `"Segoe UI", Arial` are still valid.
fn checked(name: &str, value: &str) -> Result<String, String> {
    let dangerous = value.contains([';', '{', '}', '<', '>', '\\'])
        || value.contains("/*")
        || value.contains("*/")
        || value.chars().any(|c| (c as u32) < 0x20);
    if dangerous {
        return Err(format!(
            "The value of {} cannot contain \";\", \"{{\", \"}}\", \"<\", \">\", \"\\\", \"/*\" or control characters. It is written straight into a CSS rule. Got: {value}",
            recipe_name(name)
        ));
    }
    if !balanced(value) {
        return Err(format!(
            "The value of {} has an unbalanced parenthesis or quote. A parenthesis that is not closed swallows the rest of the style sheet. Got: {value}",
            recipe_name(name)
        ));
    }
    Ok(value.to_string())
}

/// The value as text, as `String(value)` gives it, or nothing when it is not
/// given. `0` counts as given.
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
    maybe(&mut out, "--lt-font-family-base", path(t, "fontFamily"))?;
    let weights = path(t, "weights");
    maybe(
        &mut out,
        "--lt-font-weight-regular",
        path(weights, "regular"),
    )?;
    maybe(&mut out, "--lt-font-weight-medium", path(weights, "medium"))?;
    maybe(
        &mut out,
        "--lt-font-weight-semibold",
        path(weights, "semibold"),
    )?;
    maybe(&mut out, "--lt-font-weight-bold", path(weights, "bold"))?;
    let heights = path(t, "lineHeights");
    maybe(
        &mut out,
        "--lt-line-height-default",
        path(heights, "default"),
    )?;
    maybe(
        &mut out,
        "--lt-line-height-heading",
        path(heights, "heading"),
    )?;
    maybe(
        &mut out,
        "--lt-line-height-article",
        path(heights, "article"),
    )?;
    maybe(
        &mut out,
        "--lt-line-height-compact",
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
            maybe(&mut out, &format!("--lt-{name}-radius"), f.get(key))?;
        }
    }
    maybe(
        &mut out,
        "--lt-button-border-width",
        f.get("buttonBorderWidth"),
    )?;
    maybe(
        &mut out,
        "--lt-button-font-weight",
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

/// The theme control must be in the consumer's theme too, otherwise
/// `.lt-theme-control` switched to LO-TEK's own colours inside a theme.
fn control(name: &str) -> String {
    format!(":root:has(.lt-theme-control[value=\"{name}\"]:checked)")
}

/// Puts the theme together, in its own layer, `lotek-theme`, declared after
/// `lotek`. The declaration decides the order regardless of when the style
/// sheets load: both Astro and TanStack Start insert bundled CSS right before
/// `</head>`, after a `<link>` the app has written itself.
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
    // The font is set as a real rule: LO-TEK inherits the font on purpose, so
    // a token alone would not change a single letter.
    if given(path(typography, "fontFamily")).is_some() {
        parts.push("  :root {\n    font-family: var(--lt-font-family-base);\n  }".into());
    }
    // Both attributes are written, not only the dark one: `data-theme` is a
    // theme boundary and works on any element.
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
        "/* Generated by @lo-tek/interfaces. Edit the recipe, not this file. */",
        "",
        "@layer lotek, lotek-theme;",
        "",
        "@layer lotek-theme {",
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

/// Builds the theme, and checks every promise while it is built.
///
/// `input` is the recipe: the brand colours per family, and `typography` and
/// `shape`. A family that is left out inherits LO-TEK's own hue.
pub fn build_theme(input: &Json) -> Result<Theme, String> {
    if !contract::loaded() {
        return Err(contract::NOT_LOADED.into());
    }
    let contract = contract();
    let given_families: Vec<(&str, String)> = contract
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
        return Err(
            "The theme is empty. Give either brand colours, or typography and shape.".into(),
        );
    }
    // A theme without colours is not a curiosity: when the organisation
    // already uses LO-TEK's colours, the font and the corners are what set it apart.
    if given_families.is_empty() {
        return Ok(Theme {
            light: vec![],
            dark: vec![],
            violations: vec![],
            css: to_css(&vec![], &vec![], typography, shape)?,
        });
    }

    let mut brands = contract.brands.clone();
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
    fn loteks_own_colors_keep_every_promise() {
        let t = theme(r##"{"accent": "#1362ae"}"##).unwrap();
        assert!(t.violations.is_empty(), "{:?}", t.violations);
        assert!(t
            .light
            .iter()
            .any(|(n, _)| n == "--lt-color-neutral-canvas"));
        assert_eq!(t.light.len(), t.dark.len());
    }

    #[test]
    fn says_which_value_is_dangerous_by_the_name_in_the_recipe() {
        let error = theme(r#"{"shape": {"buttonRadius": "4px; } html { display: none }"}}"#)
            .err()
            .unwrap();
        assert!(error.starts_with("The value of buttonRadius"), "{error}");
        let error = theme(r#"{"typography": {"fontFamily": "Arial ("}}"#)
            .err()
            .unwrap();
        assert!(error.contains("parenthesis"), "{error}");
    }

    #[test]
    fn writes_numbers_like_javascript() {
        let t =
            theme(r#"{"typography": {"weights": {"bold": 700}, "lineHeights": {"default": 1.5}}}"#)
                .unwrap();
        assert!(t.css.contains("--lt-font-weight-bold: 700;"), "{}", t.css);
        assert!(
            t.css.contains("--lt-line-height-default: 1.5;"),
            "{}",
            t.css
        );
    }

    #[test]
    fn the_theme_control_stands_in_a_consumer_theme_too() {
        // The same asymmetry that hit `[data-theme="light"]` in 0.23.0:
        // without these the control switched to LO-TEK's own colours inside
        // a consumer theme, since only the attribute blocks had the theme's
        // values.
        let css = theme(r##"{"accent": "#7c3aed"}"##).unwrap().css;
        assert!(css.contains(r#":root:has(.lt-theme-control[value="light"]:checked)"#));
        assert!(css.contains(r#":root:has(.lt-theme-control[value="dark"]:checked)"#));
    }

    #[test]
    fn an_empty_recipe_is_an_error() {
        assert!(theme("{}").err().unwrap().starts_with("The theme is empty"));
        assert!(theme(r##"{"accent": "#zzz"}"##)
            .err()
            .unwrap()
            .contains("valid hexadecimal"));
    }

    #[test]
    fn a_theme_without_colors_passes_the_check() {
        // A theme made with `theme` meets the requirements, also one with only
        // typography and shape. It has no contrast to check, and that is not
        // a violation.
        let css = theme(
            r#"{"typography": {"fontFamily": "Georgia, serif"}, "shape": {"buttonRadius": "1rem"}}"#,
        )
        .unwrap()
        .css;
        let report = check::inspect_theme(&css);
        assert!(report.problems.is_empty(), "{}", css);
        assert_eq!(report.blocks, 0);
        assert!(report.others > 0);
    }

    #[test]
    fn the_check_finds_a_broken_promise() {
        let report = check::inspect_theme(":root { --lt-color-accent-text: #ffffff; }");
        assert_eq!(report.blocks, 1);
        assert!(
            report
                .problems
                .iter()
                .any(|p| p.message.starts_with("accent: text mot canvas is 1.00:1")),
            "{:?}",
            report
                .problems
                .iter()
                .map(|p| &p.message)
                .collect::<Vec<_>>()
        );
    }
}

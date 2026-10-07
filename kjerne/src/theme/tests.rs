//! At kontrakten holder, og at sjekken som skal si fra faktisk sier fra.
//!
//! Løftene er garantert av konstruksjonen og ikke av et justeringspass, så
//! testene her er hele garantien. Ryker et av tallene i `fargekontrakt.json`,
//! er det disse som skal bli røde. De var `contract.browser.test.ts` mens
//! temaet var skrevet i TypeScript, og påstandene er de samme.

use super::check::{inspect_theme, parse_blocks, ParsedBlock, Report};
use super::color::{contrast_ratio, parse_hex, rgb_to_oklch};
use super::contract::{
    build_family, build_matrix, check_promises, contract, promises_for, role, role_to_css,
    Appearance, Family, Layers,
};

const APPEARANCES: [Appearance; 2] = [Appearance::Light, Appearance::Dark];

fn brands_with(changes: &[(&str, &str)]) -> Vec<(String, String)> {
    let mut brands = contract().brands.clone();
    for (name, value) in changes {
        brands.iter_mut().find(|(n, _)| n == name).unwrap().1 = value.to_string();
    }
    brands
}

fn brand(name: &str) -> String {
    contract()
        .brands
        .iter()
        .find(|(n, _)| n == name)
        .unwrap()
        .1
        .clone()
}

fn tokens(appearance: Appearance) -> Vec<(String, String)> {
    build_matrix(&contract().brands, appearance).unwrap().tokens
}

fn white_layers() -> Layers {
    Layers {
        canvas: "#ffffff".into(),
        surface: "#f1f2f3".into(),
        raised: "#e4e4e5".into(),
    }
}

fn with(family: &Family, role_name: &str, value: &str) -> Family {
    family
        .iter()
        .map(|(r, v)| {
            (
                r.clone(),
                if r == role_name {
                    value.into()
                } else {
                    v.clone()
                },
            )
        })
        .collect()
}

fn declarations(tokens: &[(String, String)]) -> String {
    tokens
        .iter()
        .map(|(n, v)| format!("{n}: {v};"))
        .collect::<Vec<_>>()
        .join(" ")
}

fn as_css(appearance: Appearance, selector: &str) -> String {
    format!(
        "{selector} {{\n  color-scheme: {};\n  {}\n}}",
        appearance.key(),
        declarations(&tokens(appearance))
    )
}

fn messages(report: &Report) -> Vec<&str> {
    report.problems.iter().map(|p| p.message.as_str()).collect()
}

fn declared<'a>(block: &'a ParsedBlock, name: &str) -> Option<&'a str> {
    block
        .declarations
        .iter()
        .find(|(n, _)| n == name)
        .map(|(_, v)| v.as_str())
}

fn role_count() -> usize {
    contract().roles.len()
}

fn family_count() -> usize {
    contract().families.len()
}

// Fristils eget tema.

#[test]
fn fristils_own_theme_keeps_every_promise() {
    for appearance in APPEARANCES {
        let matrix = build_matrix(&contract().brands, appearance).unwrap();
        assert!(
            matrix.violations.is_empty(),
            "{appearance:?}: {:?}",
            matrix.violations
        );
    }
}

#[test]
fn has_every_family_with_every_role() {
    for appearance in APPEARANCES {
        let tokens = tokens(appearance);
        assert_eq!(tokens.len(), family_count() * role_count() + 2);
        for family in &contract().families {
            for (r, _) in &contract().roles {
                let name = format!("--fs-color-{family}-{}", role_to_css(r));
                let value = &tokens.iter().find(|(n, _)| *n == name).unwrap().1;
                assert!(
                    value.len() == 7 && value.starts_with('#'),
                    "{name}: {value}"
                );
            }
        }
    }
}

// Kontrakten skal holde for en hvilken som helst kulør, ikke bare for våre.
// De ekstreme er med med vilje: neon og magenta er der sRGB oppfører seg verst.

#[test]
fn keeps_the_promises_for_any_hue() {
    for appearance in APPEARANCES {
        for accent in [
            "#ff0000", "#ff8800", "#ffd600", "#39ff14", "#00e676", "#00bcd4", "#0062ba", "#5b3fa0",
            "#ff00ff", "#ff2d6f", "#8a5a00", "#24272b",
        ] {
            let brands = brands_with(&[("accent", accent), ("neutral", "#24272b")]);
            let matrix = build_matrix(&brands, appearance).unwrap();
            assert!(
                matrix.violations.is_empty(),
                "{accent} {appearance:?}: {:?}",
                matrix.violations
            );
        }
    }
}

// Løftene kan feile. Uten disse kunne `check_promises` svart tomt uansett, og
// alle testene over ville meldt grønt på en sjekk som ikke sjekket.

#[test]
fn reports_text_that_is_too_light() {
    let family = build_family(&brand("danger"), Appearance::Light).unwrap();
    let clean = check_promises(&[("danger".into(), family.clone())], &white_layers()).unwrap();
    let broken = check_promises(
        &[("danger".into(), with(&family, "text", "#ff9999"))],
        &white_layers(),
    )
    .unwrap();
    assert!(clean.is_empty());
    assert!(!broken.is_empty());
    assert!(broken[0].promise.contains("text"));
}

#[test]
fn reports_content_on_fill_that_does_not_hold() {
    let family = build_family(&brand("accent"), Appearance::Light).unwrap();
    let broken = check_promises(
        &[("accent".into(), with(&family, "content", "#9ab8d8"))],
        &white_layers(),
    )
    .unwrap();
    assert!(broken.iter().any(|v| v.promise == "content oppå fill"));
}

// Kravet ligger over WCAG, så en liten justering ikke bryter noe.

#[test]
fn the_requirements_have_a_margin_over_wcag() {
    assert!(contract().text_requirement > 4.5);
    assert!(contract().graphic_requirement > 3.0);
}

#[test]
fn every_lightness_is_within_the_scale() {
    // Over 0,1, siden 0,001 ikke er en lyshet noen rolle kan ha.
    for (_, spec) in &contract().roles {
        for l in [spec.light, spec.dark] {
            assert!(l > 0.1 && l <= 1.0, "{l}");
        }
    }
}

// Sjekken av et tema noen har skrevet selv.

#[test]
fn says_nothing_about_a_theme_that_holds() {
    let css = format!(
        "{}\n{}",
        as_css(Appearance::Light, ":root"),
        as_css(Appearance::Dark, "[data-theme=\"dark\"]")
    );
    assert!(inspect_theme(&css).problems.is_empty());
}

#[test]
fn finds_the_cell_that_breaks_and_where_it_is() {
    let css = as_css(Appearance::Light, ":root");
    let old = tokens(Appearance::Light)
        .into_iter()
        .find(|(n, _)| n == "--fs-color-danger-text")
        .unwrap()
        .1;
    let css = css.replace(
        &format!("--fs-color-danger-text: {old}"),
        "--fs-color-danger-text: #ff9999",
    );
    let report = inspect_theme(&css);
    assert!(!report.problems.is_empty());
    assert_eq!(report.problems[0].selector, ":root");
    assert!(report.problems[0].message.contains("danger"));
}

#[test]
fn reads_a_dark_block_inside_media() {
    let css = format!(
        "@media (prefers-color-scheme: dark) {{\n{}\n}}",
        as_css(Appearance::Dark, ":root")
    );
    let blocks = parse_blocks(&css);
    assert_eq!(blocks.len(), 1);
    assert_eq!(blocks[0].appearance, Appearance::Dark);
    assert!(inspect_theme(&css).problems.is_empty());
}

#[test]
fn reports_a_value_it_cannot_calculate() {
    let fill = tokens(Appearance::Light)
        .into_iter()
        .find(|(n, _)| n == "--fs-color-accent-fill")
        .unwrap()
        .1;
    let css = as_css(Appearance::Light, ":root").replace(
        &format!("--fs-color-accent-fill: {fill}"),
        "--fs-color-accent-fill: var(--noe-annet)",
    );
    let report = inspect_theme(&css);
    assert_eq!(report.problems.len(), 1);
    assert!(report.problems[0].message.contains("ikke kontrollert"));
}

#[test]
fn reports_an_incomplete_family() {
    let report = inspect_theme(":root { color-scheme: light; --fs-color-brand4-fill: #336699; }");
    assert_eq!(messages(&report).len(), 1);
    assert!(report.problems[0].message.contains("brand4 mangler"));
}

#[test]
fn says_so_when_the_file_has_no_theme() {
    assert!(inspect_theme("body { color: red }").problems[0]
        .message
        .contains("Fant ingen"));
}

#[test]
fn the_matrix_needs_a_neutral_family() {
    let error = build_matrix(&[("accent".into(), "#1362ae".into())], Appearance::Light)
        .err()
        .unwrap();
    assert!(error.contains("nøytral"), "{error}");
}

// Lysheten er rollens, ikke merkefargens. To farger med samme lyshet har
// alltid kontrast nær 1, så det som testes er selve lysheten.

#[test]
fn every_role_has_the_same_lightness_whatever_the_brand() {
    for (r, spec) in &contract().roles {
        for brand in ["#ff0000", "#00ff00", "#0000ff", "#808080"] {
            let family = build_family(brand, Appearance::Light).unwrap();
            let l = rgb_to_oklch(parse_hex(role(&family, r).unwrap()).unwrap()).l;
            assert!((l - spec.light).abs() < 0.005, "{r} {brand}: {l}");
        }
    }
}

#[test]
fn takes_the_hue_from_the_brand() {
    let hue = |brand: &str| {
        let family = build_family(brand, Appearance::Light).unwrap();
        rgb_to_oklch(parse_hex(role(&family, "fill").unwrap()).unwrap()).h
    };
    assert!((hue("#ff0000") - hue("#0000ff")).abs() > 60.0);
}

// Den hevede flaten er med i løftene: mørkest i lyst tema og lysest i mørkt.

#[test]
fn border_fill_and_subtle_text_hold_against_raised() {
    for appearance in APPEARANCES {
        let matrix = build_matrix(&contract().brands, appearance).unwrap();
        assert!(matrix.violations.is_empty());
        let get = |name: &str| {
            parse_hex(&matrix.tokens.iter().find(|(n, _)| n == name).unwrap().1).unwrap()
        };
        let raised = get("--fs-color-neutral-raised");
        for family in &contract().families {
            for (r, required) in [
                ("border", contract().graphic_requirement),
                ("fill", contract().graphic_requirement),
                ("text-subtle", contract().text_requirement),
            ] {
                let ratio = contrast_ratio(get(&format!("--fs-color-{family}-{r}")), raised);
                assert!(ratio >= required, "{family} {r} {appearance:?}: {ratio}");
            }
        }
    }
}

#[test]
fn fails_when_the_border_is_too_weak_against_raised() {
    let family = build_family(&brand("accent"), Appearance::Light).unwrap();
    let broken = check_promises(
        &[("accent".into(), with(&family, "border", "#d8d8d8"))],
        &white_layers(),
    )
    .unwrap();
    assert!(broken.iter().any(|v| v.promise == "border mot raised"));
}

// Sjekken leser CSS slik den faktisk skrives.

#[test]
fn keeps_a_value_before_a_nested_rule() {
    let css = ":root { --fs-color-danger-text: #ff9999; &:hover { color: red } }";
    let blocks = parse_blocks(css);
    assert_eq!(blocks.len(), 1);
    assert_eq!(
        declared(&blocks[0], "--fs-color-danger-text"),
        Some("#ff9999")
    );
    assert!(!inspect_theme(css).problems.is_empty());
}

#[test]
fn reads_media_inside_root_as_its_own_block() {
    let css = ":root { --fs-color-danger-text: #ff9999; @media print { --fs-color-accent-fill: #123456 } }";
    assert_eq!(parse_blocks(css).len(), 2);
}

#[test]
fn reads_light_dark_as_not_given() {
    let css = "[data-theme=\"dark\"] { color-scheme: light dark; --fs-color-danger-text: #ff9999 }";
    assert_eq!(parse_blocks(css)[0].appearance, Appearance::Dark);
}

#[test]
fn is_not_fooled_by_a_class_called_darkmode() {
    let css = ".darkmode-toggle { --fs-color-danger-text: #123456 }";
    assert_eq!(parse_blocks(css)[0].appearance, Appearance::Light);
}

#[test]
fn reports_a_token_name_the_system_does_not_have() {
    let report = inspect_theme(":root { --fs-color-danger-txt: #ff0000 }");
    assert_eq!(report.problems.len(), 1);
    assert!(report.problems[0]
        .message
        .contains("ikke et token i systemet"));
}

#[test]
fn checks_a_family_with_a_hyphen_in_its_name() {
    // Rollen leses som endelsen. Med familien som begynnelsen falt sju
    // gyldige roller på «min-merkevare» utenfor uten et ord.
    let css: String = [
        "surface",
        "border-subtle",
        "border",
        "fill",
        "content",
        "text",
        "text-subtle",
    ]
    .iter()
    .map(|r| format!("--fs-color-min-merkevare-{r}: #ff0000;"))
    .collect();
    let report = inspect_theme(&format!(":root {{{css}}}"));
    assert!(!report.problems.is_empty());
    assert!(messages(&report)
        .iter()
        .any(|m| m.contains("min-merkevare")));
}

#[test]
fn reports_a_hex_color_with_alpha_instead_of_failing() {
    let report = inspect_theme(":root { --fs-color-danger-text: #ff9999cc }");
    assert_eq!(report.problems.len(), 1);
    assert!(report.problems[0].message.contains("ikke kontrollert"));
}

// Sjekken teller hva den gjorde.

#[test]
fn reports_blocks_and_promises() {
    let css = format!(
        ":root {{ color-scheme: light; {} }}",
        declarations(&tokens(Appearance::Light))
    );
    let report = inspect_theme(&css);
    let per_family = promises_for(
        &build_family(&brand("danger"), Appearance::Light).unwrap(),
        &white_layers(),
    )
    .unwrap()
    .len();
    assert_eq!(report.blocks, 1);
    assert_eq!(report.promises, family_count() * per_family);
    assert!(report.problems.is_empty());
}

#[test]
fn counts_no_promises_in_a_file_without_tokens() {
    let report = inspect_theme("body { color: red }");
    assert_eq!(report.promises, 0);
    assert_eq!(report.problems.len(), 1);
}

// Sjekken sier fra om det den ikke kunne lese.

#[test]
fn reads_color_scheme_as_the_last_declaration_without_semicolon() {
    let css = format!(
        "[data-theme=\"mork\"] {{ {} color-scheme: dark }}",
        declarations(&tokens(Appearance::Dark))
    );
    assert_eq!(parse_blocks(&css)[0].appearance, Appearance::Dark);
    assert!(inspect_theme(&css).problems.is_empty());
}

#[test]
fn reads_every_dark_form_of_color_scheme() {
    for value in [
        "only dark",
        "dark only",
        "dark !important",
        "dark only !important",
        "ONLY DARK",
        "Only Dark",
    ] {
        let css = format!(":root {{ color-scheme: {value}; --fs-color-danger-text: #f1a7ab }}");
        assert_eq!(
            parse_blocks(&css)[0].appearance,
            Appearance::Dark,
            "{value}"
        );
    }
}

#[test]
fn the_last_color_scheme_wins() {
    let css = ":root { color-scheme: light; color-scheme: dark; --fs-color-danger-text: #f1a7ab }";
    assert_eq!(parse_blocks(css)[0].appearance, Appearance::Dark);
}

#[test]
fn does_not_read_a_custom_property_as_color_scheme() {
    let css = ":root { --my-color-scheme: dark; --fs-color-danger-text: #7a1f28 }";
    assert_eq!(parse_blocks(css)[0].appearance, Appearance::Light);
}

#[test]
fn keeps_the_brace_message_in_a_truncated_file() {
    let report = inspect_theme(":root { --fs-color-danger-text: #7a1f28");
    assert!(messages(&report)
        .iter()
        .any(|m| m.contains("ikke er lukket")));
}

#[test]
fn reports_a_block_that_is_not_closed() {
    let report = inspect_theme(":root { --fs-color-danger-text: #7a1f28 } [data-theme=\"dark\"] {");
    assert!(messages(&report)
        .iter()
        .any(|m| m.contains("ikke er lukket")));
}

#[test]
fn reports_a_layer_on_another_family_than_neutral() {
    let report = inspect_theme(":root { --fs-color-danger-canvas: #ff0000 }");
    assert_eq!(report.problems.len(), 1);
    assert!(report.problems[0]
        .message
        .contains("ikke et token i systemet"));
}

#[test]
fn reads_a_value_with_important() {
    let report = inspect_theme(":root { --fs-color-danger-text: #7a1f28 !important }");
    assert_eq!(report.declarations, 1);
    assert!(report.problems.is_empty());
}

#[test]
fn counts_the_consumers_own_values_not_the_defaults() {
    let one_line = inspect_theme(":root { --fs-color-neutral-canvas: #ffffff }");
    let whole = inspect_theme(&format!(
        ":root {{ color-scheme: light; {} }}",
        declarations(&tokens(Appearance::Light))
    ));
    assert_eq!(one_line.promises, whole.promises);
    assert_eq!(one_line.declarations, 1);
    assert_eq!(whole.declarations, family_count() * role_count() + 2);
}

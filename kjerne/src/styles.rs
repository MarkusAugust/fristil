//! Hva stilarkene styler: klassene og attributtverdiene i selektorene.
//!
//! Manifestet er kilden til hva en klasse tar. Stilarkene er vitner: de sier
//! hva som faktisk har en regel. Sammen svarer de på to ting kjernen ellers
//! ikke ser:
//!
//! - en klasse står i markupen, men stilarket som styler den er ikke lastet;
//! - en verdi står i manifestet, som en variant lagt til i en overtatt
//!   komponent, men ingen selektor styler den.
//!
//! CSS-en leses med cssparser, tokenizeren fra fase 3. For hver selektor
//! samles klassene og attributtene i hver sammensatte selektor, som
//! `.fs-button[data-variant="ghost"]`. `:is()` og `:where()` leses som en del
//! av den sammensatte selektoren de står i, og `&` i en nøstet regel som
//! selektoren rundt. `:not()` og `:has()` handler om andre elementer, eller om
//! at noe ikke er der: klassene i dem regnes som kjent, men verdiene som ikke
//! stylet. `@media`, `@supports`, `@layer`,
//! `@container` og `@scope` leses som om de ikke var der, og `@import` gir
//! adressen.

use std::collections::BTreeSet;

use cssparser::{Parser, Token};

/// Det stilarkene vitner om.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct Styles {
    /// Hver klasse som står i en selektor.
    pub classes: BTreeSet<String>,
    /// Hver klasse med et attributt, og verdien når selektoren krever en, som
    /// `("fs-button", "data-variant", Some("ghost"))`.
    pub attributes: BTreeSet<(String, String, Option<String>)>,
    /// Adressene i `@import`, i rekkefølge.
    pub imports: Vec<String>,
}

impl Styles {
    pub fn extend(&mut self, other: Styles) {
        self.classes.extend(other.classes);
        self.attributes.extend(other.attributes);
        self.imports.extend(other.imports);
    }

    /// Om en selektor styler attributtet på klassen: med verdien, eller med
    /// en selektor som bare spør om attributtet finnes.
    pub fn styles_value(&self, class: &str, attribute: &str, value: Option<&str>) -> bool {
        let has = |v: Option<&str>| {
            self.attributes.contains(&(
                class.to_string(),
                attribute.to_string(),
                v.map(str::to_string),
            ))
        };
        has(None) || (value.is_some() && has(value))
    }
}

/// Én mulig sammensatt selektor: klassene og attributtene som må stå på det
/// samme elementet.
#[derive(Debug, Default, Clone)]
struct Compound {
    classes: Vec<String>,
    attributes: Vec<(String, Option<String>)>,
}

/// Grensen for hvor mange varianter `:is()` kan gi én sammensatt selektor.
const MAX_ALTERNATIVES: usize = 64;

/// Alle kombinasjonene av to lister med varianter.
fn product(left: &[Compound], right: &[Compound]) -> Vec<Compound> {
    let mut out = Vec::new();
    for l in left {
        for r in right {
            if out.len() >= MAX_ALTERNATIVES {
                return out;
            }
            let mut c = l.clone();
            c.classes.extend(r.classes.iter().cloned());
            c.attributes.extend(r.attributes.iter().cloned());
            out.push(c);
        }
    }
    out
}

/// Leser én selektorliste. Gir variantene av den siste sammensatte selektoren
/// i hver selektor, den som styles, og legger alt den ser i `out`.
fn selector_list(text: &str, parents: &[Compound], out: &mut Styles) -> Vec<Compound> {
    let mut parser = Parser::new(text);
    selector_list_in(&mut parser, parents, out)
}

fn record(compounds: &[Compound], out: &mut Styles) {
    for compound in compounds {
        for class in &compound.classes {
            out.classes.insert(class.clone());
            for (attribute, value) in &compound.attributes {
                out.attributes
                    .insert((class.clone(), attribute.clone(), value.clone()));
            }
        }
    }
}

fn selector_list_in(input: &mut Parser, parents: &[Compound], out: &mut Styles) -> Vec<Compound> {
    let mut subjects = Vec::new();
    // Variantene av den sammensatte selektoren som leses nå.
    let mut current = vec![Compound::default()];
    let mut touched = false;
    let finish = |current: &mut Vec<Compound>, touched: &mut bool, out: &mut Styles| {
        if *touched {
            record(current, out);
        }
        *current = vec![Compound::default()];
        *touched = false;
    };
    while let Ok(token) = input.next_including_whitespace() {
        match token.clone() {
            Token::Comma => {
                if touched {
                    record(&current, out);
                    subjects.extend(current);
                }
                current = vec![Compound::default()];
                touched = false;
            }
            Token::WhiteSpace(_) | Token::Delim('>') | Token::Delim('+') | Token::Delim('~') => {
                finish(&mut current, &mut touched, out);
            }
            Token::Delim('.') => {
                if let Ok(Token::Ident(name)) = input.next_including_whitespace().cloned() {
                    for c in &mut current {
                        c.classes.push(name.to_string());
                    }
                    touched = true;
                }
            }
            Token::Delim('&') => {
                if !parents.is_empty() {
                    current = product(&current, parents);
                    touched = true;
                }
            }
            Token::SquareBracketBlock => {
                let attribute = input
                    .parse_nested_block(|i| Ok::<_, cssparser::ParseError<()>>(attribute(i)))
                    .ok()
                    .flatten();
                if let Some(attribute) = attribute {
                    for c in &mut current {
                        c.attributes.push(attribute.clone());
                    }
                    touched = true;
                }
            }
            Token::Colon => match input.next_including_whitespace().cloned() {
                Ok(Token::Function(name)) => {
                    let name = name.to_ascii_lowercase();
                    if matches!(
                        name.as_str(),
                        "is" | "where" | "matches" | "-webkit-any" | "-moz-any"
                    ) {
                        let inner = input
                            .parse_nested_block(|i| {
                                Ok::<_, cssparser::ParseError<()>>(selector_list_in(
                                    i, parents, out,
                                ))
                            })
                            .unwrap_or_default();
                        if !inner.is_empty() {
                            current = product(&current, &inner);
                            touched = true;
                        }
                    } else if matches!(name.as_str(), "not" | "has") {
                        // `:not()` og `:has()` styler ikke det de nevner, men
                        // stilarket kjenner klassene, som `fs-theme-control`
                        // i `:root:has(.fs-theme-control:checked)`.
                        let mut mentioned = Styles::default();
                        let _ = input.parse_nested_block(|i| {
                            selector_list_in(i, parents, &mut mentioned);
                            Ok::<_, cssparser::ParseError<()>>(())
                        });
                        out.classes.extend(mentioned.classes);
                    } else {
                        let _ = input.parse_nested_block(|i| {
                            while i.next().is_ok() {}
                            Ok::<_, cssparser::ParseError<()>>(())
                        });
                    }
                }
                Ok(Token::Colon) => {
                    // Et pseudoelement, som `::before`, med argumenter eller uten.
                    if let Ok(Token::Function(_)) = input.next_including_whitespace().cloned() {
                        let _ = input.parse_nested_block(|i| {
                            while i.next().is_ok() {}
                            Ok::<_, cssparser::ParseError<()>>(())
                        });
                    }
                }
                _ => {}
            },
            Token::Function(_) | Token::ParenthesisBlock | Token::CurlyBracketBlock => {
                let _ = input.parse_nested_block(|i| {
                    while i.next().is_ok() {}
                    Ok::<_, cssparser::ParseError<()>>(())
                });
            }
            _ => {}
        }
    }
    if touched {
        record(&current, out);
        subjects.extend(current);
    }
    subjects
}

/// `[navn]`, `[navn="verdi"]` og `[navn~="verdi"]`. Andre sammenligninger,
/// som `^=`, sier ikke hvilken verdi som styles, og telles ikke.
fn attribute(input: &mut Parser) -> Option<(String, Option<String>)> {
    let name = match input.next() {
        Ok(Token::Ident(name)) => name.to_ascii_lowercase(),
        _ => return None,
    };
    match input.next() {
        Err(_) => Some((name, None)),
        Ok(Token::Delim('=')) | Ok(Token::IncludeMatch) => match input.next() {
            Ok(Token::Ident(value)) | Ok(Token::QuotedString(value)) => {
                Some((name, Some(value.to_string())))
            }
            _ => None,
        },
        _ => None,
    }
}

/// Går gjennom reglene på ett nivå.
fn rules(input: &mut Parser, parents: &[Compound], out: &mut Styles) {
    loop {
        // Teksten fram til `{` eller `;` er selektoren, eller at-regelen.
        let start = input.position();
        let mut at_rule: Option<String> = None;
        let mut first = true;
        let mut prelude_end = start;
        let mut import: Option<String> = None;
        let block = loop {
            let before = input.position();
            let token = match input.next() {
                Ok(token) => token.clone(),
                Err(_) => return,
            };
            match token {
                Token::AtKeyword(name) if first => at_rule = Some(name.to_ascii_lowercase()),
                Token::Semicolon => break false,
                Token::CurlyBracketBlock => {
                    prelude_end = before;
                    break true;
                }
                Token::QuotedString(url) | Token::UnquotedUrl(url)
                    if at_rule.as_deref() == Some("import") && import.is_none() =>
                {
                    import = Some(url.to_string());
                }
                Token::Function(ref name)
                    if at_rule.as_deref() == Some("import")
                        && import.is_none()
                        && name.eq_ignore_ascii_case("url") =>
                {
                    import = input
                        .parse_nested_block(|i| {
                            Ok::<_, cssparser::ParseError<()>>(match i.next() {
                                Ok(Token::QuotedString(url)) => Some(url.to_string()),
                                _ => None,
                            })
                        })
                        .ok()
                        .flatten();
                }
                Token::Function(_) | Token::ParenthesisBlock | Token::SquareBracketBlock => {
                    let _ = input.parse_nested_block(|i| {
                        while i.next().is_ok() {}
                        Ok::<_, cssparser::ParseError<()>>(())
                    });
                }
                _ => {}
            }
            first = false;
        };
        if let Some(url) = import {
            out.imports.push(url);
        }
        if !block {
            continue;
        }
        match at_rule.as_deref() {
            // Reglene inni gjelder som om at-regelen ikke var der.
            Some(
                "media" | "supports" | "layer" | "container" | "scope" | "document"
                | "starting-style",
            ) => {
                let _ = input.parse_nested_block(|i| {
                    rules(i, parents, out);
                    Ok::<_, cssparser::ParseError<()>>(())
                });
            }
            // `@keyframes`, `@font-face`, `@property` og de andre har ingen
            // selektorer.
            Some(_) => {
                let _ = input.parse_nested_block(|i| {
                    while i.next().is_ok() {}
                    Ok::<_, cssparser::ParseError<()>>(())
                });
            }
            None => {
                let prelude = input.slice(start..prelude_end).to_string();
                let subjects = selector_list(&prelude, parents, out);
                let _ = input.parse_nested_block(|i| {
                    rules(i, &subjects, out);
                    Ok::<_, cssparser::ParseError<()>>(())
                });
            }
        }
    }
}

/// Det et stilark styler.
pub fn read_styles(css: &str) -> Styles {
    let mut out = Styles::default();
    let mut parser = Parser::new(css);
    rules(&mut parser, &[], &mut out);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pair(class: &str, attribute: &str, value: Option<&str>) -> (String, String, Option<String>) {
        (class.into(), attribute.into(), value.map(str::to_string))
    }

    #[test]
    fn reads_classes_and_attribute_values() {
        let s = read_styles(
            r#"@layer fristil.components {
                .fs-button { color: red; }
                .fs-button[data-variant="ghost"], .fs-button[data-variant='danger'] { }
                .fs-label[data-optional]::after { content: "(valgfritt)"; }
                .fs-card > .fs-card__title:hover { }
            }"#,
        );
        assert!(s.classes.contains("fs-card__title"));
        assert!(s
            .attributes
            .contains(&pair("fs-button", "data-variant", Some("ghost"))));
        assert!(s
            .attributes
            .contains(&pair("fs-button", "data-variant", Some("danger"))));
        assert!(s.styles_value("fs-label", "data-optional", Some("ja")));
        assert!(!s.styles_value("fs-button", "data-variant", Some("secondary")));
    }

    #[test]
    fn reads_nesting_is_and_where() {
        let s = read_styles(
            r#".fs-alert {
                &[data-color="danger"] { }
                &:is([data-color="success"], [data-color="warning"]) { }
                @media (min-width: 40rem) { &[data-size="large"] { } }
                .fs-alert__title { }
            }
            :where(.fs-tag, .fs-badge)[data-size="small"] { }"#,
        );
        for color in ["danger", "success", "warning"] {
            assert!(
                s.attributes
                    .contains(&pair("fs-alert", "data-color", Some(color))),
                "{color}"
            );
        }
        assert!(s
            .attributes
            .contains(&pair("fs-alert", "data-size", Some("large"))));
        assert!(s.classes.contains("fs-alert__title"));
        assert!(s
            .attributes
            .contains(&pair("fs-tag", "data-size", Some("small"))));
        assert!(s
            .attributes
            .contains(&pair("fs-badge", "data-size", Some("small"))));
    }

    #[test]
    fn ignores_what_does_not_style_the_element() {
        let s = read_styles(
            r#"/* .fs-kommentar { } */
            .fs-input:not(.fs-select[data-size="small"]) { }
            .fs-field:has(.fs-error-text[data-x="y"]) { }
            .fs-x::before { content: ".fs-streng { }"; }
            @keyframes fs-spinner { from { opacity: 0 } }
            .fs-y { background: url(".fs-url{}"); }"#,
        );
        assert!(!s.classes.contains("fs-kommentar"));
        // Nevnt, men verdiene i `:not()` og `:has()` er ikke stylet.
        assert!(s.classes.contains("fs-select") && s.classes.contains("fs-error-text"));
        assert!(!s.styles_value("fs-select", "data-size", Some("small")));
        assert!(!s.styles_value("fs-error-text", "data-x", Some("y")));
        assert!(!s.classes.contains("fs-streng"));
        assert!(!s.classes.contains("fs-url"));
        assert!(s.classes.contains("fs-input") && s.classes.contains("fs-field"));
        assert!(s.classes.contains("fs-x") && s.classes.contains("fs-y"));
    }

    #[test]
    fn reads_imports() {
        let s = read_styles(
            r#"@import "./tokens.css" layer(fristil.tokens);
            @import url("button.css");
            @import url(input.css);
            @layer fristil.tokens, fristil.components;
            .fs-z { }"#,
        );
        assert_eq!(s.imports, ["./tokens.css", "button.css", "input.css"]);
        assert!(s.classes.contains("fs-z"));
    }

    #[test]
    fn survives_broken_css() {
        for css in [
            "{",
            ".fs-a[",
            ".fs-b { & { & {",
            "@media {",
            ":is(",
            "}}}}",
            ".fs-c:is(.fs-d",
        ] {
            let _ = read_styles(css);
        }
        assert!(read_styles(".fs-e { color: red").classes.contains("fs-e"));
    }
}

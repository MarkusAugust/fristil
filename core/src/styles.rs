//! What the style sheets style: the classes and the attribute values in the
//! selectors.
//!
//! The manifest is the source for what a class takes. The style sheets are
//! witnesses: they say what actually has a rule. Together they answer two
//! things the core does not otherwise see:
//!
//! - a class is in the markup, but the style sheet that styles it is not
//!   loaded;
//! - a value is in the manifest, like a variant added to a taken-over
//!   component, but no selector styles it.
//!
//! The CSS is read with cssparser, the tokenizer from phase 3. For each
//! selector the classes and attributes in each compound selector are
//! collected, like `.lt-button[data-variant="ghost"]`. `:is()` and `:where()`
//! are read as part of the compound selector they are in, and `&` in a
//! nested rule as the surrounding selector. `:not()` and `:has()` are about
//! other elements, or about something not being there: the classes in them
//! count as known, but the values as not styled. `@media`, `@supports`,
//! `@layer`, `@container` and `@scope` are read as if they were not there,
//! and `@import` gives the address.

use std::collections::BTreeSet;

use cssparser::{Parser, Token};

/// What the style sheets bear witness to.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct Styles {
    /// Every class that appears in a selector.
    pub classes: BTreeSet<String>,
    /// Every class with an attribute, and the value when the selector
    /// requires one, like `("lt-button", "data-variant", Some("ghost"))`.
    pub attributes: BTreeSet<(String, String, Option<String>)>,
    /// The addresses in `@import`, in order.
    pub imports: Vec<String>,
}

impl Styles {
    pub fn extend(&mut self, other: Styles) {
        self.classes.extend(other.classes);
        self.attributes.extend(other.attributes);
        self.imports.extend(other.imports);
    }

    /// Whether a selector styles the attribute on the class: with the value,
    /// or with a selector that only asks whether the attribute is present.
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

/// One possible compound selector: the classes and attributes that must be
/// on the same element.
#[derive(Debug, Default, Clone)]
struct Compound {
    classes: Vec<String>,
    attributes: Vec<(String, Option<String>)>,
}

/// The limit on how many alternatives `:is()` can give one compound selector.
const MAX_ALTERNATIVES: usize = 64;

/// All combinations of two lists of alternatives.
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

/// Reads one selector list. Returns the alternatives of the last compound
/// selector in each selector, the one that is styled, and puts everything it
/// sees in `out`.
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
    // The alternatives of the compound selector being read now.
    let mut current = vec![Compound::default()];
    // Whether it has a class or an attribute, and whether it has anything at
    // all: `*` and `div` are compound selectors with nothing to bear witness to.
    let mut touched = false;
    let mut started = false;
    // The previous compound selector, ended by a space or a combinator. When
    // nothing comes after it, that is the one that is styled: `:is(.a, .b )`
    // and `.a , .b` have a space before the separator.
    let mut last: Option<Vec<Compound>> = None;
    let finish = |current: &mut Vec<Compound>,
                  touched: &mut bool,
                  started: &mut bool,
                  last: &mut Option<Vec<Compound>>,
                  out: &mut Styles| {
        if *started {
            if *touched {
                record(current, out);
                *last = Some(std::mem::take(current));
            } else {
                *last = None;
            }
        }
        *current = vec![Compound::default()];
        *touched = false;
        *started = false;
    };
    // The one that is styled in the selector that ends here.
    let subject =
        |current: Vec<Compound>, touched: bool, started: bool, last: Option<Vec<Compound>>| {
            if started {
                touched.then_some(current)
            } else {
                last
            }
        };
    while let Ok(token) = input.next_including_whitespace() {
        let token = token.clone();
        if !matches!(
            token,
            Token::WhiteSpace(_) | Token::Comma | Token::Delim('>' | '+' | '~')
        ) {
            started = true;
        }
        match token {
            Token::Comma => {
                if touched {
                    record(&current, out);
                }
                subjects.extend(
                    subject(std::mem::take(&mut current), touched, started, last.take())
                        .unwrap_or_default(),
                );
                current = vec![Compound::default()];
                touched = false;
                started = false;
            }
            Token::WhiteSpace(_) | Token::Delim('>') | Token::Delim('+') | Token::Delim('~') => {
                finish(&mut current, &mut touched, &mut started, &mut last, out);
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
                        // `:not()` and `:has()` do not style what they name,
                        // but the style sheet knows the classes, like
                        // `lt-theme-control` in `:root:has(.lt-theme-control:checked)`.
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
                    // A pseudo-element, like `::before`, with or without arguments.
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
    }
    subjects.extend(subject(current, touched, started, last).unwrap_or_default());
    subjects
}

/// `[name]`, `[name="value"]` and `[name~="value"]`. Other comparisons, like
/// `^=`, do not say which value is styled, and are not counted.
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

/// Walks through the rules at one level.
fn rules(input: &mut Parser, parents: &[Compound], out: &mut Styles) {
    loop {
        // The text up to `{` or `;` is the selector, or the at-rule.
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
            // The rules inside apply as if the at-rule were not there.
            Some(
                "media" | "supports" | "layer" | "container" | "scope" | "document"
                | "starting-style",
            ) => {
                let _ = input.parse_nested_block(|i| {
                    rules(i, parents, out);
                    Ok::<_, cssparser::ParseError<()>>(())
                });
            }
            // `@keyframes`, `@font-face`, `@property` and the others have no
            // selectors.
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

/// What a style sheet styles.
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
            r#"@layer lotek.components {
                .lt-button { color: red; }
                .lt-button[data-variant="ghost"], .lt-button[data-variant='danger'] { }
                .lt-label[data-optional]::after { content: "(valgfritt)"; }
                .lt-card > .lt-card__title:hover { }
            }"#,
        );
        assert!(s.classes.contains("lt-card__title"));
        assert!(s
            .attributes
            .contains(&pair("lt-button", "data-variant", Some("ghost"))));
        assert!(s
            .attributes
            .contains(&pair("lt-button", "data-variant", Some("danger"))));
        assert!(s.styles_value("lt-label", "data-optional", Some("ja")));
        assert!(!s.styles_value("lt-button", "data-variant", Some("secondary")));
    }

    #[test]
    fn reads_nesting_is_and_where() {
        let s = read_styles(
            r#".lt-alert {
                &[data-color="danger"] { }
                &:is([data-color="success"], [data-color="warning"]) { }
                @media (min-width: 40rem) { &[data-size="large"] { } }
                .lt-alert__title { }
            }
            :where(.lt-tag, .lt-badge)[data-size="small"] { }"#,
        );
        for color in ["danger", "success", "warning"] {
            assert!(
                s.attributes
                    .contains(&pair("lt-alert", "data-color", Some(color))),
                "{color}"
            );
        }
        assert!(s
            .attributes
            .contains(&pair("lt-alert", "data-size", Some("large"))));
        assert!(s.classes.contains("lt-alert__title"));
        assert!(s
            .attributes
            .contains(&pair("lt-tag", "data-size", Some("small"))));
        assert!(s
            .attributes
            .contains(&pair("lt-badge", "data-size", Some("small"))));
    }

    #[test]
    fn ignores_what_does_not_style_the_element() {
        let s = read_styles(
            r#"/* .lt-kommentar { } */
            .lt-input:not(.lt-select[data-size="small"]) { }
            .lt-field:has(.lt-error-text[data-x="y"]) { }
            .lt-x::before { content: ".lt-streng { }"; }
            @keyframes lt-spinner { from { opacity: 0 } }
            .lt-y { background: url(".lt-url{}"); }"#,
        );
        assert!(!s.classes.contains("lt-kommentar"));
        // Named, but the values in `:not()` and `:has()` are not styled.
        assert!(s.classes.contains("lt-select") && s.classes.contains("lt-error-text"));
        assert!(!s.styles_value("lt-select", "data-size", Some("small")));
        assert!(!s.styles_value("lt-error-text", "data-x", Some("y")));
        assert!(!s.classes.contains("lt-streng"));
        assert!(!s.classes.contains("lt-url"));
        assert!(s.classes.contains("lt-input") && s.classes.contains("lt-field"));
        assert!(s.classes.contains("lt-x") && s.classes.contains("lt-y"));
    }

    #[test]
    fn a_space_before_a_comma_or_a_parenthesis_keeps_the_selector() {
        let s = read_styles(
            r#":is(.lt-tag, .lt-badge )[data-size="small"] { }
            .lt-alert , .lt-card { &[data-color="danger"] { } }
            .lt-list > * { &[data-x="y"] { } }
            .lt-table   { &[data-size="small"] { } }"#,
        );
        assert!(s.styles_value("lt-badge", "data-size", Some("small")));
        assert!(s.styles_value("lt-tag", "data-size", Some("small")));
        assert!(s.styles_value("lt-alert", "data-color", Some("danger")));
        assert!(s.styles_value("lt-card", "data-color", Some("danger")));
        assert!(s.styles_value("lt-table", "data-size", Some("small")));
        // `*` is what is styled, not `.lt-list`.
        assert!(!s.styles_value("lt-list", "data-x", Some("y")));
    }

    #[test]
    fn reads_imports() {
        let s = read_styles(
            r#"@import "./tokens.css" layer(lotek.tokens);
            @import url("button.css");
            @import url(input.css);
            @layer lotek.tokens, lotek.components;
            .lt-z { }"#,
        );
        assert_eq!(s.imports, ["./tokens.css", "button.css", "input.css"]);
        assert!(s.classes.contains("lt-z"));
    }

    #[test]
    fn survives_broken_css() {
        for css in [
            "{",
            ".lt-a[",
            ".lt-b { & { & {",
            "@media {",
            ":is(",
            "}}}}",
            ".lt-c:is(.lt-d",
        ] {
            let _ = read_styles(css);
        }
        assert!(read_styles(".lt-e { color: red").classes.contains("lt-e"));
    }
}

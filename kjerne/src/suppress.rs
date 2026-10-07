//! Undertrykking av funn med en kommentar i markupen.
//!
//! ```html
//! <!-- fristil-ignore-next -->
//! <fs-ny-ting>…</fs-ny-ting>
//!
//! <!-- fristil-ignore-next ukjent-klasse ugyldig-klasseverdi -->
//! <div class="fs-eksperiment">…</div>
//! ```
//!
//! Kommentaren gjelder den neste taggen: funn som begynner mellom `<` og `>` i
//! den. Uten regelnavn gjelder den alle regler, med regelnavn bare dem.
//! Merk at noen malmotorer, som Go sin `html/template`, fjerner kommentarer
//! fra det de rendrer. Da virker kommentaren i malfila, men ikke i siden.

use crate::diagnose::tag_end;
use crate::text::*;
use crate::types::Finding;

const MARKER: &str = "fristil-ignore-next";

struct Ignore {
    start: usize,
    end: usize,
    rules: Vec<String>,
}

fn ignores(text: &[u16]) -> Vec<Ignore> {
    let mut out = Vec::new();
    let mut i = 0;
    while let Some(open) = find_at(text, i, "<!--") {
        let close = find_at(text, open + 4, "-->").unwrap_or(text.len());
        i = (close + 3).min(text.len());
        let inner = lossy(trimmed(&text[open + 4..close]));
        let Some(rest) = inner.strip_prefix(MARKER) else {
            continue;
        };
        if !rest.is_empty() && !rest.starts_with(char::is_whitespace) {
            continue;
        }
        // Den neste taggen: `<` fulgt av en bokstav.
        let Some(lt) = (i..text.len())
            .find(|&k| text[k] == LT && text.get(k + 1).is_some_and(|&c| is_ascii_letter(c)))
        else {
            continue;
        };
        out.push(Ignore {
            start: lt,
            end: tag_end(text, lt + 1).unwrap_or(text.len()),
            rules: rest.split_whitespace().map(str::to_string).collect(),
        });
    }
    out
}

/// Funnene uten dem en kommentar har undertrykt.
pub fn apply(text: &[u16], findings: Vec<Finding>) -> Vec<Finding> {
    let ignores = ignores(text);
    if ignores.is_empty() {
        return findings;
    }
    findings
        .into_iter()
        .filter(|f| {
            !ignores.iter().any(|ig| {
                (ig.start..=ig.end).contains(&f.start)
                    && (ig.rules.is_empty() || ig.rules.iter().any(|r| r == f.rule))
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use crate::{diagnose_page, manifest, text::utf16};

    fn rules(html: &str) -> Vec<&'static str> {
        diagnose_page(&utf16(html), &manifest::builtin())
            .iter()
            .map(|f| f.rule)
            .collect()
    }

    #[test]
    fn suppresses_the_next_tag_only() {
        let html =
            r#"<!-- fristil-ignore-next --><b class="fs-buton"></b><i class="fs-buton"></i>"#;
        assert_eq!(rules(html), ["ukjent-klasse"]);
    }

    #[test]
    fn suppresses_only_the_named_rules() {
        let tag = r#"<button class="fs-button fs-buton" data-variant="x"></button>"#;
        assert_eq!(rules(tag), ["ukjent-klasse", "ugyldig-klasseverdi"]);
        let html = format!("<!-- fristil-ignore-next ugyldig-klasseverdi -->\n{tag}");
        assert_eq!(rules(&html), ["ukjent-klasse"]);
    }

    #[test]
    fn ignores_other_comments() {
        let html = r#"<!-- fristil-ignore-nextish --><b class="fs-buton"></b>"#;
        assert_eq!(rules(html), ["ukjent-klasse"]);
    }
}

//! Fristils diagnostikk, én implementasjon for alle vertsspråk.
//!
//! Kjernen kompileres til en WebAssembly-modul uten importer. Den samme fila
//! kjøres av Node, Bun og nettleseren, av JVM-en gjennom Chicory, og av hvert
//! annet språk som har en WebAssembly-runtime.
//!
//! Grensesnittet er det minste alle runtimer forstår, uten bindingsverktøy:
//!
//! 1. `alloc(lengde)` gir en peker til et område i modulens minne.
//! 2. Verten skriver HTML-en dit som UTF-8.
//! 3. `diagnose_markup_raw(peker, lengde)` eller `diagnose_page_raw(…)` kjører
//!    sjekken, frigjør inndataene og legger svaret i modulens minne.
//! 4. `result_ptr()` og `result_len()` sier hvor svaret står: funnene som
//!    JSON, i UTF-8, med de samme feltene som `Finding` i TypeScript, og i
//!    tillegg `rule`, `line` og `column`.
//!
//! I tillegg:
//!
//! - `load_manifest_raw(peker, lengde)` bytter ordforrådet til et annet
//!   manifest. Svarer 0 når det gikk, og 1 med `{"error": …}` som svar når
//!   det ikke gikk. `reset_manifest()` går tilbake til det innebygde.
//! - `version_raw()` legger versjonene i svaret: kjernens, manifestets og
//!   formen på manifestet kjernen forstår.
//!
//! Posisjonene i funnene er UTF-16-indekser, som i JavaScript og Kotlin.
//! `line` og `column` begynner på 1, og kolonnen telles i UTF-16-enheter.

pub mod diagnose;
pub mod json;
pub mod manifest;
pub mod references;
pub mod suppress;
pub mod text;
pub mod types;

use std::cell::RefCell;

use text::{utf16, Utf16};
use types::{Finding, Severity, Vocabulary};

/// Det `diagnoseMarkup` finner: ordforrådet, for en mal eller et fragment.
pub fn diagnose_markup(html: &[u16], vocabulary: &Vocabulary) -> Vec<Finding> {
    suppress::apply(html, diagnose::diagnose(html, vocabulary))
}

/// Det `diagnosePage` finner: ordforrådet og koblingen på en hel side.
pub fn diagnose_page(html: &[u16], vocabulary: &Vocabulary) -> Vec<Finding> {
    let page: Utf16 = references::page_source(html);
    let mut findings = diagnose::diagnose(&page, vocabulary);
    findings.extend(references::check_references(&page));
    findings.sort_by_key(|f| f.start);
    suppress::apply(html, findings)
}

/// Hvor hver linje begynner, så linje og kolonne for et funn er et oppslag.
///
/// Telte hvert funn linjeskiftene fra starten av teksten, vokste tiden med
/// kvadratet av sidens lengde: 6000 funn på en side med 3000 linjer tok en
/// kvart sekund.
pub struct Lines {
    starts: Vec<usize>,
}

impl Lines {
    pub fn new(text: &[u16]) -> Self {
        let mut starts = vec![0];
        starts.extend(
            text.iter()
                .enumerate()
                .filter(|&(_, &c)| c == b'\n' as u16)
                .map(|(i, _)| i + 1),
        );
        Lines { starts }
    }

    /// Linje og kolonne for en UTF-16-posisjon, begge fra 1.
    pub fn line_and_column(&self, at: usize) -> (usize, usize) {
        // Linja er den siste som begynner på eller før `at`.
        let line = self.starts.partition_point(|&start| start <= at);
        (line, at - self.starts[line - 1] + 1)
    }
}

/// Linje og kolonne for én UTF-16-posisjon, begge fra 1.
pub fn line_and_column(text: &[u16], at: usize) -> (usize, usize) {
    Lines::new(&text[..at.min(text.len())]).line_and_column(at)
}

/// Funnene som JSON, i samme form som `JSON.stringify` av `Finding[]`, med
/// regelnavn, linje og kolonne i tillegg.
pub fn to_json(findings: &[Finding], text: &[u16]) -> String {
    let lines = Lines::new(text);
    let mut out = String::from("[");
    for (i, f) in findings.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        let (line, column) = lines.line_and_column(f.start);
        out.push_str(&format!(
            "{{\"start\":{},\"end\":{},\"line\":{line},\"column\":{column},\"severity\":{},\"rule\":{},\"link\":{},\"message\":{}",
            f.start,
            f.end,
            json_string(match f.severity {
                Severity::Error => "error",
                Severity::Warning => "warning",
            }),
            json_string(f.rule),
            json_string(&f.link),
            json_string(&f.message),
        ));
        if let Some(r) = &f.fix {
            out.push_str(&format!(
                ",\"fix\":{{\"title\":{},\"start\":{},\"end\":{},\"text\":{},\"preferred\":{}}}",
                json_string(&r.title),
                r.start,
                r.end,
                json_string(&r.text),
                r.preferred
            ));
        }
        out.push('}');
    }
    out.push(']');
    out
}

fn json_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

thread_local! {
    static RESPONSE: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

fn respond(json: String) {
    RESPONSE.with(|s| *s.borrow_mut() = json.into_bytes());
}

/// Et område på `lengde` byte i modulens minne, som verten skriver HTML-en til.
#[no_mangle]
pub extern "C" fn alloc(length: usize) -> *mut u8 {
    let mut buf = Vec::<u8>::with_capacity(length.max(1));
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

/// Frigjør et område fra `alloc`.
///
/// # Safety
/// `peker` og `lengde` må komme fra ett og samme kall til `alloc`.
#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, length: usize) {
    drop(Vec::from_raw_parts(ptr, 0, length.max(1)));
}

/// Leser inndataene, som `alloc` ga og verten fylte, og frigjør dem.
unsafe fn read_input(ptr: *mut u8, length: usize) -> String {
    let bytes = Vec::from_raw_parts(ptr, length, length.max(1));
    String::from_utf8_lossy(&bytes).into_owned()
}

/// # Safety
/// `peker` og `lengde` må komme fra `alloc(lengde)`, fylt med UTF-8.
#[no_mangle]
pub unsafe extern "C" fn diagnose_markup_raw(ptr: *mut u8, length: usize) {
    let html = utf16(&read_input(ptr, length));
    let findings = diagnose_markup(&html, &manifest::current());
    respond(to_json(&findings, &html));
}

/// # Safety
/// `peker` og `lengde` må komme fra `alloc(lengde)`, fylt med UTF-8.
#[no_mangle]
pub unsafe extern "C" fn diagnose_page_raw(ptr: *mut u8, length: usize) {
    let html = utf16(&read_input(ptr, length));
    let findings = diagnose_page(&html, &manifest::current());
    respond(to_json(&findings, &html));
}

/// Bytter ordforrådet til manifestet verten har skrevet inn.
///
/// # Safety
/// `peker` og `lengde` må komme fra `alloc(lengde)`, fylt med UTF-8.
#[no_mangle]
pub unsafe extern "C" fn load_manifest_raw(ptr: *mut u8, length: usize) -> u32 {
    match manifest::from_json(&read_input(ptr, length)) {
        Ok(vocabulary) => {
            manifest::set_current(Some(vocabulary));
            respond("{\"ok\":true}".into());
            0
        }
        Err(error) => {
            respond(format!("{{\"error\":{}}}", json_string(&error)));
            1
        }
    }
}

/// Går tilbake til det innebygde manifestet.
#[no_mangle]
pub extern "C" fn reset_manifest() {
    manifest::set_current(None);
}

/// Legger versjonene i svaret, som JSON.
#[no_mangle]
pub extern "C" fn version_raw() {
    let vocabulary = manifest::current();
    respond(format!(
        "{{\"core\":{},\"manifest\":{},\"schemaVersion\":{}}}",
        json_string(env!("CARGO_PKG_VERSION")),
        json_string(&vocabulary.version),
        manifest::SCHEMA_VERSION
    ));
}

/// Hvor svaret fra siste kall står.
#[no_mangle]
pub extern "C" fn result_ptr() -> *const u8 {
    RESPONSE.with(|s| s.borrow().as_ptr())
}

/// Hvor langt svaret fra siste kall er, i byte.
#[no_mangle]
pub extern "C" fn result_len() -> usize {
    RESPONSE.with(|s| s.borrow().len())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn check(html: &str) -> Vec<Finding> {
        diagnose_page(&utf16(html), &manifest::builtin())
    }

    #[test]
    fn gives_line_and_column_from_one() {
        let text = utf16("ab\nø🧾x");
        assert_eq!(line_and_column(&text, 0), (1, 1));
        assert_eq!(line_and_column(&text, 3), (2, 1));
        // «🧾» er to UTF-16-enheter.
        assert_eq!(line_and_column(&text, 6), (2, 4));
    }

    #[test]
    fn looks_up_lines_like_counting_them() {
        let text = utf16("\n\nab\n\ncd\n");
        let lines = Lines::new(&text);
        for at in 0..=text.len() {
            let before = &text[..at];
            let line = 1 + before.iter().filter(|&&c| c == b'\n' as u16).count();
            let column = match before.iter().rposition(|&c| c == b'\n' as u16) {
                Some(newline) => at - newline,
                None => at + 1,
            };
            assert_eq!(lines.line_and_column(at), (line, column), "ved {at}");
        }
    }

    #[test]
    fn names_the_rule() {
        let findings = check(r#"<button class="fs-buton">Send</button>"#);
        assert_eq!(findings[0].rule, "ukjent-klasse");
        assert!(findings.iter().all(|f| types::RULES.contains(&f.rule)));
    }

    #[test]
    fn checks_against_another_manifest() {
        let html = utf16("<fs-kart sone=\"oslo\"></fs-kart>");
        assert_eq!(
            diagnose_markup(&html, &manifest::builtin())[0].rule,
            "ukjent-element"
        );
        let mut vocabulary = (*manifest::builtin()).clone();
        vocabulary.elements.push(types::Element {
            tag: "fs-kart".into(),
            link: String::new(),
            attributes: vec![("sone".into(), types::Attribute::Text)],
        });
        assert!(diagnose_markup(&html, &vocabulary).is_empty());
    }
}

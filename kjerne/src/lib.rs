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
//!    JSON, i UTF-8, med de samme feltene som `Finding` i TypeScript.
//!
//! Posisjonene i funnene er UTF-16-indekser, som i JavaScript og Kotlin.

pub mod diagnose;
pub mod references;
// Generert, og formatert av generatoren, ikke av rustfmt.
#[rustfmt::skip]
mod ordforrad;
pub mod text;
pub mod types;

use std::cell::RefCell;

use text::{utf16, Utf16};
use types::{Finding, Severity};

/// Det `diagnoseMarkup` finner: ordforrådet, for en mal eller et fragment.
pub fn diagnose_markup(html: &str) -> Vec<Finding> {
    diagnose::diagnose(&utf16(html))
}

/// Det `diagnosePage` finner: ordforrådet og koblingen på en hel side.
pub fn diagnose_page(html: &str) -> Vec<Finding> {
    let side: Utf16 = references::page_source(&utf16(html));
    let mut findings = diagnose::diagnose(&side);
    findings.extend(references::check_references(&side));
    findings.sort_by_key(|f| f.start);
    findings
}

/// Funnene som JSON, i samme form som `JSON.stringify` av `Finding[]`.
pub fn to_json(findings: &[Finding]) -> String {
    let mut out = String::from("[");
    for (i, f) in findings.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(&format!(
            "{{\"start\":{},\"end\":{},\"severity\":{},\"link\":{},\"message\":{}",
            f.start,
            f.end,
            json_string(match f.severity {
                Severity::Error => "error",
                Severity::Warning => "warning",
            }),
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

fn respond(findings: Vec<Finding>) {
    RESPONSE.with(|s| *s.borrow_mut() = to_json(&findings).into_bytes());
}

/// # Safety
/// `peker` og `lengde` må komme fra `alloc(lengde)`, fylt med UTF-8.
#[no_mangle]
pub unsafe extern "C" fn diagnose_markup_raw(ptr: *mut u8, length: usize) {
    respond(diagnose_markup(&read_input(ptr, length)));
}

/// # Safety
/// `peker` og `lengde` må komme fra `alloc(lengde)`, fylt med UTF-8.
#[no_mangle]
pub unsafe extern "C" fn diagnose_page_raw(ptr: *mut u8, length: usize) {
    respond(diagnose_page(&read_input(ptr, length)));
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

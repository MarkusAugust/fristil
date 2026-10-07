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
pub mod koblinger;
// Generert, og formatert av generatoren, ikke av rustfmt.
#[rustfmt::skip]
mod ordforrad;
pub mod tekst;
pub mod typer;

use std::cell::RefCell;

use tekst::{u, Tekst};
use typer::{Alvor, Funn};

/// Det `diagnoseMarkup` finner: ordforrådet, for en mal eller et fragment.
pub fn diagnose_markup(html: &str) -> Vec<Funn> {
    diagnose::diagnose(&u(html))
}

/// Det `diagnosePage` finner: ordforrådet og koblingen på en hel side.
pub fn diagnose_page(html: &str) -> Vec<Funn> {
    let side: Tekst = koblinger::side_kilde(&u(html));
    let mut funn = diagnose::diagnose(&side);
    funn.extend(koblinger::sjekk_koblinger(&side));
    funn.sort_by_key(|f| f.start);
    funn
}

/// Funnene som JSON, i samme form som `JSON.stringify` av `Finding[]`.
pub fn til_json(funn: &[Funn]) -> String {
    let mut ut = String::from("[");
    for (i, f) in funn.iter().enumerate() {
        if i > 0 {
            ut.push(',');
        }
        ut.push_str(&format!(
            "{{\"start\":{},\"end\":{},\"severity\":{},\"link\":{},\"message\":{}",
            f.start,
            f.slutt,
            streng(match f.alvor {
                Alvor::Feil => "error",
                Alvor::Advarsel => "warning",
            }),
            streng(&f.lenke),
            streng(&f.melding),
        ));
        if let Some(r) = &f.rettelse {
            ut.push_str(&format!(
                ",\"fix\":{{\"title\":{},\"start\":{},\"end\":{},\"text\":{},\"preferred\":{}}}",
                streng(&r.tittel),
                r.start,
                r.slutt,
                streng(&r.tekst),
                r.foretrukket
            ));
        }
        ut.push('}');
    }
    ut.push(']');
    ut
}

fn streng(s: &str) -> String {
    let mut ut = String::with_capacity(s.len() + 2);
    ut.push('"');
    for c in s.chars() {
        match c {
            '"' => ut.push_str("\\\""),
            '\\' => ut.push_str("\\\\"),
            '\n' => ut.push_str("\\n"),
            '\r' => ut.push_str("\\r"),
            '\t' => ut.push_str("\\t"),
            c if (c as u32) < 0x20 => ut.push_str(&format!("\\u{:04x}", c as u32)),
            c => ut.push(c),
        }
    }
    ut.push('"');
    ut
}

thread_local! {
    static SVAR: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

/// Et område på `lengde` byte i modulens minne, som verten skriver HTML-en til.
#[no_mangle]
pub extern "C" fn alloc(lengde: usize) -> *mut u8 {
    let mut buf = Vec::<u8>::with_capacity(lengde.max(1));
    let peker = buf.as_mut_ptr();
    std::mem::forget(buf);
    peker
}

/// Frigjør et område fra `alloc`.
///
/// # Safety
/// `peker` og `lengde` må komme fra ett og samme kall til `alloc`.
#[no_mangle]
pub unsafe extern "C" fn dealloc(peker: *mut u8, lengde: usize) {
    drop(Vec::from_raw_parts(peker, 0, lengde.max(1)));
}

/// Leser inndataene, som `alloc` ga og verten fylte, og frigjør dem.
unsafe fn les(peker: *mut u8, lengde: usize) -> String {
    let bytes = Vec::from_raw_parts(peker, lengde, lengde.max(1));
    String::from_utf8_lossy(&bytes).into_owned()
}

fn svar(funn: Vec<Funn>) {
    SVAR.with(|s| *s.borrow_mut() = til_json(&funn).into_bytes());
}

/// # Safety
/// `peker` og `lengde` må komme fra `alloc(lengde)`, fylt med UTF-8.
#[no_mangle]
pub unsafe extern "C" fn diagnose_markup_raw(peker: *mut u8, lengde: usize) {
    svar(diagnose_markup(&les(peker, lengde)));
}

/// # Safety
/// `peker` og `lengde` må komme fra `alloc(lengde)`, fylt med UTF-8.
#[no_mangle]
pub unsafe extern "C" fn diagnose_page_raw(peker: *mut u8, lengde: usize) {
    svar(diagnose_page(&les(peker, lengde)));
}

/// Hvor svaret fra siste kall står.
#[no_mangle]
pub extern "C" fn result_ptr() -> *const u8 {
    SVAR.with(|s| s.borrow().as_ptr())
}

/// Hvor langt svaret fra siste kall er, i byte.
#[no_mangle]
pub extern "C" fn result_len() -> usize {
    SVAR.with(|s| s.borrow().len())
}

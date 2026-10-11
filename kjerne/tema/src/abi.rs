//! Grensesnittet mot verten, det minste alle WebAssembly-runtimer forstår.
//!
//! Ingen bindingsverktøy og ingen importer. Verten skriver tekst inn i
//! modulens minne og leser svaret ut som JSON:
//!
//! 1. `alloc(lengde)` gir en peker til et område i modulens minne.
//! 2. Verten skriver inndataene dit som UTF-8.
//! 3. Et `*_raw(peker, lengde)`-kall leser inndataene, frigjør dem og legger
//!    svaret i modulens minne.
//! 4. `result_ptr()` og `result_len()` sier hvor svaret står.
//!
//! Dette ligger i `fristil-tema` og ikke i `fristil-kjerne`, fordi det er
//! den nederste crate-en: et `#[no_mangle]`-symbol kan bare finnes én gang i
//! en modul, og kjernen, som avhenger av temaet, får dem med derfra.

use std::cell::RefCell;

use crate::json::json_string;

thread_local! {
    static RESPONSE: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

/// Legger svaret fra et kall der `result_ptr` og `result_len` finner det.
pub fn respond(json: String) {
    RESPONSE.with(|s| *s.borrow_mut() = json.into_bytes());
}

/// Et område på `lengde` byte i modulens minne, som verten skriver inndataene til.
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
///
/// # Safety
/// `peker` og `lengde` må komme fra `alloc(lengde)`, fylt med UTF-8.
pub unsafe fn read_input(ptr: *mut u8, length: usize) -> String {
    let bytes = Vec::from_raw_parts(ptr, length, length.max(1));
    String::from_utf8_lossy(&bytes).into_owned()
}

/// Et JSON-objekt av nøkler og strengverdier.
pub fn json_object(entries: &[(String, String)]) -> String {
    let fields: Vec<String> = entries
        .iter()
        .map(|(k, v)| format!("{}:{}", json_string(k), json_string(v)))
        .collect();
    format!("{{{}}}", fields.join(","))
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

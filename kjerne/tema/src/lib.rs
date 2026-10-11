//! Fristils tema: et helt fargetema av noen få merkefarger, og kontrollen av
//! et tema en konsument har skrevet selv.
//!
//! En egen crate under kjernen, av én grunn: pakken trenger fargeregningen
//! før manifestet finnes. `tokens.css` skrives av matrisen, matrisen regnes
//! her, og manifestet skrives etter `tokens.css`. Bar kjernen både manifestet
//! og fargeregningen, måtte den bygges to ganger, én gang for matrisen og én
//! gang for det nye manifestet. Her bæres bare fargekontrakten.
//!
//! `fristil-kjerne` avhenger av denne og eksporterer det samme fra sin egen
//! modul, så en vert som har kjernen, har temaet. Modulen fra denne crate-en
//! alene har bare temaet, og er den pakken bygger matrisen med.
//!
//! Minnet og svaret mot verten (`alloc`, `dealloc`, `result_ptr` og
//! `result_len`) står i `abi`. De to kallene temaet svarer på, står her:
//!
//! - `build_theme_raw(peker, lengde)` tar oppskriften som JSON, de samme
//!   feltene som `ThemeInput` i TypeScript, og svarer 0 med temaet eller 1
//!   med `{"error": …}`.
//! - `inspect_theme_raw(peker, lengde)` tar CSS-en og svarer med funnene og
//!   hva som ble kontrollert.

pub mod abi;
pub mod json;
pub mod theme;

use abi::{json_object, read_input, respond};
use json::json_string;

/// Bygger et tema av oppskriften verten har skrevet inn, som JSON: de samme
/// feltene som `ThemeInput` i TypeScript. Svarer 0 med temaet, eller 1 med
/// `{"error": …}`.
///
/// # Safety
/// `peker` og `lengde` må komme fra `alloc(lengde)`, fylt med UTF-8.
#[no_mangle]
pub unsafe extern "C" fn build_theme_raw(ptr: *mut u8, length: usize) -> u32 {
    let built = json::parse(&read_input(ptr, length)).and_then(|input| theme::build_theme(&input));
    match built {
        Ok(t) => {
            let violations: Vec<String> = t
                .violations
                .iter()
                .map(|v| {
                    format!(
                        "{{\"family\":{},\"promise\":{},\"ratio\":{},\"required\":{}}}",
                        json_string(&v.family),
                        json_string(&v.promise),
                        theme::js_number(v.ratio),
                        theme::js_number(v.required)
                    )
                })
                .collect();
            respond(format!(
                "{{\"light\":{},\"dark\":{},\"violations\":[{}],\"css\":{}}}",
                json_object(&t.light),
                json_object(&t.dark),
                violations.join(","),
                json_string(&t.css)
            ));
            0
        }
        Err(error) => {
            respond(format!("{{\"error\":{}}}", json_string(&error)));
            1
        }
    }
}

/// Kontrollerer et tema verten har skrevet inn, som CSS-tekst.
///
/// # Safety
/// `peker` og `lengde` må komme fra `alloc(lengde)`, fylt med UTF-8.
#[no_mangle]
pub unsafe extern "C" fn inspect_theme_raw(ptr: *mut u8, length: usize) {
    let report = theme::check::inspect_theme(&read_input(ptr, length));
    let problems: Vec<String> = report
        .problems
        .iter()
        .map(|p| {
            format!(
                "{{\"selector\":{},\"message\":{}}}",
                json_string(&p.selector),
                json_string(&p.message)
            )
        })
        .collect();
    respond(format!(
        "{{\"problems\":[{}],\"blocks\":{},\"declarations\":{},\"promises\":{}}}",
        problems.join(","),
        report.blocks,
        report.declarations,
        report.promises
    ));
}

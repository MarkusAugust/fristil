//! Koblingen på en hel side: at hver id det pekes på finnes, og at hvert felt
//! og hver tekst er koblet.
//!
//! En oversettelse av `designsystem/src/diagnostics/references.ts`, med de
//! samme meldingene. Kommentarene der forklarer reglene.

use std::collections::{HashMap, HashSet};

use crate::diagnose::{følges_av_slutt, les_attributter, tagg_slutt, LestAttributt};
use crate::tekst::*;
use crate::typer::*;

const LENKE: &str = "https://fristil.sobernetics.no/components/field/";
const OPPSUMMERING_LENKE: &str = "https://fristil.sobernetics.no/components/error-summary/";

const HVORDAN: &str = "Lag koblingen med fs.field({ id }) der koden kan kalle en JavaScript-funksjon, eller legg feltet i <fs-field>, som setter den i nettleseren.";

/// Attributtene som peker på id-er, og hva skjermleseren mister når de bommer.
const REFERANSER: &[(&str, &str)] = &[
    ("for", "ledeteksten"),
    ("aria-describedby", "beskrivelsen"),
    ("aria-labelledby", "navnet"),
    ("aria-controls", "koblingen til det elementet styrer"),
];

const UTEN_LEDETEKST: &[&str] = &["hidden", "submit", "button", "reset", "image"];

const KAN_HA_LEDETEKST: &[&str] = &[
    "button", "input", "meter", "output", "progress", "select", "textarea",
];

const TOMME: &[&str] = &[
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source",
    "track", "wbr",
];

const RÅ_TEKST: &[&str] = &["script", "style", "textarea", "template"];

struct Node {
    navn: String,
    navn_start: usize,
    navn_slutt: usize,
    attributter: Vec<LestAttributt>,
    forelder: Option<usize>,
}

fn verdi<'a>(node: &'a Node, navn: &str) -> Option<&'a LestAttributt> {
    node.attributter.iter().find(|a| lik(&a.navn, navn))
}

fn ikke_tom<'a>(node: &'a Node, navn: &str) -> Option<&'a Tekst> {
    verdi(node, navn).and_then(|a| a.verdi_ikke_tom())
}

fn har_klasse(node: &Node, test: impl Fn(&[u16]) -> bool) -> bool {
    verdi(node, "class")
        .and_then(|a| a.verdi.as_deref())
        .is_some_and(|v| ord(v).iter().any(|(_, t)| test(t)))
}

/// Noden selv eller en forfar som oppfyller vilkåret.
fn innenfor(noder: &[Node], node: usize, test: impl Fn(&Node) -> bool) -> bool {
    let mut n = Some(node);
    while let Some(i) = n {
        if test(&noder[i]) {
            return true;
        }
        n = noder[i].forelder;
    }
    false
}

/// Om nettleseren skjuler noden, selv eller gjennom en forfar.
fn er_skjult(noder: &[Node], node: usize) -> bool {
    let navn = noder[node].navn.as_str();
    let mut n = Some(node);
    while let Some(i) = n {
        let m = &noder[i];
        let skjult = verdi(m, "hidden").is_some()
            || (m.navn == "dialog" && verdi(m, "open").is_none())
            || (m.navn == "details"
                && i != node
                && verdi(m, "open").is_none()
                && navn != "summary");
        if skjult {
            return true;
        }
        n = m.forelder;
    }
    false
}

const ENTITETER: &[(&str, char)] = &[
    ("amp", '&'),
    ("lt", '<'),
    ("gt", '>'),
    ("quot", '"'),
    ("apos", '\''),
    ("nbsp", '\u{a0}'),
];

/// Et kodepunkt som UTF-16. Et surrogat blir stående alene, som
/// `String.fromCodePoint` gjør.
fn kodepunkt(ut: &mut Tekst, kode: u32) {
    if kode >= 0x10000 {
        let k = kode - 0x10000;
        ut.push(0xD800 + (k >> 10) as u16);
        ut.push(0xDC00 + (k & 0x3FF) as u16);
    } else {
        ut.push(kode as u16);
    }
}

/// Tallet i en entitet, eller `None` når det ikke er et tegn.
fn tall(sifre: &[u16], grunntall: u32) -> Option<u32> {
    let mut v: u64 = 0;
    for &c in sifre {
        v = v * grunntall as u64 + (c as u8 as char).to_digit(grunntall)? as u64;
        if v > 0x10FFFF {
            return None;
        }
    }
    (v > 0).then_some(v as u32)
}

/// En attributtverdi slik nettleseren leser den, med entitetene dekodet:
/// `/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi`.
fn dekod(t: &[u16]) -> Tekst {
    let mut ut = Vec::with_capacity(t.len());
    let mut i = 0;
    while i < t.len() {
        if t[i] != b'&' as u16 {
            ut.push(t[i]);
            i += 1;
            continue;
        }
        let løp = |fra: usize, test: fn(u16) -> bool| {
            let mut j = fra;
            while j < t.len() && test(t[j]) {
                j += 1;
            }
            j
        };
        let er_hex = |c: u16| c < 0x80 && (c as u8).is_ascii_hexdigit();
        let semikolon = |j: usize| t.get(j) == Some(&(b';' as u16));
        let mut treff: Option<(usize, Option<Tekst>)> = None;
        if har_ved(t, i + 1, "#")
            && t.get(i + 2)
                .is_some_and(|&c| c == b'x' as u16 || c == b'X' as u16)
        {
            let j = løp(i + 3, er_hex);
            if j > i + 3 && semikolon(j) {
                let mut tegn = Vec::new();
                if let Some(k) = tall(&t[i + 3..j], 16) {
                    kodepunkt(&mut tegn, k);
                }
                treff = Some((j + 1, (!tegn.is_empty()).then_some(tegn)));
            }
        }
        if treff.is_none() && har_ved(t, i + 1, "#") {
            let j = løp(i + 2, er_siffer);
            if j > i + 2 && semikolon(j) {
                let mut tegn = Vec::new();
                if let Some(k) = tall(&t[i + 2..j], 10) {
                    kodepunkt(&mut tegn, k);
                }
                treff = Some((j + 1, (!tegn.is_empty()).then_some(tegn)));
            }
        }
        if treff.is_none() {
            let j = løp(i + 1, er_ascii_bokstav);
            if j > i + 1 && semikolon(j) {
                let navn = liten(&t[i + 1..j]);
                let tegn = ENTITETER
                    .iter()
                    .find(|(n, _)| lik(&navn, n))
                    .map(|(_, c)| u(&c.to_string()));
                treff = Some((j + 1, tegn));
            }
        }
        match treff {
            Some((slutt, tegn)) => {
                match tegn {
                    Some(tegn) => ut.extend(tegn),
                    None => ut.extend_from_slice(&t[i..slutt]),
                }
                i = slutt;
            }
            None => {
                ut.push(t[i]);
                i += 1;
            }
        }
    }
    ut
}

/// `decodeURIComponent`, eller `None` der den kaster `URIError`.
fn dekod_uri(t: &[u16]) -> Option<Tekst> {
    let hex = |i: usize| -> Option<u8> {
        if t.get(i)? != &(b'%' as u16) {
            return None;
        }
        let h = |c: u16| (c < 0x80).then(|| (c as u8 as char).to_digit(16)).flatten();
        Some((h(*t.get(i + 1)?)? * 16 + h(*t.get(i + 2)?)?) as u8)
    };
    let mut ut = Vec::with_capacity(t.len());
    let mut i = 0;
    while i < t.len() {
        if t[i] != b'%' as u16 {
            ut.push(t[i]);
            i += 1;
            continue;
        }
        let første = hex(i)?;
        i += 3;
        let antall = match første {
            0x00..=0x7F => {
                ut.push(første as u16);
                continue;
            }
            0xC0..=0xDF => 2,
            0xE0..=0xEF => 3,
            0xF0..=0xF7 => 4,
            _ => return None,
        };
        let mut bytes = vec![første];
        for _ in 1..antall {
            let b = hex(i)?;
            if b & 0xC0 != 0x80 {
                return None;
            }
            bytes.push(b);
            i += 3;
        }
        // Rust avviser de samme sekvensene som JavaScript: for lange
        // kodinger, surrogater og kodepunkter over U+10FFFF.
        let tegn = std::str::from_utf8(&bytes).ok()?;
        ut.extend(tegn.encode_utf16());
    }
    Some(ut)
}

/// Id-en en lenke som `href="#f%C3%B8dselsdato"` går til.
fn fragment(href: &[u16]) -> Tekst {
    match dekod_uri(href) {
        Some(d) => dekod(&d),
        None => dekod(href),
    }
}

/// `<(\/?)([a-z][a-z0-9-]*)(?=[\s/>])` ved `i`: om det er en lukketagg, og
/// der navnet begynner og slutter.
fn tagg_ved(t: &[u16], i: usize) -> Option<(bool, usize, usize)> {
    if t.get(i) != Some(&LT) {
        return None;
    }
    let lukker = t.get(i + 1) == Some(&SKRÅSTREK);
    let navn_start = i + 1 + usize::from(lukker);
    if !t.get(navn_start).is_some_and(|&c| er_ascii_bokstav(c)) {
        return None;
    }
    let mut j = navn_start + 1;
    while j < t.len() && er_navnetegn(t[j]) {
        j += 1;
    }
    følges_av_slutt(t, j).then_some((lukker, navn_start, j))
}

/// Siden slik den leses som en hel side, med samme lengde.
pub fn side_kilde(tekst: &[u16]) -> Tekst {
    let mut områder: Vec<(usize, usize)> = Vec::new();
    let mut i = 0;
    while i < tekst.len() {
        let Some(lt) = finn_tegn(tekst, i, LT) else {
            break;
        };
        if har_ved(tekst, lt, "<!--") {
            let slutt = finn(tekst, lt + 4, "-->").map_or(tekst.len(), |c| c + 3);
            områder.push((lt, slutt));
            i = slutt;
            continue;
        }
        let Some((lukker, navn_start, navn_slutt)) = tagg_ved(tekst, lt) else {
            i = lt + 1;
            continue;
        };
        let Some(slutt) = tagg_slutt(tekst, navn_slutt) else {
            break;
        };
        i = slutt + 1;
        if lukker {
            continue;
        }
        for a in les_attributter(&tekst[navn_slutt..slutt], navn_slutt) {
            if let Some(v) = &a.verdi {
                if v.contains(&LT) {
                    områder.push((a.verdi_start, a.verdi_start + v.len()));
                }
            }
        }
        let navn = s(&liten(&tekst[navn_start..navn_slutt]));
        if RÅ_TEKST.contains(&navn.as_str()) {
            let lukk = lukk_rå(tekst, slutt + 1, &navn).unwrap_or(tekst.len());
            områder.push((slutt + 1, lukk));
            i = lukk;
        }
    }

    let mut ut = tekst.to_vec();
    for (fra, til) in områder {
        blank(&mut ut[fra..til.max(fra)]);
    }
    ut
}

/// `</navn\s*>` fra `fra`.
fn lukk_rå(t: &[u16], fra: usize, navn: &str) -> Option<usize> {
    (fra..t.len()).find(|&i| {
        t[i] == LT && har_ved(t, i + 1, "/") && har_ved_ci(t, i + 2, navn) && {
            let mut j = i + 2 + navn.len();
            while j < t.len() && er_mellomrom(t[j]) {
                j += 1;
            }
            t.get(j) == Some(&GT)
        }
    })
}

/// Om taggen avsluttes med `/>`: `/(^|[\s"'])\/$/`.
fn lukker_selv(b: &[u16]) -> bool {
    b.last() == Some(&SKRÅSTREK)
        && (b.len() == 1 || {
            let c = b[b.len() - 2];
            er_mellomrom(c) || c == DOBBEL || c == ENKEL
        })
}

/// Elementene på siden som et tre, i den rekkefølgen de står.
fn tre(kilde: &[u16]) -> Vec<Node> {
    let mut noder: Vec<Node> = Vec::new();
    let mut stabel: Vec<usize> = Vec::new();
    let mut i = 0;
    while i < kilde.len() {
        let Some((lukker, navn_start, navn_slutt)) = tagg_ved(kilde, i) else {
            i += 1;
            continue;
        };
        let Some(slutt) = tagg_slutt(kilde, navn_slutt) else {
            break;
        };
        i = slutt + 1;
        let navn = s(&liten(&kilde[navn_start..navn_slutt]));
        if lukker {
            if let Some(at) = stabel.iter().rposition(|&n| noder[n].navn == navn) {
                stabel.truncate(at);
            }
            continue;
        }
        let b = &kilde[navn_slutt..slutt];
        let selv = lukker_selv(b);
        let fremmed = navn == "svg"
            || navn == "math"
            || stabel
                .iter()
                .any(|&n| noder[n].navn == "svg" || noder[n].navn == "math");
        noder.push(Node {
            navn_start,
            navn_slutt: navn_start + (navn_slutt - navn_start),
            attributter: les_attributter(if selv { &b[..b.len() - 1] } else { b }, navn_slutt),
            forelder: stabel.last().copied(),
            navn,
        });
        let indeks = noder.len() - 1;
        if !TOMME.contains(&noder[indeks].navn.as_str()) && !(selv && fremmed) {
            stabel.push(indeks);
        }
    }
    noder
}

fn funn(start: usize, slutt: usize, alvor: Alvor, lenke: &str, melding: String) -> Funn {
    Funn {
        start,
        slutt,
        alvor,
        lenke: lenke.into(),
        melding,
        rettelse: None,
    }
}

/// Alle funn om koblingen på siden, i den rekkefølgen de står.
pub fn sjekk_koblinger(tekst: &[u16]) -> Vec<Funn> {
    let noder = tre(&side_kilde(tekst));
    let mut ut = Vec::new();
    let mut ider: HashMap<Tekst, usize> = HashMap::new();
    let mut ledetekst_for: HashSet<Tekst> = HashSet::new();
    let mut beskrevet_av: HashSet<Tekst> = HashSet::new();

    for (n, node) in noder.iter().enumerate() {
        if let Some(id) = verdi(node, "id").filter(|a| a.verdi_ikke_tom().is_some()) {
            let v = id.verdi.as_ref().unwrap();
            let dekodet = dekod(v);
            if ider.contains_key(&dekodet) {
                ut.push(funn(
                    id.verdi_start,
                    id.verdi_start + v.len(),
                    Alvor::Feil,
                    LENKE,
                    format!(
                        "id=\"{}\" står mer enn én gang på siden. for og aria-describedby peker da på det første elementet, og koblingen til dette er brutt. Hver id må være unik.",
                        s(v)
                    ),
                ));
            } else {
                ider.insert(dekodet, n);
            }
        }
        if node.navn == "label" {
            if let Some(mål) = ikke_tom(node, "for") {
                ledetekst_for.insert(dekod(mål));
            }
        }
        if let Some(v) = verdi(node, "aria-describedby").and_then(|a| a.verdi.as_deref()) {
            for (_, del) in ord(&dekod(v)) {
                beskrevet_av.insert(del.to_vec());
            }
        }
    }

    for (n, node) in noder.iter().enumerate() {
        for (navn, mister) in REFERANSER {
            let Some(a) = verdi(node, navn).filter(|a| a.verdi_ikke_tom().is_some()) else {
                continue;
            };
            let v = a.verdi.as_ref().unwrap();
            for (posisjon, mål) in ord(v) {
                let ved = a.verdi_start + posisjon;
                match ider.get(&dekod(mål)) {
                    None => ut.push(funn(
                        ved,
                        ved + mål.len(),
                        Alvor::Feil,
                        LENKE,
                        format!(
                            "{navn}=\"{}\" peker på id-en «{}», som ikke finnes på siden. Skjermleseren mister {mister}. {}",
                            s(v),
                            s(mål),
                            if *navn == "aria-controls" { "" } else { HVORDAN }
                        ),
                    )),
                    Some(&funnet) => {
                        let f = &noder[funnet].navn;
                        if *navn == "for" && node.navn == "label" && !KAN_HA_LEDETEKST.contains(&f.as_str()) && !f.contains('-') {
                            ut.push(funn(
                                ved,
                                ved + mål.len(),
                                Alvor::Feil,
                                LENKE,
                                format!(
                                    "for=\"{}\" peker på et <{f}>, som ikke kan ha en ledetekst. for må peke på feltet selv: <input>, <select>, <textarea> eller en knapp. {HVORDAN}",
                                    s(v)
                                ),
                            ));
                        }
                    }
                }
            }
        }

        if node.navn == "a"
            && innenfor(&noder, n, |m| {
                m.navn == "fs-error-summary" || har_klasse(m, |c| lik(c, "fs-error-summary"))
            })
        {
            if let Some(href) = verdi(node, "href") {
                let v = href.verdi.as_deref().unwrap_or(&[]);
                let mål = if har_ved(v, 0, "#") { &v[1..] } else { &[][..] };
                if !mål.is_empty() && !ider.contains_key(&fragment(mål)) {
                    ut.push(funn(
                        href.verdi_start + 1,
                        href.verdi_start + mål.len() + 1,
                        Alvor::Feil,
                        OPPSUMMERING_LENKE,
                        format!(
                            "Lenken i feiloppsummeringen går til «#{}», som ikke finnes på siden. Den skal gå til feltet som feilet, slik at brukeren havner der feilen kan rettes.",
                            s(mål)
                        ),
                    ));
                }
            }
        }

        if innenfor(&noder, n, |m| m.navn == "fs-field") {
            continue;
        }

        let type_ = verdi(node, "type")
            .and_then(|a| a.verdi.as_deref())
            .map(liten)
            .unwrap_or_default();
        if matches!(node.navn.as_str(), "input" | "textarea" | "select")
            && har_klasse(node, |c| har_ved(c, 0, "fs-"))
            && !UTEN_LEDETEKST.iter().any(|t| lik(&type_, t))
        {
            let navngitt = innenfor(&noder, n, |m| {
                m.navn == "fs-suggestion" || m.navn == "label"
            }) || ikke_tom(node, "id")
                .is_some_and(|id| ledetekst_for.contains(&dekod(id)))
                || verdi(node, "aria-label").is_some()
                || verdi(node, "aria-labelledby").is_some();
            if !navngitt {
                ut.push(funn(
                    node.navn_start,
                    node.navn_slutt,
                    Alvor::Advarsel,
                    LENKE,
                    format!(
                        "<{}> har ingen ledetekst: ingen <label for> som peker på det, ingen <label> rundt, og verken aria-label eller aria-labelledby. En skjermleser leser feltet opp uten navn. {HVORDAN}",
                        node.navn
                    ),
                ));
            }
        }

        let slag = if har_klasse(node, |c| lik(c, "fs-error-text")) {
            Some("Feilmeldingen")
        } else if har_klasse(node, |c| lik(c, "fs-help-text")) {
            Some("Hjelpeteksten")
        } else {
            None
        };
        let rolle = verdi(node, "role")
            .and_then(|a| a.verdi.as_deref())
            .unwrap_or(&[]);
        let levende =
            lik(rolle, "status") || lik(rolle, "alert") || verdi(node, "aria-live").is_some();
        if let Some(slag) = slag {
            if !levende && !er_skjult(&noder, n) {
                let id = ikke_tom(node, "id");
                if id.is_none_or(|id| !beskrevet_av.contains(&dekod(id))) {
                    let midt = match id {
                        Some(id) => format!(
                            "id-en «{}» står ikke i aria-describedby på noe felt. ",
                            s(id)
                        ),
                        None => {
                            "den har ingen id, så ingen aria-describedby kan peke på den. ".into()
                        }
                    };
                    ut.push(funn(
                        node.navn_start,
                        node.navn_slutt,
                        Alvor::Advarsel,
                        LENKE,
                        format!("{slag} er ikke koblet til noe felt: {midt}En skjermleser leser den ikke opp sammen med feltet. {HVORDAN}"),
                    ));
                }
            }
        }
    }

    ut.sort_by_key(|f| f.start);
    ut
}

//! Koblingen på en hel side: at hver id det pekes på finnes, og at hvert felt
//! og hver tekst er koblet.
//!
//! En oversettelse av `designsystem/src/diagnostics/references.ts`, med de
//! samme meldingene. Kommentarene der forklarer reglene.

use std::collections::{HashMap, HashSet};

use crate::diagnose::{followed_by_end, read_attributes, tag_end, ReadAttribute};
use crate::text::*;
use crate::types::*;

const LINK: &str = "https://fristil.sobernetics.no/components/field/";
const SUMMARY_LINK: &str = "https://fristil.sobernetics.no/components/error-summary/";

const HOW: &str = "Lag koblingen med fs.field({ id }) der koden kan kalle en JavaScript-funksjon, eller legg feltet i <fs-field>, som setter den i nettleseren.";

/// Attributtene som peker på id-er, og hva skjermleseren mister når de bommer.
const REFERENCES: &[(&str, &str)] = &[
    ("for", "ledeteksten"),
    ("aria-describedby", "beskrivelsen"),
    ("aria-labelledby", "navnet"),
    ("aria-controls", "koblingen til det elementet styrer"),
];

const UNLABELLED_TYPES: &[&str] = &["hidden", "submit", "button", "reset", "image"];

const LABELABLE: &[&str] = &[
    "button", "input", "meter", "output", "progress", "select", "textarea",
];

const VOID: &[&str] = &[
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source",
    "track", "wbr",
];

const RAW_TEXT: &[&str] = &["script", "style", "textarea", "template"];

struct Node {
    name: String,
    name_start: usize,
    name_end: usize,
    attributes: Vec<ReadAttribute>,
    parent: Option<usize>,
}

fn value<'a>(node: &'a Node, name: &str) -> Option<&'a ReadAttribute> {
    node.attributes.iter().find(|a| equals(&a.name, name))
}

fn non_empty<'a>(node: &'a Node, name: &str) -> Option<&'a Utf16> {
    value(node, name).and_then(|a| a.non_empty_value())
}

fn has_class(node: &Node, test: impl Fn(&[u16]) -> bool) -> bool {
    value(node, "class")
        .and_then(|a| a.value.as_deref())
        .is_some_and(|v| words(v).iter().any(|(_, t)| test(t)))
}

/// Noden selv eller en forfar som oppfyller vilkåret.
fn within(nodes: &[Node], node: usize, test: impl Fn(&Node) -> bool) -> bool {
    let mut n = Some(node);
    while let Some(i) = n {
        if test(&nodes[i]) {
            return true;
        }
        n = nodes[i].parent;
    }
    false
}

/// Om nettleseren skjuler noden, selv eller gjennom en forfar.
fn is_hidden(nodes: &[Node], node: usize) -> bool {
    let name = nodes[node].name.as_str();
    let mut n = Some(node);
    while let Some(i) = n {
        let m = &nodes[i];
        let hidden = value(m, "hidden").is_some()
            || (m.name == "dialog" && value(m, "open").is_none())
            || (m.name == "details"
                && i != node
                && value(m, "open").is_none()
                && name != "summary");
        if hidden {
            return true;
        }
        n = m.parent;
    }
    false
}

const ENTITIES: &[(&str, char)] = &[
    ("amp", '&'),
    ("lt", '<'),
    ("gt", '>'),
    ("quot", '"'),
    ("apos", '\''),
    ("nbsp", '\u{a0}'),
];

/// Et kodepunkt som UTF-16. Et surrogat blir stående alene, som
/// `String.fromCodePoint` gjør.
fn push_code_point(out: &mut Utf16, kode: u32) {
    if kode >= 0x10000 {
        let k = kode - 0x10000;
        out.push(0xD800 + (k >> 10) as u16);
        out.push(0xDC00 + (k & 0x3FF) as u16);
    } else {
        out.push(kode as u16);
    }
}

/// Tallet i en entitet, eller `None` når det ikke er et tegn.
fn parse_code(digits: &[u16], radix: u32) -> Option<u32> {
    let mut v: u64 = 0;
    for &c in digits {
        v = v * radix as u64 + (c as u8 as char).to_digit(radix)? as u64;
        if v > 0x10FFFF {
            return None;
        }
    }
    (v > 0).then_some(v as u32)
}

/// En attributtverdi slik nettleseren leser den, med entitetene dekodet:
/// `/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi`.
fn decode(t: &[u16]) -> Utf16 {
    let mut out = Vec::with_capacity(t.len());
    let mut i = 0;
    while i < t.len() {
        if t[i] != b'&' as u16 {
            out.push(t[i]);
            i += 1;
            continue;
        }
        let run = |from: usize, test: fn(u16) -> bool| {
            let mut j = from;
            while j < t.len() && test(t[j]) {
                j += 1;
            }
            j
        };
        let is_hex = |c: u16| c < 0x80 && (c as u8).is_ascii_hexdigit();
        let semicolon = |j: usize| t.get(j) == Some(&(b';' as u16));
        let mut hit: Option<(usize, Option<Utf16>)> = None;
        if starts_at(t, i + 1, "#")
            && t.get(i + 2)
                .is_some_and(|&c| c == b'x' as u16 || c == b'X' as u16)
        {
            let j = run(i + 3, is_hex);
            if j > i + 3 && semicolon(j) {
                let mut chars_ = Vec::new();
                if let Some(k) = parse_code(&t[i + 3..j], 16) {
                    push_code_point(&mut chars_, k);
                }
                hit = Some((j + 1, (!chars_.is_empty()).then_some(chars_)));
            }
        }
        if hit.is_none() && starts_at(t, i + 1, "#") {
            let j = run(i + 2, is_digit);
            if j > i + 2 && semicolon(j) {
                let mut chars_ = Vec::new();
                if let Some(k) = parse_code(&t[i + 2..j], 10) {
                    push_code_point(&mut chars_, k);
                }
                hit = Some((j + 1, (!chars_.is_empty()).then_some(chars_)));
            }
        }
        if hit.is_none() {
            let j = run(i + 1, is_ascii_letter);
            if j > i + 1 && semicolon(j) {
                let name = lowercase(&t[i + 1..j]);
                let chars_ = ENTITIES
                    .iter()
                    .find(|(n, _)| equals(&name, n))
                    .map(|(_, c)| utf16(&c.to_string()));
                hit = Some((j + 1, chars_));
            }
        }
        match hit {
            Some((end, chars_)) => {
                match chars_ {
                    Some(chars_) => out.extend(chars_),
                    None => out.extend_from_slice(&t[i..end]),
                }
                i = end;
            }
            None => {
                out.push(t[i]);
                i += 1;
            }
        }
    }
    out
}

/// `decodeURIComponent`, eller `None` der den kaster `URIError`.
fn decode_uri_component(t: &[u16]) -> Option<Utf16> {
    let hex = |i: usize| -> Option<u8> {
        if t.get(i)? != &(b'%' as u16) {
            return None;
        }
        let h = |c: u16| (c < 0x80).then(|| (c as u8 as char).to_digit(16)).flatten();
        Some((h(*t.get(i + 1)?)? * 16 + h(*t.get(i + 2)?)?) as u8)
    };
    let mut out = Vec::with_capacity(t.len());
    let mut i = 0;
    while i < t.len() {
        if t[i] != b'%' as u16 {
            out.push(t[i]);
            i += 1;
            continue;
        }
        let first = hex(i)?;
        i += 3;
        let count = match first {
            0x00..=0x7F => {
                out.push(first as u16);
                continue;
            }
            0xC0..=0xDF => 2,
            0xE0..=0xEF => 3,
            0xF0..=0xF7 => 4,
            _ => return None,
        };
        let mut bytes = vec![first];
        for _ in 1..count {
            let b = hex(i)?;
            if b & 0xC0 != 0x80 {
                return None;
            }
            bytes.push(b);
            i += 3;
        }
        // Rust avviser de samme sekvensene som JavaScript: for lange
        // kodinger, surrogater og kodepunkter over U+10FFFF.
        let chars_ = std::str::from_utf8(&bytes).ok()?;
        out.extend(chars_.encode_utf16());
    }
    Some(out)
}

/// Id-en en lenke som `href="#f%C3%B8dselsdato"` går til.
fn fragment(href: &[u16]) -> Utf16 {
    match decode_uri_component(href) {
        Some(d) => decode(&d),
        None => decode(href),
    }
}

/// `<(\/?)([a-z][a-z0-9-]*)(?=[\s/>])` ved `i`: om det er en lukketagg, og
/// der navnet begynner og slutter.
fn tag_at(t: &[u16], i: usize) -> Option<(bool, usize, usize)> {
    if t.get(i) != Some(&LT) {
        return None;
    }
    let closer = t.get(i + 1) == Some(&SLASH);
    let name_start = i + 1 + usize::from(closer);
    if !t.get(name_start).is_some_and(|&c| is_ascii_letter(c)) {
        return None;
    }
    let mut j = name_start + 1;
    while j < t.len() && is_name_char(t[j]) {
        j += 1;
    }
    followed_by_end(t, j).then_some((closer, name_start, j))
}

/// Siden slik den leses som en hel side, med samme lengde.
pub fn page_source(text: &[u16]) -> Utf16 {
    let mut ranges: Vec<(usize, usize)> = Vec::new();
    let mut i = 0;
    while i < text.len() {
        let Some(lt) = find_unit(text, i, LT) else {
            break;
        };
        if starts_at(text, lt, "<!--") {
            let end = find_at(text, lt + 4, "-->").map_or(text.len(), |c| c + 3);
            ranges.push((lt, end));
            i = end;
            continue;
        }
        let Some((closer, name_start, name_end)) = tag_at(text, lt) else {
            i = lt + 1;
            continue;
        };
        let Some(end) = tag_end(text, name_end) else {
            break;
        };
        i = end + 1;
        if closer {
            continue;
        }
        for a in read_attributes(&text[name_end..end], name_end) {
            if let Some(v) = &a.value {
                if v.contains(&LT) {
                    ranges.push((a.value_start, a.value_start + v.len()));
                }
            }
        }
        let name = lossy(&lowercase(&text[name_start..name_end]));
        if RAW_TEXT.contains(&name.as_str()) {
            let close = raw_close(text, end + 1, &name).unwrap_or(text.len());
            ranges.push((end + 1, close));
            i = close;
        }
    }

    let mut out = text.to_vec();
    for (from, to) in ranges {
        blank(&mut out[from..to.max(from)]);
    }
    out
}

/// `</navn\s*>` fra `fra`.
fn raw_close(t: &[u16], from: usize, name: &str) -> Option<usize> {
    (from..t.len()).find(|&i| {
        t[i] == LT && starts_at(t, i + 1, "/") && starts_at_ci(t, i + 2, name) && {
            let mut j = i + 2 + name.len();
            while j < t.len() && is_space(t[j]) {
                j += 1;
            }
            t.get(j) == Some(&GT)
        }
    })
}

/// Om taggen avsluttes med `/>`: `/(^|[\s"'])\/$/`.
fn self_closing(b: &[u16]) -> bool {
    b.last() == Some(&SLASH)
        && (b.len() == 1 || {
            let c = b[b.len() - 2];
            is_space(c) || c == DOUBLE_QUOTE || c == SINGLE_QUOTE
        })
}

/// Elementene på siden som et tre, i den rekkefølgen de står.
fn tree(source: &[u16]) -> Vec<Node> {
    let mut nodes: Vec<Node> = Vec::new();
    let mut stabel: Vec<usize> = Vec::new();
    let mut i = 0;
    while i < source.len() {
        let Some((closer, name_start, name_end)) = tag_at(source, i) else {
            i += 1;
            continue;
        };
        let Some(end) = tag_end(source, name_end) else {
            break;
        };
        i = end + 1;
        let name = lossy(&lowercase(&source[name_start..name_end]));
        if closer {
            if let Some(at) = stabel.iter().rposition(|&n| nodes[n].name == name) {
                stabel.truncate(at);
            }
            continue;
        }
        let b = &source[name_end..end];
        let self_closes = self_closing(b);
        let foreign = name == "svg"
            || name == "math"
            || stabel
                .iter()
                .any(|&n| nodes[n].name == "svg" || nodes[n].name == "math");
        nodes.push(Node {
            name_start,
            name_end: name_start + (name_end - name_start),
            attributes: read_attributes(if self_closes { &b[..b.len() - 1] } else { b }, name_end),
            parent: stabel.last().copied(),
            name,
        });
        let index = nodes.len() - 1;
        if !VOID.contains(&nodes[index].name.as_str()) && !(self_closes && foreign) {
            stabel.push(index);
        }
    }
    nodes
}

fn findings(
    rule: &'static str,
    start: usize,
    end: usize,
    severity: Severity,
    link: &str,
    message: String,
) -> Finding {
    Finding {
        rule,
        start,
        end,
        severity,
        link: link.into(),
        message,
        fix: None,
    }
}

/// Alle funn om koblingen på siden, i den rekkefølgen de står.
pub fn check_references(text: &[u16]) -> Vec<Finding> {
    let nodes = tree(&page_source(text));
    let mut out = Vec::new();
    let mut ids: HashMap<Utf16, usize> = HashMap::new();
    let mut label_for: HashSet<Utf16> = HashSet::new();
    let mut described_by: HashSet<Utf16> = HashSet::new();

    for (n, node) in nodes.iter().enumerate() {
        if let Some(id) = value(node, "id").filter(|a| a.non_empty_value().is_some()) {
            let v = id.value.as_ref().unwrap();
            let decoded = decode(v);
            if let std::collections::hash_map::Entry::Vacant(ledig) = ids.entry(decoded) {
                ledig.insert(n);
            } else {
                out.push(findings(
                    "duplikat-id",
                    id.value_start,
                    id.value_start + v.len(),
                    Severity::Error,
                    LINK,
                    format!(
                        "id=\"{}\" står mer enn én gang på siden. for og aria-describedby peker da på det første elementet, og koblingen til dette er brutt. Hver id må være unik.",
                        lossy(v)
                    ),
                ));
            }
        }
        if node.name == "label" {
            if let Some(target) = non_empty(node, "for") {
                label_for.insert(decode(target));
            }
        }
        if let Some(v) = value(node, "aria-describedby").and_then(|a| a.value.as_deref()) {
            for (_, part) in words(&decode(v)) {
                described_by.insert(part.to_vec());
            }
        }
    }

    for (n, node) in nodes.iter().enumerate() {
        for (name, loses) in REFERENCES {
            let Some(a) = value(node, name).filter(|a| a.non_empty_value().is_some()) else {
                continue;
            };
            let v = a.value.as_ref().unwrap();
            for (offset, target) in words(v) {
                let at = a.value_start + offset;
                match ids.get(&decode(target)) {
                    None => out.push(findings(
                    "id-finnes-ikke",
                        at,
                        at + target.len(),
                        Severity::Error,
                        LINK,
                        format!(
                            "{name}=\"{}\" peker på id-en «{}», som ikke finnes på siden. Skjermleseren mister {loses}. {}",
                            lossy(v),
                            lossy(target),
                            if *name == "aria-controls" { "" } else { HOW }
                        ),
                    )),
                    Some(&found) => {
                        let f = &nodes[found].name;
                        if *name == "for" && node.name == "label" && !LABELABLE.contains(&f.as_str()) && !f.contains('-') {
                            out.push(findings(
                    "for-peker-feil",
                                at,
                                at + target.len(),
                                Severity::Error,
                                LINK,
                                format!(
                                    "for=\"{}\" peker på et <{f}>, som ikke kan ha en ledetekst. for må peke på feltet selv: <input>, <select>, <textarea> eller en knapp. {HOW}",
                                    lossy(v)
                                ),
                            ));
                        }
                    }
                }
            }
        }

        if node.name == "a"
            && within(&nodes, n, |m| {
                m.name == "fs-error-summary" || has_class(m, |c| equals(c, "fs-error-summary"))
            })
        {
            if let Some(href) = value(node, "href") {
                let v = href.value.as_deref().unwrap_or(&[]);
                let target = if starts_at(v, 0, "#") {
                    &v[1..]
                } else {
                    &[][..]
                };
                if !target.is_empty() && !ids.contains_key(&fragment(target)) {
                    out.push(findings(
                    "oppsummering-peker-feil",
                        href.value_start + 1,
                        href.value_start + target.len() + 1,
                        Severity::Error,
                        SUMMARY_LINK,
                        format!(
                            "Lenken i feiloppsummeringen går til «#{}», som ikke finnes på siden. Den skal gå til feltet som feilet, slik at brukeren havner der feilen kan rettes.",
                            lossy(target)
                        ),
                    ));
                }
            }
        }

        if within(&nodes, n, |m| m.name == "fs-field") {
            continue;
        }

        let type_ = value(node, "type")
            .and_then(|a| a.value.as_deref())
            .map(lowercase)
            .unwrap_or_default();
        if matches!(node.name.as_str(), "input" | "textarea" | "select")
            && has_class(node, |c| starts_at(c, 0, "fs-"))
            && !UNLABELLED_TYPES.iter().any(|t| equals(&type_, t))
        {
            let named = within(&nodes, n, |m| {
                m.name == "fs-suggestion" || m.name == "label"
            }) || non_empty(node, "id")
                .is_some_and(|id| label_for.contains(&decode(id)))
                || value(node, "aria-label").is_some()
                || value(node, "aria-labelledby").is_some();
            if !named {
                out.push(findings(
                    "kontroll-uten-ledetekst",
                    node.name_start,
                    node.name_end,
                    Severity::Warning,
                    LINK,
                    format!(
                        "<{}> har ingen ledetekst: ingen <label for> som peker på det, ingen <label> rundt, og verken aria-label eller aria-labelledby. En skjermleser leser feltet opp uten navn. {HOW}",
                        node.name
                    ),
                ));
            }
        }

        let kind = if has_class(node, |c| equals(c, "fs-error-text")) {
            Some("Feilmeldingen")
        } else if has_class(node, |c| equals(c, "fs-help-text")) {
            Some("Hjelpeteksten")
        } else {
            None
        };
        let role = value(node, "role")
            .and_then(|a| a.value.as_deref())
            .unwrap_or(&[]);
        let live =
            equals(role, "status") || equals(role, "alert") || value(node, "aria-live").is_some();
        if let Some(kind) = kind {
            if !live && !is_hidden(&nodes, n) {
                let id = non_empty(node, "id");
                if id.is_none_or(|id| !described_by.contains(&decode(id))) {
                    let middle = match id {
                        Some(id) => format!(
                            "id-en «{}» står ikke i aria-describedby på noe felt. ",
                            lossy(id)
                        ),
                        None => {
                            "den har ingen id, så ingen aria-describedby kan peke på den. ".into()
                        }
                    };
                    out.push(findings(
                    "tekst-ikke-koblet",
                        node.name_start,
                        node.name_end,
                        Severity::Warning,
                        LINK,
                        format!("{kind} er ikke koblet til noe felt: {middle}En skjermleser leser den ikke opp sammen med feltet. {HOW}"),
                    ));
                }
            }
        }
    }

    out.sort_by_key(|f| f.start);
    out
}

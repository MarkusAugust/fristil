//! Ordforrådet: elementer, attributter, klasser og values.
//!
//! En oversettelse av `designsystem/src/diagnostics/diagnostics.ts`, funksjon
//! for funksjon og med de samme meldingene. Kommentarene der forklarer
//! hvorfor reglene er som de er; her står bare det som er annerledes i Rust.
//! Hvert regulært uttrykk er skrevet ut som en løkke, med det samme svaret.

use std::collections::HashMap;

use crate::text::*;
use crate::types::*;

pub const DOCS: &str = "https://fristil.sobernetics.no/components/";

const GLOBAL: &[&str] = &[
    "accesskey",
    "autocapitalize",
    "autofocus",
    "class",
    "contenteditable",
    "dir",
    "draggable",
    "enterkeyhint",
    "exportparts",
    "hidden",
    "id",
    "inert",
    "inputmode",
    "is",
    "itemid",
    "itemprop",
    "itemref",
    "itemscope",
    "itemtype",
    "lang",
    "nonce",
    "part",
    "popover",
    "role",
    "slot",
    "spellcheck",
    "style",
    "tabindex",
    "title",
    "translate",
    "xmlns",
];

fn is_global(name: &[u16]) -> bool {
    GLOBAL.iter().any(|g| equals(name, g))
        || equals(name, "_")
        || ["data-", "aria-", "on", "hx-", "x-", "v-", "i18n"]
            .iter()
            .any(|p| starts_at(name, 0, p))
        || name
            .iter()
            .any(|&c| c < 0x80 && b":@*[](){}%$#?".contains(&(c as u8)))
}

/// `/\{\{|\{%|\{#|<\?|<%|\$\{|@\(/`: Go, Jinja, PHP, ASP, JS-maler og Razor.
pub fn is_templated(t: &[u16]) -> bool {
    ["{{", "{%", "{#", "<?", "<%", "${", "@("]
        .iter()
        .any(|m| contains_str(t, m))
}

/// En verdi i klammer er Astro eller Svelte, og et uttrykk: `/^\s*[@{]/`.
pub fn is_templated_value(t: &[u16]) -> bool {
    is_templated(t)
        || t.iter()
            .find(|&&c| !is_space(c))
            .is_some_and(|&c| c == b'@' as u16 || c == b'{' as u16)
}

/// Razor i innholdet, utenfor taggene.
fn is_templated_content(t: &[u16]) -> bool {
    if is_templated(t) {
        return true;
    }
    // `text.replace(/<[^>]*>/g, " ")`
    let mut stripped = Vec::with_capacity(t.len());
    let mut i = 0;
    while i < t.len() {
        if t[i] == LT {
            if let Some(gt) = find_unit(t, i + 1, GT) {
                stripped.push(b' ' as u16);
                i = gt + 1;
                continue;
            }
        }
        stripped.push(t[i]);
        i += 1;
    }
    // `/(^|\s)@[A-Za-z]/`
    (0..stripped.len()).any(|i| {
        stripped[i] == b'@' as u16
            && (i == 0 || is_space(stripped[i - 1]))
            && i + 1 < stripped.len()
            && is_ascii_letter(stripped[i + 1])
    })
}

/// Navnet stripped bindestreker og store bokstaver, for å kjenne igjen skrivefeil.
fn normalized(t: &[u16]) -> Utf16 {
    lowercase(t)
        .into_iter()
        .filter(|&c| c != b'-' as u16 && c != b'_' as u16)
        .collect()
}

/// Redigeringsavstanden, med ombytte av to nabotegn som én.
fn distance(a: &[u16], b: &[u16]) -> usize {
    let mut before: Vec<usize> = vec![0; b.len() + 1];
    let mut previous: Vec<usize> = (0..=b.len()).collect();
    for i in 1..=a.len() {
        let mut current = vec![i; b.len() + 1];
        for j in 1..=b.len() {
            let mut d = (previous[j] + 1)
                .min(current[j - 1] + 1)
                .min(previous[j - 1] + usize::from(a[i - 1] != b[j - 1]));
            if i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1] {
                d = d.min(before[j - 2] + 1);
            }
            current[j] = d;
        }
        before = previous;
        previous = current;
    }
    previous[b.len()]
}

fn common_prefix(a: &[u16], b: &[u16]) -> usize {
    a.iter().zip(b).take_while(|(x, y)| x == y).count()
}

pub type Cache = HashMap<Utf16, Option<(String, bool)>>;

/// Det nærmeste kjente navnet, når det er nært nok til å være en skrivefeil.
pub fn closest(
    name: &[u16],
    candidates: &[&str],
    cache: Option<&mut Cache>,
) -> Option<(String, bool)> {
    if let Some(h) = &cache {
        if let Some(respond) = h.get(name) {
            return respond.clone();
        }
    }
    let respond = find_closest(name, candidates);
    if let Some(h) = cache {
        h.insert(name.to_vec(), respond.clone());
    }
    respond
}

fn find_closest(name: &[u16], candidates: &[&str]) -> Option<(String, bool)> {
    let wanted = normalized(name);
    if let Some(same) = candidates.iter().find(|k| normalized(&utf16(k)) == wanted) {
        return Some((same.to_string(), true));
    }
    let lower = lowercase(name);
    let max = if name.len() >= 8 { 2 } else { 1 };
    let mut best: Option<(&str, Utf16)> = None;
    let mut best_distance = max + 1;
    for &candidate in candidates {
        let k = utf16(candidate);
        if k.len().abs_diff(lower.len()) > max {
            continue;
        }
        let d = distance(&lower, &k);
        let better = d < best_distance
            || (d == best_distance
                && best
                    .as_ref()
                    .is_some_and(|(_, b)| common_prefix(&lower, &k) > common_prefix(&lower, b)));
        if better {
            best_distance = d;
            best = Some((candidate, k));
        }
    }
    best.map(|(name, _)| (name.to_string(), false))
}

/// `[\s\S]*?` til det første treffet av `slutt`, eller til slutten av teksten.
fn blank_range(out: &mut [u16], from: usize, to: usize) {
    blank(&mut out[from..to]);
}

/// `<script\b` og `<style\b`: navnet stripped hensyn til store bokstaver, og
/// ikke et ordtegn etter.
fn opens(t: &[u16], i: usize, name: &str) -> bool {
    starts_at(t, i, "<")
        && starts_at_ci(t, i + 1, name)
        && t.get(i + 1 + name.len()).is_none_or(|&c| !is_word(c))
}

/// Den første `</navn\s*>` fra `fra`, med indeksen der den slutter.
fn closer(t: &[u16], from: usize, name: &str) -> Option<(usize, usize)> {
    let mut i = from;
    while i < t.len() {
        if t[i] == LT && starts_at(t, i + 1, "/") && starts_at_ci(t, i + 2, name) {
            let mut j = i + 2 + name.len();
            while j < t.len() && is_space(t[j]) {
                j += 1;
            }
            if j < t.len() && t[j] == GT {
                return Some((i, j + 1));
            }
        }
        i += 1;
    }
    None
}

/// Teksten stripped kommentarer, skript og stilark, med samme lengde.
pub fn without_hidden(text: &[u16]) -> Utf16 {
    let mut out = text.to_vec();
    // Kommentarene først, så skriptene og stilarkene i det som er igjen, som
    // de tre `replace`-kallene i TypeScript.
    let mut i = 0;
    while let Some(start) = find_at(&out, i, "<!--") {
        let end = find_at(&out, start + 4, "-->").map_or(out.len(), |e| e + 3);
        blank_range(&mut out, start, end);
        i = end.max(start + 1);
    }
    for name in ["script", "style"] {
        let mut i = 0;
        while i < out.len() {
            if opens(&out, i, name) {
                let end = closer(&out, i + 1 + name.len(), name).map_or(out.len(), |(_, e)| e);
                blank_range(&mut out, i, end);
                i = end.max(i + 1);
            } else {
                i += 1;
            }
        }
    }
    out
}

/// Der taggen som begynner på `fra` slutter: indeksen til `>`.
pub fn tag_end(t: &[u16], from: usize) -> Option<usize> {
    let mut quote: Option<u16> = None;
    let mut i = from;
    while i < t.len() {
        let c = t[i];
        if let Some(q) = quote {
            if c == q {
                quote = None;
            }
            i += 1;
            continue;
        }
        if c == DOUBLE_QUOTE || c == SINGLE_QUOTE {
            quote = Some(c);
        } else if c == LT && (starts_at(t, i + 1, "?") || starts_at(t, i + 1, "%")) {
            let close = [t[i + 1], GT];
            let found = (i + 2..t.len().saturating_sub(1)).find(|&k| t[k..k + 2] == close)?;
            i = found + 1;
        } else if c == GT {
            return Some(i);
        }
        i += 1;
    }
    None
}

#[derive(Clone, Debug)]
pub struct ReadAttribute {
    pub name: Utf16,
    pub value: Option<Utf16>,
    pub start: usize,
    /// Der navnet slutter.
    pub end: usize,
    /// Der hele attributtet slutter, med verdi og anførselstegn.
    pub value_end: usize,
    /// Der mellomrommet foran attributtet begynner.
    pub space_start: usize,
    /// Der selve verdien står, stripped anførselstegn.
    pub value_start: usize,
}

impl ReadAttribute {
    pub fn non_empty_value(&self) -> Option<&Utf16> {
        self.value.as_ref().filter(|v| !v.is_empty())
    }
}

/// Attributtene i en tagg, lest fra teksten mellom navnet og `>`.
pub fn read_attributes(body: &[u16], offset: usize) -> Vec<ReadAttribute> {
    let mut out = Vec::new();
    let mut i = 0;
    let skip_space = |i: &mut usize| {
        while *i < body.len() && is_space(body[*i]) {
            *i += 1;
        }
    };
    while i < body.len() {
        let space_start = i;
        skip_space(&mut i);
        let name_start = i;
        while i < body.len()
            && !is_space(body[i])
            && !matches!(
                body[i],
                DOUBLE_QUOTE | SINGLE_QUOTE | EQUALS | LT | GT | SLASH
            )
        {
            i += 1;
        }
        if i == name_start {
            i += 1;
            continue;
        }
        let name = &body[name_start..i];
        let mut value: Option<Utf16> = None;
        let mut value_start = i;
        let after_name = i;
        skip_space(&mut i);
        if i < body.len() && body[i] == EQUALS {
            i += 1;
            skip_space(&mut i);
            let open = body.get(i).copied();
            if open == Some(DOUBLE_QUOTE) || open == Some(SINGLE_QUOTE) {
                let close = find_unit(body, i + 1, open.unwrap());
                value_start = i + 1;
                let to = close.unwrap_or(body.len());
                value = Some(body[value_start.min(to)..to].to_vec());
                i = close.map_or(body.len(), |l| l + 1);
            } else if open == Some(b'{' as u16) {
                value_start = i;
                i = braces_end(body, i);
                value = Some(body[value_start..i].to_vec());
            } else {
                value_start = i;
                while i < body.len()
                    && !is_space(body[i])
                    && !matches!(
                        body[i],
                        DOUBLE_QUOTE | SINGLE_QUOTE | EQUALS | LT | GT | BACKTICK
                    )
                {
                    i += 1;
                }
                value = Some(body[value_start..i].to_vec());
            }
        } else {
            i = after_name;
        }
        let has_value = value.is_some();
        out.push(ReadAttribute {
            name: lowercase(name),
            value,
            start: offset + name_start,
            end: offset + name_start + name.len(),
            value_end: offset + if has_value { i } else { after_name },
            space_start: offset + space_start,
            value_start: offset + if has_value { value_start } else { after_name },
        });
    }
    out
}

fn braces_end(t: &[u16], from: usize) -> usize {
    let mut depth = 0i32;
    let mut quote: Option<u16> = None;
    for (i, &c) in t.iter().enumerate().skip(from) {
        if let Some(q) = quote {
            if c == q {
                quote = None;
            }
            continue;
        }
        if c == DOUBLE_QUOTE || c == SINGLE_QUOTE || c == BACKTICK {
            quote = Some(c);
        } else if c == b'{' as u16 {
            depth += 1;
        } else if c == b'}' as u16 {
            depth -= 1;
            if depth == 0 {
                return i + 1;
            }
        }
    }
    t.len()
}

fn list<'a>(names: impl IntoIterator<Item = &'a str>) -> String {
    names.into_iter().collect::<Vec<_>>().join(", ")
}

/// `Number(verdi)` i JavaScript, og tomt er ikke et tall.
fn is_number(value: &[u16]) -> bool {
    let t = trimmed(value);
    if t.is_empty() || t.iter().any(|&c| c >= 0x80) {
        return false;
    }
    let s: String = t.iter().map(|&c| c as u8 as char).collect();
    let b = s.as_bytes();
    // Heksadesimalt, oktalt og binært, stripped fortegn.
    if b.len() > 2 && b[0] == b'0' {
        let siffer = &s[2..];
        let valid = match b[1] {
            b'x' | b'X' => siffer.bytes().all(|c| c.is_ascii_hexdigit()),
            b'o' | b'O' => siffer.bytes().all(|c| (b'0'..=b'7').contains(&c)),
            b'b' | b'B' => siffer.bytes().all(|c| c == b'0' || c == b'1'),
            _ => return is_decimal(&s),
        };
        return valid;
    }
    is_decimal(&s)
}

/// StrDecimalLiteral: fortegn, `Infinity`, sifre med punktum og eksponent.
fn is_decimal(s: &str) -> bool {
    let s = s.strip_prefix(['+', '-']).unwrap_or(s);
    if s == "Infinity" {
        return true;
    }
    let (mantissa, exponent) = match s.find(['e', 'E']) {
        Some(i) => (&s[..i], Some(&s[i + 1..])),
        None => (s, None),
    };
    let (integer, fraction) = match mantissa.find('.') {
        Some(i) => (&mantissa[..i], &mantissa[i + 1..]),
        None => (mantissa, ""),
    };
    let digits = |x: &str| x.bytes().all(|c| c.is_ascii_digit());
    if !digits(integer) || !digits(fraction) || (integer.is_empty() && fraction.is_empty()) {
        return false;
    }
    match exponent {
        None => true,
        Some(e) => {
            let e = e.strip_prefix(['+', '-']).unwrap_or(e);
            !e.is_empty() && digits(e)
        }
    }
}

fn find_attribute<'a>(element: &'a Element, name: &[u16]) -> Option<&'a Attribute> {
    element
        .attributes
        .iter()
        .find(|(n, _)| equals(name, n))
        .map(|(_, a)| a)
}

fn check_attribute(
    tag: &str,
    element: &Element,
    a: &ReadAttribute,
    templated_tag: bool,
) -> Option<Finding> {
    let name = lossy(&a.name);
    let findings = |rule, severity, message: String, fix| Finding {
        start: a.start,
        end: a.end,
        severity,
        link: element.link.clone(),
        message,
        fix,
        rule,
    };
    let Some(known) = find_attribute(element, &a.name) else {
        let norm = normalized(&a.name);
        if let Some((meant, _)) = element
            .attributes
            .iter()
            .find(|(k, _)| normalized(&utf16(k)) == norm)
        {
            return Some(findings(
                "ukjent-attributt",
                Severity::Warning,
                format!("<{tag}> har ikke attributtet «{name}». Mente du {meant}?"),
                Some(Fix {
                    title: format!("Bytt til {meant}"),
                    start: a.start,
                    end: a.end,
                    text: meant.clone(),
                    preferred: true,
                }),
            ));
        }
        if templated_tag || is_global(&a.name) {
            return None;
        }
        return Some(findings(
            "ukjent-attributt",
            Severity::Warning,
            format!(
                "<{tag}> har ikke attributtet «{name}», og komponenten leser det ikke. Attributtene er {}.",
                list(element.attributes.iter().map(|(n, _)| n.as_str()))
            ),
            None,
        ));
    };
    if a.value.as_deref().is_some_and(is_templated_value) {
        return None;
    }
    match known {
        Attribute::Flag => {
            let value = a.value.as_deref()?;
            if name == "hidden" && equals(value, "until-found") {
                return None;
            }
            if !value.is_empty() && lowercase(value) != a.name {
                let v = lossy(value);
                return Some(findings(
                    "boolsk-med-verdi",
                    Severity::Warning,
                    format!(
                        "{name} er et boolsk attributt: det står der eller ikke. {name}=\"{v}\" betyr det samme som {name}. Ta det bort for å slå det av."
                    ),
                    Some(Fix {
                        title: format!("Ta bort {name}"),
                        start: a.space_start,
                        end: a.value_end,
                        text: String::new(),
                        preferred: true,
                    }),
                ));
            }
            None
        }
        Attribute::Values(values) => {
            let valid = a
                .value
                .as_deref()
                .is_some_and(|v| values.iter().any(|k| equals(v, k)));
            if valid {
                return None;
            }
            let v = a.value.as_deref().map(lossy).unwrap_or_default();
            Some(findings(
                "ugyldig-verdi",
                Severity::Error,
                format!(
                    "{name} kan ikke være «{v}». Lovlige verdier: {}.",
                    list(values.iter().map(String::as_str))
                ),
                None,
            ))
        }
        Attribute::Number => match a.value.as_deref() {
            Some(v) if !is_number(v) => Some(findings(
                "ikke-tall",
                Severity::Error,
                format!("{name} skal være et tall, ikke «{}».", lossy(v)),
                None,
            )),
            _ => None,
        },
        Attribute::Text => None,
    }
}

/// `/<(input|textarea|select)(?=[\s/>])/gi`, og den første kontrollen som
/// ikke er `type="hidden"`.
fn find_control(content: &[u16]) -> Option<Vec<ReadAttribute>> {
    let mut i = 0;
    while i < content.len() {
        if content[i] != LT {
            i += 1;
            continue;
        }
        let hit = ["input", "textarea", "select"].into_iter().find(|name| {
            starts_at_ci(content, i + 1, name) && followed_by_end(content, i + 1 + name.len())
        });
        let Some(name) = hit else {
            i += 1;
            continue;
        };
        let from = i + 1 + name.len();
        i = from;
        let Some(to) = tag_end(content, from) else {
            continue;
        };
        let attributes = read_attributes(&content[from..to], 0);
        let type_ = attributes
            .iter()
            .find(|a| equals(&a.name, "type"))
            .and_then(|a| a.value.as_deref());
        if name == "input" && type_.is_some_and(|t| lowercase(t) == utf16("hidden")) {
            continue;
        }
        return Some(attributes);
    }
    None
}

/// `(?=[\s/>])`
pub fn followed_by_end(t: &[u16], i: usize) -> bool {
    t.get(i)
        .is_some_and(|&c| is_space(c) || c == SLASH || c == GT)
}

/// Verdiene i hver `<label for>` i dokumentet, som
/// `/<label\b[^>]*?\sfor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi`.
fn label_targets(t: &[u16]) -> Vec<Utf16> {
    let mut out = Vec::new();
    let mut i = 0;
    'outer: while i < t.len() {
        let starts_label = t[i] == LT
            && starts_at_ci(t, i + 1, "label")
            && t.get(i + 6).is_none_or(|&c| !is_word(c));
        if !starts_label {
            i += 1;
            continue;
        }
        let mut p = i + 6;
        loop {
            if let Some((value, end)) = for_at(t, p) {
                out.push(value);
                i = end;
                continue 'outer;
            }
            if p >= t.len() || t[p] == GT {
                break;
            }
            p += 1;
        }
        i += 1;
    }
    out
}

/// `\sfor\s*=\s*(verdi)` ved `p`: verdien og der treffet slutter.
fn for_at(t: &[u16], p: usize) -> Option<(Utf16, usize)> {
    if !t.get(p).is_some_and(|&c| is_space(c)) || !starts_at_ci(t, p + 1, "for") {
        return None;
    }
    let mut j = p + 4;
    while j < t.len() && is_space(t[j]) {
        j += 1;
    }
    if t.get(j) != Some(&EQUALS) {
        return None;
    }
    j += 1;
    while j < t.len() && is_space(t[j]) {
        j += 1;
    }
    let c = *t.get(j)?;
    if c == DOUBLE_QUOTE || c == SINGLE_QUOTE {
        if let Some(close) = find_unit(t, j + 1, c) {
            return Some((t[j + 1..close].to_vec(), close + 1));
        }
        return None;
    }
    let from = j;
    while j < t.len()
        && !is_space(t[j])
        && !matches!(
            t[j],
            DOUBLE_QUOTE | SINGLE_QUOTE | EQUALS | LT | GT | BACKTICK
        )
    {
        j += 1;
    }
    (j > from).then(|| (t[from..j].to_vec(), j))
}

/// `/<navn(?=[\s/>])/i`
fn has_tag(t: &[u16], name: &str) -> bool {
    (0..t.len()).any(|i| {
        t[i] == LT && starts_at_ci(t, i + 1, name) && followed_by_end(t, i + 1 + name.len())
    })
}

#[allow(clippy::too_many_arguments)]
fn check_field(
    labels: &[Utf16],
    tag: &str,
    name_start: usize,
    name_end: usize,
    content: &[u16],
    content_start: usize,
    attributes: &[ReadAttribute],
    link: &str,
) -> Vec<Finding> {
    let has_element = (0..content.len())
        .any(|i| content[i] == LT && content.get(i + 1).is_some_and(|&c| is_ascii_letter(c)));
    if !has_element || is_templated_content(content) {
        return vec![];
    }
    let findings = |rule, message: String, fix| Finding {
        start: name_start,
        end: name_end,
        severity: Severity::Warning,
        link: link.to_string(),
        message,
        fix,
        rule,
    };
    let indent = content.iter().take_while(|&&c| is_space(c)).count();
    let Some(control) = find_control(content) else {
        return vec![findings(
            "felt-uten-kontroll",
            format!(
                "<{tag}> fant ingen kontroll å koble til. Ledeteksten, hjelpeteksten og feilmeldingen står uten et felt, og koblingen kan ikke lages. Sett inn et <input>, <textarea> eller <select>."
            ),
            None,
        )];
    };
    if has_tag(content, "label") {
        return vec![];
    }
    let has = |name: &str| control.iter().find(|a| equals(&a.name, name));
    if has("aria-label").is_some() || has("aria-labelledby").is_some() {
        return vec![];
    }
    let ids = [
        attributes
            .iter()
            .find(|a| equals(&a.name, "control-id"))
            .and_then(|a| a.value.clone()),
        has("id").and_then(|a| a.value.clone()),
    ];
    if ids
        .iter()
        .flatten()
        .any(|id| !id.is_empty() && labels.contains(id))
    {
        return vec![];
    }
    let leading = &content[..indent];
    let newline = leading.contains(&(b'\n' as u16));
    vec![findings(
        "felt-uten-ledetekst",
        format!(
            "<{tag}> fant ingen <label>. Feltet får da ingen ledetekst, og en skjermleser leser det opp uten navn."
        ),
        Some(Fix {
            title: "Sett inn en ledetekst".into(),
            start: content_start + indent,
            end: content_start + indent,
            text: format!("<label>Ledetekst</label>{}", if newline { lossy(leading) } else { String::new() }),
            preferred: true,
        }),
    )]
}

fn check_session_timeout(
    tag: &str,
    name_start: usize,
    name_end: usize,
    content: &[u16],
    link: &str,
) -> Vec<Finding> {
    if is_templated_content(content) || has_tag(content, "dialog") {
        return vec![];
    }
    vec![Finding {
        start: name_start,
        end: name_end,
        severity: Severity::Warning,
        link: link.to_string(),
        message: format!(
            "<{tag}> fant ingen <dialog>. Varselet kan ikke vises, og økten går ut uten advarsel."
        ),
        fix: None,
        rule: "tidsavbrudd-uten-dialog",
    }]
}

fn find_class<'a>(vocabulary: &'a Vocabulary, name: &[u16]) -> Option<&'a Class> {
    vocabulary.classes.iter().find(|k| equals(name, &k.name))
}

fn check_classes(
    vocabulary: &Vocabulary,
    attributes: &[ReadAttribute],
    cache: &mut Cache,
) -> Vec<Finding> {
    let mut findings = Vec::new();
    let Some(class_attribute) = attributes.iter().find(|a| equals(&a.name, "class")) else {
        return findings;
    };
    let Some(value) = class_attribute.non_empty_value() else {
        return findings;
    };
    if is_templated_value(value) {
        return findings;
    }
    let name: Vec<&str> = vocabulary.classes.iter().map(|k| k.name.as_str()).collect();
    let mut present: Vec<&Class> = Vec::new();
    for (offset, token) in words(value) {
        let start = class_attribute.value_start + offset;
        if !starts_at(token, 0, "fs-")
            || token.iter().any(|&c| c == b'{' as u16 || c == b'}' as u16)
        {
            continue;
        }
        if let Some(info) = find_class(vocabulary, token) {
            present.push(info);
            continue;
        }
        let meant = closest(token, &name, Some(cache));
        let t = lossy(token);
        findings.push(Finding {
            start,
            end: start + token.len(),
            severity: Severity::Warning,
            link: meant.as_ref().map_or(DOCS.to_string(), |(m, _)| {
                find_class(vocabulary, &utf16(m)).unwrap().link.clone()
            }),
            message: match &meant {
                Some((m, _)) => format!("Klassen «{t}» finnes ikke i Fristil. Mente du {m}?"),
                None => format!("Klassen «{t}» finnes ikke i Fristil."),
            },
            fix: meant.map(|(m, sure)| Fix {
                title: format!("Bytt til {m}"),
                start,
                end: start + token.len(),
                text: m,
                preferred: sure,
            }),
            rule: "ukjent-klasse",
        });
    }
    for a in attributes {
        let Some(value) = a.non_empty_value() else {
            continue;
        };
        if is_templated_value(value) {
            continue;
        }
        for info in &present {
            let Some((_, takes)) = info.attributes.iter().find(|(n, _)| equals(&a.name, n)) else {
                continue;
            };
            if takes.values.iter().any(|v| equals(value, v))
                || takes
                    .default_value
                    .as_deref()
                    .is_some_and(|d| equals(value, d))
            {
                continue;
            }
            let mut candidates: Vec<&str> = takes.values.iter().map(String::as_str).collect();
            candidates.extend(takes.default_value.as_deref());
            let meant = closest(value, &candidates, None);
            let shown = collapse_spaces(value);
            let name = lossy(&a.name);
            let end = match takes.default_value.as_deref() {
                Some(d) => format!(", og {d} uten attributt."),
                None => ".".into(),
            };
            findings.push(Finding {
                start: a.start,
                end: a.value_end,
                severity: Severity::Warning,
                link: info.link.clone(),
                message: format!(
                    "{name} kan ikke være «{shown}» på {}. Lovlige verdier: {}{end}",
                    lossy(&lowercase(&utf16(&info.title))),
                    list(takes.values.iter().map(String::as_str))
                ),
                fix: meant.map(|(m, sure)| Fix {
                    title: format!("Bytt til {m}"),
                    start: a.value_start,
                    end: a.value_start + value.len(),
                    text: m,
                    preferred: sure,
                }),
                rule: "ugyldig-klasseverdi",
            });
            break;
        }
    }
    findings
}

/// `value.replace(/\s+/g, " ")`
fn collapse_spaces(t: &[u16]) -> String {
    let mut out = Vec::with_capacity(t.len());
    let mut i = 0;
    while i < t.len() {
        if is_space(t[i]) {
            while i < t.len() && is_space(t[i]) {
                i += 1;
            }
            out.push(b' ' as u16);
        } else {
            out.push(t[i]);
            i += 1;
        }
    }
    lossy(&out)
}

/// `/<([a-z][a-z0-9-]*)(?=[\s/>])/gi` ved `i`: der navnet slutter.
pub fn tag_name_end(t: &[u16], i: usize) -> Option<usize> {
    if t.get(i) != Some(&LT) || !t.get(i + 1).is_some_and(|&c| is_ascii_letter(c)) {
        return None;
    }
    let mut j = i + 2;
    while j < t.len() && is_name_char(t[j]) {
        j += 1;
    }
    followed_by_end(t, j).then_some(j)
}

/// Kroppen til en tagg, stripped én `/` til slutt.
fn tag_body(t: &[u16], from: usize, to: usize) -> &[u16] {
    let b = &t[from..to];
    b.strip_suffix(&[SLASH]).unwrap_or(b)
}

/// `/\bclass\s*=/i`
fn has_class_attribute(b: &[u16]) -> bool {
    (0..b.len()).any(|i| {
        starts_at_ci(b, i, "class") && (i == 0 || !is_word(b[i - 1])) && {
            let mut j = i + 5;
            while j < b.len() && is_space(b[j]) {
                j += 1;
            }
            b.get(j) == Some(&EQUALS)
        }
    })
}

/// `/<\/navn\b/gi` fra `fra`.
fn closing_tag(t: &[u16], from: usize, name: &str) -> Option<usize> {
    (from..t.len()).find(|&i| {
        t[i] == LT
            && starts_at(t, i + 1, "/")
            && starts_at_ci(t, i + 2, name)
            && t.get(i + 2 + name.len()).is_none_or(|&c| !is_word(c))
    })
}

/// Alle funn i teksten, i den rekkefølgen de står.
pub fn diagnose(text: &[u16], vocabulary: &Vocabulary) -> Vec<Finding> {
    let source = without_hidden(text);
    let mut findings = Vec::new();
    let mut labels: Option<Vec<Utf16>> = None;
    let mut cache = Cache::new();

    // Klassene, på alle tagger.
    let mut i = 0;
    while i < source.len() {
        let Some(name_end) = tag_name_end(&source, i) else {
            i += 1;
            continue;
        };
        i = name_end;
        let Some(end) = tag_end(&source, name_end) else {
            continue;
        };
        let b = tag_body(&source, name_end, end);
        if !has_class_attribute(b) {
            continue;
        }
        findings.extend(check_classes(
            vocabulary,
            &read_attributes(b, name_end),
            &mut cache,
        ));
    }

    let mut i = 0;
    while i < source.len() {
        let is_fs = source[i] == LT && starts_at_ci(&source, i + 1, "fs-");
        if !is_fs {
            i += 1;
            continue;
        }
        let mut j = i + 4;
        while j < source.len() && is_name_char(source[j]) {
            j += 1;
        }
        if !followed_by_end(&source, j) {
            i += 1;
            continue;
        }
        let name_start = i + 1;
        let name_end = j;
        i = j;
        let tag = lossy(&lowercase(&source[name_start..name_end]));
        let Some(element) = vocabulary.elements.iter().find(|e| e.tag == tag) else {
            findings.push(Finding {
                start: name_start,
                end: name_end,
                severity: Severity::Error,
                link: DOCS.into(),
                message: format!(
                    "<{tag}> finnes ikke i Fristil. Elementene er {}.",
                    list(vocabulary.elements.iter().map(|e| e.tag.as_str()))
                ),
                fix: None,
                rule: "ukjent-element",
            });
            continue;
        };
        let Some(end) = tag_end(&source, name_end) else {
            continue;
        };
        let b = tag_body(&source, name_end, end);
        let templated_tag = is_templated(b);
        let attributes = read_attributes(b, name_end);
        for a in &attributes {
            findings.extend(check_attribute(&tag, element, a, templated_tag));
        }

        if tag == "fs-session-timeout" {
            if let Some(close) = closing_tag(&source, end, "fs-session-timeout") {
                findings.extend(check_session_timeout(
                    &tag,
                    name_start,
                    name_end,
                    &source[end + 1..close.max(end + 1)],
                    &element.link,
                ));
            }
        }

        if tag == "fs-field" {
            let close = closing_tag(&source, end, "fs-field").unwrap_or(source.len());
            let content = &source[(end + 1).min(close.max(end + 1))..close.max(end + 1)];
            let labels = labels.get_or_insert_with(|| label_targets(&source));
            findings.extend(check_field(
                labels,
                &tag,
                name_start,
                name_end,
                content,
                end + 1,
                &attributes,
                &element.link,
            ));
        }
    }
    findings.sort_by_key(|f| f.start);
    findings
}

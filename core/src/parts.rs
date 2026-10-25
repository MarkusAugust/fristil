//! `del-flere-ganger`: en del med `unique` som står mer enn én gang.
//!
//! Regelen er drevet av `parts` i manifestet, både for elementene og for
//! klassene, så en ny del i `metadata.ts` sjekkes uten en linje her. Den
//! melder bare delene med `unique`: der en del til av samme slag er en feil,
//! som et `<fs-field>` med to kontroller, der bare den første blir koblet.
//! En del uten `unique` kan stå flere ganger og være vanlig innhold.
//! `<fs-popover>` finner knappen med `aria-controls` mot panelet, ellers den
//! første utenfor panelet, og knappene i panelet er menyens. Hver komponents egen
//! regel for hvilken som er den riktige, står i komponenten og ikke her.
//!
//! Et treff hører til den nærmeste verten: et felt inni et felt er det indre
//! feltets, som `part.closest(host.localName) === host` i komponentene. Det
//! som står i en `<template>`, er ikke i dokumentet og teller ikke. Står det
//! malsyntaks i verten, sier regelen ingenting: en løkke, et `if`/`else`, et
//! `v-if` eller et uttrykk i `{…}` kan gi to deler i kilden og én på siden.
//!
//! Selektorene leses av en liten selektorleser med akkurat det manifestet
//! bruker: tagg, klasse, attributt med `=`, `^=` og flagget `i`, `:not()`
//! med en enkel selektor, `:scope`, barn (`>`), etterkommer og komma. En
//! selektor den ikke forstår, hoppes over framfor å gi et funn den ikke kan
//! stå for.

use crate::diagnose::{is_templated_content, tag_end};
use crate::references::{value, Node};
use crate::text::*;
use crate::types::*;

#[derive(Debug, PartialEq)]
enum Test {
    Tag(String),
    Class(String),
    /// Navnet, og verdien med operator og om den sammenlignes uten store bokstaver.
    Attribute(String, Option<(Operator, String, bool)>),
    Not(Vec<Test>),
    Scope,
}

#[derive(Debug, PartialEq, Clone, Copy)]
enum Operator {
    Equals,
    Prefix,
}

#[derive(Debug, PartialEq, Clone, Copy)]
enum Combinator {
    Descendant,
    Child,
}

/// En selektor uten komma: de enkle selektorene fra venstre, og
/// kombinatoren foran hver av dem etter den første.
#[derive(Debug, PartialEq)]
pub(crate) struct Complex {
    compounds: Vec<Vec<Test>>,
    combinators: Vec<Combinator>,
}

fn is_ident(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '-' || c == '_'
}

struct Reader {
    chars: Vec<char>,
    i: usize,
}

impl Reader {
    fn new(text: &str) -> Self {
        Reader {
            chars: text.chars().collect(),
            i: 0,
        }
    }
    fn peek(&self) -> Option<char> {
        self.chars.get(self.i).copied()
    }
    fn eat(&mut self, c: char) -> bool {
        if self.peek() == Some(c) {
            self.i += 1;
            true
        } else {
            false
        }
    }
    fn spaces(&mut self) -> bool {
        let from = self.i;
        while self.peek().is_some_and(char::is_whitespace) {
            self.i += 1;
        }
        self.i > from
    }
    fn ident(&mut self) -> Option<String> {
        let from = self.i;
        while self.peek().is_some_and(is_ident) {
            self.i += 1;
        }
        (self.i > from).then(|| self.chars[from..self.i].iter().collect())
    }
    fn starts(&self, word: &str) -> bool {
        word.chars()
            .enumerate()
            .all(|(k, c)| self.chars.get(self.i + k) == Some(&c))
    }
    fn quoted(&mut self) -> Option<String> {
        let quote = self.peek().filter(|&c| c == '"' || c == '\'')?;
        self.i += 1;
        let from = self.i;
        while self.peek().is_some_and(|c| c != quote) {
            self.i += 1;
        }
        let value: String = self.chars[from..self.i].iter().collect();
        self.eat(quote).then_some(value)
    }

    /// `[navn]`, `[navn='v']`, `[navn^='v']` og `[navn="v" i]`.
    fn attribute(&mut self) -> Option<Test> {
        self.spaces();
        let name = self.ident()?.to_ascii_lowercase();
        self.spaces();
        if self.eat(']') {
            return Some(Test::Attribute(name, None));
        }
        let operator = if self.eat('=') {
            Operator::Equals
        } else if self.eat('^') && self.eat('=') {
            Operator::Prefix
        } else {
            return None;
        };
        self.spaces();
        let wanted = match self.quoted() {
            Some(v) => v,
            None => self.ident()?,
        };
        self.spaces();
        let insensitive = self.eat('i') || self.eat('I');
        self.spaces();
        self.eat(']')
            .then_some(Test::Attribute(name, Some((operator, wanted, insensitive))))
    }

    /// En enkel selektor: alt fram til et mellomrom, `>`, `,` eller `)`.
    fn compound(&mut self) -> Option<Vec<Test>> {
        let mut tests = Vec::new();
        loop {
            match self.peek() {
                Some('.') => {
                    self.i += 1;
                    tests.push(Test::Class(self.ident()?));
                }
                Some('[') => {
                    self.i += 1;
                    tests.push(self.attribute()?);
                }
                Some(':') if self.starts(":scope") => {
                    self.i += ":scope".len();
                    tests.push(Test::Scope);
                }
                Some(':') if self.starts(":not(") => {
                    self.i += ":not(".len();
                    self.spaces();
                    let inner = self.compound()?;
                    self.spaces();
                    if !self.eat(')') || inner.is_empty() {
                        return None;
                    }
                    tests.push(Test::Not(inner));
                }
                Some(c) if is_ident(c) && tests.is_empty() => {
                    tests.push(Test::Tag(self.ident()?.to_ascii_lowercase()));
                }
                _ => break,
            }
        }
        Some(tests)
    }

    fn complex(&mut self) -> Option<Complex> {
        let mut compounds = Vec::new();
        let mut combinators = Vec::new();
        self.spaces();
        // `> li` er relativ til verten, som `:scope > li`.
        if self.eat('>') {
            compounds.push(vec![Test::Scope]);
            combinators.push(Combinator::Child);
            self.spaces();
        }
        loop {
            let compound = self.compound()?;
            if compound.is_empty() {
                return None;
            }
            compounds.push(compound);
            let spaced = self.spaces();
            match self.peek() {
                None | Some(',') => break,
                Some('>') => {
                    self.i += 1;
                    self.spaces();
                    combinators.push(Combinator::Child);
                }
                Some(_) if spaced => combinators.push(Combinator::Descendant),
                Some(_) => return None,
            }
        }
        Some(Complex {
            compounds,
            combinators,
        })
    }
}

/// Selektorlista, eller `None` når den har noe matcheren ikke kjenner.
pub(crate) fn parse(selector: &str) -> Option<Vec<Complex>> {
    let mut reader = Reader::new(selector);
    let mut out = Vec::new();
    loop {
        out.push(reader.complex()?);
        reader.spaces();
        if reader.peek().is_none() {
            return Some(out);
        }
        if !reader.eat(',') {
            return None;
        }
    }
}

fn has_word(node: &Node, attribute: &str, word: &str) -> bool {
    value(node, attribute)
        .and_then(|a| a.value.as_deref())
        .is_some_and(|v| words(v).iter().any(|(_, w)| equals_exact(w, word)))
}

fn equals_exact(t: &[u16], s: &str) -> bool {
    t.iter().copied().eq(s.encode_utf16())
}

fn test(nodes: &[Node], n: usize, host: usize, t: &Test) -> bool {
    let node = &nodes[n];
    match t {
        Test::Tag(name) => node.name == *name,
        Test::Class(name) => has_word(node, "class", name),
        Test::Scope => n == host,
        Test::Not(inner) => !inner.iter().all(|t| test(nodes, n, host, t)),
        Test::Attribute(name, wanted) => {
            let Some(a) = value(node, name) else {
                return false;
            };
            let Some((operator, wanted, insensitive)) = wanted else {
                return true;
            };
            let have = a.value.clone().unwrap_or_default();
            // HTML sammenligner noen verdier uten hensyn til store og små
            // bokstaver, så `type="HIDDEN"` er skjult for nettleseren også.
            let insensitive = *insensitive || name == "type" || name == "method";
            let (have, wanted) = if insensitive {
                (lowercase(&have), utf16(&wanted.to_ascii_lowercase()))
            } else {
                (have, utf16(wanted))
            };
            match operator {
                Operator::Equals => have == wanted,
                Operator::Prefix => have.starts_with(&wanted),
            }
        }
    }
}

fn compound_matches(nodes: &[Node], n: usize, host: usize, tests: &[Test]) -> bool {
    tests.iter().all(|t| test(nodes, n, host, t))
}

/// Om noden `n` treffer de `k` første enkle selektorene, med den siste på `n`.
fn matches_at(nodes: &[Node], n: usize, host: usize, c: &Complex, k: usize) -> bool {
    if !compound_matches(nodes, n, host, &c.compounds[k]) {
        return false;
    }
    if k == 0 {
        return true;
    }
    match c.combinators[k - 1] {
        Combinator::Child => nodes[n]
            .parent
            .is_some_and(|p| matches_at(nodes, p, host, c, k - 1)),
        Combinator::Descendant => {
            let mut a = nodes[n].parent;
            while let Some(p) = a {
                if matches_at(nodes, p, host, c, k - 1) {
                    return true;
                }
                a = nodes[p].parent;
            }
            false
        }
    }
}

pub(crate) fn matches(nodes: &[Node], n: usize, host: usize, list: &[Complex]) -> bool {
    list.iter()
        .any(|c| matches_at(nodes, n, host, c, c.compounds.len() - 1))
}

/// Om `a` er en forfar til `n`.
fn is_ancestor(nodes: &[Node], a: usize, n: usize) -> bool {
    let mut p = nodes[n].parent;
    while let Some(i) = p {
        if i == a {
            return true;
        }
        p = nodes[i].parent;
    }
    false
}

/// Malsyntaks i innholdet som kan gi en annen markup på siden enn i kilden:
/// det `is_templated_content` kjenner, og et uttrykk i `{…}` i teksten
/// utenfor taggene, som i Astro og JSX. En `{` i en attributtverdi, som
/// `count-one="{n} treff"` eller `data-signals="{…}"`, er ikke et uttrykk.
fn decides_markup(content: &[u16]) -> bool {
    if is_templated_content(content) {
        return true;
    }
    let mut in_tag = false;
    let mut quote: Option<u16> = None;
    for &c in content {
        match quote {
            Some(q) if c == q => quote = None,
            Some(_) => {}
            None if in_tag && (c == DOUBLE_QUOTE || c == SINGLE_QUOTE) => quote = Some(c),
            None if c == LT => in_tag = true,
            None if c == GT => in_tag = false,
            None if !in_tag && c == b'{' as u16 => return true,
            None => {}
        }
    }
    false
}

/// Attributtene som tar bort eller gjentar et element i Vue og Angular.
/// Alpine sine `x-if` og `x-for` står på en `<template>`, som ikke teller.
const DIRECTIVES: &[&str] = &["v-if", "v-else", "v-else-if", "v-for", "*ngif", "*ngfor"];

fn has_directive(node: &Node) -> bool {
    node.attributes
        .iter()
        .any(|a| DIRECTIVES.iter().any(|d| equals(&a.name, d)))
}

/// Om noden står i en `<template>`.
fn in_template(nodes: &[Node], n: usize) -> bool {
    let mut p = nodes[n].parent;
    while let Some(i) = p {
        if nodes[i].name == "template" {
            return true;
        }
        p = nodes[i].parent;
    }
    false
}

/// En vert: et element eller en klasse med deler.
struct Host<'a> {
    name: String,
    /// Om verten er en web-komponent, som bruker den første delen, eller en klasse.
    element: bool,
    link: &'a str,
    parts: &'a [Part],
    /// Om en node er en vert av samme slag.
    is: Box<dyn Fn(&Node) -> bool + 'a>,
}

/// Første setning av beskrivelsen, uten kodemerkene.
fn first_sentence(description: &str) -> String {
    let plain = description.replace('`', "");
    match plain.find(". ") {
        Some(end) => plain[..=end].to_string(),
        None => plain,
    }
}

/// Nodene som hører til verten `h`, og innholdet dens i teksten.
///
/// Nodene er etterkommerne der den nærmeste verten av samme slag er `h`,
/// utenom det som står i en `<template>`: et felt inni et felt er det indre
/// feltets, som `part.closest(host.localName) === host` i komponentene.
/// Innholdet går fra slutten av åpningstaggen til sluttaggen, ikke vertens
/// egne attributter og ikke teksten etter den. `None` når verten er tom.
pub(crate) fn host_content(
    source: &[u16],
    nodes: &[Node],
    h: usize,
    is_host: &dyn Fn(&Node) -> bool,
) -> Option<(Vec<usize>, (usize, usize))> {
    let mut own = Vec::new();
    let mut last = h;
    for n in h + 1..nodes.len() {
        if !is_ancestor(nodes, h, n) {
            break;
        }
        last = n;
        let mut p = nodes[n].parent;
        let mut nearest = None;
        while let Some(i) = p {
            if is_host(&nodes[i]) {
                nearest = Some(i);
                break;
            }
            p = nodes[i].parent;
        }
        if nearest == Some(h) && !in_template(nodes, n) {
            own.push(n);
        }
    }
    if own.is_empty() {
        return None;
    }
    let from = tag_end(source, nodes[h].name_end).map_or(nodes[h].name_end, |e| e + 1);
    let next = nodes
        .get(last + 1)
        .map_or(source.len(), |n| n.name_start.saturating_sub(1));
    let close = format!("</{}", nodes[h].name);
    let to = (from..next.max(from))
        .rev()
        .find(|&i| starts_at_ci(source, i, &close))
        .unwrap_or(next.max(from));
    Some((own, (from, to)))
}

/// Om malen avgjør markupen i verten: malsyntaks i innholdet, eller et
/// `v-if` på en av delene. Da sier reglene ingenting.
pub(crate) fn templated_host(
    source: &[u16],
    nodes: &[Node],
    own: &[usize],
    (from, to): (usize, usize),
) -> bool {
    decides_markup(&source[from..to]) || own.iter().any(|&n| has_directive(&nodes[n]))
}

pub(crate) fn check_parts(source: &[u16], vocabulary: &Vocabulary, nodes: &[Node]) -> Vec<Finding> {
    // Bare vertene som har en del med `unique` kan gi et funn, og bare dem
    // som står i teksten.
    let unique = |parts: &[Part]| parts.iter().any(|p| p.unique);
    let present = |name: &str| contains_str(source, name);
    let elements: Vec<&Element> = vocabulary
        .elements
        .iter()
        .filter(|e| unique(&e.parts) && present(&e.tag))
        .collect();
    let classes: Vec<&Class> = vocabulary
        .classes
        .iter()
        .filter(|c| unique(&c.parts) && present(&c.name))
        .collect();
    if elements.is_empty() && classes.is_empty() {
        return Vec::new();
    }
    let mut hosts: Vec<Host> = Vec::new();
    for e in elements {
        let tag = e.tag.clone();
        hosts.push(Host {
            name: format!("<{}>", e.tag),
            element: true,
            link: &e.link,
            parts: &e.parts,
            is: Box::new(move |n: &Node| n.name == tag),
        });
    }
    for c in classes {
        let name = c.name.clone();
        hosts.push(Host {
            name: c.name.clone(),
            element: false,
            link: &c.link,
            parts: &c.parts,
            is: Box::new(move |n: &Node| has_word(n, "class", &name)),
        });
    }

    let mut out = Vec::new();
    let mut reported = std::collections::HashSet::new();
    for host in &hosts {
        let parsed: Vec<Option<Vec<Complex>>> =
            host.parts.iter().map(|p| parse(&p.selector)).collect();
        for h in (0..nodes.len()).filter(|&h| (host.is)(&nodes[h])) {
            let Some((own, range)) = host_content(source, nodes, h, &*host.is) else {
                continue;
            };
            if templated_host(source, nodes, &own, range) {
                continue;
            }
            for (k, part) in host.parts.iter().enumerate() {
                if !part.unique {
                    continue;
                }
                let Some(list) = &parsed[k] else {
                    continue;
                };
                let hits: Vec<usize> = own
                    .iter()
                    .copied()
                    .filter(|&n| matches(nodes, n, h, list))
                    .collect();
                for &n in hits.iter().skip(1) {
                    let node = &nodes[n];
                    // Nøstede verter med den samme delen, som klassen og
                    // elementet i `<fs-session-timeout>`, melder den samme
                    // noden bare én gang.
                    if !reported.insert(node.name_start) {
                        continue;
                    }
                    out.push(Finding {
                        start: node.name_start,
                        end: node.name_end,
                        severity: Severity::Warning,
                        link: host.link.to_string(),
                        message: format!(
                            "{} har delen «{}» mer enn én gang. {} {}",
                            host.name,
                            part.name,
                            if host.element {
                                "Web-komponenten bruker bare den første, og denne blir stående utenfor."
                            } else {
                                "Den skal stå én gang."
                            },
                            first_sentence(&part.description)
                        )
                        .trim_end()
                        .to_string(),
                        fix: None,
                        rule: "del-flere-ganger",
                    });
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_every_selector_in_the_manifest() {
        let v = crate::manifest::for_tests();
        let selectors: Vec<&str> = v
            .elements
            .iter()
            .flat_map(|e| e.parts.iter())
            .chain(v.classes.iter().flat_map(|c| c.parts.iter()))
            .map(|p| p.selector.as_str())
            .collect();
        assert!(
            selectors.len() > 50,
            "fant bare {} selektorer",
            selectors.len()
        );
        for s in selectors {
            assert!(parse(s).is_some(), "forstår ikke «{s}»");
        }
    }

    #[test]
    fn refuses_what_it_does_not_know() {
        for s in ["a ~ b", "a + b", "a:hover", "[a$='x']", ":is(a)", "a >", ""] {
            assert!(parse(s).is_none(), "skulle avvist «{s}»");
        }
    }

    fn rules(html: &str) -> Vec<String> {
        let v = crate::manifest::for_tests();
        check_parts(&utf16(html), &v, &crate::references::tree(&utf16(html)))
            .into_iter()
            .map(|f| f.message)
            .collect()
    }

    #[test]
    fn two_controls_in_a_field() {
        let found = rules(r#"<fs-field><label>Navn</label><input><input></fs-field>"#);
        assert_eq!(found.len(), 1, "{found:?}");
        assert!(found[0].starts_with("<fs-field> har delen «control»"));
    }

    #[test]
    fn a_field_inside_a_field_is_its_own() {
        assert!(rules(r#"<fs-field><label>A</label><input><fs-field><label>B</label><input></fs-field></fs-field>"#).is_empty());
    }

    #[test]
    fn only_unique_parts_are_reported() {
        // Knappene i panelet er menyens, og en delt knapp er riktig.
        assert!(rules(r#"<fs-popover><button>Lagre</button><button aria-controls="m">v</button><ul class="fs-popover" id="m"><li><button>A</button></li></ul></fs-popover>"#).is_empty());
        // Flere overskrifter i en dialog er innhold.
        assert!(rules(r#"<fs-dialog><dialog aria-label="Innstillinger"><h2>Lyd</h2><h2>Bilde</h2></dialog></fs-dialog>"#).is_empty());
        // Hver hjelpetekst i hvert sitt felt i et feltsett.
        assert!(rules(r#"<fieldset class="fs-fieldset"><legend class="fs-legend">Adresse</legend><label>Gate</label><input><p class="fs-help-text">A</p><label>Postnummer</label><input><p class="fs-help-text">B</p></fieldset>"#).is_empty());
        assert_eq!(
            rules(r#"<fs-dialog><dialog></dialog><dialog></dialog></fs-dialog>"#).len(),
            1
        );
    }

    #[test]
    fn a_nested_host_reports_a_node_once() {
        // I manifestet har ingen to nøstede verter den samme delen med
        // `unique`. Her får klassen i dialogen det også, så de to overlapper.
        let mut v = (*crate::manifest::for_tests()).clone();
        for c in v
            .classes
            .iter_mut()
            .filter(|c| c.name == "fs-session-timeout__dialog")
        {
            for p in c.parts.iter_mut().filter(|p| p.name == "text") {
                p.unique = true;
            }
        }
        let html = r#"<fs-session-timeout class="fs-session-timeout"><dialog class="fs-session-timeout__dialog"><p class="fs-session-timeout__text">A</p><p class="fs-session-timeout__text">B</p></dialog></fs-session-timeout>"#;
        let found = check_parts(&utf16(html), &v, &crate::references::tree(&utf16(html)));
        assert_eq!(found.len(), 1, "{found:?}");
    }

    #[test]
    fn what_a_template_hides_or_decides_does_not_count() {
        assert!(rules(
            r#"<fs-field><label>A</label><input><template><input></template></fs-field>"#
        )
        .is_empty());
        assert!(
            rules(r#"<fs-field><label>A</label>{lang ? <textarea /> : <input />}</fs-field>"#)
                .is_empty()
        );
        assert!(rules(r#"<fs-field><label>A</label><input v-if="kort"><textarea v-else></textarea></fs-field>"#).is_empty());
    }

    #[test]
    fn braces_and_words_that_are_not_templates_do_not_silence_it() {
        // `{n}` i en attributtverdi på verten, `nav-form` som ligner `v-for`,
        // en e-postadresse som ligner `@if`, og et uttrykk etter sluttaggen.
        let html = r#"<fs-suggestion count-one="{n} hits"><input class="nav-form" data-on:input="$n > 0 && go({a: 1})"><input><p>kontakt@ifi.uio.no</p></fs-suggestion>
<fs-field><label>A</label><input><input></fs-field>
{error && <p>Error</p>}"#;
        assert_eq!(rules(html).len(), 2, "{:?}", rules(html));
    }

    #[test]
    fn a_spinner_is_not_a_second_status() {
        assert!(rules(r#"<fs-suggestion><label>A</label><input><ul class="fs-suggestion__list"></ul><span role="status"></span><span class="fs-spinner" role="status" aria-label="Henter"></span></fs-suggestion>"#).is_empty());
    }

    #[test]
    fn type_is_compared_without_case() {
        assert!(rules(r#"<fs-field><input type="HIDDEN" name="x"><input type="checkbox" name="y"><label>A</label></fs-field>"#).is_empty());
    }

    #[test]
    fn says_nothing_when_a_template_decides() {
        assert!(rules("<fs-field><label>A</label>{{if .Lang}}<textarea></textarea>{{else}}<input>{{end}}</fs-field>").is_empty());
    }

    #[test]
    fn classes_have_parts_too() {
        assert_eq!(rules(r#"<table class="fs-table"><caption>A</caption><caption>B</caption><thead></thead><tbody></tbody></table>"#).len(), 1);
        assert!(rules(r#"<div class="fs-card"><h3 class="fs-card__title">A</h3><div class="fs-card"><h3 class="fs-card__title">B</h3></div></div>"#).is_empty());
    }
}

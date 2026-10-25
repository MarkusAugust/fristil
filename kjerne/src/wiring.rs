//! Koblingen malen må skrive selv, for at komponentene skal virke uten
//! JavaScript og overleve en oppdatering fra serveren.
//!
//! Komponentene skriver aldri id på det brukeren rører: feltet, fanene og
//! panelene. Datastar og idiomorph kjenner et element igjen på id, og et
//! element med en id serveren ikke sendte, byttes ut ved neste oppdatering,
//! med fokus og det brukeren skrev. Det som trengs for at feltet skal ha et
//! navn uten JavaScript, `for` og `id` eller ledeteksten rundt feltet, er
//! derfor malens. Reglene her sier fra når det mangler, i markupmodus som i
//! sidemodus, med samme ord som komponentene bruker i konsollen.
//!
//! Hvilke deler som må ha id fra serveren, står i manifestet som `stableId`
//! på delen, så en ny del i `metadata.ts` sjekkes uten en linje her. Hver
//! komponents egne regler, som fanene og forslagslista, står under sitt
//! elementnavn.
//!
//! Reglene tier der malen avgjør markupen: en løkke, et `if` eller et
//! uttrykk i verten, et `v-if` på en del, en bundet id (`:id`, `v-bind:id`,
//! `x-bind:id`, `data-attr:id`, `[id]`, `th:id`, `asp-for`) eller en id med
//! malsyntaks i. Da vet bare serveren hva som havner på siden.

use std::collections::{HashMap, HashSet};

use crate::diagnose::{attribute, is_templated, is_templated_value};
use crate::parts::{host_content, matches, parse, templated_host};
use crate::references::{decode, has_class, non_empty, value, within, Node};
use crate::text::*;
use crate::types::*;

const CONTROLS: &[&str] = &["input", "textarea", "select"];

/// Id-ene komponentene lager selv, `uniqueId` i `host-element.ts`, pluss
/// `createFieldId`: `fs-field-<tall>-<seks tegn>`.
const GENERATED_PREFIXES: &[&str] = &[
    "fs-field-help-",
    "fs-field-error-",
    "fs-popover-",
    "fs-dialog-title-",
    "fs-session-timeout-title-",
    "fs-tabs-heading-",
];

/// Hva noden sier om id-en sin.
enum Id {
    /// Ingen id, og ingen binding som gir en.
    Missing,
    /// En binding eller malsyntaks gir id-en på siden, og bare serveren vet hva.
    Unknown,
    /// En id skrevet rett ut.
    Given(Utf16),
}

fn id_of(node: &Node) -> Id {
    let bound = node.attributes.iter().any(|a| {
        let n = lossy(&lowercase(&a.name));
        n == "asp-for"
            || (n != "id" && (n.ends_with(":id") || n.ends_with("[id]") || n.ends_with(".id")))
    });
    if bound {
        return Id::Unknown;
    }
    match value(node, "id").and_then(|a| a.value.clone()) {
        Some(v) if is_templated_value(&v) => Id::Unknown,
        Some(v) if !trimmed(&v).is_empty() => Id::Given(v),
        _ => Id::Missing,
    }
}

/// Om noden selv har malsyntaks i et attributt eller en verdi.
fn templated_node(node: &Node) -> bool {
    node.attributes
        .iter()
        .any(|a| is_templated(&a.name) || a.value.as_deref().is_some_and(is_templated))
}

/// Om attributtet står der i en eller annen form, bundet eller rett ut.
fn has_attribute(node: &Node, name: &str) -> bool {
    attribute(&node.attributes, name).is_some()
}

/// Verdien slik den står, bare når attributtet er skrevet rett ut.
fn plain_value<'a>(node: &'a Node, name: &str) -> Option<&'a Utf16> {
    value(node, name).and_then(|a| a.value.as_ref())
}

fn finding(
    rule: &'static str,
    node: &Node,
    link: &str,
    message: String,
    fix: Option<Fix>,
) -> Finding {
    Finding {
        start: node.name_start,
        end: node.name_end,
        severity: Severity::Warning,
        link: link.to_string(),
        message,
        fix,
        rule,
    }
}

/// En gyldig id laget av `name`: bokstaver, tall, bindestrek og understrek,
/// og første tegn en bokstav. `items[0].email` og `kommune[]` er ikke det.
fn id_from_name(name: &[u16]) -> Option<String> {
    let text = lossy(name);
    let mut chars = text.chars();
    let first = chars.next()?;
    if !first.is_ascii_alphabetic() {
        return None;
    }
    if !chars.all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return None;
    }
    Some(text)
}

/// Det som sitter i teksten, lest én gang per side.
struct Page<'a> {
    nodes: &'a [Node],
    /// Hver id på siden, dekodet, og noden som har den.
    ids: HashMap<Utf16, usize>,
    /// Verdiene i hver `<label for>` på siden, dekodet.
    label_for: HashSet<Utf16>,
}

impl Page<'_> {
    fn has_id(&self, id: &[u16]) -> bool {
        self.ids.contains_key(&decode(id))
    }
}

pub(crate) fn check_wiring(
    source: &[u16],
    vocabulary: &Vocabulary,
    nodes: &[Node],
    page_mode: bool,
) -> Vec<Finding> {
    let mut ids = HashMap::new();
    let mut label_for = HashSet::new();
    for (n, node) in nodes.iter().enumerate() {
        if let Some(id) = non_empty(node, "id") {
            ids.entry(decode(id)).or_insert(n);
        }
        if node.name == "label" {
            if let Some(target) = non_empty(node, "for") {
                label_for.insert(decode(target));
            }
        }
    }
    let page = Page {
        nodes,
        ids,
        label_for,
    };

    let mut out = Vec::new();
    for element in &vocabulary.elements {
        if !contains_str(source, &element.tag) {
            continue;
        }
        let tag = element.tag.as_str();
        let is_host = |n: &Node| n.name == tag;
        let parsed: Vec<Option<Vec<_>>> =
            element.parts.iter().map(|p| parse(&p.selector)).collect();
        for h in (0..nodes.len()).filter(|&h| is_host(&nodes[h])) {
            let Some((own, range)) = host_content(source, nodes, h, &is_host) else {
                continue;
            };
            if templated_node(&nodes[h]) || templated_host(source, nodes, &own, range) {
                continue;
            }
            let host = Host {
                page: &page,
                element,
                h,
                own: &own,
                parsed: &parsed,
            };
            out.extend(host.stable_ids());
            match tag {
                "fs-tabs" => out.extend(host.tabs()),
                "fs-suggestion" => out.extend(host.suggestion()),
                "fs-field" => out.extend(host.field()),
                _ => {}
            }
        }
    }
    out.extend(text_in_label(&page, vocabulary));
    if !page_mode {
        out.extend(generated_ids(&page, vocabulary));
    }
    out
}

/// Én vert med delene sine, slik de står i manifestet.
struct Host<'a> {
    page: &'a Page<'a>,
    element: &'a Element,
    h: usize,
    own: &'a [usize],
    parsed: &'a [Option<Vec<crate::parts::Complex>>],
}

impl Host<'_> {
    fn nodes(&self) -> &[Node] {
        self.page.nodes
    }

    fn tag(&self) -> &str {
        &self.element.tag
    }

    fn link(&self) -> &str {
        &self.element.link
    }

    /// Nodene i verten som er delen med navnet, i rekkefølge.
    fn part(&self, name: &str) -> Vec<usize> {
        let Some(k) = self.element.parts.iter().position(|p| p.name == name) else {
            return Vec::new();
        };
        let Some(list) = &self.parsed[k] else {
            return Vec::new();
        };
        self.own
            .iter()
            .copied()
            .filter(|&n| matches(self.nodes(), n, self.h, list))
            .collect()
    }

    fn first(&self, name: &str) -> Option<usize> {
        self.part(name).into_iter().next()
    }

    fn own_named(&self, name: &str) -> Vec<usize> {
        self.own
            .iter()
            .copied()
            .filter(|&n| self.nodes()[n].name == name)
            .collect()
    }

    /// Delene med `stableId`: en kontroll uten kobling, og et panel uten id.
    fn stable_ids(&self) -> Vec<Finding> {
        let mut out = Vec::new();
        for (k, part) in self.element.parts.iter().enumerate() {
            if !part.stable_id {
                continue;
            }
            let Some(list) = &self.parsed[k] else {
                continue;
            };
            let Some(n) = self
                .own
                .iter()
                .copied()
                .find(|&n| matches(self.nodes(), n, self.h, list))
            else {
                continue;
            };
            let node = &self.nodes()[n];
            if templated_node(node) {
                continue;
            }
            if CONTROLS.contains(&node.name.as_str()) {
                out.extend(self.control(n));
            } else if matches!(id_of(node), Id::Missing) {
                out.push(finding(
                    "panel-uten-id",
                    node,
                    self.link(),
                    format!(
                        "<{}> har delen «{}» uten id. {}",
                        self.tag(),
                        part.name,
                        part.description
                    ),
                    None,
                ));
            }
        }
        out
    }

    /// `kontroll-uten-kobling`: ledeteksten verken peker på feltet med `for`
    /// eller står rundt det.
    fn control(&self, n: usize) -> Option<Finding> {
        let nodes = self.nodes();
        let control = &nodes[n];
        if has_attribute(control, "aria-label") || has_attribute(control, "aria-labelledby") {
            return None;
        }
        if within(nodes, n, |m| m.name == "label") {
            return None;
        }
        let labels = self.own_named("label");
        // Uten en ledetekst i det hele tatt sier `felt-uten-ledetekst` fra
        // om <fs-field>. Forslagsfeltet har ingen slik regel, så der meldes
        // det her.
        if labels.is_empty() && self.tag() == "fs-field" {
            return None;
        }
        let id = match id_of(control) {
            Id::Unknown => return None,
            Id::Given(id) => Some(id),
            Id::Missing => None,
        };
        if let Some(id) = &id {
            if self.page.label_for.contains(&decode(id)) {
                return None;
            }
        }
        let what = format!("<{}>", control.name);
        let message = if labels.is_empty() {
            format!(
                "Feltet har ingen ledetekst koblet til seg: ingen <label for> peker på {what}, og ingen <label> står rundt det. Uten kobling har feltet ikke noe navn uten JavaScript. Gi feltet en fast id fra det feltet står for, for eksempel id=\"kommune\", og skriv den samme i for på en <label>, eller legg ledeteksten rundt feltet."
            )
        } else {
            format!(
                "Ledeteksten er ikke koblet til {what}. Uten kobling har feltet ikke noe navn uten JavaScript, og klikk på ledeteksten flytter ikke fokus dit. Gi feltet en fast id fra det feltet står for, for eksempel id=\"kommune\", og skriv den samme i for på ledeteksten, eller legg ledeteksten rundt feltet."
            )
        };
        let fix = self.link_fix(n, &labels, id.is_none());
        Some(finding(
            "kontroll-uten-kobling",
            control,
            self.link(),
            message,
            fix,
        ))
    }

    /// «Gi feltet id «navn»»: `id` på kontrollen og `for` på ledeteksten,
    /// bare når `name` kan være en id, ingen annen har den, kontrollen ikke
    /// har noen id fra før, og ledeteksten i verten står uten `for`.
    fn link_fix(&self, n: usize, labels: &[usize], without_id: bool) -> Option<Fix> {
        if !without_id {
            return None;
        }
        let nodes = self.nodes();
        let control = &nodes[n];
        let name = plain_value(control, "name")?;
        if is_templated_value(name) {
            return None;
        }
        let id = id_from_name(name)?;
        if self.page.has_id(&utf16(&id)) {
            return None;
        }
        let &l = labels.first()?;
        let label = &nodes[l];
        if value(label, "for").is_some() || templated_node(label) {
            return None;
        }
        let mut edits = vec![
            Edit {
                start: control.name_end,
                end: control.name_end,
                text: format!(" id=\"{id}\""),
            },
            Edit {
                start: label.name_end,
                end: label.name_end,
                text: format!(" for=\"{id}\""),
            },
        ];
        edits.sort_by_key(|e| e.start);
        Some(Fix {
            title: format!("Gi feltet id «{id}»"),
            edits,
            preferred: true,
        })
    }

    /// Fanene: hver lenke har et panel, raden har et navn, og en fane er en lenke.
    fn tabs(&self) -> Vec<Finding> {
        let nodes = self.nodes();
        let mut out = Vec::new();
        for n in self.part("tab") {
            let tab = &nodes[n];
            if templated_node(tab) {
                continue;
            }
            let Some(href) = plain_value(tab, "href") else {
                continue;
            };
            if is_templated_value(href) {
                continue;
            }
            let target = &href[1..];
            if target.is_empty() || self.page.has_id(target) {
                continue;
            }
            out.push(finding(
                "fanelenke-uten-panel",
                tab,
                self.link(),
                format!(
                    "<{}> har en fane uten et panel: lenken peker på #{}, og ingen element har den id-en. Skriv id på hvert .fs-tabs__panel, den samme som lenken peker på. Fanen kan velges uten at noe vises.",
                    self.tag(),
                    lossy(target)
                ),
                None,
            ));
        }

        if let Some(l) = self.first("list") {
            let list = &nodes[l];
            let named = attribute(&list.attributes, "aria-label")
                .is_some_and(|a| a.value.as_deref().is_none_or(|v| !trimmed(v).is_empty()))
                || has_attribute(list, "aria-labelledby");
            if !named && !templated_node(list) {
                out.push(finding(
                    "fanerad-uten-navn",
                    list,
                    self.link(),
                    format!(
                        "<{}> har en fanerad uten navn. Skriv aria-label på .fs-tabs__list, som aria-label=\"Deler av saken\", eller aria-labelledby mot en overskrift. Uten navn sier skjermleseren bare «faneliste».",
                        self.tag()
                    ),
                    Some(Fix::one(
                        "Gi raden et navn med aria-label".into(),
                        list.name_end,
                        list.name_end,
                        " aria-label=\"Deler av saken\"".into(),
                        true,
                    )),
                ));
            }
            // Det serveren har kalt en fane i raden, men som ikke er en
            // lenke til et panel.
            for &n in self.own {
                let node = &nodes[n];
                if !within(nodes, n, |m| std::ptr::eq(m, list)) || n == l {
                    continue;
                }
                let is_tab = plain_value(node, "role")
                    .is_some_and(|v| equals(&lowercase(trimmed(v)), "tab"));
                if !is_tab || templated_node(node) {
                    continue;
                }
                let is_link = node.name == "a"
                    && plain_value(node, "href").is_some_and(|v| {
                        v.first() == Some(&(b'#' as u16)) || is_templated_value(v)
                    });
                if is_link {
                    continue;
                }
                out.push(finding(
                    "fane-uten-lenke",
                    node,
                    self.link(),
                    format!(
                        "<{}> har en fane uten href: role=\"tab\" står på <{}>, som ikke er en lenke til et panel. Fanene er lenker, som <a href=\"#vedlegg\">, så de virker uten JavaScript. Komponenten rører ikke det som ikke er en lenke.",
                        self.tag(),
                        node.name
                    ),
                    None,
                ));
            }
        }
        out
    }

    /// Forslagslista: `data-value` på alternativene og `.fs-suggestion__value` hører sammen.
    fn suggestion(&self) -> Vec<Finding> {
        let nodes = self.nodes();
        let options = self.part("option");
        if options.is_empty() {
            return Vec::new();
        }
        let with_value: Vec<usize> = options
            .iter()
            .copied()
            .filter(|&n| has_attribute(&nodes[n], "data-value"))
            .collect();
        let field = self.first("value");
        match (with_value.first(), field) {
            (Some(&n), None) => vec![finding(
                "verdi-uten-felt",
                &nodes[n],
                self.link(),
                format!(
                    "<{}> har alternativer med data-value, men ikke noe .fs-suggestion__value. Koden brukeren velger, sendes da ikke med skjemaet, bare teksten i feltet. Skriv <input type=\"hidden\" class=\"fs-suggestion__value\" name=\"…\"> i feltet, så komponenten fyller det.",
                    self.tag()
                ),
                None,
            )],
            (None, Some(f)) => vec![finding(
                "verdi-uten-felt",
                &nodes[f],
                self.link(),
                format!(
                    "<{}> har et .fs-suggestion__value, men ingen alternativer med data-value. Feltet blir stående tomt. Gi hvert alternativ data-value med koden det står for.",
                    self.tag()
                ),
                None,
            )],
            _ => Vec::new(),
        }
    }

    /// Feltet: en skjult feilmelding og `aria-invalid="true"` sier imot hverandre.
    fn field(&self) -> Vec<Finding> {
        let nodes = self.nodes();
        let (Some(e), Some(c)) = (self.first("error"), self.first("control")) else {
            return Vec::new();
        };
        let error = &nodes[e];
        let control = &nodes[c];
        // Et boolsk attributt har ingen verdi; det står der eller ikke.
        let hidden = value(error, "hidden").is_some();
        let invalid = plain_value(control, "aria-invalid")
            .is_some_and(|v| equals(&lowercase(trimmed(v)), "true"));
        if !hidden || !invalid || templated_node(error) || templated_node(control) {
            return Vec::new();
        }
        vec![finding(
            "feilmelding-motsier",
            error,
            self.link(),
            format!(
                "Feilmeldingen har hidden, men <{}> har aria-invalid=\"true\". Komponenten regner feltet som ugyldig når feilmeldingen synes eller aria-invalid står der, så de to sier imot hverandre: skjermleseren hører «ugyldig» uten at brukeren ser hvorfor. Ta bort det ene.",
                control.name
            ),
            None,
        )]
    }
}

/// `tekst-i-ledetekst`: hjelpeteksten eller feilmeldingen står inni `<label>`.
fn text_in_label(page: &Page, vocabulary: &Vocabulary) -> Vec<Finding> {
    let link = vocabulary
        .elements
        .iter()
        .find(|e| e.tag == "fs-field")
        .map_or("", |e| e.link.as_str());
    let mut out = Vec::new();
    for (n, node) in page.nodes.iter().enumerate() {
        let help = has_class(node, |c| equals(c, "fs-help-text"));
        let error = !help && has_class(node, |c| equals(c, "fs-error-text"));
        if !help && !error {
            continue;
        }
        if !within(page.nodes, n, |m| m.name == "label") {
            continue;
        }
        let what = if help {
            "Hjelpeteksten"
        } else {
            "Feilmeldingen"
        };
        out.push(finding(
            "tekst-i-ledetekst",
            node,
            link,
            format!(
                "{what} står inni <label>, og blir en del av feltets navn. Skjermleseren leser den som navnet på feltet, og aria-describedby peker på noe inni navnet. Flytt den ut av <label>, ved siden av feltet."
            ),
            None,
        ));
    }
    out
}

/// `id-fra-komponenten`: en id komponenten lagde selv i nettleseren, kopiert
/// inn i malen fra DevTools. Bare i markupmodus: på en rendret side er den
/// riktig.
fn generated_ids(page: &Page, vocabulary: &Vocabulary) -> Vec<Finding> {
    let link = vocabulary
        .elements
        .iter()
        .find(|e| e.tag == "fs-field")
        .map_or("", |e| e.link.as_str());
    let mut out = Vec::new();
    for node in page.nodes {
        let Some(id) = non_empty(node, "id") else {
            continue;
        };
        let text = lossy(id);
        if !looks_generated(&text) {
            continue;
        }
        let a = value(node, "id").unwrap();
        out.push(Finding {
            start: a.value_start,
            end: a.value_start + id.len(),
            severity: Severity::Warning,
            link: link.to_string(),
            message: format!(
                "id=\"{text}\" er en id komponenten lagde selv i nettleseren, og ser ut som kopiert fra DevTools. Komponenten lager en ny ved hver sidelasting, så ingenting kan peke på denne. Skriv din egen id, fra det elementet står for, eller la den stå tom."
            ),
            fix: None,
            rule: "id-fra-komponenten",
        });
    }
    out
}

fn looks_generated(id: &str) -> bool {
    let base36 = |s: &str, len: usize| {
        s.len() == len
            && s.chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
    };
    if let Some(rest) = id.strip_prefix("fs-field-") {
        // `createFieldId`: `fs-field-<teller>-<seks tegn>`.
        if let Some((count, tail)) = rest.split_once('-') {
            if !count.is_empty() && count.chars().all(|c| c.is_ascii_digit()) && base36(tail, 6) {
                return true;
            }
        }
    }
    GENERATED_PREFIXES
        .iter()
        .any(|p| id.strip_prefix(p).is_some_and(|tail| base36(tail, 7)))
}

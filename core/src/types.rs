//! Formen på ordforrådet og på funnene.
//!
//! Ordforrådet leses fra manifestet (`designsystem/manifest/manifest.json`)
//! når kjernen kjører. Rekkefølgen er den samme som i manifestet, og den betyr
//! noe: den bestemmer hvilket forslag som vinner ved lik avstand, og hvordan
//! listene i meldingene står.

/// Et attributt et `<lt-…>`-element leser.
#[derive(Clone, Debug)]
pub enum Attribute {
    Flag,
    Text,
    Number,
    Values(Vec<String>),
}

/// En del av et element eller en klasse, som kontrollen i `<lt-field>`, med
/// selektoren komponenten finner den med. Uten `multiple` gjelder den første,
/// og med `unique` er en del til av samme slag en feil. Med `stable_id` må
/// delen ha en id fra serveren: komponenten skriver aldri en, siden en
/// oppdatering ellers bytter delen ut.
#[derive(Clone, Debug)]
pub struct Part {
    pub name: String,
    pub selector: String,
    pub description: String,
    pub multiple: bool,
    pub unique: bool,
    pub stable_id: bool,
}

#[derive(Clone, Debug)]
pub struct Element {
    pub tag: String,
    pub link: String,
    pub attributes: Vec<(String, Attribute)>,
    pub parts: Vec<Part>,
    /// Attributter som er tatt ut, med hva som gjelder i stedet.
    pub removed: Vec<(String, String)>,
}

/// Et attributt en klasse tar, som `data-variant` på `lt-button`, eller et
/// flagg, som `data-optional` på `lt-label`, som er på når det står der.
#[derive(Clone, Debug)]
pub struct ClassAttribute {
    pub values: Vec<String>,
    pub default_value: Option<String>,
    pub flag: bool,
}

#[derive(Clone, Debug)]
pub struct Class {
    pub name: String,
    pub title: String,
    pub link: String,
    pub attributes: Vec<(String, ClassAttribute)>,
    pub parts: Vec<Part>,
}

/// Alt stavekontrollen sjekker mot, lest fra ett manifest.
#[derive(Clone, Debug)]
pub struct Vocabulary {
    /// Versjonen av `@lo-tek/interfaces` manifestet er skrevet fra.
    pub version: String,
    pub schema_version: u32,
    pub elements: Vec<Element>,
    pub classes: Vec<Class>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Severity {
    Error,
    Warning,
}

/// Én endring i en rettelse: bytt ut teksten fra `start` til `end` med `text`.
#[derive(Clone, Debug)]
pub struct Edit {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

/// En rettelse editoren kan tilby: én eller flere endringer som hører sammen,
/// som `id` på feltet og `for` på ledeteksten. Endringene står i den
/// rekkefølgen de har i teksten, og overlapper ikke; den som bruker dem,
/// bruker dem bakfra, så posisjonene holder.
#[derive(Clone, Debug)]
pub struct Fix {
    pub title: String,
    pub edits: Vec<Edit>,
    pub preferred: bool,
}

impl Fix {
    /// En rettelse med én endring.
    pub fn one(title: String, start: usize, end: usize, text: String, preferred: bool) -> Fix {
        Fix {
            title,
            edits: vec![Edit { start, end, text }],
            preferred,
        }
    }
}

/// Ett funn. Posisjonene er UTF-16-indekser i den opprinnelige teksten.
#[derive(Clone, Debug)]
pub struct Finding {
    pub start: usize,
    pub end: usize,
    pub severity: Severity,
    pub link: String,
    pub message: String,
    pub fix: Option<Fix>,
    /// Navnet på regelen, som `unknown-class`. Det er dette en kommentar som
    /// `<!-- lotek-ignore-next unknown-class -->` viser til.
    pub rule: &'static str,
}

/// Navnene på reglene, i den rekkefølgen de står i dokumentasjonen.
pub const RULES: &[&str] = &[
    "unknown-element",
    "unknown-attribute",
    "boolean-with-value",
    "invalid-value",
    "not-a-number",
    "unknown-class",
    "invalid-class-value",
    "disabled-with-href",
    "icon-without-name",
    "field-without-control",
    "part-repeated",
    "field-without-label",
    "timeout-without-dialog",
    "duplikat-id",
    "id-finnes-ikke",
    "for-peker-feil",
    "oppsummering-peker-feil",
    "kontroll-uten-ledetekst",
    "tekst-ikke-koblet",
    "unstyled-class",
    "unstyled-value",
    "control-without-wiring",
    "panel-without-id",
    "tab-link-without-panel",
    "tab-without-link",
    "tab-list-without-name",
    "text-in-label",
    "value-without-field",
    "error-text-contradicts",
    "removed-attribute",
    "id-from-component",
];

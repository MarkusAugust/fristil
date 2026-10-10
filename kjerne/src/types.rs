//! Formen på ordforrådet og på funnene.
//!
//! Ordforrådet leses fra manifestet (`designsystem/manifest/manifest.json`)
//! når kjernen kjører. Rekkefølgen er den samme som i manifestet, og den betyr
//! noe: den bestemmer hvilket forslag som vinner ved lik avstand, og hvordan
//! listene i meldingene står.

/// Et attributt et `<fs-…>`-element leser.
#[derive(Clone, Debug)]
pub enum Attribute {
    Flag,
    Text,
    Number,
    Values(Vec<String>),
}

#[derive(Clone, Debug)]
pub struct Element {
    pub tag: String,
    pub link: String,
    pub attributes: Vec<(String, Attribute)>,
}

/// Et attributt en klasse tar, som `data-variant` på `fs-button`, eller et
/// flagg, som `data-optional` på `fs-label`, som er på når det står der.
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
}

/// Alt stavekontrollen sjekker mot, lest fra ett manifest.
#[derive(Clone, Debug)]
pub struct Vocabulary {
    /// Versjonen av `@fristil/designsystem` manifestet er skrevet fra.
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

/// En rettelse editoren kan tilby: bytt ut teksten fra `start` til `end`.
#[derive(Clone, Debug)]
pub struct Fix {
    pub title: String,
    pub start: usize,
    pub end: usize,
    pub text: String,
    pub preferred: bool,
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
    /// Navnet på regelen, som `ukjent-klasse`. Det er dette en kommentar som
    /// `<!-- fristil-ignore-next ukjent-klasse -->` viser til.
    pub rule: &'static str,
}

/// Navnene på reglene, i den rekkefølgen de står i dokumentasjonen.
pub const RULES: &[&str] = &[
    "ukjent-element",
    "ukjent-attributt",
    "boolsk-med-verdi",
    "ugyldig-verdi",
    "ikke-tall",
    "ukjent-klasse",
    "ugyldig-klasseverdi",
    "deaktivert-med-href",
    "felt-uten-kontroll",
    "felt-uten-ledetekst",
    "tidsavbrudd-uten-dialog",
    "duplikat-id",
    "id-finnes-ikke",
    "for-peker-feil",
    "oppsummering-peker-feil",
    "kontroll-uten-ledetekst",
    "tekst-ikke-koblet",
    "ustylet-klasse",
    "ustylet-verdi",
];

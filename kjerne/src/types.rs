//! Formen på ordforrådet og på funnene.
//!
//! Ordforrådet står i `ordforrad.rs`, generert fra pakken av
//! `kjerne/scripts/bygg.ts`, på samme måte som `classes.ts`, `elements.ts` og
//! `Klasser.kt`. Rekkefølgen er den samme som i TypeScript, og den betyr noe:
//! den bestemmer hvilket forslag som vinner ved lik avstand, og hvordan
//! listene i meldingene står.

/// Et attributt et `<fs-…>`-element leser.
pub enum Attribute {
    Flag,
    Text,
    Number,
    Values(&'static [&'static str]),
}

pub struct Element {
    pub tag: &'static str,
    pub link: &'static str,
    pub attributes: &'static [(&'static str, Attribute)],
}

/// Et attributt en klasse tar, som `data-variant` på `fs-button`.
pub struct ClassAttribute {
    pub values: &'static [&'static str],
    pub default_value: Option<&'static str>,
}

pub struct Class {
    pub name: &'static str,
    pub title: &'static str,
    pub link: &'static str,
    pub attributes: &'static [(&'static str, ClassAttribute)],
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
}

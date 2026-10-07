//! Formen på ordforrådet og på funnene.
//!
//! Ordforrådet står i `ordforrad.rs`, generert fra pakken av
//! `kjerne/scripts/bygg.ts`, på samme måte som `classes.ts`, `elements.ts` og
//! `Klasser.kt`. Rekkefølgen er den samme som i TypeScript, og den betyr noe:
//! den bestemmer hvilket forslag som vinner ved lik avstand, og hvordan
//! listene i meldingene står.

/// Et attributt et `<fs-…>`-element leser.
pub enum Attributt {
    Flagg,
    Tekst,
    Tall,
    Verdier(&'static [&'static str]),
}

pub struct Element {
    pub tagg: &'static str,
    pub lenke: &'static str,
    pub attributter: &'static [(&'static str, Attributt)],
}

/// Et attributt en klasse tar, som `data-variant` på `fs-button`.
pub struct KlasseAttributt {
    pub verdier: &'static [&'static str],
    pub standard: Option<&'static str>,
}

pub struct Klasse {
    pub navn: &'static str,
    pub tittel: &'static str,
    pub lenke: &'static str,
    pub attributter: &'static [(&'static str, KlasseAttributt)],
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Alvor {
    Feil,
    Advarsel,
}

/// En rettelse editoren kan tilby: bytt ut teksten fra `start` til `end`.
#[derive(Clone, Debug)]
pub struct Rettelse {
    pub tittel: String,
    pub start: usize,
    pub slutt: usize,
    pub tekst: String,
    pub foretrukket: bool,
}

/// Ett funn. Posisjonene er UTF-16-indekser i den opprinnelige teksten.
#[derive(Clone, Debug)]
pub struct Funn {
    pub start: usize,
    pub slutt: usize,
    pub alvor: Alvor,
    pub lenke: String,
    pub melding: String,
    pub rettelse: Option<Rettelse>,
}

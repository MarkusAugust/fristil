//! Ordforrådet: elementer, attributter, klasser og verdier.
//!
//! En oversettelse av `designsystem/src/diagnostics/diagnostics.ts`, funksjon
//! for funksjon og med de samme meldingene. Kommentarene der forklarer
//! hvorfor reglene er som de er; her står bare det som er annerledes i Rust.
//! Hvert regulært uttrykk er skrevet ut som en løkke, med det samme svaret.

use std::collections::HashMap;

use crate::ordforrad::{ELEMENTER, KLASSER};
use crate::tekst::*;
use crate::typer::*;

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

fn er_global(navn: &[u16]) -> bool {
    GLOBAL.iter().any(|g| lik(navn, g))
        || lik(navn, "_")
        || ["data-", "aria-", "on", "hx-", "x-", "v-", "i18n"]
            .iter()
            .any(|p| har_ved(navn, 0, p))
        || navn
            .iter()
            .any(|&c| c < 0x80 && b":@*[](){}%$#?".contains(&(c as u8)))
}

/// `/\{\{|\{%|\{#|<\?|<%|\$\{|@\(/`: Go, Jinja, PHP, ASP, JS-maler og Razor.
pub fn er_mal(t: &[u16]) -> bool {
    ["{{", "{%", "{#", "<?", "<%", "${", "@("]
        .iter()
        .any(|m| inneholder(t, m))
}

/// En verdi i klammer er Astro eller Svelte, og et uttrykk: `/^\s*[@{]/`.
pub fn er_mal_verdi(t: &[u16]) -> bool {
    er_mal(t)
        || t.iter()
            .find(|&&c| !er_mellomrom(c))
            .is_some_and(|&c| c == b'@' as u16 || c == b'{' as u16)
}

/// Razor i innholdet, utenfor taggene.
fn er_mal_innhold(t: &[u16]) -> bool {
    if er_mal(t) {
        return true;
    }
    // `text.replace(/<[^>]*>/g, " ")`
    let mut uten = Vec::with_capacity(t.len());
    let mut i = 0;
    while i < t.len() {
        if t[i] == LT {
            if let Some(gt) = finn_tegn(t, i + 1, GT) {
                uten.push(b' ' as u16);
                i = gt + 1;
                continue;
            }
        }
        uten.push(t[i]);
        i += 1;
    }
    // `/(^|\s)@[A-Za-z]/`
    (0..uten.len()).any(|i| {
        uten[i] == b'@' as u16
            && (i == 0 || er_mellomrom(uten[i - 1]))
            && i + 1 < uten.len()
            && er_ascii_bokstav(uten[i + 1])
    })
}

/// Navnet uten bindestreker og store bokstaver, for å kjenne igjen skrivefeil.
fn normalisert(t: &[u16]) -> Tekst {
    liten(t)
        .into_iter()
        .filter(|&c| c != b'-' as u16 && c != b'_' as u16)
        .collect()
}

/// Redigeringsavstanden, med ombytte av to nabotegn som én.
fn avstand(a: &[u16], b: &[u16]) -> usize {
    let mut før: Vec<usize> = vec![0; b.len() + 1];
    let mut forrige: Vec<usize> = (0..=b.len()).collect();
    for i in 1..=a.len() {
        let mut nå = vec![i; b.len() + 1];
        for j in 1..=b.len() {
            let mut d = (forrige[j] + 1)
                .min(nå[j - 1] + 1)
                .min(forrige[j - 1] + usize::from(a[i - 1] != b[j - 1]));
            if i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1] {
                d = d.min(før[j - 2] + 1);
            }
            nå[j] = d;
        }
        før = forrige;
        forrige = nå;
    }
    forrige[b.len()]
}

fn felles_begynnelse(a: &[u16], b: &[u16]) -> usize {
    a.iter().zip(b).take_while(|(x, y)| x == y).count()
}

pub type Hukommelse = HashMap<Tekst, Option<(&'static str, bool)>>;

/// Det nærmeste kjente navnet, når det er nært nok til å være en skrivefeil.
pub fn nærmeste(
    navn: &[u16],
    kandidater: &[&'static str],
    hukommelse: Option<&mut Hukommelse>,
) -> Option<(&'static str, bool)> {
    if let Some(h) = &hukommelse {
        if let Some(svar) = h.get(navn) {
            return *svar;
        }
    }
    let svar = finn_nærmeste(navn, kandidater);
    if let Some(h) = hukommelse {
        h.insert(navn.to_vec(), svar);
    }
    svar
}

fn finn_nærmeste(navn: &[u16], kandidater: &[&'static str]) -> Option<(&'static str, bool)> {
    let ønsket = normalisert(navn);
    if let Some(samme) = kandidater.iter().find(|k| normalisert(&u(k)) == ønsket) {
        return Some((samme, true));
    }
    let lav = liten(navn);
    let maks = if navn.len() >= 8 { 2 } else { 1 };
    let mut best: Option<(&'static str, Tekst)> = None;
    let mut best_avstand = maks + 1;
    for &kandidat in kandidater {
        let k = u(kandidat);
        if k.len().abs_diff(lav.len()) > maks {
            continue;
        }
        let d = avstand(&lav, &k);
        let bedre = d < best_avstand
            || (d == best_avstand
                && best.as_ref().is_some_and(|(_, b)| {
                    felles_begynnelse(&lav, &k) > felles_begynnelse(&lav, b)
                }));
        if bedre {
            best_avstand = d;
            best = Some((kandidat, k));
        }
    }
    best.map(|(navn, _)| (navn, false))
}

/// `[\s\S]*?` til det første treffet av `slutt`, eller til slutten av teksten.
fn blank_fra(ut: &mut [u16], fra: usize, til: usize) {
    blank(&mut ut[fra..til]);
}

/// `<script\b` og `<style\b`: navnet uten hensyn til store bokstaver, og
/// ikke et ordtegn etter.
fn åpner(t: &[u16], i: usize, navn: &str) -> bool {
    har_ved(t, i, "<")
        && har_ved_ci(t, i + 1, navn)
        && t.get(i + 1 + navn.len()).is_none_or(|&c| !er_ordtegn(c))
}

/// Den første `</navn\s*>` fra `fra`, med indeksen der den slutter.
fn lukker(t: &[u16], fra: usize, navn: &str) -> Option<(usize, usize)> {
    let mut i = fra;
    while i < t.len() {
        if t[i] == LT && har_ved(t, i + 1, "/") && har_ved_ci(t, i + 2, navn) {
            let mut j = i + 2 + navn.len();
            while j < t.len() && er_mellomrom(t[j]) {
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

/// Teksten uten kommentarer, skript og stilark, med samme lengde.
pub fn uten_skjult(tekst: &[u16]) -> Tekst {
    let mut ut = tekst.to_vec();
    // Kommentarene først, så skriptene og stilarkene i det som er igjen, som
    // de tre `replace`-kallene i TypeScript.
    let mut i = 0;
    while let Some(start) = finn(&ut, i, "<!--") {
        let slutt = finn(&ut, start + 4, "-->").map_or(ut.len(), |e| e + 3);
        blank_fra(&mut ut, start, slutt);
        i = slutt.max(start + 1);
    }
    for navn in ["script", "style"] {
        let mut i = 0;
        while i < ut.len() {
            if åpner(&ut, i, navn) {
                let slutt = lukker(&ut, i + 1 + navn.len(), navn).map_or(ut.len(), |(_, e)| e);
                blank_fra(&mut ut, i, slutt);
                i = slutt.max(i + 1);
            } else {
                i += 1;
            }
        }
    }
    ut
}

/// Der taggen som begynner på `fra` slutter: indeksen til `>`.
pub fn tagg_slutt(t: &[u16], fra: usize) -> Option<usize> {
    let mut sitat: Option<u16> = None;
    let mut i = fra;
    while i < t.len() {
        let c = t[i];
        if let Some(q) = sitat {
            if c == q {
                sitat = None;
            }
            i += 1;
            continue;
        }
        if c == DOBBEL || c == ENKEL {
            sitat = Some(c);
        } else if c == LT && (har_ved(t, i + 1, "?") || har_ved(t, i + 1, "%")) {
            let lukk = [t[i + 1], GT];
            let funnet = (i + 2..t.len().saturating_sub(1)).find(|&k| t[k..k + 2] == lukk)?;
            i = funnet + 1;
        } else if c == GT {
            return Some(i);
        }
        i += 1;
    }
    None
}

#[derive(Clone, Debug)]
pub struct LestAttributt {
    pub navn: Tekst,
    pub verdi: Option<Tekst>,
    pub start: usize,
    /// Der navnet slutter.
    pub slutt: usize,
    /// Der hele attributtet slutter, med verdi og anførselstegn.
    pub verdi_slutt: usize,
    /// Der mellomrommet foran attributtet begynner.
    pub mellomrom_start: usize,
    /// Der selve verdien står, uten anførselstegn.
    pub verdi_start: usize,
}

impl LestAttributt {
    pub fn verdi_ikke_tom(&self) -> Option<&Tekst> {
        self.verdi.as_ref().filter(|v| !v.is_empty())
    }
}

/// Attributtene i en tagg, lest fra teksten mellom navnet og `>`.
pub fn les_attributter(body: &[u16], offset: usize) -> Vec<LestAttributt> {
    let mut ut = Vec::new();
    let mut i = 0;
    let hopp = |i: &mut usize| {
        while *i < body.len() && er_mellomrom(body[*i]) {
            *i += 1;
        }
    };
    while i < body.len() {
        let mellomrom_start = i;
        hopp(&mut i);
        let navn_start = i;
        while i < body.len()
            && !er_mellomrom(body[i])
            && !matches!(body[i], DOBBEL | ENKEL | LIK | LT | GT | SKRÅSTREK)
        {
            i += 1;
        }
        if i == navn_start {
            i += 1;
            continue;
        }
        let navn = &body[navn_start..i];
        let mut verdi: Option<Tekst> = None;
        let mut verdi_start = i;
        let etter_navn = i;
        hopp(&mut i);
        if i < body.len() && body[i] == LIK {
            i += 1;
            hopp(&mut i);
            let åpne = body.get(i).copied();
            if åpne == Some(DOBBEL) || åpne == Some(ENKEL) {
                let lukk = finn_tegn(body, i + 1, åpne.unwrap());
                verdi_start = i + 1;
                let til = lukk.unwrap_or(body.len());
                verdi = Some(body[verdi_start.min(til)..til].to_vec());
                i = lukk.map_or(body.len(), |l| l + 1);
            } else if åpne == Some(b'{' as u16) {
                verdi_start = i;
                i = klammer_slutt(body, i);
                verdi = Some(body[verdi_start..i].to_vec());
            } else {
                verdi_start = i;
                while i < body.len()
                    && !er_mellomrom(body[i])
                    && !matches!(body[i], DOBBEL | ENKEL | LIK | LT | GT | BAKOVER)
                {
                    i += 1;
                }
                verdi = Some(body[verdi_start..i].to_vec());
            }
        } else {
            i = etter_navn;
        }
        let har_verdi = verdi.is_some();
        ut.push(LestAttributt {
            navn: liten(navn),
            verdi,
            start: offset + navn_start,
            slutt: offset + navn_start + navn.len(),
            verdi_slutt: offset + if har_verdi { i } else { etter_navn },
            mellomrom_start: offset + mellomrom_start,
            verdi_start: offset + if har_verdi { verdi_start } else { etter_navn },
        });
    }
    ut
}

fn klammer_slutt(t: &[u16], fra: usize) -> usize {
    let mut dybde = 0i32;
    let mut sitat: Option<u16> = None;
    for (i, &c) in t.iter().enumerate().skip(fra) {
        if let Some(q) = sitat {
            if c == q {
                sitat = None;
            }
            continue;
        }
        if c == DOBBEL || c == ENKEL || c == BAKOVER {
            sitat = Some(c);
        } else if c == b'{' as u16 {
            dybde += 1;
        } else if c == b'}' as u16 {
            dybde -= 1;
            if dybde == 0 {
                return i + 1;
            }
        }
    }
    t.len()
}

fn liste(navn: impl IntoIterator<Item = &'static str>) -> String {
    navn.into_iter().collect::<Vec<_>>().join(", ")
}

/// `Number(verdi)` i JavaScript, og tomt er ikke et tall.
fn er_tall(verdi: &[u16]) -> bool {
    let t = trimmet(verdi);
    if t.is_empty() || t.iter().any(|&c| c >= 0x80) {
        return false;
    }
    let s: String = t.iter().map(|&c| c as u8 as char).collect();
    let b = s.as_bytes();
    // Heksadesimalt, oktalt og binært, uten fortegn.
    if b.len() > 2 && b[0] == b'0' {
        let siffer = &s[2..];
        let gyldig = match b[1] {
            b'x' | b'X' => siffer.bytes().all(|c| c.is_ascii_hexdigit()),
            b'o' | b'O' => siffer.bytes().all(|c| (b'0'..=b'7').contains(&c)),
            b'b' | b'B' => siffer.bytes().all(|c| c == b'0' || c == b'1'),
            _ => return desimalt(&s),
        };
        return gyldig;
    }
    desimalt(&s)
}

/// StrDecimalLiteral: fortegn, `Infinity`, sifre med punktum og eksponent.
fn desimalt(s: &str) -> bool {
    let s = s.strip_prefix(['+', '-']).unwrap_or(s);
    if s == "Infinity" {
        return true;
    }
    let (mantisse, eksponent) = match s.find(['e', 'E']) {
        Some(i) => (&s[..i], Some(&s[i + 1..])),
        None => (s, None),
    };
    let (heltall, brøk) = match mantisse.find('.') {
        Some(i) => (&mantisse[..i], &mantisse[i + 1..]),
        None => (mantisse, ""),
    };
    let sifre = |x: &str| x.bytes().all(|c| c.is_ascii_digit());
    if !sifre(heltall) || !sifre(brøk) || (heltall.is_empty() && brøk.is_empty()) {
        return false;
    }
    match eksponent {
        None => true,
        Some(e) => {
            let e = e.strip_prefix(['+', '-']).unwrap_or(e);
            !e.is_empty() && sifre(e)
        }
    }
}

fn finn_attributt<'a>(element: &'a Element, navn: &[u16]) -> Option<&'a Attributt> {
    element
        .attributter
        .iter()
        .find(|(n, _)| lik(navn, n))
        .map(|(_, a)| a)
}

fn sjekk_attributt(
    tagg: &str,
    element: &Element,
    a: &LestAttributt,
    tagg_med_mal: bool,
) -> Option<Funn> {
    let navn = s(&a.navn);
    let funn = |alvor, melding: String, rettelse| Funn {
        start: a.start,
        slutt: a.slutt,
        alvor,
        lenke: element.lenke.to_string(),
        melding,
        rettelse,
    };
    let Some(kjent) = finn_attributt(element, &a.navn) else {
        let normalt = normalisert(&a.navn);
        if let Some((ment, _)) = element
            .attributter
            .iter()
            .find(|(k, _)| normalisert(&u(k)) == normalt)
        {
            return Some(funn(
                Alvor::Advarsel,
                format!("<{tagg}> har ikke attributtet «{navn}». Mente du {ment}?"),
                Some(Rettelse {
                    tittel: format!("Bytt til {ment}"),
                    start: a.start,
                    slutt: a.slutt,
                    tekst: ment.to_string(),
                    foretrukket: true,
                }),
            ));
        }
        if tagg_med_mal || er_global(&a.navn) {
            return None;
        }
        return Some(funn(
            Alvor::Advarsel,
            format!(
                "<{tagg}> har ikke attributtet «{navn}», og komponenten leser det ikke. Attributtene er {}.",
                liste(element.attributter.iter().map(|(n, _)| *n))
            ),
            None,
        ));
    };
    if a.verdi.as_deref().is_some_and(er_mal_verdi) {
        return None;
    }
    match kjent {
        Attributt::Flagg => {
            let verdi = a.verdi.as_deref()?;
            if navn == "hidden" && lik(verdi, "until-found") {
                return None;
            }
            if !verdi.is_empty() && liten(verdi) != a.navn {
                let v = s(verdi);
                return Some(funn(
                    Alvor::Advarsel,
                    format!(
                        "{navn} er et boolsk attributt: det står der eller ikke. {navn}=\"{v}\" betyr det samme som {navn}. Ta det bort for å slå det av."
                    ),
                    Some(Rettelse {
                        tittel: format!("Ta bort {navn}"),
                        start: a.mellomrom_start,
                        slutt: a.verdi_slutt,
                        tekst: String::new(),
                        foretrukket: true,
                    }),
                ));
            }
            None
        }
        Attributt::Verdier(verdier) => {
            let gyldig = a
                .verdi
                .as_deref()
                .is_some_and(|v| verdier.iter().any(|k| lik(v, k)));
            if gyldig {
                return None;
            }
            let v = a.verdi.as_deref().map(s).unwrap_or_default();
            Some(funn(
                Alvor::Feil,
                format!(
                    "{navn} kan ikke være «{v}». Lovlige verdier: {}.",
                    liste(verdier.iter().copied())
                ),
                None,
            ))
        }
        Attributt::Tall => match a.verdi.as_deref() {
            Some(v) if !er_tall(v) => Some(funn(
                Alvor::Feil,
                format!("{navn} skal være et tall, ikke «{}».", s(v)),
                None,
            )),
            _ => None,
        },
        Attributt::Tekst => None,
    }
}

/// `/<(input|textarea|select)(?=[\s/>])/gi`, og den første kontrollen som
/// ikke er `type="hidden"`.
fn finn_kontroll(innhold: &[u16]) -> Option<Vec<LestAttributt>> {
    let mut i = 0;
    while i < innhold.len() {
        if innhold[i] != LT {
            i += 1;
            continue;
        }
        let treff = ["input", "textarea", "select"].into_iter().find(|navn| {
            har_ved_ci(innhold, i + 1, navn) && følges_av_slutt(innhold, i + 1 + navn.len())
        });
        let Some(navn) = treff else {
            i += 1;
            continue;
        };
        let fra = i + 1 + navn.len();
        i = fra;
        let Some(til) = tagg_slutt(innhold, fra) else {
            continue;
        };
        let attributter = les_attributter(&innhold[fra..til], 0);
        let type_ = attributter
            .iter()
            .find(|a| lik(&a.navn, "type"))
            .and_then(|a| a.verdi.as_deref());
        if navn == "input" && type_.is_some_and(|t| liten(t) == u("hidden")) {
            continue;
        }
        return Some(attributter);
    }
    None
}

/// `(?=[\s/>])`
pub fn følges_av_slutt(t: &[u16], i: usize) -> bool {
    t.get(i)
        .is_some_and(|&c| er_mellomrom(c) || c == SKRÅSTREK || c == GT)
}

/// Verdiene i hver `<label for>` i dokumentet, som
/// `/<label\b[^>]*?\sfor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi`.
fn ledetekst_mål(t: &[u16]) -> Vec<Tekst> {
    let mut ut = Vec::new();
    let mut i = 0;
    'ytre: while i < t.len() {
        let start_ok = t[i] == LT
            && har_ved_ci(t, i + 1, "label")
            && t.get(i + 6).is_none_or(|&c| !er_ordtegn(c));
        if !start_ok {
            i += 1;
            continue;
        }
        let mut p = i + 6;
        loop {
            if let Some((verdi, slutt)) = for_ved(t, p) {
                ut.push(verdi);
                i = slutt;
                continue 'ytre;
            }
            if p >= t.len() || t[p] == GT {
                break;
            }
            p += 1;
        }
        i += 1;
    }
    ut
}

/// `\sfor\s*=\s*(verdi)` ved `p`: verdien og der treffet slutter.
fn for_ved(t: &[u16], p: usize) -> Option<(Tekst, usize)> {
    if !t.get(p).is_some_and(|&c| er_mellomrom(c)) || !har_ved_ci(t, p + 1, "for") {
        return None;
    }
    let mut j = p + 4;
    while j < t.len() && er_mellomrom(t[j]) {
        j += 1;
    }
    if t.get(j) != Some(&LIK) {
        return None;
    }
    j += 1;
    while j < t.len() && er_mellomrom(t[j]) {
        j += 1;
    }
    let c = *t.get(j)?;
    if c == DOBBEL || c == ENKEL {
        if let Some(lukk) = finn_tegn(t, j + 1, c) {
            return Some((t[j + 1..lukk].to_vec(), lukk + 1));
        }
        return None;
    }
    let fra = j;
    while j < t.len()
        && !er_mellomrom(t[j])
        && !matches!(t[j], DOBBEL | ENKEL | LIK | LT | GT | BAKOVER)
    {
        j += 1;
    }
    (j > fra).then(|| (t[fra..j].to_vec(), j))
}

/// `/<navn(?=[\s/>])/i`
fn har_tagg(t: &[u16], navn: &str) -> bool {
    (0..t.len()).any(|i| {
        t[i] == LT && har_ved_ci(t, i + 1, navn) && følges_av_slutt(t, i + 1 + navn.len())
    })
}

#[allow(clippy::too_many_arguments)]
fn sjekk_felt(
    ledetekster: &[Tekst],
    tagg: &str,
    navn_start: usize,
    navn_slutt: usize,
    innhold: &[u16],
    innhold_start: usize,
    attributter: &[LestAttributt],
    lenke: &str,
) -> Vec<Funn> {
    let har_element = (0..innhold.len())
        .any(|i| innhold[i] == LT && innhold.get(i + 1).is_some_and(|&c| er_ascii_bokstav(c)));
    if !har_element || er_mal_innhold(innhold) {
        return vec![];
    }
    let funn = |melding: String, rettelse| Funn {
        start: navn_start,
        slutt: navn_slutt,
        alvor: Alvor::Advarsel,
        lenke: lenke.to_string(),
        melding,
        rettelse,
    };
    let innrykk = innhold.iter().take_while(|&&c| er_mellomrom(c)).count();
    let Some(kontroll) = finn_kontroll(innhold) else {
        return vec![funn(
            format!(
                "<{tagg}> fant ingen kontroll å koble til. Ledeteksten, hjelpeteksten og feilmeldingen står uten et felt, og koblingen kan ikke lages. Sett inn et <input>, <textarea> eller <select>."
            ),
            None,
        )];
    };
    if har_tagg(innhold, "label") {
        return vec![];
    }
    let har = |navn: &str| kontroll.iter().find(|a| lik(&a.navn, navn));
    if har("aria-label").is_some() || har("aria-labelledby").is_some() {
        return vec![];
    }
    let ider = [
        attributter
            .iter()
            .find(|a| lik(&a.navn, "control-id"))
            .and_then(|a| a.verdi.clone()),
        har("id").and_then(|a| a.verdi.clone()),
    ];
    if ider
        .iter()
        .flatten()
        .any(|id| !id.is_empty() && ledetekster.contains(id))
    {
        return vec![];
    }
    let ledende = &innhold[..innrykk];
    let ny_linje = ledende.contains(&(b'\n' as u16));
    vec![funn(
        format!(
            "<{tagg}> fant ingen <label>. Feltet får da ingen ledetekst, og en skjermleser leser det opp uten navn."
        ),
        Some(Rettelse {
            tittel: "Sett inn en ledetekst".into(),
            start: innhold_start + innrykk,
            slutt: innhold_start + innrykk,
            tekst: format!("<label>Ledetekst</label>{}", if ny_linje { s(ledende) } else { String::new() }),
            foretrukket: true,
        }),
    )]
}

fn sjekk_tidsavbrudd(
    tagg: &str,
    navn_start: usize,
    navn_slutt: usize,
    innhold: &[u16],
    lenke: &str,
) -> Vec<Funn> {
    if er_mal_innhold(innhold) || har_tagg(innhold, "dialog") {
        return vec![];
    }
    vec![Funn {
        start: navn_start,
        slutt: navn_slutt,
        alvor: Alvor::Advarsel,
        lenke: lenke.to_string(),
        melding: format!(
            "<{tagg}> fant ingen <dialog>. Varselet kan ikke vises, og økten går ut uten advarsel."
        ),
        rettelse: None,
    }]
}

fn finn_klasse(navn: &[u16]) -> Option<&'static Klasse> {
    KLASSER.iter().find(|k| lik(navn, k.navn))
}

fn sjekk_klasser(attributter: &[LestAttributt], hukommelse: &mut Hukommelse) -> Vec<Funn> {
    let mut funn = Vec::new();
    let Some(klasse) = attributter.iter().find(|a| lik(&a.navn, "class")) else {
        return funn;
    };
    let Some(verdi) = klasse.verdi_ikke_tom() else {
        return funn;
    };
    if er_mal_verdi(verdi) {
        return funn;
    }
    let navn: Vec<&'static str> = KLASSER.iter().map(|k| k.navn).collect();
    let mut til_stede: Vec<&'static Klasse> = Vec::new();
    for (posisjon, token) in ord(verdi) {
        let start = klasse.verdi_start + posisjon;
        if !har_ved(token, 0, "fs-") || token.iter().any(|&c| c == b'{' as u16 || c == b'}' as u16)
        {
            continue;
        }
        if let Some(info) = finn_klasse(token) {
            til_stede.push(info);
            continue;
        }
        let ment = nærmeste(token, &navn, Some(hukommelse));
        let t = s(token);
        funn.push(Funn {
            start,
            slutt: start + token.len(),
            alvor: Alvor::Advarsel,
            lenke: ment.map_or(DOCS.to_string(), |(m, _)| {
                finn_klasse(&u(m)).unwrap().lenke.to_string()
            }),
            melding: match ment {
                Some((m, _)) => format!("Klassen «{t}» finnes ikke i Fristil. Mente du {m}?"),
                None => format!("Klassen «{t}» finnes ikke i Fristil."),
            },
            rettelse: ment.map(|(m, sikker)| Rettelse {
                tittel: format!("Bytt til {m}"),
                start,
                slutt: start + token.len(),
                tekst: m.to_string(),
                foretrukket: sikker,
            }),
        });
    }
    for a in attributter {
        let Some(verdi) = a.verdi_ikke_tom() else {
            continue;
        };
        if er_mal_verdi(verdi) {
            continue;
        }
        for info in &til_stede {
            let Some((_, tar)) = info.attributter.iter().find(|(n, _)| lik(&a.navn, n)) else {
                continue;
            };
            if tar.verdier.iter().any(|v| lik(verdi, v))
                || tar.standard.is_some_and(|d| lik(verdi, d))
            {
                continue;
            }
            let mut kandidater: Vec<&'static str> = tar.verdier.to_vec();
            kandidater.extend(tar.standard);
            let ment = nærmeste(verdi, &kandidater, None);
            let vist = vis_med_ett_mellomrom(verdi);
            let navn = s(&a.navn);
            let slutt = match tar.standard {
                Some(d) => format!(", og {d} uten attributt."),
                None => ".".into(),
            };
            funn.push(Funn {
                start: a.start,
                slutt: a.verdi_slutt,
                alvor: Alvor::Advarsel,
                lenke: info.lenke.to_string(),
                melding: format!(
                    "{navn} kan ikke være «{vist}» på {}. Lovlige verdier: {}{slutt}",
                    s(&liten(&u(info.tittel))),
                    liste(tar.verdier.iter().copied())
                ),
                rettelse: ment.map(|(m, sikker)| Rettelse {
                    tittel: format!("Bytt til {m}"),
                    start: a.verdi_start,
                    slutt: a.verdi_start + verdi.len(),
                    tekst: m.to_string(),
                    foretrukket: sikker,
                }),
            });
            break;
        }
    }
    funn
}

/// `value.replace(/\s+/g, " ")`
fn vis_med_ett_mellomrom(t: &[u16]) -> String {
    let mut ut = Vec::with_capacity(t.len());
    let mut i = 0;
    while i < t.len() {
        if er_mellomrom(t[i]) {
            while i < t.len() && er_mellomrom(t[i]) {
                i += 1;
            }
            ut.push(b' ' as u16);
        } else {
            ut.push(t[i]);
            i += 1;
        }
    }
    s(&ut)
}

/// `/<([a-z][a-z0-9-]*)(?=[\s/>])/gi` ved `i`: der navnet slutter.
pub fn tagg_navn(t: &[u16], i: usize) -> Option<usize> {
    if t.get(i) != Some(&LT) || !t.get(i + 1).is_some_and(|&c| er_ascii_bokstav(c)) {
        return None;
    }
    let mut j = i + 2;
    while j < t.len() && er_navnetegn(t[j]) {
        j += 1;
    }
    følges_av_slutt(t, j).then_some(j)
}

/// Kroppen til en tagg, uten én `/` til slutt.
fn kropp(t: &[u16], fra: usize, til: usize) -> &[u16] {
    let b = &t[fra..til];
    b.strip_suffix(&[SKRÅSTREK]).unwrap_or(b)
}

/// `/\bclass\s*=/i`
fn har_class(b: &[u16]) -> bool {
    (0..b.len()).any(|i| {
        har_ved_ci(b, i, "class") && (i == 0 || !er_ordtegn(b[i - 1])) && {
            let mut j = i + 5;
            while j < b.len() && er_mellomrom(b[j]) {
                j += 1;
            }
            b.get(j) == Some(&LIK)
        }
    })
}

/// `/<\/navn\b/gi` fra `fra`.
fn lukketagg(t: &[u16], fra: usize, navn: &str) -> Option<usize> {
    (fra..t.len()).find(|&i| {
        t[i] == LT
            && har_ved(t, i + 1, "/")
            && har_ved_ci(t, i + 2, navn)
            && t.get(i + 2 + navn.len()).is_none_or(|&c| !er_ordtegn(c))
    })
}

/// Alle funn i teksten, i den rekkefølgen de står.
pub fn diagnose(tekst: &[u16]) -> Vec<Funn> {
    let kilde = uten_skjult(tekst);
    let mut funn = Vec::new();
    let mut ledetekster: Option<Vec<Tekst>> = None;
    let mut hukommelse = Hukommelse::new();

    // Klassene, på alle tagger.
    let mut i = 0;
    while i < kilde.len() {
        let Some(navn_slutt) = tagg_navn(&kilde, i) else {
            i += 1;
            continue;
        };
        i = navn_slutt;
        let Some(slutt) = tagg_slutt(&kilde, navn_slutt) else {
            continue;
        };
        let b = kropp(&kilde, navn_slutt, slutt);
        if !har_class(b) {
            continue;
        }
        funn.extend(sjekk_klasser(
            &les_attributter(b, navn_slutt),
            &mut hukommelse,
        ));
    }

    let mut i = 0;
    while i < kilde.len() {
        let er_fs = kilde[i] == LT && har_ved_ci(&kilde, i + 1, "fs-");
        if !er_fs {
            i += 1;
            continue;
        }
        let mut j = i + 4;
        while j < kilde.len() && er_navnetegn(kilde[j]) {
            j += 1;
        }
        if !følges_av_slutt(&kilde, j) {
            i += 1;
            continue;
        }
        let navn_start = i + 1;
        let navn_slutt = j;
        i = j;
        let tagg = s(&liten(&kilde[navn_start..navn_slutt]));
        let Some(element) = ELEMENTER.iter().find(|e| e.tagg == tagg) else {
            funn.push(Funn {
                start: navn_start,
                slutt: navn_slutt,
                alvor: Alvor::Feil,
                lenke: DOCS.into(),
                melding: format!(
                    "<{tagg}> finnes ikke i Fristil. Elementene er {}.",
                    liste(ELEMENTER.iter().map(|e| e.tagg))
                ),
                rettelse: None,
            });
            continue;
        };
        let Some(slutt) = tagg_slutt(&kilde, navn_slutt) else {
            continue;
        };
        let b = kropp(&kilde, navn_slutt, slutt);
        let tagg_med_mal = er_mal(b);
        let attributter = les_attributter(b, navn_slutt);
        for a in &attributter {
            funn.extend(sjekk_attributt(&tagg, element, a, tagg_med_mal));
        }

        if tagg == "fs-session-timeout" {
            if let Some(lukk) = lukketagg(&kilde, slutt, "fs-session-timeout") {
                funn.extend(sjekk_tidsavbrudd(
                    &tagg,
                    navn_start,
                    navn_slutt,
                    &kilde[slutt + 1..lukk.max(slutt + 1)],
                    element.lenke,
                ));
            }
        }

        if tagg == "fs-field" {
            let lukk = lukketagg(&kilde, slutt, "fs-field").unwrap_or(kilde.len());
            let innhold = &kilde[(slutt + 1).min(lukk.max(slutt + 1))..lukk.max(slutt + 1)];
            let ledetekster = ledetekster.get_or_insert_with(|| ledetekst_mål(&kilde));
            funn.extend(sjekk_felt(
                ledetekster,
                &tagg,
                navn_start,
                navn_slutt,
                innhold,
                slutt + 1,
                &attributter,
                element.lenke,
            ));
        }
    }
    funn.sort_by_key(|f| f.start);
    funn
}

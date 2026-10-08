//! Fargekontrakten: hva hver rolle er, og hva den lover.
//!
//! Ett fargelag, ikke to. En farge er et punkt i en matrise av **familie**
//! (hva den betyr) og **rolle** (hva den gjør), og hver familie har de samme
//! rollene. Det er strukturen som gjør at familiene matcher.
//!
//! Kuløren er konsumentens, lysheten er rollens. Da er kontrasten garantert av
//! konstruksjonen framfor av en sjekk i etterkant.
//!
//! Tallene står i `designsystem/src/tokens/fargekontrakt.json`, ikke her, så
//! skriptene i TypeScript og kjernen leser de samme. Tre valg i dem som ikke
//! er åpenbare:
//!
//! - `fill` styres av at `content` skal kunne leses oppå den, ikke av
//!   avstanden til siden. Velges den etter siden alene, blir den for lys til å
//!   bære tekst.
//! - Tekst og kant har tre trinn hver. Brødtekst skal ikke ligge på
//!   minstekravet: satt til `text` ble den `#4a4d51` framfor `#1a1a1a`, og det
//!   er et ekte tap i lesbarhet selv om kravet holdt.
//! - `textStrong` har lav metning, siden en sterk tekstfarge nesten er sort
//!   eller hvit uansett kulør.
//!
//! Lyshetene er regnet fram mot et sveip rundt hele fargesirkelen, på høyeste
//! metning sRGB kan vise for hver kulør. Endrer du et av tallene, er løftene
//! det som sier fra.
//!
//! `borderSubtle` står uten løfte med vilje: en dekorativ skillelinje er ikke
//! nødvendig for å forstå siden, og WCAG 1.4.11 gjelder den ikke. Trenger
//! kanten å bety noe, er `border` den riktige.

use std::sync::OnceLock;

use super::color::{contrast_ratio, oklch_to_rgb, parse_hex, rgb_to_oklch, to_hex, Oklch};
use crate::json::{parse, Json};

/// Lyst eller mørkt. Et tema er det ene eller det andre, aldri begge.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Appearance {
    Light,
    Dark,
}

impl Appearance {
    pub fn key(self) -> &'static str {
        match self {
            Appearance::Light => "light",
            Appearance::Dark => "dark",
        }
    }
}

/// Lyshet i hvert utseende, og metningen som andel av merkefargens.
#[derive(Clone, Debug)]
pub struct Spec {
    pub light: f64,
    pub dark: f64,
    pub chroma: f64,
}

impl Spec {
    pub fn lightness(&self, appearance: Appearance) -> f64 {
        match appearance {
            Appearance::Light => self.light,
            Appearance::Dark => self.dark,
        }
    }
}

/// Et løfte: forgrunnen holder kravet mot bakgrunnen.
#[derive(Clone, Debug)]
pub struct Promise {
    pub name: String,
    pub foreground: String,
    pub background: String,
    /// Bakgrunnen er familiens egen rolle, ikke laget i den nøytrale familien.
    pub own: bool,
    pub required: f64,
}

#[derive(Clone, Debug)]
pub struct Contract {
    pub families: Vec<String>,
    /// Fristils egne merkefarger, i rekkefølgen familiene står.
    pub brands: Vec<(String, String)>,
    /// Rollene, i den rekkefølgen tokenene skrives.
    pub roles: Vec<(String, Spec)>,
    pub canvas: Spec,
    pub raised: Spec,
    /// Kontrastkravene, med margin over WCAG: tekst og grafikk.
    pub text_requirement: f64,
    pub graphic_requirement: f64,
    pub promises: Vec<Promise>,
}

const SOURCE: &str = include_str!("../../../designsystem/src/tokens/fargekontrakt.json");

/// Kontrakten, lest én gang.
pub fn contract() -> &'static Contract {
    static CONTRACT: OnceLock<Contract> = OnceLock::new();
    CONTRACT.get_or_init(|| read(SOURCE).expect("fargekontrakt.json skal alltid kunne leses"))
}

fn spec(value: &Json) -> Option<Spec> {
    let lightness = value.get("lightness")?;
    Some(Spec {
        light: lightness.get("light")?.as_f64()?,
        dark: lightness.get("dark")?.as_f64()?,
        chroma: value.get("chroma")?.as_f64()?,
    })
}

fn read(source: &str) -> Result<Contract, String> {
    let root = parse(source)?;
    let wrong = |what: &str| format!("fargekontrakt.json: {what}");
    let texts = |value: Option<&Json>| -> Option<Vec<String>> {
        value?
            .as_array()?
            .iter()
            .map(|v| v.as_str().map(str::to_string))
            .collect()
    };
    let requirements = root
        .get("requirements")
        .ok_or_else(|| wrong("requirements mangler"))?;
    Ok(Contract {
        families: texts(root.get("families")).ok_or_else(|| wrong("families"))?,
        brands: root
            .get("brands")
            .and_then(Json::as_object)
            .ok_or_else(|| wrong("brands"))?
            .iter()
            .map(|(k, v)| Some((k.clone(), v.as_str()?.to_string())))
            .collect::<Option<_>>()
            .ok_or_else(|| wrong("brands"))?,
        roles: root
            .get("roles")
            .and_then(Json::as_object)
            .ok_or_else(|| wrong("roles"))?
            .iter()
            .map(|(k, v)| Some((k.clone(), spec(v)?)))
            .collect::<Option<_>>()
            .ok_or_else(|| wrong("roles"))?,
        canvas: root
            .get("layers")
            .and_then(|l| spec(l.get("canvas")?))
            .ok_or_else(|| wrong("layers.canvas"))?,
        raised: root
            .get("layers")
            .and_then(|l| spec(l.get("raised")?))
            .ok_or_else(|| wrong("layers.raised"))?,
        text_requirement: requirements
            .get("text")
            .and_then(Json::as_f64)
            .ok_or_else(|| wrong("requirements.text"))?,
        graphic_requirement: requirements
            .get("graphic")
            .and_then(Json::as_f64)
            .ok_or_else(|| wrong("requirements.graphic"))?,
        promises: root
            .get("promises")
            .and_then(Json::as_array)
            .ok_or_else(|| wrong("promises"))?
            .iter()
            .map(|p| {
                Some(Promise {
                    name: p.get("name")?.as_str()?.to_string(),
                    foreground: p.get("foreground")?.as_str()?.to_string(),
                    background: p.get("background")?.as_str()?.to_string(),
                    own: matches!(p.get("own"), Some(Json::Bool(true))),
                    required: requirements
                        .get(p.get("requirement")?.as_str()?)?
                        .as_f64()?,
                })
            })
            .collect::<Option<_>>()
            .ok_or_else(|| wrong("promises"))?,
    })
}

/// En familie: rollenavn til heksfarge, i rollenes rekkefølge.
pub type Family = Vec<(String, String)>;

pub fn role<'a>(family: &'a Family, name: &str) -> Option<&'a str> {
    family
        .iter()
        .find(|(r, _)| r == name)
        .map(|(_, v)| v.as_str())
}

/// Rollenavnet slik det skrives i CSS. `textSubtle` blir `text-subtle`.
pub fn role_to_css(role: &str) -> String {
    let mut out = String::with_capacity(role.len() + 2);
    for c in role.chars() {
        if c.is_ascii_uppercase() {
            out.push('-');
            out.push(c.to_ascii_lowercase());
        } else {
            out.push(c);
        }
    }
    out
}

/// Bygger én familie fra én merkefarge.
pub fn build_family(brand: &str, appearance: Appearance) -> Result<Family, String> {
    let Oklch { c, h, .. } = rgb_to_oklch(parse_hex(brand)?);
    Ok(contract()
        .roles
        .iter()
        .map(|(name, spec)| {
            let color = oklch_to_rgb(Oklch {
                l: spec.lightness(appearance),
                c: c * spec.chroma,
                h,
            });
            (name.clone(), to_hex(color))
        })
        .collect())
}

/// Siden, kortet og den hevede flaten, som bare den nøytrale familien har.
#[derive(Clone, Debug)]
pub struct Layers {
    pub canvas: String,
    pub surface: String,
    pub raised: String,
}

impl Layers {
    fn get(&self, name: &str) -> Option<&str> {
        match name {
            "canvas" => Some(&self.canvas),
            "surface" => Some(&self.surface),
            "raised" => Some(&self.raised),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Violation {
    pub family: String,
    pub promise: String,
    pub ratio: f64,
    pub required: f64,
}

/// Hvert løfte for én familie: navnet, forholdet og kravet.
pub fn promises_for(family: &Family, layers: &Layers) -> Result<Vec<(String, f64, f64)>, String> {
    let ratio = |a: &str, b: &str| -> Result<f64, String> {
        Ok(contrast_ratio(parse_hex(a)?, parse_hex(b)?))
    };
    contract()
        .promises
        .iter()
        .map(|p| {
            let foreground = role(family, &p.foreground).unwrap_or_default();
            let background = if p.own {
                role(family, &p.background)
            } else {
                layers.get(&p.background)
            }
            .unwrap_or_default();
            Ok((p.name.clone(), ratio(foreground, background)?, p.required))
        })
        .collect()
}

/// Alle løfter i alle familier, med dem som ikke holder.
pub fn check_promises(
    families: &[(String, Family)],
    layers: &Layers,
) -> Result<Vec<Violation>, String> {
    let mut violations = Vec::new();
    for (name, family) in families {
        for (promise, ratio, required) in promises_for(family, layers)? {
            if ratio < required {
                violations.push(Violation {
                    family: name.clone(),
                    promise,
                    ratio,
                    required,
                });
            }
        }
    }
    Ok(violations)
}

/// Tokennavnet for én celle i matrisen.
pub fn token_name(family: &str, role: &str) -> String {
    format!("--fs-color-{family}-{role}")
}

pub struct Matrix {
    /// Tokennavn til heksverdi, for ett utseende.
    pub tokens: Vec<(String, String)>,
    /// Løfter som ikke holder. Tom når matrisen er i orden.
    pub violations: Vec<Violation>,
}

/// Bygger hele matrisen for ett utseende.
///
/// `neutral` får `canvas` og `raised` i tillegg til rollene sine. De hører bare
/// dit: en rød side er ikke en tilstand systemet har.
pub fn build_matrix(brands: &[(String, String)], appearance: Appearance) -> Result<Matrix, String> {
    let Some((_, neutral)) = brands.iter().find(|(n, _)| n == "neutral") else {
        return Err("Matrisen trenger en nøytral familie. Den bærer siden, teksten og kantene, og de andre familiene måles mot den.".into());
    };
    let families = brands
        .iter()
        .map(|(name, brand)| Ok((name.clone(), build_family(brand, appearance)?)))
        .collect::<Result<Vec<_>, String>>()?;

    // Lagene regnes av den nøytrale kuløren, med enda mindre metning enn
    // flatene: en side med kulør i seg ser malt ut, ikke nøytral.
    let Oklch { c, h, .. } = rgb_to_oklch(parse_hex(neutral)?);
    let layer = |spec: &Spec| {
        to_hex(oklch_to_rgb(Oklch {
            l: spec.lightness(appearance),
            c: c * spec.chroma,
            h,
        }))
    };
    let neutral_family = &families.iter().find(|(n, _)| n == "neutral").unwrap().1;
    let layers = Layers {
        canvas: layer(&contract().canvas),
        surface: role(neutral_family, "surface")
            .unwrap_or_default()
            .to_string(),
        raised: layer(&contract().raised),
    };

    let mut tokens = Vec::new();
    for (name, family) in &families {
        for (role, hex) in family {
            tokens.push((token_name(name, &role_to_css(role)), hex.clone()));
        }
    }
    tokens.push((token_name("neutral", "canvas"), layers.canvas.clone()));
    tokens.push((token_name("neutral", "raised"), layers.raised.clone()));

    Ok(Matrix {
        violations: check_promises(&families, &layers)?,
        tokens,
    })
}

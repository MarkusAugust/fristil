//! Fargeregning: sRGB, OKLCH og kontrast.
//!
//! Regningen skjer i OKLCH og ikke i HSL. I HSL betyr lyshet noe annet for
//! hver kulør: `hsl(60 100% 50%)` er knallgul og `hsl(240 100% 50%)` er nesten
//! sort, med samme tall. I OKLCH er lysheten den samme opplevde lysheten
//! uansett kulør, så kontrakten kan sette én lyshet per rolle og la den gjelde
//! for alle farger.
//!
//! Kontrasten regnes med WCAG 2.1 sin formel, den samme som testene bruker,
//! så kontrakten og kontrollen er enige.

use std::f64::consts::PI;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rgb {
    pub r: f64,
    pub g: f64,
    pub b: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Oklch {
    pub l: f64,
    pub c: f64,
    pub h: f64,
}

/// Leser `#rrggbb` eller `#rgb`.
pub fn parse_hex(hex: &str) -> Result<Rgb, String> {
    let trimmed = crate::theme::js_trim(hex);
    let clean = trimmed.strip_prefix('#').unwrap_or(trimmed);
    let full: String = if clean.chars().count() == 3 {
        clean.chars().flat_map(|c| [c, c]).collect()
    } else {
        clean.to_string()
    };
    if full.len() != 6 || !full.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(format!("«{hex}» er ikke en gyldig heksadesimal farge"));
    }
    let channel = |i: usize| f64::from(u8::from_str_radix(&full[i..i + 2], 16).unwrap());
    Ok(Rgb {
        r: channel(0),
        g: channel(2),
        b: channel(4),
    })
}

/// `Math.round`: halvparten rundes opp, også for negative tall.
fn js_round(x: f64) -> f64 {
    (x + 0.5).floor()
}

pub fn to_hex(rgb: Rgb) -> String {
    let channel = |v: f64| js_round(v.clamp(0.0, 255.0)) as u8;
    format!(
        "#{:02x}{:02x}{:02x}",
        channel(rgb.r),
        channel(rgb.g),
        channel(rgb.b)
    )
}

fn to_linear(channel: f64) -> f64 {
    let c = channel / 255.0;
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

fn from_linear(channel: f64) -> f64 {
    let c = if channel <= 0.0031308 {
        channel * 12.92
    } else {
        1.055 * channel.powf(1.0 / 2.4) - 0.055
    };
    c * 255.0
}

pub fn rgb_to_oklch(rgb: Rgb) -> Oklch {
    let lr = to_linear(rgb.r);
    let lg = to_linear(rgb.g);
    let lb = to_linear(rgb.b);

    let l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
    let m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
    let s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

    let l_ = l.cbrt();
    let m_ = m.cbrt();
    let s_ = s.cbrt();

    let lightness = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
    let a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
    let bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

    Oklch {
        l: lightness,
        c: a.hypot(bb),
        h: (bb.atan2(a) * 180.0) / PI,
    }
}

fn oklch_to_rgb_raw(color: Oklch) -> Rgb {
    let rad = (color.h * PI) / 180.0;
    let a = color.c * rad.cos();
    let b = color.c * rad.sin();

    let l_ = color.l + 0.3963377774 * a + 0.2158037573 * b;
    let m_ = color.l - 0.1055613458 * a - 0.0638541728 * b;
    let s_ = color.l - 0.0894841775 * a - 1.291485548 * b;

    let lr = l_.powf(3.0);
    let mr = m_.powf(3.0);
    let sr = s_.powf(3.0);

    Rgb {
        r: from_linear(4.0767416621 * lr - 3.3077115913 * mr + 0.2309699292 * sr),
        g: from_linear(-1.2684380046 * lr + 2.6097574011 * mr - 0.3413193965 * sr),
        b: from_linear(-0.0041960863 * lr - 0.7034186147 * mr + 1.707614701 * sr),
    }
}

fn outside(rgb: Rgb) -> bool {
    let margin = 0.5;
    [rgb.r, rgb.g, rgb.b]
        .iter()
        .any(|&c| c < -margin || c > 255.0 + margin)
}

/// Gjør en OKLCH-farge om til rgb som finnes på en skjerm.
///
/// Ikke alle kombinasjoner av lyshet og metning kan vises i sRGB. Havner
/// fargen utenfor, dempes metningen til den er innenfor, framfor å klippe
/// kanalene hver for seg. Det siste ville endret kuløren.
pub fn oklch_to_rgb(color: Oklch) -> Rgb {
    let attempt = oklch_to_rgb_raw(color);
    if !outside(attempt) {
        return attempt;
    }
    let mut low = 0.0;
    let mut high = color.c;
    for _ in 0..24 {
        let middle = (low + high) / 2.0;
        if outside(oklch_to_rgb_raw(Oklch { c: middle, ..color })) {
            high = middle;
        } else {
            low = middle;
        }
    }
    oklch_to_rgb_raw(Oklch { c: low, ..color })
}

fn luminance(rgb: Rgb) -> f64 {
    0.2126 * to_linear(rgb.r) + 0.7152 * to_linear(rgb.g) + 0.0722 * to_linear(rgb.b)
}

/// Kontrastforholdet mellom to farger, slik WCAG 2.1 regner det.
pub fn contrast_ratio(a: Rgb, b: Rgb) -> f64 {
    let la = luminance(a);
    let lb = luminance(b);
    (la.max(lb) + 0.05) / (la.min(lb) + 0.05)
}

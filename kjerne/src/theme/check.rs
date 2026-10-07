//! Kontrollerer et tema en konsument har skrevet selv.
//!
//! Generatoren holder løftene av konstruksjon. Skriver noen inn egne verdier,
//! er løftene deres å holde, og da skylder vi dem et svar på hvilken celle som
//! ryker. Uten dette er «du kan overstyre hva som helst» en felle.
//!
//! Fila leses som tekst. Det eneste som betyr noe er hvilke `--fs-color-*`
//! som står i hvilken blokk, og en verdi vi ikke kan regne på meldes som
//! nettopp det framfor å hoppes over.

use super::contract::{
    build_matrix, check_promises, contract, promises_for, role_to_css, token_name, Appearance,
    Family, Layers,
};
use super::{is_js_space, js_number, js_trim};

pub struct ParsedBlock {
    /// Selektoren blokka sto under, brukt i meldingene.
    pub selector: String,
    /// Utseendet blokka gjelder, lest av `color-scheme` eller selektoren.
    pub appearance: Appearance,
    /// Tokennavn til verdi, slik de sto skrevet.
    pub declarations: Vec<(String, String)>,
}

/// `/\/\*[\s\S]*?\*\//g`: kommentarene som er lukket, tatt bort.
fn without_comments(css: &str) -> String {
    let mut out = String::with_capacity(css.len());
    let mut rest = css;
    while let Some(start) = rest.find("/*") {
        match rest[start + 2..].find("*/") {
            Some(end) => {
                out.push_str(&rest[..start]);
                rest = &rest[start + 2 + end + 2..];
            }
            None => break,
        }
    }
    out.push_str(rest);
    out
}

/// Deler CSS-teksten i blokker, med en ramme per nivå.
///
/// Hver ramme holder sin egen tekst, ikke bare selektoren. Uten det ble alt
/// som sto før en nøstet regel lest som en del av selektoren, og
/// deklarasjonen forsvant uten et ord.
pub fn parse_blocks(css: &str) -> Vec<ParsedBlock> {
    struct Frame {
        selector: String,
        text: String,
    }
    let clean = without_comments(css);
    let mut blocks = Vec::new();
    let mut stack: Vec<Frame> = Vec::new();
    let mut buffer = String::new();
    for c in clean.chars() {
        match c {
            '{' => {
                let split = buffer.rfind(';').map_or(0, |i| i + 1);
                if let Some(top) = stack.last_mut() {
                    top.text.push_str(&buffer[..split]);
                }
                stack.push(Frame {
                    selector: js_trim(&buffer[split..]).to_string(),
                    text: String::new(),
                });
                buffer.clear();
            }
            '}' => {
                if let Some(mut frame) = stack.pop() {
                    frame.text.push_str(&buffer);
                    let declarations = read_declarations(&frame.text);
                    if !declarations.is_empty() {
                        let path: Vec<&str> = stack
                            .iter()
                            .map(|f| f.selector.as_str())
                            .chain([frame.selector.as_str()])
                            .collect();
                        blocks.push(ParsedBlock {
                            selector: path
                                .iter()
                                .filter(|s| !s.is_empty())
                                .copied()
                                .collect::<Vec<_>>()
                                .join(" "),
                            appearance: read_appearance(&path.join(" "), &frame.text),
                            declarations,
                        });
                    }
                }
                buffer.clear();
            }
            c => buffer.push(c),
        }
    }
    blocks
}

/// `\s*!important\s*$`, uten hensyn til store bokstaver, tatt bort.
fn without_important(value: &str) -> &str {
    let trimmed = value.trim_end_matches(is_js_space);
    let lower = trimmed.to_lowercase();
    if lower.len() == trimmed.len() && lower.ends_with("!important") {
        return trimmed[..trimmed.len() - "!important".len()].trim_end_matches(is_js_space);
    }
    value
}

fn read_declarations(text: &str) -> Vec<(String, String)> {
    let mut out: Vec<(String, String)> = Vec::new();
    for part in text.split(';') {
        let Some(separator) = part.find(':') else {
            continue;
        };
        let name = js_trim(&part[..separator]);
        if !name.starts_with("--fs-color-") {
            continue;
        }
        // `!important` er lovlig og plausibelt i et håndskrevet tema, og sier
        // ingenting om fargen.
        let value = js_trim(without_important(&part[separator + 1..])).to_string();
        match out.iter_mut().find(|(n, _)| n == name) {
            Some(existing) => existing.1 = value,
            None => out.push((name.to_string(), value)),
        }
    }
    out
}

/// Mørkt eller lyst, lest av `color-scheme` først og av selektoren ellers.
fn read_appearance(selector: &str, body: &str) -> Appearance {
    // Siste deklarasjon vinner, som i kaskaden.
    let chars: Vec<char> = body.chars().collect();
    let lower: Vec<char> = body.to_lowercase().chars().collect();
    let mut declared: Option<String> = None;
    let target: Vec<char> = "color-scheme".chars().collect();
    let mut i = 0;
    while lower.len() == chars.len() && i + target.len() <= lower.len() {
        let starts =
            i == 0 || is_js_space(chars[i - 1]) || chars[i - 1] == ';' || chars[i - 1] == '{';
        if starts && lower[i..i + target.len()] == target[..] {
            let mut j = i + target.len();
            while j < chars.len() && is_js_space(chars[j]) {
                j += 1;
            }
            if j < chars.len() && chars[j] == ':' {
                let start = j + 1;
                let mut end = start;
                while end < chars.len() && chars[end] != ';' && chars[end] != '}' {
                    end += 1;
                }
                declared = Some(chars[start..end].iter().collect());
                i = end;
                continue;
            }
        }
        i += 1;
    }
    if let Some(value) = declared {
        // Verdien leses, den mønstermatches ikke. Grammatikken er
        // `normal | [ light | dark | <custom-ident> ]+ && only?`, og `only`
        // kan stå på begge sider. Står begge nøkkelordene, sier blokka at den
        // virker i begge, og da er selektoren det beste svaret.
        let lowered = value.to_lowercase().replace("!important", "");
        let words: Vec<&str> = lowered
            .split(is_js_space)
            .filter(|w| !w.is_empty())
            .collect();
        let light = words.contains(&"light");
        let dark = words.contains(&"dark");
        if light != dark {
            return if dark {
                Appearance::Dark
            } else {
                Appearance::Light
            };
        }
    }
    // `dark` må stå som eget ord: `.darkmode-toggle` er ikke et mørkt tema.
    let s: Vec<char> = selector.chars().collect();
    let letter = |c: Option<&char>| c.is_some_and(|c| c.is_ascii_alphabetic());
    for k in 0..s.len() {
        let word: String = s[k..(k + 4).min(s.len())].iter().collect();
        if word.eq_ignore_ascii_case("dark")
            && !letter(k.checked_sub(1).and_then(|p| s.get(p)))
            && !letter(s.get(k + 4))
        {
            return Appearance::Dark;
        }
    }
    Appearance::Light
}

/// Rollenavnene slik de skrives i CSS, lengste først.
fn role_names() -> Vec<(String, String)> {
    let mut names: Vec<(String, String)> = contract()
        .roles
        .iter()
        .map(|(r, _)| (role_to_css(r), r.clone()))
        .collect();
    names.sort_by_key(|n| std::cmp::Reverse(n.0.len()));
    names
}

/// Deler `--fs-color-min-merkevare-text` i familie og rolle.
///
/// Rollen leses som **endelsen**. Med familien som begynnelsen falt et
/// familienavn med bindestrek utenfor uten et ord. `None` som rolle betyr et
/// kjent lag, og de hører bare til den nøytrale familien.
fn split_token(token: &str) -> Option<(String, Option<String>)> {
    let rest = token
        .strip_prefix("--fs-color-")
        .filter(|r| !r.is_empty())?;
    for layer in ["canvas", "raised"] {
        if let Some(family) = rest.strip_suffix(&format!("-{layer}")) {
            return (family == "neutral").then(|| (family.to_string(), None));
        }
    }
    for (css, role) in role_names() {
        if let Some(family) = rest.strip_suffix(&format!("-{css}")) {
            if family.is_empty() {
                return None;
            }
            return Some((family.to_string(), Some(role)));
        }
    }
    None
}

fn is_hex(value: &str) -> bool {
    let Some(digits) = value.strip_prefix('#') else {
        return false;
    };
    (digits.len() == 3 || digits.len() == 6) && digits.bytes().all(|b| b.is_ascii_hexdigit())
}

/// `tall.toFixed(2)` i JavaScript: likt avstand rundes opp, ikke til partall.
fn to_fixed2(n: f64) -> String {
    let scaled = n * 100.0;
    let floor = scaled.floor();
    if scaled - floor == 0.5 {
        let up = (floor + 1.0) / 100.0;
        return format!("{up:.2}");
    }
    format!("{n:.2}")
}

pub struct Problem {
    pub selector: String,
    pub message: String,
}

pub struct Report {
    pub problems: Vec<Problem>,
    /// Blokker som faktisk ble lest.
    pub blocks: usize,
    /// Verdier konsumenten selv skrev, og som ble forstått.
    pub declarations: usize,
    /// Løfter som faktisk ble kontrollert.
    pub promises: usize,
}

/// Leser et tema og kontrollerer hvert løfte i hver blokk.
///
/// Verdier som mangler fylles fra Fristils eget tema, slik at en konsument som
/// bare har overstyrt én celle får den kontrollert mot resten av systemet sitt
/// framfor mot ingenting.
pub fn inspect_theme(css: &str) -> Report {
    let mut problems = Vec::new();
    let blocks = parse_blocks(css);
    let mut checked_promises = 0;
    let mut understood = 0;

    // Klammene telles for seg: en ulukket blokk blir ikke lest.
    let clean = without_comments(css);
    let opened = clean.matches('{').count();
    let closed = clean.matches('}').count();
    if opened != closed {
        problems.push(Problem {
            selector: "(hele fila)".into(),
            message: format!("Fila har {opened} «{{» og {closed} «}}». En blokk som ikke er lukket blir ikke lest, så deler av temaet kan være ukontrollert."),
        });
    }

    if blocks.is_empty() {
        problems.push(Problem {
            selector: "(hele fila)".into(),
            message: "Fant ingen --fs-color-*-verdier. Er dette et Fristil-tema, og står verdiene i en blokk?".into(),
        });
        return Report {
            problems,
            blocks: 0,
            declarations: 0,
            promises: 0,
        };
    }

    let role_list = role_names()
        .into_iter()
        .map(|(css, _)| css)
        .collect::<Vec<_>>()
        .join(", ");

    for block in &blocks {
        let defaults = build_matrix(&contract().brands, block.appearance)
            .expect("Fristils egne farger skal alltid gi en matrise")
            .tokens;
        let mut values: Vec<(String, String)> = defaults;

        for (name, value) in &block.declarations {
            if !is_hex(value) {
                problems.push(Problem {
                    selector: block.selector.clone(),
                    message: format!("{name} er «{value}». Kontrasten kan bare regnes på en heksfarge, så denne er ikke kontrollert."),
                });
                continue;
            }
            match values.iter_mut().find(|(n, _)| n == name) {
                Some(existing) => existing.1 = value.clone(),
                None => values.push((name.clone(), value.clone())),
            }
            if split_token(name).is_some() {
                understood += 1;
            }
        }

        let mut families: Vec<(String, Family)> = Vec::new();
        for (name, value) in &values {
            let Some((family, role)) = split_token(name) else {
                // Bare navn konsumenten selv skrev meldes. Standardverdiene er
                // våre egne, og de deles alltid.
                if block.declarations.iter().any(|(n, _)| n == name) {
                    problems.push(Problem {
                        selector: block.selector.clone(),
                        message: format!("{name} er ikke et token i systemet. Navnet er --fs-color-<familie>-<rolle>, og rollene er {role_list}."),
                    });
                }
                continue;
            };
            let Some(role) = role else { continue };
            let index = match families.iter().position(|(f, _)| *f == family) {
                Some(i) => i,
                None => {
                    families.push((family, Vec::new()));
                    families.len() - 1
                }
            };
            let entries = &mut families[index].1;
            match entries.iter_mut().find(|(r, _)| *r == role) {
                Some(existing) => existing.1 = value.clone(),
                None => entries.push((role, value.clone())),
            }
        }

        // En familie konsumenten fant på selv fylles ikke av standarden og kan
        // ha hull. Den meldes som ufullstendig framfor å kastes.
        let mut complete = Vec::new();
        for (name, family) in families {
            let missing: Vec<String> = contract()
                .roles
                .iter()
                .filter(|(r, _)| !family.iter().any(|(k, _)| k == r))
                .map(|(r, _)| role_to_css(r))
                .collect();
            if missing.is_empty() {
                complete.push((name, family));
            } else {
                problems.push(Problem {
                    selector: block.selector.clone(),
                    message: format!("{name} mangler {}. En familie må ha alle rollene for at løftene skal kunne kontrolleres.", missing.join(", ")),
                });
            }
        }

        let value = |family: &str, role: &str| {
            let name = token_name(family, role);
            values
                .iter()
                .find(|(n, _)| *n == name)
                .map(|(_, v)| v.clone())
                .unwrap_or_default()
        };
        let layers = Layers {
            canvas: value("neutral", "canvas"),
            surface: value("neutral", "surface"),
            raised: value("neutral", "raised"),
        };

        for (_, family) in &complete {
            checked_promises += promises_for(family, &layers).map_or(0, |p| p.len());
        }
        for violation in check_promises(&complete, &layers).unwrap_or_default() {
            problems.push(Problem {
                selector: block.selector.clone(),
                message: format!(
                    "{}: {} er {}:1, kravet er {}:1.",
                    violation.family,
                    violation.promise,
                    to_fixed2(violation.ratio),
                    js_number(violation.required)
                ),
            });
        }
    }

    Report {
        problems,
        blocks: blocks.len(),
        declarations: understood,
        promises: checked_promises,
    }
}

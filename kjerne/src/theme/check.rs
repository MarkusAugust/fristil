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
use cssparser::{
    AtRuleParser, CowRcStr, DeclarationParser, ParseError, Parser, ParserState,
    QualifiedRuleParser, RuleBodyItemParser, RuleBodyParser, StyleSheetParser,
};

pub struct ParsedBlock {
    /// Selektoren blokka sto under, brukt i meldingene.
    pub selector: String,
    /// Utseendet blokka gjelder, lest av `color-scheme` eller selektoren.
    pub appearance: Appearance,
    /// Tokennavn til verdi, slik de sto skrevet.
    pub declarations: Vec<(String, String)>,
    /// Om blokka selv sa `color-scheme: light`, og ikke `dark` ved siden av.
    pub light_scheme: bool,
}

/// Kommentarene tatt bort, til teksten i en selektor og en verdi.
fn without_comments(css: &str) -> String {
    let mut out = String::with_capacity(css.len());
    let mut rest = css;
    while let Some(start) = rest.find("/*") {
        out.push_str(&rest[..start]);
        match rest[start + 2..].find("*/") {
            Some(end) => rest = &rest[start + 2 + end + 2..],
            None => return out,
        }
    }
    out.push_str(rest);
    out
}

/// En blokk slik CSS-en skriver den: selektoren, deklarasjonene i den, og
/// blokkene inni.
struct Node {
    selector: String,
    declarations: Vec<(String, String)>,
    children: Vec<Node>,
}

/// Det én regel i en blokk er: en deklarasjon, en nøstet blokk, eller noe
/// sjekken ikke bryr seg om, som `@import`.
enum Item {
    Declaration(String, String),
    Block(Node),
    Nothing,
}

/// Leseren cssparser kaller for hver regel. Den tar vare på teksten slik den
/// sto, så meldingene viser selektoren konsumenten skrev.
struct Reader;

/// Alle tokenene som er igjen, som teksten de sto skrevet med.
fn rest_as_text<'i>(input: &mut Parser<'i>) -> String {
    let start = input.position();
    while input.next_including_whitespace_and_comments().is_ok() {}
    js_trim(&without_comments(input.slice_from(start))).to_string()
}

fn body<'i>(input: &mut Parser<'i>) -> (Vec<(String, String)>, Vec<Node>) {
    let mut declarations: Vec<(String, String)> = Vec::new();
    let mut children = Vec::new();
    let mut reader = Reader;
    for item in RuleBodyParser::new(input, &mut reader).flatten() {
        match item {
            Item::Declaration(name, value) => {
                match declarations.iter_mut().find(|(n, _)| *n == name) {
                    Some(existing) => existing.1 = value,
                    None => declarations.push((name, value)),
                }
            }
            Item::Block(node) => children.push(node),
            Item::Nothing => {}
        }
    }
    (declarations, children)
}

impl<'i> DeclarationParser<'i> for Reader {
    type Declaration = Item;
    type Error = ();

    fn parse_value(
        &mut self,
        name: CowRcStr<'i>,
        input: &mut Parser<'i>,
        _start: &ParserState,
    ) -> Result<Item, ParseError<()>> {
        let value = rest_as_text(input);
        // Bare det sjekken bruker: fargene, og `color-scheme`, som sier om
        // blokka er lys eller mørk. Navnet på en egendefinert variabel skiller
        // mellom store og små bokstaver, navnet på en egenskap gjør det ikke.
        if name.starts_with("--fs-color-") || name.eq_ignore_ascii_case("color-scheme") {
            let name = if name.starts_with("--") {
                name.to_string()
            } else {
                name.to_ascii_lowercase()
            };
            Ok(Item::Declaration(name, value))
        } else {
            Ok(Item::Nothing)
        }
    }
}

impl<'i> QualifiedRuleParser<'i> for Reader {
    type Prelude = String;
    type QualifiedRule = Item;
    type Error = ();

    fn parse_prelude(&mut self, input: &mut Parser<'i>) -> Result<String, ParseError<()>> {
        Ok(rest_as_text(input))
    }

    fn parse_block(
        &mut self,
        selector: String,
        _start: &ParserState,
        input: &mut Parser<'i>,
    ) -> Result<Item, ParseError<()>> {
        let (declarations, children) = body(input);
        Ok(Item::Block(Node {
            selector,
            declarations,
            children,
        }))
    }
}

impl<'i> AtRuleParser<'i> for Reader {
    type Prelude = String;
    type AtRule = Item;
    type Error = ();

    fn parse_prelude(
        &mut self,
        name: CowRcStr<'i>,
        input: &mut Parser<'i>,
    ) -> Result<String, ParseError<()>> {
        let prelude = rest_as_text(input);
        Ok(js_trim(&format!("@{name} {prelude}")).to_string())
    }

    fn rule_without_block(&mut self, _prelude: String, _start: &ParserState) -> Result<Item, ()> {
        Ok(Item::Nothing)
    }

    fn parse_block(
        &mut self,
        selector: String,
        _start: &ParserState,
        input: &mut Parser<'i>,
    ) -> Result<Item, ParseError<()>> {
        let (declarations, children) = body(input);
        Ok(Item::Block(Node {
            selector,
            declarations,
            children,
        }))
    }
}

impl<'i> RuleBodyItemParser<'i, Item, ()> for Reader {
    fn parse_declarations(&self) -> bool {
        true
    }
    fn parse_qualified(&self) -> bool {
        true
    }
}

/// Blokkene i rekkefølgen de slutter, den innerste først, med selektorene
/// over seg som sti.
fn flatten(node: Node, path: &mut Vec<String>, out: &mut Vec<ParsedBlock>) {
    path.push(node.selector);
    for child in node.children {
        flatten(child, path, out);
    }
    let colors: Vec<(String, String)> = node
        .declarations
        .iter()
        .filter(|(n, _)| n.starts_with("--fs-color-"))
        .map(|(n, v)| (n.clone(), without_important(v).to_string()))
        .collect();
    if !colors.is_empty() {
        let scheme = node
            .declarations
            .iter()
            .rev()
            .find(|(n, _)| n == "color-scheme")
            .map(|(_, v)| v.as_str());
        out.push(ParsedBlock {
            selector: path
                .iter()
                .filter(|s| !s.is_empty())
                .cloned()
                .collect::<Vec<_>>()
                .join(" "),
            appearance: read_appearance(&path.join(" "), scheme),
            declarations: colors,
            light_scheme: scheme.is_some_and(|v| {
                let v = v.to_lowercase();
                let words: Vec<&str> = v.split(is_js_space).collect();
                words.contains(&"light") && !words.contains(&"dark")
            }),
        });
    }
    path.pop();
}

/// Deler CSS-teksten i blokker, med en ramme per nivå.
///
/// Lest med CSS-tokenizeren fra Servo, etter CSS Syntax Level 3, så en klamme
/// eller et semikolon i en streng, en kommentar eller `url(…)` ikke deler en
/// blokk, og nøstede regler og `@media` inni en blokk blir sine egne. En blokk
/// som ikke er lukket, leses som om den slutter der fila slutter, slik
/// nettleseren gjør.
pub fn parse_blocks(css: &str) -> Vec<ParsedBlock> {
    let mut parser = Parser::new(css);
    let mut reader = Reader;
    let mut blocks = Vec::new();
    for item in StyleSheetParser::new(&mut parser, &mut reader).flatten() {
        if let Item::Block(node) = item {
            flatten(node, &mut Vec::new(), &mut blocks);
        }
    }
    blocks
}

/// Klammene i teksten, `{` og `}`, utenom dem i strenger, kommentarer og
/// escape-sekvenser.
fn braces(css: &str) -> (usize, usize) {
    let (mut opened, mut closed) = (0, 0);
    let mut chars = css.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\\' => {
                chars.next();
            }
            '/' if chars.peek() == Some(&'*') => {
                chars.next();
                let mut previous = ' ';
                for c in chars.by_ref() {
                    if previous == '*' && c == '/' {
                        break;
                    }
                    previous = c;
                }
            }
            '"' | '\'' => {
                while let Some(d) = chars.next() {
                    if d == '\\' {
                        chars.next();
                    } else if d == c || d == '\n' {
                        break;
                    }
                }
            }
            '{' => opened += 1,
            '}' => closed += 1,
            _ => {}
        }
    }
    (opened, closed)
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

/// Om blokka bare gjelder i lyst tema: selektoren sier `light` utenfor en
/// `:not()`, eller den står i `@media print`, som skrives ut lyst.
fn only_light(selector: &str) -> bool {
    let s = without_not(selector).to_ascii_lowercase();
    s.contains("light") || s.contains("@media print")
}

/// Selektoren med innholdet i hver `:not(…)` tatt bort.
fn without_not(selector: &str) -> String {
    let mut out = String::new();
    let mut rest = selector;
    while let Some(start) = rest.to_ascii_lowercase().find(":not(") {
        out.push_str(&rest[..start]);
        let mut depth = 0;
        let mut end = rest.len();
        for (i, c) in rest[start + 4..].char_indices() {
            match c {
                '(' => depth += 1,
                ')' => {
                    depth -= 1;
                    if depth == 0 {
                        end = start + 4 + i + 1;
                        break;
                    }
                }
                _ => {}
            }
        }
        rest = &rest[end..];
    }
    out.push_str(rest);
    out
}

/// Mørkt eller lyst, lest av `color-scheme` først og av selektoren ellers.
///
/// `scheme` er verdien i blokkas siste `color-scheme`, som vinner i kaskaden.
fn read_appearance(selector: &str, scheme: Option<&str>) -> Appearance {
    let declared = scheme;
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
    // Det som står i `:not(…)` sier hva blokka ikke er.
    let selector = without_not(selector);
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

    // Klammene telles for seg: går de ikke opp, er fila trolig avkuttet, og
    // det som skulle stått etter, er ikke kontrollert.
    let (opened, closed) = braces(css);
    if opened != closed {
        problems.push(Problem {
            selector: "(hele fila)".into(),
            message: format!("Fila har {opened} «{{» og {closed} «}}». En blokk som ikke er lukket, leses til fila slutter, så noe av temaet kan mangle eller være lest feil."),
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

    // En lys blokk som ikke er bundet til lyst tema (bar `:root`) gjelder også
    // i mørkt, for tokenene ingen mørk blokk overstyrer. De kontrolleres mot
    // de mørke standardverdiene.
    let dark_names: Vec<&String> = blocks
        .iter()
        .filter(|b| b.appearance == Appearance::Dark)
        .flat_map(|b| b.declarations.iter().map(|(n, _)| n))
        .collect();
    let mut checks: Vec<ParsedBlock> = Vec::new();
    for b in &blocks {
        if b.appearance != Appearance::Light || b.light_scheme || only_light(&b.selector) {
            continue;
        }
        let rest: Vec<(String, String)> = b
            .declarations
            .iter()
            .filter(|(n, v)| !dark_names.contains(&n) && is_hex(v) && split_token(n).is_some())
            .cloned()
            .collect();
        if !rest.is_empty() {
            checks.push(ParsedBlock {
                selector: format!("{} (i mørkt tema, ingen mørk blokk overstyrer)", b.selector),
                appearance: Appearance::Dark,
                declarations: rest,
                light_scheme: false,
            });
        }
    }
    let originals = blocks.len();
    let all: Vec<&ParsedBlock> = blocks.iter().chain(checks.iter()).collect();

    for (nth, block) in all.iter().enumerate() {
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
            if split_token(name).is_some() && nth < originals {
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
            } else if nth < originals {
                // Kontrollen i mørkt tema er den samme blokka, og den har alt
                // meldt at familien mangler roller.
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
                    super::to_fixed2(violation.ratio),
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

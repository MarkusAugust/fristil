//! Kommandolinja til Fristil.
//!
//! Skrevet én gang, og kjørt der du er: som en kjørbar fil fra
//! `cargo install`, som en WASI-modul i Node (`npx @fristil/designsystem`), på
//! JVM-en med Chicory (`java -jar`) og i wasmtime. Svarene, tekstene og
//! feilkodene er de samme overalt, og de var de samme som i `cli.ts` da den
//! var skrevet i TypeScript.
//!
//! Et funn skrives som `fil:linje:kolonne: feil: melding`, som en kompilator,
//! og ett funn er nok til å avslutte med feil.

mod agent;
mod check;
mod check_theme;
mod fetch;
mod lsp;
mod manifest;
mod output;
mod takeover;
mod theme;

use output::{fail, log};

/// Det kommandoen kan, skrevet ut på én skjerm.
pub const HELP: &str = r#"fristil <kommando>

  sjekk <fil|adresse…> Sjekker markupen mot Fristil, som editoren gjør.
                       Uten filer leses standard inn. Ett funn gir feilkode.
                       En adresse hentes og sjekkes som en hel side: hver
                       id det pekes på må finnes, og hvert felt være koblet
    --rendret          Sjekk filer og standard inn som hele sider også
    --manifest=<fil>   Sjekk også en overtatt komponent, med fragmentet
                       fristil overta skrev ved siden av kopien
    --css=<fil>        Sjekk også at stilarkene styler markupen: en klasse
                       uten stilark, og en verdi uten regel

  sjekk-tema <fil…>    Kontrollerer at et fargetema holder kontrastløftene.
                       Leser --fs-color-*-verdiene i hver blokk og sier
                       hvilken celle som ryker. Ett brudd gir feilkode

  agent                Skriver regelboka for kodeagenter til utdata. Ingen
    --rammeverk=<navn> fil skrives noe sted. Uten flagget leses miljøet av
                       package.json. Navn: html, maler, bundles, react, astro,
                       datastar. Vue, Svelte, Solid og Lit deler «bundles»

  overta <komponent>   Kopierer kildekoden til én komponent inn i prosjektet,
                       med nytt navn (app-…), så den er din å endre
    --ut=<mappe>       Hvor kopien skal ligge. Standard: src/fristil
    --overskriv=ja     Skriv over en kopi som finnes fra før

  lsp                  Språkserveren for editorer, over standard inn og ut.
                       Leser manifestet i build/fristil/ eller i
                       node_modules, med det innebygde som reserve

  manifest             Skriver manifestet sjekken bruker, med fragmentene
    --manifest=<fil>   fra fristil overta lagt til
    --ut=<fil>         Skriv til fil i stedet for til utdata

  tema                 Lager et tema av merkefargene, skriften og formen din
    --aksent=<farge>      Lenker, knapper og fokus
    --fare=<farge>        Feil og sletting
    --suksess=<farge>     Bekreftelser
    --advarsel=<farge>    Advarsler
    --noytral=<farge>     Tekst og flater
    --besokt=<farge>      Besøkte lenker
    --merke1=<farge>      Merkefarge for flater og kategorier
    --merke2=<farge>      Merkefarge nummer to
    --merke3=<farge>      Merkefarge nummer tre
    --skrift=<stakk>      Skriftstakken temaet skal bruke
    --knapp-hjorner=<mål> Hjørner på knapp, paginering og hopplenke
    --felt-hjorner=<mål>  Hjørner på felt, tekstområde og nedtrekksliste
    --flate-hjorner=<mål> Hjørner på kort, dialog, sprettoppvindu, varsel,
                          trekkspill, feiloppsummering, filopplasting,
                          økttidsvarsel, forslagsliste, melding og hjelpeboble
    --knapp-ramme=<mål>   Rammetykkelsen på knappen
    --knapp-vekt=<vekt>   Vekten på knappeteksten
    --ut=<fil>            Skriv til fil i stedet for til utdata

Fargene skrives heksadesimalt, for eksempel #7c3aed. Temaet kan også leses
fra en JSON-fil: fristil tema fristil.tema.json

Eksempler:
  npx @fristil/designsystem sjekk maler/*.html
  npx @fristil/designsystem sjekk http://localhost:8080/skjema
  curl -s http://localhost:8080/skjema | npx @fristil/designsystem sjekk --rendret
  npx @fristil/designsystem agent
  npx @fristil/designsystem overta button --ut=src/ui
  npx @fristil/designsystem tema --aksent=#7c3aed --fare=#b3261e \
    --suksess=#2b6940 --advarsel=#8a5a00 --ut=tema.css
"#;

const HELP_FLAGS: [&str; 5] = ["--help", "-h", "help", "hjelp", "--hjelp"];
const COMMANDS: [&str; 7] = [
    "agent",
    "sjekk",
    "sjekk-tema",
    "overta",
    "tema",
    "manifest",
    "lsp",
];

/// Flaggene med likhetstegn, `--navn=verdi`, og resten som filer.
///
/// Bindestrek er med i navnet: flagg som `--knapp-hjorner` leses ellers som en
/// fil. Sifre også: `--merke1` ble lest som et filnavn.
pub struct Arguments {
    pub flags: Vec<(String, String)>,
    pub files: Vec<String>,
}

impl Arguments {
    pub fn read(arguments: &[String]) -> Self {
        let mut flags: Vec<(String, String)> = Vec::new();
        let mut files = Vec::new();
        for part in arguments {
            match flag(part) {
                Some((name, value)) => match flags.iter_mut().find(|(n, _)| *n == name) {
                    Some(existing) => existing.1 = value,
                    None => flags.push((name, value)),
                },
                None => files.push(part.clone()),
            }
        }
        Arguments { flags, files }
    }

    pub fn flag(&self, name: &str) -> Option<&str> {
        self.flags
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, v)| v.as_str())
    }

    /// Det første «flagget» uten verdi, som `--ut src/ui`, som ellers ville
    /// blitt lest som to filnavn.
    pub fn without_value(&self) -> Option<&str> {
        self.files
            .iter()
            .find(|f| f.starts_with("--"))
            .map(String::as_str)
    }
}

/// `/^--([a-zæøå0-9-]+)=(.+)$/`
fn flag(part: &str) -> Option<(String, String)> {
    let rest = part.strip_prefix("--")?;
    let (name, value) = rest.split_once('=')?;
    let name_ok = !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || "æøå".contains(c));
    // `.` i et regulært uttrykk tar ikke linjeskift.
    let value_ok = !value.is_empty() && !value.contains(['\n', '\r', '\u{2028}', '\u{2029}']);
    (name_ok && value_ok).then(|| (name.to_string(), value.to_string()))
}

/// Melder et flagg uten verdi og avslutter.
pub fn refuse_without_value(arguments: &Arguments) {
    if let Some(flag) = arguments.without_value() {
        fail(&format!(
            "«{flag}» mangler en verdi.\n\nSkriv {flag}=<verdi>, med likhetstegn og uten mellomrom.\n"
        ));
    }
}

fn main() {
    // En WASI-modul begynner i mappa `/`, så en relativ sti som
    // `package.json` ville blitt lest fra rota. Verten sier hvor
    // arbeidsmappa er, og modulen går dit før den gjør noe annet.
    if let Ok(directory) = std::env::var("FRISTIL_ARBEIDSMAPPE") {
        // En nettverksmappe på Windows (`\\\\server\\…`) er ikke åpnet for
        // modulen. Den skal få vite det, ikke få «Fant ikke fila» etterpå.
        if let Err(reason) = std::env::set_current_dir(&directory) {
            output::error(&format!(
                "Advarsel: kommandolinja kan ikke gå til arbeidsmappa «{directory}» ({reason}). Relative stier leses fra rota. Bruk absolutte stier, eller kjør fra en mappe på en stasjon."
            ));
        }
    }
    let arguments: Vec<String> = std::env::args().skip(1).collect();

    // Uten argumenter, eller når noen ber om hjelp, skal kommandoen fortelle
    // hva den kan.
    if arguments.is_empty() || HELP_FLAGS.contains(&arguments[0].as_str()) {
        log(HELP);
        std::process::exit(0);
    }
    let first = arguments[0].as_str();
    if !COMMANDS.contains(&first) && !first.starts_with("--") {
        fail(&format!("Ukjent kommando «{first}».\n\n{HELP}"));
    }

    let rest = &arguments[1..];
    match first {
        "agent" => agent::run(rest),
        "sjekk" => check::run(rest),
        "sjekk-tema" => check_theme::run(rest),
        "overta" => takeover::run(rest),
        "manifest" => manifest::run(rest),
        "lsp" => lsp::run(rest),
        // `tema` kan stå først, siden kommandoen kjøres som
        // `npx @fristil/designsystem tema`.
        "tema" => theme::run(rest),
        _ => theme::run(&arguments),
    }
    std::process::exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_flags_like_the_regular_expression() {
        assert_eq!(
            flag("--knapp-hjorner=4px"),
            Some(("knapp-hjorner".into(), "4px".into()))
        );
        assert_eq!(
            flag("--merke1=#fff"),
            Some(("merke1".into(), "#fff".into()))
        );
        assert_eq!(
            flag("--noytral=a=b"),
            Some(("noytral".into(), "a=b".into()))
        );
        assert_eq!(flag("--Aksent=#fff"), None);
        assert_eq!(flag("--ut="), None);
        assert_eq!(flag("--ut"), None);
        assert_eq!(flag("tema.json"), None);
    }
}

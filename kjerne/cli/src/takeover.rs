//! `fristil overta <komponent>`: kopierer kildekoden til én komponent inn i
//! prosjektet, når tilpasning gjennom CSS ikke strekker til.
//!
//! Laget og `--fs-*`-variablene dekker utseendet, og siden ingen komponent har
//! shadow DOM, når CSS-en din fram overalt. Det de ikke dekker er «jeg vil at
//! denne komponenten skal oppføre seg annerledes». Da er alternativet enten å
//! leve med det eller å skrive komponenten på nytt fra bunnen, og denne
//! kommandoen er veien imellom: en komponent er et stilark og en fil på
//! mellom hundre og tre hundre linjer, uten avhengigheter.
//!
//! Tre ting gjøres med kopien:
//!
//! - Henvisningene ut av mappa skrives om. `../shared.js` finnes ikke der
//!   kopien havner, og blir til `@fristil/designsystem/shared`, som fortsatt
//!   virker og viser hva kopien henter fra pakken.
//! - Kopien får nytt navn: `fs-button` blir `app-button` i klasser, tagger,
//!   `define` og selektorer. Det du overtar, eier du, og den kan stå ved siden
//!   av originalen uten at rekkefølgen avgjør hvilken som vinner.
//!   `--fs-*`-variablene beholdes, så temaet virker som før.
//! - Et fragment av manifestet skrives ved siden av, med de nye navnene, så
//!   `fristil sjekk --manifest=…` sjekker markupen for kopien også.
//!
//! Kildekoden er bygget inn i kommandolinja (se `build.rs`), så kommandoen
//! virker likt overalt.

use crate::output::{error, fail, shown};
use crate::{refuse_without_value, Arguments};
use fristil_kjerne::json::{parse, Json};

pub struct Component {
    pub category: &'static str,
    pub name: &'static str,
    pub files: &'static [(&'static str, &'static str)],
}

include!(concat!(env!("OUT_DIR"), "/components.rs"));

const PACKAGE: &str = include_str!("../../../designsystem/package.json");
const MANIFEST: &str = include_str!("../../../designsystem/manifest/manifest.json");

/// Forstavelsen kopien får i stedet for `fs-`.
const PREFIX: &str = "app-";

/// Fila med fragmentet av manifestet, i mappa til kopien.
pub const FRAGMENT: &str = "fristil-manifest.json";

/// En fil i pakken.
pub struct SourceFile {
    /// Stien i pakken, som «src/components/css/button/button.ts».
    pub path: String,
    pub content: String,
}

#[derive(Debug, PartialEq)]
pub struct Rewrite {
    pub from: String,
    pub to: String,
}

pub struct PlannedFile {
    /// Filnavnet alene, som «button.ts».
    pub name: String,
    pub content: String,
    /// Henvisninger som ble skrevet om, til utskrift etterpå.
    pub rewrites: Vec<Rewrite>,
}

pub struct Plan {
    pub files: Vec<PlannedFile>,
    /// Pakker kopien trenger i prosjektet. Tom i dag: pakken har ingen
    /// avhengigheter, men en konsument skal få vite det med én gang hvis en
    /// komponent en dag henter noe utenfra.
    pub dependencies: Vec<String>,
    /// Stilark og moduler kopien fortsatt henter fra pakken. Utskriften
    /// viser omskrivingene i stedet, så bare testene leser lista.
    #[cfg_attr(not(test), allow(dead_code))]
    pub kept_imports: Vec<String>,
    /// Inngangspunktene i pakken som laster originalen.
    pub replaced_entries: Vec<String>,
}

/// Oppslaget fra en fil i pakken til inngangspunktet som peker på den.
///
/// `exports` peker på `dist` for JavaScript og på `src` for komponentenes
/// CSS. Begge føres tilbake til kilden, siden det er kilden som kopieres.
pub fn entry_points(name: &str, exports: &Json) -> Vec<(String, String)> {
    let mut entries: Vec<(String, String)> = Vec::new();
    for (subpath, target) in exports.as_object().unwrap_or(&[]) {
        let file = match target {
            Json::String(s) => s.as_str(),
            other => match other.get("import").and_then(Json::as_str) {
                Some(s) if !s.is_empty() => s,
                _ => continue,
            },
        };
        let file = file.strip_prefix("./").unwrap_or(file);
        let file = match file.strip_prefix("dist/") {
            Some(rest) => format!("src/{rest}"),
            None => file.to_string(),
        };
        let source = match file.strip_suffix(".js") {
            Some(stem) => format!("{stem}.ts"),
            None => file,
        };
        let entry = format!("{name}{}", subpath.strip_prefix('.').unwrap_or(subpath));
        match entries.iter_mut().find(|(s, _)| *s == source) {
            Some(existing) => existing.1 = entry,
            None => entries.push((source, entry)),
        }
    }
    entries
}

fn lookup<'a>(entries: &'a [(String, String)], source: &str) -> Option<&'a str> {
    entries
        .iter()
        .find(|(s, _)| s == source)
        .map(|(_, e)| e.as_str())
}

/// Slår sammen en relativ sti med mappa den står i.
pub fn resolve_path(from_directory: &str, relative: &str) -> String {
    let mut parts: Vec<&str> = from_directory
        .split('/')
        .filter(|p| !p.is_empty())
        .collect();
    for part in relative.split('/') {
        match part {
            "." | "" => {}
            ".." => {
                parts.pop();
            }
            other => parts.push(other),
        }
    }
    parts.join("/")
}

/// En henvisning i en fil: `from "…"` eller `@import "…"`.
struct Reference {
    /// Fra starten av `from` eller `@import` til og med det siste anførselstegnet.
    start: usize,
    end: usize,
    /// Alt før stien: `from ` og anførselstegnet.
    lead: String,
    quote: char,
    specifier: String,
}

/// `/(from\s+|@import\s+)(["'])([^"']+)\2/g`, uten regulære uttrykk.
fn references(text: &str) -> Vec<Reference> {
    let mut found = Vec::new();
    let mut at = 0;
    while at < text.len() {
        match reference_at(text, at) {
            Some(reference) => {
                at = reference.end;
                found.push(reference);
            }
            None => at += text[at..].chars().next().map_or(1, char::len_utf8),
        }
    }
    found
}

fn reference_at(text: &str, start: usize) -> Option<Reference> {
    let rest = &text[start..];
    let keyword = ["from", "@import"]
        .into_iter()
        .find(|k| rest.starts_with(k))?;
    let after = &rest[keyword.len()..];
    let spaces: usize = after
        .chars()
        .take_while(|c| c.is_whitespace() || *c == '\u{feff}')
        .map(char::len_utf8)
        .sum();
    if spaces == 0 {
        return None;
    }
    let quoted = &after[spaces..];
    let quote = quoted.chars().next().filter(|c| *c == '"' || *c == '\'')?;
    let inner = &quoted[1..];
    let length = inner.find(['"', '\'']).filter(|&n| n > 0)?;
    if !inner[length..].starts_with(quote) {
        return None;
    }
    let lead_length = keyword.len() + spaces;
    Some(Reference {
        start,
        end: start + lead_length + 1 + length + 1,
        lead: rest[..lead_length].to_string(),
        quote,
        specifier: inner[..length].to_string(),
    })
}

/// Skriver om henvisningene ut av mappa i én fil.
///
/// En nabo i samme mappe blir med i kopien, og skal fortsatt finnes der.
pub fn rewrite_references(
    file: &SourceFile,
    entries: &[(String, String)],
    own_files: &[String],
) -> PlannedFile {
    let directory = &file.path[..file.path.rfind('/').unwrap_or(0)];
    let mut rewrites = Vec::new();
    let mut content = String::with_capacity(file.content.len());
    let mut copied = 0;
    for reference in references(&file.content) {
        if !reference.specifier.starts_with('.') {
            continue;
        }
        let target = resolve_path(directory, &reference.specifier);
        // En fil som blir med i kopien skal stå urørt. Sammenligningen går på
        // hele stien: filnavnet alene ville latt `../shared.js` stå så snart
        // mappa selv hadde en `shared.ts`. Importen peker dessuten på «.js»,
        // filen etter bygging, mens kilden heter «.ts».
        let as_source = match target.strip_suffix(".js") {
            Some(stem) => format!("{stem}.ts"),
            None => target.clone(),
        };
        if own_files.contains(&target) || own_files.contains(&as_source) {
            continue;
        }
        let Some(entry) = lookup(entries, &target).or_else(|| lookup(entries, &as_source)) else {
            continue;
        };
        content.push_str(&file.content[copied..reference.start]);
        content.push_str(&reference.lead);
        content.push(reference.quote);
        content.push_str(entry);
        content.push(reference.quote);
        copied = reference.end;
        rewrites.push(Rewrite {
            from: reference.specifier,
            to: entry.to_string(),
        });
    }
    content.push_str(&file.content[copied..]);
    PlannedFile {
        name: file
            .path
            .rsplit('/')
            .next()
            .unwrap_or(&file.path)
            .to_string(),
        content,
        rewrites,
    }
}

/// Setter sammen hele planen for én komponent.
pub fn plan_takeover(files: &[SourceFile], entries: &[(String, String)]) -> Plan {
    let own: Vec<String> = files.iter().map(|f| f.path.clone()).collect();
    let planned: Vec<PlannedFile> = files
        .iter()
        .map(|f| rewrite_references(f, entries, &own))
        .collect();

    let mut dependencies: Vec<String> = Vec::new();
    let mut kept: Vec<String> = Vec::new();
    for file in &planned {
        for reference in references(&file.content) {
            let specifier = reference.specifier;
            if specifier.starts_with('.') {
                continue;
            }
            if specifier.starts_with("@fristil/") {
                kept.push(specifier);
                continue;
            }
            let parts: Vec<&str> = specifier.split('/').collect();
            dependencies.push(if specifier.starts_with('@') {
                parts[..parts.len().min(2)].join("/")
            } else {
                parts[0].to_string()
            });
        }
    }
    let mut replaced: Vec<String> = files
        .iter()
        .filter_map(|f| lookup(entries, &f.path).map(str::to_string))
        .collect();
    for list in [&mut dependencies, &mut kept, &mut replaced] {
        list.sort();
        list.dedup();
    }
    Plan {
        files: planned,
        dependencies,
        kept_imports: kept,
        replaced_entries: replaced,
    }
}

/// Blokken en klasse hører til: `fs-button` for `fs-button--primary`.
fn block(name: &str) -> &str {
    let end = [name.find("__"), name.find("--")]
        .into_iter()
        .flatten()
        .min()
        .unwrap_or(name.len());
    &name[..end]
}

/// Blokkene og elementene komponenten eier, som `fs-avatar` og
/// `fs-avatar-stack`, lest av manifestet.
pub fn own_names(manifest: &Json, component: &str) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    for (name, class) in manifest
        .get("classes")
        .and_then(Json::as_object)
        .unwrap_or(&[])
    {
        if class.get("component").and_then(Json::as_str) == Some(component) {
            names.push(block(name).to_string());
        }
    }
    let link_end = format!("/components/{component}/");
    for (tag, element) in manifest
        .get("elements")
        .and_then(Json::as_object)
        .unwrap_or(&[])
    {
        if element
            .get("link")
            .and_then(Json::as_str)
            .is_some_and(|l| l.ends_with(&link_end))
        {
            names.push(tag.clone());
        }
    }
    if names.is_empty() {
        names.push(format!("fs-{component}"));
    }
    names.sort();
    names.dedup();
    names
}

fn is_name_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'-' || b == b'_'
}

/// Det nye navnet for et `fs-`-navn.
pub fn renamed(name: &str) -> String {
    match name.strip_prefix("fs-") {
        Some(rest) => format!("{PREFIX}{rest}"),
        None => name.to_string(),
    }
}

/// Gir komponentens egne navn det nye navnet.
///
/// Et navn byttes der det står alene, eller med en variant eller et element
/// etter (`fs-button--primary`, `fs-button__icon`). `fs-button-group` er en
/// annen komponent, og `--fs-button-bg` en variabel fra temaet, og begge står.
pub fn rename(content: &str, names: &[String]) -> String {
    let bytes = content.as_bytes();
    let mut out = String::with_capacity(content.len());
    let mut copied = 0;
    let mut at = 0;
    while at < bytes.len() {
        let free_before = at == 0 || !is_name_byte(bytes[at - 1]);
        let hit = free_before
            .then(|| {
                names.iter().find(|name| {
                    let end = at + name.len();
                    // Bytevis: navnene er ASCII, men teksten rundt er det ikke.
                    bytes[at..].starts_with(name.as_bytes())
                        && (end == bytes.len()
                            || !is_name_byte(bytes[end])
                            || bytes[end..].starts_with(b"--")
                            || bytes[end..].starts_with(b"__"))
                })
            })
            .flatten();
        match hit {
            Some(name) => {
                out.push_str(&content[copied..at]);
                out.push_str(&renamed(name));
                at += name.len();
                copied = at;
            }
            None => at += 1,
        }
    }
    out.push_str(&content[copied..]);
    out
}

/// Fragmentet av manifestet for kopien: elementene og klassene komponenten
/// eier, med de nye navnene.
pub fn fragment(manifest: &Json, component: &str, names: &[String]) -> Json {
    let owned = |name: &str| names.iter().any(|n| n == block(name) || n == name);
    let section = |key: &str| -> Json {
        Json::Object(
            manifest
                .get(key)
                .and_then(Json::as_object)
                .unwrap_or(&[])
                .iter()
                .filter(|(name, _)| owned(name))
                .map(|(name, value)| (rename(name, names), value.clone()))
                .collect(),
        )
    };
    let version = manifest.get("version").cloned().unwrap_or(Json::Null);
    Json::Object(vec![
        ("schemaVersion".into(), Json::Number(1.0)),
        ("version".into(), version),
        ("component".into(), Json::String(component.into())),
        ("elements".into(), section("elements")),
        ("classes".into(), section("classes")),
    ])
}

pub fn run(arguments: &[String]) {
    let parsed = Arguments::read(arguments);
    // Som i `agent`: `--ut src/ui` uten likhetstegn ble lest som to filnavn,
    // og kopien havnet stille i standardmappa.
    refuse_without_value(&parsed);

    let name = parsed.files.first().map(String::as_str);
    let Some(component) = name.and_then(|n| COMPONENTS.iter().find(|c| c.name == n)) else {
        let mut all: Vec<&str> = COMPONENTS.iter().map(|c| c.name).collect();
        all.sort();
        fail(&format!(
            "{}Bruk: fristil overta <komponent> [--ut=<mappe>]\nHele oversikten: fristil --hjelp\n\nKomponenter:\n  {}\n",
            name.map_or(String::new(), |n| format!("Fant ingen komponent som heter «{n}».\n\n")),
            all.join(", ")
        ));
    };

    let base = parsed.flag("ut").unwrap_or("src/fristil");
    let target = std::path::Path::new(base).join(component.name);
    let shown = shown(&target.display().to_string());
    if target.exists() && parsed.flag("overskriv") != Some("ja") {
        fail(&format!(
            "{shown} finnes allerede.\n\nHar du endret kopien, blir endringene borte. Kjør med --overskriv=ja hvis den skal erstattes.\n"
        ));
    }

    let package = parse(PACKAGE).expect("package.json er gyldig JSON");
    let package_name = package
        .get("name")
        .and_then(Json::as_str)
        .unwrap_or("@fristil/designsystem");
    let entries = entry_points(package_name, package.get("exports").unwrap_or(&Json::Null));
    let manifest = parse(MANIFEST).expect("manifestet er gyldig JSON");

    let folder = format!("src/components/{}/{}", component.category, component.name);
    let files: Vec<SourceFile> = component
        .files
        .iter()
        .map(|(file, content)| SourceFile {
            path: format!("{folder}/{file}"),
            content: content.to_string(),
        })
        .collect();
    let plan = plan_takeover(&files, &entries);
    let names = own_names(&manifest, component.name);

    if let Err(e) = std::fs::create_dir_all(&target) {
        fail(&format!("Klarte ikke lage {shown}: {e}"));
    }
    let write = |file: &str, content: &str| {
        let path = target.join(file);
        if let Err(e) = std::fs::write(&path, content) {
            fail(&format!(
                "Klarte ikke skrive {}: {e}",
                crate::output::shown(&path.display().to_string())
            ));
        }
    };
    for file in &plan.files {
        write(&file.name, &rename(&file.content, &names));
    }
    write(
        FRAGMENT,
        &format!(
            "{}\n",
            fragment(&manifest, component.name, &names).to_pretty()
        ),
    );

    let new_names: Vec<String> = names.iter().map(|n| renamed(n)).collect();
    let mut lines = vec![format!("Kopierte {} til {shown}/", component.name)];
    lines.extend(plan.files.iter().map(|f| format!("  {}", f.name)));
    lines.push(format!("  {FRAGMENT}"));
    lines.push(String::new());
    lines.push(format!(
        "Komponenten er nå din. Oppdateringer av {package_name} rører den ikke."
    ));
    lines.push(String::new());
    lines.push(format!(
        "Kopien heter {}, og kan stå ved siden av originalen.",
        new_names.join(" og ")
    ));
    lines.push("Bytt til det nye navnet i markupen der kopien skal brukes. Variablene".into());
    lines.push("fra temaet (--fs-*) er de samme.".into());

    let rewrites: Vec<&Rewrite> = plan.files.iter().flat_map(|f| &f.rewrites).collect();
    if !rewrites.is_empty() {
        lines.push(String::new());
        lines.push("Henvisninger ut av mappa peker nå på pakken:".into());
        lines.extend(rewrites.iter().map(|r| format!("  {} → {}", r.from, r.to)));
    }

    if !plan.replaced_entries.is_empty() {
        lines.push(String::new());
        lines
            .push("Disse importene laster originalen, og kan fjernes når ingen bruker den:".into());
        lines.extend(plan.replaced_entries.iter().map(|e| format!("  {e}")));
    }

    if !plan.dependencies.is_empty() {
        lines.push(String::new());
        lines.push(format!(
            "Kopien trenger {} i prosjektet ditt.",
            plan.dependencies.join(", ")
        ));
    }

    lines.push(String::new());
    lines.push("Sjekk markupen for kopien med:".into());
    lines.push(format!(
        "  fristil sjekk --manifest={} <filer…>",
        crate::output::shown(&target.join(FRAGMENT).display().to_string())
    ));

    error(&format!("{}\n", lines.join("\n")));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn exports() -> Json {
        parse(
            r#"{
                ".": {"import": "./dist/index.js"},
                "./shared": {"import": "./dist/components/css/shared.js"},
                "./input": {"import": "./dist/components/css/input/input.js"},
                "./suggestion": {"import": "./dist/components/ramme/suggestion/fs-suggestion.js"},
                "./field-core": {"import": "./dist/components/ramme/field/field-core.js"},
                "./button.css": "./src/components/css/button/button.css",
                "./input.css": "./src/components/css/input/input.css"
            }"#,
        )
        .unwrap()
    }

    fn entries() -> Vec<(String, String)> {
        entry_points("@fristil/designsystem", &exports())
    }

    fn file(path: &str, content: &str) -> SourceFile {
        SourceFile {
            path: path.into(),
            content: content.into(),
        }
    }

    fn own(paths: &[&str]) -> Vec<String> {
        paths.iter().map(|p| p.to_string()).collect()
    }

    #[test]
    fn leads_an_entry_point_back_to_its_source() {
        let e = entries();
        assert_eq!(
            lookup(&e, "src/components/css/shared.ts"),
            Some("@fristil/designsystem/shared")
        );
        assert_eq!(
            lookup(&e, "src/components/css/button/button.css"),
            Some("@fristil/designsystem/button.css")
        );
    }

    #[test]
    fn joins_a_relative_path_with_its_folder() {
        assert_eq!(
            resolve_path("src/components/css/button", "../shared.js"),
            "src/components/css/shared.js"
        );
        assert_eq!(
            resolve_path(
                "src/components/ramme/suggestion",
                "../../css/input/input.css"
            ),
            "src/components/css/input/input.css"
        );
    }

    #[test]
    fn rewrites_references_out_of_the_folder() {
        let path = "src/components/css/button/button.ts";
        let planned = rewrite_references(
            &file(path, "import { attributes } from \"../shared.js\"\n"),
            &entries(),
            &own(&[path]),
        );
        assert!(planned
            .content
            .contains("from \"@fristil/designsystem/shared\""));
        assert_eq!(
            planned.rewrites,
            [Rewrite {
                from: "../shared.js".into(),
                to: "@fristil/designsystem/shared".into()
            }]
        );
    }

    #[test]
    fn leaves_a_neighbour_in_the_same_folder() {
        // Importen peker på «.js», kilden heter «.ts». Uten den
        // sammenligningen ble naboen skrevet om til pakken.
        let planned = rewrite_references(
            &file(
                "src/components/ramme/field/fs-field.ts",
                "import { computeFieldAttributes } from \"./field-core.js\"\n",
            ),
            &entries(),
            &own(&[
                "src/components/ramme/field/fs-field.ts",
                "src/components/ramme/field/field-core.ts",
            ]),
        );
        assert!(planned.content.contains("from \"./field-core.js\""));
        assert!(planned.rewrites.is_empty());
    }

    #[test]
    fn rewrites_out_of_the_folder_even_when_the_file_name_is_there() {
        let planned = rewrite_references(
            &file(
                "src/components/css/accordion/accordion.ts",
                "import { attributes } from \"../shared.js\"\n",
            ),
            &entries(),
            &own(&[
                "src/components/css/accordion/accordion.ts",
                "src/components/css/accordion/shared.ts",
            ]),
        );
        assert!(planned
            .content
            .contains("from \"@fristil/designsystem/shared\""));
    }

    #[test]
    fn rewrites_imports_in_style_sheets() {
        let path = "src/components/css/search/search.css";
        let planned = rewrite_references(
            &file(
                path,
                "@import \"../input/input.css\";\n\n@layer fristil {}\n",
            ),
            &entries(),
            &own(&[path]),
        );
        assert!(planned
            .content
            .contains("@import \"@fristil/designsystem/input.css\";"));
    }

    #[test]
    fn names_dependencies_and_what_it_replaces() {
        // Fristil har ingen avhengigheter, så dette er en oppdiktet komponent.
        let plan = plan_takeover(
            &[file(
                "src/components/ramme/suggestion/fs-suggestion.ts",
                "import { noe } from \"et-bibliotek\"\nimport { attributes } from \"../../css/shared.js\"\n",
            )],
            &entries(),
        );
        assert_eq!(plan.dependencies, ["et-bibliotek"]);
        assert_eq!(plan.kept_imports, ["@fristil/designsystem/shared"]);
        assert_eq!(plan.replaced_entries, ["@fristil/designsystem/suggestion"]);
    }

    #[test]
    fn renames_its_own_names_and_nothing_else() {
        let names = own(&["fs-avatar", "fs-avatar-stack"]);
        assert_eq!(
            rename(
                ".fs-avatar, .fs-avatar--small, .fs-avatar__image, .fs-avatar-stack { color: var(--fs-avatar-bg); } .fs-avatar-group, .xfs-avatar",
                &names
            ),
            ".app-avatar, .app-avatar--small, .app-avatar__image, .app-avatar-stack { color: var(--fs-avatar-bg); } .fs-avatar-group, .xfs-avatar"
        );
        assert_eq!(
            rename(
                "customElements.define(\"fs-dialog\", FsDialog); `fs-dialog--${color}`",
                &own(&["fs-dialog"])
            ),
            "customElements.define(\"app-dialog\", FsDialog); `app-dialog--${color}`"
        );
    }

    #[test]
    fn every_component_is_embedded_and_owns_a_name() {
        let manifest = parse(MANIFEST).unwrap();
        assert!(COMPONENTS.len() > 40);
        for component in COMPONENTS {
            assert!(
                !component.files.is_empty(),
                "{} har ingen filer",
                component.name
            );
            assert!(component.files.iter().all(|(f, _)| !f.contains(".test.")));
            let names = own_names(&manifest, component.name);
            let copy: String = component
                .files
                .iter()
                .map(|(_, c)| rename(c, &names))
                .collect();
            let original: String = component.files.iter().map(|(_, c)| *c).collect();
            assert!(
                names.iter().any(|n| original.contains(n.as_str())),
                "{} nevner ikke {names:?}",
                component.name
            );
            for name in &names {
                assert!(
                    copy.contains(&renamed(name)),
                    "{} fikk ikke nytt navn",
                    component.name
                );
            }
        }
    }

    #[test]
    fn the_fragment_is_a_manifest_the_core_can_read() {
        let manifest = parse(MANIFEST).unwrap();
        let names = own_names(&manifest, "dialog");
        let fragment = fragment(&manifest, "dialog", &names).to_pretty();
        let vocabulary = fristil_kjerne::manifest::with_fragments(&[&fragment]).unwrap();
        assert!(vocabulary.elements.iter().any(|e| e.tag == "app-dialog"));
        assert!(vocabulary.classes.iter().any(|c| c.name == "app-dialog"));
        assert!(!fragment.contains("fs-dialog"));
    }
}

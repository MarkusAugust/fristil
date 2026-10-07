//! Ordforrådet fra manifestet.
//!
//! Kjernen bærer Fristils eget manifest innebygd, så den virker uten at noen
//! sender inn noe. En vert kan i tillegg gi den et annet manifest, som det
//! prosjektet faktisk har installert, eller et der en overtatt komponent er
//! med, og da sjekkes det mot det.

use std::cell::RefCell;
use std::rc::Rc;

use crate::json::{parse, Json};
use crate::types::*;

/// Formen på manifestet denne kjernen forstår.
pub const SCHEMA_VERSION: u32 = 1;

const BUILTIN: &str = include_str!("../../designsystem/manifest/manifest.json");

thread_local! {
    static BUILTIN_VOCABULARY: Rc<Vocabulary> =
        Rc::new(from_json(BUILTIN).expect("det innebygde manifestet skal alltid kunne leses"));
    static CURRENT: RefCell<Option<Rc<Vocabulary>>> = const { RefCell::new(None) };
}

/// Ordforrådet som gjelder nå: det verten har gitt, eller det innebygde.
pub fn current() -> Rc<Vocabulary> {
    CURRENT.with(|c| c.borrow().clone()).unwrap_or_else(builtin)
}

pub fn builtin() -> Rc<Vocabulary> {
    BUILTIN_VOCABULARY.with(Rc::clone)
}

/// Bytter ordforrådet. `None` går tilbake til det innebygde.
pub fn set_current(vocabulary: Option<Vocabulary>) {
    CURRENT.with(|c| *c.borrow_mut() = vocabulary.map(Rc::new));
}

fn text(value: &Json, path: &str) -> Result<String, String> {
    value
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| format!("{path} skal være tekst."))
}

fn texts(value: &Json, path: &str) -> Result<Vec<String>, String> {
    value
        .as_array()
        .ok_or_else(|| format!("{path} skal være en liste."))?
        .iter()
        .enumerate()
        .map(|(i, v)| text(v, &format!("{path}[{i}]")))
        .collect()
}

fn field<'a>(value: &'a Json, key: &str, path: &str) -> Result<&'a Json, String> {
    value
        .get(key)
        .ok_or_else(|| format!("{path} mangler «{key}»."))
}

fn entries<'a>(value: &'a Json, path: &str) -> Result<&'a [(String, Json)], String> {
    value
        .as_object()
        .ok_or_else(|| format!("{path} skal være et objekt."))
}

/// Leser et manifest. Feilmeldingen sier hva som er galt og hvor.
pub fn from_json(source: &str) -> Result<Vocabulary, String> {
    from_value(&parse(source)?)
}

/// Det innebygde manifestet med fragmentene lagt til.
///
/// Et fragment har samme form som manifestet, med elementene og klassene til
/// én overtatt komponent, og skrives av `fristil overta` ved siden av kopien.
/// Et navn som finnes fra før, byttes ut.
pub fn with_fragments(fragments: &[&str]) -> Result<Vocabulary, String> {
    from_value(&merged(fragments)?)
}

/// Det innebygde manifestet med fragmentene lagt til, som JSON.
pub fn merged(fragments: &[&str]) -> Result<Json, String> {
    let mut root = parse(BUILTIN)?;
    for fragment in fragments {
        let fragment = parse(fragment)?;
        let schema_version = field(&fragment, "schemaVersion", "fragmentet")?
            .as_f64()
            .ok_or("schemaVersion skal være et tall.")? as u32;
        if schema_version != SCHEMA_VERSION {
            return Err(format!(
                "Fragmentet har schemaVersion {schema_version}, og denne kjernen forstår {SCHEMA_VERSION}."
            ));
        }
        for section in ["elements", "classes"] {
            let Some(added) = fragment.get(section) else {
                continue;
            };
            let added = entries(added, section)?.to_vec();
            let Json::Object(root_entries) = &mut root else {
                return Err("Manifestet skal være et objekt.".into());
            };
            let Some((_, Json::Object(existing))) =
                root_entries.iter_mut().find(|(k, _)| k == section)
            else {
                return Err(format!("Manifestet mangler «{section}»."));
            };
            for (name, value) in added {
                match existing.iter_mut().find(|(k, _)| *k == name) {
                    Some(entry) => entry.1 = value,
                    None => existing.push((name, value)),
                }
            }
        }
    }
    Ok(root)
}

fn from_value(root: &Json) -> Result<Vocabulary, String> {
    let schema_version = field(root, "schemaVersion", "manifestet")?
        .as_f64()
        .ok_or("schemaVersion skal være et tall.")? as u32;
    if schema_version != SCHEMA_VERSION {
        return Err(format!(
            "Manifestet har schemaVersion {schema_version}, og denne kjernen forstår {SCHEMA_VERSION}. Oppdater kjernen og manifestet til samme versjon av Fristil."
        ));
    }
    let version = text(field(root, "version", "manifestet")?, "version")?;

    let mut elements = Vec::new();
    for (tag, element) in entries(field(root, "elements", "manifestet")?, "elements")? {
        let path = format!("elements.{tag}");
        let mut attributes = Vec::new();
        for (name, attribute) in entries(
            field(element, "attributes", &path)?,
            &format!("{path}.attributes"),
        )? {
            let attribute_path = format!("{path}.attributes.{name}");
            let kind = text(field(attribute, "type", &attribute_path)?, &attribute_path)?;
            let parsed = match kind.as_str() {
                "flag" => Attribute::Flag,
                "text" => Attribute::Text,
                "number" => Attribute::Number,
                "values" => Attribute::Values(texts(
                    field(attribute, "values", &attribute_path)?,
                    &attribute_path,
                )?),
                other => return Err(format!("{attribute_path} har ukjent type «{other}».")),
            };
            attributes.push((name.clone(), parsed));
        }
        elements.push(Element {
            tag: tag.clone(),
            link: text(field(element, "link", &path)?, &path)?,
            attributes,
        });
    }

    let mut classes = Vec::new();
    for (name, class) in entries(field(root, "classes", "manifestet")?, "classes")? {
        let path = format!("classes.{name}");
        let mut attributes = Vec::new();
        for (attribute_name, attribute) in entries(
            field(class, "attributes", &path)?,
            &format!("{path}.attributes"),
        )? {
            let attribute_path = format!("{path}.attributes.{attribute_name}");
            let flag = matches!(attribute.get("flag"), Some(Json::Bool(true)));
            attributes.push((
                attribute_name.clone(),
                ClassAttribute {
                    values: if flag {
                        Vec::new()
                    } else {
                        texts(
                            field(attribute, "values", &attribute_path)?,
                            &attribute_path,
                        )?
                    },
                    default_value: attribute
                        .get("default")
                        .map(|d| text(d, &attribute_path))
                        .transpose()?,
                    flag,
                },
            ));
        }
        classes.push(Class {
            name: name.clone(),
            title: text(field(class, "title", &path)?, &path)?,
            link: text(field(class, "link", &path)?, &path)?,
            attributes,
        });
    }

    Ok(Vocabulary {
        version,
        schema_version,
        elements,
        classes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_a_fragment_to_the_builtin_manifest() {
        let v = with_fragments(&[r#"{"schemaVersion": 1, "version": "0", "elements": {"app-dialog": {"link": "", "attributes": {}}}, "classes": {"app-button": {"title": "Button", "link": "", "attributes": {}}}}"#]).unwrap();
        assert!(v.classes.iter().any(|c| c.name == "app-button"));
        assert!(
            v.classes.iter().any(|c| c.name == "fs-button"),
            "Fristils egne står"
        );
        assert!(v.elements.iter().any(|e| e.tag == "app-dialog"));
        assert!(with_fragments(&[r#"{"schemaVersion": 2}"#]).is_err());
    }

    #[test]
    fn reads_the_builtin_manifest() {
        let v = builtin();
        assert!(v.elements.iter().any(|e| e.tag == "fs-field"));
        assert!(v.classes.iter().any(|c| c.name == "fs-button"));
    }

    #[test]
    fn rejects_another_schema_version() {
        let error = from_json(r#"{"schemaVersion": 2}"#).unwrap_err();
        assert!(error.contains("schemaVersion 2"));
    }

    #[test]
    fn says_where_a_manifest_is_wrong() {
        let error = from_json(
            r#"{"schemaVersion": 1, "version": "0", "elements": {"fs-x": {"link": "", "attributes": {"a": {"type": "shade"}}}}, "classes": {}}"#,
        )
        .unwrap_err();
        assert!(error.contains("elements.fs-x.attributes.a"), "{error}");
    }
}

//! The shape of the vocabulary and of the findings.
//!
//! The vocabulary is read from the manifest (`interfaces/manifest/manifest.json`)
//! when the core runs. The order is the same as in the manifest, and it
//! matters: it decides which suggestion wins at equal distance, and the order
//! of the lists in the messages.

/// An attribute an `<lt-…>` element reads.
#[derive(Clone, Debug)]
pub enum Attribute {
    Flag,
    Text,
    Number,
    Values(Vec<String>),
}

/// A part of an element or a class, like the control in `<lt-field>`, with
/// the selector the component finds it by. Without `multiple` the first one
/// counts, and with `unique` a second part of the same kind is an error. With
/// `stable_id` the part must have an id from the server: the component never
/// writes one, since an update would otherwise replace the part.
#[derive(Clone, Debug)]
pub struct Part {
    pub name: String,
    pub selector: String,
    pub description: String,
    pub multiple: bool,
    pub unique: bool,
    pub stable_id: bool,
}

#[derive(Clone, Debug)]
pub struct Element {
    pub tag: String,
    pub link: String,
    pub attributes: Vec<(String, Attribute)>,
    pub parts: Vec<Part>,
    /// Attributes that have been removed, with what to use instead.
    pub removed: Vec<(String, String)>,
}

/// An attribute a class takes, like `data-variant` on `lt-button`, or a
/// flag, like `data-optional` on `lt-label`, which is on when present.
#[derive(Clone, Debug)]
pub struct ClassAttribute {
    pub values: Vec<String>,
    pub default_value: Option<String>,
    pub flag: bool,
}

#[derive(Clone, Debug)]
pub struct Class {
    pub name: String,
    pub title: String,
    pub link: String,
    pub attributes: Vec<(String, ClassAttribute)>,
    pub parts: Vec<Part>,
}

/// Everything the spell check checks against, read from one manifest.
#[derive(Clone, Debug)]
pub struct Vocabulary {
    /// The version of `@lo-tek/interfaces` the manifest was written from.
    pub version: String,
    pub schema_version: u32,
    pub elements: Vec<Element>,
    pub classes: Vec<Class>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Severity {
    Error,
    Warning,
}

/// One edit in a fix: replace the text from `start` to `end` with `text`.
#[derive(Clone, Debug)]
pub struct Edit {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

/// A fix the editor can offer: one or more edits that belong together, like
/// `id` on the field and `for` on the label. The edits are in text order and
/// do not overlap; whoever applies them applies them from the end, so the
/// positions hold.
#[derive(Clone, Debug)]
pub struct Fix {
    pub title: String,
    pub edits: Vec<Edit>,
    pub preferred: bool,
}

impl Fix {
    /// A fix with one edit.
    pub fn one(title: String, start: usize, end: usize, text: String, preferred: bool) -> Fix {
        Fix {
            title,
            edits: vec![Edit { start, end, text }],
            preferred,
        }
    }
}

/// One finding. The positions are UTF-16 indices into the original text.
#[derive(Clone, Debug)]
pub struct Finding {
    pub start: usize,
    pub end: usize,
    pub severity: Severity,
    pub link: String,
    pub message: String,
    pub fix: Option<Fix>,
    /// The name of the rule, like `unknown-class`. This is what a comment
    /// like `<!-- lotek-ignore-next unknown-class -->` refers to.
    pub rule: &'static str,
}

/// The names of the rules, in the order they appear in the documentation.
pub const RULES: &[&str] = &[
    "unknown-element",
    "unknown-attribute",
    "boolean-with-value",
    "invalid-value",
    "not-a-number",
    "unknown-class",
    "invalid-class-value",
    "disabled-with-href",
    "icon-without-name",
    "field-without-control",
    "part-repeated",
    "field-without-label",
    "timeout-without-dialog",
    "duplicate-id",
    "id-not-found",
    "for-points-nowhere",
    "summary-points-nowhere",
    "control-without-label",
    "text-not-wired",
    "unstyled-class",
    "unstyled-value",
    "control-without-wiring",
    "panel-without-id",
    "tab-link-without-panel",
    "tab-without-link",
    "tab-list-without-name",
    "text-in-label",
    "value-without-field",
    "error-text-contradicts",
    "removed-attribute",
    "id-from-component",
];

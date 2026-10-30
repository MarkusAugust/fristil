//! The accessibility tree a browser builds from a page: for every element
//! that is exposed, its role, name, description and states.
//!
//! What a screen reader is given is a function of the page, and the parts of
//! it the specifications define are computed here: the roles from HTML-AAM,
//! the name and description from AccName 1.2, the states from Core-AAM. The
//! rest is the browser's, and the core does not guess it:
//!
//! - **What the browser computed.** The core has no style engine, and cannot
//!   see focus or a field's value. The host, which has a browser, writes
//!   those facts on each element before it asks, under the names in
//!   [`FACTS`], which the host reads from here. An element without them is
//!   refused, never read as visible.
//! - **What the platform calls it.** The roles here are WAI-ARIA roles. The
//!   names AT-SPI gives them are in `platform.ts`, with the browsers'
//!   deviations, and nowhere else.
//! - **Timing and events.** Which events a change gives, and in what order,
//!   is the browser's.
//!
//! Where AccName leaves a choice to the browser, the choice here is the one
//! the browsers were seen to make, and `check-accessibility-tree.ts` compares
//! this tree with what Chromium and Firefox give through AT-SPI on every
//! contract step, so a browser that chooses otherwise fails the run. The one
//! such choice is the space around block-level content (accname issue #225).
//!
//! The page is read by [`walk`], the same reading the checks use.

use crate::diagnose::ReadAttribute;
use crate::json_string;
use crate::references::{decode, page_source, walk, Item};
use crate::text::*;

/// The facts the host writes on every element, from what the browser
/// computed. The host reads this list from the core (`accessibility_facts_raw`).
pub const FACTS: &[&str] = &[
    // "1" when the element is rendered and not `visibility: hidden`.
    "data-lt-ax-visible",
    // The computed `display`.
    "data-lt-ax-display",
    // The computed `content` of `::before` and `::after`.
    "data-lt-ax-before",
    "data-lt-ax-after",
    // "1" on the focused element, a checked or indeterminate checkbox or
    // radio, a disabled control, and a modal dialog.
    "data-lt-ax-focused",
    "data-lt-ax-checked",
    "data-lt-ax-mixed",
    "data-lt-ax-disabled",
    "data-lt-ax-modal",
    // The value of a text field, or the text of the chosen option.
    "data-lt-ax-value",
];

/// The states the core can give, by WAI-ARIA name. `platform.ts` maps each
/// to AT-SPI or says why it cannot be compared; a guard requires one or the
/// other for every name here.
pub const STATES: &[&str] = &[
    "busy",
    "checked",
    "disabled",
    "expandable",
    "expanded",
    "focused",
    "invalid",
    "mixed",
    "modal",
    "pressed",
    "readonly",
    "required",
    "selected",
];

/// One exposed element.
#[derive(Clone, Debug, PartialEq)]
pub struct AxNode {
    pub role: String,
    pub name: String,
    pub description: String,
    /// Core-AAM states, by their WAI-ARIA names, sorted.
    pub states: Vec<&'static str>,
    pub id: Option<String>,
}

/// A WAI-ARIA role the core knows, and whether its name may come from its
/// content (WAI-ARIA 1.2, "Roles Supporting Name from Content").
struct Role {
    name: &'static str,
    from_content: bool,
}

const fn role(name: &'static str, from_content: bool) -> Role {
    Role { name, from_content }
}

/// The roles the core knows. An explicit `role` with none of them is
/// refused: WAI-ARIA would fall back to the element's own role, and a tree
/// built on a fallback the author did not mean is a guess.
const ROLES: &[Role] = &[
    role("alert", false),
    role("alertdialog", false),
    role("article", false),
    role("banner", false),
    role("button", true),
    role("cell", true),
    role("checkbox", true),
    role("columnheader", true),
    role("combobox", false),
    role("complementary", false),
    role("contentinfo", false),
    role("dialog", false),
    role("figure", false),
    role("form", false),
    role("generic", false),
    role("gridcell", true),
    role("group", false),
    role("heading", true),
    role("img", false),
    role("link", true),
    role("list", false),
    role("listbox", false),
    role("listitem", false),
    role("log", false),
    role("main", false),
    role("marquee", false),
    role("menu", false),
    role("menuitem", true),
    role("menuitemcheckbox", true),
    role("menuitemradio", true),
    role("navigation", false),
    role("none", false),
    role("note", false),
    role("option", true),
    role("paragraph", false),
    role("presentation", false),
    role("progressbar", false),
    role("radio", true),
    role("radiogroup", false),
    role("region", false),
    role("row", true),
    role("rowgroup", false),
    role("rowheader", true),
    role("search", false),
    role("searchbox", false),
    role("separator", false),
    role("slider", false),
    role("spinbutton", false),
    role("status", false),
    role("switch", true),
    role("tab", true),
    role("table", false),
    role("tablist", false),
    role("tabpanel", false),
    role("textbox", false),
    role("timer", false),
    role("tooltip", true),
    role("treeitem", true),
];

/// The names of the roles the core knows, for the guard that every role in
/// `platform.ts` is one of them.
pub fn roles() -> Vec<&'static str> {
    ROLES.iter().map(|r| r.name).collect()
}

fn known(name: &str) -> Option<&'static Role> {
    ROLES.iter().find(|r| r.name == name)
}

#[derive(Debug)]
enum Kind {
    Element {
        name: String,
        attributes: Vec<(String, String)>,
    },
    Text(String),
}

#[derive(Debug)]
struct DomNode {
    kind: Kind,
    parent: Option<usize>,
    children: Vec<usize>,
}

/// The page as elements and text, with the attributes decoded.
struct Dom {
    nodes: Vec<DomNode>,
}

impl Dom {
    /// The page as [`walk`] reads it from [`page_source`]: comments, raw
    /// text and template content are not part of it. Attribute values are
    /// read from the original text, which `page_source` blanks when they
    /// hold a `<`.
    fn parse(source: &[u16]) -> Dom {
        let page = page_source(source);
        let (elements, items) = walk(&page);
        let value = |a: &ReadAttribute| {
            a.value.as_ref().map_or(String::new(), |v| {
                lossy(&decode(&source[a.value_start..a.value_start + v.len()]))
            })
        };
        // The document is node 0, element `i` is node `i + 1`.
        let mut nodes: Vec<DomNode> = Vec::with_capacity(elements.len() + 1);
        nodes.push(DomNode {
            kind: Kind::Element {
                name: "#document".into(),
                attributes: vec![],
            },
            parent: None,
            children: vec![],
        });
        for e in &elements {
            let mut attributes: Vec<(String, String)> = Vec::new();
            for a in &e.attributes {
                let name = lossy(&a.name);
                // HTML keeps the first of two attributes with the same name.
                if !attributes.iter().any(|(n, _)| *n == name) {
                    attributes.push((name, value(a)));
                }
            }
            nodes.push(DomNode {
                kind: Kind::Element {
                    name: e.name.clone(),
                    attributes,
                },
                parent: Some(e.parent.map_or(0, |p| p + 1)),
                children: vec![],
            });
        }
        for item in items {
            match item {
                Item::Element(i) => {
                    let parent = nodes[i + 1].parent.unwrap_or(0);
                    nodes[parent].children.push(i + 1);
                }
                Item::Text { parent, start, end } => {
                    let parent = parent.map_or(0, |p| p + 1);
                    nodes.push(DomNode {
                        kind: Kind::Text(lossy(&decode(&page[start..end]))),
                        parent: Some(parent),
                        children: vec![],
                    });
                    let index = nodes.len() - 1;
                    nodes[parent].children.push(index);
                }
            }
        }
        Dom { nodes }
    }

    fn attribute(&self, n: usize, name: &str) -> Option<&str> {
        match &self.nodes[n].kind {
            Kind::Element { attributes, .. } => attributes
                .iter()
                .find(|(k, _)| k == name)
                .map(|(_, v)| v.as_str()),
            Kind::Text(_) => None,
        }
    }

    fn has(&self, n: usize, name: &str) -> bool {
        self.attribute(n, name).is_some()
    }

    fn name(&self, n: usize) -> Option<&str> {
        match &self.nodes[n].kind {
            Kind::Element { name, .. } => Some(name),
            Kind::Text(_) => None,
        }
    }

    fn by_id(&self, id: &str) -> Option<usize> {
        (0..self.nodes.len()).find(|&n| self.attribute(n, "id") == Some(id))
    }

    fn ancestors(&self, n: usize) -> impl Iterator<Item = usize> + '_ {
        std::iter::successors(self.nodes[n].parent, move |&p| self.nodes[p].parent)
    }

    fn is_true(&self, n: usize, name: &str) -> bool {
        self.attribute(n, name)
            .is_some_and(|v| v.trim().eq_ignore_ascii_case("true"))
    }

    fn fact(&self, n: usize, name: &str) -> bool {
        self.attribute(n, name) == Some("1")
    }
}

/// The role an element has: its first known `role` token, otherwise the
/// element's own from HTML-AAM.
fn role_of(dom: &Dom, n: usize) -> Result<&'static str, String> {
    if let Some(explicit) = dom.attribute(n, "role") {
        if !explicit.trim().is_empty() {
            return explicit
                .split_ascii_whitespace()
                .find_map(|t| known(&t.to_ascii_lowercase()).map(|r| r.name))
                .ok_or_else(|| {
                    format!(
                        "role=\"{explicit}\" has no role the core knows: it does not guess the fallback"
                    )
                });
        }
    }
    let Some(name) = dom.name(n) else {
        return Ok("generic");
    };
    let input_type = || {
        dom.attribute(n, "type")
            .unwrap_or("text")
            .to_ascii_lowercase()
    };
    Ok(match name {
        "a" | "area" if dom.has(n, "href") => "link",
        "button" => "button",
        "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => "heading",
        "ul" | "ol" | "menu" => "list",
        "li" => "listitem",
        "nav" => "navigation",
        "main" => "main",
        "p" => "paragraph",
        "dialog" => "dialog",
        "textarea" => "textbox",
        "select" if dom.has(n, "multiple") => "listbox",
        "select" => "combobox",
        "option" => "option",
        "fieldset" => "group",
        "progress" => "progressbar",
        "hr" => "separator",
        "article" => "article",
        "aside" => "complementary",
        "figure" => "figure",
        "table" => "table",
        "tr" => "row",
        "td" => "cell",
        "img" if dom.attribute(n, "alt") == Some("") => "presentation",
        "img" => "img",
        "section" if has_name_attribute(dom, n) => "region",
        "form" if has_name_attribute(dom, n) => "form",
        "search" => "search",
        "output" => "status",
        "details" => "group",
        "thead" | "tbody" | "tfoot" => "rowgroup",
        "th" => match dom.attribute(n, "scope").map(|v| v.to_ascii_lowercase()) {
            Some(v) if v == "row" || v == "rowgroup" => "rowheader",
            Some(v) if v == "col" || v == "colgroup" => "columnheader",
            // Without `scope`, browsers decide from the table's shape.
            _ => {
                return Err(
                    "<th> without scope: the browser decides from the table whether it heads a row or a column, and the core does not".into(),
                )
            }
        },
        // A header or footer is a landmark only outside sectioning content.
        "header" | "footer" => {
            let sectioned = dom.ancestors(n).any(|a| {
                matches!(
                    dom.name(a),
                    Some("article" | "aside" | "main" | "nav" | "section")
                )
            });
            match (name, sectioned) {
                (_, true) => "generic",
                ("header", false) => "banner",
                _ => "contentinfo",
            }
        }
        "input" => match input_type().as_str() {
            "checkbox" => "checkbox",
            "radio" => "radio",
            "button" | "submit" | "reset" | "image" => "button",
            "range" => "slider",
            "number" => "spinbutton",
            "search" if !dom.has(n, "list") => "searchbox",
            "hidden" => "none",
            _ if dom.has(n, "list") => "combobox",
            _ => "textbox",
        },
        // An autonomous custom element has no role of its own.
        tag if tag.contains('-') => "generic",
        tag if GENERIC.contains(&tag) => "generic",
        tag => {
            return Err(format!(
                "<{tag}> has a role the core does not know: it does not guess"
            ))
        }
    })
}

/// Elements HTML-AAM maps to `generic` or to no role, and the document's
/// own elements, which are not in the tree.
const GENERIC: &[&str] = &[
    "#document",
    "abbr",
    "address",
    "b",
    "bdi",
    "bdo",
    "body",
    "br",
    "caption",
    "cite",
    "code",
    "col",
    "colgroup",
    "data",
    "dd",
    "del",
    "dfn",
    "div",
    "dl",
    "dt",
    "em",
    "figcaption",
    "form",
    "head",
    "html",
    "i",
    "ins",
    "kbd",
    "label",
    "legend",
    "link",
    "mark",
    "meta",
    "noscript",
    "picture",
    "pre",
    "q",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "script",
    "section",
    "slot",
    "small",
    "source",
    "span",
    "strong",
    "style",
    "sub",
    "sup",
    "template",
    "time",
    "title",
    "track",
    "u",
    "var",
    "wbr",
    "a",
    "area",
    "img",
    "input",
    "select",
];

fn has_name_attribute(dom: &Dom, n: usize) -> bool {
    ["aria-label", "aria-labelledby", "title"]
        .iter()
        .any(|a| dom.attribute(n, a).is_some_and(|v| !v.trim().is_empty()))
}

/// Whether the browser rendered the element. Text is rendered when its
/// parent is.
fn visible(dom: &Dom, n: usize) -> Result<bool, String> {
    match dom.name(n) {
        None => dom.nodes[n].parent.map_or(Ok(true), |p| visible(dom, p)),
        Some("#document") => Ok(true),
        Some(tag) => match dom.attribute(n, "data-lt-ax-visible") {
            Some("1") => Ok(true),
            Some("0") => Ok(false),
            _ => Err(missing(tag, "data-lt-ax-visible")),
        },
    }
}

fn missing(tag: &str, fact: &str) -> String {
    format!(
        "<{tag}> has no {fact}: the core does not compute what the browser computes, the host writes it"
    )
}

fn block(dom: &Dom, n: usize) -> Result<bool, String> {
    match dom.attribute(n, "data-lt-ax-display") {
        Some(d) => Ok(!matches!(d, "inline" | "contents" | "none")),
        None => Err(missing(dom.name(n).unwrap_or("?"), "data-lt-ax-display")),
    }
}

/// Hidden from the tree: not rendered, or `aria-hidden="true"` on it or above it.
fn excluded(dom: &Dom, n: usize) -> Result<bool, String> {
    let aria_hidden = std::iter::once(n)
        .chain(dom.ancestors(n))
        .any(|a| dom.is_true(a, "aria-hidden"));
    Ok(aria_hidden || !visible(dom, n)?)
}

/// The text CSS generates in `::before` or `::after`, from the computed
/// `content`. Only a plain string is read: anything else is refused.
fn generated(dom: &Dom, n: usize, fact: &str) -> Result<String, String> {
    // A replaced element has no `::before` or `::after` (CSS Pseudo-Elements
    // 4), whatever the browser's own value for it says: Firefox gives
    // `-moz-alt-content` on an image.
    if matches!(
        dom.name(n),
        Some(
            "img"
                | "input"
                | "textarea"
                | "select"
                | "video"
                | "audio"
                | "iframe"
                | "object"
                | "embed"
                | "canvas"
                | "br"
                | "hr"
        )
    ) {
        return Ok(String::new());
    }
    let Some(content) = dom.attribute(n, fact) else {
        return Err(missing(dom.name(n).unwrap_or("?"), fact));
    };
    let content = content.trim();
    if matches!(content, "" | "none" | "normal") {
        return Ok(String::new());
    }
    let quoted = content.len() >= 2
        && (content.starts_with('"') && content.ends_with('"')
            || content.starts_with('\'') && content.ends_with('\''));
    let inner = if quoted {
        &content[1..content.len() - 1]
    } else {
        ""
    };
    if !quoted || inner.contains(['"', '\'', '\\']) {
        return Err(format!(
            "<{}> has {fact}=\"{content}\": the core reads only a plain string",
            dom.name(n).unwrap_or("?")
        ));
    }
    Ok(inner.to_string())
}

#[derive(Clone, Copy, Default)]
struct Traversal {
    /// Computing a name from content, recursively (AccName 2F), or the
    /// content of a referenced node or a label.
    recursive: bool,
    /// Inside an `aria-labelledby` or `aria-describedby` traversal (2B).
    referenced: bool,
    /// The node the traversal started from was itself hidden, and so its
    /// hidden content counts (2A).
    hidden_root: bool,
}

/// Which step gave a name: `title` describes only when it did not name.
#[derive(Clone, Copy, PartialEq)]
enum From {
    Title,
    Other,
}

/// AccName 1.2, section 4.3.2, for the markup the core knows.
fn text_alternative(
    dom: &Dom,
    n: usize,
    t: Traversal,
    visited: &mut Vec<usize>,
) -> Result<(String, From), String> {
    if let Kind::Text(text) = &dom.nodes[n].kind {
        return Ok((text.clone(), From::Other));
    }
    // The cycle guard: a node is not part of its own content.
    if visited.contains(&n) {
        return Ok((String::new(), From::Other));
    }
    visited.push(n);
    let result = alternative(dom, n, t, visited);
    visited.pop();
    result
}

fn alternative(
    dom: &Dom,
    n: usize,
    t: Traversal,
    visited: &mut Vec<usize>,
) -> Result<(String, From), String> {
    // 2A: hidden, unless the traversal started at a hidden node.
    if !t.hidden_root && excluded(dom, n)? {
        return Ok((String::new(), From::Other));
    }
    let r = role_of(dom, n)?;
    let embedded = matches!(
        r,
        "textbox" | "searchbox" | "combobox" | "listbox" | "slider" | "spinbutton"
    );
    // 2B: aria-labelledby, unless already in such a traversal. A node may
    // name itself in the list, and is then computed from 2C on.
    if !t.referenced {
        if let Some(ids) = dom.attribute(n, "aria-labelledby") {
            let mut parts = Vec::new();
            for id in ids.split_ascii_whitespace() {
                let Some(target) = dom.by_id(id) else {
                    continue;
                };
                let traversal = Traversal {
                    recursive: target != n,
                    referenced: true,
                    hidden_root: excluded(dom, target)?,
                };
                let part = if target == n {
                    alternative(dom, n, traversal, visited)?.0
                } else {
                    text_alternative(dom, target, traversal, visited)?.0
                };
                parts.push(part);
            }
            let joined = flat(&parts.join(" "));
            if !joined.is_empty() {
                return Ok((joined, From::Other));
            }
        }
    }
    // 2C: aria-label, except on an embedded control inside a label, which
    // gives its value instead (2E).
    let in_label = t.recursive;
    if !(in_label && embedded) {
        if let Some(label) = dom.attribute(n, "aria-label") {
            if !label.trim().is_empty() {
                return Ok((label.trim().to_string(), From::Other));
            }
        }
    }
    // 2D: the host language's own label, unless the role is none or
    // presentation, also inside content (an image's `alt` in a link). An
    // embedded control inside a label goes to 2E instead: its own label is
    // the one being computed.
    if !(in_label && embedded) && !matches!(r, "presentation" | "none") {
        if let Some((native, from)) = native_label(dom, n, visited)? {
            if !native.is_empty() {
                return Ok((native, from));
            }
        }
    }
    // 2E: an embedded control inside a label gives its value.
    if in_label && embedded {
        return Ok((
            dom.attribute(n, "data-lt-ax-value")
                .map(|v| v.trim().to_string())
                .unwrap_or_default(),
            From::Other,
        ));
    }
    // 2F: name from content.
    let from_content = known(r).is_some_and(|k| k.from_content);
    if t.recursive || t.referenced || from_content {
        let mut out = generated(dom, n, "data-lt-ax-before")?;
        for &c in &dom.nodes[n].children {
            let inner = Traversal {
                recursive: true,
                ..t
            };
            let (part, _) = text_alternative(dom, c, inner, visited)?;
            if dom.name(c).is_some() && block(dom, c)? {
                out.push(' ');
                out.push_str(&part);
                out.push(' ');
            } else {
                out.push_str(&part);
            }
        }
        out.push_str(&generated(dom, n, "data-lt-ax-after")?);
        let out = flat(&out);
        if !out.is_empty() {
            return Ok((out, From::Other));
        }
    }
    // 2I: the tooltip attribute.
    Ok(dom
        .attribute(n, "title")
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .map_or((String::new(), From::Other), |v| (v, From::Title)))
}

/// HTML-AAM's own labels: `<label>` for a form control, then `title`, then
/// `placeholder` for a text field; the value of a button input; `alt` on an
/// image; `<legend>`, `<caption>` and `<figcaption>`.
fn native_label(
    dom: &Dom,
    n: usize,
    visited: &mut Vec<usize>,
) -> Result<Option<(String, From)>, String> {
    let content = |c: usize, visited: &mut Vec<usize>| -> Result<String, String> {
        let traversal = Traversal {
            recursive: true,
            referenced: false,
            hidden_root: excluded(dom, c)?,
        };
        Ok(text_alternative(dom, c, traversal, visited)?.0)
    };
    let tag = dom.name(n).unwrap_or("");
    let input_type = dom
        .attribute(n, "type")
        .unwrap_or("text")
        .to_ascii_lowercase();
    if tag == "input" && matches!(input_type.as_str(), "submit" | "reset" | "button") {
        return match dom.attribute(n, "value") {
            Some(v) => Ok(Some((v.trim().to_string(), From::Other))),
            // The browser's own word, in the browser's language: HTML-AAM
            // leaves it to the implementation.
            None if input_type != "button" => Err(format!(
                "<input type=\"{input_type}\"> without a value has the browser's own label, which the core does not know"
            )),
            None => Ok(None),
        };
    }
    match tag {
        "input" | "textarea" | "select" | "button" | "progress" | "meter" | "output" => {
            let mut labels: Vec<usize> = Vec::new();
            if let Some(id) = dom.attribute(n, "id") {
                labels.extend((0..dom.nodes.len()).filter(|&l| {
                    dom.name(l) == Some("label") && dom.attribute(l, "for") == Some(id)
                }));
            }
            if let Some(wrapping) = dom.ancestors(n).find(|&a| dom.name(a) == Some("label")) {
                if !labels.contains(&wrapping) && !dom.has(wrapping, "for") {
                    labels.push(wrapping);
                }
            }
            // The control itself is not part of its own label's text.
            visited.push(n);
            let parts: Result<Vec<String>, String> =
                labels.iter().map(|&l| content(l, visited)).collect();
            visited.pop();
            let label = flat(&parts?.join(" "));
            if !label.is_empty() {
                return Ok(Some((label, From::Other)));
            }
            // For a field, HTML-AAM puts `title` and `placeholder` here; for
            // a button, after the content (2F, then 2I).
            if !matches!(tag, "input" | "textarea" | "select") {
                return Ok(None);
            }
            if let Some(title) = dom.attribute(n, "title").filter(|v| !v.trim().is_empty()) {
                return Ok(Some((title.trim().to_string(), From::Title)));
            }
            if matches!(tag, "input" | "textarea") {
                if let Some(p) = dom.attribute(n, "placeholder") {
                    return Ok(Some((p.trim().to_string(), From::Other)));
                }
            }
            Ok(None)
        }
        "img" => Ok(dom
            .attribute(n, "alt")
            .map(|a| (a.trim().to_string(), From::Other))),
        "fieldset" | "table" | "figure" => {
            let child = match tag {
                "fieldset" => "legend",
                "table" => "caption",
                _ => "figcaption",
            };
            let found = dom.nodes[n]
                .children
                .iter()
                .copied()
                .find(|&c| dom.name(c) == Some(child));
            found
                .map(|c| content(c, visited).map(|s| (s, From::Other)))
                .transpose()
        }
        _ => Ok(None),
    }
}

/// Whitespace collapsed and trimmed, as AccName's "flat string".
fn flat(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// AccName 1.2, section 4.2: the first applicable source, `aria-describedby`,
/// then `aria-description`, then `title` when it did not give the name.
fn description(dom: &Dom, n: usize, named_by: From) -> Result<String, String> {
    if let Some(ids) = dom.attribute(n, "aria-describedby") {
        let mut parts = Vec::new();
        for id in ids.split_ascii_whitespace() {
            let Some(target) = dom.by_id(id) else {
                continue;
            };
            let traversal = Traversal {
                recursive: true,
                referenced: true,
                hidden_root: excluded(dom, target)?,
            };
            parts.push(text_alternative(dom, target, traversal, &mut vec![n])?.0);
        }
        let joined = flat(&parts.join(" "));
        if !joined.is_empty() {
            return Ok(joined);
        }
    }
    if let Some(d) = dom.attribute(n, "aria-description") {
        return Ok(d.trim().to_string());
    }
    if named_by == From::Title {
        return Ok(String::new());
    }
    Ok(dom
        .attribute(n, "title")
        .map(|t| t.trim().to_string())
        .unwrap_or_default())
}

/// The element focus is on for a screen reader: the focused element, or the
/// element its `aria-activedescendant` points at, when that exists and is
/// shown. Core-AAM 1.2 gives the active descendant the focus state and the
/// focus events.
fn focused_node(dom: &Dom) -> Result<Option<usize>, String> {
    let Some(focused) = (0..dom.nodes.len()).find(|&n| dom.fact(n, "data-lt-ax-focused")) else {
        return Ok(None);
    };
    if let Some(id) = dom.attribute(focused, "aria-activedescendant") {
        if let Some(active) = dom.by_id(id.trim()) {
            if !excluded(dom, active)? {
                return Ok(Some(active));
            }
        }
    }
    Ok(Some(focused))
}

/// Core-AAM 1.2 states, by WAI-ARIA name. A native state, which only the
/// browser knows, wins over the same `aria-*` attribute.
fn states(dom: &Dom, n: usize, role: &str, focus: Option<usize>) -> Vec<&'static str> {
    let mut out = Vec::new();
    let native_check = dom.name(n) == Some("input")
        && dom
            .attribute(n, "type")
            .is_some_and(|t| t.eq_ignore_ascii_case("checkbox") || t.eq_ignore_ascii_case("radio"));
    if focus == Some(n) {
        out.push("focused");
    }
    if let Some(v) = dom.attribute(n, "aria-expanded") {
        out.push("expandable");
        if v.trim().eq_ignore_ascii_case("true") {
            out.push("expanded");
        }
    } else if role == "combobox" && dom.name(n) == Some("select") {
        // HTML-AAM: a `<select>` shown as a combo box has a popup, and so
        // can be expanded. Whether it is open now is the browser's, and not
        // in the facts; the contracts never open one.
        out.push("expandable");
    }
    if dom.is_true(n, "aria-selected") {
        out.push("selected");
    }
    let checkable = matches!(
        role,
        "checkbox"
            | "radio"
            | "switch"
            | "menuitemcheckbox"
            | "menuitemradio"
            | "option"
            | "treeitem"
    );
    if native_check {
        if dom.fact(n, "data-lt-ax-checked") {
            out.push("checked");
        }
        if dom.fact(n, "data-lt-ax-mixed") {
            out.push("mixed");
        }
    } else if checkable {
        match dom
            .attribute(n, "aria-checked")
            .map(|v| v.trim().to_ascii_lowercase())
        {
            Some(v) if v == "true" => out.push("checked"),
            Some(v) if v == "mixed" => out.push("mixed"),
            _ => {}
        }
    }
    if dom.is_true(n, "aria-pressed") {
        out.push("pressed");
    }
    if dom.attribute(n, "aria-invalid").is_some_and(|v| {
        let v = v.trim().to_ascii_lowercase();
        !v.is_empty() && v != "false"
    }) {
        out.push("invalid");
    }
    if dom.has(n, "required") || dom.is_true(n, "aria-required") {
        out.push("required");
    }
    if dom.is_true(n, "aria-busy") {
        out.push("busy");
    }
    if dom.is_true(n, "aria-modal") || dom.fact(n, "data-lt-ax-modal") {
        out.push("modal");
    }
    if dom.fact(n, "data-lt-ax-disabled") || dom.is_true(n, "aria-disabled") {
        out.push("disabled");
    }
    if dom.has(n, "readonly") || dom.is_true(n, "aria-readonly") {
        out.push("readonly");
    }
    out.sort_unstable();
    out
}

/// The exposed elements on the page, in document order.
///
/// Refuses, with the reason, when an element lacks the facts the browser
/// must give, or holds what the core does not compute: an answer computed
/// from a guess would look like a real one.
pub fn accessibility_tree(source: &[u16]) -> Result<Vec<AxNode>, String> {
    let dom = Dom::parse(source);
    let focus = focused_node(&dom)?;
    let mut out = Vec::new();
    for n in 1..dom.nodes.len() {
        let Some(tag) = dom.name(n) else { continue };
        if matches!(tag, "html" | "head" | "body")
            || dom.ancestors(n).any(|a| dom.name(a) == Some("head"))
        {
            continue;
        }
        let r = role_of(&dom, n)?;
        if matches!(r, "generic" | "none" | "presentation") || excluded(&dom, n)? {
            continue;
        }
        let (name, from) = text_alternative(&dom, n, Traversal::default(), &mut vec![])?;
        out.push(AxNode {
            role: r.to_string(),
            states: states(&dom, n, r, focus),
            description: description(&dom, n, from)?,
            name,
            id: dom.attribute(n, "id").map(str::to_string),
        });
    }
    Ok(out)
}

/// The tree as JSON: `[{"role","name","description","states","id"}]`.
pub fn to_json(nodes: &[AxNode]) -> String {
    let items: Vec<String> = nodes
        .iter()
        .map(|n| {
            format!(
                "{{\"role\":{},\"name\":{},\"description\":{},\"states\":[{}],\"id\":{}}}",
                json_string(&n.role),
                json_string(&n.name),
                json_string(&n.description),
                n.states
                    .iter()
                    .map(|s| json_string(s))
                    .collect::<Vec<_>>()
                    .join(","),
                n.id.as_deref().map_or("null".into(), json_string),
            )
        })
        .collect();
    format!("[{}]", items.join(","))
}

/// A list of names as a JSON array.
pub fn names_json(names: &[&str]) -> String {
    format!(
        "[{}]",
        names
            .iter()
            .map(|s| json_string(s))
            .collect::<Vec<_>>()
            .join(",")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Markup as the host gives it: every element with the facts a browser
    /// would compute for this small set of elements.
    fn rendered(html: &str) -> Vec<u16> {
        let mut out = String::new();
        let mut rest = html;
        while let Some(at) = rest.find('<') {
            out.push_str(&rest[..at]);
            rest = &rest[at..];
            let starts_tag = rest[1..]
                .chars()
                .next()
                .is_some_and(|c| c.is_ascii_alphabetic());
            let end = rest.find('>').unwrap();
            if starts_tag {
                let tag = &rest[..end];
                let (tag, closing) = tag.strip_suffix('/').map_or((tag, ""), |t| (t, "/"));
                let hidden = tag.contains(" hidden");
                let block = [
                    "<div", "<p", "<h2", "<ul", "<li", "<section", "<dialog", "<lt-",
                ]
                .iter()
                .any(|b| tag.starts_with(b));
                out.push_str(&format!(
                    "{tag} data-lt-ax-visible=\"{}\" data-lt-ax-display=\"{}\" data-lt-ax-before=\"none\" data-lt-ax-after=\"none\"{closing}>",
                    if hidden { 0 } else { 1 },
                    if hidden {
                        "none"
                    } else if block {
                        "block"
                    } else {
                        "inline"
                    }
                ));
            } else {
                out.push_str(&rest[..=end]);
            }
            rest = &rest[end + 1..];
        }
        out.push_str(rest);
        utf16(&out)
    }

    fn tree(html: &str) -> Vec<AxNode> {
        accessibility_tree(&rendered(html)).unwrap()
    }

    fn node<'a>(tree: &'a [AxNode], role: &str) -> &'a AxNode {
        tree.iter()
            .find(|n| n.role == role)
            .unwrap_or_else(|| panic!("no {role} in {tree:#?}"))
    }

    #[test]
    fn names_the_error_summary_from_its_heading() {
        let tree = tree(
            r##"<lt-error-summary role="alert" tabindex="-1" aria-labelledby="t" data-lt-ax-focused="1"><h2 id="t">There is a problem</h2><ul><li><a href="#email">Enter an email</a></li></ul></lt-error-summary>"##,
        );
        let alert = node(&tree, "alert");
        assert_eq!(alert.name, "There is a problem");
        assert_eq!(alert.states, vec!["focused"]);
        assert_eq!(node(&tree, "link").name, "Enter an email");
    }

    #[test]
    fn an_alert_is_not_named_from_its_content() {
        // WAI-ARIA 1.2: alert is "Name From: author". The component's
        // aria-labelledby is what names it.
        let tree = tree(
            r##"<lt-error-summary role="alert"><h2>There is a problem</h2></lt-error-summary>"##,
        );
        assert_eq!(node(&tree, "alert").name, "");
    }

    #[test]
    fn a_reference_counts_hidden_text_and_follows_no_second_reference() {
        let tree = tree(
            r##"<a href="#a" aria-labelledby="x"></a><span id="x" hidden aria-labelledby="y">Enclosures</span><span id="y">Wrong</span>"##,
        );
        assert_eq!(node(&tree, "link").name, "Enclosures");
    }

    #[test]
    fn hidden_content_of_a_visible_reference_does_not_count() {
        // AccName 2A: only a node referenced directly while hidden brings
        // its hidden content.
        let tree = tree(
            r##"<a href="#a" aria-labelledby="x"></a><p id="x">Shown <span hidden>secret</span></p>"##,
        );
        assert_eq!(node(&tree, "link").name, "Shown");
    }

    #[test]
    fn a_node_may_name_itself_in_its_own_list() {
        let tree = tree(
            r##"<button id="b" aria-labelledby="b x" aria-label="Delete">x</button><span id="x">the file</span>"##,
        );
        assert_eq!(node(&tree, "button").name, "Delete the file");
    }

    #[test]
    fn a_control_inside_a_label_gives_its_value() {
        let tree = tree(
            r##"<label for="n">Flush every <input id="m" aria-label="ignored" data-lt-ax-value="5"> minutes</label><input id="n">"##,
        );
        let fields: Vec<&AxNode> = tree.iter().filter(|n| n.role == "textbox").collect();
        assert_eq!(fields[1].name, "Flush every 5 minutes");
    }

    #[test]
    fn labels_a_control_by_for_and_by_wrapping() {
        let tree = tree(
            r##"<label for="e">Email</label><input id="e" type="email" required aria-describedby="h"><p id="h">We never send spam</p><label>Name <input></label>"##,
        );
        let fields: Vec<&AxNode> = tree.iter().filter(|n| n.role == "textbox").collect();
        assert_eq!(fields[0].name, "Email");
        assert_eq!(fields[0].description, "We never send spam");
        assert_eq!(fields[0].states, vec!["required"]);
        assert_eq!(fields[1].name, "Name");
    }

    #[test]
    fn title_names_or_describes_but_not_both() {
        let tree = tree(
            r##"<button title="Close"></button><button title="Closes the dialog">Close</button>"##,
        );
        let buttons: Vec<&AxNode> = tree.iter().filter(|n| n.role == "button").collect();
        assert_eq!(
            (buttons[0].name.as_str(), buttons[0].description.as_str()),
            ("Close", "")
        );
        assert_eq!(
            (buttons[1].name.as_str(), buttons[1].description.as_str()),
            ("Close", "Closes the dialog")
        );
    }

    #[test]
    fn generated_content_is_part_of_the_name() {
        let html = String::from_utf16(&rendered(r##"<label for="e">Email</label><input id="e">"##))
            .unwrap()
            .replacen(
                "data-lt-ax-after=\"none\">Email",
                "data-lt-ax-after='\" (required)\"'>Email",
                1,
            );
        let tree = accessibility_tree(&utf16(&html)).unwrap();
        assert_eq!(node(&tree, "textbox").name, "Email (required)");
    }

    #[test]
    fn hidden_elements_are_not_in_the_tree() {
        let tree = tree(
            r##"<button hidden>Gone</button><button aria-hidden="true">Gone too</button><button>Here</button>"##,
        );
        assert_eq!(
            tree.iter().map(|n| n.name.as_str()).collect::<Vec<_>>(),
            vec!["Here"]
        );
    }

    #[test]
    fn comments_and_templates_are_not_text() {
        let tree = tree(r##"<button>Save<!-- not this --><template>nor this</template></button>"##);
        assert_eq!(node(&tree, "button").name, "Save");
    }

    #[test]
    fn refuses_what_it_would_have_to_guess() {
        let no_facts = accessibility_tree(&utf16("<button>Save</button>")).unwrap_err();
        assert!(no_facts.contains("data-lt-ax-visible"), "{no_facts}");
        let unknown_role =
            accessibility_tree(&rendered(r##"<div role="widget">x</div>"##)).unwrap_err();
        assert!(unknown_role.contains("role=\"widget\""), "{unknown_role}");
        let default_label =
            accessibility_tree(&rendered(r##"<input type="submit">"##)).unwrap_err();
        assert!(
            default_label.contains("browser's own label"),
            "{default_label}"
        );
    }

    #[test]
    fn native_checked_wins_over_aria_checked() {
        let tree = tree(
            r##"<input type="checkbox" aria-checked="true"><div role="checkbox" aria-checked="mixed">x</div>"##,
        );
        let boxes: Vec<&AxNode> = tree.iter().filter(|n| n.role == "checkbox").collect();
        assert!(boxes[0].states.is_empty(), "{:?}", boxes[0].states);
        assert_eq!(boxes[1].states, vec!["mixed"]);
    }

    #[test]
    fn an_image_in_a_link_gives_its_alt() {
        // Found by comparing the core with Chromium and Firefox through AT-SPI.
        let tree = tree(r##"<a href="#a"><img alt="Attachments"></a>"##);
        assert_eq!(node(&tree, "link").name, "Attachments");
    }

    #[test]
    fn focus_follows_the_active_descendant() {
        // Found by comparing the core with Chromium and Firefox through AT-SPI.
        let tree = tree(
            r##"<input role="combobox" aria-expanded="true" aria-activedescendant="o2" data-lt-ax-focused="1"><ul role="listbox"><li role="option" id="o1">Oslo</li><li role="option" id="o2" aria-selected="true">Bergen</li></ul>"##,
        );
        let focused: Vec<&str> = tree
            .iter()
            .filter(|n| n.states.contains(&"focused"))
            .map(|n| n.name.as_str())
            .collect();
        assert_eq!(focused, vec!["Bergen"]);
    }

    #[test]
    fn a_native_select_can_be_expanded() {
        let tree = tree(r##"<select><option>Oslo</option></select>"##);
        assert_eq!(node(&tree, "combobox").states, vec!["expandable"]);
    }

    #[test]
    fn block_content_is_separated_by_spaces() {
        let tree = tree(r##"<a href="#x"><div>One</div><div>Two</div></a>"##);
        assert_eq!(node(&tree, "link").name, "One Two");
    }
}

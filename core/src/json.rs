//! A small JSON reader, without dependencies.
//!
//! It reads the manifest, which LO-TEK writes itself, but also files the user
//! has written: the recipe for `lotek theme`, package.json and the messages
//! from the editor. It does not need to be fast or forgiving, but it must
//! answer like `JSON.parse`, which the CLI used when it was written in
//! TypeScript. An object keeps the order of its keys, because the order in
//! the manifest is the order the messages list the values in, and the one
//! that decides which suggestion wins at equal distance. A key that appears
//! twice gets the last value in the first position, as in `JSON.parse`.
//! Numbers and strings follow the grammar in RFC 8259, so `0700`, `1.` and a
//! raw line break in a string are errors, not numbers and text.

/// How many objects and arrays nested inside each other are read. The reader
/// descends recursively, and a file with a hundred thousand `[` would
/// otherwise overflow the stack instead of giving an error message.
const MAX_DEPTH: usize = 128;

#[derive(Clone, Debug, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<Json>),
    Object(Vec<(String, Json)>),
}

impl Json {
    pub fn get(&self, key: &str) -> Option<&Json> {
        match self {
            Json::Object(entries) => entries.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Json::String(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_array(&self) -> Option<&[Json]> {
        match self {
            Json::Array(items) => Some(items),
            _ => None,
        }
    }

    pub fn as_object(&self) -> Option<&[(String, Json)]> {
        match self {
            Json::Object(entries) => Some(entries),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Json::Number(n) => Some(*n),
            _ => None,
        }
    }

    /// The value as text, indented with two spaces, like
    /// `JSON.stringify(value, null, 2)`.
    pub fn to_pretty(&self) -> String {
        let mut out = String::new();
        self.write(&mut out, 0);
        out
    }

    /// The value as text on one line, like `JSON.stringify(value)`.
    pub fn to_compact(&self) -> String {
        let mut out = String::new();
        self.write_with(&mut out, None);
        out
    }

    fn write(&self, out: &mut String, depth: usize) {
        self.write_with(out, Some(depth));
    }

    /// `depth` is the indentation, or `None` for everything on one line.
    fn write_with(&self, out: &mut String, depth: Option<usize>) {
        let indent = |out: &mut String, depth: Option<usize>| {
            if let Some(depth) = depth {
                out.push('\n');
                out.push_str(&"  ".repeat(depth));
            }
        };
        let inner = depth.map(|d| d + 1);
        let colon = if depth.is_some() { ": " } else { ":" };
        match self {
            Json::Null => out.push_str("null"),
            Json::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
            // `JSON.stringify` writes `Infinity` and `NaN` as `null`. A number
            // like `1e400` is read as infinity, as in `JSON.parse`.
            Json::Number(n) if !n.is_finite() => out.push_str("null"),
            Json::Number(n) => out.push_str(&crate::theme::js_number(*n)),
            Json::String(s) => out.push_str(&crate::json_string(s)),
            Json::Array(items) if items.is_empty() => out.push_str("[]"),
            Json::Object(entries) if entries.is_empty() => out.push_str("{}"),
            Json::Array(items) => {
                out.push('[');
                for (i, item) in items.iter().enumerate() {
                    if i > 0 {
                        out.push(',');
                    }
                    indent(out, inner);
                    item.write_with(out, inner);
                }
                indent(out, depth);
                out.push(']');
            }
            Json::Object(entries) => {
                out.push('{');
                for (i, (key, value)) in entries.iter().enumerate() {
                    if i > 0 {
                        out.push(',');
                    }
                    indent(out, inner);
                    out.push_str(&crate::json_string(key));
                    out.push_str(colon);
                    value.write_with(out, inner);
                }
                indent(out, depth);
                out.push('}');
            }
        }
    }
}

/// Reads one JSON value. The error message says where in the text it stopped.
pub fn parse(text: &str) -> Result<Json, String> {
    let mut parser = Parser {
        bytes: text.as_bytes(),
        at: 0,
        depth: 0,
    };
    parser.skip_space();
    let value = parser.value()?;
    parser.skip_space();
    if parser.at != parser.bytes.len() {
        return Err(parser.error("text after the value"));
    }
    Ok(value)
}

struct Parser<'a> {
    bytes: &'a [u8],
    at: usize,
    depth: usize,
}

impl Parser<'_> {
    fn error(&self, what: &str) -> String {
        format!("Invalid JSON at byte {}: {what}.", self.at)
    }

    fn peek(&self) -> Option<u8> {
        self.bytes.get(self.at).copied()
    }

    fn skip_space(&mut self) {
        while matches!(self.peek(), Some(b' ' | b'\n' | b'\r' | b'\t')) {
            self.at += 1;
        }
    }

    fn expect(&mut self, literal: &str) -> Result<(), String> {
        if self.bytes[self.at..].starts_with(literal.as_bytes()) {
            self.at += literal.len();
            Ok(())
        } else {
            Err(self.error(&format!("expected \"{literal}\"")))
        }
    }

    fn value(&mut self) -> Result<Json, String> {
        match self.peek() {
            Some(b'{' | b'[') => {
                if self.depth == MAX_DEPTH {
                    return Err(self.error(&format!(
                        "more than {MAX_DEPTH} objects and arrays nested inside each other"
                    )));
                }
                self.depth += 1;
                let value = if self.peek() == Some(b'{') {
                    self.object()
                } else {
                    self.array()
                };
                self.depth -= 1;
                value
            }
            Some(b'"') => Ok(Json::String(self.string()?)),
            Some(b't') => self.expect("true").map(|_| Json::Bool(true)),
            Some(b'f') => self.expect("false").map(|_| Json::Bool(false)),
            Some(b'n') => self.expect("null").map(|_| Json::Null),
            Some(b'-' | b'0'..=b'9') => self.number(),
            _ => Err(self.error("expected a value")),
        }
    }

    fn object(&mut self) -> Result<Json, String> {
        self.at += 1;
        let mut entries = Vec::new();
        self.skip_space();
        if self.peek() == Some(b'}') {
            self.at += 1;
            return Ok(Json::Object(entries));
        }
        loop {
            self.skip_space();
            if self.peek() != Some(b'"') {
                return Err(self.error("expected a key"));
            }
            let key = self.string()?;
            self.skip_space();
            self.expect(":")?;
            self.skip_space();
            let value = self.value()?;
            // `JSON.parse` lets the last value win, in the position of the
            // first.
            match entries.iter_mut().find(|entry| entry.0 == key) {
                Some(existing) => existing.1 = value,
                None => entries.push((key, value)),
            }
            self.skip_space();
            match self.peek() {
                Some(b',') => self.at += 1,
                Some(b'}') => {
                    self.at += 1;
                    return Ok(Json::Object(entries));
                }
                _ => return Err(self.error("expected \",\" or \"}\"")),
            }
        }
    }

    fn array(&mut self) -> Result<Json, String> {
        self.at += 1;
        let mut items = Vec::new();
        self.skip_space();
        if self.peek() == Some(b']') {
            self.at += 1;
            return Ok(Json::Array(items));
        }
        loop {
            self.skip_space();
            items.push(self.value()?);
            self.skip_space();
            match self.peek() {
                Some(b',') => self.at += 1,
                Some(b']') => {
                    self.at += 1;
                    return Ok(Json::Array(items));
                }
                _ => return Err(self.error("expected \",\" or \"]\"")),
            }
        }
    }

    fn hex4(&mut self) -> Result<u32, String> {
        let digits = self
            .bytes
            .get(self.at..self.at + 4)
            // Four hexadecimal digits, nothing more: `from_str_radix` accepts
            // a leading `+`, and `\u+041` is not valid JSON.
            .filter(|b| b.iter().all(u8::is_ascii_hexdigit))
            .and_then(|b| std::str::from_utf8(b).ok())
            .and_then(|s| u32::from_str_radix(s, 16).ok())
            .ok_or_else(|| self.error("invalid \\u sequence"))?;
        self.at += 4;
        Ok(digits)
    }

    fn string(&mut self) -> Result<String, String> {
        self.at += 1;
        let mut out = String::new();
        loop {
            let start = self.at;
            while !matches!(self.peek(), Some(b'"' | b'\\' | 0..=0x1f) | None) {
                self.at += 1;
            }
            out.push_str(
                std::str::from_utf8(&self.bytes[start..self.at])
                    .map_err(|_| self.error("invalid UTF-8"))?,
            );
            match self.peek() {
                Some(b'"') => {
                    self.at += 1;
                    return Ok(out);
                }
                Some(b'\\') => {
                    self.at += 1;
                    let escape = self.peek().ok_or_else(|| self.error("the string ends"))?;
                    self.at += 1;
                    match escape {
                        b'"' => out.push('"'),
                        b'\\' => out.push('\\'),
                        b'/' => out.push('/'),
                        b'b' => out.push('\u{8}'),
                        b'f' => out.push('\u{c}'),
                        b'n' => out.push('\n'),
                        b'r' => out.push('\r'),
                        b't' => out.push('\t'),
                        b'u' => {
                            let first = self.hex4()?;
                            let mut code = first;
                            if (0xD800..0xDC00).contains(&first)
                                && self.bytes[self.at..].starts_with(b"\\u")
                            {
                                let back = self.at;
                                self.at += 2;
                                let second = self.hex4()?;
                                if (0xDC00..0xE000).contains(&second) {
                                    code = 0x10000 + ((first - 0xD800) << 10) + (second - 0xDC00);
                                } else {
                                    // Not a pair: the second is read on its own.
                                    self.at = back;
                                }
                            }
                            // A lone surrogate becomes U+FFFD, which is also one
                            // UTF-16 unit, so the positions after it stay.
                            out.push(char::from_u32(code).unwrap_or('\u{fffd}'));
                        }
                        _ => return Err(self.error("unknown escape")),
                    }
                }
                Some(0..=0x1f) => return Err(self.error("control character in a string")),
                _ => return Err(self.error("the string ends")),
            }
        }
    }

    fn digits(&mut self) -> usize {
        let start = self.at;
        while matches!(self.peek(), Some(b'0'..=b'9')) {
            self.at += 1;
        }
        self.at - start
    }

    /// `-? (0 | [1-9][0-9]*) (. [0-9]+)? ([eE] [+-]? [0-9]+)?`
    fn number(&mut self) -> Result<Json, String> {
        let start = self.at;
        if self.peek() == Some(b'-') {
            self.at += 1;
        }
        match self.peek() {
            Some(b'0') => {
                self.at += 1;
                if matches!(self.peek(), Some(b'0'..=b'9')) {
                    return Err(self.error("a number cannot start with 0"));
                }
            }
            Some(b'1'..=b'9') => {
                self.digits();
            }
            _ => return Err(self.error("invalid number")),
        }
        if self.peek() == Some(b'.') {
            self.at += 1;
            if self.digits() == 0 {
                return Err(self.error("invalid number"));
            }
        }
        if matches!(self.peek(), Some(b'e' | b'E')) {
            self.at += 1;
            if matches!(self.peek(), Some(b'+' | b'-')) {
                self.at += 1;
            }
            if self.digits() == 0 {
                return Err(self.error("invalid number"));
            }
        }
        std::str::from_utf8(&self.bytes[start..self.at])
            .ok()
            .and_then(|s| s.parse::<f64>().ok())
            .map(Json::Number)
            .ok_or_else(|| self.error("invalid number"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_what_the_manifest_uses() {
        let v = parse(r#"{"b": [1, -2.5e1, true, null], "a": "x\"ø🧾"}"#).unwrap();
        let keys: Vec<_> = v
            .as_object()
            .unwrap()
            .iter()
            .map(|(k, _)| k.as_str())
            .collect();
        assert_eq!(keys, ["b", "a"], "the order of the keys is kept");
        assert_eq!(v.get("a").unwrap().as_str(), Some("x\"ø🧾"));
        assert_eq!(
            v.get("b").unwrap().as_array().unwrap()[1].as_f64(),
            Some(-25.0)
        );
    }

    #[test]
    fn reports_where_it_stops() {
        assert!(parse("{\"a\": }").unwrap_err().contains("byte 6"));
        assert!(parse("[1] 2").is_err());
    }

    #[test]
    fn writes_like_json_stringify() {
        let v = parse(r#"{"a": [1, 2.5, "x\"y"], "b": {}, "c": [], "d": {"e": null, "f": true}}"#)
            .unwrap();
        assert_eq!(
            v.to_pretty(),
            "{\n  \"a\": [\n    1,\n    2.5,\n    \"x\\\"y\"\n  ],\n  \"b\": {},\n  \"c\": [],\n  \"d\": {\n    \"e\": null,\n    \"f\": true\n  }\n}"
        );
        assert_eq!(parse(&v.to_pretty()).unwrap(), v);
        assert_eq!(
            v.to_compact(),
            r#"{"a":[1,2.5,"x\"y"],"b":{},"c":[],"d":{"e":null,"f":true}}"#
        );
        assert_eq!(
            parse("[1e-7, 1e21, 1e400, -1e400]").unwrap().to_compact(),
            "[1e-7,1e+21,null,null]"
        );
    }

    #[test]
    fn reads_lone_surrogates_without_changing_the_length() {
        let utf16_len = |v: Json| v.as_str().unwrap().encode_utf16().count();
        // Two high surrogates in a row, a high one before a line break, and a
        // low one alone: each becomes U+FFFD, and the UTF-16 length is the
        // same as in the original.
        assert_eq!(utf16_len(parse(r#""\uD800\uD800""#).unwrap()), 2);
        assert_eq!(utf16_len(parse(r#""\uD800\n""#).unwrap()), 2);
        assert_eq!(utf16_len(parse(r#""\uDC00x""#).unwrap()), 2);
        assert_eq!(parse(r#""\uD83E\uDDFE""#).unwrap().as_str(), Some("🧾"));
    }

    #[test]
    fn lets_the_last_duplicate_win_in_the_first_place_like_json_parse() {
        let v = parse(r#"{"a": 1, "b": 2, "a": 3}"#).unwrap();
        assert_eq!(v.to_compact(), r#"{"a":3,"b":2}"#);
        assert_eq!(v.get("a").unwrap().as_f64(), Some(3.0));
    }

    #[test]
    fn refuses_numbers_json_parse_refuses() {
        for bad in [
            "0700", "01", "-01", "1.", "-.5", ".5", "+1", "1e", "1e+", "-", "1.e3", "--1",
        ] {
            assert!(parse(bad).is_err(), "{bad} should have been invalid");
        }
        for (good, value) in [
            ("0", 0.0),
            ("-0.5", -0.5),
            ("10", 10.0),
            ("1e3", 1000.0),
            ("1E-2", 0.01),
            ("2.5e+1", 25.0),
        ] {
            assert_eq!(parse(good).unwrap().as_f64(), Some(value), "{good}");
        }
    }

    #[test]
    fn refuses_raw_control_characters_in_strings() {
        assert!(parse("\"a\u{1}b\"").is_err());
        assert!(parse("{\"a\nb\": 1}").is_err());
        assert!(parse("\"a\tb\"").is_err());
        assert_eq!(parse(r#""a\tb""#).unwrap().as_str(), Some("a\tb"));
    }

    #[test]
    fn refuses_deep_nesting_with_a_message_instead_of_overflowing() {
        let deep = |n: usize| format!("{}{}", "[".repeat(n), "]".repeat(n));
        assert!(parse(&deep(MAX_DEPTH)).is_ok());
        assert!(parse(&deep(MAX_DEPTH + 1))
            .unwrap_err()
            .contains("nested inside each other"));
        assert!(parse(&"[".repeat(200_000)).is_err());
        assert!(parse(&format!("{}{}", "{\"a\":".repeat(MAX_DEPTH + 1), "1")).is_err());
    }

    #[test]
    fn refuses_escapes_that_are_not_four_hex_digits() {
        assert!(parse(r#""\u+041""#).is_err());
        assert!(parse(r#""\u004""#).is_err());
        assert_eq!(parse(r#""\u0041""#).unwrap().as_str(), Some("A"));
    }
}

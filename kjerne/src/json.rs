//! En liten JSON-leser, uten avhengigheter.
//!
//! Kjernen leser bare manifestet, som Fristil selv skriver, så leseren trenger
//! ikke være rask eller tilgivende. Den må være riktig: et objekt beholder
//! rekkefølgen på nøklene, fordi rekkefølgen i manifestet er den meldingene
//! lister verdiene i, og den som avgjør hvilket forslag som vinner ved lik
//! avstand.

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

    /// Verdien som tekst, rykket inn med to mellomrom, som
    /// `JSON.stringify(verdi, null, 2)`.
    pub fn to_pretty(&self) -> String {
        let mut out = String::new();
        self.write(&mut out, 0);
        out
    }

    /// Verdien som tekst på én linje, som `JSON.stringify(verdi)`.
    pub fn to_compact(&self) -> String {
        let mut out = String::new();
        self.write_with(&mut out, None);
        out
    }

    fn write(&self, out: &mut String, depth: usize) {
        self.write_with(out, Some(depth));
    }

    /// `depth` er innrykket, eller `None` for alt på én linje.
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

/// Leser én JSON-verdi. Feilmeldingen sier hvor i teksten den stoppet.
pub fn parse(text: &str) -> Result<Json, String> {
    let mut parser = Parser {
        bytes: text.as_bytes(),
        at: 0,
    };
    parser.skip_space();
    let value = parser.value()?;
    parser.skip_space();
    if parser.at != parser.bytes.len() {
        return Err(parser.error("tekst etter verdien"));
    }
    Ok(value)
}

struct Parser<'a> {
    bytes: &'a [u8],
    at: usize,
}

impl Parser<'_> {
    fn error(&self, what: &str) -> String {
        format!("Ugyldig JSON ved byte {}: {what}.", self.at)
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
            Err(self.error(&format!("ventet «{literal}»")))
        }
    }

    fn value(&mut self) -> Result<Json, String> {
        match self.peek() {
            Some(b'{') => self.object(),
            Some(b'[') => self.array(),
            Some(b'"') => Ok(Json::String(self.string()?)),
            Some(b't') => self.expect("true").map(|_| Json::Bool(true)),
            Some(b'f') => self.expect("false").map(|_| Json::Bool(false)),
            Some(b'n') => self.expect("null").map(|_| Json::Null),
            Some(b'-' | b'0'..=b'9') => self.number(),
            _ => Err(self.error("ventet en verdi")),
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
                return Err(self.error("ventet en nøkkel"));
            }
            let key = self.string()?;
            self.skip_space();
            self.expect(":")?;
            self.skip_space();
            entries.push((key, self.value()?));
            self.skip_space();
            match self.peek() {
                Some(b',') => self.at += 1,
                Some(b'}') => {
                    self.at += 1;
                    return Ok(Json::Object(entries));
                }
                _ => return Err(self.error("ventet «,» eller «}»")),
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
                _ => return Err(self.error("ventet «,» eller «]»")),
            }
        }
    }

    fn hex4(&mut self) -> Result<u32, String> {
        let digits = self
            .bytes
            .get(self.at..self.at + 4)
            // Fire heksadesimale sifre, ikke mer: `from_str_radix` godtar et
            // `+` foran, og `\u+041` er ikke gyldig JSON.
            .filter(|b| b.iter().all(u8::is_ascii_hexdigit))
            .and_then(|b| std::str::from_utf8(b).ok())
            .and_then(|s| u32::from_str_radix(s, 16).ok())
            .ok_or_else(|| self.error("ugyldig \\u-sekvens"))?;
        self.at += 4;
        Ok(digits)
    }

    fn string(&mut self) -> Result<String, String> {
        self.at += 1;
        let mut out = String::new();
        loop {
            let start = self.at;
            while !matches!(self.peek(), Some(b'"' | b'\\') | None) {
                self.at += 1;
            }
            out.push_str(
                std::str::from_utf8(&self.bytes[start..self.at])
                    .map_err(|_| self.error("ugyldig UTF-8"))?,
            );
            match self.peek() {
                Some(b'"') => {
                    self.at += 1;
                    return Ok(out);
                }
                Some(b'\\') => {
                    self.at += 1;
                    let escape = self.peek().ok_or_else(|| self.error("strengen slutter"))?;
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
                                    // Ikke et par: den andre leses for seg.
                                    self.at = back;
                                }
                            }
                            // En surrogat alene blir U+FFFD, som også er én
                            // UTF-16-enhet, så posisjonene etter står.
                            out.push(char::from_u32(code).unwrap_or('\u{fffd}'));
                        }
                        _ => return Err(self.error("ukjent escape")),
                    }
                }
                _ => return Err(self.error("strengen slutter")),
            }
        }
    }

    fn number(&mut self) -> Result<Json, String> {
        let start = self.at;
        while matches!(
            self.peek(),
            Some(b'-' | b'+' | b'.' | b'e' | b'E' | b'0'..=b'9')
        ) {
            self.at += 1;
        }
        std::str::from_utf8(&self.bytes[start..self.at])
            .ok()
            .and_then(|s| s.parse::<f64>().ok())
            .map(Json::Number)
            .ok_or_else(|| self.error("ugyldig tall"))
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
        assert_eq!(keys, ["b", "a"], "rekkefølgen på nøklene står");
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
    }

    #[test]
    fn reads_lone_surrogates_without_changing_the_length() {
        let utf16_len = |v: Json| v.as_str().unwrap().encode_utf16().count();
        // To høye etter hverandre, en høy foran et linjeskift, og en lav alene:
        // hver blir U+FFFD, og lengden i UTF-16 er den samme som i originalen.
        assert_eq!(utf16_len(parse(r#""\uD800\uD800""#).unwrap()), 2);
        assert_eq!(utf16_len(parse(r#""\uD800\n""#).unwrap()), 2);
        assert_eq!(utf16_len(parse(r#""\uDC00x""#).unwrap()), 2);
        assert_eq!(parse(r#""\uD83E\uDDFE""#).unwrap().as_str(), Some("🧾"));
    }

    #[test]
    fn refuses_escapes_that_are_not_four_hex_digits() {
        assert!(parse(r#""\u+041""#).is_err());
        assert!(parse(r#""\u004""#).is_err());
        assert_eq!(parse(r#""\u0041""#).unwrap().as_str(), Some("A"));
    }
}

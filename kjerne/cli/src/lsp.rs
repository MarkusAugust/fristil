//! `fristil lsp`: språkserveren, over standard inn og ut.
//!
//! Den samme sjekken som `fristil sjekk`, mens du skriver, i hver editor som
//! snakker LSP: VS Code, Neovim, Zed, Helix og IntelliJ. Funnene blir
//! diagnostikk, med regelnavnet som kode og komponentsiden som lenke, og en
//! rettelse blir en hurtigrettelse.
//!
//! Ordforrådet er det prosjektet faktisk har. Serveren leter i
//! arbeidsområdet etter
//!
//! 1. `build/fristil/manifest.json`, som Gradle-pluginen skriver, med
//!    fragmentene fra `fristil overta`;
//! 2. `node_modules/@fristil/designsystem/manifest/manifest.json`, den
//!    installerte versjonen av pakken;
//!
//! og bruker det innebygde når ingen av dem finnes. Fila leses på nytt når
//! den endres, så et nytt bygg eller en oppgradering når editoren uten
//! omstart.
//!
//! Posisjonene er UTF-16, som LSP krever som standard og kjernen regner i.
//! Dokumentene sendes hele ved hver endring: kjernen bruker et par
//! millisekunder på en side, og det holder serveren enkel.
//!
//! `initializationOptions` kan ha `manifest`, en sti til et manifest som går
//! foran de andre, og `rendered`, som sjekker dokumentene som hele sider.

use std::io::{Read, Write};
use std::rc::Rc;
use std::time::SystemTime;

use fristil_kjerne::json::{parse, Json};
use fristil_kjerne::text::utf16;
use fristil_kjerne::types::{Finding, Severity, Vocabulary};
use fristil_kjerne::{diagnose_markup, diagnose_page, manifest, Lines};

/// Stedene manifestet letes etter, fra arbeidsområdet.
const CANDIDATES: [&str; 2] = [
    "build/fristil/manifest.json",
    "node_modules/@fristil/designsystem/manifest/manifest.json",
];

struct Document {
    uri: String,
    text: Vec<u16>,
    findings: Vec<Finding>,
}

/// Manifestet som gjelder, og hvor det kom fra.
struct Source {
    path: Option<String>,
    modified: Option<SystemTime>,
    vocabulary: Rc<Vocabulary>,
}

pub struct Server {
    documents: Vec<Document>,
    roots: Vec<String>,
    preferred: Option<String>,
    rendered: bool,
    source: Option<Source>,
    shut_down: bool,
    /// Meldinger til editoren som venter på å bli sendt.
    outgoing: Vec<Json>,
    /// Manifestet er lest på nytt, og alle åpne dokumenter skal sjekkes.
    reloaded: bool,
    /// Endringer sjekkes først når det ikke ligger flere meldinger i kø, se
    /// [`Server::flush`]. Av i testene, der hver melding sjekkes med en gang.
    deferred: bool,
    /// Dokumentene som er endret og ikke sjekket ennå.
    dirty: Vec<String>,
    /// Om editoren lar serveren melde inn filovervåkere selv.
    can_watch: bool,
}

fn object(entries: Vec<(&str, Json)>) -> Json {
    Json::Object(
        entries
            .into_iter()
            .map(|(k, v)| (k.to_string(), v))
            .collect(),
    )
}

fn text(s: &str) -> Json {
    Json::String(s.to_string())
}

fn number(n: usize) -> Json {
    Json::Number(n as f64)
}

/// Stien i en `file:`-adresse, slik programmet ser filsystemet.
///
/// På Windows er `file:///c%3A/prosjekt` stasjonen `C:`. Som WASI-modul har
/// verten åpnet den som `/c`, og som kjørbar fil er det `C:/prosjekt`.
pub fn path_of(uri: &str) -> Option<String> {
    let rest = uri.strip_prefix("file://")?;
    let rest = rest.strip_prefix("localhost").unwrap_or(rest);
    let decoded = percent_decode(rest);
    let bytes = decoded.as_bytes();
    let drive =
        bytes.len() >= 3 && bytes[0] == b'/' && bytes[1].is_ascii_alphabetic() && bytes[2] == b':';
    if !drive {
        return Some(decoded);
    }
    let letter = (bytes[1] as char).to_ascii_lowercase();
    let after = &decoded[3..];
    Some(if cfg!(target_os = "wasi") {
        format!("/{letter}{after}")
    } else {
        format!("{}:{after}", letter.to_ascii_uppercase())
    })
}

/// Stien til manifestet i `initializationOptions`, slik programmet ser
/// filsystemet. Den kan være en `file:`-adresse, en absolutt sti, også på
/// Windows (`C:\\prosjekt\\…` eller `\\\\server\\…`), eller relativ til
/// arbeidsområdet.
pub fn manifest_path(path: &str, root: Option<&str>) -> String {
    if let Some(from_uri) = path.strip_prefix("file:").and(path_of(path)) {
        return from_uri;
    }
    let bytes = path.as_bytes();
    let drive = bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && matches!(bytes[2], b'/' | b'\\');
    if drive {
        // Som WASI-modul har verten åpnet stasjonen som `/c`.
        return if cfg!(target_os = "wasi") {
            format!(
                "/{}/{}",
                (bytes[0] as char).to_ascii_lowercase(),
                path[3..].replace('\\', "/")
            )
        } else {
            path.to_string()
        };
    }
    if path.starts_with('/') || path.starts_with('\\') {
        return path.to_string();
    }
    match root {
        Some(root) => format!("{}/{path}", root.trim_end_matches('/')),
        None => path.to_string(),
    }
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        // `%` og to heksadesimale sifre. `from_str_radix` godtar et `+`
        // foran, og `%+f` er ikke en kodet byte.
        if bytes[i] == b'%'
            && i + 2 < bytes.len()
            && bytes[i + 1..i + 3].iter().all(u8::is_ascii_hexdigit)
        {
            if let Ok(byte) =
                u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""), 16)
            {
                out.push(byte);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// LSP-posisjonen, linje og tegn fra 0, for en UTF-16-posisjon.
fn position(lines: &Lines, at: usize) -> Json {
    let (line, column) = lines.line_and_column(at);
    object(vec![
        ("line", number(line - 1)),
        ("character", number(column - 1)),
    ])
}

fn range(lines: &Lines, start: usize, end: usize) -> Json {
    object(vec![
        ("start", position(lines, start)),
        ("end", position(lines, end)),
    ])
}

fn diagnostic(lines: &Lines, finding: &Finding) -> Json {
    let mut entries = vec![
        ("range", range(lines, finding.start, finding.end)),
        (
            "severity",
            number(match finding.severity {
                Severity::Error => 1,
                Severity::Warning => 2,
            }),
        ),
        // Regelnavnet er det `<!-- fristil-ignore-next … -->` tar.
        ("code", text(finding.rule)),
        ("source", text("Fristil")),
        ("message", text(&finding.message)),
    ];
    if !finding.link.is_empty() {
        entries.push((
            "codeDescription",
            object(vec![("href", text(&finding.link))]),
        ));
    }
    object(entries)
}

impl Default for Server {
    fn default() -> Self {
        Self::new()
    }
}

impl Server {
    pub fn new() -> Self {
        Server {
            documents: Vec::new(),
            roots: Vec::new(),
            preferred: None,
            rendered: false,
            source: None,
            shut_down: false,
            outgoing: Vec::new(),
            reloaded: false,
            deferred: false,
            dirty: Vec::new(),
            can_watch: false,
        }
    }

    fn notify(&mut self, method: &str, params: Json) {
        self.outgoing.push(object(vec![
            ("jsonrpc", text("2.0")),
            ("method", text(method)),
            ("params", params),
        ]));
    }

    fn message(&mut self, kind: usize, message: &str) {
        self.notify(
            "window/showMessage",
            object(vec![("type", number(kind)), ("message", text(message))]),
        );
    }

    /// Manifestet som skal gjelde nå: det første som finnes, lest på nytt
    /// når fila er endret.
    fn vocabulary(&mut self) -> Rc<Vocabulary> {
        let mut candidates: Vec<String> = self.preferred.iter().cloned().collect();
        for root in &self.roots {
            for candidate in CANDIDATES {
                candidates.push(format!("{}/{candidate}", root.trim_end_matches('/')));
            }
        }
        let found = candidates.into_iter().find_map(|path| {
            let modified = std::fs::metadata(&path).ok()?.modified().ok();
            Some((path, modified))
        });
        let (path, modified) = match found {
            Some((path, modified)) => (Some(path), modified),
            None => (None, None),
        };
        if let Some(source) = &self.source {
            if source.path == path && source.modified == modified {
                return Rc::clone(&source.vocabulary);
            }
        }
        // Et manifest som er byttet eller endret, gjelder alle åpne dokumenter.
        self.reloaded = self.source.is_some();
        let vocabulary = match &path {
            None => manifest::builtin(),
            Some(file) => match std::fs::read(file)
                .map_err(|e| e.to_string())
                .and_then(|bytes| manifest::from_json(&String::from_utf8_lossy(&bytes)))
            {
                Ok(vocabulary) => Rc::new(vocabulary),
                Err(reason) => {
                    self.message(
                        2,
                        &format!("Fristil kunne ikke lese {file}, og sjekker mot det innebygde manifestet: {reason}"),
                    );
                    manifest::builtin()
                }
            },
        };
        self.source = Some(Source {
            path,
            modified,
            vocabulary: Rc::clone(&vocabulary),
        });
        vocabulary
    }

    fn check(&mut self, index: usize) {
        let vocabulary = self.vocabulary();
        let document = &mut self.documents[index];
        document.findings = if self.rendered {
            diagnose_page(&document.text, &vocabulary)
        } else {
            diagnose_markup(&document.text, &vocabulary)
        };
        let lines = Lines::new(&document.text);
        let diagnostics = Json::Array(
            document
                .findings
                .iter()
                .map(|f| diagnostic(&lines, f))
                .collect(),
        );
        let uri = document.uri.clone();
        self.notify(
            "textDocument/publishDiagnostics",
            object(vec![("uri", text(&uri)), ("diagnostics", diagnostics)]),
        );
    }

    fn open(&mut self, uri: &str, content: &str) {
        let index = match self.documents.iter().position(|d| d.uri == uri) {
            Some(index) => {
                self.documents[index].text = utf16(content);
                index
            }
            None => {
                self.documents.push(Document {
                    uri: uri.to_string(),
                    text: utf16(content),
                    findings: Vec::new(),
                });
                self.documents.len() - 1
            }
        };
        if self.deferred {
            if !self.dirty.iter().any(|u| u == uri) {
                self.dirty.push(uri.to_string());
            }
        } else {
            self.check(index);
            self.after_reload();
        }
    }

    /// Sjekker alle åpne dokumenter.
    fn check_all(&mut self) {
        for index in 0..self.documents.len() {
            self.check(index);
        }
        self.reloaded = false;
    }

    /// Ble manifestet lest på nytt, er funnene i de andre dokumentene gamle.
    fn after_reload(&mut self) {
        if self.reloaded {
            self.check_all();
        }
    }

    /// Sjekker dokumentene som er endret siden sist. Kjøres når det ikke
    /// ligger flere meldinger i kø, så tastetrykk som kom tett, sjekkes som
    /// én endring, med den nyeste teksten.
    pub fn flush(&mut self) {
        for uri in std::mem::take(&mut self.dirty) {
            if let Some(index) = self.documents.iter().position(|d| d.uri == uri) {
                self.check(index);
            }
        }
        self.after_reload();
    }

    fn initialize(&mut self, params: &Json) -> Json {
        self.can_watch = matches!(
            params
                .get("capabilities")
                .and_then(|c| c.get("workspace"))
                .and_then(|w| w.get("didChangeWatchedFiles"))
                .and_then(|d| d.get("dynamicRegistration")),
            Some(Json::Bool(true))
        );
        if let Some(folders) = params.get("workspaceFolders").and_then(Json::as_array) {
            self.roots = folders
                .iter()
                .filter_map(|f| f.get("uri").and_then(Json::as_str).and_then(path_of))
                .collect();
        }
        if self.roots.is_empty() {
            if let Some(root) = params
                .get("rootUri")
                .and_then(Json::as_str)
                .and_then(path_of)
            {
                self.roots.push(root);
            } else if let Some(root) = params.get("rootPath").and_then(Json::as_str) {
                self.roots.push(root.to_string());
            }
        }
        if let Some(options) = params.get("initializationOptions") {
            self.preferred = options
                .get("manifest")
                .and_then(Json::as_str)
                .map(|p| manifest_path(p, self.roots.first().map(String::as_str)));
            self.rendered = matches!(options.get("rendered"), Some(Json::Bool(true)));
        }
        let version = self.vocabulary().version.clone();
        object(vec![
            (
                "capabilities",
                object(vec![
                    ("positionEncoding", text("utf-16")),
                    (
                        "textDocumentSync",
                        object(vec![
                            ("openClose", Json::Bool(true)),
                            ("change", number(1)),
                            // Et bygg kan ha skrevet et nytt manifest.
                            ("save", object(vec![("includeText", Json::Bool(false))])),
                        ]),
                    ),
                    (
                        "codeActionProvider",
                        object(vec![(
                            "codeActionKinds",
                            Json::Array(vec![text("quickfix")]),
                        )]),
                    ),
                ]),
            ),
            (
                "serverInfo",
                object(vec![("name", text("fristil")), ("version", text(&version))]),
            ),
        ])
    }

    /// Hurtigrettelsene for funnene som overlapper området.
    fn code_actions(&self, params: &Json) -> Json {
        let uri = params
            .get("textDocument")
            .and_then(|d| d.get("uri"))
            .and_then(Json::as_str)
            .unwrap_or("");
        let Some(document) = self.documents.iter().find(|d| d.uri == uri) else {
            return Json::Array(Vec::new());
        };
        let lines = Lines::new(&document.text);
        let line_and_character = |p: Option<&Json>| -> (usize, usize) {
            let get = |k| {
                p.and_then(|p| p.get(k))
                    .and_then(Json::as_f64)
                    .unwrap_or(0.0) as usize
            };
            (get("line"), get("character"))
        };
        let wanted = params.get("range");
        let from = line_and_character(wanted.and_then(|r| r.get("start")));
        let to = line_and_character(wanted.and_then(|r| r.get("end")));
        let at = |offset: usize| {
            let (line, column) = lines.line_and_column(offset);
            (line - 1, column - 1)
        };
        let actions = document
            .findings
            .iter()
            .filter(|f| f.fix.is_some())
            .filter(|f| at(f.start) <= to && from <= at(f.end))
            .map(|f| {
                let fix = f.fix.as_ref().unwrap();
                let edit = object(vec![
                    ("range", range(&lines, fix.start, fix.end)),
                    ("newText", text(&fix.text)),
                ]);
                object(vec![
                    ("title", text(&fix.title)),
                    ("kind", text("quickfix")),
                    ("diagnostics", Json::Array(vec![diagnostic(&lines, f)])),
                    ("isPreferred", Json::Bool(fix.preferred)),
                    (
                        "edit",
                        object(vec![(
                            "changes",
                            Json::Object(vec![(uri.to_string(), Json::Array(vec![edit]))]),
                        )]),
                    ),
                ])
            })
            .collect();
        Json::Array(actions)
    }

    /// Håndterer én melding. Svaret, og alt annet som skal til editoren,
    /// ligger i [`Server::take`] etterpå. `Some(kode)` betyr at serveren skal
    /// avslutte.
    pub fn handle(&mut self, message: &Json) -> Option<i32> {
        let method = message.get("method").and_then(Json::as_str).unwrap_or("");
        let id = message.get("id").cloned();
        let params = message.get("params").cloned().unwrap_or(Json::Null);
        let document_uri = params
            .get("textDocument")
            .and_then(|d| d.get("uri"))
            .and_then(Json::as_str)
            .unwrap_or("")
            .to_string();

        let result = match method {
            "initialize" => Some(self.initialize(&params)),
            "shutdown" => {
                self.shut_down = true;
                Some(Json::Null)
            }
            "exit" => return Some(if self.shut_down { 0 } else { 1 }),
            "initialized" => {
                // Editoren overvåker manifestene og sier fra når de endres,
                // også i Neovim og Helix, der ingen utvidelse gjør det.
                if self.can_watch {
                    self.outgoing.push(object(vec![
                        ("jsonrpc", text("2.0")),
                        ("id", text("fristil-manifest")),
                        ("method", text("client/registerCapability")),
                        (
                            "params",
                            object(vec![(
                                "registrations",
                                Json::Array(vec![object(vec![
                                    ("id", text("fristil-manifest")),
                                    ("method", text("workspace/didChangeWatchedFiles")),
                                    (
                                        "registerOptions",
                                        object(vec![(
                                            "watchers",
                                            Json::Array(
                                                CANDIDATES
                                                    .iter()
                                                    .map(|c| {
                                                        object(vec![(
                                                            "globPattern",
                                                            text(&format!("**/{c}")),
                                                        )])
                                                    })
                                                    .collect(),
                                            ),
                                        )]),
                                    ),
                                ])]),
                            )]),
                        ),
                    ]));
                }
                None
            }
            "textDocument/didOpen" => {
                let content = params
                    .get("textDocument")
                    .and_then(|d| d.get("text"))
                    .and_then(Json::as_str)
                    .unwrap_or("")
                    .to_string();
                self.open(&document_uri, &content);
                None
            }
            "textDocument/didChange" => {
                // Hele dokumentet står i den siste endringen.
                let content = params
                    .get("contentChanges")
                    .and_then(Json::as_array)
                    .and_then(|changes| changes.last())
                    .and_then(|c| c.get("text"))
                    .and_then(Json::as_str)
                    .map(str::to_string);
                if let Some(content) = content {
                    self.open(&document_uri, &content);
                }
                None
            }
            "textDocument/didClose" => {
                self.documents.retain(|d| d.uri != document_uri);
                self.dirty.retain(|u| *u != document_uri);
                self.notify(
                    "textDocument/publishDiagnostics",
                    object(vec![
                        ("uri", text(&document_uri)),
                        ("diagnostics", Json::Array(Vec::new())),
                    ]),
                );
                None
            }
            // Et nytt bygg eller en oppgradering kan ha endret manifestet.
            "textDocument/didSave" | "workspace/didChangeWatchedFiles" => {
                self.flush();
                self.check_all();
                None
            }
            // Rettelsene skal gjelde den nyeste teksten.
            "textDocument/codeAction" => {
                self.flush();
                Some(self.code_actions(&params))
            }
            _ => None,
        };

        if let Some(id) = id {
            let reply = match result {
                Some(result) => object(vec![
                    ("jsonrpc", text("2.0")),
                    ("id", id),
                    ("result", result),
                ]),
                None if method.is_empty() || method.starts_with("$/") => return None,
                None => object(vec![
                    ("jsonrpc", text("2.0")),
                    ("id", id),
                    (
                        "error",
                        object(vec![
                            ("code", Json::Number(-32601.0)),
                            ("message", text(&format!("fristil lsp kan ikke {method}."))),
                        ]),
                    ),
                ]),
            };
            // Svaret går foran diagnostikken det førte til.
            self.outgoing.insert(0, reply);
        }
        None
    }

    /// Meldingene som venter på å bli sendt.
    pub fn take(&mut self) -> Vec<Json> {
        std::mem::take(&mut self.outgoing)
    }
}

/// Leser nøyaktig så mange byte, og venter i stedet for å gi opp når røret
/// er i ikke-blokkerende modus.
fn read_exact(input: &mut impl Read, buffer: &mut [u8]) -> bool {
    let mut filled = 0;
    while filled < buffer.len() {
        match input.read(&mut buffer[filled..]) {
            Ok(0) => return false,
            Ok(n) => filled += n,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => {}
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(std::time::Duration::from_millis(2));
            }
            Err(_) => return false,
        }
    }
    true
}

/// Det som ble lest fra editoren.
#[derive(Debug, PartialEq)]
enum Incoming {
    Message(Vec<u8>),
    /// Hodene hadde ingen `Content-Length` som kunne leses.
    BadHeader,
    /// Editoren lukket røret.
    Closed,
}

/// Én melding: hodene til en tom linje, og så `Content-Length` byte JSON.
fn read_message(input: &mut impl Read) -> Incoming {
    let mut header = Vec::new();
    let mut byte = [0u8];
    while !header.ends_with(b"\r\n\r\n") {
        if !read_exact(input, &mut byte) {
            return Incoming::Closed;
        }
        header.push(byte[0]);
    }
    let header = String::from_utf8_lossy(&header);
    let length = header.lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.trim()
            .eq_ignore_ascii_case("content-length")
            .then(|| value.trim().parse::<usize>().ok())?
    });
    let Some(length) = length else {
        return Incoming::BadHeader;
    };
    let mut body = vec![0u8; length];
    if read_exact(input, &mut body) {
        Incoming::Message(body)
    } else {
        Incoming::Closed
    }
}

fn write_message(output: &mut impl Write, message: &Json) {
    let body = message.to_compact();
    let _ = write!(output, "Content-Length: {}\r\n\r\n{body}", body.len());
    let _ = output.flush();
}

/// Svaret på en melding som ikke kunne leses.
fn parse_error(reason: &str) -> Json {
    object(vec![
        ("jsonrpc", text("2.0")),
        ("id", Json::Null),
        (
            "error",
            object(vec![
                ("code", Json::Number(-32700.0)),
                ("message", text(reason)),
            ]),
        ),
    ])
}

pub fn run(_arguments: &[String]) {
    let mut server = Server::new();
    server.deferred = true;
    let stdin = std::io::stdin();
    // Egen buffer, så serveren kan se om det ligger flere meldinger i kø.
    let mut input = std::io::BufReader::with_capacity(1 << 16, stdin.lock());
    let stdout = std::io::stdout();
    loop {
        let code = match read_message(&mut input) {
            // Editoren lukket røret uten `exit`.
            Incoming::Closed => std::process::exit(1),
            // Én ødelagt melding skal ikke ta ned serveren.
            Incoming::BadHeader => {
                server.outgoing.push(parse_error(
                    "Meldingen hadde ingen Content-Length som kunne leses.",
                ));
                None
            }
            Incoming::Message(body) => match parse(&String::from_utf8_lossy(&body)) {
                Ok(message) => server.handle(&message),
                Err(reason) => {
                    server.outgoing.push(parse_error(&reason));
                    None
                }
            },
        };
        if input.buffer().is_empty() {
            server.flush();
        }
        let mut out = stdout.lock();
        for message in server.take() {
            write_message(&mut out, &message);
        }
        if let Some(code) = code {
            std::process::exit(code);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(id: usize, method: &str, params: &str) -> Json {
        parse(&format!(
            r#"{{"jsonrpc":"2.0","id":{id},"method":"{method}","params":{params}}}"#
        ))
        .unwrap()
    }

    fn notification(method: &str, params: &str) -> Json {
        parse(&format!(
            r#"{{"jsonrpc":"2.0","method":"{method}","params":{params}}}"#
        ))
        .unwrap()
    }

    fn started() -> Server {
        let mut server = Server::new();
        server.handle(&request(
            1,
            "initialize",
            r#"{"rootUri":null,"capabilities":{}}"#,
        ));
        server.take();
        server
    }

    #[test]
    fn says_what_it_can() {
        let mut server = Server::new();
        server.handle(&request(1, "initialize", r#"{"capabilities":{}}"#));
        let reply = &server.take()[0];
        let capabilities = reply.get("result").unwrap().get("capabilities").unwrap();
        assert_eq!(
            capabilities.get("positionEncoding").unwrap().as_str(),
            Some("utf-16")
        );
        assert!(capabilities.get("codeActionProvider").is_some());
    }

    #[test]
    fn publishes_findings_with_utf16_positions() {
        let mut server = started();
        server.handle(&notification(
            "textDocument/didOpen",
            r#"{"textDocument":{"uri":"file:///a.html","languageId":"html","version":1,"text":"<p>🧾æ</p>\n<b class=\"fs-buton\"></b>"}}"#,
        ));
        let sent = server.take();
        let params = sent[0].get("params").unwrap();
        let diagnostic = &params.get("diagnostics").unwrap().as_array().unwrap()[0];
        assert_eq!(
            diagnostic.get("code").unwrap().as_str(),
            Some("ukjent-klasse")
        );
        let start = diagnostic.get("range").unwrap().get("start").unwrap();
        assert_eq!(start.get("line").unwrap().as_f64(), Some(1.0));
        assert_eq!(start.get("character").unwrap().as_f64(), Some(10.0));

        // Endringen erstatter hele dokumentet, og funnet er borte.
        server.handle(&notification(
            "textDocument/didChange",
            r#"{"textDocument":{"uri":"file:///a.html","version":2},"contentChanges":[{"text":"<b class=\"fs-button\"></b>"}]}"#,
        ));
        let sent = server.take();
        assert!(sent[0]
            .get("params")
            .unwrap()
            .get("diagnostics")
            .unwrap()
            .as_array()
            .unwrap()
            .is_empty());
    }

    #[test]
    fn offers_the_fix_as_a_quick_fix() {
        let mut server = started();
        server.handle(&notification(
            "textDocument/didOpen",
            r#"{"textDocument":{"uri":"file:///a.html","languageId":"html","version":1,"text":"<b class=\"fs-buton\"></b>"}}"#,
        ));
        server.take();
        server.handle(&request(
            2,
            "textDocument/codeAction",
            r#"{"textDocument":{"uri":"file:///a.html"},"range":{"start":{"line":0,"character":12},"end":{"line":0,"character":12}},"context":{"diagnostics":[]}}"#,
        ));
        let reply = &server.take()[0];
        let action = &reply.get("result").unwrap().as_array().unwrap()[0];
        assert_eq!(
            action.get("title").unwrap().as_str(),
            Some("Bytt til fs-button")
        );
        let edit = &action
            .get("edit")
            .unwrap()
            .get("changes")
            .unwrap()
            .get("file:///a.html")
            .unwrap()
            .as_array()
            .unwrap()[0];
        assert_eq!(edit.get("newText").unwrap().as_str(), Some("fs-button"));
    }

    #[test]
    fn closing_clears_the_findings_and_exit_follows_shutdown() {
        let mut server = started();
        server.handle(&notification(
            "textDocument/didClose",
            r#"{"textDocument":{"uri":"file:///a.html"}}"#,
        ));
        let sent = server.take();
        assert!(sent[0]
            .get("params")
            .unwrap()
            .get("diagnostics")
            .unwrap()
            .as_array()
            .unwrap()
            .is_empty());
        assert_eq!(server.handle(&notification("exit", "null")), Some(1));
        server.handle(&request(3, "shutdown", "null"));
        assert_eq!(server.handle(&notification("exit", "null")), Some(0));
    }

    #[test]
    fn answers_an_unknown_request_with_an_error() {
        let mut server = started();
        server.handle(&request(4, "textDocument/hover", "{}"));
        let reply = &server.take()[0];
        assert_eq!(
            reply.get("error").unwrap().get("code").unwrap().as_f64(),
            Some(-32601.0)
        );
    }

    #[test]
    fn reads_paths_from_file_addresses() {
        assert_eq!(path_of("file:///home/a%20b/x"), Some("/home/a b/x".into()));
        let windows = path_of("file:///c%3A/prosjekt").unwrap();
        if cfg!(target_os = "wasi") {
            assert_eq!(windows, "/c/prosjekt");
        } else {
            assert_eq!(windows, "C:/prosjekt");
        }
        assert_eq!(path_of("untitled:Untitled-1"), None);
        // Manifestet i initializationOptions.
        let windows = manifest_path(r"C:\proj\build\fristil\manifest.json", Some("/c/proj"));
        if cfg!(target_os = "wasi") {
            assert_eq!(windows, "/c/proj/build/fristil/manifest.json");
        } else {
            assert_eq!(windows, r"C:\proj\build\fristil\manifest.json");
        }
        assert_eq!(
            manifest_path("build/m.json", Some("/r/")),
            "/r/build/m.json"
        );
        assert_eq!(manifest_path("/abs/m.json", Some("/r")), "/abs/m.json");
        assert_eq!(
            manifest_path("file:///abs/m%20x.json", Some("/r")),
            "/abs/m x.json"
        );
        assert_eq!(path_of("file:///a%+fb"), Some("/a%+fb".into()));
    }

    #[test]
    fn frames_messages_with_content_length() {
        let mut input: &[u8] = b"Content-Length: 2\r\n\r\n{}Content-Length: 4\r\n\r\nnull";
        assert_eq!(read_message(&mut input), Incoming::Message(b"{}".to_vec()));
        assert_eq!(
            read_message(&mut input),
            Incoming::Message(b"null".to_vec())
        );
        assert_eq!(read_message(&mut input), Incoming::Closed);
        // Et hode uten lengde er en ødelagt melding, ikke et lukket rør.
        let mut broken: &[u8] = b"Content-Type: x\r\n\r\nContent-Length: 2\r\n\r\n{}";
        assert_eq!(read_message(&mut broken), Incoming::BadHeader);
        assert_eq!(read_message(&mut broken), Incoming::Message(b"{}".to_vec()));
    }

    #[test]
    fn uses_the_manifest_in_the_workspace() {
        let root = std::env::temp_dir().join(format!("fristil-lsp-{}", std::process::id()));
        let folder = root.join("build/fristil");
        std::fs::create_dir_all(&folder).unwrap();
        let fragment = r#"{"schemaVersion":1,"version":"0","classes":{"app-button":{"title":"Button","link":"","attributes":{}}}}"#;
        std::fs::write(
            folder.join("manifest.json"),
            manifest::merged(&[fragment]).unwrap().to_pretty(),
        )
        .unwrap();
        let mut server = Server::new();
        server.handle(&request(
            1,
            "initialize",
            &format!(
                r#"{{"rootUri":"file://{}","capabilities":{{}}}}"#,
                root.display()
            ),
        ));
        server.handle(&notification(
            "textDocument/didOpen",
            r#"{"textDocument":{"uri":"file:///a.html","languageId":"html","version":1,"text":"<b class=\"app-button__x\"></b>"}}"#,
        ));
        let sent = server.take();
        let published = sent
            .iter()
            .find(|m| {
                m.get("method").and_then(Json::as_str) == Some("textDocument/publishDiagnostics")
            })
            .unwrap();
        assert_eq!(
            published
                .get("params")
                .unwrap()
                .get("diagnostics")
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            1
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn deferred_changes_are_checked_once_with_the_newest_text() {
        let mut server = started();
        server.deferred = true;
        for (version, text) in [(1, "fs-buton"), (2, "fs-butto"), (3, "fs-button")] {
            server.handle(&notification(
                if version == 1 { "textDocument/didOpen" } else { "textDocument/didChange" },
                &format!(
                    r#"{{"textDocument":{{"uri":"file:///a.html","version":{version},"text":"<b class=\"{text}\"></b>"}},"contentChanges":[{{"text":"<b class=\"{text}\"></b>"}}]}}"#
                ),
            ));
        }
        assert!(
            server.take().is_empty(),
            "ingenting sjekkes mens det ligger meldinger i kø"
        );
        server.flush();
        let sent = server.take();
        assert_eq!(sent.len(), 1, "tre endringer gir én sjekk");
        assert!(sent[0]
            .get("params")
            .unwrap()
            .get("diagnostics")
            .unwrap()
            .as_array()
            .unwrap()
            .is_empty());
    }

    #[test]
    fn registers_watchers_and_rechecks_every_document_when_the_manifest_changes() {
        let root = std::env::temp_dir().join(format!("fristil-lsp-alle-{}", std::process::id()));
        std::fs::create_dir_all(root.join("build/fristil")).unwrap();
        let mut server = Server::new();
        server.handle(&request(
            1,
            "initialize",
            &format!(
                r#"{{"rootUri":"file://{}","capabilities":{{"workspace":{{"didChangeWatchedFiles":{{"dynamicRegistration":true}}}}}}}}"#,
                root.display()
            ),
        ));
        server.take();
        server.handle(&notification("initialized", "{}"));
        let registration = &server.take()[0];
        assert_eq!(
            registration.get("method").unwrap().as_str(),
            Some("client/registerCapability")
        );

        for uri in ["file:///a.html", "file:///b.html"] {
            server.handle(&notification(
                "textDocument/didOpen",
                &format!(r#"{{"textDocument":{{"uri":"{uri}","version":1,"text":"<b class=\"app-button\"></b>"}}}}"#),
            ));
        }
        server.take();
        let fragment = r#"{"schemaVersion":1,"version":"0","classes":{"app-button":{"title":"Button","link":"","attributes":{}}}}"#;
        std::fs::write(
            root.join("build/fristil/manifest.json"),
            manifest::merged(&[fragment]).unwrap().to_pretty(),
        )
        .unwrap();
        server.handle(&notification(
            "workspace/didChangeWatchedFiles",
            r#"{"changes":[]}"#,
        ));
        let published = server
            .take()
            .iter()
            .filter(|m| {
                m.get("method").and_then(Json::as_str) == Some("textDocument/publishDiagnostics")
            })
            .count();
        assert_eq!(published, 2, "begge dokumentene sjekkes på nytt");
        std::fs::remove_dir_all(root).unwrap();
    }
}

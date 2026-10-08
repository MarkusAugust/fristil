//! Siden bak en adresse, til `fristil sjekk`.
//!
//! Den kjørbare fila henter `http://` selv, som dekker `localhost`, der en app
//! under utvikling svarer. `https://` krever TLS, og WASI-utgaven har ikke
//! nettverk i det hele tatt. Der henter verten siden i stedet: Node og JVM-en
//! har nettverk, henter adressen og gir svaret hit som en fil med
//! `--hentet=<fil>`, i adressens plass blant argumentene.
//!
//! Fila verten skriver har fire deler: adressen på første linje, statuskoden
//! på andre (0 når ingen svarte), innholdstypen på tredje, eller grunnen når
//! ingen svarte, og resten er siden.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

/// `/^https?:\/\//i`
pub fn is_address(path: &str) -> bool {
    let lower = path.get(..8).unwrap_or(path).to_ascii_lowercase();
    lower.starts_with("http://") || lower.starts_with("https://")
}

/// Svaret slik `fristil sjekk` vurderer det: statuskoden leses, for en
/// 404-side er HTML, og innholdstypen, for en sti som svarer JSON er ikke en side.
fn judge(
    address: &str,
    status: u16,
    content_type: &str,
    body: String,
) -> Result<(String, String), String> {
    if !(200..300).contains(&status) {
        return Err(format!("{address} svarte {status}."));
    }
    let lower = content_type.to_ascii_lowercase();
    if !lower.contains("text/html") && !lower.contains("application/xhtml+xml") {
        let shown = if content_type.is_empty() {
            "ingen innholdstype"
        } else {
            content_type
        };
        return Err(format!("{address} svarte med {shown}, ikke HTML."));
    }
    Ok((address.to_string(), body))
}

/// En side verten har hentet. Se forklaringen øverst.
pub fn from_host(file: &str) -> Result<(String, String), String> {
    let bytes =
        std::fs::read(file).map_err(|e| format!("Fant ikke det verten hentet, «{file}»: {e}"))?;
    let text = String::from_utf8_lossy(&bytes).into_owned();
    let mut parts = text.splitn(4, '\n');
    let address = parts.next().unwrap_or_default().to_string();
    let status: u16 = parts.next().unwrap_or_default().trim().parse().unwrap_or(0);
    let third = parts.next().unwrap_or_default().to_string();
    let body = parts.next().unwrap_or_default().to_string();
    if status == 0 {
        return Err(format!("Fikk ikke kontakt med {address}: {third}"));
    }
    judge(&address, status, &third, body)
}

/// Henter siden, og følger omdirigeringer slik `fetch` gjør.
pub fn page(address: &str) -> Result<(String, String), String> {
    let mut current = address.to_string();
    for _ in 0..20 {
        let response =
            get(&current).map_err(|reason| format!("Fikk ikke kontakt med {address}: {reason}"))?;
        if matches!(response.status, 301 | 302 | 303 | 307 | 308) {
            if let Some(location) = response.header("location") {
                current = resolve(&current, location);
                continue;
            }
        }
        let content_type = response
            .header("content-type")
            .unwrap_or_default()
            .to_string();
        let body = String::from_utf8_lossy(&response.body).into_owned();
        return judge(address, response.status, &content_type, body);
    }
    Err(format!(
        "Fikk ikke kontakt med {address}: for mange omdirigeringer"
    ))
}

struct Response {
    status: u16,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

impl Response {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .rev()
            .find(|(n, _)| n.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
    }
}

/// En adresse delt i vert, port og sti.
fn split(address: &str) -> Result<(String, u16, String), String> {
    let lower = address.to_ascii_lowercase();
    if lower.starts_with("https://") {
        return Err(if cfg!(target_os = "wasi") {
            unavailable(address)
        } else {
            format!("denne utgaven av fristil henter bare http://. Hent siden selv og send den inn: curl -s {address} | fristil sjekk --rendret")
        });
    }
    let rest = &address["http://".len()..];
    let (authority, path) = match rest.find(['/', '?', '#']) {
        Some(i) if rest.as_bytes()[i] == b'/' => (&rest[..i], rest[i..].to_string()),
        Some(i) => (&rest[..i], format!("/{}", &rest[i..])),
        None => (rest, "/".to_string()),
    };
    let path = path.split('#').next().unwrap_or("/").to_string();
    let authority = authority.rsplit('@').next().unwrap_or(authority);
    // En IPv6-adresse står i klammer, med kolon inni: porten er det som står
    // etter `]`, ikke etter det siste kolonet.
    let (host, port) = match authority.strip_prefix('[') {
        Some(inner) => {
            let close = inner
                .find(']')
                .ok_or_else(|| format!("ugyldig vert i {address}"))?;
            let host = format!("[{}]", &inner[..close]);
            match &inner[close + 1..] {
                "" => (host, 80),
                rest => match rest.strip_prefix(':') {
                    Some(p) => (host, port_of(p, address)?),
                    None => return Err(format!("ugyldig vert i {address}")),
                },
            }
        }
        None => match authority.rsplit_once(':') {
            Some((h, p)) => (h.to_string(), port_of(p, address)?),
            None => (authority.to_string(), 80),
        },
    };
    if host.is_empty() {
        return Err(format!("{address} har ingen vert"));
    }
    Ok((host, port, path))
}

fn port_of(text: &str, address: &str) -> Result<u16, String> {
    text.parse::<u16>()
        .map_err(|_| format!("ugyldig port i {address}"))
}

fn unavailable(address: &str) -> String {
    format!("denne utgaven av fristil kan ikke hente adresser. Hent siden selv og send den inn: curl -s {address} | fristil sjekk --rendret")
}

fn get(address: &str) -> Result<Response, String> {
    let (host, port, path) = split(address)?;
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    let mut stream = TcpStream::connect((bare, port)).map_err(|e| {
        if e.kind() == std::io::ErrorKind::Unsupported {
            unavailable(address)
        } else {
            format!("ingen svarte på {host}:{port} ({e})")
        }
    })?;
    let _ = stream.set_read_timeout(Some(Duration::from_secs(30)));
    let host_header = if port == 80 {
        host.clone()
    } else {
        format!("{host}:{port}")
    };
    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: {host_header}\r\nAccept: text/html,application/xhtml+xml,*/*\r\nUser-Agent: fristil\r\nConnection: close\r\n\r\n"
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut raw = Vec::new();
    stream.read_to_end(&mut raw).map_err(|e| e.to_string())?;

    let end = raw
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .ok_or("svaret hadde ingen hode")?;
    let head = String::from_utf8_lossy(&raw[..end]).into_owned();
    let mut lines = head.split("\r\n");
    let status = lines
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|s| s.parse().ok())
        .ok_or("svaret hadde ingen statuskode")?;
    let headers: Vec<(String, String)> = lines
        .filter_map(|l| l.split_once(':'))
        .map(|(n, v)| (n.trim().to_string(), v.trim().to_string()))
        .collect();
    let mut body = raw[end + 4..].to_vec();
    let response = Response {
        status,
        headers,
        body: Vec::new(),
    };
    if response
        .header("transfer-encoding")
        .is_some_and(|t| t.to_ascii_lowercase().contains("chunked"))
    {
        body = unchunk(&body);
    } else if let Some(length) = response
        .header("content-length")
        .and_then(|l| l.parse::<usize>().ok())
    {
        body.truncate(length);
    }
    Ok(Response { body, ..response })
}

/// Setter sammen et svar sendt i biter (`Transfer-Encoding: chunked`).
fn unchunk(mut data: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    while let Some(line_end) = data.windows(2).position(|w| w == b"\r\n") {
        let size_text = String::from_utf8_lossy(&data[..line_end]);
        let size = usize::from_str_radix(size_text.split(';').next().unwrap_or("").trim(), 16)
            .unwrap_or(0);
        data = &data[line_end + 2..];
        if size == 0 || data.len() < size {
            out.extend_from_slice(&data[..size.min(data.len())]);
            break;
        }
        out.extend_from_slice(&data[..size]);
        data = data.get(size + 2..).unwrap_or_default();
    }
    out
}

/// En omdirigering kan peke på en hel adresse, en adresse uten protokoll
/// (`//vert/sti`), en sti fra roten, en spørring eller en sti ved siden av.
fn resolve(base: &str, location: &str) -> String {
    if is_address(location) {
        return location.to_string();
    }
    let scheme_end = base.find("://").map_or(0, |i| i + 3);
    if location.starts_with("//") {
        return format!("{}{location}", &base[..scheme_end - 2]);
    }
    // Verten slutter ved den første `/`, `?` eller `#`, og stien ved den
    // første `?` eller `#`. En `/` i spørringen er ikke en mappe.
    let authority_end = base[scheme_end..]
        .find(['/', '?', '#'])
        .map_or(base.len(), |i| scheme_end + i);
    let path_end = base[authority_end..]
        .find(['?', '#'])
        .map_or(base.len(), |i| authority_end + i);
    if location.starts_with('/') {
        format!("{}{location}", &base[..authority_end])
    } else if location.starts_with('?') {
        let path = &base[authority_end..path_end];
        format!(
            "{}{}{location}",
            &base[..authority_end],
            if path.is_empty() { "/" } else { path }
        )
    } else {
        let directory_end = base[authority_end..path_end]
            .rfind('/')
            .map_or(authority_end, |i| authority_end + i + 1);
        let prefix = &base[..directory_end];
        if prefix.ends_with('/') {
            format!("{prefix}{location}")
        } else {
            format!("{prefix}/{location}")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_an_address() {
        assert_eq!(
            split("http://localhost:8080/skjema?x=1").unwrap(),
            ("localhost".into(), 8080, "/skjema?x=1".into())
        );
        assert_eq!(
            split("http://eksempel.no").unwrap(),
            ("eksempel.no".into(), 80, "/".into())
        );
        assert_eq!(
            split("http://eksempel.no?q#topp").unwrap(),
            ("eksempel.no".into(), 80, "/?q".into())
        );
        assert!(split("https://eksempel.no").unwrap_err().contains("curl"));
    }

    #[test]
    fn follows_a_relative_redirect() {
        assert_eq!(resolve("http://a.no/x/y", "/z"), "http://a.no/z");
        assert_eq!(resolve("http://a.no/x/y", "z"), "http://a.no/x/z");
        assert_eq!(resolve("http://a.no", "z"), "http://a.no/z");
        assert_eq!(resolve("http://a.no/x", "http://b.no/"), "http://b.no/");
    }

    #[test]
    fn joins_a_chunked_body() {
        assert_eq!(
            unchunk(b"4\r\nWiki\r\n6;x=y\r\npedia \r\n0\r\n\r\n"),
            b"Wikipedia "
        );
    }

    #[test]
    fn judges_the_answer_like_fetch() {
        assert!(judge("u", 404, "text/html", String::new())
            .unwrap_err()
            .contains("svarte 404"));
        assert!(judge("u", 200, "", String::new())
            .unwrap_err()
            .contains("ingen innholdstype"));
        assert!(judge("u", 200, "Text/HTML; charset=utf-8", "x".into()).is_ok());
    }

    #[test]
    fn reads_ipv6_hosts_with_and_without_port() {
        assert_eq!(
            split("http://[::1]/skjema").unwrap(),
            ("[::1]".into(), 80, "/skjema".into())
        );
        assert_eq!(
            split("http://[::1]:8080/").unwrap(),
            ("[::1]".into(), 8080, "/".into())
        );
        assert!(split("http://[::1]x/").is_err());
        assert!(split("http://[::1/").is_err());
        assert!(split("http://localhost:abc/").is_err());
    }

    #[test]
    fn resolves_redirects_like_a_browser() {
        assert_eq!(
            resolve("http://a.no/x", "//cdn.local/skjema"),
            "http://cdn.local/skjema"
        );
        assert_eq!(resolve("http://a.no/x?r=/y", "z"), "http://a.no/z");
        assert_eq!(resolve("http://a.no/m/x?r=/y", "z"), "http://a.no/m/z");
        assert_eq!(resolve("http://a.no/m/x?r=/y", "/z"), "http://a.no/z");
        assert_eq!(
            resolve("http://a.no/m/x?r=1", "?r=2"),
            "http://a.no/m/x?r=2"
        );
        assert_eq!(resolve("http://a.no?r=1", "?r=2"), "http://a.no/?r=2");
        assert_eq!(resolve("http://a.no", "z"), "http://a.no/z");
        assert_eq!(resolve("http://a.no/m/", "z"), "http://a.no/m/z");
    }
}

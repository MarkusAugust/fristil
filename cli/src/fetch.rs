//! The page behind an address, for `lotek check`.
//!
//! The executable fetches `http://` itself, which covers `localhost`, where an
//! app under development answers. `https://` needs TLS, and the WASI build has
//! no network at all. There the host fetches the page instead: Node and the
//! JVM have a network, fetch the address and hand the answer over as a file
//! with `--fetched=<file>`, in the address's place among the arguments.
//!
//! The file the host writes has four parts: the address on the first line,
//! the status code on the second (0 when nobody answered), the content type
//! on the third, or the reason when nobody answered, and the rest is the page.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

/// `/^https?:\/\//i`
pub fn is_address(path: &str) -> bool {
    let lower = path.get(..8).unwrap_or(path).to_ascii_lowercase();
    lower.starts_with("http://") || lower.starts_with("https://")
}

/// The answer as `lotek check` judges it: the status code is read, since a
/// 404 page is HTML, and the content type, since a path that answers JSON is
/// not a page.
fn judge(
    address: &str,
    status: u16,
    content_type: &str,
    body: String,
) -> Result<(String, String), String> {
    if !(200..300).contains(&status) {
        return Err(format!("{address} answered {status}."));
    }
    let lower = content_type.to_ascii_lowercase();
    if !lower.contains("text/html") && !lower.contains("application/xhtml+xml") {
        let shown = if content_type.is_empty() {
            "no content type"
        } else {
            content_type
        };
        return Err(format!("{address} answered with {shown}, not HTML."));
    }
    let body = crate::check::without_bom(body);
    // A page that rendered empty is almost always a bug in the app, and a CI
    // line against it must not pass without having checked anything.
    if body.trim().is_empty() {
        return Err(format!("{address} answered with an empty page."));
    }
    Ok((address.to_string(), body))
}

/// A page the host has fetched. See the explanation at the top.
pub fn from_host(file: &str) -> Result<(String, String), String> {
    let bytes = std::fs::read(file).map_err(|e| {
        format!(
            "Could not read what the host fetched, \"{}\": {e}",
            crate::output::shown(file)
        )
    })?;
    let text = String::from_utf8_lossy(&bytes).into_owned();
    let mut parts = text.splitn(4, '\n');
    let address = parts.next().unwrap_or_default().to_string();
    let status: u16 = parts.next().unwrap_or_default().trim().parse().unwrap_or(0);
    let third = parts.next().unwrap_or_default().to_string();
    let body = parts.next().unwrap_or_default().to_string();
    if status == 0 {
        return Err(format!("Could not reach {address}: {third}"));
    }
    judge(&address, status, &third, body)
}

/// Fetches the page, and follows redirects as `fetch` does.
pub fn page(address: &str) -> Result<(String, String), String> {
    let mut current = address.to_string();
    for _ in 0..20 {
        let response =
            get(&current).map_err(|reason| format!("Could not reach {address}: {reason}"))?;
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
    Err(format!("Could not reach {address}: too many redirects"))
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

/// An address split into host, port and path.
fn split(address: &str) -> Result<(String, u16, String), String> {
    let lower = address.to_ascii_lowercase();
    if lower.starts_with("https://") {
        return Err(if cfg!(target_os = "wasi") {
            unavailable(address)
        } else {
            format!("this build of lotek fetches only http://. Fetch the page yourself and send it in: curl -s {address} | lotek check --rendered")
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
    // An IPv6 address is in brackets, with colons inside: the port is what
    // comes after `]`, not after the last colon.
    let (host, port) = match authority.strip_prefix('[') {
        Some(inner) => {
            let close = inner
                .find(']')
                .ok_or_else(|| format!("invalid host in {address}"))?;
            let host = format!("[{}]", &inner[..close]);
            match &inner[close + 1..] {
                "" => (host, 80),
                rest => match rest.strip_prefix(':') {
                    Some(p) => (host, port_of(p, address)?),
                    None => return Err(format!("invalid host in {address}")),
                },
            }
        }
        None => match authority.rsplit_once(':') {
            Some((h, p)) => (h.to_string(), port_of(p, address)?),
            None => (authority.to_string(), 80),
        },
    };
    if host.is_empty() {
        return Err(format!("{address} has no host"));
    }
    Ok((host, port, path))
}

fn port_of(text: &str, address: &str) -> Result<u16, String> {
    text.parse::<u16>()
        .map_err(|_| format!("invalid port in {address}"))
}

fn unavailable(address: &str) -> String {
    format!("this build of lotek cannot fetch addresses. Fetch the page yourself and send it in: curl -s {address} | lotek check --rendered")
}

fn get(address: &str) -> Result<Response, String> {
    let (host, port, path) = split(address)?;
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    let mut stream = TcpStream::connect((bare, port)).map_err(|e| {
        if e.kind() == std::io::ErrorKind::Unsupported {
            unavailable(address)
        } else {
            format!("nobody answered on {host}:{port} ({e})")
        }
    })?;
    let _ = stream.set_read_timeout(Some(Duration::from_secs(30)));
    let host_header = if port == 80 {
        host.clone()
    } else {
        format!("{host}:{port}")
    };
    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: {host_header}\r\nAccept: text/html,application/xhtml+xml,*/*\r\nUser-Agent: lotek\r\nConnection: close\r\n\r\n"
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut raw = Vec::new();
    stream.read_to_end(&mut raw).map_err(|e| e.to_string())?;

    let end = raw
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .ok_or("the answer had no header")?;
    let head = String::from_utf8_lossy(&raw[..end]).into_owned();
    let mut lines = head.split("\r\n");
    let status = lines
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|s| s.parse().ok())
        .ok_or("the answer had no status code")?;
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

/// Joins an answer sent in chunks (`Transfer-Encoding: chunked`).
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

/// A redirect can point to a full address, an address without a scheme
/// (`//host/path`), a path from the root, a query or a sibling path.
fn resolve(base: &str, location: &str) -> String {
    if is_address(location) {
        return location.to_string();
    }
    let scheme_end = base.find("://").map_or(0, |i| i + 3);
    if location.starts_with("//") {
        return format!("{}{location}", &base[..scheme_end - 2]);
    }
    // The host ends at the first `/`, `?` or `#`, and the path at the first
    // `?` or `#`. A `/` in the query is not a folder.
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
            split("http://localhost:8080/form?x=1").unwrap(),
            ("localhost".into(), 8080, "/form?x=1".into())
        );
        assert_eq!(
            split("http://example.com").unwrap(),
            ("example.com".into(), 80, "/".into())
        );
        assert_eq!(
            split("http://example.com?q#top").unwrap(),
            ("example.com".into(), 80, "/?q".into())
        );
        assert!(split("https://example.com").unwrap_err().contains("curl"));
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
            .contains("answered 404"));
        assert!(judge("u", 200, "", String::new())
            .unwrap_err()
            .contains("no content type"));
        assert!(judge("u", 200, "Text/HTML; charset=utf-8", "x".into()).is_ok());
        assert!(judge("u", 200, "text/html", " \n".into())
            .unwrap_err()
            .contains("empty page"));
        // The BOM is removed, as `response.text()` does in Node.
        assert_eq!(
            judge("u", 200, "text/html", "\u{feff}<p>".into())
                .unwrap()
                .1,
            "<p>"
        );
        assert!(judge("u", 200, "text/html", "\u{feff}\n".into()).is_err());
    }

    #[test]
    fn reads_ipv6_hosts_with_and_without_port() {
        assert_eq!(
            split("http://[::1]/form").unwrap(),
            ("[::1]".into(), 80, "/form".into())
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
            resolve("http://a.no/x", "//cdn.local/form"),
            "http://cdn.local/form"
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

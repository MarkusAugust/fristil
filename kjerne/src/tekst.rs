//! Tekst som UTF-16, slik JavaScript og Kotlin ser den.
//!
//! Hele kjernen jobber på UTF-16-enheter, ikke på Rusts UTF-8. Da er hver
//! posisjon i et funn den samme indeksen som `String.slice` i JavaScript og
//! `String.substring` i Kotlin bruker, uten omregning, også med «æøå» og
//! emoji foran. Hjelperne her gjør det de regulære uttrykkene i
//! TypeScript-versjonen gjorde, med de samme reglene for hva som er
//! mellomrom, ordtegn og store bokstaver.

pub type Tekst = Vec<u16>;

/// `\s` i JavaScript: mellomrom og linjeskift, også de utenfor ASCII.
pub fn er_mellomrom(c: u16) -> bool {
    matches!(
        c,
        0x09..=0x0D
            | 0x20
            | 0xA0
            | 0x1680
            | 0x2000..=0x200A
            | 0x2028
            | 0x2029
            | 0x202F
            | 0x205F
            | 0x3000
            | 0xFEFF
    )
}

/// `\w` i JavaScript, som `\b` bygger på: ASCII-bokstaver, sifre og `_`.
pub fn er_ordtegn(c: u16) -> bool {
    er_ascii_bokstav(c) || er_siffer(c) || c == b'_' as u16
}

pub fn er_ascii_bokstav(c: u16) -> bool {
    (b'a' as u16..=b'z' as u16).contains(&c) || (b'A' as u16..=b'Z' as u16).contains(&c)
}

pub fn er_siffer(c: u16) -> bool {
    (b'0' as u16..=b'9' as u16).contains(&c)
}

/// `[a-z0-9-]` med flagget `i`. Uten flagget `u` treffer `i` bare ASCII.
pub fn er_navnetegn(c: u16) -> bool {
    er_ascii_bokstav(c) || er_siffer(c) || c == b'-' as u16
}

pub fn ascii_liten(c: u16) -> u16 {
    if (b'A' as u16..=b'Z' as u16).contains(&c) {
        c + 32
    } else {
        c
    }
}

pub fn u(s: &str) -> Tekst {
    s.encode_utf16().collect()
}

/// Til en Rust-streng for en melding. Et ensomt surrogat blir `U+FFFD`.
pub fn s(t: &[u16]) -> String {
    String::from_utf16_lossy(t)
}

pub fn lik(t: &[u16], s: &str) -> bool {
    t.iter().copied().eq(s.encode_utf16())
}

/// Om `t` har `mønster` (små ASCII-bokstaver) på `ved`, uten hensyn til store
/// og små bokstaver, som et regulært uttrykk med flagget `i`.
pub fn har_ved_ci(t: &[u16], ved: usize, mønster: &str) -> bool {
    let m = mønster.as_bytes();
    ved + m.len() <= t.len()
        && m.iter()
            .enumerate()
            .all(|(i, &b)| ascii_liten(t[ved + i]) == b as u16)
}

pub fn har_ved(t: &[u16], ved: usize, mønster: &str) -> bool {
    let mut i = ved;
    for c in mønster.encode_utf16() {
        if i >= t.len() || t[i] != c {
            return false;
        }
        i += 1;
    }
    true
}

/// `indexOf`.
pub fn finn(t: &[u16], fra: usize, mønster: &str) -> Option<usize> {
    let m = u(mønster);
    if m.is_empty() {
        return Some(fra.min(t.len()));
    }
    (fra..t.len().saturating_sub(m.len() - 1)).find(|&i| t[i..].starts_with(&m))
}

pub fn finn_tegn(t: &[u16], fra: usize, c: u16) -> Option<usize> {
    (fra..t.len()).find(|&i| t[i] == c)
}

pub fn inneholder(t: &[u16], mønster: &str) -> bool {
    finn(t, 0, mønster).is_some()
}

/// `toLowerCase()`: hele Unicode, med de samme reglene som JavaScript, også
/// for sigma til slutt i et ord. Et ensomt surrogat står urørt.
pub fn liten(t: &[u16]) -> Tekst {
    if t.iter().all(|&c| c < 0x80) {
        return t.iter().map(|&c| ascii_liten(c)).collect();
    }
    match String::from_utf16(t) {
        Ok(streng) => u(&streng.to_lowercase()),
        Err(_) => {
            let mut ut = Vec::with_capacity(t.len());
            for tegn in char::decode_utf16(t.iter().copied()) {
                match tegn {
                    Ok(c) => {
                        let mut buf = [0u16; 2];
                        for l in c.to_lowercase() {
                            ut.extend_from_slice(l.encode_utf16(&mut buf));
                        }
                    }
                    Err(e) => ut.push(e.unpaired_surrogate()),
                }
            }
            ut
        }
    }
}

/// `trim()`.
pub fn trimmet(t: &[u16]) -> &[u16] {
    let fra = t.iter().position(|&c| !er_mellomrom(c)).unwrap_or(t.len());
    let til = t
        .iter()
        .rposition(|&c| !er_mellomrom(c))
        .map_or(fra, |i| i + 1);
    &t[fra..til]
}

/// Delene av `t` skilt av mellomrom, med posisjonen til hver: `/\S+/g`.
pub fn ord(t: &[u16]) -> Vec<(usize, &[u16])> {
    let mut ut = Vec::new();
    let mut i = 0;
    while i < t.len() {
        if er_mellomrom(t[i]) {
            i += 1;
            continue;
        }
        let fra = i;
        while i < t.len() && !er_mellomrom(t[i]) {
            i += 1;
        }
        ut.push((fra, &t[fra..i]));
    }
    ut
}

/// Bytter hvert tegn med mellomrom, unntatt linjeskift, så posisjonene står.
pub fn blank(t: &mut [u16]) {
    for c in t.iter_mut() {
        if *c != b'\n' as u16 {
            *c = b' ' as u16;
        }
    }
}

/// Hvor mange UTF-16-enheter en Rust-streng er, som `length` i JavaScript.
pub fn lengde(s: &str) -> usize {
    s.encode_utf16().count()
}

pub const LT: u16 = b'<' as u16;
pub const GT: u16 = b'>' as u16;
pub const SKRÅSTREK: u16 = b'/' as u16;
pub const LIK: u16 = b'=' as u16;
pub const DOBBEL: u16 = b'"' as u16;
pub const ENKEL: u16 = b'\'' as u16;
pub const BAKOVER: u16 = b'`' as u16;

//! `lotek check-theme <file…>`: checks a theme someone wrote by hand.
//!
//! The generator keeps the promises by construction, but a hand-written theme
//! is the consumer's responsibility. Without this command, "you can override
//! any cell" is a trap.
//!
//! The count comes last and requires the number to be greater than zero. A
//! run that found not a single file must not look like a run without
//! findings.

use std::io::ErrorKind;

use crate::output::{count, error, fail, log, shown};
use lotek_core::theme::check::inspect_theme;

pub fn run(arguments: &[String]) {
    // An unknown flag stops the run instead of disappearing: a typo in a flag
    // looks as if the command did what you asked.
    let unknown: Vec<&str> = arguments
        .iter()
        .filter(|a| a.starts_with('-'))
        .map(String::as_str)
        .collect();
    if !unknown.is_empty() {
        fail(&format!(
            "Unknown flag: {}.\n\n`lotek check-theme` takes only file names.\n",
            unknown.join(", ")
        ));
    }
    if arguments.is_empty() {
        fail("Give at least one CSS file: `lotek check-theme theme.css`.\n\nThe command reads the --lt-color-* values in the file and checks that every contrast promise holds, in every block.\n");
    }

    // Files that could not be read are collected and reported together.
    let mut sources: Vec<(&str, String)> = Vec::new();
    let mut unreadable: Vec<String> = Vec::new();
    for path in arguments {
        let read = std::fs::metadata(path).and_then(|m| {
            if m.is_dir() {
                Err(std::io::Error::from(ErrorKind::IsADirectory))
            } else {
                std::fs::read(path)
            }
        });
        match read {
            Ok(bytes) => sources.push((path, String::from_utf8_lossy(&bytes).into_owned())),
            Err(e) => unreadable.push({
                let path = shown(path);
                match e.kind() {
                    ErrorKind::IsADirectory => format!("{path} (is a folder)"),
                    ErrorKind::NotFound => format!("{path} (does not exist)"),
                    ErrorKind::PermissionDenied => format!("{path} (EACCES)"),
                    _ => format!("{path} (could not be read)"),
                }
            }),
        }
    }
    if !unreadable.is_empty() {
        fail(&format!("Could not read: {}.", unreadable.join(", ")));
    }

    crate::package::load_contract();
    let (mut problems, mut blocks, mut declarations, mut promises, mut others) = (0, 0, 0, 0, 0);
    for (path, css) in &sources {
        let report = inspect_theme(css);
        for problem in &report.problems {
            error(&format!(
                "{}  {}\n  {}",
                shown(path),
                problem.selector,
                problem.message
            ));
            problems += 1;
        }
        blocks += report.blocks;
        declarations += report.declarations;
        promises += report.promises;
        others += report.others;
    }

    // The count comes last, and counts the consumer's own values: the defaults
    // fill the gaps, so one line gives as many promises as a whole theme.
    let files = count(sources.len(), "file", "files");
    let summary = format!(
        "{} in {}, against {}, in {files}",
        count(declarations, "value", "values"),
        count(blocks, "block", "blocks"),
        count(promises, "promise", "promises"),
    );
    // A theme without colours, only font and shape, has no contrast to
    // check. That is not the same as a file without a theme.
    if declarations == 0 && problems == 0 && others > 0 {
        log(&format!(
            "No contrast to check: {files} sets only {} without a contrast promise, such as font, shape and the system colours.",
            count(others, "token", "tokens")
        ));
        return;
    }
    if declarations == 0 && problems == 0 {
        fail(&format!(
            "Found no --lt-color-* values in {files}. The check has not looked at anything."
        ));
    }
    if problems > 0 {
        fail(&format!(
            "\n{}. Checked {summary}.",
            count(problems, "problem", "problems")
        ));
    }
    log(&format!(
        "The theme keeps every promise. Checked {summary}."
    ));
}

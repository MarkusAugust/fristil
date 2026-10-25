package no.lotek

/**
 * Fails with the findings as the message if LO-TEK finds anything in [html].
 *
 * For ordinary tests, with any test framework: it throws an
 * `AssertionError`, which JUnit, Kotest and TestNG all understand.
 *
 * ```kotlin
 * @Test
 * fun `the form is wired correctly`() {
 *     assertLotek(app.render("/form"))
 * }
 * ```
 *
 * By default a whole page is checked, with [Lotek.diagnosePage]: that every
 * id something points to exists, and that every field is wired. If [html] is
 * a piece of a page, like a template or a component, set [fragment], and
 * then only the vocabulary is checked, with [Lotek.diagnoseMarkup].
 *
 * With [css], the text of the stylesheets the page loads, it also reports a
 * class none of them styles, and a value without a rule.
 *
 * The message has one line per finding, like `12:30: error: message [rule]`,
 * and that is what a coding agent reads and fixes from.
 */
fun assertLotek(html: String, fragment: Boolean = false, css: List<String>? = null) {
    report(if (fragment) Lotek.diagnoseMarkup(html, css) else Lotek.diagnosePage(html, css))
}

/**
 * Fails with the findings as the message if LO-TEK finds anything on the
 * page as the browser rendered it, with the stylesheets it loaded: what
 * [assertLotek] finds, and a class no stylesheet styles, or a value without
 * a rule.
 *
 * [evaluate] runs a script on the page and returns the result. With
 * Playwright for Java:
 *
 * ```kotlin
 * page.navigate("http://localhost:8080/form")
 * assertLotekRendered { script -> page.evaluate(script) }
 * ```
 */
fun assertLotekRendered(evaluate: (String) -> Any?) {
    val rendered = evaluate(Lotek.READ_RENDERED_PAGE) as? Map<*, *>
        ?: throw IllegalStateException("The script that reads the page did not return an object with html and css.")
    report(Lotek.diagnoseRendered(rendered))
}

private fun report(findings: List<Finding>) {
    if (findings.isEmpty()) return
    val lines = findings.joinToString("\n") { "${it.line}:${it.column}: ${severityWord(it)}: ${it.message} [${it.rule}]" }
    val count = if (findings.size == 1) "one finding" else "${findings.size} findings"
    throw AssertionError("LO-TEK found $count:\n$lines")
}

private fun severityWord(finding: Finding): String = if (finding.severity == "error") "error" else "warning"

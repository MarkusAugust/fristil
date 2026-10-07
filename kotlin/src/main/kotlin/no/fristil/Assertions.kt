package no.fristil

/**
 * Feiler med funnene som melding hvis Fristil finner noe i [html].
 *
 * Til vanlige tester, med hvilket testrammeverk som helst: den kaster en
 * `AssertionError`, som JUnit, Kotest og TestNG alle forstår.
 *
 * ```kotlin
 * @Test
 * fun `skjemaet er koblet riktig`() {
 *     assertFristil(app.render("/skjema"))
 * }
 * ```
 *
 * Som standard sjekkes en hel side, med [Fristil.diagnosePage]: at hver id
 * det pekes på finnes, og at hvert felt er koblet. Er [html] en bit av en
 * side, som en mal eller en komponent, settes [fragment], og da sjekkes bare
 * ordforrådet, med [Fristil.diagnoseMarkup].
 *
 * Med [css], teksten i stilarkene siden laster, sier den også fra om en
 * klasse ingen av dem styler, og om en verdi uten regel.
 *
 * Meldingen har én linje per funn, som `12:30: feil: melding [regel]`, og det
 * er den en kodeagent leser og retter etter.
 */
fun assertFristil(html: String, fragment: Boolean = false, css: List<String> = emptyList()) {
    report(if (fragment) Fristil.diagnoseMarkup(html, css) else Fristil.diagnosePage(html, css))
}

/**
 * Feiler med funnene som melding hvis Fristil finner noe på siden slik
 * nettleseren har rendret den, med stilarkene den lastet: det
 * [assertFristil] finner, og en klasse ingen stilark styler, eller en verdi
 * uten regel.
 *
 * [evaluate] kjører et skript på siden og gir svaret. Med Playwright for Java:
 *
 * ```kotlin
 * page.navigate("http://localhost:8080/skjema")
 * assertFristilRendered { script -> page.evaluate(script) }
 * ```
 */
fun assertFristilRendered(evaluate: (String) -> Any?) {
    val rendered = evaluate(Fristil.READ_RENDERED_PAGE) as? Map<*, *>
        ?: throw IllegalStateException("Skriptet som leser siden, ga ikke et objekt med html og css.")
    report(Fristil.diagnoseRendered(rendered))
}

private fun report(findings: List<Finding>) {
    if (findings.isEmpty()) return
    val lines = findings.joinToString("\n") { "${it.line}:${it.column}: ${severityWord(it)}: ${it.message} [${it.rule}]" }
    val count = if (findings.size == 1) "ett funn" else "${findings.size} funn"
    throw AssertionError("Fristil fant $count:\n$lines")
}

private fun severityWord(finding: Finding): String = if (finding.severity == "error") "feil" else "advarsel"

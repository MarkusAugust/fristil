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
 * Meldingen har én linje per funn, som `12:30: feil: melding [regel]`, og det
 * er den en kodeagent leser og retter etter.
 */
fun assertFristil(html: String, fragment: Boolean = false) {
    val findings = if (fragment) Fristil.diagnoseMarkup(html) else Fristil.diagnosePage(html)
    if (findings.isEmpty()) return
    val lines = findings.joinToString("\n") { "${it.line}:${it.column}: ${severityWord(it)}: ${it.message} [${it.rule}]" }
    val count = if (findings.size == 1) "ett funn" else "${findings.size} funn"
    throw AssertionError("Fristil fant $count:\n$lines")
}

private fun severityWord(finding: Finding): String = if (finding.severity == "error") "feil" else "advarsel"

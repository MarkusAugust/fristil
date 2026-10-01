package no.fristil.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * At klassene foreslås der de skal, og tier der de ikke skal.
 *
 * Pluginen finnes fordi `web-types.json` gir fullføring i HTML-filer, men
 * ikke i HTML som er injisert i en streng. Testene dekker begge deler: at
 * fullføringen virker i en vanlig fil, og at den virker i et fragment.
 */
class FullforingTest : BasePlatformTestCase() {
    /**
     * Forslagene fullføringen gir på dette stedet.
     *
     * Finnes det bare ett treff, setter IntelliJ det inn med en gang og
     * lukker lista, og da er `lookupElementStrings` null. Det er ikke det
     * samme som at ingenting ble foreslått, så det ene treffet leses ut av
     * dokumentet i stedet. Uten dette så en vellykket autofullføring ut som
     * en tom liste, og testen felte riktig kode.
     */
    private fun forslag(
        filnavn: String,
        innhold: String,
    ): List<String> {
        myFixture.configureByText(filnavn, innhold)
        val elementer = myFixture.completeBasic()

        myFixture.lookupElementStrings?.let { return it }

        // `completeBasic` gir null når den satte inn ett treff selv.
        if (elementer == null || elementer.isEmpty()) {
            val tekst = myFixture.editor.document.text
            val slutt = myFixture.editor.caretModel.offset
            val start = tekst.lastIndexOfAny(charArrayOf(' ', '"', '\'', '\n'), slutt - 1) + 1
            val satt = tekst.substring(start, slutt)
            return if (satt.startsWith("fs-")) listOf(satt) else emptyList()
        }

        return elementer.map { it.lookupString }
    }

    fun `test foreslår klasser i en vanlig HTML-fil`() {
        val ut = forslag("test.html", """<button class="fs-<caret>">Lagre</button>""")
        assertTrue("fs-button skal være med, fikk $ut", ut.contains("fs-button"))
        assertTrue("fs-table skal være med", ut.contains("fs-table"))
    }

    fun `test finner riktig klasse av et lengre prefiks`() {
        val ut = forslag("test.html", """<table class="fs-tab<caret>">""")
        assertTrue("fs-table skal være med, fikk $ut", ut.contains("fs-table"))
    }

    fun `test finner klasse nummer to i en verdi med flere`() {
        val ut = forslag("test.html", """<button class="min-egen fs-but<caret>">""")
        assertTrue("fs-button skal være med, fikk $ut", ut.contains("fs-button"))
    }

    /*
     * At prefikset faktisk filtrerer, ikke bare at noe kommer ut.
     *
     * Uten denne passerte alle testene også da fullføringen la ut hele lista
     * uansett hva som sto foran markøren. Den skiller «fant riktig klasse»
     * fra «fant alle klasser, og én av dem var riktig».
     */
    fun `test filtrerer på det som alt er skrevet`() {
        val alle = forslag("test.html", """<button class="fs-<caret>">""")
        val smalt = forslag("test.html", """<button class="fs-tab<caret>">""")

        assertTrue("fs- skal gi hele lista, fikk ${alle.size}", alle.size > 50)
        assertTrue("fs-tab skal gi færre, fikk ${smalt.size}", smalt.size < alle.size)
        assertTrue("fs-table skal være blant dem", smalt.contains("fs-table"))
        assertFalse("fs-button skal ikke være med", smalt.contains("fs-button"))
    }

    fun `test tier utenfor en class-verdi`() {
        val ut = forslag("test.html", """<button id="fs-<caret>">""")
        assertFalse("skal ikke foreslå i id, fikk $ut", ut.contains("fs-button"))
    }

    fun `test tier i vanlig tekst`() {
        val ut = forslag("test.html", """<p>fs-<caret></p>""")
        assertFalse("skal ikke foreslå i brødtekst, fikk $ut", ut.contains("fs-button"))
    }

    fun `test foreslår i HTML injisert i en Kotlin-streng`() {
        // Dette er hele grunnen til at pluginen finnes. `language=HTML` er
        // IntelliJs kommentarbaserte injeksjon og gir samme fragment som
        // @Language("HTML").
        val ut =
            forslag(
                "Visning.kt",
                """
                // language=HTML
                val tabell = ""${'"'}
                    <table class="fs-<caret>">
                ""${'"'}
                """.trimIndent(),
            )
        assertTrue("fs-table skal være med i en injisert streng, fikk $ut", ut.contains("fs-table"))
    }

    fun `test katalogen har klassene fra pakken`() {
        assertTrue("katalogen skal ikke være tom", Katalog.klasser.isNotEmpty())
        assertNotNull("fs-button skal finnes", Katalog.finn("fs-button"))
        assertNull("en oppdiktet klasse skal ikke finnes", Katalog.finn("fs-modal"))
    }

    fun `test hver klasse har komponent og lenke`() {
        val uten = Katalog.klasser.filter { it.komponent.isEmpty() || it.lenke.isEmpty() }
        assertTrue("alle skal ha komponentnavn og lenke, mangler: $uten", uten.isEmpty())
    }
}

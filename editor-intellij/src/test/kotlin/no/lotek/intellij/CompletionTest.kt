package no.lotek.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * At klassene foreslås der de skal, og tier der de ikke skal.
 *
 * Pluginen finnes fordi `web-types.json` gir fullføring i HTML-filer, men
 * ikke i HTML som er injisert i en streng. Testene dekker begge deler: at
 * fullføringen virker i en vanlig fil, og at den virker i et fragment.
 */
class CompletionTest : BasePlatformTestCase() {
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
        if (elementer != null) return elementer.map { it.lookupString }

        /*
         * `completeBasic` gir null når den satte inn det ene treffet selv.
         *
         * Da er lista lukket, og det som ble satt inn må leses ut av
         * dokumentet. Teksten foran markøren sammenlignes med det som sto der
         * før: er den uendret, skjedde ingenting, og det er ikke det samme
         * som et forslag. Uten den sammenligningen rapporterte hjelperen
         * brukerens egen tekst som om pluginen hadde levert den.
         */
        val før = innhold.substringBefore("<caret>").takeLastWhile { !it.isWhitespace() && it != '"' && it != '\'' }
        val tekst = myFixture.editor.document.text
        val slutt = myFixture.editor.caretModel.offset
        val start = tekst.lastIndexOfAny(charArrayOf(' ', '"', '\'', '\n', '='), slutt - 1) + 1
        val etter = tekst.substring(start, slutt)

        return if (etter != før && etter.startsWith("lt-")) listOf(etter) else emptyList()
    }

    fun `test foreslår klasser i en vanlig HTML-fil`() {
        val ut = forslag("test.html", """<button class="lt-<caret>">Lagre</button>""")
        assertTrue("lt-button skal være med, fikk $ut", ut.contains("lt-button"))
        assertTrue("lt-table skal være med", ut.contains("lt-table"))
    }

    fun `test finner riktig klasse av et lengre prefiks`() {
        val ut = forslag("test.html", """<table class="lt-tab<caret>">""")
        assertTrue("lt-table skal være med, fikk $ut", ut.contains("lt-table"))
    }

    fun `test finner klasse nummer to i en verdi med flere`() {
        val ut = forslag("test.html", """<button class="min-egen lt-but<caret>">""")
        assertTrue("lt-button skal være med, fikk $ut", ut.contains("lt-button"))
    }

    /*
     * At prefikset faktisk filtrerer, ikke bare at noe kommer ut.
     *
     * Uten denne passerte alle testene også da fullføringen la ut hele lista
     * uansett hva som sto foran markøren. Den skiller «fant riktig klasse»
     * fra «fant alle klasser, og én av dem var riktig».
     */
    fun `test filtrerer på det som alt er skrevet`() {
        val alle = forslag("test.html", """<button class="lt-<caret>">""")
        val smalt = forslag("test.html", """<button class="lt-tab<caret>">""")

        assertTrue("lt- skal gi hele lista, fikk ${alle.size}", alle.size > 50)
        assertTrue("lt-tab skal gi færre, fikk ${smalt.size}", smalt.size < alle.size)
        assertTrue("lt-table skal være blant dem", smalt.contains("lt-table"))
        assertFalse("lt-button skal ikke være med", smalt.contains("lt-button"))
    }

    fun `test tier utenfor en class-verdi`() {
        val ut = forslag("test.html", """<button id="lt-<caret>">""")
        assertFalse("skal ikke foreslå i id, fikk $ut", ut.contains("lt-button"))
    }

    fun `test virker på en verdi uten anførselstegn`() {
        // Bar verdi er gyldig HTML. Da bare anførselstegn talte, ga
        // `class=lt-` ingenting.
        val ut = forslag("test.html", """<div class=lt-tab<caret>""")
        assertTrue("lt-table skal være med, fikk $ut", ut.contains("lt-table"))
    }

    fun `test tier i et bundet class-attributt`() {
        /*
         * Vue og Alpine tar et JavaScript-uttrykk i `:class` og
         * `x-bind:class`. Et bart `lt-button` der blir en variabelreferanse,
         * ikke en klasse, så forslaget ville gitt kode som ikke virker.
         */
        for (attributt in listOf(":class", "x-bind:class", "v-bind:class")) {
            val ut = forslag("test.html", """<div $attributt="lt-<caret>">""")
            assertFalse("skal tie i $attributt, fikk $ut", ut.contains("lt-button"))
        }
    }

    fun `test lar seg ikke lure av et class-likhetstegn i en annen verdi`() {
        // Løkka bryter på det lukkende anførselstegnet, og uten kravet om at
        // `=` står rett foran navnet sto `=` fra verdiens innhold igjen.
        val ut = forslag("test.html", """<div title="class=" lt-<caret>""")
        assertFalse("skal ikke foreslå her, fikk $ut", ut.contains("lt-button"))
    }

    fun `test tier i vanlig tekst`() {
        val ut = forslag("test.html", """<p>lt-<caret></p>""")
        assertFalse("skal ikke foreslå i brødtekst, fikk $ut", ut.contains("lt-button"))
    }

    fun `test tier i tekst rett etter en lukket tagg`() {
        /*
         * Taggen er lukket, så markøren står i innhold og ikke i et attributt.
         *
         * Uten sjekken på at taggen er åpen finner koden `class=` lenger bak
         * i den samme taggen, og ser ingen mellomrom mellom det og markøren.
         * Testen over fanger ikke dette: der finnes det ikke noe `=` i det
         * hele tatt, så den stopper av en annen grunn.
         */
        val ut = forslag("test.html", """<div class="a">lt-<caret>""")
        assertFalse("skal ikke foreslå etter en lukket tagg, fikk $ut", ut.contains("lt-button"))
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
                    <table class="lt-<caret>">
                ""${'"'}
                """.trimIndent(),
            )
        assertTrue("lt-table skal være med i en injisert streng, fikk $ut", ut.contains("lt-table"))
    }

    /** Manifestet i pakken med `lt-card` byttet ut med `lt-kort`, som etter `lotek overta`. */
    private val overtatt =
        java.io.File(System.getProperty("manifest")).readText().replace("\"lt-card\": {", "\"lt-kort\": {")

    fun `test foreslår klassene i prosjektets manifest`() {
        // Det samme manifestet som sjekken går mot (DiagnosticsTest), så
        // fullføringen ikke foreslår lt-card rett før annotatoren streker den
        // under. Før leste den alltid pakkens manifest.
        myFixture.addFileToProject("build/lotek/manifest.json", overtatt)
        val ut = forslag("test.html", """<div class="lt-<caret>">""")
        assertTrue("lt-kort skal være med, fikk $ut", ut.contains("lt-kort"))
        assertFalse("lt-card skal ikke være med, fikk $ut", ut.contains("lt-card"))
    }

    fun `test foreslår fra prosjektets manifest i et injisert fragment`() {
        myFixture.addFileToProject("node_modules/@lo-tek/interfaces/manifest/manifest.json", overtatt)
        val ut =
            forslag(
                "Visning.kt",
                """
                // language=HTML
                val kort = ""${'"'}
                    <div class="lt-<caret>">
                ""${'"'}
                """.trimIndent(),
            )
        assertTrue("lt-kort skal være med i en injisert streng, fikk $ut", ut.contains("lt-kort"))
        assertFalse("lt-card skal ikke være med, fikk $ut", ut.contains("lt-card"))
    }

    fun `test et manifest kjernen ikke kan lese gir pakkens klasser`() {
        myFixture.addFileToProject("build/lotek/manifest.json", "{}")
        val ut = forslag("test.html", """<div class="lt-<caret>">""")
        assertTrue("lt-button skal være med, fikk $ut", ut.contains("lt-button"))
    }

    fun `test katalogen har klassene fra pakken`() {
        assertTrue("katalogen skal ikke være tom", Katalog.klasser.isNotEmpty())
        assertNotNull("lt-button skal finnes", Katalog.finn("lt-button"))
        assertNull("en oppdiktet klasse skal ikke finnes", Katalog.finn("lt-modal"))
    }

    fun `test hver klasse har komponent og lenke`() {
        val uten = Katalog.klasser.filter { it.komponent.isEmpty() || it.lenke.isEmpty() }
        assertTrue("alle skal ha komponentnavn og lenke, mangler: $uten", uten.isEmpty())
    }
}

package no.fristil.html

import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertFailsWith
import kotlinx.html.FormMethod
import kotlinx.html.body
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.form
import kotlinx.html.h2
import kotlinx.html.head
import kotlinx.html.html
import kotlinx.html.input
import kotlinx.html.label
import kotlinx.html.li
import kotlinx.html.link
import kotlinx.html.p
import kotlinx.html.span
import kotlinx.html.stream.createHTML
import kotlinx.html.title
import kotlinx.html.ul
import no.fristil.ButtonVariant
import no.fristil.Fs
import no.fristil.FristilWebJar
import no.fristil.InputType
import no.fristil.RequiredMarker
import no.fristil.assertFristil
import no.fristil.errorSummary
import no.fristil.field

/**
 * At en side bygget med kotlinx.html og Fristils byggefunksjoner er riktig
 * markup, sjekket av den samme kjernen som `fristil sjekk`.
 */
class FsTest {
    /** Et søknadsskjema med feil i e-postfeltet, slik en Ktor-app ville rendret det. */
    private fun soknad(ugyldig: Boolean): String =
        createHTML().html {
            head {
                title("Søknad")
                link(rel = "stylesheet", href = FristilWebJar.CSS)
            }
            body {
                form(action = "/soknad", method = FormMethod.post) {
                    val feil = Fs.errorSummary(count = if (ugyldig) 1 else 0, id = "feil")
                    div { fs(feil.host)
                        h2 { fs(feil.title); +"Du må rette 1 feil" }
                        ul { li { +"E-postadressen mangler @" } }
                    }
                    val felt = Fs.field(id = "epost", required = RequiredMarker.TEXT, help = true, error = true, invalid = ugyldig)
                    label { fs(felt.label); +"E-postadresse" }
                    input { fs(Fs.input(type = InputType.EMAIL, state = felt.state), felt.control); name = "epost" }
                    p { fs(Fs.helpText(), felt.help); +"Vi sender kvittering hit." }
                    p { fs(Fs.errorText(), felt.error); +"Skriv en gyldig adresse." }
                    button { fs(Fs.button()); +"Send" }
                    button { fs(Fs.button(variant = ButtonVariant.SECONDARY)); +"Lagre utkast" }
                }
            }
        }

    @Test
    fun `siden er riktig markup, med og uten feil`() {
        assertFristil(soknad(ugyldig = false))
        assertFristil(soknad(ugyldig = true))
    }

    @Test
    fun `koblingen mellom ledetekst, felt og feilmelding står i HTML-en`() {
        val html = soknad(ugyldig = true)
        assertContains(html, """for="epost"""")
        assertContains(html, """aria-describedby="epost-help epost-error"""")
        assertContains(html, """aria-invalid="true"""")
    }

    @Test
    fun `klassene legges til dem taggen har`() {
        val html = createHTML().div(classes = "min-egen") { fs(Fs.card(), mapOf("class" to "min-egen ekstra")) }
        assertContains(html, """class="min-egen fs-card ekstra"""")
    }

    @Test
    fun `en skrivefeil i en egen klasse fanges av sjekken`() {
        val html = createHTML().span { fs(Fs.badge(), mapOf("class" to "fs-badg")); +"Ny" }
        assertFailsWith<AssertionError> { assertFristil(html, fragment = true) }
    }
}

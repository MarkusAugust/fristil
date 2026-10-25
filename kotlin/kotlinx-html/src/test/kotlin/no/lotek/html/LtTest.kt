package no.lotek.html

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
import no.lotek.ButtonVariant
import no.lotek.Lt
import no.lotek.LotekWebJar
import no.lotek.InputType
import no.lotek.RequiredMarker
import no.lotek.assertLotek
import no.lotek.errorSummary
import no.lotek.field

/**
 * At en side bygget med kotlinx.html og LO-TEKs byggefunksjoner er riktig
 * markup, sjekket av den samme kjernen som `lotek sjekk`.
 */
class LtTest {
    /** Et søknadsskjema med feil i e-postfeltet, slik en Ktor-app ville rendret det. */
    private fun soknad(ugyldig: Boolean): String =
        createHTML().html {
            head {
                title("Søknad")
                link(rel = "stylesheet", href = LotekWebJar.CSS)
            }
            body {
                form(action = "/soknad", method = FormMethod.post) {
                    val feil = Lt.errorSummary(count = if (ugyldig) 1 else 0, id = "feil")
                    div { lt(feil.host)
                        h2 { lt(feil.title); +"Du må rette 1 feil" }
                        ul { li { +"E-postadressen mangler @" } }
                    }
                    val felt = Lt.field(id = "epost", required = RequiredMarker.TEXT, help = true, error = true, invalid = ugyldig)
                    label { lt(felt.label); +"E-postadresse" }
                    input { lt(Lt.input(type = InputType.EMAIL, state = felt.state), felt.control); name = "epost" }
                    p { lt(Lt.helpText(), felt.help); +"Vi sender kvittering hit." }
                    p { lt(Lt.errorText(), felt.error); +"Skriv en gyldig adresse." }
                    button { lt(Lt.button()); +"Send" }
                    button { lt(Lt.button(variant = ButtonVariant.SECONDARY)); +"Lagre utkast" }
                }
            }
        }

    @Test
    fun `siden er riktig markup, med og uten feil`() {
        assertLotek(soknad(ugyldig = false))
        assertLotek(soknad(ugyldig = true))
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
        val html = createHTML().div(classes = "min-egen") { lt(Lt.card(), mapOf("class" to "min-egen ekstra")) }
        assertContains(html, """class="min-egen lt-card ekstra"""")
    }

    @Test
    fun `en skrivefeil i en egen klasse fanges av sjekken`() {
        val html = createHTML().span { lt(Lt.badge(), mapOf("class" to "lt-badg")); +"Ny" }
        assertFailsWith<AssertionError> { assertLotek(html, fragment = true) }
    }
}

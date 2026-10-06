package no.fristil

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Eksempelet i README-en, kjørt. Står det noe annet i README-en enn det
 * denne testen viser, er det README-en som må rettes.
 */
class ReadmeTest {
    @Test
    fun `skjemafeltet i README-en gir denne HTML-en`() {
        val epostUgyldig = true

        val felt = Fs.field(id = "epost", help = true, error = true, invalid = epostUgyldig)
        val input = Fs.input(type = InputType.EMAIL, state = felt.state) + felt.control

        val html =
            """
            <label${felt.label.toHtml()}>E-post</label>
            <input${input.toHtml()} name="epost">
            <p${(Fs.helpText() + felt.help).toHtml()}>Vi sender aldri spam</p>
            <p${(Fs.errorText() + felt.error).toHtml()}>Skriv en gyldig e-postadresse</p>
            """.trimIndent()

        assertEquals(
            """
            <label class="fs-label" for="epost">E-post</label>
            <input class="fs-input" type="email" data-state="invalid" aria-invalid="true" id="epost" aria-describedby="epost-help epost-error" name="epost">
            <p class="fs-help-text" id="epost-help">Vi sender aldri spam</p>
            <p class="fs-error-text" id="epost-error">Skriv en gyldig e-postadresse</p>
            """.trimIndent(),
            html,
        )
    }
}

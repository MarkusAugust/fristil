package no.fristil

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class AttributesTest {
    @Test
    fun `toHtml escaper verdiene og skriver boolske attributter uten verdi`() {
        val felt = Fs.field(id = "a\"b<c>", help = true, disabled = true)
        assertEquals(
            " id=\"a&quot;b&lt;c&gt;\" aria-describedby=\"a&quot;b&lt;c&gt;-help\" disabled",
            felt.control.toHtml(),
        )
    }

    @Test
    fun `et sett til høyre vinner over et til venstre`() {
        val felt = Fs.field(id = "epost", invalid = true)
        val samlet = Fs.input(type = InputType.EMAIL, state = felt.state) + felt.control
        assertEquals(
            " class=\"fs-input\" type=\"email\" data-state=\"invalid\" aria-invalid=\"true\" id=\"epost\"",
            samlet.toHtml(),
        )
    }

    @Test
    fun `en tom id, eller en med bare mellomrom, er en feil i koden`() {
        assertFailsWith<IllegalArgumentException> { Fs.field(id = "") }
        assertFailsWith<IllegalArgumentException> { Fs.field(id = "  ") }
        // Hardt mellomrom og BOM, som JavaScript sin trim() også fjerner.
        assertFailsWith<IllegalArgumentException> { Fs.field(id = "\u00A0\uFEFF") }
    }
}

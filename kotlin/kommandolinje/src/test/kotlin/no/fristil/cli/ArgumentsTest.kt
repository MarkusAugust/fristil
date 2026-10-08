package no.fristil.cli

import kotlin.test.Test
import kotlin.test.assertEquals

/** Argumentene når JVM-en leste dem med et annet tegnsett enn UTF-8. */
class ArgumentsTest {
    private val ascii = Charsets.US_ASCII

    private fun cmdline(vararg parts: String) =
        parts.joinToString("") { "$it\u0000" }.toByteArray(Charsets.UTF_8)

    @Test
    fun `reads the arguments as written when the JVM read them as ASCII`() {
        val raw = cmdline("java", "-jar", "fristil.jar", "tema", "--knapp-hjørner=2rem")
        // Slik JVM-en leser «ø» med ASCII: to ukjente tegn.
        val jvm = listOf("tema", String("--knapp-hjørner=2rem".toByteArray(Charsets.UTF_8), ascii))
        assertEquals(listOf("tema", "--knapp-hjørner=2rem"), fromCommandLine(raw, jvm, ascii))
    }

    @Test
    fun `keeps the arguments from the JVM when they are not in cmdline`() {
        // `java @opts`: argumentene står i fila, ikke i cmdline.
        val raw = cmdline("java", "@opts")
        assertEquals(listOf("sjekk"), fromCommandLine(raw, listOf("sjekk"), ascii))
    }

    @Test
    fun `keeps empty arguments in place`() {
        val raw = cmdline("java", "-jar", "fristil.jar", "sjekk", "")
        assertEquals(listOf("sjekk", ""), fromCommandLine(raw, listOf("sjekk", ""), ascii))
    }
}

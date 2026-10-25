package no.lotek.cli

import kotlin.test.Test
import kotlin.test.assertEquals

/** The arguments when the JVM read them with a character set other than UTF-8. */
class ArgumentsTest {
    private val ascii = Charsets.US_ASCII

    private fun cmdline(vararg parts: String) =
        parts.joinToString("") { "$it\u0000" }.toByteArray(Charsets.UTF_8)

    @Test
    fun `reads the arguments as written when the JVM read them as ASCII`() {
        val raw = cmdline("java", "-jar", "lotek.jar", "theme", "--font=Söhne")
        // How the JVM reads "ö" with ASCII: two unknown characters.
        val jvm = listOf("theme", String("--font=Söhne".toByteArray(Charsets.UTF_8), ascii))
        assertEquals(listOf("theme", "--font=Söhne"), fromCommandLine(raw, jvm, ascii))
    }

    @Test
    fun `keeps the arguments from the JVM when they are not in cmdline`() {
        // `java @opts`: the arguments are in the file, not in cmdline.
        val raw = cmdline("java", "@opts")
        assertEquals(listOf("check"), fromCommandLine(raw, listOf("check"), ascii))
    }

    @Test
    fun `keeps empty arguments in place`() {
        val raw = cmdline("java", "-jar", "lotek.jar", "check", "")
        assertEquals(listOf("check", ""), fromCommandLine(raw, listOf("check", ""), ascii))
    }
}

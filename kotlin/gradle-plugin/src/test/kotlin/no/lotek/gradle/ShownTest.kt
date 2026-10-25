package no.fristil.gradle

import java.io.File
import java.nio.file.FileSystems
import kotlin.test.Test
import kotlin.test.assertEquals

class ShownTest {
    @Test
    fun `a file inside the project is shown relative to it, others absolute`() {
        val project = File("/prosjekt").absoluteFile
        assertEquals("maler${File.separator}a.html", shown(File(project, "maler/a.html"), project))
        val outside = File("/annet/b.html").absoluteFile
        assertEquals(outside.absolutePath, shown(outside, project))
    }

    @Test
    fun `a file on another drive is shown absolute`() {
        // Bare Windows har stasjoner. Andre steder er det ingenting å prøve.
        val roots = FileSystems.getDefault().rootDirectories.toList()
        if (roots.size < 2) return
        val file = roots[1].resolve("b.html").toFile()
        assertEquals(file.absolutePath, shown(file, roots[0].resolve("prosjekt").toFile()))
    }
}

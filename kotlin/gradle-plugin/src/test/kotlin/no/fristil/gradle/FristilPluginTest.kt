package no.fristil.gradle

import no.fristil.cli.CommandLine
import org.gradle.testkit.runner.GradleRunner
import org.gradle.testkit.runner.TaskOutcome
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Pluginen i et ekte, lite prosjekt, kjørt av Gradle selv. Det som prøves er
 * det en bruker merker: at `check` feiler på en feil i en mal og sier hvor,
 * at temaet og manifestet skrives, og at en overtatt komponent sjekkes mot
 * fragmentet sitt.
 */
class FristilPluginTest {
    private val project: File = Files.createTempDirectory("fristil-gradle-").toFile()

    private fun file(path: String, content: String) =
        File(project, path).apply {
            parentFile.mkdirs()
            writeText(content)
        }

    private fun gradle(vararg args: String) =
        GradleRunner.create().withProjectDir(project).withPluginClasspath().withArguments(*args, "--stacktrace")

    private fun setUp(extra: String = "") {
        file("settings.gradle.kts", "rootProject.name = \"app\"\n")
        file(
            "build.gradle.kts",
            """
            plugins {
                base
                id("io.github.markusaugust.fristil")
            }

            fristil {
                templates.from(fileTree("maler"))
                $extra
            }
            """.trimIndent(),
        )
    }

    @Test
    fun `check fails on a template with a mistake, and says where`() {
        setUp()
        file("maler/skjema.html", "<form>\n  <button class=\"fs-buton\">Send</button>\n</form>\n")

        val failed = gradle("check").buildAndFail()
        assertContains(failed.output, "maler/skjema.html:2:18: advarsel: Klassen «fs-buton» finnes ikke i Fristil. Mente du fs-button?")
        assertEquals(TaskOutcome.FAILED, failed.task(":fristilSjekk")?.outcome)

        file("maler/skjema.html", "<form>\n  <button class=\"fs-button\">Send</button>\n</form>\n")
        val passed = gradle("check").build()
        assertEquals(TaskOutcome.SUCCESS, passed.task(":fristilSjekk")?.outcome)
        assertEquals(TaskOutcome.UP_TO_DATE, gradle("check").build().task(":fristilSjekk")?.outcome)
    }

    @Test
    fun `without templates there is nothing to check`() {
        setUp()
        assertEquals(TaskOutcome.NO_SOURCE, gradle("fristilSjekk").build().task(":fristilSjekk")?.outcome)
    }

    @Test
    fun `builds the theme from the recipe`() {
        setUp("themeRecipe = file(\"fristil.tema.json\")")
        file("fristil.tema.json", "{\"aksent\": \"#7c3aed\", \"fare\": \"#b3261e\"}\n")

        gradle("fristilTema").build()
        val theme = File(project, "build/fristil/tema.css").readText()
        assertContains(theme, "--fs-color-accent-fill")

        file("fristil.tema.json", "{\"aksent\": \"lilla\"}\n")
        assertContains(gradle("fristilTema").buildAndFail().output, "heksadesimale")
    }

    @Test
    fun `the theme is skipped without a recipe`() {
        setUp()
        assertEquals(TaskOutcome.SKIPPED, gradle("fristilTema").build().task(":fristilTema")?.outcome)
    }

    @Test
    fun `a taken over component is checked against its fragment, and is in the manifest`() {
        val output = ByteArrayOutputStream()
        val code =
            CommandLine.run(
                listOf("overta", "button", "--ut=src/ui"),
                project,
                ByteArrayInputStream(ByteArray(0)),
                output,
                output,
            )
        assertEquals(0, code, output.toString(Charsets.UTF_8))
        setUp("manifests.from(\"src/ui/button/fristil-manifest.json\")")
        file("maler/side.html", "<button class=\"app-button\" data-variant=\"feil\">Send</button>\n")

        assertContains(gradle("check").buildAndFail().output, "data-variant kan ikke være «feil»")

        file("maler/side.html", "<button class=\"app-button\">Send</button>\n")
        gradle("build", "--configuration-cache").build()
        val manifest = File(project, "build/fristil/manifest.json").readText()
        assertContains(manifest, "\"app-button\"")
        assertContains(manifest, "\"fs-button\"")
        assertFalse(manifest.contains("\$schema"))
        assertTrue(gradle("build", "--configuration-cache").build().output.contains("Reusing configuration cache"))
    }
}

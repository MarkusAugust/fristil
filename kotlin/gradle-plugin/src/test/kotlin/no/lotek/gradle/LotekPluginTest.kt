package no.lotek.gradle

import no.lotek.cli.CommandLine
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
class LotekPluginTest {
    private val project: File = Files.createTempDirectory("lotek-gradle-").toFile()

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
                id("io.github.markusaugust.lo-tek")
            }

            lotek {
                templates.from(fileTree("templates"))
                $extra
            }
            """.trimIndent(),
        )
    }

    @Test
    fun `check fails on a template with a mistake, and says where`() {
        setUp()
        file("templates/form.html", "<form>\n  <button class=\"lt-buton\">Send</button>\n</form>\n")

        val failed = gradle("check").buildAndFail()
        assertContains(failed.output, "templates/form.html:2:18: advarsel: Klassen «lt-buton» finnes ikke i LO-TEK. Mente du lt-button?")
        assertEquals(TaskOutcome.FAILED, failed.task(":lotekSjekk")?.outcome)

        file("templates/form.html", "<form>\n  <button class=\"lt-button\">Send</button>\n</form>\n")
        val passed = gradle("check").build()
        assertEquals(TaskOutcome.SUCCESS, passed.task(":lotekSjekk")?.outcome)
        assertEquals(TaskOutcome.UP_TO_DATE, gradle("check").build().task(":lotekSjekk")?.outcome)
    }

    @Test
    fun `without templates there is nothing to check`() {
        setUp()
        assertEquals(TaskOutcome.NO_SOURCE, gradle("lotekSjekk").build().task(":lotekSjekk")?.outcome)
    }

    @Test
    fun `builds the theme from the recipe`() {
        setUp("themeRecipe = file(\"lotek.theme.json\")")
        file("lotek.theme.json", "{\"aksent\": \"#7c3aed\", \"fare\": \"#b3261e\"}\n")

        gradle("lotekTema").build()
        val theme = File(project, "build/lotek/theme.css").readText()
        assertContains(theme, "--lt-color-accent-fill")

        file("lotek.theme.json", "{\"aksent\": \"lilla\"}\n")
        assertContains(gradle("lotekTema").buildAndFail().output, "heksadesimale")
    }

    @Test
    fun `the theme is skipped without a recipe`() {
        setUp()
        assertEquals(TaskOutcome.SKIPPED, gradle("lotekTema").build().task(":lotekTema")?.outcome)
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
        setUp("manifests.from(\"src/ui/button/lotek-manifest.json\")")
        file("templates/side.html", "<button class=\"app-button\" data-variant=\"feil\">Send</button>\n")

        assertContains(gradle("check").buildAndFail().output, "data-variant kan ikke være «feil»")

        file("templates/side.html", "<button class=\"app-button\">Send</button>\n")
        gradle("build", "--configuration-cache").build()
        val manifest = File(project, "build/lotek/manifest.json").readText()
        assertContains(manifest, "\"app-button\"")
        assertContains(manifest, "\"lt-button\"")
        assertFalse(manifest.contains("\$schema"))
        assertTrue(gradle("build", "--configuration-cache").build().output.contains("Reusing configuration cache"))

        // Uten fragmenter er pakkens manifest det riktige, og fila
        // fra forrige bygg må bort, ellers foretrekker editoren den.
        setUp()
        gradle("build").build()
        assertFalse(File(project, "build/lotek/manifest.json").exists())
    }

    @Test
    fun `without fragments no manifest is written`() {
        setUp()
        file("templates/side.html", "<button class=\"lt-button\">Send</button>\n")
        gradle("build").build()
        assertFalse(File(project, "build/lotek/manifest.json").exists())
    }
}

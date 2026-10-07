package no.fristil

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * At WebJar-en har det en side trenger, og at hver modul i den kan lastes.
 *
 * En nettleser kan ikke slå opp et pakkenavn som `@fristil/designsystem` eller
 * `node:fs`. Importerer én modul noe som ikke ligger i WebJar-en, feiler den
 * først i nettleseren, så det sjekkes her: hver import i hver modul skal peke
 * på en fil som finnes.
 */
class WebJarTest {
    private val root = File(System.getProperty("webjar"))

    @Test
    fun `stilarket og registreringen ligger der konstantene sier`() {
        for (path in listOf(FristilWebJar.CSS, FristilWebJar.REGISTER)) {
            val resource = "META-INF/resources$path"
            val stream = javaClass.classLoader.getResourceAsStream(resource)
            assertNotNull(stream, "$resource finnes ikke på klassestien")
            assertTrue(stream.use { it.readBytes().isNotEmpty() }, "$resource er tom")
        }
        assertTrue(FristilWebJar.ROOT.endsWith("/${FristilWebJar.VERSION}"))
    }

    @Test
    fun `stilarket for hver komponent ligger med samme sti som i npm-pakken`() {
        assertTrue(File(root, "src/components/css/button/button.css").isFile)
        assertTrue(File(root, "src/tokens/tokens.css").isFile)
    }

    @Test
    fun `det som bare er for Node eller React er ikke med`() {
        for (path in listOf("dist/cli.js", "dist/takeover.js", "dist/react.js", "dist/diagnostics")) {
            assertTrue(!File(root, path).exists(), "$path skal ikke være i WebJar-en")
        }
    }

    @Test
    fun `hver import i hver modul peker på en fil i WebJar-en`() {
        val modules = root.walkTopDown().filter { it.extension == "js" }.toList()
        assertTrue(modules.size > 20, "for få moduler: ${modules.size}")
        val missing = mutableListOf<String>()
        for (module in modules) {
            for (specifier in imports(module.readText())) {
                val target = module.parentFile.resolve(specifier).normalize()
                if (!specifier.startsWith(".") || !target.isFile) {
                    missing += "${module.relativeTo(root)} importerer «$specifier»"
                }
            }
        }
        assertEquals(emptyList(), missing)
    }

    private companion object {
        // Bare ekte importer: linjer som begynner med import eller export, ikke
        // eksemplene i kommentarene, som begynner med `*`.
        val STATIC = Regex("""^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']""", RegexOption.MULTILINE)
        val BARE = Regex("""^\s*import\s*["']([^"']+)["']""", RegexOption.MULTILINE)
        val DYNAMIC = Regex("""\bimport\(\s*["']([^"']+)["']\s*\)""")

        fun imports(js: String): List<String> =
            (STATIC.findAll(js) + BARE.findAll(js) + DYNAMIC.findAll(js)).map { it.groupValues[1] }.toList()
    }
}

package no.lotek

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * That the WebJar has what a page needs, and that every module in it can be loaded.
 *
 * A browser cannot resolve a package name like `@lo-tek/interfaces` or
 * `node:fs`. If one module imports something that is not in the WebJar, it
 * fails only in the browser, so it is checked here: every import in every
 * module must point to a file that exists.
 */
class WebJarTest {
    private val root = File(System.getProperty("webjar"))

    @Test
    fun `the stylesheet and the registration are where the constants say`() {
        for (path in listOf(LotekWebJar.CSS, LotekWebJar.REGISTER)) {
            val resource = "META-INF/resources$path"
            val stream = javaClass.classLoader.getResourceAsStream(resource)
            assertNotNull(stream, "$resource is not on the classpath")
            assertTrue(stream.use { it.readBytes().isNotEmpty() }, "$resource is empty")
        }
        assertTrue(LotekWebJar.ROOT.endsWith("/${LotekWebJar.VERSION}"))
    }

    @Test
    fun `the stylesheet for each component has the same path as in the npm package`() {
        assertTrue(File(root, "src/components/css/button/button.css").isFile)
        assertTrue(File(root, "src/tokens/tokens.css").isFile)
    }

    @Test
    fun `what is only for Node or React is left out`() {
        for (path in listOf("dist/cli.js", "dist/takeover.js", "dist/react.js", "dist/diagnostics", "dist/tokens/theme.js")) {
            assertTrue(!File(root, path).exists(), "$path must not be in the WebJar")
        }
    }

    @Test
    fun `every import in every module points to a file in the WebJar`() {
        val modules = root.walkTopDown().filter { it.extension == "js" }.toList()
        assertTrue(modules.size > 20, "too few modules: ${modules.size}")
        val missing = mutableListOf<String>()
        for (module in modules) {
            for (specifier in imports(module.readText())) {
                val target = module.parentFile.resolve(specifier).normalize()
                if (!specifier.startsWith(".") || !target.isFile) {
                    missing += "${module.relativeTo(root)} imports «$specifier»"
                }
            }
        }
        assertEquals(emptyList(), missing)
    }

    private companion object {
        // Only real imports: lines that start with import or export, not the
        // examples in the comments, which start with `*`.
        val STATIC = Regex("""^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']""", RegexOption.MULTILINE)
        val BARE = Regex("""^\s*import\s*["']([^"']+)["']""", RegexOption.MULTILINE)
        val DYNAMIC = Regex("""\bimport\(\s*["']([^"']+)["']\s*\)""")

        fun imports(js: String): List<String> =
            (STATIC.findAll(js) + BARE.findAll(js) + DYNAMIC.findAll(js)).map { it.groupValues[1] }.toList()
    }
}

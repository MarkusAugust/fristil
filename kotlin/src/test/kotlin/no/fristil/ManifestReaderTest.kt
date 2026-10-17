package no.fristil

import java.io.File
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * At `Manifest` leser alt manifestet har, uten å miste noe på veien, og at
 * et manifest den ikke forstår gir en feil som sier hvor.
 */
class ManifestReaderTest {
    private val text = File(System.getProperty("manifest")).readText()

    @Suppress("UNCHECKED_CAST")
    private val raw = Json.parse(text) as Map<String, Any?>

    @Suppress("UNCHECKED_CAST")
    private fun Any?.map() = this as Map<String, Any?>

    /*
     * Testene under sammenligner feltene leseren kjenner. Et nytt felt i
     * skjemaet ville de ikke sett, så hvert rå objekt må ha bare disse.
     */
    private fun known(obj: Any?, vararg keys: String, at: String) {
        val unknown = obj.map().keys - keys.toSet()
        assertTrue(unknown.isEmpty(), "$at har $unknown, som Manifest ikke leser.")
    }

    @Test
    fun `the package manifest is the one in the jar`() {
        // `builders` er med vilje utelatt, se Manifest.
        known(raw, "\$schema", "schemaVersion", "version", "elements", "classes", "builders", "tokens", at = "manifestet")
        assertEquals(Manifest.parse(text), Fristil.manifest)
        assertEquals(raw["version"], Fristil.manifest.version)
    }

    @Test
    fun `every class keeps its fields and attributes, in order`() {
        val classes = raw["classes"].map()
        assertEquals(classes.keys.toList(), Fristil.manifest.classes.keys.toList())
        var attributes = 0
        var parts = 0
        var partOf = 0
        for ((name, c) in classes) {
            val read = Fristil.manifest.classes.getValue(name)
            val expected = c.map()
            known(c, "component", "title", "description", "link", "content", "partOf", "parts", "attributes", at = name)
            assertEquals(name, read.name)
            assertEquals(listOf(expected["component"], expected["title"], expected["description"], expected["link"]), listOf(read.component, read.title, read.description, read.link), name)
            assertEquals(expected["content"], read.content.name.lowercase(), name)
            assertEquals(expected["partOf"], read.partOf, name)
            if (read.partOf != null) partOf += 1
            val rawParts = expected["parts"]?.map() ?: emptyMap()
            assertEquals(rawParts.keys.toList(), read.parts.keys.toList(), name)
            for ((part, p) in rawParts) {
                val r = read.parts.getValue(part)
                val pm = p.map()
                known(p, "selector", "description", "content", "multiple", "optional", at = "$name $part")
                assertEquals(listOf(pm["selector"], pm["description"], pm["content"], pm["multiple"] == true, pm["optional"] == true), listOf(r.selector, r.description, r.content.name.lowercase(), r.multiple, r.optional), "$name $part")
                parts += 1
            }
            val attrs = expected["attributes"].map()
            assertEquals(attrs.keys.toList(), read.attributes.keys.toList(), name)
            for ((attr, a) in attrs) {
                val r = read.attributes.getValue(attr)
                val e = a.map()
                known(a, "values", "default", "flag", "description", at = "$name $attr")
                assertEquals(e["values"] ?: emptyList<String>(), r.values, "$name $attr")
                assertEquals(e["default"], r.default, "$name $attr")
                assertEquals(e["flag"] == true, r.flag, "$name $attr")
                assertEquals(e["description"], r.description, "$name $attr")
                attributes += 1
            }
        }
        assertTrue(attributes > 0, "Ingen klasse hadde attributter, så sammenligningen sa ingenting.")
        assertTrue(parts > 0 && partOf > 0, "Fant $parts deler og $partOf klasser med partOf, så sammenligningen sa ingenting.")
    }

    @Test
    fun `every element keeps its attributes, parts and events`() {
        val elements = raw["elements"].map()
        assertEquals(elements.keys.toList(), Fristil.manifest.elements.keys.toList())
        var parts = 0
        var events = 0
        for ((tag, el) in elements) {
            val read = Fristil.manifest.elements.getValue(tag)
            val e = el.map()
            known(el, "link", "description", "attributes", "parts", "events", at = tag)
            assertEquals(tag, read.tag)
            assertEquals(e["link"], read.link)
            assertEquals(e["description"], read.description)
            for ((name, a) in e["attributes"].map()) {
                known(a, "type", "values", "description", at = "$tag $name")
                val r = read.attributes.getValue(name)
                assertEquals(a.map()["type"], r.type.name.lowercase(), "$tag $name")
                assertEquals(a.map()["values"] ?: emptyList<String>(), r.values, "$tag $name")
                assertEquals(a.map()["description"], r.description, "$tag $name")
            }
            assertEquals(e["attributes"].map().keys.toList(), read.attributes.keys.toList(), tag)
            val rawParts = e["parts"]?.map() ?: emptyMap()
            assertEquals(rawParts.keys.toList(), read.parts.keys.toList(), tag)
            for ((name, p) in rawParts) {
                val r = read.parts.getValue(name)
                val pm = p.map()
                known(p, "selector", "description", "content", "multiple", "optional", at = "$tag $name")
                assertEquals(listOf(pm["selector"], pm["description"], pm["content"], pm["multiple"] == true, pm["optional"] == true), listOf(r.selector, r.description, r.content.name.lowercase(), r.multiple, r.optional), "$tag $name")
                parts += 1
            }
            val rawEvents = e["events"]?.map() ?: emptyMap()
            assertEquals(rawEvents.keys.toList(), read.events.keys.toList(), tag)
            for ((name, ev) in rawEvents) {
                known(ev, "detail", at = "$tag $name")
                assertEquals(ev.map()["detail"] ?: emptyMap<String, String>(), read.events.getValue(name).detail, "$tag $name")
                events += 1
            }
        }
        assertTrue(parts > 0 && events > 0, "Fant $parts deler og $events hendelser, så sammenligningen sa ingenting.")
    }

    @Test
    fun `the tokens keep every scale, axis and component variable`() {
        val tokens = raw["tokens"].map()
        val read = Fristil.manifest.tokens
        known(tokens, "spacing", "breakpoints", "containers", "colors", "components", at = "tokens")
        assertEquals(tokens["spacing"], read.spacing)
        assertEquals(tokens["breakpoints"], read.breakpoints)
        assertEquals(tokens["containers"], read.containers)
        val colors = tokens["colors"].map()
        known(colors, "families", "roles", "layers", "tokens", at = "tokens.colors")
        assertEquals(colors["families"], read.colors.families)
        assertEquals(colors["roles"], read.colors.roles)
        assertEquals(colors["layers"], read.colors.layers)
        assertEquals(colors["tokens"], read.colors.tokens)
        val components = tokens["components"].map()
        assertEquals(components.keys.toList(), read.components.keys.toList())
        var variables = 0
        for ((component, v) in components) {
            assertEquals(v, read.components.getValue(component), component)
            variables += v.map().size
        }
        assertTrue(
            read.spacing.size > 0 && read.breakpoints.size > 0 && read.containers.size > 0 && read.colors.families.size > 0 && read.colors.roles.size > 0 && read.colors.tokens.size > 0 && variables > 0,
            "En av listene var tom, så sammenligningen sa ingenting.",
        )
        assertEquals("768px", read.breakpoints["md"])
        assertEquals("var(--fs-spacing-2) var(--fs-spacing-4)", read.components.getValue("button").getValue("--fs-button-padding"))
        assertTrue("text-subtle" in read.colors.roles && "--fs-color-accent-surface" in read.colors.tokens)
    }

    @Test
    fun `known entries read as expected`() {
        val tabs = Fristil.manifest.elements.getValue("fs-tabs")
        assertEquals(listOf("list", "tab", "panel"), tabs.parts.keys.toList())
        assertTrue(tabs.parts.getValue("tab").multiple)
        assertEquals(PartContent.TEXT, tabs.parts.getValue("tab").content)
        assertEquals(AttributeType.FLAG, tabs.attributes.getValue("server-controlled").type)
        assertEquals(mapOf("index" to "number"), tabs.events.getValue("tab-select").detail)

        val variant = Fristil.manifest.classes.getValue("fs-button").attributes.getValue("data-variant")
        assertContains(variant.values, "secondary")
        assertEquals("primary", variant.default)
        assertTrue(Fristil.manifest.classes.values.any { c -> c.attributes.values.any { it.flag && it.values.isEmpty() } })

        val table = Fristil.manifest.classes.getValue("fs-table")
        assertEquals(PartContent.PARTS, table.content)
        assertEquals(listOf("caption", "head", "body", "sort"), table.parts.keys.toList())
        assertTrue(table.parts.getValue("caption").optional)
        assertEquals("fs-table", Fristil.manifest.classes.getValue("fs-table__sort").partOf)
        assertEquals(PartContent.TEXT, Fristil.manifest.classes.getValue("fs-button").content)
    }

    @Test
    fun `a project manifest is read as well`() {
        val takenOver = Manifest.parse(text.replace("\"fs-card\": {", "\"fs-kort\": {"))
        assertTrue("fs-kort" in takenOver.classes && "fs-card" !in takenOver.classes)
    }

    @Test
    fun `a manifest it cannot read says where`() {
        fun error(json: String) = assertFailsWith<IllegalArgumentException> { Manifest.parse(json) }.message!!

        assertContains(error(text.replace("\"schemaVersion\": 1", "\"schemaVersion\": 2")), "schemaVersion 2,")
        assertContains(
            error(text.replaceFirst("\"link\": \"https://fristil.sobernetics.no/components/tabs/\"", "\"link\": 3")),
            "elements.fs-tabs.link",
        )
        assertContains(error(text.replaceFirst("\"content\": \"text\"", "\"content\": \"tekst\"")), "«tekst»")
        assertContains(error("""{"schemaVersion": 1, "version": "0", "elements": {}, "classes": []}"""), "classes skulle vært et objekt")
        assertContains(error("""{"schemaVersion": 1, "version": "0", "elements": {}, "classes": {}}"""), "tokens skulle vært et objekt")
    }
}

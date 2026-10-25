package no.fristil.build

import groovy.json.JsonSlurper
import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction

/**
 * Skriver Kotlin-API-et fra manifestet.
 *
 * Manifestet (`designsystem/manifest/manifest.json`) er skrevet av pakken fra
 * TypeScript-koden. Herfra kommer de lovlige verdiene som `enum`-er, hver
 * byggefunksjon som har en tabell, og typene for svarene som har flere sett.
 * De få byggefunksjonene der valgene virker sammen, har ingen tabell og står
 * skrevet for hånd i `src/main/kotlin/no/fristil/Handwritten.kt`. Alle testes
 * mot byggetilfellene i `ContractTest`.
 *
 * Filene skrives til `build/generated` ved hvert bygg og sjekkes ikke inn.
 * Manifestet er sjekket inn, og det er der en endring synes.
 */
abstract class GenerateApi : DefaultTask() {
    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val manifest: RegularFileProperty

    @get:OutputDirectory
    abstract val output: DirectoryProperty

    @TaskAction
    fun generate() {
        @Suppress("UNCHECKED_CAST")
        val parsed = JsonSlurper().parse(manifest.get().asFile) as Map<String, Any?>
        val dir = output.get().asFile.resolve("no/fristil")
        dir.deleteRecursively()
        dir.mkdirs()
        for ((name, content) in Generator(parsed).files()) dir.resolve(name).writeText(content)
    }
}

/** Det generatoren gjør, uten Gradle, så det kan leses for seg. */
class Generator(manifest: Map<String, Any?>) {
    private val version = manifest["version"] as String

    @Suppress("UNCHECKED_CAST")
    private val builders = manifest["builders"] as List<Map<String, Any?>>

    /** De lovlige verdiene som brukes flere steder, får ett felles navn. */
    private val shared = mapOf(
        "state" to "FieldState",
        "required" to "RequiredMarker",
        "size" to "Size",
        "variant" to "SurfaceVariant",
    )

    private data class ValueSet(val option: String, val values: List<String>)

    private val uses = mutableMapOf<ValueSet, MutableSet<String>>()

    init {
        for (b in builders) {
            for (o in options(b)) {
                values(o)?.let { uses.getOrPut(ValueSet(o.name, it)) { mutableSetOf() }.add(b["name"] as String) }
            }
            collectReturnValues(b["name"] as String, returns(b))
        }
    }

    private fun collectReturnValues(builder: String, r: Map<String, Any?>) {
        @Suppress("UNCHECKED_CAST")
        when (r["kind"]) {
            "group" -> for ((name, field) in r["fields"] as Map<String, Map<String, Any?>>) {
                if (field["kind"] == "values") {
                    uses.getOrPut(ValueSet(name, field["values"] as List<String>)) { mutableSetOf() }
                        .add("$builder()")
                }
            }
        }
    }

    private fun enumName(set: ValueSet, builder: String): String {
        val users = uses[set].orEmpty()
        return if (users.size > 1) {
            shared[set.option] ?: pascal(set.option)
        } else {
            pascal(builder) + pascal(set.option)
        }
    }

    private data class Option(val name: String, val kind: String, val required: Boolean, val raw: Map<String, Any?>)

    @Suppress("UNCHECKED_CAST")
    private fun options(b: Map<String, Any?>): List<Option> =
        (b["options"] as List<Map<String, Any?>>).map {
            val type = it["type"] as Map<String, Any?>
            Option(it["name"] as String, type["kind"] as String, it["required"] as Boolean, type)
        }

    @Suppress("UNCHECKED_CAST")
    private fun values(o: Option): List<String>? =
        if (o.kind == "values") o.raw["values"] as List<String> else null

    @Suppress("UNCHECKED_CAST")
    private fun returns(b: Map<String, Any?>) = b["returns"] as Map<String, Any?>

    fun files(): Map<String, String> = mapOf(
        "Values.kt" to valuesFile(),
        "Fs.kt" to fsFile(),
        "Parts.kt" to partsFile(),
        "Dispatch.kt" to dispatchFile(),
        "WebJar.kt" to webJarFile(),
    )

    private fun webJarFile(): String =
        header +
            """
            |package no.fristil
            |
            |/**
            | * Stiene til CSS-en og JavaScript-en i WebJar-en som følger pakken.
            | *
            | * Filene ligger under `META-INF/resources/webjars/fristil/$version/`, med de
            | * samme stiene som i npm-pakken. Spring Boot og Servlet-containere serverer
            | * dem som de er. I Ktor: `staticResources("/webjars", "META-INF/resources/webjars")`.
            | *
            | * ```kotlin
            | * ""${'"'}
            | * <link rel="stylesheet" href="${'$'}{FristilWebJar.CSS}">
            | * <script type="module">
            | *   import { defineFs } from "${'$'}{FristilWebJar.REGISTER}"
            | *   defineFs()
            | * </script>
            | * ""${'"'}
            | * ```
            | */
            |object FristilWebJar {
            |    /** Versjonen av Fristil, den samme som npm-pakken. */
            |    const val VERSION = "$version"
            |
            |    /** Mappa filene serveres fra. En fil i npm-pakken, som `dist/fristil.css`, ligger under den med samme sti. */
            |    const val ROOT = "/webjars/fristil/${'$'}VERSION"
            |
            |    /** Alle stilarkene i én fil. */
            |    const val CSS = "${'$'}ROOT/dist/fristil.css"
            |
            |    /** Modulen som registrerer alle web-komponentene med `defineFs()`. */
            |    const val REGISTER = "${'$'}ROOT/dist/register.js"
            |}
            |""".trimMargin()

    private val header = "// Generert fra manifestet til @fristil/designsystem $version. Ikke rediger.\n"

    private fun valuesFile(): String {
        val written = mutableMapOf<String, ValueSet>()
        val out = StringBuilder(header).append("package no.fristil\n")
        for ((set, users) in uses.entries.sortedBy { enumName(it.key, it.value.first()) }) {
            val name = enumName(set, users.first())
            // To ulike sett med samme navn ville gitt én av dem feil type.
            written.put(name, set)?.let { error("$name brukes for både ${it.values} og ${set.values}. Gi dem hvert sitt navn i Generator.shared.") }
            val where = users.sorted().joinToString(", ") { "`fs.$it`" }
            out.append("\n/** De lovlige verdiene for `${set.option}` i $where. */\n")
            out.append("enum class $name(val value: String) {\n")
            for (v in set.values) out.append("    ${constant(v)}(\"$v\"),\n")
            out.append("    ;\n\n")
            out.append("    override fun toString(): String = value\n\n")
            out.append("    companion object {\n")
            out.append("        /** Verdien med denne teksten, eller `null` når teksten ikke er en lovlig verdi. */\n")
            out.append("        fun of(value: String): $name? = entries.firstOrNull { it.value == value }\n")
            out.append("    }\n}\n")
        }
        return out.toString()
    }

    private fun kotlinType(b: Map<String, Any?>, o: Option): String {
        val base = when (o.kind) {
            "values" -> enumName(ValueSet(o.name, values(o)!!), b["name"] as String)
            "flag" -> "Boolean"
            "text" -> "String"
            "number" -> "Number"
            "textList" -> "List<String>"
            else -> error("Ukjent valgtype ${o.kind} i ${b["name"]}")
        }
        return if (o.required) base else "$base? = null"
    }

    private fun signature(b: Map<String, Any?>): String =
        options(b).joinToString(",\n") { "        ${identifier(it.name)}: ${kotlinType(b, it)}" }

    private fun returnType(b: Map<String, Any?>): String =
        if (returns(b)["kind"] == "group") pascal(b["name"] as String) + "Parts" else "Attributes"

    private fun fsFile(): String {
        val out = StringBuilder(header).append("package no.fristil\n\n")
        out.append("/**\n * Byggefunksjonene, med de samme navnene og valgene som `fs` i TypeScript.\n *\n")
        out.append(" * Hver returnerer attributtene du legger på elementet. Byggefunksjonene\n")
        out.append(" * der valgene virker sammen, står i `Handwritten.kt`.\n */\n")
        out.append("object Fs {\n")
        for (b in builders) {
            @Suppress("UNCHECKED_CAST")
            val table = b["table"] as Map<String, Any?>? ?: continue
            val name = b["name"] as String
            out.append("    /** `fs.$name` */\n")
            val parameters = if (options(b).isEmpty()) "" else "\n${signature(b)},\n    "
            out.append("    fun ${identifier(name)}($parameters): ${returnType(b)} {\n")
            @Suppress("UNCHECKED_CAST")
            if (table["kind"] == "attributes") {
                out.append(tableBody(b, table["table"] as Map<String, Any?>, "a", "        "))
                out.append("        return Attributes(a)\n")
            } else {
                val fields = table["fields"] as Map<String, Map<String, Any?>>
                for ((field, t) in fields) out.append(tableBody(b, t, "${field}Map", "        "))
                out.append("        return ${returnType(b)}(\n")
                for (field in fields.keys) out.append("            ${identifier(field)} = Attributes(${field}Map),\n")
                out.append("        )\n")
            }
            out.append("    }\n\n")
        }
        out.setLength(out.length - 1)
        out.append("}\n")
        return out.toString()
    }

    /** Uttrykket for en verdi i tabellen: tekst, eller verdien av et valg. */
    private fun valueExpression(b: Map<String, Any?>, value: String): String {
        val placeholder = Regex("^\\{(\\w+)}$").find(value)?.groupValues?.get(1)
        val option = placeholder?.let { p -> options(b).firstOrNull { it.name == p } }
        return when (option?.kind) {
            "text" -> identifier(option.name)
            "number" -> "jsNumber(${identifier(option.name)})"
            "values" -> "${identifier(option.name)}.value"
            else -> literal(value)
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun statements(b: Map<String, Any?>, map: String, attrs: Map<String, Any?>, indent: String): String =
        attrs.entries.joinToString("") { (k, v) ->
            if (v == null) "$indent$map.remove(${literal(k)})\n"
            else "$indent$map[${literal(k)}] = ${valueExpression(b, v as String)}\n"
        }

    @Suppress("UNCHECKED_CAST")
    private fun tableBody(b: Map<String, Any?>, table: Map<String, Any?>, map: String, indent: String): String {
        val out = StringBuilder()
        val base = table["base"] as Map<String, Any?>
        out.append("${indent}val $map = linkedMapOf<String, String>()\n")
        out.append(statements(b, map, base, indent))
        val tableOptions = table["options"] as Map<String, Map<String, Any?>>
        for (o in options(b)) {
            val t = tableOptions[o.name] ?: continue
            val cases = t["cases"] as Map<String, Map<String, Any?>>
            val id = identifier(o.name)
            when (o.kind) {
                "values" -> {
                    val enum = enumName(ValueSet(o.name, values(o)!!), b["name"] as String)
                    val nonEmpty = cases.filterValues { it.isNotEmpty() }
                    if (nonEmpty.isEmpty()) continue
                    out.append("${indent}when ($id) {\n")
                    for ((value, attrs) in nonEmpty) {
                        out.append("$indent    $enum.${constant(value)} -> {\n")
                        out.append(statements(b, map, attrs, "$indent        "))
                        out.append("$indent    }\n")
                    }
                    out.append("$indent    else -> {}\n$indent}\n")
                }
                "flag" -> for ((value, attrs) in cases) {
                    if (attrs.isEmpty()) continue
                    out.append("${indent}if ($id == $value) {\n")
                    out.append(statements(b, map, attrs, "$indent    "))
                    out.append("$indent}\n")
                }
                "text", "number" -> {
                    val template = t["template"] as Map<String, Any?>? ?: emptyMap()
                    val empty = t["empty"] as Map<String, Any?>?
                    out.append("${indent}if ($id != null) {\n")
                    if (empty != null && o.kind == "text") {
                        out.append("$indent    if ($id.isEmpty()) {\n")
                        out.append(statements(b, map, empty, "$indent        "))
                        out.append("$indent    } else {\n")
                        out.append(statements(b, map, template, "$indent        "))
                        out.append("$indent    }\n")
                    } else {
                        out.append(statements(b, map, template, "$indent    "))
                    }
                    out.append("$indent}\n")
                }
            }
        }
        return out.toString()
    }

    private fun partsFile(): String {
        val out = StringBuilder(header).append("package no.fristil\n")
        for (b in builders) {
            val r = returns(b)
            if (r["kind"] != "group") continue
            val name = returnType(b)
            @Suppress("UNCHECKED_CAST")
            val fields = r["fields"] as Map<String, Map<String, Any?>>
            out.append("\n/** Settene `fs.${b["name"]}` svarer med. */\n")
            out.append("data class $name(\n")
            for ((field, f) in fields) out.append("    val ${identifier(field)}: ${fieldType(b, field, f)},\n")
            out.append(") {\n")
            out.append("    /** Svaret som verdier, i samme form som TypeScript gir det. */\n")
            out.append("    fun toMap(): Map<String, Any> = buildMap {\n")
            for ((field, f) in fields) {
                val id = identifier(field)
                val value = when (f["kind"]) {
                    "values" -> "$id.value"
                    else -> id
                }
                if (f["optional"] == true) out.append("        if ($id != null) put(${literal(field)}, $value)\n")
                else out.append("        put(${literal(field)}, $value)\n")
            }
            out.append("    }\n}\n")
        }
        return out.toString()
    }

    @Suppress("UNCHECKED_CAST")
    private fun fieldType(b: Map<String, Any?>, field: String, f: Map<String, Any?>): String {
        val base = when (f["kind"]) {
            "attributes" -> "Attributes"
            "list" -> "List<Attributes>"
            "values" -> enumName(ValueSet(field, f["values"] as List<String>), "${b["name"]}()")
            "text" -> "String"
            else -> error("Ukjent svarform ${f["kind"]} i ${b["name"]}.$field")
        }
        return if (f["optional"] == true) "$base?" else base
    }

    private fun dispatchFile(): String {
        val out = StringBuilder(header).append("package no.fristil\n\n")
        out.append("/**\n * Kaller en byggefunksjon med valg lest fra JSON. Brukes av testene som\n")
        out.append(" * sammenligner hvert byggetilfelle med svaret fra TypeScript.\n */\n")
        out.append("internal object Dispatch {\n")
        out.append("    val names: List<String> = listOf(${builders.joinToString(", ") { literal(it["name"] as String) }})\n\n")
        out.append("    fun call(name: String, o: Map<String, Any?>): Any = when (name) {\n")
        for (b in builders) {
            val name = b["name"] as String
            out.append("        ${literal(name)} -> Fs.${identifier(name)}(\n")
            for (opt in options(b)) {
                val key = literal(opt.name)
                val read = when (opt.kind) {
                    "values" -> "(o[$key] as String?)?.let { ${enumName(ValueSet(opt.name, values(opt)!!), name)}.of(it)!! }"
                    "flag" -> "o[$key] as Boolean?"
                    "text" -> "o[$key] as String?"
                    "number" -> "o[$key] as Number?"
                    "textList" -> "(o[$key] as List<*>?)?.map { it as String }"
                    else -> error("Ukjent valgtype ${opt.kind}")
                }
                val value = if (opt.required) "($read)!!" else read
                out.append("            ${identifier(opt.name)} = $value,\n")
            }
            val result = if (returnType(b) == "Attributes") "" else ".toMap()"
            out.append("        )$result\n")
        }
        out.append("        else -> error(\"Ingen byggefunksjon heter \$name.\")\n")
        out.append("    }\n}\n")
        return out.toString()
    }

    companion object {
        private val KEYWORDS = setOf("switch", "object", "in", "is", "as", "fun", "val", "var", "when", "class")

        fun pascal(s: String): String =
            s.split('-', '_').joinToString("") { part -> part.replaceFirstChar { it.uppercase() } }

        fun constant(v: String): String = v.uppercase().replace('-', '_')

        /** `switch` er et vanlig navn i TypeScript og et nøkkelord i ingen av språkene, men andre kan være det. */
        fun identifier(s: String): String = if (s in KEYWORDS) "`$s`" else s

        fun literal(s: String): String =
            "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("$", "\\$") + "\""
    }
}

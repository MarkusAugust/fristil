package no.fristil

/**
 * Ordforrådet i `manifest.json`: elementene og klassene Fristil har, slik
 * `manifest.schema.json` beskriver dem. Det samme manifestet kjernen sjekker
 * mot, så et verktøy som viser fullføring eller dokumentasjon fra det, er
 * aldri ute av takt med diagnostikken.
 *
 * Klassene har innholdet og delene sine, så et verktøy kan sette sammen
 * markupen av dem, og [Manifest.tokens] har avstandene, brekkpunktene,
 * containerbreddene, fargeaksene og komponentvariablene det kan style med.
 * [Fristil.manifest] er manifestet i pakken. [parse] leser et annet, som det
 * `fristil manifest` og Gradle-oppgaven `fristilManifest` skriver for et
 * prosjekt som har overtatt komponenter. Byggefunksjonene står i [builders]
 * med valgene og formen på svaret, så et verktøy kan lage et panel av dem.
 * Tabellen generatoren bak `Fs` bruker, er utelatt: den er for generatoren.
 *
 * Kartene har nøklene i den rekkefølgen manifestet har dem.
 */
data class Manifest(
    /** Versjonen av `@fristil/designsystem` manifestet er skrevet fra. */
    val version: String,
    /** Hvert `<fs-…>`-element, etter taggen. */
    val elements: Map<String, ManifestElement>,
    /** Hver `fs-`-klasse, etter navnet. */
    val classes: Map<String, ManifestClass>,
    /** Tokenene: avstandsskalaen, brekkpunktene, containerbreddene, fargeaksene og komponentvariablene. */
    val tokens: ManifestTokens,
    /** Hver byggefunksjon i `fs`, i manifestets rekkefølge, med valgene og formen på svaret. */
    val builders: List<Builder>,
) {
    companion object {
        /** Skjemaversjonen denne leseren forstår. */
        const val SCHEMA_VERSION = 1

        /**
         * Leser [json], teksten i et `manifest.json`. Et manifest med en annen
         * skjemaversjon, eller som ikke har formen skjemaet krever, kaster
         * [IllegalArgumentException] med stien til det som er galt.
         */
        fun parse(json: String): Manifest {
            val root = Json.parse(json).obj("manifestet")
            val schema = root["schemaVersion"].num("schemaVersion")
            require(schema == SCHEMA_VERSION.toDouble()) {
                val shown = if (schema % 1.0 == 0.0) schema.toLong().toString() else schema.toString()
                "Manifestet har schemaVersion $shown, og denne utgaven av Fristil leser bare $SCHEMA_VERSION."
            }
            return Manifest(
                version = root["version"].str("version"),
                elements = root["elements"].obj("elements").mapValues { (tag, e) -> element(tag, e.obj("elements.$tag"), "elements.$tag") },
                classes = root["classes"].obj("classes").mapValues { (name, c) -> klass(name, c.obj("classes.$name"), "classes.$name") },
                tokens = tokens(root["tokens"].obj("tokens"), "tokens"),
                builders =
                    (root["builders"] as? List<*> ?: wrong("builders", "en liste")).mapIndexed { i, b ->
                        builder(b.obj("builders[$i]"), "builders[$i]")
                    },
            )
        }

        private fun builder(b: Map<String, Any?>, at: String) =
            Builder(
                name = b["name"].str("$at.name"),
                options =
                    (b["options"] as? List<*> ?: wrong("$at.options", "en liste")).mapIndexed { i, o ->
                        val path = "$at.options[$i]"
                        val option = o.obj(path)
                        BuilderOption(
                            name = option["name"].str("$path.name"),
                            required = option["required"] as? Boolean ?: wrong("$path.required", "sant eller usant"),
                            type = optionType(option["type"].obj("$path.type"), "$path.type"),
                            description = option["description"]?.str("$path.description"),
                        )
                    },
                returns = returns(b["returns"].obj("$at.returns"), "$at.returns"),
            )

        private fun optionType(t: Map<String, Any?>, at: String): OptionType =
            when (val kind = t["kind"].str("$at.kind")) {
                "values" -> OptionType.Values(t["values"].strings("$at.values"))
                "flag" -> OptionType.Flag
                "text" -> OptionType.Text
                "number" -> OptionType.Number
                "textList" -> OptionType.TextList
                else -> wrong("$at.kind", "en av «values», «flag», «text», «number», «textList», ikke «$kind»")
            }

        private fun returns(r: Map<String, Any?>, at: String): Returns {
            val optional = r["optional"] == true
            return when (val kind = r["kind"].str("$at.kind")) {
                "attributes" -> Returns.Attributes(optional)
                "text" -> Returns.Text(optional)
                "values" -> Returns.Values(r["values"].strings("$at.values"), optional)
                "list" -> Returns.ListOf(returns(r["of"].obj("$at.of"), "$at.of"), optional)
                "group" -> Returns.Group(r["fields"].obj("$at.fields").mapValues { (field, f) -> returns(f.obj("$at.fields.$field"), "$at.fields.$field") }, optional)
                else -> wrong("$at.kind", "en av «attributes», «text», «values», «list», «group», ikke «$kind»")
            }
        }

        private fun Any?.texts(at: String): Map<String, String> = obj(at).mapValues { (key, v) -> v.str("$at.$key") }

        private fun tokens(t: Map<String, Any?>, at: String): ManifestTokens {
            val colors = t["colors"].obj("$at.colors")
            return ManifestTokens(
                spacing = t["spacing"].texts("$at.spacing"),
                breakpoints = t["breakpoints"].texts("$at.breakpoints"),
                containers = t["containers"].texts("$at.containers"),
                colors =
                    ManifestColors(
                        families = colors["families"].texts("$at.colors.families"),
                        roles = colors["roles"].texts("$at.colors.roles"),
                        layers = colors["layers"].texts("$at.colors.layers"),
                        tokens = colors["tokens"].strings("$at.colors.tokens"),
                    ),
                components = t["components"].obj("$at.components").mapValues { (component, v) -> v.texts("$at.components.$component") },
            )
        }

        private fun element(tag: String, e: Map<String, Any?>, at: String) =
            ManifestElement(
                tag = tag,
                link = e["link"].str("$at.link"),
                description = e["description"]?.str("$at.description"),
                attributes =
                    e["attributes"].obj("$at.attributes").mapValues { (name, a) ->
                        val path = "$at.attributes.$name"
                        val attribute = a.obj(path)
                        val type = attribute["type"].str("$path.type")
                        ElementAttribute(
                            type = enumOf<AttributeType>(type, "$path.type"),
                            values = if (type == "values") attribute["values"].strings("$path.values") else emptyList(),
                            description = attribute["description"]?.str("$path.description"),
                        )
                    },
                parts = parts(e["parts"], "$at.parts"),
                events =
                    (e["events"]?.obj("$at.events") ?: emptyMap()).mapValues { (name, ev) ->
                        val path = "$at.events.$name"
                        ElementEvent(
                            detail = (ev.obj(path)["detail"]?.obj("$path.detail") ?: emptyMap()).mapValues { (field, t) -> t.str("$path.detail.$field") },
                        )
                    },
            )

        private fun parts(value: Any?, at: String): Map<String, Part> =
            (value?.obj(at) ?: emptyMap()).mapValues { (name, p) ->
                val path = "$at.$name"
                val part = p.obj(path)
                Part(
                    selector = part["selector"].str("$path.selector"),
                    description = part["description"].str("$path.description"),
                    content = enumOf<PartContent>(part["content"].str("$path.content"), "$path.content"),
                    multiple = part["multiple"] == true,
                    unique = part["unique"] == true,
                    optional = part["optional"] == true,
                )
            }

        private fun klass(name: String, c: Map<String, Any?>, at: String) =
            ManifestClass(
                name = name,
                component = c["component"].str("$at.component"),
                title = c["title"].str("$at.title"),
                description = c["description"].str("$at.description"),
                link = c["link"].str("$at.link"),
                content = enumOf<PartContent>(c["content"].str("$at.content"), "$at.content"),
                partOf = c["partOf"]?.str("$at.partOf"),
                parts = parts(c["parts"], "$at.parts"),
                attributes =
                    c["attributes"].obj("$at.attributes").mapValues { (attr, a) ->
                        val path = "$at.attributes.$attr"
                        val attribute = a.obj(path)
                        val flag = attribute["flag"] == true
                        ClassAttribute(
                            values = if (flag) emptyList() else attribute["values"].strings("$path.values"),
                            default = attribute["default"]?.str("$path.default"),
                            flag = flag,
                            description = attribute["description"]?.str("$path.description"),
                        )
                    },
            )

        @Suppress("UNCHECKED_CAST")
        private fun Any?.obj(at: String): Map<String, Any?> = this as? Map<String, Any?> ?: wrong(at, "et objekt")

        private fun Any?.str(at: String): String = this as? String ?: wrong(at, "en tekst")

        private fun Any?.num(at: String): Double = this as? Double ?: wrong(at, "et tall")

        private fun Any?.strings(at: String): List<String> =
            (this as? List<*> ?: wrong(at, "en liste")).mapIndexed { i, v -> v.str("$at[$i]") }

        private inline fun <reified E : Enum<E>> enumOf(value: String, at: String): E =
            enumValues<E>().firstOrNull { it.json == value }
                ?: wrong(at, "en av ${enumValues<E>().joinToString { "«${it.json}»" }}, ikke «$value»")

        private val Enum<*>.json get() = name.lowercase()

        private fun wrong(at: String, expected: String): Nothing =
            throw IllegalArgumentException("Manifestet kan ikke leses: $at skulle vært $expected.")
    }
}

/** Et `<fs-…>`-element, med attributtene komponenten leser og delene den finner. */
data class ManifestElement(
    val tag: String,
    /** Adressen til komponentsiden. */
    val link: String,
    /** Hva elementet gjør, i én eller to setninger. */
    val description: String?,
    val attributes: Map<String, ElementAttribute>,
    /** Delene i markupen, med selektoren komponenten leter med. Tom når elementet lager sine egne noder. */
    val parts: Map<String, Part>,
    /** Hendelsene elementet sender. Alle bobler. */
    val events: Map<String, ElementEvent>,
)

/** Et attributt på et element, som `server-controlled`. [values] er tom utenom for [AttributeType.VALUES]. */
data class ElementAttribute(
    val type: AttributeType,
    val values: List<String>,
    val description: String?,
)

enum class AttributeType { FLAG, TEXT, NUMBER, VALUES }

/**
 * En del av et element, som kontrollen i `<fs-field>`. [selector] er den
 * komponenten finner delen med, relativt til elementet. Uten [multiple]
 * gjelder den første, og med [unique] er en del til av samme slag en feil,
 * ikke vanlig innhold. Uten [optional] trenger elementet delen.
 */
data class Part(
    val selector: String,
    val description: String,
    val content: PartContent,
    val multiple: Boolean,
    val unique: Boolean,
    val optional: Boolean,
)

/**
 * Hva en del tar: [TEXT] er tekst og frasering uten interaktive elementer,
 * [FREE] fritt innhold, [PARTS] bare de andre delene, og [NONE] ingen tekst,
 * som en kontroll eller et element komponenten fyller.
 */
enum class PartContent { TEXT, FREE, PARTS, NONE }

/** En hendelse et element sender. [detail] er feltene i `event.detail` med typen sin: `boolean`, `string` eller `number`. */
data class ElementEvent(
    val detail: Map<String, String>,
)

/** En byggefunksjon i `fs`, som `button`, med valgene den tar og formen på det den gir. */
data class Builder(
    val name: String,
    /** Valgene i manifestets rekkefølge. */
    val options: List<BuilderOption>,
    val returns: Returns,
)

/** Ett valg, som `variant` i `fs.button()`. [description] er første avsnitt av kommentaren på valget i typen. */
data class BuilderOption(
    val name: String,
    val required: Boolean,
    val type: OptionType,
    val description: String?,
)

/** Hva et valg tar: en lukket liste, et flagg, tekst, et tall eller en liste med tekst. */
sealed interface OptionType {
    data class Values(val values: List<String>) : OptionType

    data object Flag : OptionType

    data object Text : OptionType

    data object Number : OptionType

    data object TextList : OptionType
}

/**
 * Formen på det en byggefunksjon gir: et attributtsett, en tekst, en av noen
 * verdier, en liste av en form, eller en gruppe av navngitte former, som
 * `dialog` med `host`, `dialog` og `title`. [optional] gjelder et felt i en
 * gruppe som kan mangle.
 */
sealed interface Returns {
    val optional: Boolean

    data class Attributes(override val optional: Boolean = false) : Returns

    data class Text(override val optional: Boolean = false) : Returns

    data class Values(val values: List<String>, override val optional: Boolean = false) : Returns

    data class ListOf(val of: Returns, override val optional: Boolean = false) : Returns

    data class Group(val fields: Map<String, Returns>, override val optional: Boolean = false) : Returns
}

/**
 * Tokenene: det et stilark utenfor pakken kan bygge på. Fargene står som akser
 * med hva de er til, ikke som verdier, siden et tema kan ha andre verdier enn
 * Fristils egne.
 */
data class ManifestTokens(
    /** Avstandsskalaen, navn til verdi, som `--fs-spacing-4` til `1rem`. */
    val spacing: Map<String, String>,
    /** Brekkpunktene, navn til bredde, som `md` til `768px`. */
    val breakpoints: Map<String, String>,
    /** Containerbreddene, navn til bredde, som `aside` til `384px`. */
    val containers: Map<String, String>,
    val colors: ManifestColors,
    /** Komponentvariablene per komponent, som `--fs-button-padding` under `button`, med standardverdien. */
    val components: Map<String, Map<String, String>>,
)

/** Fargeaksene. Et fargetoken heter `--fs-color-<familie>-<rolle>`. */
data class ManifestColors(
    /** Familiene, med hva hver er til. */
    val families: Map<String, String>,
    /** Rollene slik de skrives i CSS, med hva hver er til. */
    val roles: Map<String, String>,
    /** Lagene bare den nøytrale familien har, som `canvas`. */
    val layers: Map<String, String>,
    /** Hvert `--fs-color-*`-navn pakken sender ut. */
    val tokens: List<String>,
)

/**
 * En klasse i manifestet, som `fs-button`, med komponenten den hører til,
 * hva elementet med klassen tar som innhold, og delene markupen består av.
 */
data class ManifestClass(
    val name: String,
    /** Adressen til komponentsiden, relativt, som `button`. */
    val component: String,
    val title: String,
    val description: String,
    val link: String,
    /** Hva elementet med klassen tar som innhold, med samme ord som delene. */
    val content: PartContent,
    /** Klassen denne er en del av, som `fs-card` for `fs-card__title`. Forelderen har en del som treffer den. */
    val partOf: String?,
    /** Delene markupen består av, med selektoren relativt til elementet med klassen. Tom for klassene uten en fast struktur. */
    val parts: Map<String, Part>,
    val attributes: Map<String, ClassAttribute>,
)

/**
 * Et attributt en klasse tar, som `data-variant` på `fs-button`. Et [flag]
 * virker ved å stå der, og har ingen [values]. [default] er verdien
 * fraværet betyr.
 */
data class ClassAttribute(
    val values: List<String>,
    val default: String?,
    val flag: Boolean,
    val description: String?,
)

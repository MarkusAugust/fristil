package no.fristil

/**
 * Attributtene fra en byggefunksjon, i samme rekkefølge som TypeScript gir dem.
 *
 * Et boolsk attributt som er på, som `disabled` eller `hidden`, har den tomme
 * strengen som verdi, slik HTML skriver det. Et attributt som er av, står
 * ikke i settet i det hele tatt.
 *
 * Settet er et vanlig `Map<String, String>`, så det kan legges rett inn der
 * malen tar imot attributter, for eksempel `attributes.putAll(...)` i
 * kotlinx.html, uten at biblioteket avhenger av noen mal.
 */
class Attributes internal constructor(
    private val entriesByName: Map<String, String>,
) : Map<String, String> by entriesByName {
    /**
     * Skriver settet som HTML-attributter, med et mellomrom foran hvert.
     * Verdiene escapes. Et boolsk attributt skrives uten verdi.
     */
    fun toHtml(): String =
        buildString {
            for ((name, value) in entriesByName) {
                append(' ').append(name)
                if (value.isNotEmpty()) append("=\"").append(escape(value)).append('"')
            }
        }

    /**
     * Legger et sett oppå et annet. Står det samme navnet i begge, vinner
     * settet til høyre, som når to objekter spres etter hverandre i JSX.
     */
    operator fun plus(other: Attributes): Attributes = Attributes(LinkedHashMap(entriesByName).apply { putAll(other) })

    override fun toString(): String = entriesByName.toString()

    override fun equals(other: Any?): Boolean = entriesByName == other

    override fun hashCode(): Int = entriesByName.hashCode()
}

/** Verdien et boolsk attributt har når det er på. */
internal const val ON = ""

internal fun attributes(vararg pairs: Pair<String, String?>): Attributes {
    val values = LinkedHashMap<String, String>()
    for ((name, value) in pairs) {
        if (value != null) values[name] = value
    }
    return Attributes(values)
}

private fun escape(value: String): String =
    buildString {
        for (c in value) {
            when (c) {
                '&' -> append("&amp;")
                '<' -> append("&lt;")
                '>' -> append("&gt;")
                '"' -> append("&quot;")
                '\'' -> append("&#39;")
                else -> append(c)
            }
        }
    }

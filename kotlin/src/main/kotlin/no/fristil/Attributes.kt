package no.fristil

/**
 * Attributtene en byggefunksjon gir: navn og verdi, i rekkefølgen de ble satt.
 *
 * Et flagg som `hidden` eller `disabled` har den tomme teksten som verdi, slik
 * HTML skriver det. Settet er et vanlig `Map`, så det kan gis til hvilken som
 * helst malmotor. Uten malmotor skriver [toHtml] det ut.
 *
 * ```kotlin
 * val knapp = Fs.button(variant = ButtonVariant.SECONDARY)
 * "<button ${knapp.toHtml()}>Lagre utkast</button>"
 * ```
 */
class Attributes(values: Map<String, String> = emptyMap()) : Map<String, String> by LinkedHashMap(values) {
    /** Settet med attributtene fra [other] i tillegg. De fra [other] vinner. */
    operator fun plus(other: Map<String, String>): Attributes = Attributes(LinkedHashMap(this).apply { putAll(other) })

    /**
     * Attributtene som HTML, med verdiene escapet: `class="fs-button" hidden`.
     * Den tomme teksten skrives som navnet alene, som i HTML betyr det samme.
     */
    fun toHtml(): String =
        entries.joinToString(" ") { (name, value) ->
            if (value.isEmpty()) name else "$name=\"${escape(value)}\""
        }

    override fun equals(other: Any?): Boolean = other is Map<*, *> && entries == other.entries

    override fun hashCode(): Int = entries.hashCode()

    override fun toString(): String = toHtml()

    private companion object {
        fun escape(value: String): String =
            buildString(value.length) {
                for (c in value) {
                    when (c) {
                        '&' -> append("&amp;")
                        '"' -> append("&quot;")
                        '<' -> append("&lt;")
                        '>' -> append("&gt;")
                        else -> append(c)
                    }
                }
            }
    }
}

/**
 * Et tall skrevet slik JavaScript skriver det, så attributtene blir de samme
 * som fra TypeScript: `3`, ikke `3.0`.
 */
internal fun jsNumber(n: Number): String {
    val d = n.toDouble()
    return when {
        d.isNaN() -> "NaN"
        d.isInfinite() -> if (d > 0) "Infinity" else "-Infinity"
        d == 0.0 -> "0"
        d == Math.rint(d) && Math.abs(d) < 1e21 -> java.math.BigDecimal(d).toPlainString()
        else -> java.math.BigDecimal(d.toString()).stripTrailingZeros().toPlainString()
    }
}

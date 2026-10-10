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
 * som fra TypeScript: `3`, ikke `3.0`, `1e+21`, ikke `1.0E21`, og `0.1`, ikke
 * `0.1000000000000000055511151231257827`.
 *
 * Sifrene er de færreste som gir tilbake det samme tallet, som i JavaScript
 * (ECMA-262, `Number::toString`). Er det flere med like mange sifre, vinner
 * det som ligger nærmest, og ved likt det med et partall sist. Begge naboene
 * med `p` sifre prøves, ikke bare den nærmeste: under en toerpotens er
 * avstanden til tallet under halvparten av den over, så den nærmeste kan
 * bomme der den over treffer. `2^-24` er `5.960464477539063e-8`, ikke
 * `5.9604644775390625e-8`. Formen følger de samme reglene: vanlig
 * skrivemåte fra 1e-6 og opp til 1e21, og ellers eksponent med fortegn.
 */
internal fun jsNumber(n: Number): String {
    val d = n.toDouble()
    if (d.isNaN()) return "NaN"
    if (d.isInfinite()) return if (d > 0) "Infinity" else "-Infinity"
    // `-0` skrives `0` i JavaScript.
    if (d == 0.0) return "0"
    val exact = java.math.BigDecimal(Math.abs(d))
    val modes = listOf(java.math.RoundingMode.FLOOR, java.math.RoundingMode.CEILING)
    val shortest =
        (1..17).asSequence()
            .map { p ->
                modes
                    .map { exact.round(java.math.MathContext(p, it)).stripTrailingZeros() }
                    .filter { it.toDouble() == Math.abs(d) }
                    .minWithOrNull(
                        compareBy<java.math.BigDecimal> { it.subtract(exact).abs() }
                            .thenBy { it.unscaledValue().testBit(0) },
                    )
            }
            .first { it != null }!!
    val digits = shortest.unscaledValue().toString()
    val k = digits.length
    // Tallet er 0,`digits` ganger 10 opphøyd i `point`.
    val point = k - shortest.scale()
    val text =
        when {
            point in k..21 -> digits + "0".repeat(point - k)
            point in 1..21 -> digits.substring(0, point) + "." + digits.substring(point)
            point in -5..0 -> "0." + "0".repeat(-point) + digits
            else -> {
                val exponent = point - 1
                val sign = if (exponent >= 0) "+" else "-"
                val mantissa = if (k == 1) digits else digits[0] + "." + digits.substring(1)
                "${mantissa}e$sign${Math.abs(exponent)}"
            }
        }
    return if (d < 0) "-$text" else text
}

package no.lotek

/**
 * The attributes a builder function returns: name and value, in the order they were set.
 *
 * A flag like `hidden` or `disabled` has the empty text as its value, the way
 * HTML writes it. The set is an ordinary `Map`, so it can be passed to any
 * template engine. Without a template engine, [toHtml] writes it out.
 *
 * ```kotlin
 * val button = Lt.button(variant = ButtonVariant.SECONDARY)
 * "<button ${button.toHtml()}>Save draft</button>"
 * ```
 */
class Attributes(values: Map<String, String> = emptyMap()) : Map<String, String> by LinkedHashMap(values) {
    /** The set with the attributes from [other] added. Those from [other] win. */
    operator fun plus(other: Map<String, String>): Attributes = Attributes(LinkedHashMap(this).apply { putAll(other) })

    /**
     * The attributes as HTML, with the values escaped: `class="lt-button" hidden`.
     * The empty text is written as the name alone, which means the same in HTML.
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
 * A number written the way JavaScript writes it, so the attributes are the
 * same as from TypeScript: `3`, not `3.0`, `1e+21`, not `1.0E21`, and `0.1`,
 * not `0.1000000000000000055511151231257827`.
 *
 * The digits are the fewest that give back the same number, as in JavaScript
 * (ECMA-262, `Number::toString`). If several have the same number of digits,
 * the closest wins, and on a tie the one ending in an even digit. Both
 * neighbours with `p` digits are tried, not just the closest: below a power of
 * two the gap to the number below is half the gap to the one above, so the
 * closest can miss where the one above hits. `2^-24` is
 * `5.960464477539063e-8`, not `5.9604644775390625e-8`. The form follows the
 * same rules: plain notation from 1e-6 up to 1e21, and otherwise an exponent
 * with a sign.
 */
internal fun jsNumber(n: Number): String {
    val d = n.toDouble()
    if (d.isNaN()) return "NaN"
    if (d.isInfinite()) return if (d > 0) "Infinity" else "-Infinity"
    // `-0` is written `0` in JavaScript.
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
    // The number is 0.`digits` times 10 to the power of `point`.
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

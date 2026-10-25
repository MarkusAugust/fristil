package no.lotek

/**
 * A small JSON reader, so the package needs no dependency to read the
 * results from the core.
 *
 * Gives `Map` (in the order the keys appear), `List`, `String`, `Double`,
 * `Boolean` and `null`. The core writes the JSON it reads, so an error in it
 * is a bug in LO-TEK, and the message says where.
 */
internal object Json {
    /** A text as a JSON string, with quotes. */
    fun string(text: String): String =
        buildString {
            append('"')
            for (c in text) {
                when {
                    c == '"' -> append("\\\"")
                    c == '\\' -> append("\\\\")
                    c == '\n' -> append("\\n")
                    c == '\r' -> append("\\r")
                    c == '\t' -> append("\\t")
                    c < ' ' -> append("\\u%04x".format(c.code))
                    else -> append(c)
                }
            }
            append('"')
        }

    /**
     * The opposite of [parse]: `Map`, `List`, `String`, numbers, `Boolean` and
     * `null` as JSON. An integer is written without decimals, as in JavaScript.
     */
    fun write(value: Any?): String =
        when (value) {
            null -> "null"
            is String -> string(value)
            is Boolean -> value.toString()
            is Int, is Long -> value.toString()
            is Number -> value.toDouble().let { if (it % 1.0 == 0.0 && !it.isInfinite()) it.toLong().toString() else it.toString() }
            is Map<*, *> -> value.entries.joinToString(",", "{", "}") { (k, v) -> "${string(k.toString())}:${write(v)}" }
            is List<*> -> value.joinToString(",", "[", "]") { write(it) }
            else -> throw IllegalArgumentException("Cannot write ${value::class.simpleName} as JSON.")
        }

    fun parse(text: String): Any? {
        val reader = Reader(text)
        val value = reader.value()
        reader.space()
        if (reader.i != text.length) reader.fail("text after the value")
        return value
    }

    private class Reader(val s: String) {
        var i = 0

        fun fail(what: String): Nothing = throw IllegalArgumentException("Invalid JSON at character $i: $what.")

        fun space() {
            while (i < s.length && s[i] in " \t\n\r") i++
        }

        fun value(): Any? {
            space()
            if (i >= s.length) fail("unexpected end")
            return when (s[i]) {
                '{' -> obj()
                '[' -> array()
                '"' -> string()
                't' -> word("true", true)
                'f' -> word("false", false)
                'n' -> word("null", null)
                else -> number()
            }
        }

        fun word(word: String, value: Any?): Any? {
            if (!s.startsWith(word, i)) fail("expected $word")
            i += word.length
            return value
        }

        fun obj(): Map<String, Any?> {
            val out = LinkedHashMap<String, Any?>()
            i++
            space()
            if (s.getOrNull(i) == '}') return out.also { i++ }
            while (true) {
                space()
                if (s.getOrNull(i) != '"') fail("expected a key")
                val key = string()
                space()
                if (s.getOrNull(i) != ':') fail("expected :")
                i++
                out[key] = value()
                space()
                when (s.getOrNull(i)) {
                    ',' -> i++
                    '}' -> return out.also { i++ }
                    else -> fail("expected , or }")
                }
            }
        }

        fun array(): List<Any?> {
            val out = ArrayList<Any?>()
            i++
            space()
            if (s.getOrNull(i) == ']') return out.also { i++ }
            while (true) {
                out.add(value())
                space()
                when (s.getOrNull(i)) {
                    ',' -> i++
                    ']' -> return out.also { i++ }
                    else -> fail("expected , or ]")
                }
            }
        }

        fun string(): String {
            val out = StringBuilder()
            i++
            while (true) {
                if (i >= s.length) fail("unterminated string")
                when (val c = s[i++]) {
                    '"' -> return out.toString()
                    '\\' -> {
                        if (i >= s.length) fail("unterminated string")
                        when (val e = s[i++]) {
                            '"', '\\', '/' -> out.append(e)
                            'b' -> out.append('\b')
                            'f' -> out.append('\u000C')
                            'n' -> out.append('\n')
                            'r' -> out.append('\r')
                            't' -> out.append('\t')
                            'u' -> {
                                if (i + 4 > s.length) fail("incomplete \\u")
                                out.append(s.substring(i, i + 4).toInt(16).toChar())
                                i += 4
                            }
                            else -> fail("unknown escape \\$e")
                        }
                    }
                    else -> out.append(c)
                }
            }
        }

        fun number(): Double {
            val start = i
            while (i < s.length && s[i] in "+-0123456789.eE") i++
            return s.substring(start, i).toDoubleOrNull() ?: fail("expected a value")
        }
    }
}

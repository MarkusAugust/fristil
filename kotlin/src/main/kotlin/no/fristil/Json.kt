package no.fristil

/**
 * En liten JSON-leser, så pakken ikke trenger noen avhengighet for å lese
 * svarene fra kjernen.
 *
 * Gir `Map` (i rekkefølgen nøklene står), `List`, `String`, `Double`,
 * `Boolean` og `null`. Kjernen skriver selv JSON-en den leser, så feil i den
 * er en feil i Fristil, og meldingen sier hvor.
 */
internal object Json {
    fun parse(text: String): Any? {
        val reader = Reader(text)
        val value = reader.value()
        reader.space()
        if (reader.i != text.length) reader.fail("tekst etter verdien")
        return value
    }

    private class Reader(val s: String) {
        var i = 0

        fun fail(what: String): Nothing = throw IllegalArgumentException("Ugyldig JSON ved tegn $i: $what.")

        fun space() {
            while (i < s.length && s[i] in " \t\n\r") i++
        }

        fun value(): Any? {
            space()
            if (i >= s.length) fail("slutten kom for tidlig")
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
            if (!s.startsWith(word, i)) fail("ventet $word")
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
                if (s.getOrNull(i) != '"') fail("ventet en nøkkel")
                val key = string()
                space()
                if (s.getOrNull(i) != ':') fail("ventet :")
                i++
                out[key] = value()
                space()
                when (s.getOrNull(i)) {
                    ',' -> i++
                    '}' -> return out.also { i++ }
                    else -> fail("ventet , eller }")
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
                    else -> fail("ventet , eller ]")
                }
            }
        }

        fun string(): String {
            val out = StringBuilder()
            i++
            while (true) {
                if (i >= s.length) fail("teksten ble ikke avsluttet")
                when (val c = s[i++]) {
                    '"' -> return out.toString()
                    '\\' -> {
                        if (i >= s.length) fail("teksten ble ikke avsluttet")
                        when (val e = s[i++]) {
                            '"', '\\', '/' -> out.append(e)
                            'b' -> out.append('\b')
                            'f' -> out.append('\u000C')
                            'n' -> out.append('\n')
                            'r' -> out.append('\r')
                            't' -> out.append('\t')
                            'u' -> {
                                if (i + 4 > s.length) fail("ufullstendig \\u")
                                out.append(s.substring(i, i + 4).toInt(16).toChar())
                                i += 4
                            }
                            else -> fail("ukjent escape \\$e")
                        }
                    }
                    else -> out.append(c)
                }
            }
        }

        fun number(): Double {
            val start = i
            while (i < s.length && s[i] in "+-0123456789.eE") i++
            return s.substring(start, i).toDoubleOrNull() ?: fail("ventet en verdi")
        }
    }
}

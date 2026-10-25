package no.lotek.intellij

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.codeInsight.completion.CompletionType
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.icons.AllIcons

/**
 * Suggests LO-TEK's classes inside `class="…"`.
 *
 * Registered on the HTML language, not on Kotlin. When IntelliJ injects HTML
 * into a string, the fragment becomes a real `PsiFile` with the HTML
 * language, and this is called for it. The same registration therefore
 * covers ordinary `.html` files, Kotlin strings and TypeScript strings.
 *
 * That is exactly the gap the plugin exists for: `web-types.json` gives
 * completion in HTML files without any plugin, but is not read into
 * injected fragments.
 *
 * The classes are the ones in the manifest the file is checked against, see
 * [Catalogue.classesFor].
 */
class LotekCompletionContributor : CompletionContributor() {
    override fun fillCompletionVariants(
        parameters: CompletionParameters,
        result: CompletionResultSet,
    ) {
        if (parameters.completionType != CompletionType.BASIC) return

        val text = parameters.originalFile.text
        val offset = parameters.offset
        if (!inClassValue(text, offset)) return

        /*
         * The prefix is IntelliJ's own.
         *
         * There was first a custom matcher here that read backwards to the
         * nearest whitespace, written on the assumption that IntelliJ splits
         * words on hyphens. That assumption was wrong: tested in an attribute
         * value, `class="lt-` gives the whole list, and
         * `class="my-own lt-but` completes to `lt-button`, with and without
         * the matcher. The code did nothing, and is gone.
         */
        for (cls in Catalogue.classesFor(parameters.originalFile)) {
            result.addElement(
                LookupElementBuilder.create(cls.name)
                    .withIcon(AllIcons.Xml.Css_class)
                    .withTypeText(cls.component, true)
                    .withCaseSensitivity(false),
            )
        }
    }

    private companion object {
        /**
         * Whether the caret is inside the value of a `class` attribute.
         *
         * Reads backwards in the text rather than walking the PSI tree. An
         * injected fragment can be incomplete while you type, and then the
         * tree is unstable: `<table class="lt-` has no closed tag and no
         * attribute node to ask. The text backwards is the same regardless.
         */
        fun inClassValue(
            text: String,
            offset: Int,
        ): Boolean {
            if (offset <= 0 || offset > text.length) return false

            /*
             * Find the tag the caret is in.
             *
             * `<` cannot appear in an attribute value in valid HTML, so the
             * last one before the caret opens the tag. If there is a `>`
             * after it, the tag is closed and the caret is in plain text.
             */
            val tag = text.lastIndexOf('<', offset - 1)
            if (tag < 0) return false
            if (text.indexOf('>', tag).let { it in 0 until offset }) return false

            /*
             * Opening or closing quote?
             *
             * Going back to the nearest quote is not enough:
             * `<div title="class=" lt-` stops at the *closing* one, and then
             * the `=` from the value's content is left and looks like an
             * attribute. The number of quotes from the start of the tag
             * decides: an odd number means the last one opened a value we
             * are still in.
             */
            var count = 0
            var lastQuote = -1
            for (j in tag until offset) {
                if (text[j] == '"' || text[j] == '\'') {
                    count++
                    lastQuote = j
                }
            }

            val before =
                if (count % 2 == 1) {
                    // In a quoted value. Whitespace separates classes, nothing
                    // more, so everything up to the quote belongs to the value.
                    val withoutQuote = text.substring(tag, lastQuote).trimEnd()
                    if (!withoutQuote.endsWith("=")) return false
                    withoutQuote.dropLast(1)
                } else {
                    /*
                     * Outside a value, or in an unquoted one. An unquoted
                     * value is valid HTML, and `<div class=lt-` gave nothing
                     * when only quotes counted. Here whitespace ends the
                     * value, unlike in the quoted one.
                     */
                    val fromTag = text.substring(tag, offset)
                    val equalsSign = fromTag.lastIndexOf('=')
                    if (equalsSign < 0) return false
                    if (fromTag.substring(equalsSign + 1).any { it.isWhitespace() }) return false
                    fromTag.substring(0, equalsSign)
                }

            /*
             * The attribute must be named `class` and nothing else.
             *
             * `takeLastWhile` alone turned `:class` and `x-bind:class` into
             * `class`, because the colon is not in the set. There Vue and
             * Alpine take a JavaScript expression, so a bare `lt-button`
             * becomes a variable reference and not a class. `data-class` got
             * through too, since the hyphen is in the set.
             *
             * So a real attribute boundary is required in front: whitespace,
             * or the attribute being the first after the tag name.
             */
            val ahead = before.trimEnd()
            val name = ahead.takeLastWhile { it.isLetterOrDigit() || it == '-' }
            if (!name.equals("class", ignoreCase = true)) return false

            val charBefore = ahead.dropLast(name.length).lastOrNull() ?: return false
            return charBefore.isWhitespace()
        }
    }
}

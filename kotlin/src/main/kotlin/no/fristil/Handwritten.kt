package no.fristil

/*
 * Byggefunksjonene der valgene virker sammen, så de ikke kan skrives som en
 * tabell i manifestet. Resten genereres fra manifestet (`Fs.kt`). Alle testes
 * mot svarene fra TypeScript i `ContractTest`, så de ikke kan gå fra
 * hverandre.
 */

/** Id-en må være oppgitt. TypeScript lager en tilfeldig, men den gir ulik markup ved hver kjøring. */
private fun requireId(builder: String, id: String): String {
    require(id.isNotBlank()) { "Fs.$builder: id kan ikke være tom. Bruk feltets navn eller en annen fast id." }
    return id
}

/** Ledeteksten for `fs.label` og `fs.legend`: `optional` gjelder bare uten `required`. */
private fun marked(
    className: String,
    required: RequiredMarker?,
    optional: Boolean?,
    disabled: Boolean?,
): LinkedHashMap<String, String> {
    val a = linkedMapOf("class" to className)
    if (required != null) a["data-required"] = required.value
    if (optional == true && required == null) a["data-optional"] = ""
    if (disabled == true) a["aria-disabled"] = "true"
    return a
}

/** `fs.label`: en ledetekst. Markeringen er bare visuell, så sett `required` på feltet også. */
fun Fs.label(
    required: RequiredMarker? = null,
    optional: Boolean? = null,
    disabled: Boolean? = null,
): Attributes = Attributes(marked("fs-label", required, optional, disabled))

/** `fs.legend`: ledeteksten for en gruppe, med samme markering som [label]. */
fun Fs.legend(
    required: RequiredMarker? = null,
    optional: Boolean? = null,
    disabled: Boolean? = null,
): Attributes = Attributes(marked("fs-legend", required, optional, disabled))

/** `fs.errorSummary`: feiloppsummeringen. Boksen skjules når [count] er null. */
fun Fs.errorSummary(
    count: Number? = null,
    id: String? = null,
): ErrorSummaryParts {
    val host = linkedMapOf("class" to "fs-error-summary", "role" to "alert", "tabindex" to "-1")
    if (id != null) host["id"] = id
    if ((count?.toDouble() ?: 0.0) == 0.0) host["hidden"] = ""
    return ErrorSummaryParts(host = Attributes(host), title = Attributes(mapOf("class" to "fs-error-summary__title")))
}

/** Id-ene i `aria-describedby`, delt på mellomrom slik JavaScript deler dem, uten tomme og doble. */
private fun joinDescribedBy(ids: List<String?>): String? {
    val unique = LinkedHashSet<String>()
    for (id in ids) {
        if (id.isNullOrEmpty()) continue
        for (part in splitJsWhitespace(id)) if (part.isNotEmpty()) unique.add(part)
    }
    return if (unique.isEmpty()) null else unique.joinToString(" ")
}

/** Det samme som `text.split(/\s+/)` i JavaScript, med JavaScripts definisjon av mellomrom. */
private fun splitJsWhitespace(text: String): List<String> {
    val out = ArrayList<String>()
    val current = StringBuilder()
    var inSpace = false
    for (c in text) {
        if (isJsWhitespace(c)) {
            if (!inSpace) out.add(current.toString().also { current.setLength(0) })
            inSpace = true
        } else {
            inSpace = false
            current.append(c)
        }
    }
    out.add(current.toString())
    return out
}

private fun isJsWhitespace(c: Char): Boolean =
    c == '\t' || c == '\n' || c == '\u000B' || c == '\u000C' || c == '\r' || c == ' ' ||
        c == ' ' || c == ' ' || c in ' '..' ' || c == ' ' ||
        c == ' ' || c == ' ' || c == ' ' || c == '　' || c == '﻿'

/**
 * `fs.field`: kobler ledetekst, kontroll, hjelpetekst og feilmelding.
 *
 * ```kotlin
 * val felt = Fs.field(id = "epost", required = RequiredMarker.TEXT, help = true, error = true, invalid = ugyldig)
 * "<label ${felt.label.toHtml()}>E-postadresse</label>"
 * "<input ${(Fs.input(type = InputType.EMAIL, state = felt.state) + felt.control).toHtml()}>"
 * ```
 */
fun Fs.field(
    id: String,
    help: Boolean? = null,
    error: Boolean? = null,
    helpId: String? = null,
    errorId: String? = null,
    required: RequiredMarker? = null,
    optional: Boolean? = null,
    invalid: Boolean? = null,
    disabled: Boolean? = null,
    describedBy: List<String>? = null,
): FieldParts = computeField("field", id, help, error, helpId, errorId, required, optional, invalid, disabled, describedBy)

private fun computeField(
    builder: String,
    givenId: String,
    help: Boolean?,
    error: Boolean?,
    givenHelpId: String?,
    givenErrorId: String?,
    required: RequiredMarker?,
    optional: Boolean?,
    invalid: Boolean?,
    disabled: Boolean?,
    describedBy: List<String>?,
): FieldParts {
    val id = requireId(builder, givenId)
    val helpId = givenHelpId ?: "$id-help"
    val errorId = givenErrorId ?: "$id-error"
    val isInvalid = invalid == true

    val label = linkedMapOf("class" to "fs-label", "for" to id)
    if (required != null) label["data-required"] = required.value
    if (optional == true && required == null) label["data-optional"] = ""
    if (disabled == true) label["aria-disabled"] = "true"

    val control = linkedMapOf("id" to id)
    joinDescribedBy(
        listOf(
            if (help == true) helpId else null,
            if (isInvalid && error == true) errorId else null,
        ) + describedBy.orEmpty(),
    )?.let { control["aria-describedby"] = it }
    if (isInvalid) {
        control["aria-invalid"] = "true"
        control["data-state"] = "invalid"
    }
    if (disabled == true) control["disabled"] = ""

    val errorAttributes = linkedMapOf("id" to errorId)
    if (!isInvalid) errorAttributes["hidden"] = ""

    return FieldParts(
        label = Attributes(label),
        control = Attributes(control),
        help = Attributes(mapOf("id" to helpId)),
        error = Attributes(errorAttributes),
        state = if (isInvalid) FieldState.INVALID else FieldState.DEFAULT,
    )
}

/** `fs.suggestion`: et felt med forslagsliste. `<fs-suggestion>` tar tastaturet og filtreringen. */
fun Fs.suggestion(
    invalid: Boolean? = null,
    error: Boolean? = null,
    disabled: Boolean? = null,
    required: RequiredMarker? = null,
    optional: Boolean? = null,
    help: Boolean? = null,
    helpId: String? = null,
    errorId: String? = null,
    describedBy: List<String>? = null,
    id: String,
    count: Number? = null,
    activeIndex: Number? = null,
    open: Boolean? = null,
    pending: Boolean? = null,
): SuggestionParts {
    val field = computeField("suggestion", id, help, error, helpId, errorId, required, optional, invalid, disabled, describedBy)
    val n = count?.toDouble() ?: 0.0
    val active = activeIndex?.toDouble() ?: -1.0
    val isOpen = open == true
    val listId = "$id-list"
    val statusId = "$id-status"
    fun optionId(index: Int) = "$id-option-$index"
    // Markeringen skrives bare når lista er åpen, som i TypeScript.
    val marked = isOpen && active >= 0 && active < n

    val control = LinkedHashMap(field.control)
    control["class"] = "fs-input"
    control["type"] = "text"
    control["role"] = "combobox"
    control["autocomplete"] = "off"
    control["aria-expanded"] = if (isOpen) "true" else "false"
    control["aria-controls"] = listId
    control["aria-describedby"] = listOfNotNull(field.control["aria-describedby"], statusId).joinToString(" ")
    control["aria-autocomplete"] = "list"
    if (marked) control["aria-activedescendant"] = optionId(active.toInt())

    val list = linkedMapOf("class" to "fs-suggestion__list", "id" to listId, "role" to "listbox")
    if (!isOpen) list["hidden"] = ""

    val empty = linkedMapOf("class" to "fs-suggestion__empty")
    if (!(n == 0.0 && pending != true)) empty["hidden"] = ""

    return SuggestionParts(
        label = field.label,
        field = Attributes(mapOf("class" to "fs-suggestion__field")),
        control = Attributes(control),
        list = Attributes(list),
        options = (0 until arrayLength(n)).map { index ->
            Attributes(
                mapOf(
                    "class" to "fs-suggestion__option",
                    "id" to optionId(index),
                    "role" to "option",
                    "aria-selected" to if (marked && index.toDouble() == active) "true" else "false",
                ),
            )
        },
        empty = Attributes(empty),
        status = Attributes(
            mapOf(
                "class" to "fs-sr-only",
                "id" to statusId,
                "role" to "status",
                "aria-live" to "polite",
                "data-ignore-morph" to "",
            ),
        ),
        help = field.help,
        error = field.error,
        state = field.state,
    )
}

/** Lengden `Array.from({ length })` gir: hele delen, og null for et negativt tall. */
private fun arrayLength(n: Double): Int = if (n.isNaN() || n <= 0) 0 else minOf(n, Int.MAX_VALUE.toDouble()).toInt()

/** `fs.tabs`: en fanerad med paneler. `<fs-tabs>` tar piltastene. */
fun Fs.tabs(
    id: String,
    count: Number,
    selected: Number? = null,
    label: String? = null,
): TabsParts {
    requireId("tabs", id)
    val n = count.toDouble()
    // Er `selected` utenfor rekkevidde, rettes den, som i TypeScript.
    val valid = minOf(maxOf(selected?.toDouble() ?: 0.0, 0.0), maxOf(n - 1, 0.0))
    val indices = 0 until arrayLength(maxOf(n, 0.0))
    fun tabId(index: Int) = "$id-tab-$index"
    fun panelId(index: Int) = "$id-panel-$index"

    val list = linkedMapOf("class" to "fs-tabs__list", "role" to "tablist")
    if (label != null) list["aria-label"] = label

    return TabsParts(
        list = Attributes(list),
        tabs = indices.map { index ->
            val chosen = index.toDouble() == valid
            Attributes(
                mapOf(
                    "id" to tabId(index),
                    "role" to "tab",
                    "type" to "button",
                    "aria-selected" to if (chosen) "true" else "false",
                    "aria-controls" to panelId(index),
                    "tabindex" to if (chosen) "0" else "-1",
                ),
            )
        },
        panels = indices.map { index ->
            val panel = linkedMapOf(
                "id" to panelId(index),
                "class" to "fs-tabs__panel",
                "role" to "tabpanel",
                "aria-labelledby" to tabId(index),
                "tabindex" to "0",
            )
            if (index.toDouble() != valid) panel["hidden"] = ""
            Attributes(panel)
        },
    )
}

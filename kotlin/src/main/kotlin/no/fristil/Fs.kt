package no.fristil

/**
 * Koblingen mellom ledetekst, felt, hjelpetekst og feilmelding, som
 * `fs.field()` gir den i TypeScript.
 */
data class FieldAttributes(
    val label: Attributes,
    val control: Attributes,
    val help: Attributes,
    val error: Attributes,
    /** Tilstanden kontrollen skal ha, til `input()`. */
    val state: FieldState,
)

/**
 * Byggefunksjonene, for Kotlin-servere som skriver markupen selv.
 *
 * Hver funksjon gir de samme attributtene som funksjonen med samme navn i
 * `@fristil/designsystem`. TypeScript er fasiten: `ContractTest` kjører hver
 * funksjon her mot tilfellene i `contract/cases.json`, som er skrevet av
 * TypeScript-koden, og feiler på det første svaret som ikke er likt.
 *
 * Valgene er navngitte parametere, og de lovlige verdiene er enum-er, så en
 * skrivefeil som `variant = "secondry"` er en kompileringsfeil.
 */
object Fs {
    /**
     * Koblingen for ett skjemafelt. Attributtene legges på ledeteksten,
     * kontrollen, hjelpeteksten og feilmeldingen, og koblingen står da i
     * HTML-en fra serveren. `<fs-field>` trengs ikke.
     *
     * TypeScript lager en tilfeldig id og sier fra når `id` mangler eller
     * bare er mellomrom, siden en konsument uten typesjekk kan glemme den.
     * Her stopper typen en manglende id, og en id som er tom eller bare
     * mellomrom, også de JavaScript sin `trim()` fjerner, er en feil i
     * koden, så den kaster.
     */
    fun field(
        id: String,
        help: Boolean = false,
        error: Boolean = false,
        helpId: String? = null,
        errorId: String? = null,
        required: RequiredMarker? = null,
        optional: Boolean = false,
        invalid: Boolean = false,
        disabled: Boolean = false,
        describedBy: List<String> = emptyList(),
    ): FieldAttributes {
        require(id.replace(WHITESPACE, "").isNotEmpty()) {
            "Fs.field(): id kan ikke være tom eller bare mellomrom. Bruk feltets navn, for eksempel \"epost\"."
        }
        val resolvedHelpId = helpId ?: "$id-help"
        val resolvedErrorId = errorId ?: "$id-error"

        return FieldAttributes(
            label =
                attributes(
                    "class" to "fs-label",
                    "for" to id,
                    "data-required" to required?.value,
                    "data-optional" to if (optional && required == null) ON else null,
                    "aria-disabled" to if (disabled) "true" else null,
                ),
            control =
                attributes(
                    "id" to id,
                    "aria-describedby" to
                        joinDescribedBy(
                            listOfNotNull(
                                if (help) resolvedHelpId else null,
                                if (invalid && error) resolvedErrorId else null,
                            ) + describedBy,
                        ),
                    "aria-invalid" to if (invalid) "true" else null,
                    "data-state" to if (invalid) "invalid" else null,
                    "disabled" to if (disabled) ON else null,
                ),
            help = attributes("id" to resolvedHelpId),
            error =
                attributes(
                    "id" to resolvedErrorId,
                    "hidden" to if (invalid) null else ON,
                ),
            state = if (invalid) FieldState.INVALID else FieldState.DEFAULT,
        )
    }

    /** Et tekstfelt. `type` setter både HTML-typen og ikonet. */
    fun input(
        type: InputType = InputType.TEXT,
        state: FieldState = FieldState.DEFAULT,
    ): Attributes =
        attributes(
            "class" to "fs-input",
            "type" to type.value,
            "data-variant" to if (type in TYPES_WITH_ICON) type.value else null,
            "data-state" to if (state == FieldState.DEFAULT) null else state.value,
            "aria-invalid" to if (state == FieldState.INVALID) "true" else null,
        )

    /** En ledetekst som ikke står i et felt fra `field()`. */
    fun label(
        required: RequiredMarker? = null,
        optional: Boolean = false,
        disabled: Boolean = false,
    ): Attributes =
        attributes(
            "class" to "fs-label",
            "data-required" to required?.value,
            "data-optional" to if (optional && required == null) ON else null,
            "aria-disabled" to if (disabled) "true" else null,
        )

    /** En hjelpetekst. */
    fun helpText(variant: HelpTextVariant = HelpTextVariant.MUTED): Attributes =
        attributes(
            "class" to "fs-help-text",
            "data-variant" to if (variant == HelpTextVariant.MUTED) null else variant.value,
        )

    /** En feilmelding. */
    fun errorText(variant: ErrorTextVariant = ErrorTextVariant.ERROR): Attributes =
        attributes(
            "class" to "fs-error-text",
            "data-variant" to if (variant == ErrorTextVariant.ERROR) null else variant.value,
        )

    private val TYPES_WITH_ICON = setOf(InputType.DATE, InputType.TIME, InputType.DATETIME_LOCAL)
}

/*
 * Mellomrommene JavaScript sin `\s` treffer. Java sin `\s` er bare ASCII, og
 * med `(?U)` mangler den fortsatt BOM, så lista står skrevet ut. Kontrakten
 * har et tilfelle med hardt mellomrom og et med BOM for å holde den ærlig.
 */
private val WHITESPACE =
    Regex("[\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]+")

/**
 * Setter sammen `aria-describedby`: deler på mellomrom, fjerner duplikater og
 * beholder rekkefølgen. Ingen id-er gir ikke noe attributt.
 */
internal fun joinDescribedBy(ids: List<String>): String? {
    val unique = LinkedHashSet<String>()
    for (id in ids) {
        for (part in id.split(WHITESPACE)) {
            if (part.isNotEmpty()) unique.add(part)
        }
    }
    return if (unique.isEmpty()) null else unique.joinToString(" ")
}

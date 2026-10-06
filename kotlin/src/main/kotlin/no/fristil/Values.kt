package no.fristil

/*
 * De lovlige verdiene. Hver liste skal være nøyaktig den samme som i
 * TypeScript, og `ContractTest` krever det: en verdi TypeScript har og Kotlin
 * mangler, eller omvendt, feller testene.
 */

/** Hvordan et påkrevd felt markeres i ledeteksten. */
enum class RequiredMarker(
    val value: String,
) {
    SYMBOL("symbol"),
    TEXT("text"),
}

/** Valideringstilstanden til et felt. */
enum class FieldState(
    val value: String,
) {
    DEFAULT("default"),
    INVALID("invalid"),
    SUCCESS("success"),
}

/** HTML-typen til et tekstfelt. */
enum class InputType(
    val value: String,
) {
    TEXT("text"),
    PASSWORD("password"),
    EMAIL("email"),
    NUMBER("number"),
    DATE("date"),
    DATETIME_LOCAL("datetime-local"),
    WEEK("week"),
    MONTH("month"),
    TEL("tel"),
    URL("url"),
    SEARCH("search"),
    TIME("time"),
}

/** Visuell vekt på en hjelpetekst. */
enum class HelpTextVariant(
    val value: String,
) {
    MUTED("muted"),
    STRONG("strong"),
    SUCCESS("success"),
    WARNING("warning"),
}

/** Hva en feilmelding betyr. */
enum class ErrorTextVariant(
    val value: String,
) {
    ERROR("error"),
    WARNING("warning"),
}

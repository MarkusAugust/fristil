package no.fristil.intellij

/**
 * En klasse fra Fristil, slik editoren viser den.
 *
 * @property navn klassenavnet, for eksempel `fs-button`
 * @property komponent komponenten den hører til, vist som detalj i lista
 * @property beskrivelse hva komponenten er, vist i dokumentasjonsruta
 * @property lenke adressen til komponentsiden
 */
data class Klasse(
    val navn: String,
    val komponent: String,
    val beskrivelse: String,
    val lenke: String,
)

/**
 * Klassene Fristil sender ut.
 *
 * Lista står i `Klasser.kt`, som genereres av `editor/scripts/generate.ts`
 * fra den samme `classesData()` som skriver `classes.ts` og `web-types.json`.
 * Pluginen har derfor ingen egen utgave som kan komme ut av takt med
 * diagnostikken eller med VS Code-utvidelsen.
 *
 * Den er en Kotlin-fil og ikke JSON med vilje: da trengs ingen parser og
 * ingen avhengighet, og kompilatoren leser dataene. Det er det samme valget
 * som ble tatt for `src/diagnostics/classes.ts`.
 */
object Katalog {
    val klasser: List<Klasse> get() = KLASSER

    private val etterNavn: Map<String, Klasse> by lazy {
        KLASSER.associateBy { it.navn }
    }

    fun finn(navn: String): Klasse? = etterNavn[navn]
}

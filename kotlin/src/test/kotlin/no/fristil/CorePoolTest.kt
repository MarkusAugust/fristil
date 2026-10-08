package no.fristil

import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** At instansene av kjernen deles mellom trådene, og ikke hoper seg opp. */
class CorePoolTest {
    @Test
    fun `many threads get the same answer and keep few cores`() {
        val html = """<button class="fs-buton">Send</button>"""
        val expected = Fristil.diagnoseMarkup(html)
        val pool = Executors.newFixedThreadPool(64)
        val answers = (1..2000).map { pool.submit<List<Finding>> { Fristil.diagnoseMarkup(html) } }
        val results = answers.map { it.get(60, TimeUnit.SECONDS) }
        pool.shutdown()
        assertTrue(results.all { it == expected }, "alle trådene skal få det samme svaret")
        assertTrue(
            Fristil.idleCores() <= Runtime.getRuntime().availableProcessors(),
            "${Fristil.idleCores()} ledige instanser etter 64 tråder",
        )
        assertEquals(1, expected.size)
    }
}

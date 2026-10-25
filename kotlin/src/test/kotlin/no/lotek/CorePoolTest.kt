package no.lotek

import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** That the core instances are shared between threads, and do not pile up. */
class CorePoolTest {
    @Test
    fun `many threads get the same answer and keep few cores`() {
        val html = """<button class="lt-buton">Send</button>"""
        val expected = Lotek.diagnoseMarkup(html)
        val pool = Executors.newFixedThreadPool(64)
        val answers = (1..2000).map { pool.submit<List<Finding>> { Lotek.diagnoseMarkup(html) } }
        val results = answers.map { it.get(60, TimeUnit.SECONDS) }
        pool.shutdown()
        assertTrue(results.all { it == expected }, "all the threads must get the same result")
        assertTrue(
            Lotek.idleCores() <= Runtime.getRuntime().availableProcessors(),
            "${Lotek.idleCores()} idle instances after 64 threads",
        )
        assertEquals(1, expected.size)
    }
}

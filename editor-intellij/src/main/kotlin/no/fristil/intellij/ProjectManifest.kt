package no.fristil.intellij

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.guessProjectDir
import com.intellij.openapi.roots.ProjectFileIndex
import com.intellij.openapi.vfs.VfsUtilCore
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.PsiFile
import java.util.concurrent.ConcurrentHashMap

/**
 * Manifestet prosjektet sjekkes mot, funnet slik språkserveren finner det
 * (`vocabulary()` i `kjerne/cli/src/lsp.rs`).
 *
 * Fra mappa fila ligger i og oppover, til og med prosjektmappa, eller
 * innholdsrota fila hører til når den ligger utenfor prosjektmappa:
 * først `build/fristil/manifest.json`, som Gradle-oppgaven `fristilManifest`
 * skriver når prosjektet har overtatt komponenter, så manifestet i
 * `node_modules/@fristil/designsystem`. Ikke over den: en pakke i
 * hjemmemappa er ikke prosjektets. Finnes ingen av dem, gjelder manifestet
 * som er bygget inn i kjernen. Språkserveren har i tillegg et valg for et
 * bestemt manifest, som pluginen ikke har.
 *
 * For et injisert fragment letes det fra fila strengen står i.
 */
internal object ProjectManifest {
    val CANDIDATES =
        listOf(
            "build/fristil/manifest.json",
            "node_modules/@fristil/designsystem/manifest/manifest.json",
        )

    private val log = Logger.getInstance(ProjectManifest::class.java)

    /** Teksten i et manifest, og hvilken utgave av fila den ble lest fra. */
    private class Read(val stamp: Long, val text: String)

    private val read = ConcurrentHashMap<String, Read>()

    /** Manifestene kjernen ikke kunne lese, så det sies fra én gang. */
    private val rejected = ConcurrentHashMap.newKeySet<String>()

    /** Teksten i manifestet for [file], eller `null` for det innebygde. */
    fun forFile(file: PsiFile): String? {
        val project = file.project
        val host = InjectedLanguageManager.getInstance(project).getTopLevelFile(file) ?: file
        val virtualFile = host.originalFile.virtualFile ?: return null
        // Prosjektmappa svarer til arbeidsområdet språkserveren får. En
        // modul har sin egen innholdsrot, og stoppet letingen der, ville en
        // `node_modules` ved rota av et monorepo aldri blitt funnet.
        val projectDir = project.guessProjectDir()
        val root =
            if (projectDir != null && VfsUtilCore.isAncestor(projectDir, virtualFile, false)) {
                projectDir
            } else {
                ProjectFileIndex.getInstance(project).getContentRootForFile(virtualFile, false)
            }
        var dir: VirtualFile? = virtualFile.parent
        while (dir != null) {
            for (candidate in CANDIDATES) {
                val found = dir.findFileByRelativePath(candidate)
                if (found != null && !found.isDirectory) return text(found)
            }
            if (dir == root) break
            dir = dir.parent
        }
        return null
    }

    private fun text(file: VirtualFile): String? {
        val stamp = file.modificationStamp
        read[file.url]?.let { if (it.stamp == stamp) return it.text }
        val text =
            try {
                VfsUtilCore.loadText(file)
            } catch (unreadable: java.io.IOException) {
                log.warn("Fristil kunne ikke lese ${file.presentableUrl}, og sjekker mot det innebygde manifestet.", unreadable)
                return null
            }
        read[file.url] = Read(stamp, text)
        rejected.remove(file.url)
        return text
    }

    /** At kjernen avviste manifestet: én advarsel i loggen per utgave av fila. */
    fun rejectedBy(text: String, reason: String) {
        val url = read.entries.firstOrNull { it.value.text === text }?.key ?: return
        if (rejected.add(url)) {
            log.warn("Fristil kunne ikke bruke $url, og sjekker mot det innebygde manifestet: $reason")
        }
    }
}

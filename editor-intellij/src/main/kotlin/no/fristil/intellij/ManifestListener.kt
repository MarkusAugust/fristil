package no.fristil.intellij

import com.intellij.codeInsight.daemon.DaemonCodeAnalyzer
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent

/**
 * Sjekker de åpne filene på nytt når et manifest kommer, endres eller blir
 * borte, som språkserveren gjør.
 *
 * En ny `build/fristil/manifest.json` etter `gradle assemble` er ingen
 * endring i fila som står åpen, så uten dette ble de gamle funnene stående
 * til brukeren skrev noe.
 */
class ManifestListener : BulkFileListener {
    override fun after(events: List<VFileEvent>) {
        // Lages eller slettes en hel mappe, som `build/fristil` ved første
        // bygg eller `node_modules` ved `npm install`, kommer det én hendelse
        // for mappa og ingen for fila inni. Derfor også mappene på stien.
        val touched =
            events.any { event ->
                ProjectManifest.CANDIDATES.any { candidate ->
                    val parts = candidate.split('/')
                    parts.indices.any { i -> event.path.endsWith("/" + parts.subList(0, i + 1).joinToString("/")) }
                }
            }
        if (!touched) return
        for (project in ProjectManager.getInstance().openProjects) {
            if (!project.isDisposed) DaemonCodeAnalyzer.getInstance(project).restart()
        }
    }
}

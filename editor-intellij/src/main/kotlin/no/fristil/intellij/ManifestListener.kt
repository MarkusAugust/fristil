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
        val touched = events.any { event -> ProjectManifest.CANDIDATES.any { event.path.endsWith("/$it") } }
        if (!touched) return
        for (project in ProjectManager.getInstance().openProjects) {
            if (!project.isDisposed) DaemonCodeAnalyzer.getInstance(project).restart()
        }
    }
}

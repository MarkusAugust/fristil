package no.lotek.intellij

import com.intellij.codeInsight.daemon.DaemonCodeAnalyzer
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent

/**
 * Checks the open files again when a manifest appears, changes or goes
 * away, as the language server does.
 *
 * A new `build/lotek/manifest.json` after `gradle assemble` is no change to
 * the file that is open, so without this the old findings stayed until the
 * user typed something.
 */
class ManifestListener : BulkFileListener {
    override fun after(events: List<VFileEvent>) {
        // When a whole directory is created or deleted, like `build/lotek` on
        // the first build or `node_modules` on `npm install`, there is one
        // event for the directory and none for the file inside. Hence the
        // directories on the path too.
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

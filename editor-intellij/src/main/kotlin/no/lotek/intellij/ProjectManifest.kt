package no.lotek.intellij

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.guessProjectDir
import com.intellij.openapi.roots.ProjectFileIndex
import com.intellij.openapi.vfs.VfsUtilCore
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.PsiFile
import no.lotek.Manifest
import java.util.concurrent.ConcurrentHashMap

/**
 * The manifest the project is checked against, and completion reads the
 * classes from, found the way the language server finds it (`vocabulary()`
 * in `core/cli/src/lsp.rs`).
 *
 * From the directory the file is in and upwards, up to and including the
 * project directory, or the content root the file belongs to when it is
 * outside the project directory: first `build/lotek/manifest.json`, which
 * the Gradle task `lotekManifest` writes when the project has taken over
 * components, then the manifest in `node_modules/@lo-tek/interfaces`. Not
 * above it: a package in the home directory is not the project's. A file
 * outside the project, like a scratch file, is therefore checked against the
 * manifest in the Kotlin package. If none of them exists, the same applies.
 * The language server also tries the root of every workspace for such a
 * file, and has an option for a specific manifest, which the plugin does
 * not have.
 *
 * For an injected fragment the search starts from the file the string is in.
 */
internal object ProjectManifest {
    val CANDIDATES =
        listOf(
            "build/lotek/manifest.json",
            "node_modules/@lo-tek/interfaces/manifest/manifest.json",
        )

    private val log = Logger.getInstance(ProjectManifest::class.java)

    /** The text of a manifest, which version of the file it was read from, and the classes in it. */
    private class Read(val stamp: Long, val text: String) {
        /**
         * The classes in the manifest, for completion, read the first time it
         * asks and for as long as this version of the file applies. `null`
         * when the manifest cannot be read: then the package's applies, as
         * for the check, and it is reported in the log.
         */
        val classes: List<CatalogueClass>? by lazy {
            try {
                Catalogue.from(Manifest.parse(text))
            } catch (unreadable: IllegalArgumentException) {
                ProjectManifest.rejectedBy(text, unreadable.message.orEmpty())
                null
            }
        }
    }

    private val read = ConcurrentHashMap<String, Read>()

    /** The manifests the core could not read, so it is reported once. */
    private val rejected = ConcurrentHashMap.newKeySet<String>()

    /** The text of the manifest for [file], or `null` for the manifest in the Kotlin package. */
    fun forFile(file: PsiFile): String? = readFor(file)?.text

    /** The classes in the manifest for [file], or `null` for the classes in the Kotlin package. */
    fun classesFor(file: PsiFile): List<CatalogueClass>? = readFor(file)?.classes

    private fun readFor(file: PsiFile): Read? {
        val project = file.project
        val host = InjectedLanguageManager.getInstance(project).getTopLevelFile(file) ?: file
        val virtualFile = host.originalFile.virtualFile ?: return null
        // The project directory corresponds to the workspace the language
        // server gets. A module has its own content root, and if the search
        // stopped there, a `node_modules` at the root of a monorepo would
        // never be found.
        val projectDir = project.guessProjectDir()
        val root =
            if (projectDir != null && VfsUtilCore.isAncestor(projectDir, virtualFile, false)) {
                projectDir
            } else {
                ProjectFileIndex.getInstance(project).getContentRootForFile(virtualFile, false)
            } ?: return null
        var dir: VirtualFile? = virtualFile.parent
        while (dir != null) {
            for (candidate in CANDIDATES) {
                val found = dir.findFileByRelativePath(candidate)
                if (found != null && !found.isDirectory) return load(found)
            }
            if (dir == root) break
            dir = dir.parent
        }
        return null
    }

    private fun load(file: VirtualFile): Read? {
        val stamp = file.modificationStamp
        read[file.url]?.let { if (it.stamp == stamp) return it }
        val text =
            try {
                VfsUtilCore.loadText(file)
            } catch (unreadable: java.io.IOException) {
                log.warn("LO-TEK could not read ${file.presentableUrl}, and checks against the manifest in the Kotlin package.", unreadable)
                return null
            }
        val fresh = Read(stamp, text)
        read[file.url] = fresh
        rejected.remove(file.url)
        return fresh
    }

    /** That the core rejected the manifest: one warning in the log per version of the file. */
    fun rejectedBy(text: String, reason: String) {
        val url = read.entries.firstOrNull { it.value.text === text }?.key ?: return
        if (rejected.add(url)) {
            log.warn("LO-TEK could not use $url, and checks against the manifest in the Kotlin package: $reason")
        }
    }
}

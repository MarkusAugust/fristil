package no.lotek.intellij

import com.intellij.codeInsight.intention.IntentionAction
import com.intellij.codeInsight.intention.PriorityAction
import com.intellij.lang.annotation.AnnotationHolder
import com.intellij.lang.annotation.Annotator
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.util.text.StringUtil
import com.intellij.psi.ElementManipulators
import com.intellij.psi.PsiDocumentManager
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiLanguageInjectionHost
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.psi.xml.XmlDocument
import no.lotek.Finding
import no.lotek.Fix
import no.lotek.Lotek

/**
 * LO-TEK's diagnostics in the editor, from the same Rust core that
 * `lotek check` and VS Code use.
 *
 * The core is run by Chicory in the IDE's own JVM, through the Maven package
 * in `../kotlin`. No Node, no process to start.
 *
 * An ordinary `Annotator`, not an `ExternalAnnotator`: IntelliJ also runs
 * annotators on HTML injected into a string, and that is where the plugin
 * is needed most. It is called for `XmlDocument`, which covers the whole
 * fragment, so the core reads each file once per pass.
 *
 * The check is `diagnoseMarkup`, not `diagnosePage`: a file or a fragment is
 * a template, and an id something points to may well be in another
 * template. It runs against the project's manifest when it has one, see
 * [ProjectManifest].
 */
class LotekAnnotator : Annotator {
    override fun annotate(element: PsiElement, holder: AnnotationHolder) {
        if (element !is XmlDocument) return
        val file = element.containingFile ?: return
        // No shortcut on «lt-» in the text: the rule without-name applies to
        // every button and link, also without a single LO-TEK class, and the core takes
        // milliseconds on a file. With the shortcut IntelliJ said nothing
        // about an icon button without a name that `lotek check` and VS Code
        // reported.
        val text = file.text

        val bounds = element.textRange
        for (finding in diagnose(file, text)) {
            val range = TextRange(finding.start, maxOf(finding.end, finding.start))
            // A finding outside the document cannot be attached to it.
            if (!bounds.contains(range)) continue
            val builder =
                holder
                    .newAnnotation(severity(finding), finding.message)
                    .range(range)
                    .tooltip(tooltip(finding))
            finding.fix?.let { builder.withFix(ReplaceFix(it)) }
            builder.create()
        }
    }

    /**
     * Against the project's manifest when it has one, otherwise the manifest
     * in the Kotlin package. A manifest the core cannot read gives a warning
     * in the log and a check against the package's.
     */
    private fun diagnose(file: PsiFile, text: String): List<Finding> {
        val manifest = ProjectManifest.forFile(file) ?: return Lotek.diagnoseMarkup(text)
        return try {
            Lotek.diagnoseMarkup(text, manifest = manifest)
        } catch (unreadable: IllegalArgumentException) {
            ProjectManifest.rejectedBy(manifest, unreadable.message.orEmpty())
            Lotek.diagnoseMarkup(text)
        }
    }

    private fun severity(finding: Finding): HighlightSeverity =
        if (finding.severity == "error") HighlightSeverity.ERROR else HighlightSeverity.WARNING

    private fun tooltip(finding: Finding): String =
        "<html>${StringUtil.escapeXmlEntities(finding.message)}<br>" +
            "<a href=\"${StringUtil.escapeXmlEntities(finding.link)}\">LO-TEK: ${finding.rule}</a></html>"
}

/**
 * The fix the core suggests: one or more edits, each a replacement of the
 * text from `start` to `end`. They are applied from the end, so the
 * positions of the first ones hold when the last ones are done.
 *
 * The positions refer to the text as it was when the finding was made.
 * IntelliJ discards the annotations and runs the annotator again when the
 * text changes, so the fix offered always belongs to the latest pass.
 */
private class ReplaceFix(private val fix: Fix) : IntentionAction, PriorityAction {
    override fun getText(): String = fix.title

    override fun getFamilyName(): String = "LO-TEK"

    override fun getPriority(): PriorityAction.Priority =
        if (fix.preferred == true) PriorityAction.Priority.TOP else PriorityAction.Priority.NORMAL

    private val end: Int = fix.edits.maxOfOrNull { it.end } ?: 0

    override fun isAvailable(project: Project, editor: Editor?, file: PsiFile?): Boolean =
        file != null && end <= file.textLength

    override fun invoke(project: Project, editor: Editor?, file: PsiFile?) {
        if (file == null) return
        val document = PsiDocumentManager.getInstance(project).getDocument(file) ?: return
        if (end > document.textLength) return
        val injected = InjectedLanguageManager.getInstance(project)
        if (injected.isInjectedFragment(file)) {
            // An injected fragment: the document is the fragment's, with the
            // text as it is without escaping. An edit written straight into it
            // ends up unescaped in the host file, and `aria-label="…"` in a
            // "…" string in Kotlin broke the literal. Each edit is therefore
            // mapped to the host file and written through the host string's
            // manipulator, which escapes it. The whole fragment at once did
            // not work: a template like `$name` splits the fragment into
            // several parts of the string, and the placeholder was written in
            // place of `$name`.
            val hostFile = injected.getTopLevelFile(file)
            val hostDocument = PsiDocumentManager.getInstance(project).getDocument(hostFile) ?: return
            // All mapped before anything changes, and applied from the end in the host file.
            val targets =
                fix.edits
                    .map { injected.injectedToHost(file, TextRange(it.start, it.end)) to it.text }
                    .sortedByDescending { it.first.startOffset }
            for ((range, text) in targets) {
                PsiDocumentManager.getInstance(project).commitDocument(hostDocument)
                val at = hostFile.findElementAt(range.startOffset) ?: return
                val host =
                    PsiTreeUtil.getParentOfType(at, PsiLanguageInjectionHost::class.java, false) ?: return
                val inHost = ElementManipulators.getValueTextRange(host).shiftRight(host.textRange.startOffset)
                // We leave alone an edit that is not inside one part of the string.
                if (!inHost.contains(range)) return
                ElementManipulators.handleContentChange(host, range.shiftLeft(host.textRange.startOffset), text)
            }
            return
        }
        for (edit in fix.edits.sortedByDescending { it.start }) {
            document.replaceString(edit.start, edit.end, edit.text)
        }
        PsiDocumentManager.getInstance(project).commitDocument(document)
    }

    override fun startInWriteAction(): Boolean = true
}

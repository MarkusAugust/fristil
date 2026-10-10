package no.fristil.intellij

import com.intellij.codeInsight.intention.IntentionAction
import com.intellij.codeInsight.intention.PriorityAction
import com.intellij.lang.annotation.AnnotationHolder
import com.intellij.lang.annotation.Annotator
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.util.text.StringUtil
import com.intellij.psi.PsiDocumentManager
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.xml.XmlDocument
import no.fristil.Finding
import no.fristil.Fix
import no.fristil.Fristil

/**
 * Fristils feilmeldinger i editoren, fra den samme Rust-kjernen som
 * `fristil sjekk` og VS Code bruker.
 *
 * Kjernen kjøres av Chicory i IDE-ens egen JVM, via Maven-pakken i
 * `../kotlin`. Ingen Node, ingen prosess å starte.
 *
 * Et vanlig `Annotator`, ikke et `ExternalAnnotator`: IntelliJ kjører
 * annotatorer også på HTML som er injisert i en streng, og det er der
 * pluginen trengs mest. Den kalles for `XmlDocument`, som dekker hele
 * fragmentet, så kjernen leser hver fil én gang per gjennomgang.
 *
 * Sjekken er `diagnoseMarkup`, ikke `diagnosePage`: en fil eller et fragment
 * er en mal, og en id det pekes på kan godt stå i en annen mal. Den går mot
 * prosjektets manifest når det har et, se [ProjectManifest].
 */
class FristilAnnotator : Annotator {
    override fun annotate(element: PsiElement, holder: AnnotationHolder) {
        if (element !is XmlDocument) return
        val file = element.containingFile ?: return
        val text = file.text
        if (!text.contains("fs-")) return

        val bounds = element.textRange
        for (finding in diagnose(file, text)) {
            val range = TextRange(finding.start, maxOf(finding.end, finding.start))
            // Et funn utenfor dokumentet kan ikke festes til det.
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
     * Mot prosjektets manifest når det har et, ellers det innebygde. Et
     * manifest kjernen ikke kan lese, gir en advarsel i loggen og sjekk mot
     * det innebygde, som i språkserveren.
     */
    private fun diagnose(file: PsiFile, text: String): List<Finding> {
        val manifest = ProjectManifest.forFile(file) ?: return Fristil.diagnoseMarkup(text)
        return try {
            Fristil.diagnoseMarkup(text, manifest = manifest)
        } catch (unreadable: IllegalArgumentException) {
            ProjectManifest.rejectedBy(manifest, unreadable.message.orEmpty())
            Fristil.diagnoseMarkup(text)
        }
    }

    private fun severity(finding: Finding): HighlightSeverity =
        if (finding.severity == "error") HighlightSeverity.ERROR else HighlightSeverity.WARNING

    private fun tooltip(finding: Finding): String =
        "<html>${StringUtil.escapeXmlEntities(finding.message)}<br>" +
            "<a href=\"${StringUtil.escapeXmlEntities(finding.link)}\">Fristil: ${finding.rule}</a></html>"
}

/**
 * Rettelsen kjernen foreslår: bytt ut teksten fra `start` til `end`.
 *
 * Posisjonene gjelder teksten slik den var da funnet ble gjort. IntelliJ
 * kaster annotasjonene og kjører annotatoren på nytt når teksten endres, så
 * rettelsen som tilbys, hører alltid til den siste gjennomgangen.
 */
private class ReplaceFix(private val fix: Fix) : IntentionAction, PriorityAction {
    override fun getText(): String = fix.title

    override fun getFamilyName(): String = "Fristil"

    override fun getPriority(): PriorityAction.Priority =
        if (fix.preferred == true) PriorityAction.Priority.TOP else PriorityAction.Priority.NORMAL

    override fun isAvailable(project: Project, editor: Editor?, file: PsiFile?): Boolean =
        file != null && fix.end <= file.textLength

    override fun invoke(project: Project, editor: Editor?, file: PsiFile?) {
        if (file == null) return
        // For et injisert fragment er dette dokumentet til fragmentet, og
        // endringen havner på riktig sted i strengen i vertsfila.
        val document = PsiDocumentManager.getInstance(project).getDocument(file) ?: return
        if (fix.end > document.textLength) return
        document.replaceString(fix.start, fix.end, fix.text)
        PsiDocumentManager.getInstance(project).commitDocument(document)
    }

    override fun startInWriteAction(): Boolean = true
}

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
 * LO-TEKs feilmeldinger i editoren, fra den samme Rust-kjernen som
 * `lotek sjekk` og VS Code bruker.
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
class LotekAnnotator : Annotator {
    override fun annotate(element: PsiElement, holder: AnnotationHolder) {
        if (element !is XmlDocument) return
        val file = element.containingFile ?: return
        // Ingen snarvei på «lt-» i teksten: regelen icon-without-name gjelder
        // markup uten en eneste LO-TEK-klasse, og kjernen bruker
        // millisekunder på en fil. Med snarveien tidde IntelliJ om en
        // ikonknapp uten navn som `lotek sjekk` og VS Code meldte.
        val text = file.text

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
     * Mot prosjektets manifest når det har et, ellers manifestet i
     * Kotlin-pakken. Et manifest kjernen ikke kan lese, gir en advarsel i
     * loggen og sjekk mot pakkens.
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
 * Rettelsen kjernen foreslår: én eller flere endringer, hver et bytte av
 * teksten fra `start` til `end`. De brukes bakfra, så posisjonene i de
 * første holder når de siste er gjort.
 *
 * Posisjonene gjelder teksten slik den var da funnet ble gjort. IntelliJ
 * kaster annotasjonene og kjører annotatoren på nytt når teksten endres, så
 * rettelsen som tilbys, hører alltid til den siste gjennomgangen.
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
            // Et injisert fragment: dokumentet er fragmentets, med teksten
            // slik den er uten rømming. En endring skrevet rett i det havner
            // urømt i vertsfila, og `aria-label="…"` i en "…"-streng i Kotlin
            // brøt literalen. Hver endring regnes derfor om til vertsfila og
            // skrives gjennom vertsstrengens manipulator, som rømmer den.
            // Hele fragmentet på én gang holdt ikke: en mal som `$navn` deler
            // fragmentet i flere deler av strengen, og plassholderen ble
            // skrevet inn i stedet for `$navn`.
            val hostFile = injected.getTopLevelFile(file)
            val hostDocument = PsiDocumentManager.getInstance(project).getDocument(hostFile) ?: return
            // Alle omregnet før noe endres, og brukt bakfra i vertsfila.
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
                // En endring som ikke står inni én del av strengen, rører ikke vi.
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

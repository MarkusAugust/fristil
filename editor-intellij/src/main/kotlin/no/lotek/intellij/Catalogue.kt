package no.lotek.intellij

import com.intellij.psi.PsiFile
import no.lotek.Lotek
import no.lotek.Manifest

/**
 * A class from LO-TEK, as the editor shows it.
 *
 * @property name the class name, for example `lt-button`
 * @property component the component it belongs to, shown as detail in the list
 * @property description what the component is, shown in the documentation popup
 * @property link the address of the component page
 */
data class CatalogueClass(
    val name: String,
    val component: String,
    val description: String,
    val link: String,
)

/**
 * The classes LO-TEK ships.
 *
 * [classesFor] is the classes in the manifest the file is checked against:
 * the project's when it has one, otherwise [classes], the manifest in the
 * Kotlin package. It is the same manifest [LotekAnnotator] gives the core,
 * found by [ProjectManifest], so completion never suggests a class the
 * diagnostics reject, and it suggests the classes in components the project
 * has taken over. Completion used to read the package's manifest always,
 * while the annotator read the project's, and with an older package
 * installed a class was suggested and underlined right after.
 */
object Catalogue {
    /** The classes in the manifest in the Kotlin package. */
    val classes: List<CatalogueClass> by lazy { from(Lotek.manifest) }

    /** The classes in the manifest [file] is checked against, see [ProjectManifest]. */
    fun classesFor(file: PsiFile): List<CatalogueClass> = ProjectManifest.classesFor(file) ?: classes

    internal fun from(manifest: Manifest): List<CatalogueClass> =
        manifest.classes.values.map { CatalogueClass(it.name, it.title, it.description, it.link) }

    private val byName: Map<String, CatalogueClass> by lazy {
        classes.associateBy { it.name }
    }

    fun find(name: String): CatalogueClass? = byName[name]
}

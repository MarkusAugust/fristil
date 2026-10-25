package no.fristil.intellij

import com.intellij.codeInsight.template.TemplateManager
import com.intellij.codeInsight.template.impl.TemplateManagerImpl
import com.intellij.codeInsight.template.impl.TemplateSettings
import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * At live templates fra `designsystem/live-templates.xml` er med i pluginen,
 * én per web-komponent, og at id-en er en variabel som speiles i `for`.
 */
class LiveTemplateTest : BasePlatformTestCase() {
    fun `test har en mal per web-komponent`() {
        val maler = TemplateSettings.getInstance().templates.filter { it.groupName == "Fristil" }
        val navn = maler.map { it.key }.sorted()
        assertTrue("fant $navn", navn.containsAll(listOf("fs-dialog", "fs-field", "fs-popover", "fs-suggestion", "fs-tabs")))
    }

    fun `test feltet har id-en som variabel, speilet i for`() {
        val mal = TemplateSettings.getInstance().getTemplate("fs-field", "Fristil")
        assertNotNull("fs-field mangler", mal)
        val tekst = mal!!.string
        assertTrue("id-en skal være en variabel: $tekst", tekst.contains("id=\"\$navn\$\""))
        assertTrue("for skal speile den: $tekst", tekst.contains("for=\"\$navn\$\""))
        // Skjemaet rundt feltet har sin egen id, og den er også en variabel.
        assertTrue("variablene var ${mal.variables.map { it.name }}", mal.variables.map { it.name }.contains("navn"))
    }

    fun `test malen utvides i en HTML-fil`() {
        TemplateManagerImpl.setTemplateTesting(testRootDisposable)
        myFixture.configureByText("test.html", "<caret>")
        val mal = TemplateSettings.getInstance().getTemplate("fs-field", "Fristil")!!
        TemplateManager.getInstance(project).startTemplate(myFixture.editor, mal)
        val tekst = myFixture.editor.document.text
        assertTrue("markupen skal stå der: $tekst", tekst.contains("<fs-field>") && tekst.contains("id=\"navn\""))
        assertFalse("variabelen skal være byttet ut: $tekst", tekst.contains("\$navn\$"))
    }
}

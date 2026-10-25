rootProject.name = "lo-tek-interfaces"

// The extensions for kotlinx.html, as a separate package: the main package
// should not bring kotlinx.html to those who do not use it.
include("kotlinx-html")

// The CLI as `java -jar lotek.jar`, released as a file on GitHub. Maven has
// the ordinary jar, which the Gradle plugin depends on.
include("cli")

// The Gradle plugin, which runs the CLI in the build.
include("gradle-plugin")

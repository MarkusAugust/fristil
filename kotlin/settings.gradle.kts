rootProject.name = "fristil"

// Utvidelsene for kotlinx.html, som egen pakke: hovedpakken skal ikke ta med
// kotlinx.html til den som ikke bruker det.
include("kotlinx-html")

// Kommandolinja som `java -jar fristil.jar`, gitt ut som fil på GitHub. På
// Maven ligger den vanlige jar-en, som Gradle-pluginen avhenger av.
include("kommandolinje")

// Gradle-pluginen, som kjører kommandolinja i bygget.
include("gradle-plugin")

// Byggelogikken for Kotlin-pakken: generatoren som leser manifestet.
plugins {
    `kotlin-dsl`
}

repositories {
    mavenCentral()
}

dependencies {
    // Gjør WebAssembly-modulen om til JVM-bytekode når pakken bygges.
    implementation("com.dylibso.chicory:build-time-compiler:1.7.5")
}

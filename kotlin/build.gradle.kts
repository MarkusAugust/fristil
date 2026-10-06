import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.2.21"
}

group = "no.fristil"
version = "0.1.0"

repositories {
    mavenCentral()
}

dependencies {
    // Biblioteket har ingen avhengigheter. JSON trengs bare for å lese
    // kontrakten i testene.
    testImplementation(kotlin("test"))
    testImplementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_21) }
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

/*
 * Kontrakten ligger i `contract/cases.json` ved roten av repoet, skrevet av
 * `designsystem/scripts/generate-contract.ts`. Testene leser den derfra, og
 * Gradle får vite om fila, så en ny kontrakt kjører testene på nytt.
 */
val contract = rootDir.resolve("../contract/cases.json")

tasks.test {
    useJUnitPlatform()
    inputs.file(contract)
    systemProperty("fristil.contract", contract.absolutePath)
}

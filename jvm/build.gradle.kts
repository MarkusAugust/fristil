import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.2.21"
}

group = "no.fristil"
version = "0.1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

/*
 * QuickJs4J kjører QuickJS kompilert til WebAssembly og videre til vanlig
 * Java-bytekode. Ingen JNI, ingen Node, ingen runtime å installere: det er en
 * Maven-avhengighet som virker der JVM-en virker.
 */
dependencies {
    implementation("io.roastedroot:quickjs4j:0.1.0")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.22.0")
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter-params:5.13.4")
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

// Java 17 som laveste nivå: det dekker LTS-versjonene de fleste team står på.
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events("passed", "failed")
        showStandardStreams = true
    }
}

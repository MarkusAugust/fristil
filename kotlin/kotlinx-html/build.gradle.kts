import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm")
}

// Same version and group as the main package: io.github.markusaugust:lo-tek-kotlinx-html.
group = rootProject.group
version = rootProject.version
base.archivesName = "lo-tek-kotlinx-html"

repositories {
    mavenCentral()
}

dependencies {
    api(project(":"))
    api("org.jetbrains.kotlinx:kotlinx-html-jvm:0.12.0")
    testImplementation(kotlin("test"))
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.test {
    useJUnitPlatform()
    testLogging { events("failed") }
}

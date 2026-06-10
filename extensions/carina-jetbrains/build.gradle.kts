plugins {
    id("java")
    id("org.jetbrains.intellij") version "1.17.4"
}

group = "uk.verlox.carina"
version = "0.1.0"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.google.code.gson:gson:2.11.0")
}

intellij {
    version.set("2024.1")
    type.set("IC")
    plugins.set(listOf())
}

tasks {
    patchPluginXml {
        sinceBuild.set("241")
        untilBuild.set("252.*")
    }

    buildSearchableOptions {
        enabled = false
    }

    runIde {
        enabled = true
    }
}

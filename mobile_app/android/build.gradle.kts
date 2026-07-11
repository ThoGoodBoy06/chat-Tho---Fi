import com.android.build.gradle.BaseExtension

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

subprojects {
    val configureNamespace = {
        if (plugins.hasPlugin("com.android.library") || plugins.hasPlugin("com.android.application")) {
            val android = extensions.findByName("android") as? BaseExtension
            if (android != null && android.namespace == null) {
                var packageName: String? = null
                val manifestFile = project.file("src/main/AndroidManifest.xml")
                if (manifestFile.exists()) {
                    try {
                        val parser = javax.xml.parsers.DocumentBuilderFactory.newInstance().newDocumentBuilder()
                        val doc = parser.parse(manifestFile)
                        val manifestNode = doc.getElementsByTagName("manifest").item(0)
                        packageName = manifestNode?.attributes?.getNamedItem("package")?.nodeValue
                    } catch (e: Exception) {
                        println("⚠️ Failed to parse package from Manifest for project ${project.name}: ${e.message}")
                    }
                }
                android.namespace = packageName ?: "com.thofi.injected.${project.name.replace(":", "").replace("-", "_")}"
                println("🔧 Injected namespace for project ${project.name}: ${android.namespace}")
            }
        }
    }
    if (project.state.executed) {
        configureNamespace()
    } else {
        project.afterEvaluate {
            configureNamespace()
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

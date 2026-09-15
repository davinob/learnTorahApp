import com.github.triplet.gradle.androidpublisher.ReleaseStatus
import java.io.File
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
    id("com.github.triplet.play") version "3.12.1"
}

val localProps: Properties = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

fun signingProp(key: String): String {
    val fromEnv = System.getenv(key)?.takeIf { it.isNotBlank() }
    val fromProps = localProps.getProperty(key)?.takeIf { it.isNotBlank() }
    return fromEnv ?: fromProps
        ?: error("Missing signing property '$key'. Add it to android/local.properties or set the env var.")
}

val playApiKeyFile: File? = run {
    val fromEnv = System.getenv("GOOGLE_PLAY_API_KEY")?.takeIf { it.isNotBlank() }
    val fromProps = localProps.getProperty("googlePlayApiKey")?.takeIf { it.isNotBlank() }
    listOfNotNull(fromEnv, fromProps).map { File(it) }.firstOrNull { it.exists() }
}

android {
    namespace = "learn.torah"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "learn.torah"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            storeFile = file(signingProp("KEYSTORE_FILE"))
            storePassword = signingProp("KEYSTORE_PASSWORD")
            keyAlias = signingProp("KEY_ALIAS")
            keyPassword = signingProp("KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

flutter {
    source = "../.."
}

play {
    if (playApiKeyFile != null) {
        serviceAccountCredentials.set(playApiKeyFile)
    } else {
        enabled.set(false)
    }
    defaultToAppBundles.set(true)
    track.set("production")
    releaseStatus.set(ReleaseStatus.COMPLETED)
    resolutionStrategy.set(com.github.triplet.gradle.androidpublisher.ResolutionStrategy.FAIL)
}

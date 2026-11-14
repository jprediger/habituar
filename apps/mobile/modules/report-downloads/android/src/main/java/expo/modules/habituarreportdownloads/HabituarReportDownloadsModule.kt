package expo.modules.habituarreportdownloads

import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.IOException

class HabituarReportDownloadsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HabituarReportDownloads")

    AsyncFunction("savePdfToDownloads") { sourceUri: String, filename: String ->
      check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        "Direct PDF downloads require Android 10 or later."
      }
      val context = checkNotNull(appContext.reactContext) {
        "Android context is unavailable."
      }

      val parsedUri = Uri.parse(sourceUri)
      require(parsedUri.scheme == "file") { "A local PDF file is required." }
      val sourceFile = File(checkNotNull(parsedUri.path)).canonicalFile
      val cachePrefix = context.cacheDir.canonicalPath + File.separator
      require(sourceFile.path.startsWith(cachePrefix) && sourceFile.isFile) {
        "The PDF must be in the app cache."
      }

      val displayName = filename
        .replace(Regex("[^A-Za-z0-9._-]"), "_")
        .trimStart('.')
        .ifBlank { "relatorio.pdf" }
        .let { if (it.endsWith(".pdf", ignoreCase = true)) it else "$it.pdf" }

      val resolver = context.contentResolver
      val values = ContentValues().apply {
        put(MediaStore.Downloads.DISPLAY_NAME, displayName)
        put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/")
        put(MediaStore.Downloads.IS_PENDING, 1)
      }
      val destination = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        ?: throw IOException("Unable to create PDF in Downloads.")

      try {
        val output = resolver.openOutputStream(destination, "w")
          ?: throw IOException("Unable to write PDF in Downloads.")
        FileInputStream(sourceFile).use { input ->
          output.use { input.copyTo(it) }
        }
        val completed = ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }
        if (resolver.update(destination, completed, null, null) != 1) {
          throw IOException("Unable to publish PDF in Downloads.")
        }
      } catch (error: Exception) {
        runCatching { resolver.delete(destination, null, null) }
        throw error
      }

      destination.toString()
    }

    AsyncFunction("openPdfFromDownloads") { uriString: String ->
      val pdfUri = Uri.parse(uriString)
      require(pdfUri.scheme == "content" && pdfUri.authority == MediaStore.AUTHORITY) {
        "A PDF saved in Downloads is required."
      }
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(pdfUri, "application/pdf")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      try {
        activity.startActivity(intent)
        true
      } catch (_: ActivityNotFoundException) {
        false
      } catch (_: SecurityException) {
        false
      }
    }.runOnQueue(Queues.MAIN)
  }
}

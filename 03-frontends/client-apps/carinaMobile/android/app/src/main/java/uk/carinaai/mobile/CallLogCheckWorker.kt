package uk.carinaai.mobile

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class CallLogCheckWorker(
  appContext: Context,
  params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result {
    return try {
      CallLogRelay(applicationContext).checkMissedCalls()
      Result.success()
    } catch (_: Exception) {
      Result.retry()
    }
  }
}

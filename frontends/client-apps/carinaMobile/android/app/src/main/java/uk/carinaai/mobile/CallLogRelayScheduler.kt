package uk.carinaai.mobile

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object CallLogRelayScheduler {
  private const val WORK_NAME = "carina_call_log_relay"

  fun schedule(context: Context) {
    val request = PeriodicWorkRequestBuilder<CallLogCheckWorker>(30, TimeUnit.MINUTES).build()
    WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
      WORK_NAME,
      ExistingPeriodicWorkPolicy.UPDATE,
      request,
    )
  }

  fun cancel(context: Context) {
    WorkManager.getInstance(context.applicationContext).cancelUniqueWork(WORK_NAME)
  }
}

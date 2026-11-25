package com.auctechmarcom.aucwin.calllog

import android.provider.CallLog
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads the device call log so the CRM can tell whether an outbound call was
 * answered and how long it lasted. Android only. Requires READ_CALL_LOG.
 */
class AucwinCallLogModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AucwinCallLog")

    // Returns up to `limit` most-recent calls, newest first, as
    // [{ phoneNumber, duration (seconds), type, timestamp (ms) }].
    // type 2 == OUTGOING. duration > 0 on an OUTGOING call means it was answered.
    AsyncFunction("recent") { limit: Int ->
      val context = appContext.reactContext
        ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val projection = arrayOf(
        CallLog.Calls.NUMBER,
        CallLog.Calls.DURATION,
        CallLog.Calls.TYPE,
        CallLog.Calls.DATE
      )
      val out = ArrayList<Map<String, Any>>()
      val max = if (limit > 0) limit else 30
      context.contentResolver.query(
        CallLog.Calls.CONTENT_URI,
        projection,
        null,
        null,
        CallLog.Calls.DATE + " DESC"
      )?.use { cursor ->
        var count = 0
        while (cursor.moveToNext() && count < max) {
          out.add(
            mapOf(
              "phoneNumber" to (cursor.getString(0) ?: ""),
              "duration" to cursor.getLong(1),
              "type" to cursor.getInt(2),
              "timestamp" to cursor.getLong(3)
            )
          )
          count++
        }
      }
      out
    }

    // Add the call the agent just started to the queue, so the background
    // receiver (or the next app open) can record its outcome. kind = "lead" | "client".
    AsyncFunction("armCall") { leadId: String, kind: String, number: String, apiUrl: String, token: String ->
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      CallPending.arm(ctx, leadId, kind, number, apiUrl, token)
      true
    }

    // Refresh the API url + auth token on every queued call (before a retry).
    AsyncFunction("refreshAuth") { apiUrl: String, token: String ->
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      CallPending.refreshAuth(ctx, apiUrl, token)
      true
    }

    // Reconcile the whole queue now (JS calls this on app open). Returns a short
    // status string. Runs off the main thread.
    AsyncFunction("flushPending") {
      val ctx = appContext.reactContext ?: return@AsyncFunction "none"
      CallPending.process(ctx)
    }
  }
}

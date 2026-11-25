package com.auctechmarcom.aucwin.calllog

import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * A QUEUE of "pending calls" the agent has started. Once a call ends, the queue
 * is reconciled against the device call log: each pending entry is matched to
 * its own call-log entry (by number + time), the outcome + talk time is posted
 * to the CRM, and the entry is removed. A queue (not a single slot) means
 * rapid back-to-back dialing never loses a call.
 *
 * Used by:
 *   - CallEndReceiver: runs in the BACKGROUND the moment a call ends.
 *   - AucwinCallLogModule.flushPending(): JS triggers a reconcile on app open
 *     (safety net for when the app was force-stopped and the receiver missed it).
 */
object CallPending {
  private const val PREFS = "aucwin_call_pending"
  private const val KEY = "queue"

  private fun prefs(ctx: Context) =
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun loadQueue(ctx: Context): JSONArray {
    return try {
      JSONArray(prefs(ctx).getString(KEY, "[]") ?: "[]")
    } catch (e: Exception) {
      JSONArray()
    }
  }

  private fun saveQueue(ctx: Context, arr: JSONArray) {
    prefs(ctx).edit().putString(KEY, arr.toString()).apply()
  }

  /** Add a call the agent just started to the queue. kind = "lead" | "client". */
  fun arm(
    ctx: Context,
    leadId: String,
    kind: String,
    number: String,
    apiUrl: String,
    token: String,
  ) {
    val arr = loadQueue(ctx)
    arr.put(
      JSONObject()
        .put("leadId", leadId)
        .put("kind", kind)
        .put("number", number)
        .put("apiUrl", apiUrl)
        .put("token", token)
        .put("startedAt", System.currentTimeMillis()),
    )
    saveQueue(ctx, arr)
  }

  /** Refresh the API url + auth token on every queued entry (called on app open,
   *  so a retry uses a fresh, non-expired token). */
  fun refreshAuth(ctx: Context, apiUrl: String, token: String) {
    val arr = loadQueue(ctx)
    for (i in 0 until arr.length()) {
      val e = arr.getJSONObject(i)
      if (apiUrl.isNotEmpty()) e.put("apiUrl", apiUrl)
      if (token.isNotEmpty()) e.put("token", token)
    }
    saveQueue(ctx, arr)
  }

  fun clearAll(ctx: Context) {
    prefs(ctx).edit().remove(KEY).apply()
  }

  private fun last9(s: String?): String {
    val d = (s ?: "").filter { it.isDigit() }
    return if (d.length <= 9) d else d.substring(d.length - 9)
  }

  private data class CallRow(val ts: Long, val dur: Long, val num: String)

  private fun readOutgoing(ctx: Context): List<CallRow> {
    val out = ArrayList<CallRow>()
    ctx.contentResolver.query(
      CallLog.Calls.CONTENT_URI,
      arrayOf(
        CallLog.Calls.NUMBER,
        CallLog.Calls.DURATION,
        CallLog.Calls.TYPE,
        CallLog.Calls.DATE,
      ),
      null,
      null,
      CallLog.Calls.DATE + " DESC",
    )?.use { c ->
      var count = 0
      while (c.moveToNext() && count < 40) {
        count++
        if (c.getInt(2) != CallLog.Calls.OUTGOING_TYPE) continue
        out.add(CallRow(c.getLong(3), c.getLong(1), last9(c.getString(0))))
      }
    }
    return out
  }

  /**
   * Reconcile the whole queue against the call log. Matched entries are posted
   * and removed; unmatched ones stay for next time. Returns a short status
   * string for debugging. Drops entries older than 24h so the queue can't grow
   * forever.
   */
  fun process(ctx: Context): String {
    var arr = loadQueue(ctx)
    if (arr.length() == 0) return "none"
    if (ctx.checkSelfPermission(android.Manifest.permission.READ_CALL_LOG)
      != PackageManager.PERMISSION_GRANTED
    ) {
      return "no-permission"
    }

    // Collect entries, dropping stale ones (older than 24h).
    val now = System.currentTimeMillis()
    val entries = ArrayList<JSONObject>()
    for (i in 0 until arr.length()) {
      val e = arr.getJSONObject(i)
      if (now - e.optLong("startedAt", 0) > 24L * 3600 * 1000) continue
      entries.add(e)
    }
    entries.sortBy { it.optLong("startedAt", 0) } // oldest first

    val postedIdx = HashSet<Int>()
    val summary = StringBuilder()

    // The OS writes the call-log entry a moment after the call ends, so retry.
    for (attempt in 0 until 4) {
      val calls = readOutgoing(ctx)
      val usedTs = HashSet<Long>()
      for ((idx, e) in entries.withIndex()) {
        if (postedIdx.contains(idx)) continue
        val want = last9(e.optString("number"))
        val startedAt = e.optLong("startedAt", 0)
        // Prefer the earliest unused OUTGOING call to the dialed number after
        // this entry was armed; fall back to the earliest unused outgoing call.
        var pick: CallRow? = null
        for (c in calls) {
          if (usedTs.contains(c.ts)) continue
          if (c.ts < startedAt - 60000) continue
          if (want.isNotEmpty() && c.num.isNotEmpty() && c.num != want) continue
          if (pick == null || c.ts < pick!!.ts) pick = c
        }
        if (pick == null) {
          for (c in calls) {
            if (usedTs.contains(c.ts)) continue
            if (c.ts < startedAt - 60000) continue
            if (pick == null || c.ts < pick!!.ts) pick = c
          }
        }
        val chosen = pick ?: continue
        usedTs.add(chosen.ts)
        val outcome = if (chosen.dur > 0) "answered" else "not_answered"
        val path = if (e.optString("kind", "lead") == "client") "clients" else "leads"
        val body = JSONObject()
          .put("outcome", outcome)
          .put("duration_seconds", chosen.dur)
          .put("call_ts", chosen.ts)
          .toString()
        val ok = post(
          "${e.optString("apiUrl")}/api/$path/${e.optString("leadId")}/log-call",
          e.optString("token"),
          body,
        )
        if (ok) {
          postedIdx.add(idx)
          summary.append("$outcome:${chosen.dur};")
        }
      }
      if (postedIdx.size == entries.size) break
      try {
        Thread.sleep(1200)
      } catch (_: InterruptedException) {
      }
    }

    // Save back only the entries we could NOT post yet.
    val remaining = JSONArray()
    for ((idx, e) in entries.withIndex()) if (!postedIdx.contains(idx)) remaining.put(e)
    saveQueue(ctx, remaining)
    return if (summary.isEmpty()) "no-match" else summary.toString()
  }

  private fun post(urlStr: String, token: String, body: String): Boolean {
    return try {
      val con = URL(urlStr).openConnection() as HttpURLConnection
      con.requestMethod = "POST"
      con.connectTimeout = 10000
      con.readTimeout = 10000
      con.doOutput = true
      con.setRequestProperty("Content-Type", "application/json")
      con.setRequestProperty("Accept", "application/json")
      if (token.isNotEmpty()) con.setRequestProperty("Authorization", "Bearer $token")
      con.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
      val code = con.responseCode
      con.disconnect()
      code in 200..299
    } catch (e: Exception) {
      false
    }
  }
}

package com.auctechmarcom.aucwin.calllog

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager

/**
 * Fires on every phone-state change. When an outbound call ends (the state goes
 * OFFHOOK -> IDLE), it records the pending CRM call in the background — so the
 * agent does not need to return to the app for the outcome to be saved.
 *
 * Note: Android cannot deliver this broadcast while the app is Force-Stopped;
 * in that case the on-open reconcile (JS) records the call next time the app
 * is opened.
 */
class CallEndReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != "android.intent.action.PHONE_STATE") return
    val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
    when (state) {
      TelephonyManager.EXTRA_STATE_OFFHOOK -> {
        sawOffhook = true
      }
      TelephonyManager.EXTRA_STATE_IDLE -> {
        if (!sawOffhook) return
        sawOffhook = false
        val pending = goAsync()
        val appCtx = context.applicationContext
        Thread {
          try {
            CallPending.process(appCtx)
          } catch (_: Exception) {
          } finally {
            pending.finish()
          }
        }.start()
      }
    }
  }

  companion object {
    @Volatile
    private var sawOffhook = false
  }
}

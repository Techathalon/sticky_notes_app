package com.stickynotes.app

import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class OverlayPermissionModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OverlayPermission"

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                promise.resolve(Settings.canDrawOverlays(reactContext))
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openOverlaySettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${reactContext.packageName}")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun canUseFullScreenIntent(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                val nm = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                promise.resolve(nm?.canUseFullScreenIntent() ?: true)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun openFullScreenIntentSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                    Uri.parse("package:${reactContext.packageName}")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val pm = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
                val isIgnoring = pm?.isIgnoringBatteryOptimizations(reactContext.packageName) == true
                if (!isIgnoring) {
                    val intent = Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:${reactContext.packageName}")
                    ).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactContext.startActivity(intent)
                    promise.resolve(true)
                    return
                }
            }
            promise.resolve(false)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun isDeviceLocked(promise: Promise) {
        try {
            val km = reactContext.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            promise.resolve(km?.isDeviceLocked ?: false)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun moveTaskToBackground(promise: Promise) {
        try {
            reactContext.currentActivity?.moveTaskToBack(true)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun launchAlarmScreen(title: String, type: String, alarmId: String, alarmAt: String, promise: Promise) {
        try {
            val intent = Intent(reactContext, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = Uri.parse(
                    "stickynotes://alarm-screen?title=${Uri.encode(title)}&type=${Uri.encode(type)}&alarmId=${Uri.encode(alarmId)}&alarmAt=${Uri.encode(alarmAt)}"
                )
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            reactContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setAlarmsEnabled(enabled: Boolean, promise: Promise) {
        promise.resolve(null)
    }
}

package app.goosle

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Settings

/**
 * Turns the whole screen black and white while a watched app is open.
 *
 * Android only lets an app change this setting after a one-time permission
 * grant from a computer (adb), since there's no on-phone switch for it:
 *   adb shell pm grant app.goosle android.permission.WRITE_SECURE_SETTINGS
 */
object Grayscale {
    const val ADB_COMMAND = "adb shell pm grant app.goosle android.permission.WRITE_SECURE_SETTINGS"

    private const val ENABLED = "accessibility_display_daltonizer_enabled"
    private const val MODE = "accessibility_display_daltonizer"
    private const val MONOCHROME = 0

    private var turnedOnByUs = false

    fun canControl(context: Context) =
        context.checkSelfPermission(Manifest.permission.WRITE_SECURE_SETTINGS) == PackageManager.PERMISSION_GRANTED

    fun set(context: Context, on: Boolean) {
        if (!canControl(context)) return
        val cr = context.contentResolver
        try {
            if (on) {
                val alreadyOn = Settings.Secure.getInt(cr, ENABLED, 0) == 1 && Settings.Secure.getInt(cr, MODE, -1) == MONOCHROME
                if (alreadyOn) return
                Settings.Secure.putInt(cr, MODE, MONOCHROME)
                Settings.Secure.putInt(cr, ENABLED, 1)
                turnedOnByUs = true
            } else if (turnedOnByUs) {
                Settings.Secure.putInt(cr, ENABLED, 0)
                turnedOnByUs = false
            }
        } catch (_: SecurityException) {
            // Permission was revoked; nothing to do.
        }
    }
}

package app.goosle

import android.content.Context
import android.content.SharedPreferences
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/** All settings and usage counters, stored on the phone only. */
class Prefs(context: Context) {
    private val sp: SharedPreferences =
        context.applicationContext.getSharedPreferences("goosle", Context.MODE_PRIVATE)

    fun listen(l: SharedPreferences.OnSharedPreferenceChangeListener) = sp.registerOnSharedPreferenceChangeListener(l)
    fun unlisten(l: SharedPreferences.OnSharedPreferenceChangeListener) = sp.unregisterOnSharedPreferenceChangeListener(l)

    private fun list(key: String): List<String> =
        sp.getString(key, null)?.split('\n')?.map { it.trim() }?.filter { it.isNotEmpty() } ?: emptyList()

    private fun putList(key: String, v: List<String>) = sp.edit().putString(key, v.joinToString("\n")).apply()

    /* ---------------- Master switch ---------------- */

    var enabled: Boolean
        get() = sp.getBoolean("enabled", true)
        set(v) = sp.edit().putBoolean("enabled", v).apply()

    /* ---------------- Per-app ---------------- */

    fun mode(app: TargetApp): AppMode =
        sp.getString("mode.${app.key}", null)?.let { runCatching { AppMode.valueOf(it) }.getOrNull() } ?: app.defaultMode

    fun setMode(app: TargetApp, mode: AppMode) = sp.edit().putString("mode.${app.key}", mode.name).apply()

    /** Ask "what are you here for?" when opening the app. */
    fun askIntention(app: TargetApp): Boolean = sp.getBoolean("intention.${app.key}", app == Apps.YOUTUBE)
    fun setAskIntention(app: TargetApp, v: Boolean) = sp.edit().putBoolean("intention.${app.key}", v).apply()

    /** Extra short-form view IDs added in the Detection helper. */
    fun extraShortFormIds(app: TargetApp): List<String> = list("extraIds.${app.key}")
    fun setExtraShortFormIds(app: TargetApp, ids: List<String>) = putList("extraIds.${app.key}", ids)

    /* ---------------- Weekly focus ---------------- */

    var focusTopics: List<String>
        get() = list("focus.topics")
        set(v) {
            putList("focus.topics", v)
            sp.edit().putString("focus.setOn", LocalDate.now().toString()).apply()
        }

    val focusSetOn: LocalDate?
        get() = sp.getString("focus.setOn", null)?.let { runCatching { LocalDate.parse(it) }.getOrNull() }

    val focusIsStale: Boolean
        get() = focusTopics.isEmpty() || focusSetOn?.let { ChronoUnit.DAYS.between(it, LocalDate.now()) >= 7 } ?: true

    /* ---------------- Breaks and limits ---------------- */

    var breaksEnabled: Boolean
        get() = sp.getBoolean("breaks.enabled", true)
        set(v) = sp.edit().putBoolean("breaks.enabled", v).apply()

    var breakEveryMinutes: Int
        get() = sp.getInt("breaks.every", 20)
        set(v) = sp.edit().putInt("breaks.every", v).apply()

    var breakSeconds: Int
        get() = sp.getInt("breaks.seconds", 60)
        set(v) = sp.edit().putInt("breaks.seconds", v).apply()

    var dailyLimitMinutes: Int
        get() = sp.getInt("limit.minutes", 60)
        set(v) = sp.edit().putInt("limit.minutes", v).apply()

    /* ---------------- Other ---------------- */

    var grayscale: Boolean
        get() = sp.getBoolean("grayscale", true)
        set(v) = sp.edit().putBoolean("grayscale", v).apply()

    var skipAds: Boolean
        get() = sp.getBoolean("skipAds", true)
        set(v) = sp.edit().putBoolean("skipAds", v).apply()

    var recordIds: Boolean
        get() = sp.getBoolean("debug.record", false)
        set(v) = sp.edit().putBoolean("debug.record", v).apply()

    var recordedIds: List<String>
        get() = list("debug.ids")
        set(v) = putList("debug.ids", v.takeLast(300))

    /* ---------------- Usage (per day, per app) ---------------- */

    private fun today() = LocalDate.now().toString()

    private fun usageKey(app: TargetApp, what: String) = "usage.${today()}.${app.key}.$what"

    fun todaySeconds(app: TargetApp): Int = sp.getInt(usageKey(app, "today"), 0)
    fun sessionSeconds(app: TargetApp): Int = sp.getInt("session.${app.key}", 0)
    fun bonusSeconds(app: TargetApp): Int = sp.getInt(usageKey(app, "bonus"), 0)

    fun addTime(app: TargetApp, seconds: Int) {
        sp.edit()
            .putInt(usageKey(app, "today"), todaySeconds(app) + seconds)
            .putInt("session.${app.key}", sessionSeconds(app) + seconds)
            .putLong("lastSeen.${app.key}", System.currentTimeMillis())
            .apply()
    }

    fun lastSeen(app: TargetApp): Long = sp.getLong("lastSeen.${app.key}", 0)

    fun resetSession(app: TargetApp) = sp.edit().putInt("session.${app.key}", 0).apply()

    fun addBonus(app: TargetApp, seconds: Int) =
        sp.edit().putInt(usageKey(app, "bonus"), bonusSeconds(app) + seconds).apply()

    /** Removes usage counters from earlier days. */
    fun pruneOldUsage() {
        val prefix = "usage.${today()}."
        val e = sp.edit()
        sp.all.keys.filter { it.startsWith("usage.") && !it.startsWith(prefix) }.forEach { e.remove(it) }
        e.apply()
    }
}

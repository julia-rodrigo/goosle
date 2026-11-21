package app.goosle

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.graphics.Rect
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Watches which app is on screen and what screen it's showing.
 *
 * - Leaves Shorts/Reels screens (presses Back) when an app is set to "No Shorts / Reels".
 * - Covers blocked apps.
 * - Counts time per app and shows break reminders and the daily limit.
 * - Asks "what are you here for?" when you open an app, with this week's focus topics.
 * - Taps YouTube's "Skip ad" button as soon as it appears.
 * - Turns the screen grey while a watched app is open (if permitted).
 *
 * Nothing leaves the phone.
 */
class GoosleService : AccessibilityService() {
    private lateinit var prefs: Prefs
    private lateinit var overlays: Overlays
    private val handler = Handler(Looper.getMainLooper())

    private var currentApp: TargetApp? = null
    private var lastContentCheck = 0L
    private var lastBack = 0L
    private var lastRecord = 0L
    private var breakShownAt = 0L

    private val tick = object : Runnable {
        override fun run() {
            onTick()
            handler.postDelayed(this, TICK_MS)
        }
    }

    override fun onServiceConnected() {
        prefs = Prefs(this)
        overlays = Overlays(this)
        prefs.pruneOldUsage()
        handler.postDelayed(tick, TICK_MS)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        if (::overlays.isInitialized) overlays.dismissAll()
        Grayscale.set(this, false)
        super.onDestroy()
    }

    override fun onInterrupt() {}

    /* ---------------------------------------------------------------- */
    /* Events                                                            */
    /* ---------------------------------------------------------------- */

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (!::prefs.isInitialized) return
        val pkg = event.packageName?.toString() ?: return
        if (isTransient(pkg)) return

        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) foregroundChanged(pkg)

        val app = Apps.forPackage(pkg) ?: return
        if (!prefs.enabled) {
            overlays.dismissAll()
            return
        }
        val now = System.currentTimeMillis()
        if (now - lastContentCheck < 120) return
        lastContentCheck = now
        rootInActiveWindow?.let { checkScreen(app, pkg, it) }
    }

    /** Windows that pop up over an app without really leaving it. */
    private fun isTransient(pkg: String) =
        pkg == packageName || pkg == "com.android.systemui" || pkg.contains("inputmethod") || pkg.contains("keyboard")

    private fun foregroundChanged(pkg: String) {
        val app = Apps.forPackage(pkg)
        if (app == currentApp) return
        val left = currentApp
        currentApp = app

        if (left != null) {
            overlays.setCovers(emptyList())
            if (overlays.ownerKey == left.key) overlays.dismiss()
            Grayscale.set(this, false)
        }
        if (app == null || !prefs.enabled) return

        if (prefs.grayscale) Grayscale.set(this, true)

        if (prefs.mode(app) == AppMode.BLOCK) {
            overlays.showBlocked(app, ::goHome)
            return
        }

        val awayMs = System.currentTimeMillis() - prefs.lastSeen(app)
        // Five minutes away counts as a natural break, and so does sitting out a break screen.
        if (awayMs > SESSION_GAP_MS || (breakShownAt > 0 && awayMs >= prefs.breakSeconds * 1000L)) {
            prefs.resetSession(app)
            breakShownAt = 0
        }
        if (checkLimits(app)) return

        if (prefs.askIntention(app) && awayMs > INTENTION_GAP_MS) {
            overlays.showIntention(
                app,
                prefs.focusTopics,
                onTopic = { openSearch(app, it) },
                onContinue = { prefs.addTime(app, 0) },
                onHome = ::goHome,
            )
        }
    }

    /* ---------------------------------------------------------------- */
    /* Screen content                                                    */
    /* ---------------------------------------------------------------- */

    private fun checkScreen(app: TargetApp, pkg: String, root: AccessibilityNodeInfo) {
        val mode = prefs.mode(app)
        if (mode == AppMode.BLOCK) {
            overlays.setCovers(emptyList())
            if (!overlays.isShowing) overlays.showBlocked(app, ::goHome)
            return
        }

        if (mode == AppMode.NO_SHORT_FORM || prefs.hideSlop) hideContent(app, pkg, root, mode == AppMode.NO_SHORT_FORM)
        else overlays.setCovers(emptyList())

        if (app == Apps.YOUTUBE && prefs.skipAds) skipAd(root, pkg)

        if (prefs.recordIds) recordIds(root)
    }

    private fun visible(root: AccessibilityNodeInfo, pkg: String, id: String): Boolean {
        val fullId = if (id.contains(":id/")) id else "$pkg:id/$id"
        return root.findAccessibilityNodeInfosByViewId(fullId).any { it.isVisibleToUser }
    }

    /**
     * Paints over every Shorts/Reels entry point and AI-slop item on screen so it can't be seen or tapped,
     * and blocks the whole screen if a Shorts/Reels player opens anyway (from a link, say).
     */
    private fun hideContent(app: TargetApp, pkg: String, root: AccessibilityNodeInfo, shortForm: Boolean) {
        val screen = Rect().also { root.getBoundsInScreen(it) }
        if (screen.isEmpty) return
        val result = Hider.scan(
            app, pkg, root, screen, prefs.extraShortFormIds(app),
            shortForm = shortForm,
            slopWords = if (prefs.hideSlop) prefs.slopWords else emptyList(),
        )

        if (result.playerOpen) {
            overlays.setCovers(emptyList())
            if (overlays.kind != "shortform") {
                overlays.showShortFormBlocked(app, onBack = { performGlobalAction(GLOBAL_ACTION_BACK) }, onHome = ::goHome)
                // Try to leave on its own; the block stays up until the player is really gone.
                val now = System.currentTimeMillis()
                if (now - lastBack > 1200) {
                    lastBack = now
                    performGlobalAction(GLOBAL_ACTION_BACK)
                }
            }
        } else {
            if (overlays.kind == "shortform" && overlays.ownerKey == app.key) overlays.dismiss()
            overlays.setCovers(result.covers)
        }
    }

    private fun skipAd(root: AccessibilityNodeInfo, pkg: String) {
        val candidates = listOf("skip_ad_button", "modern_skip_ad_text", "skip_ad_button_container")
            .flatMap { root.findAccessibilityNodeInfosByViewId("$pkg:id/$it") } +
            root.findAccessibilityNodeInfosByText("Skip").filter { it.viewIdResourceName?.contains("skip", true) == true }
        for (node in candidates) {
            var n: AccessibilityNodeInfo? = node
            while (n != null && !n.isClickable) n = n.parent
            if (n != null && n.isVisibleToUser && n.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return
        }
    }

    /** Detection helper: remembers view IDs seen in watched apps so new Shorts/Reels screens can be identified. */
    private fun recordIds(root: AccessibilityNodeInfo) {
        val now = System.currentTimeMillis()
        if (now - lastRecord < 2000) return
        lastRecord = now
        val found = LinkedHashSet<String>()
        fun walk(n: AccessibilityNodeInfo?, depth: Int) {
            if (n == null || depth > 40 || found.size > 400) return
            n.viewIdResourceName?.let { if (n.isVisibleToUser) found.add(it) }
            for (i in 0 until n.childCount) walk(n.getChild(i), depth + 1)
        }
        walk(root, 0)
        if (found.isEmpty()) return
        val existing = prefs.recordedIds
        val merged = (existing.filterNot { it in found } + found)
        if (merged != existing) prefs.recordedIds = merged
    }

    /* ---------------------------------------------------------------- */
    /* Time, breaks, limits                                              */
    /* ---------------------------------------------------------------- */

    private fun onTick() {
        if (!::prefs.isInitialized || !prefs.enabled) return
        if (!getSystemService(PowerManager::class.java).isInteractive) return

        // Re-check what's on screen in case a window event was missed.
        rootInActiveWindow?.packageName?.toString()?.let { if (!isTransient(it)) foregroundChanged(it) }

        val app = currentApp ?: return
        if (prefs.mode(app) == AppMode.BLOCK) return
        if (overlays.isShowing && overlays.ownerKey == app.key && overlays.kind != "shortform") return

        prefs.addTime(app, (TICK_MS / 1000).toInt())
        if (checkLimits(app)) return

        if (prefs.breaksEnabled && prefs.breakEveryMinutes > 0 && prefs.sessionSeconds(app) >= prefs.breakEveryMinutes * 60) {
            breakShownAt = System.currentTimeMillis()
            overlays.showBreak(
                app,
                minutes = prefs.sessionSeconds(app) / 60,
                seconds = prefs.breakSeconds,
                onDone = { prefs.resetSession(app); breakShownAt = 0 },
                onHome = ::goHome,
            )
        }
    }

    /** Shows the daily-limit screen if it's reached. Returns true when it did. */
    private fun checkLimits(app: TargetApp): Boolean {
        val limit = prefs.dailyLimitMinutes
        if (!prefs.breaksEnabled || limit <= 0) return false
        if (prefs.todaySeconds(app) < limit * 60 + prefs.bonusSeconds(app)) return false
        overlays.showLimit(app, limit, onMore = { prefs.addBonus(app, 600) }, onHome = ::goHome)
        return true
    }

    /* ---------------------------------------------------------------- */

    private fun goHome() {
        performGlobalAction(GLOBAL_ACTION_HOME)
    }

    private fun openSearch(app: TargetApp, topic: String) {
        val url = app.searchUrl ?: return
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url + Uri.encode(topic)))
            .setPackage(app.packages.first())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { startActivity(intent) }
            .onFailure { runCatching { startActivity(intent.setPackage(null)) } }
    }

    companion object {
        private const val TICK_MS = 5_000L
        private const val SESSION_GAP_MS = 5 * 60_000L
        private const val INTENTION_GAP_MS = 2 * 60_000L
    }
}

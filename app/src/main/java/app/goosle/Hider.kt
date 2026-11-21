package app.goosle

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Finds Shorts/Reels and AI slop on screen inside a watched app.
 *
 * Two kinds of results:
 *  - covers: screen areas to paint over and make untappable (the Shorts/Reels tab,
 *    Shorts shelves in feeds, single Shorts in search results, Reels in the feed).
 *  - playerOpen: the full-screen Shorts/Reels player is showing, so the whole
 *    screen gets blocked.
 *
 * Matching uses the labels the apps expose for screen readers ("Shorts", "Reels",
 * "play Short"…), which change much less often than internal view IDs. View IDs
 * are still checked as a second signal.
 */
object Hider {
    data class Cover(val rect: Rect, val label: String)
    data class Result(val covers: List<Cover>, val playerOpen: Boolean)

    private data class Rules(
        /** Labels of the tab/button/shelf header itself, e.g. "Shorts". */
        val tabLabel: Regex,
        /** Labels of a single short video or reel inside a feed or search results. */
        val itemLabel: Regex?,
        /** Labels of a feed section that holds short videos, e.g. "Suggested reels". */
        val shelfLabel: Regex?,
    )

    private val RULES = mapOf(
        Apps.YOUTUBE.key to Rules(
            tabLabel = Regex("""^shorts\b.*""", RegexOption.IGNORE_CASE),
            itemLabel = Regex(""".*(play short|shorts video|#shorts).*""", RegexOption.IGNORE_CASE),
            shelfLabel = Regex("""^(shorts|shorts remixing this video|more shorts)$""", RegexOption.IGNORE_CASE),
        ),
        Apps.INSTAGRAM.key to Rules(
            tabLabel = Regex("""^reels\b.*""", RegexOption.IGNORE_CASE),
            itemLabel = Regex("""^(reel by|clips by|video by .* reel).*""", RegexOption.IGNORE_CASE),
            shelfLabel = Regex("""^(suggested reels|reels for you|reels)$""", RegexOption.IGNORE_CASE),
        ),
        Apps.FACEBOOK.key to Rules(
            tabLabel = Regex("""^(reels|reels and short videos)\b.*""", RegexOption.IGNORE_CASE),
            itemLabel = Regex("""^(reel|reels)\b.*|.*\b(watch|play) reel\b.*""", RegexOption.IGNORE_CASE),
            shelfLabel = Regex("""^(reels|reels and short videos|short videos)$""", RegexOption.IGNORE_CASE),
        ),
    )

    /**
     * @param shortForm hide Shorts/Reels
     * @param slopWords hide feed items mentioning any of these (empty = off)
     */
    fun scan(
        app: TargetApp,
        pkg: String,
        root: AccessibilityNodeInfo,
        screen: Rect,
        extraIds: List<String>,
        shortForm: Boolean,
        slopWords: List<String>,
    ): Result {
        val rules = if (shortForm) RULES[app.key] else null
        val shortLabel = if (app == Apps.YOUTUBE) "Shorts hidden" else "Reels hidden"
        val covers = mutableListOf<Cover>()
        var playerOpen = false

        // 1. Known player screens by view ID.
        if (shortForm) for (id in app.shortFormIds + extraIds) {
            val full = if (id.contains(":id/")) id else "$pkg:id/$id"
            if (root.findAccessibilityNodeInfosByViewId(full).any { it.isVisibleToUser }) playerOpen = true
        }

        // 2. Walk the screen and match labels.
        val navBand = screen.height() / 7 // bottom/top bars live in this band
        fun visit(n: AccessibilityNodeInfo, depth: Int, parentIsList: Boolean) {
            if (depth > 60 || !n.isVisibleToUser) return

            // AI slop: a feed row (video, post, reel) whose words match the slop list.
            if (parentIsList && slopWords.isNotEmpty()) {
                val r = bounds(n)
                if (r.width() >= screen.width() * 0.6 && r.height() < screen.height() * 0.9) {
                    val hit = Slop.match(rowText(n), slopWords)
                    if (hit != null) {
                        covers += Cover(r, "AI slop hidden")
                        return
                    }
                }
            }

            val label = (n.contentDescription ?: n.text)?.toString()?.trim().orEmpty()
            if (rules != null && label.isNotEmpty() && label.length < 300) {
                when {
                    rules.tabLabel.matches(label) || rules.shelfLabel?.matches(label) == true -> {
                        val target = clickableAncestor(n) ?: n
                        val r = bounds(target)
                        val inNav = r.top >= screen.bottom - navBand || r.bottom <= screen.top + navBand
                        if (isSmall(r, screen)) covers += Cover(r, shortLabel)
                        // A selected Shorts/Reels tab means its player is open.
                        if (inNav && (target.isSelected || n.isSelected) && rules.tabLabel.matches(label)) playerOpen = true
                        // A "Shorts"/"Reels" header inside a feed: hide the whole section.
                        if (!inNav) listItem(n, screen)?.let { covers += Cover(bounds(it), shortLabel) }
                    }
                    rules.itemLabel?.matches(label) == true -> {
                        val item = listItem(n, screen) ?: clickableAncestor(n)
                        if (item != null) covers += Cover(bounds(item), shortLabel)
                    }
                }
            }
            val isList = isListContainer(n)
            for (i in 0 until n.childCount) n.getChild(i)?.let { visit(it, depth + 1, isList) }
        }
        visit(root, 0, false)

        return Result(
            covers.filter { !it.rect.isEmpty && Rect.intersects(it.rect, screen) }.distinctBy { it.rect },
            playerOpen,
        )
    }

    private fun isListContainer(n: AccessibilityNodeInfo): Boolean {
        val cls = n.className?.toString().orEmpty()
        return cls.endsWith("RecyclerView") || cls.endsWith("ListView") || n.collectionInfo != null
    }

    /** All the words in a feed row: title, channel, caption, labels. */
    private fun rowText(n: AccessibilityNodeInfo): String {
        val sb = StringBuilder()
        fun walk(x: AccessibilityNodeInfo, depth: Int) {
            if (depth > 20 || sb.length > 2000) return
            x.contentDescription?.let { sb.append(it).append('\n') }
            x.text?.let { sb.append(it).append('\n') }
            for (i in 0 until x.childCount) x.getChild(i)?.let { walk(it, depth + 1) }
        }
        walk(n, 0)
        return sb.toString()
    }

    private fun bounds(n: AccessibilityNodeInfo) = Rect().also { n.getBoundsInScreen(it) }

    private fun isSmall(r: Rect, screen: Rect) = r.width() * r.height() < screen.width() * screen.height() * 0.4

    private fun clickableAncestor(n: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var cur: AccessibilityNodeInfo? = n
        var steps = 0
        while (cur != null && steps < 8) {
            if (cur.isClickable) return cur
            cur = cur.parent
            steps++
        }
        return null
    }

    /** The row of a scrolling list (RecyclerView/ListView) that contains [n], if it's a wide feed row. */
    private fun listItem(n: AccessibilityNodeInfo, screen: Rect): AccessibilityNodeInfo? {
        var child: AccessibilityNodeInfo = n
        var parent = n.parent
        var steps = 0
        while (parent != null && steps < 25) {
            val cls = parent.className?.toString().orEmpty()
            if (cls.endsWith("RecyclerView") || cls.endsWith("ListView") || parent.collectionInfo != null) {
                val r = bounds(child)
                return if (r.width() >= screen.width() * 0.6 && r.height() < screen.height() * 0.9) child else null
            }
            child = parent
            parent = parent.parent
            steps++
        }
        return null
    }
}

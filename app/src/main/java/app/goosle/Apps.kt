package app.goosle

/** What Goosle does with an app. */
enum class AppMode(val label: String) {
    ALLOW("Allow (breaks and limits only)"),
    NO_SHORT_FORM("No Shorts / Reels"),
    BLOCK("Block the app"),
}

/**
 * An app Goosle watches, and how to recognise its short-video screens.
 *
 * Short-form screens are found by Android view IDs inside the app. Apps change
 * these when they update, so the IDs are easy to extend: add more in the app's
 * "Detection helper" screen, or here.
 */
data class TargetApp(
    val key: String,
    val name: String,
    val packages: List<String>,
    val defaultMode: AppMode,
    /** View IDs (without the "package:id/" prefix) that only exist on a Shorts/Reels screen. */
    val shortFormIds: List<String> = emptyList(),
    /** View IDs of algorithmic discovery screens (Explore and similar), blocked with short-form. */
    val discoverIds: List<String> = emptyList(),
    /** Whether short-form detection is reliable enough to offer NO_SHORT_FORM. */
    val canDetectShortForm: Boolean = shortFormIds.isNotEmpty(),
    /** The web search URL used for weekly-focus shortcuts, if any. */
    val searchUrl: String? = null,
)

object Apps {
    val YOUTUBE = TargetApp(
        key = "youtube",
        name = "YouTube",
        packages = listOf("com.google.android.youtube"),
        defaultMode = AppMode.NO_SHORT_FORM,
        shortFormIds = listOf(
            "reel_recycler",
            "reel_player_page_container",
            "reel_watch_fragment_root",
            "reel_player_underlay",
            "shorts_player_container",
        ),
        searchUrl = "https://www.youtube.com/results?search_query=",
    )

    val INSTAGRAM = TargetApp(
        key = "instagram",
        name = "Instagram",
        packages = listOf("com.instagram.android"),
        defaultMode = AppMode.NO_SHORT_FORM,
        shortFormIds = listOf(
            "clips_viewer_view_pager",
            "clips_viewer_container",
            "root_clips_layout",
            "clips_video_container",
        ),
        discoverIds = listOf(
            "explore_action_bar_container",
            "explore_grid_view",
        ),
    )

    val FACEBOOK = TargetApp(
        key = "facebook",
        name = "Facebook",
        packages = listOf("com.facebook.katana", "com.facebook.lite"),
        defaultMode = AppMode.ALLOW,
        // Facebook hides its view IDs, so Reels can't be told apart out of the box.
        // Use the Detection helper to find IDs on your phone and add them; then
        // "No Shorts / Reels" becomes available for Facebook.
        shortFormIds = emptyList(),
    )

    val TIKTOK = TargetApp(
        key = "tiktok",
        name = "TikTok",
        packages = listOf("com.zhiliaoapp.musically", "com.ss.android.ugc.trill"),
        // TikTok is all short-form video, so the only real options are block or limit.
        defaultMode = AppMode.BLOCK,
        canDetectShortForm = false,
    )

    val ALL = listOf(YOUTUBE, INSTAGRAM, FACEBOOK, TIKTOK)

    private val byPackage = ALL.flatMap { app -> app.packages.map { it to app } }.toMap()
    fun forPackage(pkg: CharSequence?): TargetApp? = pkg?.let { byPackage[it.toString()] }
    fun byKey(key: String): TargetApp? = ALL.firstOrNull { it.key == key }
}

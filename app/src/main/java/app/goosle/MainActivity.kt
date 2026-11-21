package app.goosle

import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.graphics.ExperimentalAnimationGraphicsApi
import androidx.compose.animation.graphics.res.animatedVectorResource
import androidx.compose.animation.graphics.res.rememberAnimatedVectorPainter
import androidx.compose.animation.graphics.vector.AnimatedImageVector
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.LifecycleEventObserver
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { GoosleTheme { Home(Prefs(this)) } }
    }
}

/* -------------------------------------------------------------------- */
/* Theme                                                                 */
/* -------------------------------------------------------------------- */

private val Accent = Color(0xFF111111)
private val AccentDark = Color(0xFFF2F2F2)

@Composable
fun GoosleTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val scheme = if (dark) darkColorScheme(
        primary = AccentDark, onPrimary = Color(0xFF111111),
        background = Color(0xFF0B0B0B), surface = Color(0xFF161616), surfaceVariant = Color(0xFF222222),
        onBackground = Color(0xFFF2F2F2), onSurface = Color(0xFFF2F2F2), onSurfaceVariant = Color(0xFF9A9A9A),
        outline = Color(0xFF2E2E2E), secondaryContainer = Color(0xFF2E2E2E), onSecondaryContainer = Color(0xFFF2F2F2),
    ) else lightColorScheme(
        primary = Accent, onPrimary = Color.White,
        background = Color(0xFFF7F7F7), surface = Color.White, surfaceVariant = Color(0xFFEFEFEF),
        onBackground = Color(0xFF111111), onSurface = Color(0xFF111111), onSurfaceVariant = Color(0xFF666666),
        outline = Color(0xFFE2E2E2), secondaryContainer = Color(0xFFE6E6E6), onSecondaryContainer = Color(0xFF111111),
    )
    MaterialTheme(colorScheme = scheme, content = content)
}

/* -------------------------------------------------------------------- */
/* Screen                                                                */
/* -------------------------------------------------------------------- */

@Composable
fun Home(prefs: Prefs) {
    val ctx = LocalContext.current
    // Bumped whenever settings change or the app returns to the foreground, to re-read prefs.
    var version by remember { mutableIntStateOf(0) }
    val refresh: () -> Unit = { version++ }

    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val obs = LifecycleEventObserver { _, e -> if (e == Lifecycle.Event.ON_RESUME) refresh() }
        lifecycle.addObserver(obs)
        onDispose { lifecycle.removeObserver(obs) }
    }
    LaunchedEffect(Unit) { while (true) { delay(10_000); refresh() } }

    run {
        @Suppress("UNUSED_VARIABLE") val readToRecompose = version
        Scaffold(containerColor = MaterialTheme.colorScheme.background) { pad ->
            Column(
                Modifier
                    .padding(pad)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Header(prefs, refresh)
                Setup(ctx, prefs)
                Focus(prefs, refresh)
                AppsCard(prefs, refresh)
                SlopCard(prefs, refresh)
                AdBlockCard(ctx, prefs, refresh)
                Breaks(prefs, refresh)
                Today(prefs)
                Extras(ctx, prefs, refresh)
                DetectionHelper(ctx, prefs, refresh)
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun Header(prefs: Prefs, refresh: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
        Logo()
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text("Goosle", fontSize = 28.sp, fontWeight = FontWeight.SemiBold)
            Text("Social media on your terms.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = prefs.enabled, onCheckedChange = { prefs.enabled = it; refresh() })
    }
}

/** The goose: dragon horns grow from its head, then it blinks. Replays now and then. */
@OptIn(ExperimentalAnimationGraphicsApi::class)
@Composable
private fun Logo() {
    val image = AnimatedImageVector.animatedVectorResource(R.drawable.goose_animated)
    var atEnd by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(300)
        atEnd = true
        while (true) {
            delay(9000)
            atEnd = false // horns shrink back…
            delay(1200)
            atEnd = true  // …and grow again
        }
    }
    Box(
        Modifier.size(56.dp).clip(RoundedCornerShape(16.dp)).background(Color.White)
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp)),
    ) {
        Image(
            painter = rememberAnimatedVectorPainter(image, atEnd),
            contentDescription = "Goosle",
            modifier = Modifier.fillMaxSize().scale(1.3f),
        )
    }
}

/* -------------------------------------------------------------------- */

private fun serviceOn(ctx: Context): Boolean {
    val enabled = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
    val me = ComponentName(ctx, GoosleService::class.java)
    return enabled.split(':').any { ComponentName.unflattenFromString(it) == me }
}

@Composable
private fun Setup(ctx: Context, prefs: Prefs) {
    if (serviceOn(ctx)) return
    Card(highlight = true) {
        Text("One step to turn Goosle on", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
        Text(
            "Goosle needs Android's accessibility permission to see which app and screen is open, so it can leave " +
                "Shorts and Reels, show breaks and enforce limits. It reads the screen only inside YouTube, Instagram, " +
                "Facebook and TikTok, and nothing is stored or sent anywhere except your settings and daily minutes.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            "In the next screen: Installed apps (or Downloaded apps) → Goosle → turn it on. " +
                "If Android says it's a restricted setting: open Goosle's App info, tap ⋮ → Allow restricted settings, and try again.",
            color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp,
        )
        Button(onClick = { ctx.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }) {
            Text("Open accessibility settings")
        }
    }
}

/* -------------------------------------------------------------------- */

@Composable
private fun Focus(prefs: Prefs, refresh: () -> Unit) {
    Card(highlight = prefs.focusIsStale) {
        Text("What do you want to learn this week?", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
        Text(
            if (prefs.focusTopics.isEmpty()) "Add a few topics. When you open YouTube, Goosle offers these first instead of the algorithm's home feed."
            else if (prefs.focusIsStale) "These were set over a week ago. Still what you want to learn?"
            else "When you open YouTube, tap a topic to go straight to it.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        WordList(
            items = prefs.focusTopics,
            placeholder = "e.g. japanese grammar, sourdough",
            onChange = { prefs.focusTopics = it; refresh() },
        )
    }
}

@Composable
private fun AppsCard(prefs: Prefs, refresh: () -> Unit) {
    Card {
        Text("Apps", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
        Apps.ALL.forEachIndexed { i, app ->
            if (i > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outline)
            Column(Modifier.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(app.name, fontWeight = FontWeight.Medium, fontSize = 16.sp)
                val canShort = app.canDetectShortForm || prefs.extraShortFormIds(app).isNotEmpty()
                val modes = AppMode.entries.filter { it != AppMode.NO_SHORT_FORM || canShort }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                    modes.forEach { m ->
                        val label = when (m) {
                            AppMode.ALLOW -> "Allow"
                            AppMode.NO_SHORT_FORM -> if (app == Apps.YOUTUBE) "No Shorts" else "No Reels"
                            AppMode.BLOCK -> "Block"
                        }
                        FilterChip(
                            selected = prefs.mode(app) == m,
                            onClick = { prefs.setMode(app, m); refresh() },
                            label = { Text(label) },
                        )
                    }
                }
                if (prefs.mode(app) != AppMode.BLOCK) {
                    ToggleRow(
                        "Ask what I'm here for when I open it",
                        prefs.askIntention(app),
                    ) { prefs.setAskIntention(app, it); refresh() }
                }
                if (app == Apps.TIKTOK) {
                    Text("TikTok is all short video, so it can be allowed with limits or blocked.", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun SlopCard(prefs: Prefs, refresh: () -> Unit) {
    var showWords by remember { mutableStateOf(false) }
    Card {
        ToggleRow(
            "Hide AI slop",
            prefs.hideSlop,
            "Covers videos, posts and reels in YouTube, Instagram and Facebook whose title, caption or channel " +
                "mentions AI generation, like “AI generated”, “#aiart”, “Sora” or “Suno”.",
        ) { prefs.hideSlop = it; refresh() }
        if (prefs.hideSlop) {
            Row(Modifier.fillMaxWidth().clickable { showWords = !showWords }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Words and phrases (${prefs.slopWords.size})", Modifier.weight(1f), fontWeight = FontWeight.Medium)
                Text(if (showWords) "▲" else "▼", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (showWords) {
                WordList(prefs.slopWords, "Add a word or phrase", onChange = { prefs.slopWords = it; refresh() })
                TextButton(onClick = { prefs.slopWords = Slop.DEFAULT_WORDS; refresh() }) { Text("Reset to defaults") }
            }
            Text(
                "It only catches slop that says what it is somewhere in its text. AI videos with no mention of AI can't be spotted from words.",
                fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/* -------------------------------------------------------------------- */
/* Ad blocker                                                            */
/* -------------------------------------------------------------------- */

private val DNS_PROVIDERS = listOf(
    "1.1.1.1" to "Cloudflare",
    "9.9.9.9" to "Quad9",
    "8.8.8.8" to "Google",
    "94.140.14.14" to "AdGuard (blocks extra ads)",
)

@Composable
private fun AdBlockCard(ctx: Context, prefs: Prefs, refresh: () -> Unit) {
    val scope = rememberCoroutineScope()
    var updating by remember { mutableStateOf(false) }
    var showRecent by remember { mutableStateOf(false) }
    var showAdvanced by remember { mutableStateOf(false) }

    val consent = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        if (VpnService.prepare(ctx) == null) {
            prefs.adBlock = true
            AdBlockService.start(ctx)
        } else {
            Toast.makeText(ctx, "Goosle needs the VPN permission to block ads", Toast.LENGTH_LONG).show()
        }
        refresh()
    }

    fun setOn(on: Boolean) {
        if (on) {
            val ask = VpnService.prepare(ctx)
            if (ask != null) consent.launch(ask) else { prefs.adBlock = true; AdBlockService.start(ctx) }
        } else {
            prefs.adBlock = false
            AdBlockService.stop(ctx)
        }
        refresh()
    }

    fun restartIfOn() {
        if (prefs.adBlock) { AdBlockService.stop(ctx); AdBlockService.start(ctx) }
    }

    // Restart after an app update/reboot if it was on and still permitted.
    LaunchedEffect(Unit) {
        if (prefs.adBlock && AdBlockService.status != "on" && VpnService.prepare(ctx) == null) AdBlockService.start(ctx)
    }

    Card(highlight = !prefs.adBlock) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f).padding(end = 12.dp)) {
                Text("Ad blocker for all apps", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                Text(
                    "Blocks ads and trackers in apps, games and browsers across the whole phone.",
                    fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Switch(checked = prefs.adBlock, onCheckedChange = ::setOn)
        }

        if (prefs.adBlock) {
            Blocklist.load(ctx)
            Text(
                "Blocked ${"%,d".format(AdBlockService.blockedCount.get())} ad and tracker requests since it started. " +
                    "Using ${"%,d".format(Blocklist.size)} domains (${Blocklist.source}).",
                fontSize = 14.sp,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { showRecent = !showRecent }) { Text(if (showRecent) "Hide blocked" else "What was blocked") }
                OutlinedButton(
                    enabled = !updating,
                    onClick = {
                        updating = true
                        scope.launch {
                            val msg = withContext(Dispatchers.IO) {
                                runCatching { "Updated: ${"%,d".format(Blocklist.update(ctx))} domains" }
                                    .getOrElse { "Couldn't update: ${it.message}" }
                            }
                            updating = false
                            Toast.makeText(ctx, msg, Toast.LENGTH_LONG).show()
                            refresh()
                        }
                    },
                ) { Text(if (updating) "Updating…" else "Update list") }
            }
            if (showRecent) {
                val recent = synchronized(AdBlockService.recent) { AdBlockService.recent.toList().asReversed() }
                Text(
                    if (recent.isEmpty()) "Nothing yet." else recent.take(40).joinToString("\n"),
                    fontFamily = FontFamily.Monospace, fontSize = 11.sp,
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant).padding(8.dp),
                )
                Text("If something stops working, add its domain to Allowed below.", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        Text(
            "How it works: Goosle runs a local VPN on your phone that only handles address lookups. Lookups for ad and " +
                "tracker servers are refused; everything else goes to your chosen DNS provider. Your browsing itself " +
                "doesn't go through it.",
            fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            "It can't remove ads inside YouTube, Instagram, Facebook or TikTok, because those come from the same servers as the " +
                "videos and posts. Goosle's Shorts/Reels hiding and YouTube ad skipping cover those apps instead.",
            fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Row(Modifier.fillMaxWidth().clickable { showAdvanced = !showAdvanced }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Settings", Modifier.weight(1f), fontWeight = FontWeight.Medium)
            Text(if (showAdvanced) "▲" else "▼", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (showAdvanced) {
            var open by remember { mutableStateOf(false) }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("DNS provider", Modifier.weight(1f), fontSize = 15.sp)
                Box {
                    OutlinedButton(onClick = { open = true }) {
                        Text(DNS_PROVIDERS.firstOrNull { it.first == prefs.adBlockUpstream }?.second ?: prefs.adBlockUpstream)
                    }
                    DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                        DNS_PROVIDERS.forEach { (ip, name) ->
                            DropdownMenuItem(text = { Text("$name ($ip)") }, onClick = {
                                open = false; prefs.adBlockUpstream = ip; restartIfOn(); refresh()
                            })
                        }
                    }
                }
            }
            Text("Allowed domains (never blocked)", fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 6.dp))
            WordList(prefs.adBlockAllowedDomains, "e.g. example.com", onChange = { prefs.adBlockAllowedDomains = it; refresh() })
            Text("Extra domains to block", fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 6.dp))
            WordList(prefs.adBlockExtraDomains, "e.g. ads.example.com", onChange = { prefs.adBlockExtraDomains = it; refresh() })
            Text("Apps that skip the blocker", fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 6.dp))
            Text("For an app that breaks with the blocker on. Use its package name (Settings → Apps → the app; it's often in the Play Store link).",
                fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            WordList(prefs.adBlockExcludedApps, "e.g. com.example.bank", onChange = { prefs.adBlockExcludedApps = it; restartIfOn(); refresh() })
            Text(
                "To keep it on after a restart: Android Settings → Network → VPN → Goosle ⚙ → Always-on VPN. " +
                    "Only one VPN app can run at a time. If Private DNS is set to a specific provider, set it to Automatic or Off.",
                fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedButton(onClick = { runCatching { ctx.startActivity(Intent(Settings.ACTION_VPN_SETTINGS)) } }) { Text("Open VPN settings") }
        }
    }
}

@Composable
private fun Breaks(prefs: Prefs, refresh: () -> Unit) {
    Card {
        Text("Breaks and limits", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
        ToggleRow("Break reminders and daily limits", prefs.breaksEnabled, "Covers the app until you've taken the break.") {
            prefs.breaksEnabled = it; refresh()
        }
        if (prefs.breaksEnabled) {
            NumberRow("Break every", prefs.breakEveryMinutes, "min", listOf(10, 15, 20, 30, 45, 60)) { prefs.breakEveryMinutes = it; refresh() }
            NumberRow("Break length", prefs.breakSeconds, "sec", listOf(30, 60, 120, 300)) { prefs.breakSeconds = it; refresh() }
            NumberRow("Daily limit per app", prefs.dailyLimitMinutes, "min", listOf(0, 15, 30, 45, 60, 90, 120)) { prefs.dailyLimitMinutes = it; refresh() }
        }
    }
}

@Composable
private fun Today(prefs: Prefs) {
    Card {
        Text("Today", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
        val limit = prefs.dailyLimitMinutes * 60
        Apps.ALL.forEach { app ->
            val secs = prefs.todaySeconds(app)
            val max = if (limit > 0) limit + prefs.bonusSeconds(app) else 3600
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Text(app.name, Modifier.width(92.dp), fontSize = 14.sp)
                LinearProgressIndicator(
                    progress = { (secs.toFloat() / max).coerceIn(0f, 1f) },
                    modifier = Modifier.weight(1f).height(6.dp).clip(RoundedCornerShape(99.dp)),
                    trackColor = MaterialTheme.colorScheme.outline,
                    drawStopIndicator = {},
                )
                Text(formatMinutes(secs), Modifier.width(64.dp), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = androidx.compose.ui.text.style.TextAlign.End)
            }
        }
    }
}

private fun formatMinutes(secs: Int): String {
    val m = secs / 60
    return if (m < 60) "$m min" else "${m / 60}h ${m % 60}m"
}

@Composable
private fun Extras(ctx: Context, prefs: Prefs, refresh: () -> Unit) {
    Card {
        Text("Colour and ads", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
        ToggleRow("Grey screen in these apps", prefs.grayscale, "Black and white is less grabby. Switches back when you leave.") {
            prefs.grayscale = it; refresh()
        }
        if (prefs.grayscale && !Grayscale.canControl(ctx)) {
            Text(
                "Android only lets Goosle change screen colour after a one-time step from a computer. " +
                    "Turn on USB debugging, connect your phone, and run:",
                fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            CopyBox(ctx, Grayscale.ADB_COMMAND)
            Text(
                "No computer? Settings → Digital Wellbeing → Bedtime mode → Grayscale does the same for the whole phone.",
                fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        ToggleRow("Tap “Skip ad” on YouTube automatically", prefs.skipAds, "Skips as soon as YouTube allows. Unskippable ads still play.") {
            prefs.skipAds = it; refresh()
        }
    }
}

@Composable
private fun DetectionHelper(ctx: Context, prefs: Prefs, refresh: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    Card {
        Row(Modifier.fillMaxWidth().clickable { open = !open }, verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Detection helper", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                Text("For when an app update lets Shorts or Reels slip through.", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(if (open) "▲" else "▼", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (!open) return@Card
        Text(
            "1. Turn on recording. 2. Open the app's normal feed for a few seconds, then open Reels/Shorts. " +
                "3. Come back here. IDs that only appeared on the Reels/Shorts screen (often with “clips” or “reel” in them) " +
                "can be added below for that app.",
            fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        ToggleRow("Record screen IDs", prefs.recordIds) { prefs.recordIds = it; refresh() }
        val ids = prefs.recordedIds
        if (ids.isNotEmpty()) {
            Text("Last seen (newest last):", fontSize = 13.sp)
            Text(
                ids.takeLast(60).joinToString("\n"),
                fontFamily = FontFamily.Monospace, fontSize = 11.sp,
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant).padding(8.dp),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { copy(ctx, ids.joinToString("\n")) }) { Text("Copy all") }
                OutlinedButton(onClick = { prefs.recordedIds = emptyList(); refresh() }) { Text("Clear") }
            }
        }
        Apps.ALL.filter { it != Apps.TIKTOK }.forEach { app ->
            Text("Extra Shorts/Reels IDs for ${app.name}", fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 6.dp))
            WordList(
                items = prefs.extraShortFormIds(app),
                placeholder = "e.g. clips_viewer_view_pager",
                lowercase = false,
                onChange = { prefs.setExtraShortFormIds(app, it.map { id -> id.substringAfter(":id/") }); refresh() },
            )
        }
    }
}

/* -------------------------------------------------------------------- */
/* Small pieces                                                          */
/* -------------------------------------------------------------------- */

@Composable
private fun Card(highlight: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val border = if (highlight) MaterialTheme.colorScheme.primary.copy(alpha = .6f) else MaterialTheme.colorScheme.outline
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, border),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, hint: String? = null, onChange: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable { onChange(!checked) }.padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(end = 12.dp)) {
            Text(label, fontSize = 15.sp)
            if (hint != null) Text(hint, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
private fun NumberRow(label: String, value: Int, unit: String, options: List<Int>, onChange: (Int) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f), fontSize = 15.sp)
        Box {
            OutlinedButton(onClick = { open = true }) { Text(if (value == 0) "Off" else "$value $unit") }
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                options.forEach { o ->
                    DropdownMenuItem(text = { Text(if (o == 0) "Off" else "$o $unit") }, onClick = { open = false; onChange(o) })
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WordList(items: List<String>, placeholder: String, lowercase: Boolean = true, onChange: (List<String>) -> Unit) {
    var draft by remember { mutableStateOf("") }
    val add = {
        val have = items.map { it.lowercase() }.toSet()
        val new = draft.split(',').map { if (lowercase) it.trim().lowercase() else it.trim() }
            .filter { it.isNotEmpty() && it.lowercase() !in have }
        if (new.isNotEmpty()) onChange(items + new)
        draft = ""
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = draft,
            onValueChange = { draft = it },
            placeholder = { Text(placeholder) },
            singleLine = true,
            modifier = Modifier.weight(1f),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { add() }),
            shape = RoundedCornerShape(12.dp),
        )
        FilledTonalButton(onClick = add, enabled = draft.isNotBlank()) { Text("Add") }
    }
    if (items.isNotEmpty()) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items.forEach { item ->
                InputChip(
                    selected = false,
                    onClick = { onChange(items - item) },
                    label = { Text(item) },
                    trailingIcon = { Text("×", fontSize = 16.sp) },
                )
            }
        }
    }
}

@Composable
private fun CopyBox(ctx: Context, text: String) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable { copy(ctx, text) }.padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, Modifier.weight(1f), fontFamily = FontFamily.Monospace, fontSize = 12.sp)
        Text("Copy", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 8.dp))
    }
}

private fun copy(ctx: Context, text: String) {
    ctx.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("Goosle", text))
    Toast.makeText(ctx, "Copied", Toast.LENGTH_SHORT).show()
}

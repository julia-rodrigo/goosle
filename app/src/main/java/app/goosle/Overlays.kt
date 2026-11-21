package app.goosle

import android.accessibilityservice.AccessibilityService
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * Full-screen cards drawn on top of other apps. Uses an accessibility overlay
 * window, so no "display over other apps" permission is needed.
 */
class Overlays(private val service: AccessibilityService) {
    private val wm = service.getSystemService(WindowManager::class.java)
    private val main = Handler(Looper.getMainLooper())
    private var current: View? = null

    /** Which app the visible overlay is about, so it can be removed when you leave that app. */
    var ownerKey: String? = null
        private set
    var kind: String? = null
        private set

    val isShowing get() = current != null

    fun dismiss() {
        main.removeCallbacksAndMessages(null)
        current?.let { runCatching { wm.removeView(it) } }
        current = null
        ownerKey = null
        kind = null
    }

    /* ---------------------------------------------------------------- */

    fun showBlocked(app: TargetApp, onHome: () -> Unit) = show(app, "block") { card ->
        card.addView(title("${app.name} is blocked"))
        card.addView(body(
            if (app == Apps.TIKTOK) "It's an endless short-video feed picked by an algorithm. You can change this in Goosle."
            else "You chose to block ${app.name} in Goosle."
        ))
        card.addView(buttons(primary("Go to home screen") { dismiss(); onHome() }))
    }

    fun showIntention(
        app: TargetApp,
        topics: List<String>,
        onTopic: (String) -> Unit,
        onContinue: () -> Unit,
        onHome: () -> Unit,
    ) = show(app, "intention") { card ->
        card.addView(title("What are you here for?"))
        if (topics.isNotEmpty() && app.searchUrl != null) {
            card.addView(body("This week you're learning:"))
            val list = LinearLayout(service).apply { orientation = LinearLayout.VERTICAL }
            topics.forEach { t -> list.addView(secondary(t) { dismiss(); onTopic(t) }, fullWidth(top = 8)) }
            card.addView(list, fullWidth(bottom = 8))
        } else {
            card.addView(body("Take a breath. Opening ${app.name} on purpose feels different from opening it on autopilot."))
        }
        val cont = secondary("Something else") { dismiss(); onContinue() }
        countdown(cont, 5, "Something else")
        card.addView(buttons(primary("Never mind") { dismiss(); onHome() }, cont))
    }

    fun showBreak(app: TargetApp, minutes: Int, seconds: Int, onDone: () -> Unit, onHome: () -> Unit) =
        show(app, "break") { card ->
            card.addView(title("Time for a short break"))
            card.addView(body(
                (if (minutes > 0) "You've been on ${app.name} for $minutes minutes. " else "") +
                    "Look away from the screen and breathe with the circle."
            ))
            card.addView(breathingCircle(), LinearLayout.LayoutParams(dp(120), dp(120)).apply {
                gravity = Gravity.CENTER_HORIZONTAL; topMargin = dp(8); bottomMargin = dp(20)
            })
            val back = primary("I'm back") { dismiss(); onDone() }
            countdown(back, seconds, "I'm back")
            card.addView(buttons(back, secondary("Close ${app.name}") { dismiss(); onHome() }))
        }

    fun showLimit(app: TargetApp, minutes: Int, onMore: () -> Unit, onHome: () -> Unit) = show(app, "limit", focusable = true) { card ->
        card.addView(title("That's your $minutes minutes of ${app.name} for today"))
        card.addView(body("It unlocks again tomorrow. If you really need a little more, type this exactly:"))
        card.addView(body(LIMIT_PHRASE).apply { setTypeface(typeface, Typeface.ITALIC); setTextColor(FG) })
        val more = secondary("10 more minutes") { dismiss(); onMore() }.apply { isEnabled = false; alpha = .4f }
        val input = EditText(service).apply {
            hint = "Type the sentence above"
            setHintTextColor(MUTED)
            setTextColor(FG)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            isLongClickable = false // no pasting
            setTextIsSelectable(false)
            background = rounded(Color.parseColor("#23211F"), dp(12).toFloat(), Color.parseColor("#4A4743"))
            setPadding(dp(14), dp(12), dp(14), dp(12))
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: Editable?) {
                    val ok = s.toString().trim() == LIMIT_PHRASE
                    more.isEnabled = ok
                    more.alpha = if (ok) 1f else .4f
                }
            })
        }
        card.addView(input, fullWidth(top = 4, bottom = 8))
        card.addView(buttons(primary("Close ${app.name}") { dismiss(); onHome() }, more))
    }

    /* ---------------------------------------------------------------- */

    private fun show(app: TargetApp, kind: String, focusable: Boolean = false, build: (LinearLayout) -> Unit) {
        if (this.kind == kind && ownerKey == app.key) return
        dismiss()
        val card = LinearLayout(service).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(28), dp(28), dp(28), dp(28))
        }
        build(card)
        val scroll = ScrollView(service).apply {
            isFillViewport = true
            addView(FrameLayout(service).apply {
                addView(card, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
            })
        }
        val root = FrameLayout(service).apply {
            setBackgroundColor(BG)
            isClickable = true // swallow touches meant for the app underneath
            addView(scroll)
        }
        var flags = WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
        if (!focusable) flags = flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            flags,
            PixelFormat.TRANSLUCENT,
        ).apply { softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE }
        runCatching { wm.addView(root, lp) }.onSuccess {
            current = root
            ownerKey = app.key
            this.kind = kind
        }
    }

    private fun countdown(button: Button, seconds: Int, label: String) {
        if (seconds <= 0) return
        button.isEnabled = false
        button.alpha = .4f
        var left = seconds
        val step = object : Runnable {
            override fun run() {
                if (left <= 0) {
                    button.text = label
                    button.isEnabled = true
                    button.alpha = 1f
                    return
                }
                button.text = "$label (${left}s)"
                left--
                main.postDelayed(this, 1000)
            }
        }
        step.run()
    }

    private fun breathingCircle() = View(service).apply {
        background = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(Color.parseColor("#E0703F"), Color.parseColor("#C4542C")),
        ).apply { shape = GradientDrawable.OVAL }
        // In for 4 seconds, out for 4.
        listOf("scaleX", "scaleY").forEach { prop ->
            ObjectAnimator.ofFloat(this, prop, .55f, 1f).apply {
                duration = 4000
                repeatMode = ValueAnimator.REVERSE
                repeatCount = ValueAnimator.INFINITE
                start()
            }
        }
    }

    private fun title(text: String) = TextView(service).apply {
        this.text = text
        setTextColor(FG)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 26f)
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        gravity = Gravity.CENTER
        setPadding(0, 0, 0, dp(10))
    }

    private fun body(text: String) = TextView(service).apply {
        this.text = text
        setTextColor(MUTED)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        gravity = Gravity.CENTER
        setLineSpacing(0f, 1.25f)
        setPadding(0, 0, 0, dp(14))
    }

    private fun primary(text: String, onClick: () -> Unit) = button(text, BUTTON_FG, FG, FG, onClick)
    private fun secondary(text: String, onClick: () -> Unit) = button(text, FG, Color.TRANSPARENT, Color.parseColor("#4A4743"), onClick)

    private fun button(text: String, fg: Int, bg: Int, stroke: Int, onClick: () -> Unit) = Button(service).apply {
        this.text = text
        isAllCaps = false
        setTextColor(fg)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        background = rounded(bg, dp(999).toFloat(), stroke)
        setPadding(dp(20), dp(12), dp(20), dp(12))
        stateListAnimator = null
        setOnClickListener { onClick() }
    }

    private fun buttons(vararg b: Button) = LinearLayout(service).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(0, dp(8), 0, 0)
        b.forEach { addView(it, fullWidth(top = 8)) }
    }

    private fun rounded(color: Int, radius: Float, stroke: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radius
        setStroke(dp(1), stroke)
    }

    private fun fullWidth(top: Int = 0, bottom: Int = 0) =
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(top); bottomMargin = dp(bottom)
        }

    private fun dp(v: Int) = (v * service.resources.displayMetrics.density).toInt()

    companion object {
        const val LIMIT_PHRASE = "I choose to spend 10 more minutes here"
        private val BG = Color.parseColor("#F5141312")
        private val FG = Color.parseColor("#F3EFE8")
        private val MUTED = Color.parseColor("#BDB6AB")
        private val BUTTON_FG = Color.parseColor("#1C1B19")
    }
}

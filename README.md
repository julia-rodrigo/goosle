# Goosle for Android

An Android app that makes YouTube, Instagram, Facebook and TikTok calmer, inside the real apps.

## What it does

- **Shorts and Reels are hidden.** In YouTube, Instagram and Facebook, Goosle paints solid blocks over the Shorts/Reels tab, Shorts shelves, single Shorts in search, and Reels in the feed, and those blocks swallow taps, so they can't be seen or opened. If a Shorts/Reels player opens anyway (from a link, say), a full-screen block covers it, Goosle presses Back, and the block stays until you've left. Finding them uses the labels the apps give screen readers ("Shorts", "Reels"), which survive app updates better than internal IDs.
- **Block whole apps.** TikTok is blocked by default (it's all short video). Any app can be set to *Allow*, *No Shorts/Reels* or *Block*.
- **This week's focus.** Tell Goosle what you're learning this week. When you open YouTube, it asks *"What are you here for?"* and offers your topics, which open as a YouTube search. "Something else" unlocks after 5 seconds.
- **Break reminders.** After 20 minutes in an app (adjustable), a full-screen break covers it: breathe with the circle, and "I'm back" unlocks after 60 seconds.
- **Daily limits.** After 60 minutes a day in an app (adjustable), it's locked until tomorrow. Typing a sentence gets 10 more minutes; pasting is blocked.
- **Grey screen** inside these apps only, switching back to colour when you leave (needs a one-time setup step, see below).
- **Skips YouTube ads** by tapping "Skip ad" the moment it appears. Unskippable ads still play.
- **Today's minutes** per app, on the main screen.

Everything stays on the phone. Nothing is sent anywhere.

## Install

1. Get `app-release.apk` (build it with the steps below, or from a release if one is published) and open it on your phone. Allow installing from your browser/files app when asked.
2. Open Goosle and tap **Open accessibility settings** → *Installed apps* (or *Downloaded apps*) → **Goosle** → turn it on.
   - On Android 13+, if it says **"Restricted setting"**: go to Settings → Apps → Goosle → ⋮ (top right) → **Allow restricted settings**, then try again.
3. Add this week's topics, and choose what to do with each app.

### Grey screen (optional, one time)

Android only lets an app switch the screen to black and white after a grant from a computer:

1. On the phone, turn on Developer options → USB debugging.
2. Connect it to a computer with [adb](https://developer.android.com/tools/releases/platform-tools) and run:
   ```
   adb shell pm grant app.goosle android.permission.WRITE_SECURE_SETTINGS
   ```

No computer? *Settings → Digital Wellbeing → Bedtime mode → Grayscale* greys the whole phone instead.

## Limits

- **Android only.** iPhones don't allow any app to see inside other apps.
- **Hiding works by covering, not deleting.** Android doesn't let one app remove parts of another app, so Goosle draws over them. While you scroll fast, a cover can lag a moment behind.
- **Not yet tested on a real phone**, because the build machine has no emulator. Labels are matched in English; with the phone in another language some may slip through. If anything gets through, use the **Detection helper**: record IDs while the Reels/Shorts screen is open, then add the new one for that app.
- **Only Shorts and Reels are found.** Single ads, sponsored posts or AI videos inside a feed aren't detected.
- **Not on Google Play.** Play restricts accessibility-service apps, so this is installed directly from the APK.

## Build

Needs JDK 17+ and the Android SDK (platform 36).

```bash
./gradlew assembleRelease
# app/build/outputs/apk/release/app-release.apk
```

The release build is signed with the debug key so it installs without extra setup. Use your own signing key before sharing it widely.

## Code

```
app/src/main/java/app/goosle/
  GoosleService.kt   accessibility service: detects apps/screens, times usage, triggers breaks and limits
  Overlays.kt        full-screen block, break, limit and "what are you here for?" screens
  Apps.kt            supported apps and the view IDs of their Shorts/Reels screens
  Prefs.kt           settings and daily usage (on-device only)
  Grayscale.kt       grey screen while a watched app is open
  MainActivity.kt    the settings screen
```

Earlier versions are in git history: the browser extension (commit `f3f98bd`), the YouTube web app (`fd9e71b`), and the original app on the `legacy` branch.

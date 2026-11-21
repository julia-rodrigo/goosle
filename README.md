# Goosle

A browser extension that makes YouTube, Instagram, Facebook and TikTok calmer. You see what you chose to see, not what an algorithm picked to keep you scrolling.

## What it does

**Hides**
- **Shorts and Reels.** Shorts shelves, tabs and buttons are removed. A Shorts link opens as a normal video. Reels and Explore pages are blocked.
- **Ads and sponsored posts.** Ad slots, promoted videos and "Sponsored" posts are hidden. YouTube video ads are skipped as soon as YouTube allows, and muted while they play.
- **Algorithm feeds.** The YouTube home feed, the "up next" sidebar, end screens and Trending; Instagram Explore and "Suggested for you"; Facebook's Video feed and suggested posts.
- **AI slop.** Videos and posts matching phrases like "ai generated", "#aiart", "suno", "sora" or "reddit stories". The list is editable.
- **News** (off by default). Hides news channels and news-style words.
- **Entertainment** (off by default). Hides pranks, reactions, challenges, vlogs, gameplay and similar.
- Any **channel, account, word or topic** you add to your block lists.

**Shows you what you asked for**
- **This week's focus.** Tell Goosle what you're learning this week, like "japanese grammar" or "sourdough". The YouTube home page becomes a short list of those topics. With "Show me" set to focus, only videos about them appear anywhere on YouTube.
- **"Show me" modes:** everything, only this week's focus, only tutorials, only music, or only your favourite channels.
- **Video length:** long-form only by default (8 minutes and up). You can change the minimum and maximum.
- **Following-only feeds:** Instagram opens on the chronological Following feed, and Facebook opens on Most recent. TikTok is blocked by default, or can be set to Following only.

**Helps you stop**
- **Grey screen.** Turns these sites black and white.
- **Break reminders.** After 20 minutes (adjustable), the page is covered and the video paused until you've done a 60-second breathing break.
- **Daily limit.** After 60 minutes on a site in one day (adjustable), it's locked. You can get 10 more minutes by typing a sentence; pasting it doesn't work.

A small "Goosle hid N" button in the corner shows how many items were hidden and why. Click it to see them.

Everything runs in your browser. Nothing is sent anywhere. Settings sync through your browser account, and time tracking stays on your device.

## Install

**Chrome, Edge, Brave, Arc, Opera**
1. Download this repository (Code → Download ZIP) and unzip it.
2. Go to `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped folder (the one with `manifest.json`).
4. The settings page opens. Add this week's topics.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and pick `manifest.json`.
   Firefox removes temporary add-ons when it restarts; a permanent install needs the extension to be signed through addons.mozilla.org.

## Limits

- **Websites only.** Browser extensions can't change the phone apps for Instagram, TikTok, Facebook or YouTube. On a phone, use the websites in a browser that supports extensions (Firefox for Android, Kiwi, Orion on iOS, or Safari with a Safari Web Extension build), and the phone's own screen-time limits for the apps.
- **Sites change their markup.** These sites redesign often. YouTube rules are tested against the live site; the Instagram, Facebook and TikTok rules are written against their current structure but couldn't be tested from the build environment, so some may need adjusting.
- **Ads.** Ad slots and sponsored posts are hidden, and skippable YouTube ads are skipped and muted. Unskippable YouTube video ads still play, muted. For full ad blocking, use [uBlock Origin](https://ublockorigin.com/) alongside Goosle.
- **Word matching is simple.** It matches whole words and phrases, so focus topics can let in the occasional off-topic video, and the slop filter only catches videos that mention AI in their text.

## Project layout

```
manifest.json            extension manifest (MV3)
src/background.js        time tracking for breaks and daily limits
src/shared/defaults.js   default settings and word lists
src/shared/filter.js     the hide/show rules (pure functions)
src/content/common.js    shared engine: page watching, grey screen, overlays, breaks
src/content/*.js         per-site rules (youtube, instagram, facebook, tiktok)
src/popup/               toolbar popup
src/options/             settings page
```

Earlier versions of this repo: the original app is on the `legacy` branch, and the Goosle YouTube web app is in this branch's history (commit `fd9e71b`).

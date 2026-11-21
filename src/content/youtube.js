/* YouTube rules. */
(function () {
  const TILES = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-video-renderer",
    "ytd-reel-item-renderer",
    "yt-lockup-view-model",
    "ytm-shorts-lockup-view-model",
    "ytm-shorts-lockup-view-model-v2",
    // mobile site
    "ytm-video-with-context-renderer",
    "ytm-compact-video-renderer",
    "ytm-rich-item-renderer",
  ].join(",");

  const text = (root, sel) => {
    const e = root.querySelector(sel);
    return e ? (e.getAttribute("title") || e.textContent || "").trim() : "";
  };

  function readTile(el) {
    const title =
      text(el, "#video-title") ||
      text(el, ".yt-lockup-metadata-view-model__title") ||
      text(el, "h3 a, h3") ||
      text(el, "a[title]") ||
      (el.querySelector("img[alt]")?.alt ?? "");

    const channel =
      text(el, "ytd-channel-name #text") ||
      text(el, "ytd-channel-name a") ||
      text(el, ".yt-content-metadata-view-model__metadata-row a[href^='/@']") ||
      text(el, ".yt-content-metadata-view-model__metadata-text") ||
      text(el, "a[href^='/@']") ||
      text(el, ".ytm-badge-and-byline-item-byline, .media-item-byline");

    let durationSec;
    let isLive = false;
    for (const b of el.querySelectorAll(
      "ytd-thumbnail-overlay-time-status-renderer, badge-shape, .badge-shape-wiz__text, .yt-badge-shape__text, [class*='time-status'], .ytm-thumbnail-overlay-time-status-renderer",
    )) {
      const t = (b.textContent || "").trim();
      if (/^live$/i.test(t)) isLive = true;
      const d = Goosle.parseDuration(t);
      if (d !== undefined) {
        durationSec = d;
        break;
      }
    }

    const isShort =
      el.matches("ytd-reel-item-renderer, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2") ||
      !!el.querySelector("a[href^='/shorts/'], a[href*='youtube.com/shorts/']") ||
      /\bshorts\b/i.test(text(el, "ytd-thumbnail-overlay-time-status-renderer"));

    const description = text(el, "#description-text, .metadata-snippet-text, yt-formatted-string.metadata-snippet-text");

    return { title, channel, text: description, durationSec, isShort, isLive };
  }

  function css(s) {
    let c = "";
    if (s.hideAds)
      c += `
        ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-promoted-sparkles-web-renderer,
        ytd-promoted-video-renderer, ytd-display-ad-renderer, ytd-banner-promo-renderer, ytd-statement-banner-renderer,
        ytd-companion-slot-renderer, ytd-action-companion-ad-renderer, ytd-merch-shelf-renderer,
        ytd-primetime-promo-renderer, ytd-brand-video-shelf-renderer, ytd-brand-video-singleton-renderer,
        #masthead-ad, #player-ads, .ytp-ad-overlay-container, .ytp-ad-overlay-slot, .ytd-player-legacy-desktop-watch-ads-renderer,
        ytd-rich-item-renderer:has(ytd-ad-slot-renderer), ytd-rich-section-renderer:has(ytd-statement-banner-renderer),
        ytm-promoted-sparkles-web-renderer, ytm-companion-ad-renderer, ad-slot-renderer
        { display: none !important; }`;
    if (s.hideShorts)
      c += `
        ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts],
        ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
        grid-shelf-view-model:has(ytm-shorts-lockup-view-model), grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2),
        ytd-guide-entry-renderer:has(a[href="/shorts/"]), ytd-guide-entry-renderer:has(a[title="Shorts"]),
        ytd-mini-guide-entry-renderer:has(a[href="/shorts/"]), ytd-mini-guide-entry-renderer[aria-label="Shorts"],
        yt-tab-shape[tab-title="Shorts"], ytm-reel-shelf-renderer, ytm-pivot-bar-item-renderer:has(.pivot-shorts)
        { display: none !important; }`;
    if (s.hideRecommendations)
      c += `
        ytd-browse[page-subtype="home"] ytd-rich-grid-renderer,
        ytm-browse ytm-rich-grid-renderer,
        #related, ytd-watch-next-secondary-results-renderer, ytm-item-section-renderer[section-identifier="related-items"],
        .ytp-endscreen-content, .ytp-ce-element, .ytp-autonav-endscreen-countdown-overlay, .ytp-suggestion-set,
        ytd-search ytd-shelf-renderer, ytd-search ytd-horizontal-card-list-renderer,
        ytd-guide-entry-renderer:has(a[href="/feed/trending"]), ytd-guide-entry-renderer:has(a[href^="/feed/explore"]),
        ytd-guide-section-renderer:has(a[href="/feed/trending"])
        { display: none !important; }
        ytd-watch-flexy #secondary { min-width: 0 !important; }`;
    if (s.hideComments) c += `#comments, ytd-comments, ytm-comment-section-renderer { display: none !important; }`;
    c += `
      #goosle-home { max-width: 760px; margin: 40px auto; padding: 0 16px; font-family: Roboto, system-ui, sans-serif;
        color: var(--yt-spec-text-primary, #0f0f0f); }
      #goosle-home h2 { font-size: 24px; margin: 0 0 6px; font-weight: 600; }
      #goosle-home p { font-size: 14px; color: var(--yt-spec-text-secondary, #606060); margin: 0 0 16px; }
      #goosle-home .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
      #goosle-home a, #goosle-home button { font: 500 14px/1 Roboto, system-ui, sans-serif; padding: 10px 16px; border-radius: 999px;
        background: var(--yt-spec-badge-chip-background, #f2f2f2); color: inherit; text-decoration: none; border: 0; cursor: pointer; }
      #goosle-home a:hover, #goosle-home button:hover { background: var(--yt-spec-button-chip-background-hover, #e5e5e5); }`;
    return c;
  }

  function route(s, url) {
    const p = url.pathname;
    if (s.hideShorts && p.startsWith("/shorts/")) {
      const id = p.split("/")[2];
      // Open it as a normal video instead of the endless Shorts scroller.
      if (id) location.replace(`/watch?v=${id}`);
      else Goosle.blockPage("Shorts are turned off", "Goosle keeps YouTube to long-form videos.");
      return;
    }
    if (s.hideShorts && /^\/(@[^/]+|channel\/[^/]+)\/shorts\/?$/.test(p)) {
      location.replace(p.replace(/\/shorts\/?$/, "/videos"));
      return;
    }
    if (s.hideRecommendations && /^\/feed\/(trending|explore)/.test(p)) {
      Goosle.blockPage("Trending is turned off", "These pages are picked by YouTube's algorithm, not by you.");
    }
  }

  /* Replaces the algorithmic home page with your focus for the week. */
  function homePanel(s) {
    const onHome = location.pathname === "/";
    let panel = document.getElementById("goosle-home");
    if (!onHome || !s.hideRecommendations) {
      panel && panel.remove();
      return;
    }
    const host = document.querySelector('ytd-browse[page-subtype="home"] #primary, ytm-browse');
    if (!host) return;
    const sig = JSON.stringify([s.focus, s.mode, s.favorites]);
    if (panel && panel.dataset.sig === sig && panel.parentElement === host) return;
    panel && panel.remove();

    panel = document.createElement("div");
    panel.id = "goosle-home";
    panel.dataset.sig = sig;
    const stale = Goosle.focusIsStale(s);

    const h = document.createElement("h2");
    const p = document.createElement("p");
    const chips = document.createElement("div");
    chips.className = "chips";

    if (s.focus.topics.length) {
      h.textContent = "This week you're learning";
      p.textContent = stale
        ? "These were set more than a week ago. Update them for this week?"
        : "Pick a topic. Results are filtered to long-form videos without Shorts, ads or slop.";
      for (const t of s.focus.topics) {
        const a = document.createElement("a");
        a.href = `/results?search_query=${encodeURIComponent(t)}`;
        a.textContent = t;
        chips.append(a);
      }
    } else {
      h.textContent = "What do you want to learn this week?";
      p.textContent = "Tell Goosle a few topics and this page will only point you at those, instead of the algorithm.";
    }
    const edit = document.createElement("button");
    edit.textContent = s.focus.topics.length ? "Change this week's topics" : "Set this week's topics";
    edit.onclick = () => chrome.runtime.sendMessage({ type: "openOptions" });
    chips.append(edit);

    const subs = document.createElement("div");
    subs.className = "chips";
    const a = document.createElement("a");
    a.href = "/feed/subscriptions";
    a.textContent = "Subscriptions";
    subs.append(a);
    for (const f of s.favorites.slice(0, 12)) {
      const fa = document.createElement("a");
      fa.href = `/results?search_query=${encodeURIComponent(f)}`;
      fa.textContent = f;
      subs.append(fa);
    }
    const p2 = document.createElement("p");
    p2.textContent = "Or go to your channels:";

    panel.append(h, p, chips, p2, subs);
    host.prepend(panel);
  }

  /* Skips and mutes in-video ads when YouTube lets you. */
  let mutedByUs = false;
  function playerAds(s) {
    if (!s.hideAds) return;
    const player = document.querySelector("#movie_player, .html5-video-player");
    const video = player && player.querySelector("video");
    if (!player || !video) return;
    if (player.classList.contains("ad-showing")) {
      const skip = player.querySelector(".ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern");
      if (skip) skip.click();
      if (!video.muted) {
        video.muted = true;
        mutedByUs = true;
      }
    } else if (mutedByUs) {
      video.muted = false;
      mutedByUs = false;
    }
  }

  function scan(s) {
    homePanel(s);
    playerAds(s);

    // Only judge outermost tiles (lockups are nested inside rich items).
    for (const el of document.querySelectorAll(TILES)) {
      const outer = el.parentElement && el.parentElement.closest(TILES);
      if (outer) continue;
      const t = readTile(el);
      if (!t.title) continue;
      Goosle.once(el, `${t.title}|${t.channel}|${t.text.length}|${t.durationSec}|${t.isShort}`, () => {
        // Don't filter the video you're watching or your own playlists/history.
        const ownList = /^\/(playlist|feed\/(history|playlists|library|you))/.test(location.pathname);
        Goosle.apply(el, ownList ? null : Goosle.judge(t, s, { video: true }));
      });
    }

    // The "Shorts" filter chip on search and home.
    if (s.hideShorts) {
      for (const chip of document.querySelectorAll("yt-chip-cloud-chip-renderer")) {
        if (chip.textContent.trim() === "Shorts") chip.style.setProperty("display", "none", "important");
      }
    }

    // News shelves ("Breaking news", "Top news").
    if (s.hideNews) {
      for (const shelf of document.querySelectorAll("ytd-rich-section-renderer, ytd-shelf-renderer, ytd-rich-shelf-renderer")) {
        const title = (shelf.querySelector("#title, h2")?.textContent || "").trim();
        if (/\bnews\b/i.test(title)) Goosle.hide(shelf, "news");
      }
    }
  }

  // Player ads need a quicker check than page changes give us.
  setInterval(() => {
    const s = Goosle.settings();
    if (s && s.enabled && s.sites.youtube) playerAds(s);
  }, 300);

  Goosle.start({ site: "youtube", css, route, scan });
})();

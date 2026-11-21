/* TikTok is almost entirely algorithmic short video, so the options are blunt. */
(function () {
  function css(s) {
    if (s.tiktok !== "following") return "";
    // Keep the Following tab; hide For You and Explore links.
    return `
      a[href="/foryou"], a[href="/"][data-e2e="nav-foryou"], a[data-e2e="nav-foryou"],
      a[href="/explore"], a[data-e2e="nav-explore"], a[href^="/live"], a[data-e2e="nav-live"]
      { display: none !important; }`;
  }

  function route(s, url) {
    if (s.tiktok === "block") {
      Goosle.blockPage(
        "TikTok is turned off",
        "It's an endless, algorithm-picked short-video feed. You can switch it to 'Following only' in Goosle's settings.",
      );
      return;
    }
    if (s.tiktok === "following") {
      const p = url.pathname;
      if (p === "/" || p.startsWith("/foryou") || p.startsWith("/explore") || p.startsWith("/live")) {
        location.replace("/following");
      }
    }
  }

  function scan(s) {
    if (s.tiktok === "block") return;
    for (const item of document.querySelectorAll('[data-e2e="recommend-list-item-container"], article')) {
      Goosle.once(item, String(item.textContent.length), () => {
        const text = item.innerText || "";
        let reason = null;
        if (s.hideAds && /(^|\n)\s*(Sponsored|Ad|Promoted)\s*(\n|$)/.test(text)) reason = "ad";
        else {
          const author = item.querySelector('[data-e2e="video-author-uniqueid"], a[href^="/@"]')?.textContent || "";
          reason = Goosle.judge({ title: text.slice(0, 1500), channel: author }, s);
        }
        Goosle.apply(item, reason);
      });
    }
  }

  Goosle.start({ site: "tiktok", css, route, scan });
})();

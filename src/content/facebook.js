/* Facebook rules. Facebook obfuscates its markup heavily; detection here is best-effort. */
(function () {
  function css(s) {
    let c = "";
    if (s.hideShorts)
      c += `
        a[href*="/reel/"][role="link"][aria-label="Reels"], a[href$="facebook.com/reel/"], a[href="/reel/"],
        div[aria-label="Reels"], div[aria-label="Stories"][role="region"] a[href*="/reel/"]
        { display: none !important; }`;
    if (s.hideRecommendations)
      c += `
        a[href="/watch/"], a[href$="facebook.com/watch/"], a[aria-label="Video"][href*="/watch"],
        a[href*="/gaming/"][aria-label="Gaming"]
        { display: none !important; }`;
    return c;
  }

  function route(s, url) {
    const p = url.pathname;
    if (s.hideShorts && /^\/(reel|reels)\b/.test(p)) {
      Goosle.blockPage("Reels are turned off", "Goosle keeps Facebook to posts from people and pages you chose.");
      return;
    }
    if (s.hideRecommendations && /^\/watch\/?$/.test(p) && !url.searchParams.get("v")) {
      Goosle.blockPage("The Video feed is turned off", "It's picked by Facebook's algorithm, not by you.");
      return;
    }
    // "Feeds → Most recent" is chronological and skips most suggested content.
    if (s.facebookMostRecent && (p === "/" || p === "/home.php") && !url.searchParams.get("sk")) {
      location.replace("/?filter=all&sk=h_chr");
    }
  }

  const SUGGESTED = /suggested for you|people you may know|reels and short videos|follow\b.*\bsuggested|sponsored/i;

  function scan(s) {
    const posts = document.querySelectorAll('[role="feed"] > div, div[aria-posinset], div[data-pagelet^="FeedUnit"]');
    for (const post of posts) {
      const sig = String(post.textContent.length) + "|" + post.childElementCount;
      Goosle.once(post, sig, () => {
        let reason = null;
        const text = post.innerText || "";
        const isAd =
          post.querySelector('a[href*="/ads/about"], a[href*="ads/preferences"], a[aria-label="Sponsored"], a[href^="/ads/"]') ||
          /(^|\n)\s*Sponsored\s*(\n|·|$)/.test(text);
        if (s.hideAds && isAd) reason = "ad";
        else if (s.hideShorts && post.querySelector('a[href*="/reel/"]')) reason = "short-form";
        else if (s.hideRecommendations && SUGGESTED.test(text.slice(0, 400))) reason = "suggested";
        else {
          const author = post.querySelector("h2 a, h3 a, h4 a, strong a")?.textContent || "";
          reason = Goosle.judge({ title: text.slice(0, 2000), channel: author }, s);
        }
        Goosle.apply(post, reason);
      });
    }
  }

  Goosle.start({ site: "facebook", css, route, scan });
})();

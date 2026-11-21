/* Instagram rules. Instagram changes its markup often; these rules lean on links and text, not class names. */
(function () {
  function css(s) {
    let c = "";
    if (s.hideShorts)
      c += `a[href="/reels/"], a[href^="/reels/"] { display: none !important; }`;
    if (s.hideRecommendations)
      c += `a[href="/explore/"], a[href^="/explore/"] { display: none !important; }`;
    return c;
  }

  function route(s, url) {
    const p = url.pathname;
    if (s.hideShorts && /^\/(reels|reel)\b/.test(p)) {
      Goosle.blockPage("Reels are turned off", "Goosle keeps Instagram to posts from people you follow.");
      return;
    }
    if (s.hideRecommendations && p.startsWith("/explore")) {
      Goosle.blockPage("Explore is turned off", "Explore is chosen by Instagram's algorithm, not by you.");
      return;
    }
    // The "Following" feed is chronological and only has accounts you follow.
    if (s.instagramFollowingOnly && p === "/" && url.searchParams.get("variant") !== "following") {
      location.replace("/?variant=following");
    }
  }

  const SPONSORED = /^(sponsored|paid partnership.*|ad)$/i;
  const SUGGESTED = /suggested for you|suggested posts|suggested reels|because you watched/i;

  function scan(s) {
    for (const post of document.querySelectorAll("article")) {
      const link = post.querySelector('a[href*="/p/"], a[href*="/reel/"]');
      const sig = (link ? link.getAttribute("href") : "") + "|" + post.textContent.length;
      Goosle.once(post, sig, () => {
        let reason = null;
        if (s.hideAds && [...post.querySelectorAll("span, a, div")].some((e) => e.childElementCount === 0 && SPONSORED.test(e.textContent.trim())))
          reason = "ad";
        else if (s.hideRecommendations && SUGGESTED.test(post.textContent)) reason = "suggested";
        else if (s.hideShorts && (post.querySelector('a[href*="/reel/"]') || post.querySelector("video"))) reason = "short-form";
        else {
          const user = post.querySelector("header a[href^='/']")?.getAttribute("href")?.replaceAll("/", "") || "";
          reason = Goosle.judge({ title: post.innerText.slice(0, 2000), channel: user }, s);
        }
        Goosle.apply(post, reason);
      });
    }

    // "Suggested for you" blocks between posts.
    if (s.hideRecommendations) {
      for (const h of document.querySelectorAll("main span, main h2, main h3")) {
        if (h.childElementCount === 0 && /^(suggested for you|suggested reels|suggested posts)$/i.test(h.textContent.trim())) {
          const block = h.closest("article") || h.closest("main > div > div > div > div");
          if (block) Goosle.hide(block, "suggested");
        }
      }
    }
  }

  Goosle.start({ site: "instagram", css, route, scan });
})();

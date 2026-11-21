/* Decides whether a piece of content should be hidden. Pure functions, no DOM. */
var Goosle = (globalThis.Goosle = globalThis.Goosle || {});

(function () {
  const reCache = new Map();

  function wordRe(word) {
    const w = String(word).trim().toLowerCase();
    if (!w) return null;
    if (!reCache.has(w)) {
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Whole word/phrase, so "sora" doesn't match "Soraya" and "#ai" doesn't match "#aircraft".
      reCache.set(w, new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u"));
    }
    return reCache.get(w);
  }

  /** First word/phrase from `words` found in `text`, or null. */
  Goosle.findWord = function (text, words) {
    if (!text || !words || !words.length) return null;
    const t = text.toLowerCase();
    for (const w of words) {
      const re = wordRe(w);
      if (re && re.test(t)) return w;
    }
    return null;
  };

  const sameName = (a, b) => a && b && a.trim().toLowerCase().replace(/^@/, "") === b.trim().toLowerCase().replace(/^@/, "");
  Goosle.channelIn = (channel, list) => !!channel && list.some((c) => sameName(channel, c));

  const topicCache = new Map();
  function topicWordRe(word) {
    if (!topicCache.has(word)) {
      // Singular/plural both count: "truss" matches "trusses", "foundations" matches "foundation".
      const forms = new Set([word, word + "s", word + "es"]);
      if (word.length > 3 && word.endsWith("es")) forms.add(word.slice(0, -2));
      if (word.length > 3 && word.endsWith("s")) forms.add(word.slice(0, -1));
      const alt = [...forms].map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
      topicCache.set(word, new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})(?![\\p{L}\\p{N}])`, "u"));
    }
    return topicCache.get(word);
  }

  /** A focus topic matches when every word in it appears (in any order, singular or plural). */
  Goosle.matchTopic = function (text, topics) {
    const t = (text || "").toLowerCase();
    for (const topic of topics) {
      const words = topic.toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length && words.every((w) => topicWordRe(w).test(t))) return topic;
    }
    return null;
  };

  /** "1:02:03" -> 3723. Returns undefined for anything that isn't a duration. */
  Goosle.parseDuration = function (s) {
    const m = String(s || "").trim().match(/^(\d{1,2}:)?\d{1,2}:\d{2}$/);
    if (!m) return undefined;
    return s.trim().split(":").reduce((acc, p) => acc * 60 + Number(p), 0);
  };

  /**
   * item: { title, channel, text?, durationSec?, isShort?, isLive? }
   * opts: { video: true } enables mode and length rules (for video sites, not friends' posts).
   * Returns a short human reason, or null to keep it.
   */
  Goosle.judge = function (item, s, opts = {}) {
    const text = [item.title, item.channel, item.text].filter(Boolean).join("\n");

    if (Goosle.channelIn(item.channel, s.blockedChannels)) return "blocked channel";
    if (s.hideShorts && item.isShort) return "short-form";

    let w = Goosle.findWord(text, s.blockedWords);
    if (w) return `blocked word "${w}"`;

    if (s.hideSlop && (w = Goosle.findWord(text, s.slopWords))) return `AI/slop "${w}"`;

    if (s.hideNews) {
      if (Goosle.channelIn(item.channel, s.newsChannels)) return "news channel";
      if ((w = Goosle.findWord(text, s.newsWords))) return `news "${w}"`;
    }

    if (!opts.video) return null;

    // Favourite channels and focus topics always beat the entertainment filter.
    const fav = Goosle.channelIn(item.channel, s.favorites);
    const topic = Goosle.matchTopic(text, s.focus.topics);

    if (s.noEntertainment && !fav && !topic && (w = Goosle.findWord(item.title, s.entertainmentWords)))
      return `entertainment "${w}"`;

    if (item.durationSec !== undefined && !item.isLive) {
      if (s.minMinutes > 0 && item.durationSec < s.minMinutes * 60) return `under ${s.minMinutes} min`;
      if (s.maxMinutes > 0 && item.durationSec > s.maxMinutes * 60) return `over ${s.maxMinutes} min`;
    }

    switch (s.mode) {
      case "focus":
        if (s.focus.topics.length && !topic && !fav) return "not in this week's focus";
        break;
      case "tutorials":
        if (!topic && !Goosle.findWord(text, s.tutorialWords)) return "not a tutorial";
        break;
      case "music":
        if (!/ - topic$|vevo$/i.test(item.channel || "") && !Goosle.findWord(text, s.musicWords)) return "not music";
        break;
      case "favorites":
        if (!fav) return "not a favourite channel";
        break;
    }
    return null;
  };
})();

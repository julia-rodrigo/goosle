/* Default settings. Loaded by content scripts, the popup and the options page. */
var Goosle = (globalThis.Goosle = globalThis.Goosle || {});

Goosle.SITES = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
};

Goosle.MODES = {
  everything: "Everything (filters still apply)",
  focus: "Only this week's focus topics",
  tutorials: "Only tutorials and lessons",
  music: "Only music",
  favorites: "Only my favourite channels",
};

Goosle.DEFAULTS = {
  enabled: true,
  sites: { youtube: true, instagram: true, facebook: true, tiktok: true },

  // What to hide
  hideShorts: true, // Shorts, Reels, TikTok-style short video
  hideAds: true, // ad slots and sponsored posts
  hideRecommendations: true, // algorithmic home feeds, sidebars, Explore, "suggested for you"
  hideNews: false,
  hideSlop: true,
  hideComments: false,
  noEntertainment: false,

  // What you see (video sites)
  mode: "everything",
  focus: { topics: [], setOn: null },
  favorites: [],
  minMinutes: 8,
  maxMinutes: 0,

  // Per-site
  tiktok: "block", // block | following | allow
  instagramFollowingOnly: true,
  facebookMostRecent: true,

  // Colour
  grayscale: false,

  // Breaks
  breaks: { enabled: true, everyMinutes: 20, breakSeconds: 60, dailyLimitMinutes: 60 },

  // Lists
  blockedChannels: [],
  blockedWords: [],
  slopWords: [
    "ai generated", "ai-generated", "made with ai", "made by ai", "100% ai",
    "#ai", "#aiart", "#aivideo", "#aigenerated", "#aimusic", "#aianimation",
    "ai art", "ai music", "ai song", "ai cover", "ai voice", "ai animation",
    "ai story", "ai video", "ai movie", "ai trailer", "ai influencer",
    "midjourney", "stable diffusion", "sora", "veo 3", "suno", "udio", "kling ai",
    "chatgpt wrote", "reddit stories", "#redditstories", "text to speech",
    "aita", "faceless channel",
  ],
  newsWords: [
    "breaking news", "breaking:", "news", "live updates", "headlines",
    "election", "elections", "politics", "political", "president", "prime minister",
    "parliament", "congress", "senate", "invasion",
    "scandal", "tariff", "tariffs", "press conference",
  ],
  newsChannels: [
    "CNN", "Fox News", "MSNBC", "BBC News", "Sky News", "ABC News", "CBS News",
    "NBC News", "Al Jazeera English", "Reuters", "Associated Press", "The Guardian",
    "DW News", "FRANCE 24 English", "Bloomberg Television", "CNBC", "Forbes Breaking News",
    "Global News", "Times Radio", "GB News", "Daily Mail", "New York Post", "LiveNOW from FOX",
  ],
  entertainmentWords: [
    "prank", "pranks", "reaction", "reacts", "reacting", "challenge", "funny", "fails",
    "meme", "memes", "compilation", "vlog", "drama", "tier list", "gameplay",
    "let's play", "lets play", "mukbang", "unboxing", "gone wrong", "try not to laugh",
    "celebrity", "gossip", "storytime",
  ],
  tutorialWords: [
    "tutorial", "how to", "how-to", "explained", "explainer", "course", "lesson",
    "lecture", "guide", "learn", "learning", "beginner", "beginners", "walkthrough",
    "step by step", "crash course", "masterclass", "introduction to", "intro to",
    "fundamentals", "basics", "class", "workshop", "deep dive", "documentary",
  ],
  musicWords: [
    "official music video", "music video", "official video", "official audio", "audio",
    "lyrics", "lyric video", "live session", "concert", "album", "full album", "song",
    "ft.", "feat.", "remix", "acoustic", "cover", "live at", "tiny desk", "mv",
  ],
};

/** Read settings, filling in anything missing from defaults (one level deep for objects). */
Goosle.mergeDefaults = function (stored) {
  const out = {};
  for (const [k, v] of Object.entries(Goosle.DEFAULTS)) {
    const s = stored ? stored[k] : undefined;
    if (s === undefined) out[k] = structuredClone(v);
    else if (v && typeof v === "object" && !Array.isArray(v)) out[k] = { ...v, ...s };
    else out[k] = s;
  }
  return out;
};

Goosle.loadSettings = async function () {
  const stored = await chrome.storage.sync.get(null);
  return Goosle.mergeDefaults(stored);
};

/** Save one or more top-level keys. Each key is its own sync item to stay under per-item size limits. */
Goosle.saveSettings = function (patch) {
  return chrome.storage.sync.set(patch);
};

/** Focus topics are for one week. Returns true when they're older than 7 days or never set. */
Goosle.focusIsStale = function (s) {
  if (!s.focus.setOn || !s.focus.topics.length) return true;
  return Date.now() - new Date(s.focus.setOn).getTime() > 7 * 24 * 3600 * 1000;
};

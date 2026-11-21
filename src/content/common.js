/*
 * Shared engine for every site. A site script calls Goosle.start({ ... }) with:
 *   site:   "youtube" | "instagram" | "facebook" | "tiktok"
 *   css(s): CSS to inject for these settings (fast, no flicker)
 *   route(s, url): called on every URL change; may redirect or Goosle.blockPage(...)
 *   scan(s): called (throttled) whenever the page changes; hides items with Goosle.hide(el, reason)
 */
var Goosle = (globalThis.Goosle = globalThis.Goosle || {});

(function () {
  const ATTR = "data-goosle-hide";
  let site = null;
  let hooks = null;
  let settings = null;
  let lastUrl = "";
  let scanTimer = 0;
  let reveal = false;

  /* ---------------------------------------------------------------- */
  /* Hiding                                                            */
  /* ---------------------------------------------------------------- */

  Goosle.hide = function (el, reason) {
    if (el && el.getAttribute(ATTR) !== reason) el.setAttribute(ATTR, reason);
  };
  Goosle.show = function (el) {
    if (el && el.hasAttribute(ATTR)) el.removeAttribute(ATTR);
  };
  /** Hide or show `el` depending on `reason`. */
  Goosle.apply = (el, reason) => (reason ? Goosle.hide(el, reason) : Goosle.show(el));

  function clearAll() {
    document.querySelectorAll(`[${ATTR}]`).forEach((el) => el.removeAttribute(ATTR));
    document.querySelectorAll("[data-goosle-sig]").forEach((el) => el.removeAttribute("data-goosle-sig"));
  }

  /**
   * Run `fn` only when `sig` changed since the last time for this element.
   * Saves work on big feeds where the observer fires constantly.
   */
  Goosle.once = function (el, sig, fn) {
    if (el.getAttribute("data-goosle-sig") === sig) return;
    el.setAttribute("data-goosle-sig", sig);
    fn();
  };

  /* ---------------------------------------------------------------- */
  /* Styles                                                            */
  /* ---------------------------------------------------------------- */

  function baseCss(s) {
    let css = `
      html:not(.goosle-reveal) [${ATTR}] { display: none !important; }
      html.goosle-reveal [${ATTR}] { opacity: .35 !important; outline: 2px dashed #e0703f !important; }
    `;
    if (s.grayscale) css += `html { filter: grayscale(1) !important; }`;
    return css;
  }

  function injectStyles() {
    let el = document.getElementById("goosle-style");
    if (!el) {
      el = document.createElement("style");
      el.id = "goosle-style";
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = active() ? baseCss(settings) + (hooks.css ? hooks.css(settings) : "") : "";
  }

  const active = () => settings && settings.enabled && settings.sites[site];

  /* ---------------------------------------------------------------- */
  /* Scanning                                                          */
  /* ---------------------------------------------------------------- */

  function scanSoon() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      if (!active()) return;
      checkUrl();
      try {
        hooks.scan && hooks.scan(settings);
      } catch (e) {
        console.debug("[Goosle] scan error", e);
      }
      updateBadge();
    }, 200);
  }

  function checkUrl() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    removeBlockPage();
    if (active() && hooks.route) hooks.route(settings, new URL(location.href));
  }

  /* ---------------------------------------------------------------- */
  /* "Hid N" badge                                                     */
  /* ---------------------------------------------------------------- */

  function updateBadge() {
    const hidden = document.querySelectorAll(`[${ATTR}]`);
    let badge = document.getElementById("goosle-badge");
    if (!hidden.length) {
      badge && badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement("button");
      badge.id = "goosle-badge";
      badge.type = "button";
      badge.style.cssText = `
        position:fixed;left:12px;bottom:12px;z-index:2147483000;border:0;border-radius:999px;
        padding:6px 12px;font:500 12px/1.2 system-ui,sans-serif;background:#1c1b19;color:#f3efe8;
        box-shadow:0 2px 10px rgba(0,0,0,.25);cursor:pointer;opacity:.85`;
      badge.addEventListener("click", () => {
        reveal = !reveal;
        document.documentElement.classList.toggle("goosle-reveal", reveal);
        updateBadge();
      });
      document.documentElement.appendChild(badge);
    }
    const counts = {};
    hidden.forEach((el) => {
      const r = el.getAttribute(ATTR).replace(/ ".*"$/, "");
      counts[r] = (counts[r] || 0) + 1;
    });
    badge.textContent = reveal ? `Showing ${hidden.length} hidden · hide again` : `Goosle hid ${hidden.length}`;
    badge.title = Object.entries(counts)
      .map(([r, n]) => `${n} × ${r}`)
      .join("\n") + "\n\nClick to see them";
  }

  /* ---------------------------------------------------------------- */
  /* Full-page overlays (block pages, breaks, limits)                  */
  /* ---------------------------------------------------------------- */

  function pauseMedia() {
    document.querySelectorAll("video, audio").forEach((m) => {
      try {
        m.pause();
      } catch (_) {}
    });
  }

  /** Builds a full-screen card in a shadow root so site CSS can't touch it. */
  function overlay(id, build) {
    let host = document.getElementById(id);
    if (host) return host;
    host = document.createElement("div");
    host.id = id;
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647;filter:none";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        .wrap { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px;
          background: rgba(20,19,18,.96); color: #f3efe8; font: 16px/1.5 system-ui, -apple-system, sans-serif; }
        .card { width: min(460px, 100%); text-align: center; }
        h1 { font-size: 26px; line-height: 1.2; margin: 0 0 10px; font-weight: 650; letter-spacing: -.01em; }
        p { margin: 0 0 16px; color: #bdb6ab; }
        .row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 18px; }
        button { font: inherit; font-size: 14px; font-weight: 600; border-radius: 999px; padding: 9px 18px;
          border: 1px solid #4a4743; background: transparent; color: inherit; cursor: pointer; }
        button.primary { background: #f3efe8; color: #1c1b19; border-color: #f3efe8; }
        button:disabled { opacity: .4; cursor: not-allowed; }
        input { width: 100%; font: inherit; padding: 10px 14px; border-radius: 12px; border: 1px solid #4a4743;
          background: #23211f; color: inherit; margin-top: 4px; }
        .phrase { font-style: italic; color: #f3efe8; }
        .breath { width: 120px; height: 120px; margin: 8px auto 18px; border-radius: 50%;
          background: radial-gradient(circle, #e0703f 0%, #c4542c 70%); animation: breathe 8s ease-in-out infinite; }
        @keyframes breathe { 0%,100% { transform: scale(.55); opacity: .7 } 50% { transform: scale(1); opacity: 1 } }
        .count { font-variant-numeric: tabular-nums; font-size: 14px; color: #bdb6ab; }
      </style>
      <div class="wrap"><div class="card"></div></div>`;
    build(root.querySelector(".card"), () => host.remove());
    document.documentElement.appendChild(host);
    pauseMedia();
    return host;
  }

  function el(tag, attrs = {}, text = "") {
    const e = document.createElement(tag);
    Object.assign(e, attrs);
    if (text) e.textContent = text;
    return e;
  }

  Goosle.blockPage = function (title, message, { canContinue = false } = {}) {
    overlay("goosle-block", (card, close) => {
      card.append(el("h1", {}, title), el("p", {}, message));
      const row = el("div", { className: "row" });
      const back = el("button", { className: "primary" }, "Go back");
      back.onclick = () => (history.length > 1 ? history.back() : location.assign(location.origin));
      row.append(back);
      if (canContinue) {
        const go = el("button", {}, "Show it anyway");
        go.onclick = close;
        row.append(go);
      }
      card.append(row);
    });
    // Keep media paused while blocked (sites autoplay after navigation).
    const t = setInterval(() => (document.getElementById("goosle-block") ? pauseMedia() : clearInterval(t)), 500);
  };

  function removeBlockPage() {
    const b = document.getElementById("goosle-block");
    if (b) b.remove();
  }

  /* ---------------------------------------------------------------- */
  /* Time tracking + breaks                                            */
  /* ---------------------------------------------------------------- */

  const TICK = 15;
  const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);
  const siteName = () => Goosle.SITES[site];

  function showBreak(minutes) {
    overlay("goosle-break", (card, close) => {
      const secs = settings.breaks.breakSeconds;
      card.append(
        el("h1", {}, "Time for a short break"),
        el(
          "p",
          {},
          (minutes > 0 ? `You've been on ${siteName()} for ${minutes} minutes. ` : "") +
            "Look away from the screen and breathe with the circle.",
        ),
        el("div", { className: "breath" }),
      );
      const count = el("div", { className: "count" });
      const row = el("div", { className: "row" });
      const done = el("button", { className: "primary", disabled: true }, "I'm back");
      const leave = el("button", {}, `Close ${siteName()}`);
      leave.onclick = () => send({ type: "closeTab" });
      done.onclick = async () => {
        await send({ type: "breakTaken", site });
        close();
      };
      row.append(done, leave);
      card.append(count, row);

      let left = secs;
      const tick = () => {
        count.textContent = left > 0 ? `${left}s` : "Ready when you are.";
        if (left <= 0) {
          done.disabled = false;
          return;
        }
        left--;
        setTimeout(tick, 1000);
      };
      tick();
    });
  }

  const LIMIT_PHRASE = "I choose to spend 10 more minutes here";

  function showLimit(minutes) {
    overlay("goosle-limit", (card, close) => {
      card.append(
        el("h1", {}, `That's your ${minutes} minutes of ${siteName()} for today`),
        el("p", {}, "It'll unlock again tomorrow. If you really need a little more, type this exactly:"),
        el("p", { className: "phrase" }, LIMIT_PHRASE),
      );
      const input = el("input", { placeholder: "Type the sentence above", autocomplete: "off", spellcheck: false });
      input.addEventListener("paste", (e) => e.preventDefault());
      const row = el("div", { className: "row" });
      const more = el("button", { disabled: true }, "10 more minutes");
      const leave = el("button", { className: "primary" }, `Close ${siteName()}`);
      input.oninput = () => (more.disabled = input.value.trim() !== LIMIT_PHRASE);
      more.onclick = async () => {
        await send({ type: "moreTime", site, seconds: 600 });
        close();
      };
      leave.onclick = () => send({ type: "closeTab" });
      row.append(leave, more);
      card.append(input, row);
    });
  }

  async function heartbeat() {
    if (!active() || !settings.breaks.enabled) return;
    if (document.visibilityState !== "visible" || !document.hasFocus()) return;
    if (document.getElementById("goosle-break") || document.getElementById("goosle-limit")) {
      pauseMedia();
      return;
    }
    const r = await send({ type: "tick", site, seconds: TICK });
    if (!r) return;
    const b = settings.breaks;
    if (b.dailyLimitMinutes > 0 && r.today >= r.limit) showLimit(b.dailyLimitMinutes);
    else if (b.everyMinutes > 0 && r.session >= b.everyMinutes * 60) showBreak(Math.round(r.session / 60));
  }

  /* ---------------------------------------------------------------- */
  /* Boot                                                              */
  /* ---------------------------------------------------------------- */

  Goosle.start = async function (h) {
    site = h.site;
    hooks = h;
    settings = await Goosle.loadSettings();
    injectStyles();
    checkUrl();

    new MutationObserver(scanSoon).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("popstate", scanSoon);
    setInterval(() => location.href !== lastUrl && scanSoon(), 400); // SPA navigations
    setInterval(heartbeat, TICK * 1000);
    scanSoon();

    chrome.storage.onChanged.addListener(async (_changes, area) => {
      if (area !== "sync") return;
      settings = await Goosle.loadSettings();
      clearAll();
      injectStyles();
      lastUrl = "";
      scanSoon();
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "takeBreakNow") showBreak(0);
    });
  };

  Goosle.settings = () => settings;
})();

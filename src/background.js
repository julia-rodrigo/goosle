/*
 * Tracks time spent per site (only while a tab is visible and focused) for
 * break reminders and daily limits. Stored locally, never sent anywhere.
 */
const api = globalThis.browser ?? globalThis.chrome;
const SESSION_GAP_MS = 5 * 60 * 1000; // 5 minutes away counts as a natural break

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

async function getUsage() {
  const { usage } = await api.storage.local.get("usage");
  if (!usage || usage.day !== today()) return { day: today(), sites: {} };
  return usage;
}

async function getLimitMinutes() {
  const { breaks } = await api.storage.sync.get("breaks");
  return breaks?.dailyLimitMinutes ?? 60;
}

function siteState(usage, site) {
  return (usage.sites[site] ||= { today: 0, session: 0, lastTick: 0, bonus: 0 });
}

async function handle(msg, sender) {
  const usage = await getUsage();
  switch (msg.type) {
    case "tick": {
      const s = siteState(usage, msg.site);
      const now = Date.now();
      if (now - s.lastTick > SESSION_GAP_MS) s.session = 0;
      const secs = Math.min(Number(msg.seconds) || 0, 60);
      s.session += secs;
      s.today += secs;
      s.lastTick = now;
      await api.storage.local.set({ usage });
      const limit = (await getLimitMinutes()) * 60 + s.bonus;
      return { session: s.session, today: s.today, limit };
    }
    case "breakTaken": {
      siteState(usage, msg.site).session = 0;
      await api.storage.local.set({ usage });
      return { ok: true };
    }
    case "moreTime": {
      siteState(usage, msg.site).bonus += Math.min(Number(msg.seconds) || 0, 600);
      await api.storage.local.set({ usage });
      return { ok: true };
    }
    case "getUsage":
      return usage;
    case "closeTab":
      if (sender.tab?.id !== undefined) await api.tabs.remove(sender.tab.id);
      return { ok: true };
    case "openOptions":
      await api.runtime.openOptionsPage();
      return { ok: true };
  }
  return null;
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse, () => sendResponse(null));
  return true;
});

api.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") api.runtime.openOptionsPage();
});

const $ = (id) => document.getElementById(id);

const QUICK = [
  ["hideShorts", "No Shorts / Reels"],
  ["hideAds", "No ads"],
  ["hideRecommendations", "No algorithm feeds"],
  ["hideSlop", "No AI slop"],
  ["hideNews", "No news"],
  ["grayscale", "Grey screen"],
];

function fmt(secs) {
  const m = Math.round(secs / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

async function render() {
  const s = await Goosle.loadSettings();

  $("enabled").checked = s.enabled;
  $("main").classList.toggle("off", !s.enabled);

  // Focus
  const chips = $("focus-chips");
  chips.replaceChildren();
  if (s.focus.topics.length) {
    $("focus-text").textContent = Goosle.focusIsStale(s) ? "Set over a week ago. Time to update?" : "Only these show when 'Show me' is set to focus.";
    for (const t of s.focus.topics) {
      const c = document.createElement("span");
      c.className = "chip";
      c.style.paddingRight = "10px";
      c.textContent = t;
      chips.append(c);
    }
  } else {
    $("focus-text").textContent = "What do you want to learn this week?";
  }
  const edit = document.createElement("button");
  edit.className = "btn";
  edit.textContent = s.focus.topics.length ? "Edit" : "Set topics";
  edit.onclick = () => chrome.runtime.openOptionsPage();
  chips.append(edit);

  // Mode
  const mode = $("mode");
  mode.replaceChildren(...Object.entries(Goosle.MODES).map(([v, label]) => new Option(label, v, false, v === s.mode)));
  mode.onchange = () => Goosle.saveSettings({ mode: mode.value });

  // Toggles
  $("toggles").replaceChildren(
    ...QUICK.map(([key, label]) => {
      const row = document.createElement("label");
      row.className = "row";
      row.style.padding = "7px 0";
      row.innerHTML = `<span class="label"></span><span class="switch"><input type="checkbox" /><span></span></span>`;
      row.querySelector(".label").textContent = label;
      const input = row.querySelector("input");
      input.checked = !!s[key];
      input.onchange = () => Goosle.saveSettings({ [key]: input.checked });
      return row;
    }),
  );

  // Usage
  const usage = (await chrome.runtime.sendMessage({ type: "getUsage" })) || { sites: {} };
  const limit = s.breaks.dailyLimitMinutes * 60;
  $("usage").replaceChildren(
    ...Object.entries(Goosle.SITES).map(([key, name]) => {
      const u = usage.sites[key] || { today: 0, bonus: 0 };
      const max = limit ? limit + (u.bonus || 0) : 3600;
      const row = document.createElement("div");
      row.className = "usage-row";
      row.innerHTML = `<span></span><div class="bar"><i></i></div><span class="num"></span>`;
      row.children[0].textContent = name;
      row.querySelector("i").style.width = `${Math.min(100, (u.today / max) * 100)}%`;
      row.children[2].textContent = fmt(u.today);
      return row;
    }),
  );
}

$("enabled").onchange = (e) => Goosle.saveSettings({ enabled: e.target.checked });
$("settings").onclick = () => chrome.runtime.openOptionsPage();
$("break").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "takeBreakNow" }).catch(() => {});
  window.close();
};
chrome.storage.onChanged.addListener(render);
render();

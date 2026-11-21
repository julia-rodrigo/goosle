let settings;

const getPath = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);

/** Save a value at "key" or "key.sub" (only one level of nesting is used). */
function save(path, value) {
  const [top, sub] = path.split(".");
  const v = sub ? { ...settings[top], [sub]: value } : value;
  settings[top] = v;
  return Goosle.saveSettings({ [top]: v });
}

function bindFields() {
  document.querySelector('select[data-key="mode"]').replaceChildren(
    ...Object.entries(Goosle.MODES).map(([v, label]) => new Option(label, v)),
  );
  for (const el of document.querySelectorAll("[data-key]")) {
    const key = el.dataset.key;
    const val = getPath(settings, key);
    if (el.type === "checkbox") {
      el.checked = !!val;
      el.onchange = () => save(key, el.checked);
    } else if (el.type === "number") {
      el.value = val;
      el.onchange = () => {
        const n = Math.max(Number(el.min) || 0, Math.min(Number(el.max) || 1e6, Math.round(Number(el.value) || 0)));
        el.value = n;
        save(key, n);
      };
    } else {
      el.value = val;
      el.onchange = () => save(key, el.value);
    }
  }
}

/** An editable list of words/names with an add box and removable chips. */
function listEditor(container, { get, set, placeholder, lower = true }) {
  const form = document.createElement("form");
  form.innerHTML = `<input class="input" /><button class="btn">Add</button>`;
  const input = form.querySelector("input");
  input.placeholder = placeholder;
  const chips = document.createElement("div");
  chips.className = "chips";
  container.replaceChildren(form, chips);

  const draw = () => {
    chips.replaceChildren(
      ...get().map((w) => {
        const c = document.createElement("span");
        c.className = "chip";
        c.append(w);
        const x = document.createElement("button");
        x.type = "button";
        x.textContent = "×";
        x.setAttribute("aria-label", `Remove ${w}`);
        x.onclick = async () => {
          await set(get().filter((v) => v !== w));
          draw();
        };
        c.append(x);
        return c;
      }),
    );
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const have = new Set(get().map((v) => v.toLowerCase()));
    const add = input.value
      .split(",")
      .map((w) => (lower ? w.trim().toLowerCase() : w.trim()))
      .filter((w) => w && !have.has(w.toLowerCase()));
    if (add.length) await set([...get(), ...add]);
    input.value = "";
    draw();
  };
  draw();
}

const LIST_HINTS = {
  favorites: "e.g. 3Blue1Brown, Veritasium",
  blockedChannels: "Channel or account name",
  blockedWords: "e.g. minecraft, crypto, celebrity",
  newsChannels: "e.g. CNN",
};

function bindLists() {
  for (const el of document.querySelectorAll("[data-list]")) {
    const key = el.dataset.list;
    const names = ["favorites", "blockedChannels", "newsChannels"].includes(key);
    listEditor(el, {
      get: () => settings[key],
      set: (v) => save(key, v),
      placeholder: LIST_HINTS[key] || "Add a word or phrase (commas for several)",
      lower: !names,
    });
  }

  const focusDate = document.getElementById("focus-date");
  const drawDate = () => {
    focusDate.textContent = settings.focus.setOn
      ? `Set on ${new Date(settings.focus.setOn).toLocaleDateString()}${Goosle.focusIsStale(settings) ? " (over a week ago)" : ""}.`
      : "";
  };
  listEditor(document.querySelector("[data-focus]"), {
    get: () => settings.focus.topics,
    set: async (topics) => {
      await save("focus", { topics, setOn: new Date().toISOString() });
      drawDate();
    },
    placeholder: "e.g. rust programming, japanese grammar, sourdough",
  });
  drawDate();
}

function bindData() {
  const msg = document.getElementById("msg");
  document.getElementById("export").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" }));
    a.download = "goosle-settings.json";
    a.click();
  };
  const file = document.getElementById("file");
  document.getElementById("import").onclick = () => file.click();
  file.onchange = async () => {
    try {
      const data = JSON.parse(await file.files[0].text());
      const clean = Goosle.mergeDefaults(data);
      await chrome.storage.sync.set(clean);
      msg.textContent = "Imported.";
      init();
    } catch {
      msg.textContent = "That file isn't a Goosle settings file.";
    }
    file.value = "";
  };
  document.getElementById("reset").onclick = async () => {
    if (!confirm("Reset all Goosle settings to defaults?")) return;
    await chrome.storage.sync.clear();
    msg.textContent = "Reset.";
    init();
  };
}

async function init() {
  settings = await Goosle.loadSettings();
  bindFields();
  bindLists();
}

bindData();
init();

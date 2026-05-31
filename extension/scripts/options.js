import { PRESETS } from "./constants.js";
import { inferSiteByUrl } from "./site-catalog.js";
import {
  createTargetId,
  formatRelativeTime,
  getNextDueAt,
  getStoredData,
  isTargetDue,
  saveSettings,
  saveTargets
} from "./storage.js";

const form = document.querySelector("[data-target-form]");
const list = document.querySelector("[data-targets]");
const presetContainer = document.querySelector("[data-presets]");
const resetButton = document.querySelector("[data-reset-form]");
const packFileInput = document.querySelector("[data-pack-file]");
const importUrlForm = document.querySelector("[data-import-url-form]");
const importStatus = document.querySelector("[data-import-status]");
const notificationsToggle = document.querySelector("[name='notificationsEnabled']");
const repeatMinutesInput = document.querySelector("[name='reminderRepeatMinutes']");
const snoozeMinutesInput = document.querySelector("[name='defaultSnoozeMinutes']");

let editTargetId = null;

function setImportStatus(message, isError = false) {
  importStatus.textContent = message;
  importStatus.style.color = isError ? "#991b1b" : "";
}

function applyPresetToForm(preset) {
  form.elements.title.value = preset.name;
  form.elements.url.value = preset.urlHint;
  form.elements.intervalHours.value = preset.intervalHours;
  form.elements.siteKey.value = preset.key;
  form.elements.autofillMode.value = preset.autofillMode || "manual";
}

function renderPresets() {
  PRESETS.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = `${preset.name} (${preset.game})`;
    button.addEventListener("click", () => applyPresetToForm(preset));
    presetContainer.appendChild(button);
  });
}

function syncDerivedFieldsFromUrl() {
  const inferredSite = inferSiteByUrl(form.elements.url.value);
  if (!inferredSite) {
    return;
  }

  if (!form.elements.siteKey.value) {
    form.elements.siteKey.value = inferredSite.key;
  }

  if (
    !form.elements.autofillMode.value ||
    form.elements.autofillMode.value === "manual"
  ) {
    form.elements.autofillMode.value = inferredSite.autofillMode || "manual";
  }

  if (!form.elements.title.value.trim()) {
    form.elements.title.value = inferredSite.name;
  }
}

function resetForm() {
  editTargetId = null;
  form.reset();
  form.elements.intervalHours.value = 24;
  form.elements.enabled.checked = true;
  form.elements.siteKey.value = "";
  form.elements.autofillMode.value = "manual";
}

function createRow(target) {
  const row = document.createElement("article");
  row.className = "target-row";

  const due = isTargetDue(target);
  const gameLabel = target.game ? ` • ${target.game}` : "";
  const packLabel = target.packName ? ` • Pack: ${target.packName}` : "";

  row.innerHTML = `
    <div class="target-row__body">
      <div class="target-row__title">
        <h3>${target.title}</h3>
        <span class="status ${due ? "status--due" : ""}">
          ${target.enabled ? (due ? "Due" : "Active") : "Paused"}
        </span>
      </div>
      <p><a href="${target.url}" target="_blank">${target.url}</a></p>
      <p class="muted">
        Interval: every ${target.intervalHours}h
        ${target.lastVotedAt ? `• Last vote ${formatRelativeTime(target.lastVotedAt)}` : "• Never voted yet"}
        ${target.enabled ? `• Next ${formatRelativeTime(getNextDueAt(target))}` : ""}
        ${gameLabel}
        ${packLabel}
      </p>
      ${target.nickname ? `<p class="muted">Nickname preset: ${target.nickname} • ${target.autofillMode || "manual"}</p>` : ""}
      ${target.notes ? `<p>${target.notes}</p>` : ""}
    </div>
    <div class="target-row__actions">
      <button class="button button--ghost" data-action="edit">Edit</button>
      <button class="button" data-action="voted">I voted</button>
      <button class="button button--ghost" data-action="toggle">${target.enabled ? "Pause" : "Resume"}</button>
      <button class="button button--danger" data-action="delete">Delete</button>
    </div>
  `;

  row.querySelector('[data-action="edit"]').addEventListener("click", () => {
    editTargetId = target.id;
    form.elements.title.value = target.title;
    form.elements.url.value = target.url;
    form.elements.intervalHours.value = target.intervalHours;
    form.elements.siteKey.value = target.siteKey || "";
    form.elements.nickname.value = target.nickname || "";
    form.elements.autofillMode.value = target.autofillMode || "manual";
    form.elements.notes.value = target.notes || "";
    form.elements.enabled.checked = target.enabled;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  row.querySelector('[data-action="voted"]').addEventListener("click", async () => {
    const { targets } = await getStoredData();
    const updatedTargets = targets.map((item) =>
      item.id === target.id
        ? { ...item, lastVotedAt: Date.now(), lastReminderAt: null, snoozedUntil: null }
        : item
    );
    await saveTargets(updatedTargets);
    await render();
  });

  row.querySelector('[data-action="toggle"]').addEventListener("click", async () => {
    const { targets } = await getStoredData();
    const updatedTargets = targets.map((item) =>
      item.id === target.id ? { ...item, enabled: !item.enabled } : item
    );
    await saveTargets(updatedTargets);
    await render();
  });

  row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    const { targets } = await getStoredData();
    const updatedTargets = targets.filter((item) => item.id !== target.id);
    await saveTargets(updatedTargets);
    if (editTargetId === target.id) {
      resetForm();
    }
    await render();
  });

  return row;
}

async function saveFormTarget(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const { targets } = await getStoredData();
  const currentTarget = editTargetId
    ? targets.find((item) => item.id === editTargetId)
    : null;
  const url = String(formData.get("url") || "").trim();
  const inferredSite = inferSiteByUrl(url);
  const explicitSiteKey = String(formData.get("siteKey") || "").trim();

  const nextTarget = {
    id: editTargetId || createTargetId(),
    title: String(formData.get("title")).trim(),
    url,
    intervalHours: Number(formData.get("intervalHours") || 24),
    siteKey: explicitSiteKey || inferredSite?.key || "",
    nickname: String(formData.get("nickname") || "").trim(),
    autofillMode: String(
      formData.get("autofillMode") || inferredSite?.autofillMode || "manual"
    ).trim(),
    notes: String(formData.get("notes") || "").trim(),
    enabled: form.elements.enabled.checked,
    game: currentTarget?.game || inferredSite?.game || "",
    packName: currentTarget?.packName || "",
    importSource: currentTarget?.importSource || "",
    lastVotedAt: currentTarget?.lastVotedAt || null,
    lastReminderAt: currentTarget?.lastReminderAt || null,
    snoozedUntil: currentTarget?.snoozedUntil || null
  };

  const updatedTargets = editTargetId
    ? targets.map((item) => (item.id === editTargetId ? nextTarget : item))
    : [nextTarget, ...targets];

  await saveTargets(updatedTargets);
  resetForm();
  await render();
}

async function savePreferenceChanges() {
  const settings = {
    notificationsEnabled: notificationsToggle.checked,
    reminderRepeatMinutes: Number(repeatMinutesInput.value || 180),
    defaultSnoozeMinutes: Number(snoozeMinutesInput.value || 60)
  };

  await saveSettings(settings);
}

async function importPackObject(pack, sourceLabel) {
  const result = await chrome.runtime.sendMessage({
    type: "import-pack",
    pack,
    sourceLabel
  });

  if (!result?.ok) {
    throw new Error(result?.error || "Import failed.");
  }

  setImportStatus(
    `Imported "${result.pack.packName}": ${result.stats.added} added, ${result.stats.updated} updated.`
  );
  await render();
}

async function handlePackFileChange() {
  const [file] = packFileInput.files || [];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const json = JSON.parse(text);
    await importPackObject(json, file.name);
    packFileInput.value = "";
  } catch (error) {
    setImportStatus(error?.message || "Could not import the selected file.", true);
  }
}

async function handleImportUrl(event) {
  event.preventDefault();
  const formData = new FormData(importUrlForm);
  const url = String(formData.get("packUrl") || "").trim();

  if (!url) {
    setImportStatus("Enter a vote pack URL first.", true);
    return;
  }

  try {
    const result = await chrome.runtime.sendMessage({
      type: "import-pack-url",
      url
    });

    if (!result?.ok) {
      throw new Error(result?.error || "Import failed.");
    }

    setImportStatus(
      `Imported "${result.pack.packName}" from URL: ${result.stats.added} added, ${result.stats.updated} updated.`
    );
    importUrlForm.reset();
    await render();
  } catch (error) {
    setImportStatus(error?.message || "Could not import the URL.", true);
  }
}

async function render() {
  const { settings, targets } = await getStoredData();
  list.innerHTML = "";

  notificationsToggle.checked = settings.notificationsEnabled;
  repeatMinutesInput.value = settings.reminderRepeatMinutes;
  snoozeMinutesInput.value = settings.defaultSnoozeMinutes;

  if (targets.length === 0) {
    list.innerHTML = '<p class="empty">No vote targets yet. Add your first server page above or import a server pack.</p>';
    return;
  }

  targets
    .slice()
    .sort((left, right) => Number(isTargetDue(right)) - Number(isTargetDue(left)))
    .forEach((target) => list.appendChild(createRow(target)));
}

form.addEventListener("submit", saveFormTarget);
form.elements.url.addEventListener("blur", syncDerivedFieldsFromUrl);
resetButton.addEventListener("click", resetForm);
packFileInput.addEventListener("change", handlePackFileChange);
importUrlForm.addEventListener("submit", handleImportUrl);
notificationsToggle.addEventListener("change", savePreferenceChanges);
repeatMinutesInput.addEventListener("change", savePreferenceChanges);
snoozeMinutesInput.addEventListener("change", savePreferenceChanges);

renderPresets();
resetForm();
render();

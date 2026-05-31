import { PRESETS } from "./constants.js";
import { buildExportPack } from "./packs.js";
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
const exportPackForm = document.querySelector("[data-export-pack-form]");
const copyPackButton = document.querySelector("[data-copy-pack]");
const exportStatus = document.querySelector("[data-export-status]");
const exportPreview = document.querySelector("[data-export-preview]");
const snippetForm = document.querySelector("[data-snippet-form]");
const copySnippetButton = document.querySelector("[data-copy-snippet]");
const snippetPreview = document.querySelector("[data-snippet-preview]");
const snippetStatus = document.querySelector("[data-snippet-status]");
const notificationsToggle = document.querySelector("[name='notificationsEnabled']");
const repeatMinutesInput = document.querySelector("[name='reminderRepeatMinutes']");
const snoozeMinutesInput = document.querySelector("[name='defaultSnoozeMinutes']");

let editTargetId = null;

function setStatus(node, message, isError = false) {
  node.textContent = message;
  node.style.color = isError ? "#991b1b" : "";
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

  if (!form.elements.autofillMode.value || form.elements.autofillMode.value === "manual") {
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

  setStatus(
    importStatus,
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
    setStatus(importStatus, error?.message || "Could not import the selected file.", true);
  }
}

async function handleImportUrl(event) {
  event.preventDefault();
  const formData = new FormData(importUrlForm);
  const url = String(formData.get("packUrl") || "").trim();

  if (!url) {
    setStatus(importStatus, "Enter a vote pack URL first.", true);
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

    setStatus(
      importStatus,
      `Imported "${result.pack.packName}" from URL: ${result.stats.added} added, ${result.stats.updated} updated.`
    );
    importUrlForm.reset();
    await render();
  } catch (error) {
    setStatus(importStatus, error?.message || "Could not import the URL.", true);
  }
}

async function buildPackJson() {
  const formData = new FormData(exportPackForm);
  const { targets } = await getStoredData();
  const pack = buildExportPack(
    {
      packName: formData.get("packName"),
      game: formData.get("game"),
      author: formData.get("author"),
      sourceUrl: formData.get("sourceUrl")
    },
    targets
  );

  return JSON.stringify(pack, null, 2);
}

function buildSnippetCode() {
  const packUrl = String(snippetForm.elements.packUrl.value || exportPackForm.elements.sourceUrl.value || "").trim();
  const installUrl = String(snippetForm.elements.installUrl.value || "https://chromewebstore.google.com/").trim();
  const buttonLabel = String(snippetForm.elements.buttonLabel.value || "Add to Vote Reminder").trim();

  if (!packUrl) {
    throw new Error("Enter a vote pack URL to generate the website snippet.");
  }

  return `<button id="vote-reminder-button" type="button">${escapeHtml(buttonLabel)}</button>

<script>
  (function () {
    var voteReminderInstalled = false;
    var packUrl = ${JSON.stringify(packUrl)};
    var installUrl = ${JSON.stringify(installUrl)};
    var button = document.getElementById("vote-reminder-button");

    window.addEventListener("VoteReminderAvailable", function () {
      voteReminderInstalled = true;
    });

    window.addEventListener("VoteReminderImportResult", function (event) {
      if (event.detail && event.detail.ok) {
        console.log("Vote pack imported into Vote Reminder.");
        return;
      }

      console.warn((event.detail && event.detail.error) || "Could not import vote pack.");
    });

    button.addEventListener("click", function () {
      if (!voteReminderInstalled) {
        window.location.href = installUrl;
        return;
      }

      window.postMessage(
        {
          type: "VOTE_REMINDER_IMPORT",
          payload: {
            url: packUrl
          }
        },
        window.location.origin
      );
    });
  })();
</script>`;
}

async function updateExportPreview() {
  try {
    exportPreview.value = await buildPackJson();
    exportPreview.dataset.hasError = "false";
    if (!exportStatus.textContent || exportStatus.textContent.includes("preview")) {
      setStatus(exportStatus, "Live preview is up to date.");
    }
  } catch (error) {
    exportPreview.value = "";
    exportPreview.dataset.hasError = "true";
    setStatus(exportStatus, error?.message || "Could not build vote pack preview.", true);
  }
}

function updateSnippetPreview() {
  try {
    snippetPreview.value = buildSnippetCode();
    setStatus(snippetStatus, "Website snippet is ready to copy.");
  } catch (error) {
    snippetPreview.value = "";
    setStatus(snippetStatus, error?.message || "Could not build website snippet.", true);
  }
}

async function handleExportDownload(event) {
  event.preventDefault();

  try {
    const json = await buildPackJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const fileName = `${String(exportPackForm.elements.packName.value || "vote-pack")
      .trim()
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "vote-pack"}.json`;

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);

    setStatus(exportStatus, `Downloaded ${fileName}.`);
    exportPreview.value = json;
    if (!snippetForm.elements.packUrl.value.trim()) {
      snippetForm.elements.packUrl.value = String(exportPackForm.elements.sourceUrl.value || "").trim();
      updateSnippetPreview();
    }
  } catch (error) {
    setStatus(exportStatus, error?.message || "Could not export vote pack.", true);
  }
}

async function handleCopyPack() {
  try {
    const json = await buildPackJson();
    await navigator.clipboard.writeText(json);
    exportPreview.value = json;
    setStatus(exportStatus, "Vote pack JSON copied to clipboard.");
  } catch (error) {
    setStatus(exportStatus, error?.message || "Could not copy vote pack JSON.", true);
  }
}

async function handleCopySnippet() {
  try {
    const snippet = buildSnippetCode();
    await navigator.clipboard.writeText(snippet);
    snippetPreview.value = snippet;
    setStatus(snippetStatus, "Website snippet copied to clipboard.");
  } catch (error) {
    setStatus(snippetStatus, error?.message || "Could not copy website snippet.", true);
  }
}

async function render() {
  const { settings, targets } = await getStoredData();
  list.innerHTML = "";

  notificationsToggle.checked = settings.notificationsEnabled;
  repeatMinutesInput.value = settings.reminderRepeatMinutes;
  snoozeMinutesInput.value = settings.defaultSnoozeMinutes;

  if (!targets.length) {
    list.innerHTML = '<p class="empty">No vote targets yet. Add your first server page above or import a server pack.</p>';
  } else {
    targets
      .slice()
      .sort((left, right) => Number(isTargetDue(right)) - Number(isTargetDue(left)))
      .forEach((target) => list.appendChild(createRow(target)));
  }

  await updateExportPreview();
  updateSnippetPreview();
}

form.addEventListener("submit", saveFormTarget);
form.elements.url.addEventListener("blur", syncDerivedFieldsFromUrl);
resetButton.addEventListener("click", resetForm);
packFileInput.addEventListener("change", handlePackFileChange);
importUrlForm.addEventListener("submit", handleImportUrl);
exportPackForm.addEventListener("submit", handleExportDownload);
exportPackForm.addEventListener("input", updateExportPreview);
copyPackButton.addEventListener("click", handleCopyPack);
snippetForm.addEventListener("input", updateSnippetPreview);
copySnippetButton.addEventListener("click", handleCopySnippet);
notificationsToggle.addEventListener("change", savePreferenceChanges);
repeatMinutesInput.addEventListener("change", savePreferenceChanges);
snoozeMinutesInput.addEventListener("change", savePreferenceChanges);

snippetForm.elements.installUrl.value = "https://chromewebstore.google.com/";
snippetForm.elements.buttonLabel.value = "Add to Vote Reminder";

renderPresets();
resetForm();
render();

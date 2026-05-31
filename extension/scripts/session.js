import { formatRelativeTime, getNextDueAt, isTargetDue } from "./storage.js";

const list = document.querySelector("[data-session-list]");
const emptyState = document.querySelector("[data-empty-session]");
const progressFill = document.querySelector("[data-progress-fill]");
const progressText = document.querySelector("[data-progress-text]");
const sessionCaption = document.querySelector("[data-session-caption]");
const sessionStatus = document.querySelector("[data-session-status]");
const refreshButton = document.querySelector("[data-refresh-session]");
const startAllButton = document.querySelector("[data-start-all]");

const params = new URLSearchParams(window.location.search);
let dueOnly = params.get("dueOnly") !== "0";

function setStatus(message, isError = false) {
  sessionStatus.textContent = message;
  sessionStatus.style.color = isError ? "#991b1b" : "";
}

function renderProgress(progress) {
  const total = progress.total || 0;
  const completed = progress.completed || 0;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${completed} of ${total} completed`;
  sessionCaption.textContent = dueOnly
    ? "This checklist shows only targets that were due for voting."
    : "This checklist includes every active target.";
}

function createCard(target) {
  const article = document.createElement("article");
  article.className = "target-row";

  const due = isTargetDue(target);
  const statusText = due ? "Ready now" : `Done for now • Next ${formatRelativeTime(getNextDueAt(target))}`;

  article.innerHTML = `
    <div class="target-row__body">
      <div class="target-row__title">
        <h3>${target.title}</h3>
        <span class="status ${due ? "status--due" : ""}">
          ${due ? "Due" : "Done"}
        </span>
      </div>
      <p><a href="${target.url}" target="_blank">${target.url}</a></p>
      <p class="muted">${statusText}</p>
      ${target.nickname ? `<p class="muted">Nickname: ${target.nickname} • ${target.autofillMode || "manual"}</p>` : ""}
      ${target.notes ? `<p>${target.notes}</p>` : ""}
    </div>
    <div class="target-row__actions">
      <button class="button button--ghost" data-action="open">Open tab</button>
      <button class="button" data-action="voted">I voted</button>
      <button class="button button--ghost" data-action="snooze">Snooze</button>
    </div>
  `;

  article.querySelector('[data-action="open"]').addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "open-target-tab", url: target.url });
    setStatus(`Opened ${target.title}.`);
  });

  article.querySelector('[data-action="voted"]').addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "mark-voted", targetId: target.id });
    setStatus(`Marked ${target.title} as voted.`);
    await render();
  });

  article.querySelector('[data-action="snooze"]').addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "snooze", targetId: target.id, minutes: 60 });
    setStatus(`Snoozed ${target.title} for 60 minutes.`);
    await render();
  });

  return article;
}

async function render() {
  const data = await chrome.runtime.sendMessage({ type: "session-data", dueOnly });

  if (!data?.ok) {
    setStatus(data?.error || "Could not load session data.", true);
    return;
  }

  list.innerHTML = "";
  dueOnly = data.dueOnly !== false;
  renderProgress(data.progress);

  if (data.targets.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  data.targets.forEach((target) => {
    list.appendChild(createCard(target));
  });
}

refreshButton.addEventListener("click", async () => {
  setStatus("Refreshing session...");
  await render();
  setStatus("Session refreshed.");
});

startAllButton.addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({
    type: "start-session",
    dueOnly,
    openChecklist: false
  });

  if (!result?.ok) {
    setStatus(result?.error || "Could not open vote tabs.", true);
    return;
  }

  setStatus(`Opened ${result.stats.opened} vote tabs.`);
});

render();

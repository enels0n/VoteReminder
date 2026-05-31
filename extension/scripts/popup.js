import { formatRelativeTime, getNextDueAt } from "./storage.js";

const list = document.querySelector("[data-target-list]");
const emptyState = document.querySelector("[data-empty-state]");
const openOptionsButton = document.querySelector("[data-open-options]");
const runCheckButton = document.querySelector("[data-run-check]");
const startSessionButton = document.querySelector("[data-start-session]");
const sessionStatus = document.querySelector("[data-session-status]");

function setSessionStatus(message = "", isError = false) {
  sessionStatus.hidden = !message;
  sessionStatus.textContent = message;
  sessionStatus.style.color = isError ? "#991b1b" : "";
}

function createTargetCard(target) {
  const article = document.createElement("article");
  article.className = "card";

  const dueText = target._isDue
    ? "Ready to vote"
    : `Next vote ${formatRelativeTime(getNextDueAt(target))}`;

  const snoozeText =
    target.snoozedUntil && target.snoozedUntil > Date.now()
      ? `Snoozed ${formatRelativeTime(target.snoozedUntil)}`
      : "";

  article.innerHTML = `
    <div class="card__top">
      <div>
        <h3>${target.title}</h3>
        <p>${dueText}</p>
        ${snoozeText ? `<p class="muted">${snoozeText}</p>` : ""}
      </div>
      <span class="status ${target._isDue ? "status--due" : ""}">
        ${target._isDue ? "Due" : "Waiting"}
      </span>
    </div>
    <div class="card__actions">
      <button class="button button--ghost" data-action="open">Open</button>
      <button class="button" data-action="voted">I voted</button>
      <button class="button button--ghost" data-action="snooze">Snooze</button>
    </div>
  `;

  article.querySelector('[data-action="open"]').addEventListener("click", async () => {
    await chrome.tabs.create({ url: target.url });
  });

  article.querySelector('[data-action="voted"]').addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "mark-voted", targetId: target.id });
    await render();
  });

  article.querySelector('[data-action="snooze"]').addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "snooze", targetId: target.id, minutes: 60 });
    await render();
  });

  return article;
}

async function render() {
  const dashboard = await chrome.runtime.sendMessage({ type: "dashboard" });
  list.innerHTML = "";

  if (dashboard.targets.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  dashboard.targets.forEach((target) => {
    list.appendChild(createTargetCard(target));
  });
}

openOptionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

runCheckButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "run-check" });
  await render();
});

startSessionButton.addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "start-session", dueOnly: true });

  if (!result?.ok) {
    setSessionStatus(result?.error || "Could not start voting session.", true);
    return;
  }

  setSessionStatus(`Opened ${result.stats.opened} vote tabs for this session.`);
  window.close();
});

render();

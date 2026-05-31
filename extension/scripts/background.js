import { CHECK_ALARM, DEFAULT_SETTINGS, STORAGE_KEYS } from "./constants.js";
import { mergeImportedTargets, parseVotePack } from "./packs.js";
import { getNextDueAt, getStoredData, isTargetDue, saveTargets } from "./storage.js";

function normalizeUrl(url) {
  try {
    return new URL(String(url).trim()).toString();
  } catch {
    return "";
  }
}

function sameUrl(left, right) {
  return normalizeUrl(left) === normalizeUrl(right);
}

async function openOrFocusTargetTab(url, active = true) {
  const normalized = normalizeUrl(url);
  const existingTabs = await chrome.tabs.query({});
  const existingTab = existingTabs.find((tab) => sameUrl(tab.url, normalized));

  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, { active });
    if (typeof existingTab.windowId === "number") {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
    return existingTab;
  }

  return chrome.tabs.create({ url: normalized, active });
}

async function ensureInitialized() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.settings,
    STORAGE_KEYS.targets,
    STORAGE_KEYS.currentSession
  ]);

  const writes = {};

  if (!stored[STORAGE_KEYS.settings]) {
    writes[STORAGE_KEYS.settings] = DEFAULT_SETTINGS;
  }

  if (!Array.isArray(stored[STORAGE_KEYS.targets])) {
    writes[STORAGE_KEYS.targets] = [];
  }

  if (
    !stored[STORAGE_KEYS.currentSession] ||
    !Array.isArray(stored[STORAGE_KEYS.currentSession].targetIds)
  ) {
    writes[STORAGE_KEYS.currentSession] = null;
  }

  if (Object.keys(writes).length > 0) {
    await chrome.storage.local.set(writes);
  }

  await chrome.alarms.create(CHECK_ALARM, {
    periodInMinutes: 30
  });

  await maybeNotifyDueTargets();
  await updateBadge();
}

async function updateBadge() {
  const { targets } = await getStoredData();
  const dueCount = targets.filter((target) => isTargetDue(target)).length;

  await chrome.action.setBadgeBackgroundColor({ color: dueCount > 0 ? "#d97706" : "#64748b" });
  await chrome.action.setBadgeText({ text: dueCount > 0 ? String(dueCount) : "" });
}

async function maybeNotifyDueTargets() {
  const { settings, targets } = await getStoredData();
  if (!settings.notificationsEnabled) {
    await updateBadge();
    return;
  }

  const now = Date.now();
  let changed = false;

  for (const target of targets) {
    if (!isTargetDue(target, now)) {
      continue;
    }

    const repeatMs = Number(settings.reminderRepeatMinutes || 180) * 60 * 1000;
    const shouldNotify =
      !target.lastReminderAt || now - target.lastReminderAt >= repeatMs;

    if (!shouldNotify) {
      continue;
    }

    await chrome.notifications.create(`vote-${target.id}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon128.png"),
      title: "Time to vote",
      message: `${target.title} is ready for another vote.`,
      buttons: [
        { title: "Open page" },
        { title: `Snooze ${settings.defaultSnoozeMinutes} min` }
      ],
      priority: 2
    });

    target.lastReminderAt = now;
    changed = true;
  }

  if (changed) {
    await saveTargets(targets);
  }

  await updateBadge();
}

async function markVoted(targetId) {
  const { targets } = await getStoredData();
  const updatedTargets = targets.map((target) => {
    if (target.id !== targetId) {
      return target;
    }

    return {
      ...target,
      lastVotedAt: Date.now(),
      lastReminderAt: null,
      snoozedUntil: null
    };
  });

  await saveTargets(updatedTargets);
  await updateBadge();
}

async function snoozeTarget(targetId, minutes) {
  const { targets } = await getStoredData();
  const snoozedUntil = Date.now() + Number(minutes) * 60 * 1000;
  const updatedTargets = targets.map((target) => {
    if (target.id !== targetId) {
      return target;
    }

    return {
      ...target,
      lastReminderAt: Date.now(),
      snoozedUntil
    };
  });

  await saveTargets(updatedTargets);
  await updateBadge();
}

async function buildDashboard() {
  const { settings, targets } = await getStoredData();

  const enrichedTargets = targets
    .map((target) => ({
      ...target,
      _isDue: isTargetDue(target)
    }))
    .sort((left, right) => {
      if (left._isDue !== right._isDue) {
        return left._isDue ? -1 : 1;
      }

      return getNextDueAt(left) - getNextDueAt(right);
    });

  return {
    settings,
    targets: enrichedTargets
  };
}

async function getTargetForUrl(url) {
  const { targets } = await getStoredData();
  const target = targets.find((item) => sameUrl(item.url, url));

  return target || null;
}

async function getSessionTargets({ dueOnly = true } = {}) {
  const { targets } = await getStoredData();
  return targets
    .filter((target) => target.enabled)
    .filter((target) => (dueOnly ? isTargetDue(target) : true))
    .sort((left, right) => getNextDueAt(left) - getNextDueAt(right));
}

async function startVotingSession({ dueOnly = true, openChecklist = true } = {}) {
  const sessionTargets = await getSessionTargets({ dueOnly });

  if (sessionTargets.length === 0) {
    return {
      ok: false,
      error: dueOnly
        ? "No vote targets are ready right now."
        : "No active vote targets found for a session."
    };
  }

  const createdTabIds = [];

  for (let index = 0; index < sessionTargets.length; index += 1) {
    const target = sessionTargets[index];
    const tab = await openOrFocusTargetTab(target.url, false);
    createdTabIds.push(tab.id);
  }

  let groupId = null;
  if (createdTabIds.length > 1 && chrome.tabs.group) {
    groupId = await chrome.tabs.group({ tabIds: createdTabIds });
    if (chrome.tabGroups?.update) {
      await chrome.tabGroups.update(groupId, {
        title: "Vote Reminder",
        color: "orange",
        collapsed: false
      });
    }
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.currentSession]: {
      startedAt: Date.now(),
      dueOnly,
      targetIds: sessionTargets.map((target) => target.id)
    }
  });

  if (openChecklist) {
    const sessionPageUrl = chrome.runtime.getURL(`session.html?dueOnly=${dueOnly ? "1" : "0"}`);
    await chrome.tabs.create({
      url: sessionPageUrl,
      active: true
    });
  }

  return {
    ok: true,
    stats: {
      opened: sessionTargets.length,
      dueOnly
    },
    groupId
  };
}

async function importPack(rawPack, sourceLabel = "") {
  const parsed = parseVotePack(rawPack, sourceLabel);
  const { targets: existingTargets } = await getStoredData();
  const merged = mergeImportedTargets(existingTargets, parsed.targets, parsed.pack);

  await saveTargets(merged.targets);
  await updateBadge();

  return {
    ok: true,
    pack: parsed.pack,
    stats: merged.stats
  };
}

async function importPackFromUrl(url) {
  const normalizedUrl = new URL(String(url).trim()).toString();
  const response = await fetch(normalizedUrl, {
    headers: {
      Accept: "application/json, text/plain;q=0.9, */*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not load vote pack: HTTP ${response.status}.`);
  }

  const json = await response.json();
  return importPack(json, normalizedUrl);
}

async function buildSessionData({ dueOnly = true } = {}) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.currentSession);
  const currentSession = data[STORAGE_KEYS.currentSession];
  const { targets: allTargets } = await getStoredData();

  let targets = [];
  let sessionDueOnly = dueOnly;

  if (currentSession?.targetIds?.length) {
    sessionDueOnly = currentSession.dueOnly !== false;
    const byId = new Map(allTargets.map((target) => [target.id, target]));
    targets = currentSession.targetIds
      .map((targetId) => byId.get(targetId))
      .filter(Boolean);
  } else {
    targets = await getSessionTargets({ dueOnly });
  }

  const progress = {
    total: targets.length,
    due: targets.filter((target) => isTargetDue(target)).length
  };

  return {
    ok: true,
    dueOnly: sessionDueOnly,
    progress: {
      ...progress,
      completed: progress.total - progress.due
    },
    targets
  };
}

chrome.runtime.onInstalled.addListener(() => {
  ensureInitialized();
});

chrome.runtime.onStartup.addListener(() => {
  ensureInitialized();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CHECK_ALARM) {
    maybeNotifyDueTargets();
  }
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  const targetId = notificationId.replace("vote-", "");
  const { targets } = await getStoredData();
  const target = targets.find((item) => item.id === targetId);
  if (target?.url) {
    await chrome.tabs.create({ url: target.url });
  }
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  const targetId = notificationId.replace("vote-", "");

  if (buttonIndex === 0) {
    const { targets } = await getStoredData();
    const target = targets.find((item) => item.id === targetId);
    if (target?.url) {
      await chrome.tabs.create({ url: target.url });
    }
    return;
  }

  const { settings } = await getStoredData();
  await snoozeTarget(targetId, settings.defaultSnoozeMinutes);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case "dashboard":
        sendResponse(await buildDashboard());
        break;
      case "mark-voted":
        await markVoted(message.targetId);
        sendResponse({ ok: true });
        break;
      case "snooze":
        await snoozeTarget(message.targetId, message.minutes);
        sendResponse({ ok: true });
        break;
      case "run-check":
        await maybeNotifyDueTargets();
        sendResponse({ ok: true });
        break;
      case "open-target-tab": {
        const tab = await openOrFocusTargetTab(message.url, true);
        sendResponse({ ok: true, tabId: tab.id });
        break;
      }
      case "import-pack":
        sendResponse(await importPack(message.pack, message.sourceLabel || ""));
        break;
      case "import-pack-url":
        sendResponse(await importPackFromUrl(message.url));
        break;
      case "site-import":
        if (message.payload?.pack) {
          const result = await importPack(
            message.payload.pack,
            message.payload.sourceUrl || sender?.url || ""
          );
          await chrome.runtime.openOptionsPage();
          sendResponse(result);
          break;
        }

        if (message.payload?.url) {
          const result = await importPackFromUrl(message.payload.url);
          await chrome.runtime.openOptionsPage();
          sendResponse(result);
          break;
        }

        sendResponse({ ok: false, error: "Site import payload is empty." });
        break;
      case "start-session":
        sendResponse(
          await startVotingSession({
            dueOnly: message.dueOnly !== false,
            openChecklist: message.openChecklist !== false
          })
        );
        break;
      case "get-target-for-url": {
        const target = await getTargetForUrl(message.url);
        sendResponse({ ok: true, target });
        break;
      }
      case "session-data":
        sendResponse(await buildSessionData({ dueOnly: message.dueOnly !== false }));
        break;
      default:
        sendResponse({ ok: false });
    }
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: error?.message || "Unexpected extension error."
    });
  });

  return true;
});

ensureInitialized();

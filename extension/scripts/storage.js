import { DEFAULT_SETTINGS, STORAGE_KEYS } from "./constants.js";

export async function getStoredData() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.settings,
    STORAGE_KEYS.targets
  ]);

  return {
    settings: { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.settings] || {}) },
    targets: Array.isArray(data[STORAGE_KEYS.targets]) ? data[STORAGE_KEYS.targets] : []
  };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: settings
  });
}

export async function saveTargets(targets) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.targets]: targets
  });
}

export function createTargetId() {
  return `target-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isTargetDue(target, now = Date.now()) {
  if (!target.enabled) {
    return false;
  }

  if (target.snoozedUntil && target.snoozedUntil > now) {
    return false;
  }

  if (!target.lastVotedAt) {
    return true;
  }

  const intervalMs = Number(target.intervalHours || 24) * 60 * 60 * 1000;
  return now >= target.lastVotedAt + intervalMs;
}

export function getNextDueAt(target) {
  if (target.snoozedUntil && target.snoozedUntil > Date.now()) {
    return target.snoozedUntil;
  }

  if (!target.lastVotedAt) {
    return Date.now();
  }

  return target.lastVotedAt + Number(target.intervalHours || 24) * 60 * 60 * 1000;
}

export function formatRelativeTime(timestamp) {
  const diffMs = timestamp - Date.now();
  const totalMinutes = Math.round(diffMs / 60000);

  if (Math.abs(totalMinutes) < 1) {
    return "right now";
  }

  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;

  const parts = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  return totalMinutes >= 0
    ? `in ${parts.join(" ")}`
    : `${parts.join(" ")} ago`;
}

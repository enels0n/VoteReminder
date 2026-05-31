import { PRESETS } from "./site-catalog.js";

export const STORAGE_KEYS = {
  settings: "settings",
  targets: "targets",
  currentSession: "currentSession"
};

export const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  reminderRepeatMinutes: 180,
  defaultSnoozeMinutes: 60
};

export const CHECK_ALARM = "vote-reminder-check";
export { PRESETS };

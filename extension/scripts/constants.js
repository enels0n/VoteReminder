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

export const PRESETS = [
  {
    key: "hotmc",
    name: "hotmc.ru",
    intervalHours: 24,
    urlHint: "https://hotmc.ru/minecraft-server-12345"
  },
  {
    key: "topg",
    name: "topg.org",
    intervalHours: 24,
    urlHint: "https://topg.org/minecraft-servers/server-12345"
  }
];

export const CHECK_ALARM = "vote-reminder-check";

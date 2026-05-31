export const SITE_CATALOG = [
  {
    key: "hotmc",
    name: "hotmc.ru",
    game: "Minecraft",
    intervalHours: 24,
    urlHint: "https://hotmc.ru/minecraft-server-12345",
    autofillMode: "prefill+focus",
    domains: ["hotmc.ru"]
  },
  {
    key: "topg",
    name: "TopG",
    game: "Minecraft",
    intervalHours: 24,
    urlHint: "https://topg.org/minecraft-servers/server-12345",
    autofillMode: "prefill",
    domains: ["topg.org"]
  },
  {
    key: "minecraftservers",
    name: "MinecraftServers.org",
    game: "Minecraft",
    intervalHours: 24,
    urlHint: "https://minecraftservers.org/server/12345",
    autofillMode: "prefill",
    domains: ["minecraftservers.org"]
  },
  {
    key: "minecraftmp",
    name: "minecraft-mp.com",
    game: "Minecraft",
    intervalHours: 24,
    urlHint: "https://minecraft-mp.com/server/12345/vote/",
    autofillMode: "prefill+focus",
    domains: ["minecraft-mp.com"]
  },
  {
    key: "planetminecraft",
    name: "Planet Minecraft",
    game: "Minecraft",
    intervalHours: 24,
    urlHint: "https://www.planetminecraft.com/server/example/",
    autofillMode: "manual",
    domains: ["planetminecraft.com"]
  },
  {
    key: "serverlistcc",
    name: "ServerList.cc",
    game: "Minecraft",
    intervalHours: 24,
    urlHint: "https://serverlist.cc/server/example/",
    autofillMode: "manual",
    domains: ["serverlist.cc"]
  },
  {
    key: "trackyserver",
    name: "TrackyServer",
    game: "Multi-game",
    intervalHours: 24,
    urlHint: "https://www.trackyserver.com/server/1234567",
    autofillMode: "prefill+focus",
    domains: ["trackyserver.com", "www.trackyserver.com"],
    supportedGames: ["Minecraft", "Rust", "FiveM", "CS2"]
  },
  {
    key: "gamemonitoring",
    name: "GameMonitoring",
    game: "Multi-game",
    intervalHours: 24,
    urlHint: "https://gamemonitoring.net/minecraft/servers/123456/vote",
    autofillMode: "prefill+focus",
    domains: ["gamemonitoring.net"],
    supportedGames: ["Minecraft", "Rust", "FiveM", "CS2"]
  }
];

export const PRESETS = SITE_CATALOG.map((site) => ({
  key: site.key,
  name: site.name,
  game: site.game,
  intervalHours: site.intervalHours,
  urlHint: site.urlHint,
  autofillMode: site.autofillMode
}));

export function inferSiteByUrl(url) {
  let hostname = "";

  try {
    hostname = new URL(String(url).trim()).hostname.toLowerCase();
  } catch {
    return null;
  }

  return (
    SITE_CATALOG.find((site) =>
      site.domains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
      )
    ) || null
  );
}

export function getSiteByKey(siteKey) {
  return SITE_CATALOG.find((site) => site.key === siteKey) || null;
}

export const GAME_TEMPLATES = [
  {
    key: "minecraft-ru",
    label: "Minecraft RU",
    packName: "Minecraft RU server vote pack",
    description: "Russian-facing monitoring mix with local and global listings.",
    siteKeys: ["hotmc", "topg", "minecraftmp", "trackyserver", "gamemonitoring"]
  },
  {
    key: "minecraft-global",
    label: "Minecraft Global",
    packName: "Minecraft global server vote pack",
    description: "Broader English-speaking discovery set for Minecraft servers.",
    siteKeys: [
      "topg",
      "minecraftservers",
      "minecraftmp",
      "planetminecraft",
      "serverlistcc",
      "trackyserver",
      "gamemonitoring"
    ]
  },
  {
    key: "rust",
    label: "Rust",
    packName: "Rust server vote pack",
    description: "Multi-game sites that commonly list Rust servers.",
    siteKeys: ["trackyserver", "gamemonitoring"]
  },
  {
    key: "fivem",
    label: "FiveM",
    packName: "FiveM server vote pack",
    description: "Draft set for FiveM communities using major multi-game toplists.",
    siteKeys: ["trackyserver", "gamemonitoring"]
  },
  {
    key: "cs2",
    label: "CS2",
    packName: "CS2 server vote pack",
    description: "Starter pack for Counter-Strike 2 using shared server toplists.",
    siteKeys: ["trackyserver", "gamemonitoring"]
  }
];

export function getGameTemplate(templateKey) {
  return GAME_TEMPLATES.find((template) => template.key === templateKey) || null;
}

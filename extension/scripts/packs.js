import { createTargetId } from "./storage.js";

export const PACK_SCHEMA_VERSION = 1;

function normalizeUrl(url) {
  try {
    return new URL(String(url).trim()).toString();
  } catch {
    return "";
  }
}

function normalizeTarget(rawTarget, packTitle) {
  const url = normalizeUrl(rawTarget.url || rawTarget.voteUrl);
  if (!url) {
    throw new Error("Every imported site must include a valid URL.");
  }

  return {
    id: createTargetId(),
    title: String(rawTarget.title || rawTarget.name || packTitle || url).trim(),
    url,
    intervalHours: Math.max(1, Number(rawTarget.intervalHours || rawTarget.cooldownHours || 24)),
    siteKey: String(rawTarget.siteKey || rawTarget.key || "").trim(),
    notes: String(rawTarget.notes || "").trim(),
    enabled: rawTarget.enabled !== false,
    nickname: String(rawTarget.nickname || rawTarget.username || "").trim(),
    autofillMode: String(rawTarget.autofillMode || "manual").trim(),
    game: String(rawTarget.game || "").trim(),
    lastVotedAt: null,
    lastReminderAt: null,
    snoozedUntil: null
  };
}

export function parseVotePack(rawPack, sourceLabel = "") {
  if (!rawPack || typeof rawPack !== "object") {
    throw new Error("Vote pack must be a JSON object.");
  }

  const packName = String(
    rawPack.packName ||
      rawPack.name ||
      rawPack.server?.name ||
      rawPack.serverName ||
      "Server vote pack"
  ).trim();

  const rawTargets = Array.isArray(rawPack.targets)
    ? rawPack.targets
    : Array.isArray(rawPack.sites)
      ? rawPack.sites
      : [];

  if (rawTargets.length === 0) {
    throw new Error("Vote pack does not contain any vote sites.");
  }

  const game = String(rawPack.game || rawPack.server?.game || "").trim();
  const author = String(rawPack.author || rawPack.server?.owner || "").trim();
  const importSource = String(rawPack.sourceUrl || sourceLabel || "").trim();

  return {
    pack: {
      schemaVersion: Number(rawPack.schemaVersion || PACK_SCHEMA_VERSION),
      packName,
      game,
      author,
      sourceUrl: importSource
    },
    targets: rawTargets.map((target) =>
      normalizeTarget(
        {
          ...target,
          game: target.game || game
        },
        packName
      )
    )
  };
}

export function mergeImportedTargets(existingTargets, importedTargets, packMeta = {}) {
  const existingByUrl = new Map(
    existingTargets.map((target) => [normalizeUrl(target.url), target])
  );

  const nextTargets = [...existingTargets];
  let added = 0;
  let updated = 0;

  for (const importedTarget of importedTargets) {
    const url = normalizeUrl(importedTarget.url);
    const current = existingByUrl.get(url);

    if (!current) {
      nextTargets.unshift({
        ...importedTarget,
        packName: packMeta.packName || "",
        game: importedTarget.game || packMeta.game || "",
        importSource: packMeta.sourceUrl || ""
      });
      added += 1;
      continue;
    }

    const mergedTarget = {
      ...current,
      ...importedTarget,
      id: current.id,
      lastVotedAt: current.lastVotedAt,
      lastReminderAt: current.lastReminderAt,
      snoozedUntil: current.snoozedUntil,
      packName: packMeta.packName || current.packName || "",
      game: importedTarget.game || current.game || packMeta.game || "",
      importSource: packMeta.sourceUrl || current.importSource || ""
    };

    const index = nextTargets.findIndex((target) => target.id === current.id);
    nextTargets[index] = mergedTarget;
    updated += 1;
  }

  return {
    targets: nextTargets,
    stats: {
      added,
      updated,
      totalImported: importedTargets.length
    }
  };
}

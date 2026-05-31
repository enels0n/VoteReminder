# Vote Reminder

Chrome extension for reminding players to vote for favorite servers on rating sites such as `hotmc.ru` and `topg.org`.

## Features

- Add multiple vote pages with a custom cooldown, usually `24` hours.
- Show ready-to-vote targets in the extension popup.
- Send browser notifications when a vote becomes available again.
- Snooze reminders or mark a target as voted.
- Manage targets and presets from the options page.
- Import a whole server pack from a local `vote-pack.json` file.
- Import a server pack from a public URL.
- Accept import requests directly from a server website when the extension is installed.
- Start a vote session that opens all currently available vote pages in one tab group.
- Show a dedicated checklist page for the active voting session with progress and quick actions.
- Store a nickname and autofill mode per vote page for supported sites.
- Auto-detect supported sites from the vote URL and suggest site-specific autofill behavior.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension` folder from this project.

## Vote Pack Format

Use [vote-pack.example.json](vote-pack.example.json) as a template.

```json
{
  "schemaVersion": 1,
  "packName": "My Minecraft Server Vote Pack",
  "game": "Minecraft",
  "author": "Server Admin",
  "sourceUrl": "https://example.com/vote-pack.json",
  "targets": [
    {
      "title": "TopG vote page",
      "url": "https://topg.org/minecraft-servers/server-123456",
      "intervalHours": 24,
      "siteKey": "topg",
      "nickname": "",
      "autofillMode": "prefill",
      "notes": "Optional helper text for players"
    }
  ]
}
```

Known built-in site presets currently focus on Minecraft and multi-game vote platforms:

- `hotmc.ru`
- `TopG`
- `MinecraftServers.org`
- `minecraft-mp.com`
- `Planet Minecraft`
- `ServerList.cc`
- `TrackyServer`
- `GameMonitoring`

## Website Integration

If the extension is installed, a website can detect it and send a vote pack import request through `window.postMessage`.

```html
<script>
  let voteReminderInstalled = false;

  window.addEventListener("VoteReminderAvailable", () => {
    voteReminderInstalled = true;
  });

  window.addEventListener("VoteReminderImportResult", (event) => {
    if (event.detail?.ok) {
      alert("Vote pack imported into Vote Reminder.");
      return;
    }

    alert(event.detail?.error || "Could not import vote pack.");
  });

  async function addVotePack() {
    if (!voteReminderInstalled) {
      window.location.href = "https://chromewebstore.google.com/";
      return;
    }

    window.postMessage(
      {
        type: "VOTE_REMINDER_IMPORT",
        payload: {
          url: "https://example.com/vote-pack.json"
        }
      },
      window.location.origin
    );
  }
</script>
```

Fallback if the extension is not installed:

- Show an install link for the extension.
- Also offer a direct download link to `vote-pack.json`.
- After install, the player can re-open the page or import the URL manually.

## Notes

- This version still uses a manual `I voted` confirmation after the player votes on the website.
- Different monitoring sites can have different cooldowns, so each target stores its own interval.
- Notifications are checked every 30 minutes in the background and can repeat on a custom schedule.
- `nickname` and `autofillMode` are supported both in imported packs and in manual target editing.
- The current autofill adapters cover `topg`, `hotmc`, `minecraftservers.org`, `minecraft-mp.com`, `TrackyServer`, `GameMonitoring`, plus a generic fallback.
- Captcha is intentionally left for the player to solve manually.

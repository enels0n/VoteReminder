(function bootstrapVoteReminderBridge() {
  window.dispatchEvent(
    new CustomEvent("VoteReminderAvailable", {
      detail: {
        version: "0.1.0"
      }
    })
  );

  window.addEventListener("message", async (event) => {
    if (event.source !== window || !event.data || typeof event.data !== "object") {
      return;
    }

    const { type, payload } = event.data;
    if (type !== "VOTE_REMINDER_IMPORT") {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: "site-import",
        payload
      });

      window.dispatchEvent(
        new CustomEvent("VoteReminderImportResult", {
          detail: response
        })
      );
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("VoteReminderImportResult", {
          detail: {
            ok: false,
            error: error?.message || "Unable to import vote pack."
          }
        })
      );
    }
  });
})();

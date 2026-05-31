(function bootstrapVotePageHelper() {
  const SITE_ADAPTERS = {
    topg: {
      selectors: [
        'input[name="username"]',
        'input[name="nickname"]',
        'input[name="nick"]',
        'input[placeholder*="nickname" i]',
        'input[placeholder*="minecraft" i]'
      ]
    },
    hotmc: {
      selectors: [
        'input[name="nickname"]',
        'input[name="nick"]',
        'input[placeholder*="nick" i]',
        'input[placeholder*="minecraft" i]'
      ]
    },
    generic: {
      selectors: [
        'input[name="nickname"]',
        'input[name="nick"]',
        'input[name="username"]',
        'input[name="player"]',
        'input[id*="nickname" i]',
        'input[id*="nick" i]',
        'input[id*="username" i]',
        'input[placeholder*="nickname" i]',
        'input[placeholder*="nick" i]',
        'input[placeholder*="username" i]',
        'input[placeholder*="player" i]',
        'input[placeholder*="minecraft" i]'
      ]
    }
  };

  let appliedTargetId = null;

  function setNativeValue(input, value) {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function focusCaptchaHint() {
    const captchaNode = document.querySelector(
      '[class*="captcha" i], iframe[title*="captcha" i], iframe[src*="captcha" i]'
    );

    if (captchaNode instanceof HTMLElement) {
      captchaNode.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function getSelectors(target) {
    const byKey = SITE_ADAPTERS[target.siteKey]?.selectors || [];
    return [...byKey, ...SITE_ADAPTERS.generic.selectors];
  }

  function tryApplyTarget(target) {
    if (!target?.nickname || target.autofillMode === "manual") {
      return false;
    }

    const selectors = getSelectors(target);
    for (const selector of selectors) {
      const input = document.querySelector(selector);
      if (!(input instanceof HTMLInputElement) || input.disabled || input.readOnly) {
        continue;
      }

      if (!input.value.trim()) {
        setNativeValue(input, target.nickname);
      }

      if (target.autofillMode === "prefill+focus") {
        input.focus();
        focusCaptchaHint();
      }

      return true;
    }

    return false;
  }

  async function requestVoteTarget() {
    try {
      const result = await chrome.runtime.sendMessage({
        type: "get-target-for-url",
        url: window.location.href
      });

      if (!result?.ok || !result.target || appliedTargetId === result.target.id) {
        return;
      }

      const apply = () => {
        if (tryApplyTarget(result.target)) {
          appliedTargetId = result.target.id;
        }
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", apply, { once: true });
      } else {
        apply();
      }

      setTimeout(apply, 1200);
      setTimeout(apply, 3000);
    } catch {
      // Ignore helper errors on third-party sites.
    }
  }

  requestVoteTarget();
})();

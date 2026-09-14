(() => {
  const DEFAULT_BLOCKED_WORDS = ["secret", "password", "api_key"];
  const REMOTE_CONFIG_URL = 
    "https://raw.githubusercontent.com/bahriasan/promptGuard/refs/heads/main/blockedWords.json";
  
  const UPDATE_INTERVAL = 1 * 60 * 1000;

  let blockedWords = DEFAULT_BLOCKED_WORDS.slice();


  chrome.storage.local.get({ blockedWords: DEFAULT_BLOCKED_WORDS, blockedWordsVersion: 0 }, (data) => {
    blockedWords = Array.isArray(data.blockedWords)
      ? data.blockedWords.filter(Boolean)
      : DEFAULT_BLOCKED_WORDS.slice();

      console.log(
        "[Prompt Guard] Local cache:",
        blockedWords,
        "version:",
        data.blockedWordsVersion
      );

      updateFromGitHub(data.blockedWordsVersion);
  });


  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.blockedWords) {
      blockedWords = Array.isArray(changes.blockedWords.newValue)
        ? changes.blockedWords.newValue.filter(Boolean)
        : [];
    }
  });


  async function updateFromGitHub(localVersion) {
    try {
      console.log("[Prompt Guard] GitHub kontrol ediliyor...");

      const url = `${REMOTE_CONFIG_URL}?v=${Date.now()}`;

      const response = await fetch(url, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const remoteData = await response.json();

      if (
        !remoteData ||
        !Array.isArray(remoteData.blockedWords)
      ) {
        throw new Error("Geçersiz blocked-words.json");
      }

      const remoteVersion = Number(remoteData.version) || 0;

      console.log(
        "[Prompt Guard] Local version:",
        localVersion,
        "Remote version:",
        remoteVersion
      );

      // Yeni versiyon varsa cache'i güncelle
      if (remoteVersion > localVersion) {
        const newWords = remoteData.blockedWords
          .map(word => String(word).trim())
          .filter(Boolean);

        await chrome.storage.local.set({
          blockedWords: newWords,
          blockedWordsVersion: remoteVersion
        });

        console.log(
          "[Prompt Guard] Merkezi liste güncellendi:",
          newWords
        );
      } else {
        console.log(
          "[Prompt Guard] Liste güncel."
        );
      }

    } catch (error) {
      console.warn(
        "[Prompt Guard] GitHub güncellemesi başarısız. Local cache kullanılacak.",
        error
      );
    }
  }


  setInterval(async () => {
    const data = await chrome.storage.local.get({
      blockedWordsVersion: 0
    });

    updateFromGitHub(data.blockedWordsVersion);

  }, UPDATE_INTERVAL);


  function getPromptText() {
    const selectors = [
      'textarea',
      '[contenteditable="true"]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        if (visible) {
          const text = "value" in el ? el.value : el.innerText;
          if (text && text.trim()) return text;
        }
      }
    }
    return "";
  }

  function findMatches(text) {
    const lower = text.toLocaleLowerCase();
    return blockedWords.filter(word =>
      lower.includes(String(word).toLocaleLowerCase())
    );
  }

  function showBlocked(matches) {
    const old = document.getElementById("prompt-guard-alert");
    if (old) old.remove();

    const box = document.createElement("div");
    box.id = "prompt-guard-alert";
    box.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px">🚫 Prompt Guard</div>
      <div>Prompt gönderilmedi.</div>
      <div style="margin-top:6px">Yasaklı kelime: <b>${matches.map(escapeHtml).join(", ")}</b></div>
    `;

    Object.assign(box.style, {
      position: "fixed",
      right: "24px",
      bottom: "24px",
      zIndex: "2147483647",
      background: "#fff",
      color: "#111",
      padding: "14px 18px",
      border: "1px solid #d33",
      borderRadius: "10px",
      boxShadow: "0 6px 24px rgba(0,0,0,.2)",
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      maxWidth: "360px"
    });

    document.body.appendChild(box);
    setTimeout(() => box.remove(), 5000);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function shouldBlock() {
    const prompt = getPromptText();
    if (!prompt) return false;

    const matches = findMatches(prompt);
    if (matches.length) {
      showBlocked(matches);
      return true;
    }
    return false;
  }

  // Enter ile gönderimi engelle.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;

    if (shouldBlock()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // Send butonuna tıklamayı engelle.
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const label = (
      button.getAttribute("aria-label") ||
      button.getAttribute("data-testid") ||
      button.innerText ||
      ""
    ).toLocaleLowerCase();

    const looksLikeSend =
      label.includes("send") ||
      label.includes("gönder") ||
      label.includes("submit");

    if (looksLikeSend && shouldBlock()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // Form submit olayını da engelle.
  document.addEventListener("submit", (event) => {
    if (shouldBlock()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  console.log("[Prompt Guard] aktif");
})();
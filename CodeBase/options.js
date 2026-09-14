const DEFAULT_BLOCKED_WORDS = ["secret", "password", "api_key"];

const words = document.getElementById("words");
const save = document.getElementById("save");
const status = document.getElementById("status");

chrome.storage.local.get({ blockedWords: DEFAULT_BLOCKED_WORDS }, (data) => {
  words.value = (data.blockedWords || []).join("\n");
});

save.addEventListener("click", () => {
  const blockedWords = words.value
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  chrome.storage.local.set({ blockedWords }, () => {
    status.textContent = "Kaydedildi";
    setTimeout(() => status.textContent = "", 1500);
  });
});
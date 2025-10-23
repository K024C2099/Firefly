
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ enabled: false });
    updateBadge(false);
});

chrome.action.onClicked.addListener(async () => {
    const { enabled } = await chrome.storage.local.get("enabled");
    const newState = !enabled;
    chrome.storage.local.set({ enabled: newState });
    updateBadge(newState);
});

function updateBadge(isOn) {
    chrome.action.setBadgeText({ text: isOn ? "オン" : "オフ" });
    chrome.action.setBadgeBackgroundColor({ color: isOn ? "#1c1" : "#c11" });
}

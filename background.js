// Service worker for area capture. The popup closes as soon as the page is
// clicked, so the overlay it injects reports back here to have the visible
// tab photographed and, when asked, an editor opened for the cropped result.
importScripts("store.js");

function safeFilename(url, captureType) {
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${hostname || "webpage"}-${captureType}-${timestamp}.png`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "capture-visible") {
    chrome.tabs
      .captureVisibleTab(sender.tab.windowId, { format: "png" })
      .then((dataUrl) => sendResponse({ dataUrl }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === "open-editor") {
    (async () => {
      const blob = await (await fetch(message.dataUrl)).blob();
      const id = await shotStore.save(blob, {
        filename: safeFilename(sender.tab.url, "area"),
        id: `${Date.now()}`,
      });
      await chrome.tabs.create({
        url: chrome.runtime.getURL(`editor.html?shot=${id}`),
      });
      sendResponse({ ok: true });
    })().catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});

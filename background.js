// NetSnap background service worker
// Handles message passing between devtools panel and other extension parts

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_VIEWER') {
    const encoded = encodeURIComponent(message.data);
    const url = chrome.runtime.getURL(`viewer.html#${encoded}`);
    chrome.tabs.create({ url });
    sendResponse({ ok: true });
  }
  return true;
});

// NetSnap background service worker
// Handles message passing between devtools panel and other extension parts

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_VIEWER') {
    // `message.data` is a short token pointing at the stored report.
    const token = encodeURIComponent(String(message.data));
    const url = chrome.runtime.getURL(`viewer.html#${token}`);
    chrome.tabs.create({ url });
    sendResponse({ ok: true });
  }
  return true;
});

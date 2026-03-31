# NetSnap ⚡

**A Chrome DevTools extension for capturing failed API requests and sharing them with your backend developer — in two clicks.**

No more copying endpoints, payloads, and responses one by one into WhatsApp. NetSnap sits inside DevTools, captures everything automatically, and lets you share a clean report instantly.

---

## The problem

When an API call fails during development, reporting it to a backend dev means:

1. Open DevTools → find the request
2. Copy the endpoint manually
3. Copy the payload manually
4. Copy the response manually
5. Format it somehow
6. Paste into WhatsApp / Slack
7. Hope they can read it

That's 6+ steps per bug. NetSnap collapses it to 2.

---

## Features

- 🔴 **Auto-captures** all network requests in real time via the DevTools API
- 🎯 **Filters errors** — shows 4xx/5xx by default, not noise
- 📋 **Report queue** — cherry-pick exactly which requests to include
- 📱 **WhatsApp-ready output** — formatted with bold and code blocks that render natively in WhatsApp
- 🔗 **Viewer page** — one-click opens a clean, readable report in a new tab
- 🔒 **Strips sensitive headers** — Authorization, Cookie, X-Api-Key never leave your machine
- `{ }` **Raw JSON export** — for Slack, tickets, or email

---

## Installation

### Option 1 — Download release (recommended)

1. Go to [Releases](../../releases) and download the latest `netsnap-extension.zip`
2. Unzip the file
3. Open Chrome or Brave → go to `chrome://extensions`
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** → select the `netsnap` folder
6. Done ✓

### Option 2 — Clone and load

```bash
git clone https://github.com/sholajapheth/netsnap.git
```

Then follow steps 3–6 above, selecting the cloned `netsnap` folder.

---

## How to use

1. Open DevTools (`F12` / `Cmd+Option+I`) on any page
2. Click the **NetSnap** tab (may be under the `>>` overflow menu)
3. Trigger the failing API call — it appears in the left panel with its status code
4. Click the request to inspect it in full on the right
5. Click **+ Add** to queue it for your report
6. Switch to **Report Builder**
7. Hit **📱 Copy for WhatsApp** or **🔗 Open Viewer**

---

## Share formats

| Option | Best for |
|--------|----------|
| 📱 Copy for WhatsApp | Paste directly into chat — renders with bold/code natively |
| `{ }` Copy JSON | Slack, Jira tickets, email |
| 🔗 Open Viewer | Send a screenshot or share the tab with the backend dev |

---

## File structure

```
netsnap/
├── manifest.json       Chrome extension manifest (v3)
├── background.js       Service worker — handles opening viewer tab
├── devtools.html       DevTools page bootstrap
├── devtools.js         Registers the NetSnap panel
├── panel.html          Main panel UI
├── panel.js            Capture, filter, report, share logic
├── viewer.html         Standalone report viewer
└── viewer.js           Viewer logic (external file — MV3 CSP requirement)
```

---

## Security note

NetSnap automatically strips the following headers before any data is shared:
- `Authorization`
- `Cookie` / `Set-Cookie`
- `X-Api-Key`

Response bodies and request payloads are captured as-is. Avoid using NetSnap on production sessions that contain real user PII.

---

## Contributing

PRs welcome. Particularly interested in:
- Icon set (16×16, 48×48, 128×128)
- Firefox DevTools port
- Short-URL backend for the viewer link (Vercel edge function + KV)
- Keyboard shortcut to add the currently selected Network request

---

## Roadmap

- [ ] Proper icon set
- [ ] Chrome Web Store listing
- [ ] Shareable short URL (no more long hash links)
- [ ] Right-click context menu on Network panel requests
- [ ] Auto-detect and highlight the likely error cause in the response

---

## Built by

**[Shola Japheth](https://sholajapheth.com)** — Senior Software Engineer & UI Designer.  
[github.com/sholajapheth](https://github.com/sholajapheth)

Built to solve a real daily problem. Shared because someone else probably has the same one.

---

## License

MIT

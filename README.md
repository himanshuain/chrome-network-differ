# API Differ

> A Chrome DevTools extension that captures and compares API request/response payloads side-by-side. Perfect for debugging API changes across environments, testing before/after deployments, or spotting unexpected differences in network traffic.

![Chrome Web Store](https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome&logoColor=white)
![Version](https://img.shields.io/badge/version-2.1.0-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

---

## Features

- **Intercept & Capture** — Automatically captures `fetch` and `XMLHttpRequest` calls on any tab with a single click
- **Side-by-Side Diff** — Pin any two requests as **A** and **B** to get a structured, color-coded diff of their response bodies, request payloads, or headers
- **Deep JSON Diff Engine** — Recursively compares nested objects and arrays, highlighting added, removed, and changed fields
- **Inspect Mode** — Click any single request to pretty-print its full payload with syntax highlighting
- **Multi-Tab Support** — Capture from multiple tabs simultaneously; each tab gets a unique color-coded marker for easy identification
- **Custom Tab Labels** — Rename tab markers (e.g., "Staging", "Production") to keep track of which environment is which
- **Floating Controls** — Draggable floating buttons on the page for quick inject/open without leaving the tab
- **DevTools Integration** — Adds an "API Differ" panel in Chrome DevTools that auto-injects on navigation
- **Filter & Search** — Quickly filter captured requests by URL
- **Diff-Only Mode** — Toggle to show only changed lines, hiding unchanged fields for a cleaner view
- **Adjustable Density** — Switch between compact, normal, and relaxed line spacing
- **Resizable Panels** — Drag to resize the request list panel to your preference
- **Dark Theme** — Built with the Catppuccin Mocha color palette for a sleek, eye-friendly UI

## Screenshots

<details>
<summary>Popup</summary>

The popup provides quick access to inject, open the differ, toggle floating buttons, and clear captured data.

<img width="298" height="424" alt="Screenshot 2026-03-01 at 7 31 31 PM" src="https://github.com/user-attachments/assets/870bd1e3-3276-4e79-88a5-cd9d0942f7fb" />


</details>

<details>
<summary>Diff View</summary>

Side-by-side comparison with color-coded additions (green), removals (red), and changes (yellow).
<img width="1728" height="1078" alt="Screenshot 2026-03-01 at 7 29 50 PM" src="https://github.com/user-attachments/assets/a75c8b43-86f8-4418-a086-307e6b75d625" />


</details>

<details>
<summary>Inspect View</summary>

Click any request to see its full JSON payload with syntax highlighting.
<img width="1728" height="1078" alt="Screenshot 2026-03-01 at 7 31 11 PM" src="https://github.com/user-attachments/assets/0d37851a-7f7f-4e21-ae92-46ffbc6f1e20" />


</details>

## Installation

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/himanshuain/chrome-network-differ.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the cloned `api-differ` folder
5. The extension icon will appear in your toolbar

## Usage

### Quick Start

1. **Inject** — Click the extension icon and hit **Inject into Current Tab** (or use the floating button on the page)
2. **Browse** — Use the website normally; all `fetch` and `XHR` calls are automatically captured
3. **Compare** — Click **Open Differ** to see all captured requests. Pin two requests as **A** and **B** to diff them

### Comparing Across Environments

A common workflow for debugging API differences:

1. Open your **staging** environment in Tab 1 and inject
2. Open your **production** environment in Tab 2 and inject
3. Label the tabs (click the pencil icon in the differ) as "Staging" and "Production"
4. Perform the same actions in both tabs
5. Open the Differ and pin matching requests from each tab
6. Instantly see what's different between the two responses

### Keyboard of Controls

| Action | How |
|---|---|
| Inject interceptors | Popup → **Inject** or floating **Inject Differ** button |
| Open diff view | Popup → **Open Differ** or floating **Open Differ** button |
| Pin request as A/B | Click **A** or **B** buttons next to any request in the list |
| Filter requests | Type in the filter input at the top of the request list |
| Toggle diff-only | Click **Diff Only** in the diff toolbar |
| Change density | Click **S** / **M** / **L** in the diff toolbar |
| Set tab label | Click the pencil icon on any tab group header |
| Hide floating bar | Click the eye icon on the floating bar, or toggle from the popup |
| Resize panels | Drag the border between the request list and diff view |

## Architecture

```
api-differ/
├── manifest.json       # Manifest V3 configuration
├── background.js       # Service worker — stores captured requests, manages tab state
├── intercept.js        # Injected into MAIN world — monkey-patches fetch/XHR to capture traffic
├── bridge.js           # Injected into ISOLATED world — relays messages from page to extension
├── float.js            # Injected into ISOLATED world — creates draggable floating controls
├── popup.html/js       # Extension popup UI
├── differ.html/js      # Full-page diff viewer with side-by-side comparison
├── devtools.html/js    # DevTools panel integration
└── icons/              # Extension icons (16, 48, 128px)
```

### How It Works

1. **Injection** — When you click "Inject", three scripts are injected into the active tab:
   - `bridge.js` (ISOLATED world) listens for `postMessage` events and forwards them to the extension
   - `intercept.js` (MAIN world) monkey-patches `window.fetch` and `XMLHttpRequest` to capture all API calls
   - `float.js` (ISOLATED world) adds a draggable floating toolbar to the page

2. **Capture** — Each intercepted request is sent via `postMessage` → `bridge.js` → `chrome.runtime.sendMessage` → `background.js`, which stores it in memory (up to 500 requests)

3. **Diffing** — The differ page retrieves all captured requests and uses a recursive deep-diff algorithm to compare any two JSON payloads, producing a structured list of additions, removals, and changes

## Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Inject scripts into the currently active tab |
| `scripting` | Programmatically inject content scripts |
| `storage` | Persist extension state |
| `tabs` | Access tab metadata (title, ID) for labeling |
| `<all_urls>` | Capture network requests from any origin |

## Tech Stack

- **Manifest V3** — Modern Chrome extension platform
- **Vanilla JavaScript** — Zero dependencies, no build step required
- **Catppuccin Mocha** — Dark theme color palette

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

## License

MIT License. See [LICENSE](LICENSE) for details.

---

Built with care for developers who debug APIs daily.

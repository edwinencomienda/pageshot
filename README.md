<img src="icons/icon128.png" alt="" width="72" height="72" />

# PageShot

A tiny, open-source Chrome extension that screenshots a whole webpage — or just
the part you can see — and copies it to your clipboard or saves it as a PNG.

It also has a small editor page for putting a background, padding, rounded
corners, and a shadow behind the shot.

No build step, no dependencies, no accounts, no tracking. Just plain HTML, CSS,
and JavaScript.

## Install

Works in any Chrome-based browser: Chrome, Edge, Brave, Arc, Vivaldi, Opera.

1. Download this project:
   `git clone https://github.com/edwinencomienda/chrome-fullpage-screenshot.git`
   (or click **Code → Download ZIP** on GitHub and unzip it)
2. Open `chrome://extensions` in your browser.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Pick the folder you just downloaded.

The camera icon appears in your toolbar. Pin it for easy access.

To update later: `git pull`, then click the refresh icon on the extension card.

## Use

1. Open any normal `http://` or `https://` page.
2. Click the extension icon.
3. Pick **Copy** (default) or **Download**.
4. Click **Capture full page** or **Visible area only**.

For a full-page capture, leave the page and popup open while it scrolls. The
status line at the bottom tells you when it's done.

### Add a background

Flip on **Open in editor** in the popup before capturing. Instead of copying or
downloading right away, the screenshot opens in a new tab where you can put a
background behind it:

- **Background** — a transparent option, 15 solid colors and 10 gradients built
  in. Transparent keeps the PNG's alpha, so the padding around the shot stays
  see-through. Add your own solid colors with the picker and your own images with
  **Add image** — as many of each as you like. They stay in the sidebar for next time; hover one and click **×**
  to delete it.
- **Padding** — how much background shows around the shot.
- **Corners** — rounds the screenshot's edges.
- **Shadow** — slide from off to strong.
- **Border** — off by default. Switch it on, then pick the color and thickness.
- **Crop** — drag a box on the image to keep just that part, background and all,
  so you can save only the top, the top-left corner, and so on. **Show whole
  image** puts it back.

Then hit **Copy image** or **Download** from the editor.

### Shortcuts

On Windows and Linux, use **Ctrl** instead of **⌘** — the editor shows whichever
one your computer uses.

| Keys | Does |
| --- | --- |
| **⌘C** | Copy the image |
| **⌘D** | Download the image |
| **⌘Z** | Undo |
| **⇧⌘Z** | Redo |

**Good to know:** Chrome blocks screenshots of its own pages, like
`chrome://extensions` and the Chrome Web Store. Extremely tall pages may exceed
the browser's maximum image size.

## How it works

`popup.js` scrolls the page one screen at a time, snaps each screen with
`chrome.tabs.captureVisibleTab`, and stitches the pieces onto a single canvas.
Chrome caps capturing at two shots per second, so tall pages take a few seconds.
The page's scroll position is restored when it finishes.

The editor is a second extension page (`editor.html`). The captured PNG is
handed over through IndexedDB (`store.js`) rather than the URL, because
full-page PNGs are far too big for either a URL or `chrome.storage`. The editor
redraws the background and screenshot onto its own canvas.

| File | Job |
| --- | --- |
| `popup.html` / `.css` / `.js` | The toolbar popup and the capture + stitch logic. |
| `editor.html` / `.css` / `.js` | The background editor tab. |
| `store.js` | Passes the captured PNG from popup to editor. |
| `icons/` | Toolbar and store icons (16/32/48/128 px). |
| `manifest.json` | Extension setup and permissions. |

## Permissions, and why each is needed

| Permission | Why |
| --- | --- |
| `activeTab` | Only touches the tab you clicked the icon on. |
| `scripting` | Scrolls that page between shots. |
| `downloads` | Saves the finished PNG. |
| `clipboardWrite` | Copies the finished PNG. |

Your screenshots never leave your computer.

## Contributing

Issues and pull requests are welcome. To hack on it:

1. Edit the files — see the table above.
2. Click the refresh icon on the extension card at `chrome://extensions`.
3. Reopen the popup to see your change. Right-click the popup → **Inspect** for
   the console.

Please keep it dependency-free and small — that's the point of this project.

## License

[MIT](LICENSE) © Edwin Encomienda

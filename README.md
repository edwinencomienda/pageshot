# Full Page Screenshot

A tiny, open-source Chrome extension that screenshots a whole webpage — or just
the part you can see — and copies it to your clipboard or saves it as a PNG.

No build step, no dependencies, no accounts, no tracking. Just three files.

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

**Good to know:** Chrome blocks screenshots of its own pages, like
`chrome://extensions` and the Chrome Web Store. Extremely tall pages may exceed
the browser's maximum image size.

## How it works

`popup.js` scrolls the page one screen at a time, snaps each screen with
`chrome.tabs.captureVisibleTab`, and stitches the pieces onto a single canvas.
Chrome caps capturing at two shots per second, so tall pages take a few seconds.
The page's scroll position is restored when it finishes.

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

1. Edit the files — `popup.html`, `popup.css`, `popup.js`.
2. Click the refresh icon on the extension card at `chrome://extensions`.
3. Reopen the popup to see your change. Right-click the popup → **Inspect** for
   the console.

Please keep it dependency-free and small — that's the point of this project.

## License

[MIT](LICENSE) © Edwin Encomienda

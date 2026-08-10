# Full Page Screenshot

A small Chrome extension that captures either the entire current webpage or
only the visible viewport and downloads it as a PNG image or copies it to the
clipboard.

## Install

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

## Use

1. Open a regular `http://` or `https://` webpage.
2. Click the extension icon.
3. Choose **Copy** (default) or **Download**.
4. Choose **Capture full page** or **Visible area only**.
5. For a full-page capture, keep the page and popup open while it runs. The
   selected output is created automatically when it is ready.

Chrome does not allow extensions to capture protected pages such as
`chrome://extensions` or the Chrome Web Store. Very large pages may exceed the
browser's maximum canvas size.

## Permissions

- `activeTab`: captures only the tab where you click the extension.
- `scripting`: scrolls the active page while taking each image.
- `downloads`: saves the completed PNG.
- `clipboardWrite`: copies the completed PNG to the clipboard.

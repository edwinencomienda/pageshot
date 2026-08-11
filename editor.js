const canvas = document.querySelector("#canvas");
const context = canvas.getContext("2d");
// The full frame is composed here, then the crop is copied to the visible canvas.
const composed = document.createElement("canvas");
const composedContext = composed.getContext("2d");
const frame = document.querySelector("#frame");
const marquee = document.querySelector("#marquee");
const emptyState = document.querySelector("#empty");
const dimensions = document.querySelector("#dimensions");
const statusText = document.querySelector("#status");
const backgroundList = document.querySelector("#backgrounds");
const paddingInput = document.querySelector("#padding");
const radiusInput = document.querySelector("#radius");
const shadowInput = document.querySelector("#shadow");
const paddingValue = document.querySelector("#padding-value");
const radiusValue = document.querySelector("#radius-value");
const shadowValue = document.querySelector("#shadow-value");
const cropValue = document.querySelector("#crop-value");
const cropReset = document.querySelector("#crop-reset");
const colorInput = document.querySelector("#color");
const colorLabel = document.querySelector("#color-label");
const colorRemove = document.querySelector("#color-remove");
const uploadInput = document.querySelector("#upload");
const uploadLabel = document.querySelector("#upload-label");
const uploadRemove = document.querySelector("#upload-remove");
const undoButton = document.querySelector("#undo");
const redoButton = document.querySelector("#redo");
const copyButton = document.querySelector("#copy");
const downloadButton = document.querySelector("#download");

// `css` mirrors the canvas fill so each swatch previews what it draws.
const BACKGROUNDS = [
  { id: "paper", label: "Paper", css: "#f4f0e6", color: "#f4f0e6" },
  { id: "ink", label: "Ink", css: "#17211b", color: "#17211b" },
  { id: "acid", label: "Acid", css: "linear-gradient(135deg, #eaffa0, #a8d900)", gradient: ["#eaffa0", "#a8d900"] },
  { id: "clay", label: "Clay", css: "linear-gradient(135deg, #f0dccb, #c49a7f)", gradient: ["#f0dccb", "#c49a7f"] },
  { id: "slate", label: "Slate", css: "linear-gradient(135deg, #4a5b64, #1d262b)", gradient: ["#4a5b64", "#1d262b"] },
];

const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 };

// mode is "preset", "color", or "image" — whichever the user last chose.
// crop is a share of the whole frame, so it survives padding changes.
const settings = {
  mode: "preset",
  preset: BACKGROUNDS[0].id,
  color: colorInput.value,
  padding: Number(paddingInput.value),
  radius: Number(radiusInput.value),
  shadow: Number(shadowInput.value),
  crop: { ...FULL_CROP },
};

let shot = null;
let backgroundImage = null;
let filename = "screenshot.png";

// ⌘ on a Mac, Ctrl everywhere else. The handler accepts either key.
const IS_MAC = /mac/i.test(navigator.userAgentData?.platform ?? navigator.platform);
const MOD = IS_MAC ? "⌘" : "Ctrl+";
const SHIFT_MOD = IS_MAC ? "⇧⌘" : "Ctrl+Shift+";

function labelShortcuts() {
  document.querySelectorAll("kbd[data-key]").forEach((kbd) => {
    kbd.textContent = `${MOD}${kbd.dataset.key}`;
  });
  undoButton.title = `Undo (${MOD}Z)`;
  redoButton.title = `Redo (${SHIFT_MOD}Z)`;
}

function setStatus(message, state = "") {
  statusText.textContent = message;
  statusText.className = `status ${state}`;
}

/* ---------- undo / redo ---------- */

const history = { entries: [], index: -1 };

function snapshot() {
  return JSON.stringify(settings);
}

function pushHistory() {
  const entry = snapshot();
  if (history.entries[history.index] === entry) return;

  history.entries.splice(history.index + 1);
  history.entries.push(entry);
  if (history.entries.length > 60) history.entries.shift();
  history.index = history.entries.length - 1;
  syncHistoryButtons();
}

function applyHistory(step) {
  const next = history.index + step;
  if (next < 0 || next >= history.entries.length) return;

  history.index = next;
  Object.assign(settings, JSON.parse(history.entries[next]));
  if (settings.mode === "image" && !backgroundImage) settings.mode = "preset";
  syncHistoryButtons();
  syncControls();
  savePreferences();
  render();
  setStatus(step < 0 ? "Undone" : "Redone");
}

function syncHistoryButtons() {
  undoButton.disabled = history.index <= 0;
  redoButton.disabled = history.index >= history.entries.length - 1;
}

/* ---------- preferences ---------- */

function savePreferences() {
  localStorage.setItem("editor-settings", snapshot());
}

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem("editor-settings") ?? "{}");
    Object.assign(settings, saved);
    settings.crop = { ...FULL_CROP, ...(saved.crop ?? {}) };
  } catch {
    // A corrupt value just means we keep the defaults.
  }
}

/* ---------- controls ---------- */

function currentPreset() {
  return BACKGROUNDS.find((item) => item.id === settings.preset) ?? BACKGROUNDS[0];
}

function isCropped() {
  const { x, y, width, height } = settings.crop;
  return x > 0 || y > 0 || width < 1 || height < 1;
}

// Keeps the hex label legible on top of the colour the user picked.
function readableInk(hex) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#17211b" : "#f4f0e6";
}

function syncControls() {
  paddingInput.value = settings.padding;
  radiusInput.value = settings.radius;
  shadowInput.value = settings.shadow;
  paddingValue.textContent = `${settings.padding}%`;
  radiusValue.textContent = `${settings.radius}px`;
  shadowValue.textContent = settings.shadow === 0 ? "Off" : `${settings.shadow}%`;
  cropValue.textContent = isCropped()
    ? `${Math.round(settings.crop.width * 100)}% × ${Math.round(settings.crop.height * 100)}%`
    : "Whole image";
  cropReset.disabled = !isCropped();

  colorInput.value = settings.color;
  const usingColor = settings.mode === "color";
  colorLabel.textContent = usingColor ? settings.color.toUpperCase() : "Custom color";
  colorLabel.parentElement.classList.toggle("active", usingColor);
  colorLabel.parentElement.style.background = usingColor ? settings.color : "";
  colorLabel.style.color = usingColor ? readableInk(settings.color) : "";
  colorRemove.hidden = !usingColor;

  uploadLabel.parentElement.classList.toggle(
    "active",
    settings.mode === "image" && Boolean(backgroundImage),
  );
  uploadRemove.hidden = !backgroundImage;

  document.querySelectorAll('input[name="background"]').forEach((input) => {
    input.checked = settings.mode === "preset" && input.value === settings.preset;
  });
}

function buildSwatches() {
  BACKGROUNDS.forEach((background) => {
    const label = document.createElement("label");
    label.className = "swatch";
    label.title = background.label;
    label.style.background = background.css;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "background";
    input.value = background.id;
    input.setAttribute("aria-label", background.label);
    input.addEventListener("change", () => {
      settings.mode = "preset";
      settings.preset = background.id;
      commit();
    });

    label.append(input);
    backgroundList.append(label);
  });
}

// Every user-visible change funnels through here so history stays honest.
function commit() {
  syncControls();
  savePreferences();
  render();
  pushHistory();
}

/* ---------- drawing ---------- */

function paintBackground(width, height) {
  if (settings.mode === "image" && backgroundImage) {
    // Cover the frame without squashing the uploaded image.
    const scale = Math.max(width / backgroundImage.width, height / backgroundImage.height);
    const drawWidth = backgroundImage.width * scale;
    const drawHeight = backgroundImage.height * scale;
    composedContext.drawImage(
      backgroundImage,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    return;
  }

  if (settings.mode === "color") {
    composedContext.fillStyle = settings.color;
    composedContext.fillRect(0, 0, width, height);
    return;
  }

  const background = currentPreset();

  if (background.gradient) {
    const gradient = composedContext.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, background.gradient[0]);
    gradient.addColorStop(1, background.gradient[1]);
    composedContext.fillStyle = gradient;
  } else {
    composedContext.fillStyle = background.color;
  }
  composedContext.fillRect(0, 0, width, height);
}

function render() {
  if (!shot) return;

  // Padding is a share of the shot's width so the frame looks even on any size.
  const inset = Math.round((settings.padding / 100) * shot.width);
  const width = shot.width + inset * 2;
  const height = shot.height + inset * 2;

  composed.width = width;
  composed.height = height;
  composedContext.clearRect(0, 0, width, height);
  paintBackground(width, height);

  // Radius and shadow scale with the shot so a retina capture is not under-styled.
  const scale = Math.max(1, shot.width / 1200);
  const radius = Math.min(settings.radius * scale, shot.width / 2, shot.height / 2);

  if (settings.shadow > 0 && inset > 0) {
    const strength = settings.shadow / 100;
    composedContext.save();
    composedContext.shadowColor = `rgba(15, 20, 17, ${0.62 * strength})`;
    composedContext.shadowBlur = Math.max(12, inset * 1.1 * strength);
    composedContext.shadowOffsetY = Math.max(3, inset * 0.35 * strength);
    composedContext.beginPath();
    composedContext.roundRect(inset, inset, shot.width, shot.height, radius);
    composedContext.fillStyle = "#000";
    composedContext.fill();
    composedContext.restore();
  }

  composedContext.save();
  composedContext.beginPath();
  composedContext.roundRect(inset, inset, shot.width, shot.height, radius);
  composedContext.clip();
  composedContext.drawImage(shot, inset, inset);
  composedContext.restore();

  // The crop takes background and screenshot together, whatever it covers.
  const sourceX = Math.round(settings.crop.x * width);
  const sourceY = Math.round(settings.crop.y * height);
  const sourceWidth = Math.max(1, Math.round(settings.crop.width * width));
  const sourceHeight = Math.max(1, Math.round(settings.crop.height * height));

  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  context.clearRect(0, 0, sourceWidth, sourceHeight);
  context.drawImage(
    composed,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );

  dimensions.textContent = `${sourceWidth} × ${sourceHeight}`;
}

/* ---------- crop dragging ---------- */

let drag = null;

function pointOnCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
    y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
    rect,
  };
}

canvas.addEventListener("pointerdown", (event) => {
  if (!shot || event.button !== 0) return;
  const point = pointOnCanvas(event);
  drag = { startX: point.x, startY: point.y, rect: point.rect };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const point = pointOnCanvas(event);
  const left = Math.min(drag.startX, point.x);
  const top = Math.min(drag.startY, point.y);
  const width = Math.abs(point.x - drag.startX);
  const height = Math.abs(point.y - drag.startY);

  drag.box = { left, top, width, height };
  Object.assign(marquee.style, {
    left: `${canvas.offsetLeft + left}px`,
    top: `${canvas.offsetTop + top}px`,
    width: `${width}px`,
    height: `${height}px`,
  });
  marquee.hidden = false;
});

canvas.addEventListener("pointerup", (event) => {
  if (!drag) return;
  const box = drag.box;
  const { rect } = drag;
  drag = null;
  marquee.hidden = true;
  canvas.releasePointerCapture(event.pointerId);

  // Ignore stray clicks and hairline drags.
  if (!box || box.width < 12 || box.height < 12) return;

  // The drag is inside the current view, so fold it into the existing crop.
  const previous = settings.crop;
  settings.crop = {
    x: previous.x + (box.left / rect.width) * previous.width,
    y: previous.y + (box.top / rect.height) * previous.height,
    width: (box.width / rect.width) * previous.width,
    height: (box.height / rect.height) * previous.height,
  };
  commit();
  setStatus("Cropped");
});

cropReset.addEventListener("click", () => {
  settings.crop = { ...FULL_CROP };
  commit();
  setStatus("Showing whole image");
});

/* ---------- output ---------- */

function toBlob() {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG creation failed."))),
      "image/png",
    );
  });
}

async function copyImage() {
  try {
    setStatus("Copying");
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": await toBlob() }),
    ]);
    setStatus("Copied to clipboard");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Copy failed", "error");
  }
}

async function downloadImage() {
  try {
    setStatus("Saving");
    const objectUrl = URL.createObjectURL(await toBlob());
    await chrome.downloads.download({
      url: objectUrl,
      filename: filename.replace(/\.png$/, "-framed.png"),
      saveAs: false,
    });
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    setStatus("Downloaded");
  } catch (error) {
    console.error(error);
    setStatus("Download failed", "error");
  }
}

/* ---------- events ---------- */

// Sliders redraw live but only land in history when the drag ends.
function wireSlider(input, key) {
  input.addEventListener("input", () => {
    settings[key] = Number(input.value);
    syncControls();
    render();
  });
  input.addEventListener("change", () => {
    settings[key] = Number(input.value);
    commit();
  });
}

wireSlider(paddingInput, "padding");
wireSlider(radiusInput, "radius");
wireSlider(shadowInput, "shadow");

colorInput.addEventListener("input", () => {
  settings.mode = "color";
  settings.color = colorInput.value;
  syncControls();
  render();
});

colorInput.addEventListener("change", () => {
  settings.mode = "color";
  settings.color = colorInput.value;
  commit();
  setStatus("Custom color added");
});

colorRemove.addEventListener("click", () => {
  settings.mode = "preset";
  commit();
  setStatus("Custom color removed");
});

uploadInput.addEventListener("change", async () => {
  const file = uploadInput.files?.[0];
  if (!file) return;

  try {
    const nextImage = await createImageBitmap(file);
    backgroundImage?.close();
    backgroundImage = nextImage;
    settings.mode = "image";
    uploadLabel.textContent = file.name;
    await shotStore.saveBackground(file, file.name);
    commit();
    setStatus("Background image added");
  } catch (error) {
    console.error(error);
    setStatus("That image could not be read", "error");
  }
});

uploadRemove.addEventListener("click", async () => {
  backgroundImage?.close();
  backgroundImage = null;
  uploadInput.value = "";
  uploadLabel.textContent = "Use my own image";
  if (settings.mode === "image") settings.mode = "preset";
  await shotStore.clearBackground().catch(() => {});
  commit();
  setStatus("Background image removed");
});

undoButton.addEventListener("click", () => applyHistory(-1));
redoButton.addEventListener("click", () => applyHistory(1));

document.addEventListener("keydown", (event) => {
  if (!(event.metaKey || event.ctrlKey)) return;
  const key = event.key.toLowerCase();

  if (key === "z" || key === "y") {
    event.preventDefault();
    applyHistory(key === "y" || event.shiftKey ? 1 : -1);
    return;
  }

  // Let a real text selection copy itself instead of grabbing the image.
  if (key === "c" && shot && !document.getSelection()?.toString()) {
    event.preventDefault();
    copyImage();
    return;
  }

  // Beats Chrome's own bookmark shortcut.
  if (key === "d" && shot) {
    event.preventDefault();
    downloadImage();
  }
});

copyButton.addEventListener("click", copyImage);
downloadButton.addEventListener("click", downloadImage);

/* ---------- start ---------- */

async function load() {
  loadPreferences();
  labelShortcuts();
  buildSwatches();

  const savedBackground = await shotStore.loadBackground().catch(() => null);
  if (savedBackground?.blob) {
    backgroundImage = await createImageBitmap(savedBackground.blob).catch(() => null);
    if (backgroundImage) uploadLabel.textContent = savedBackground.name || "My image";
  }
  // The saved image may be gone; fall back rather than painting nothing.
  if (settings.mode === "image" && !backgroundImage) settings.mode = "preset";

  syncControls();
  pushHistory();

  const record = await shotStore.load().catch(() => null);

  if (!record?.blob) {
    frame.hidden = true;
    emptyState.hidden = false;
    [copyButton, downloadButton].forEach((button) => (button.disabled = true));
    setStatus("Nothing loaded");
    return;
  }

  shot = await createImageBitmap(record.blob);
  filename = record.filename || filename;

  // A crop belongs to the shot it was drawn on, so a new capture starts whole.
  // Background, padding, corners and shadow carry over on purpose.
  const lastShotId = localStorage.getItem("editor-shot-id");
  if (record.id && record.id !== lastShotId) {
    localStorage.setItem("editor-shot-id", record.id);
    settings.crop = { ...FULL_CROP };
    history.entries = [];
    history.index = -1;
    syncControls();
    savePreferences();
  }

  render();
  pushHistory();
  setStatus("Ready");
}

load();

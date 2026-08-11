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
const toastList = document.querySelector("#toasts");
const presetPicker = document.querySelector("#preset-picker");
const presetSave = document.querySelector("#preset-save");
const presetSaveAs = document.querySelector("#preset-save-as");
const presetDelete = document.querySelector("#preset-delete");
const solidList = document.querySelector("#solids");
const gradientList = document.querySelector("#gradients");
const borderToggle = document.querySelector("#border");
const borderColorInput = document.querySelector("#border-color");
const borderColorLabel = document.querySelector("#border-color-label");
const borderWidthInput = document.querySelector("#border-width");
const borderWidthValue = document.querySelector("#border-width-value");
const paddingInput = document.querySelector("#padding");
const radiusInput = document.querySelector("#radius");
const shadowInput = document.querySelector("#shadow");
const paddingValue = document.querySelector("#padding-value");
const radiusValue = document.querySelector("#radius-value");
const shadowValue = document.querySelector("#shadow-value");
const cropValue = document.querySelector("#crop-value");
const cropReset = document.querySelector("#crop-reset");
const colorInput = document.querySelector("#color");
const colorList = document.querySelector("#colors");
const colorsSub = document.querySelector("#colors-sub");
const uploadInput = document.querySelector("#upload");
const imageList = document.querySelector("#images");
const imagesSub = document.querySelector("#images-sub");
const undoButton = document.querySelector("#undo");
const redoButton = document.querySelector("#redo");
const resetButton = document.querySelector("#reset");
const copyButton = document.querySelector("#copy");
const downloadButton = document.querySelector("#download");

const SOLIDS = [
  // Draws nothing, so the PNG keeps its alpha channel.
  { id: "none", label: "Transparent", transparent: true },
  { id: "paper", label: "Paper", color: "#f4f0e6" },
  { id: "ink", label: "Ink", color: "#17211b" },
  { id: "white", label: "White", color: "#ffffff" },
  { id: "black", label: "Black", color: "#000000" },
  { id: "ash", label: "Ash", color: "#8e948d" },
  { id: "sand", label: "Sand", color: "#e3cfa9" },
  { id: "terracotta", label: "Terracotta", color: "#c1674a" },
  { id: "olive", label: "Olive", color: "#5c6b3c" },
  { id: "forest", label: "Forest", color: "#1d3b2a" },
  { id: "teal", label: "Teal", color: "#1f6f6b" },
  { id: "navy", label: "Navy", color: "#1e2f56" },
  { id: "plum", label: "Plum", color: "#5b2f4a" },
  { id: "wine", label: "Wine", color: "#7a2233" },
  { id: "lime", label: "Lime", color: "#d9ff57" },
  { id: "butter", label: "Butter", color: "#f2d06b" },
];

const GRADIENTS = [
  { id: "bitmap", label: "Bitmap", gradient: ["#c9292b", "#8f1b1c"] },
  { id: "noir", label: "Noir", gradient: ["#9a9a9a", "#5c5c5c"] },
  { id: "ice", label: "Ice", gradient: ["#e6f9fb", "#b3e9f1"] },
  { id: "sand", label: "Sand", gradient: ["#e4c9a7", "#c9a67c"] },
  { id: "forest", label: "Forest", gradient: ["#4a6350", "#33452f"] },
  { id: "mono", label: "Mono", gradient: ["#333333", "#1f1f1f"] },
  { id: "breeze", label: "Breeze", gradient: ["#c132a8", "#9435c6"] },
  { id: "candy", label: "Candy", gradient: ["#cba9fb", "#ad93f8"] },
  { id: "crimson", label: "Crimson", gradient: ["#e66060", "#b04747"] },
  { id: "falcon", label: "Falcon", gradient: ["#a8c3d0", "#73879b"] },
];

// `css` mirrors the canvas fill so each swatch previews what it draws.
const BACKGROUNDS = [...SOLIDS, ...GRADIENTS].map((background) => ({
  ...background,
  css: background.gradient
    ? `linear-gradient(135deg, ${background.gradient[0]}, ${background.gradient[1]})`
    : background.color,
  transparent: Boolean(background.transparent),
}));

const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 };

// mode is "preset", "color", or "image" — whichever the user last chose.
// crop is a share of the whole frame, so it survives padding changes.
const settings = {
  mode: "preset",
  preset: "paper",
  color: colorInput.value,
  padding: Number(paddingInput.value),
  radius: Number(radiusInput.value),
  shadow: Number(shadowInput.value),
  crop: { ...FULL_CROP },
  border: false,
  borderColor: borderColorInput.value,
  borderWidth: Number(borderWidthInput.value),
  imageId: null,
};

// Captured before any saved preferences load, so Reset always has somewhere to go.
const DEFAULTS = structuredClone(settings);

let shot = null;
let filename = "screenshot.png";

// Uploaded backgrounds: { id, name, blob, bitmap, url }. The url feeds the
// thumbnail, the bitmap feeds the canvas.
let images = [];

function selectedImage() {
  return images.find((image) => image.id === settings.imageId) ?? null;
}

// Custom solid colors the user has added, kept as plain hex strings.
let customColors = [];

function saveCustomColors() {
  localStorage.setItem("editor-colors", JSON.stringify(customColors));
}

function loadCustomColors() {
  try {
    const saved = JSON.parse(localStorage.getItem("editor-colors") ?? "[]");
    customColors = Array.isArray(saved) ? saved.filter((value) => /^#[0-9a-f]{6}$/i.test(value)) : [];
  } catch {
    customColors = [];
  }
}

function buildColorSwatches() {
  colorList.textContent = "";
  colorsSub.hidden = customColors.length === 0;

  customColors.forEach((value) => {
    const label = document.createElement("label");
    label.className = "swatch";
    label.title = value.toUpperCase();
    label.style.background = value;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "background";
    input.value = value;
    input.checked = settings.mode === "color" && settings.color === value;
    input.setAttribute("aria-label", value);
    input.addEventListener("change", () => {
      settings.mode = "color";
      settings.color = value;
      commit();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "swatch-remove";
    remove.title = `Remove ${value}`;
    remove.setAttribute("aria-label", `Remove ${value}`);
    remove.textContent = "×";
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      removeCustomColor(value);
    });

    label.append(input, remove);
    colorList.append(label);
  });
}

function addCustomColor(value) {
  if (!customColors.includes(value)) customColors = [...customColors, value];
  saveCustomColors();
  settings.mode = "color";
  settings.color = value;
  buildColorSwatches();
  commit();
  setStatus("Color added");
}

function removeCustomColor(value) {
  customColors = customColors.filter((item) => item !== value);
  saveCustomColors();

  if (settings.mode === "color" && settings.color === value) {
    settings.color = customColors[0] ?? settings.color;
    if (!customColors.length) settings.mode = "preset";
  }

  buildColorSwatches();
  commit();
  setStatus("Color removed");
}

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

// Copying leaves nothing on screen to show it worked, so it gets a toast on top
// of the status line. Downloads have Chrome's own shelf, so they only toast on
// failure.
function showToast(message, state = "") {
  const toast = document.createElement("p");
  toast.className = `toast ${state}`.trim();
  toast.textContent = message;
  toastList.append(toast);

  setTimeout(() => {
    toast.classList.add("leaving");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    // In case the transition never runs and the event never lands.
    setTimeout(() => toast.remove(), 600);
  }, 2400);
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
  if (settings.mode === "image" && !selectedImage()) settings.mode = "preset";
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

/* ---------- saved presets ---------- */

// A preset is the whole look minus the crop, which belongs to one shot only.
// Uploaded backgrounds are kept by id, so a preset made with an image that has
// since been deleted falls back to the plain preset background.
let presets = [];

function presetFromSettings() {
  const { crop, ...look } = settings;
  return look;
}

function savePresets() {
  localStorage.setItem("editor-presets", JSON.stringify(presets));
}

// Which preset is selected outlives a refresh or a fresh capture; the settings
// themselves are already remembered separately, so this only restores the
// dropdown and what its buttons offer.
function rememberActivePreset() {
  localStorage.setItem("editor-preset-name", presetPicker.value);
}

function activePresetName() {
  return localStorage.getItem("editor-preset-name") ?? "";
}

function loadPresets() {
  try {
    const saved = JSON.parse(localStorage.getItem("editor-presets") ?? "[]");
    presets = Array.isArray(saved) ? saved.filter((item) => item?.name && item.look) : [];
  } catch {
    presets = [];
  }
}

function buildPresetPicker(selected = "") {
  presetPicker.textContent = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = presets.length ? "Presets" : "No presets yet";
  presetPicker.append(placeholder);

  presets.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.name;
    option.textContent = preset.name;
    presetPicker.append(option);
  });

  presetPicker.value = presets.some((preset) => preset.name === selected) ? selected : "";
  rememberActivePreset();
  syncPresetButtons();
}

// True once the current look has drifted from the preset it came from.
function isPresetDirty() {
  const preset = presets.find((item) => item.name === presetPicker.value);
  if (!preset) return true;
  return JSON.stringify(preset.look) !== JSON.stringify(presetFromSettings());
}

// With a preset picked, Save writes over it and "Save as new" starts another;
// with none picked there is only one thing Save can mean. Both stay disabled
// until something actually differs from the picked preset.
function syncPresetButtons() {
  const active = Boolean(presetPicker.value);
  const dirty = isPresetDirty();
  presetSave.textContent = active ? "Update" : "Save";
  presetSave.title = active
    ? `Save the current look over "${presetPicker.value}"`
    : "Save the current look as a preset";
  presetSave.disabled = active && !dirty;
  presetSaveAs.hidden = !active;
  presetSaveAs.disabled = !dirty;
  presetDelete.disabled = !active;
}

function storePreset(name) {
  const look = structuredClone(presetFromSettings());
  const existing = presets.findIndex((preset) => preset.name === name);

  if (existing >= 0) presets[existing] = { name, look };
  else presets = [...presets, { name, look }];

  savePresets();
  buildPresetPicker(name);
  setStatus(`Preset "${name}" saved`);
  showToast(`Preset "${name}" saved`);
}

function saveNewPreset() {
  const suggested = `Preset ${presets.length + 1}`;
  const name = window.prompt("Name this preset", suggested)?.trim();
  if (!name) return;

  const clash = presets.some((preset) => preset.name === name);
  if (clash && !window.confirm(`Replace the preset named "${name}"?`)) return;

  storePreset(name);
}

// Updates the picked preset in place, or asks for a name when none is picked.
function savePreset() {
  if (presetPicker.value) storePreset(presetPicker.value);
  else saveNewPreset();
}

function applyPreset(name) {
  const preset = presets.find((item) => item.name === name);
  if (!preset) return;

  Object.assign(settings, structuredClone(preset.look));

  // The image behind the preset may be long gone.
  if (settings.mode === "image" && !selectedImage()) settings.mode = "preset";

  // commit() re-syncs the controls, buttons included.
  commit();
  setStatus(`Preset "${name}" applied`);
}

function deleteSelectedPreset() {
  const name = presetPicker.value;
  if (!name) return;
  if (!window.confirm(`Delete the preset named "${name}"?`)) return;

  presets = presets.filter((preset) => preset.name !== name);
  savePresets();
  buildPresetPicker();
  setStatus(`Preset "${name}" deleted`);
}

/* ---------- controls ---------- */

function currentPreset() {
  return (
    BACKGROUNDS.find((item) => item.id === settings.preset) ??
    BACKGROUNDS.find((item) => item.id === DEFAULTS.preset)
  );
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

// Chrome can't colour the filled half of a range on its own, so the track
// reads a --fill percentage from the element.
function paintSliderFill(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const ratio = max === min ? 0 : (Number(input.value) - min) / (max - min);
  input.style.setProperty("--fill", `${ratio * 100}%`);
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

  borderToggle.checked = settings.border;
  borderColorInput.value = settings.borderColor;
  borderWidthInput.value = settings.borderWidth;
  borderWidthValue.textContent = `${settings.borderWidth}px`;
  borderColorLabel.textContent = settings.borderColor.toUpperCase();
  borderColorLabel.parentElement.style.background = settings.borderColor;
  borderColorLabel.style.color = readableInk(settings.borderColor);

  colorInput.value = settings.color;

  document.querySelectorAll('input[type="range"]').forEach(paintSliderFill);
  syncPresetButtons();

  document.querySelectorAll('input[name="background"]').forEach((input) => {
    if (settings.mode === "image") input.checked = input.value === settings.imageId;
    else if (settings.mode === "color") input.checked = input.value === settings.color;
    else input.checked = input.value === settings.preset;
  });
}

function buildSwatches(backgrounds, container) {
  backgrounds.forEach((background) => {
    const label = document.createElement("label");
    label.className = background.transparent ? "swatch swatch-none" : "swatch";
    label.title = background.label;
    if (background.css) label.style.background = background.css;

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
    container.append(label);
  });
}

function buildImageSwatches() {
  imageList.textContent = "";
  imagesSub.hidden = images.length === 0;

  images.forEach((image) => {
    const label = document.createElement("label");
    label.className = "swatch";
    label.title = image.name;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "background";
    input.value = image.id;
    input.checked = settings.mode === "image" && settings.imageId === image.id;
    input.setAttribute("aria-label", image.name);
    input.addEventListener("change", () => {
      settings.mode = "image";
      settings.imageId = image.id;
      commit();
    });

    const thumb = document.createElement("img");
    thumb.className = "thumb";
    thumb.src = image.url;
    thumb.alt = "";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "swatch-remove";
    remove.title = `Remove ${image.name}`;
    remove.setAttribute("aria-label", `Remove ${image.name}`);
    remove.textContent = "×";
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      removeImage(image.id);
    });

    label.append(input, thumb, remove);
    imageList.append(label);
  });
}

async function persistImages() {
  await shotStore
    .saveBackgrounds(images.map(({ id, name, blob }) => ({ id, name, blob })))
    .catch(() => setStatus("Could not save that image", "error"));
}

async function addImages(files) {
  const added = [];

  for (const file of files) {
    try {
      added.push({
        // Unique enough for a list the user curates by hand.
        id: `${file.name}-${file.size}-${images.length + added.length}`,
        name: file.name,
        blob: file,
        bitmap: await createImageBitmap(file),
        url: URL.createObjectURL(file),
      });
    } catch (error) {
      console.error(error);
      setStatus(`Could not read ${file.name}`, "error");
    }
  }

  if (!added.length) return;

  images = [...images, ...added];
  settings.mode = "image";
  settings.imageId = added[added.length - 1].id;
  await persistImages();
  buildImageSwatches();
  commit();
  setStatus(added.length > 1 ? `${added.length} images added` : "Image added");
}

async function removeImage(id) {
  const image = images.find((item) => item.id === id);
  if (!image) return;

  image.bitmap?.close();
  URL.revokeObjectURL(image.url);
  images = images.filter((item) => item.id !== id);

  if (settings.imageId === id) {
    // Fall back to another upload if there is one, otherwise to the presets.
    settings.imageId = images[0]?.id ?? null;
    if (!settings.imageId && settings.mode === "image") settings.mode = "preset";
  }

  await persistImages();
  buildImageSwatches();
  commit();
  setStatus("Image removed");
}

// Every user-visible change funnels through here so history stays honest.
function commit() {
  syncControls();
  savePreferences();
  render();
  pushHistory();
}

/* ---------- drawing ---------- */

// Figma/iOS-style corners: the curve starts further along each edge than a
// plain arc does and eases into it, so there is no visible kink where the
// straight edge meets the corner. EXTENT turns a radius into how far along the
// edge the curve reaches, PULL sets how close its handles sit to the corner.
const CORNER_EXTENT = 1.4;
const CORNER_PULL = 0.4;

function cornerExtent(radius) {
  return radius * CORNER_EXTENT;
}

// Takes the extent rather than a radius, so a border can draw a path that runs
// parallel to the shot's: growing the extent by the border width offsets the
// whole curve by that width, which scaling the radius would not do.
function squirclePath(ctx, x, y, width, height, extent) {
  const k = Math.min(extent, width / 2, height / 2);

  if (k <= 0) {
    ctx.rect(x, y, width, height);
    return;
  }

  const t = k * CORNER_PULL;
  const right = x + width;
  const bottom = y + height;

  ctx.moveTo(x + k, y);
  ctx.lineTo(right - k, y);
  ctx.bezierCurveTo(right - t, y, right, y + t, right, y + k);
  ctx.lineTo(right, bottom - k);
  ctx.bezierCurveTo(right, bottom - t, right - t, bottom, right - k, bottom);
  ctx.lineTo(x + k, bottom);
  ctx.bezierCurveTo(x + t, bottom, x, bottom - t, x, bottom - k);
  ctx.lineTo(x, y + k);
  ctx.bezierCurveTo(x, y + t, x + t, y, x + k, y);
  ctx.closePath();
}

function paintBackground(width, height) {
  const image = settings.mode === "image" ? selectedImage()?.bitmap : null;

  if (image) {
    // Cover the frame without squashing the uploaded image.
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    composedContext.drawImage(
      image,
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

  // Nothing to paint — the cleared canvas is the transparent background.
  if (background.transparent) return;

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

  // Radius, border and shadow scale with the shot so a retina capture is not
  // under-styled.
  const scale = Math.max(1, shot.width / 1200);
  const radius = Math.min(settings.radius * scale, shot.width / 2, shot.height / 2);

  // The border is drawn around the shot rather than over it, so the frame grows
  // by its width and no pixels of the capture are covered.
  const lineWidth =
    settings.border && settings.borderWidth > 0
      ? Math.round(settings.borderWidth * scale)
      : 0;

  // Padding is a share of the shot's width so the frame looks even on any size.
  const inset = Math.round((settings.padding / 100) * shot.width) + lineWidth;
  const width = shot.width + inset * 2;
  const height = shot.height + inset * 2;

  composed.width = width;
  composed.height = height;
  composedContext.clearRect(0, 0, width, height);
  paintBackground(width, height);

  // The shot's box, and the box the border's outer edge follows.
  const shotX = inset;
  const shotY = inset;
  const outerX = shotX - lineWidth;
  const outerY = shotY - lineWidth;
  const outerWidth = shot.width + lineWidth * 2;
  const outerHeight = shot.height + lineWidth * 2;
  // Parallel to the shot's corner, one border width out.
  const shotExtent = cornerExtent(radius);
  const outerExtent = shotExtent + lineWidth;

  if (settings.shadow > 0 && inset > 0) {
    const strength = settings.shadow / 100;
    composedContext.save();
    composedContext.shadowColor = `rgba(15, 20, 17, ${0.62 * strength})`;
    composedContext.shadowBlur = Math.max(12, inset * 1.1 * strength);
    composedContext.shadowOffsetY = Math.max(3, inset * 0.35 * strength);
    composedContext.beginPath();
    squirclePath(
      composedContext,
      outerX,
      outerY,
      outerWidth,
      outerHeight,
      outerExtent,
    );
    composedContext.fillStyle = "#000";
    composedContext.fill();
    composedContext.restore();
  }

  // Filled first so the border has something solid behind its inner edge, then
  // the shot is clipped to the same corner on top of it.
  if (lineWidth > 0) {
    composedContext.save();
    composedContext.fillStyle = settings.borderColor;
    composedContext.beginPath();
    squirclePath(
      composedContext,
      outerX,
      outerY,
      outerWidth,
      outerHeight,
      outerExtent,
    );
    composedContext.fill();
    composedContext.restore();
  }

  composedContext.save();
  composedContext.beginPath();
  squirclePath(composedContext, shotX, shotY, shot.width, shot.height, shotExtent);
  composedContext.clip();
  composedContext.drawImage(shot, shotX, shotY);
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
    showToast("Copied to clipboard");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Copy failed", "error");
    showToast(error.message || "Copy failed", "error");
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
    showToast("Download failed", "error");
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

borderToggle.addEventListener("change", () => {
  settings.border = borderToggle.checked;
  commit();
  setStatus(settings.border ? "Border on" : "Border off");
});

borderColorInput.addEventListener("input", () => {
  settings.borderColor = borderColorInput.value;
  syncControls();
  render();
});

borderColorInput.addEventListener("change", () => {
  settings.borderColor = borderColorInput.value;
  commit();
});

wireSlider(borderWidthInput, "borderWidth");

// Live preview while dragging the picker; the color joins the list on release.
colorInput.addEventListener("input", () => {
  settings.mode = "color";
  settings.color = colorInput.value;
  syncControls();
  render();
});

colorInput.addEventListener("change", () => addCustomColor(colorInput.value));

uploadInput.addEventListener("change", async () => {
  const files = [...(uploadInput.files ?? [])];
  uploadInput.value = "";
  if (files.length) await addImages(files);
});

// Undoable, and it leaves any uploaded image in place — just unselected.
resetButton.addEventListener("click", () => {
  Object.assign(settings, structuredClone(DEFAULTS));
  commit();
  setStatus("Back to defaults");
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

presetPicker.addEventListener("change", () => {
  rememberActivePreset();
  syncPresetButtons();
  if (presetPicker.value) applyPreset(presetPicker.value);
});
presetSave.addEventListener("click", savePreset);
presetSaveAs.addEventListener("click", saveNewPreset);
presetDelete.addEventListener("click", deleteSelectedPreset);

/* ---------- start ---------- */

async function load() {
  loadPreferences();
  loadPresets();
  buildPresetPicker(activePresetName());
  loadCustomColors();
  buildColorSwatches();
  labelShortcuts();
  buildSwatches(BACKGROUNDS.filter((item) => !item.gradient), solidList);
  buildSwatches(BACKGROUNDS.filter((item) => item.gradient), gradientList);

  const saved = await shotStore.loadBackgrounds().catch(() => []);
  for (const record of saved) {
    const bitmap = await createImageBitmap(record.blob).catch(() => null);
    if (!bitmap) continue;
    images.push({ ...record, bitmap, url: URL.createObjectURL(record.blob) });
  }
  buildImageSwatches();

  // A saved image may be gone; fall back rather than painting nothing.
  if (settings.mode === "image" && !selectedImage()) settings.mode = "preset";

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
  // A picked preset also starts fresh from its saved look, dropping whatever
  // was tweaked on the last shot; with none picked, the settings carry over.
  const lastShotId = localStorage.getItem("editor-shot-id");
  if (record.id && record.id !== lastShotId) {
    localStorage.setItem("editor-shot-id", record.id);

    const preset = presets.find((item) => item.name === presetPicker.value);
    if (preset) {
      Object.assign(settings, structuredClone(preset.look));
      if (settings.mode === "image" && !selectedImage()) settings.mode = "preset";
    }

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

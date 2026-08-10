const captureButtons = [...document.querySelectorAll(".capture-actions button")];
const fullPageButton = document.querySelector("#capture-full-page");
const viewportButton = document.querySelector("#capture-viewport");
const statusText = document.querySelector("#status");
const statusDot = document.querySelector("#status-dot");
const outputInputs = [...document.querySelectorAll('input[name="output"]')];
const savedOutput = localStorage.getItem("screenshot-output");

if (savedOutput) {
  const savedInput = outputInputs.find((input) => input.value === savedOutput);
  if (savedInput) savedInput.checked = true;
}

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function setStatus(message, state = "busy") {
  statusText.textContent = message;
  statusDot.className = `status-dot ${state}`;
}

async function runOnPage(tabId, functionToRun, args = []) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: functionToRun,
    args,
  });

  return result;
}

function preparePage() {
  const root = document.documentElement;
  const body = document.body;
  const original = {
    x: window.scrollX,
    y: window.scrollY,
    rootScrollBehavior: root.style.scrollBehavior,
    bodyScrollBehavior: body?.style.scrollBehavior ?? "",
  };

  root.style.scrollBehavior = "auto";
  if (body) body.style.scrollBehavior = "auto";

  window.__fullPageScreenshot = original;

  return {
    width: Math.max(root.scrollWidth, body?.scrollWidth ?? 0),
    height: Math.max(root.scrollHeight, body?.scrollHeight ?? 0),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  };
}

function scrollPageTo(x, y) {
  window.scrollTo(x, y);
  return { x: window.scrollX, y: window.scrollY };
}

function restorePage() {
  const original = window.__fullPageScreenshot;
  if (!original) return;

  document.documentElement.style.scrollBehavior = original.rootScrollBehavior;
  if (document.body) {
    document.body.style.scrollBehavior = original.bodyScrollBehavior;
  }
  window.scrollTo(original.x, original.y);
  delete window.__fullPageScreenshot;
}

function safeFilename(url, captureType) {
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${hostname || "webpage"}-${captureType}-${timestamp}.png`;
}

async function downloadPng(blob, tab, captureType) {
  const objectUrl = URL.createObjectURL(blob);

  try {
    await chrome.downloads.download({
      url: objectUrl,
      filename: safeFilename(tab.url, captureType),
      saveAs: false,
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }
}

async function copyPng(blob) {
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
}

async function saveOutput(blob, tab, captureType) {
  const output = outputInputs.find((input) => input.checked)?.value ?? "clipboard";
  setStatus(output === "clipboard" ? "Copying image" : "Preparing download");
  if (output === "clipboard") {
    await copyPng(blob);
  } else {
    await downloadPng(blob, tab, captureType);
  }
}

async function captureFullPage(tab) {
  const page = await runOnPage(tab.id, preparePage);
  const scale = page.devicePixelRatio;
  const outputWidth = Math.round(page.width * scale);
  const outputHeight = Math.round(page.height * scale);

  if (outputWidth > 32767 || outputHeight > 32767) {
    throw new Error("This page is too large for one PNG.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");

  const xPositions = [];
  const yPositions = [];
  for (let x = 0; x < page.width; x += page.viewportWidth) xPositions.push(x);
  for (let y = 0; y < page.height; y += page.viewportHeight) yPositions.push(y);

  const positions = yPositions.flatMap((y) => xPositions.map((x) => ({ x, y })));

  for (let index = 0; index < positions.length; index += 1) {
    const requested = positions[index];
    setStatus(`Capturing ${index + 1} of ${positions.length}`);
    const actual = await runOnPage(tab.id, scrollPageTo, [requested.x, requested.y]);
    // Chrome limits captureVisibleTab to two calls per second.
    await wait(550);

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });
    const image = await createImageBitmap(await (await fetch(dataUrl)).blob());

    const sourceWidth = Math.min(
      image.width,
      Math.round((page.width - actual.x) * scale),
    );
    const sourceHeight = Math.min(
      image.height,
      Math.round((page.height - actual.y) * scale),
    );

    context.drawImage(
      image,
      0,
      0,
      sourceWidth,
      sourceHeight,
      Math.round(actual.x * scale),
      Math.round(actual.y * scale),
      sourceWidth,
      sourceHeight,
    );
    image.close();
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("PNG creation failed."))),
      "image/png",
    );
  });
  await saveOutput(blob, tab, "full-page");
}

async function captureViewport(tab) {
  setStatus("Capturing viewport");
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  const blob = await (await fetch(dataUrl)).blob();
  await saveOutput(blob, tab, "viewport");
}

async function handleCapture(captureType) {
  captureButtons.forEach((button) => {
    button.disabled = true;
  });
  setStatus("Reading page");

  let activeTab;
  try {
    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id || !/^https?:/.test(activeTab.url ?? "")) {
      throw new Error("Open a regular website first.");
    }

    if (captureType === "full-page") {
      await captureFullPage(activeTab);
    } else {
      await captureViewport(activeTab);
    }
    const output = outputInputs.find((input) => input.checked)?.value ?? "clipboard";
    setStatus(output === "clipboard" ? "Screenshot copied" : "Screenshot downloaded", "");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Capture failed", "error");
  } finally {
    if (captureType === "full-page" && activeTab?.id) {
      await runOnPage(activeTab.id, restorePage).catch(() => {});
    }
    captureButtons.forEach((button) => {
      button.disabled = false;
    });
  }
}

fullPageButton.addEventListener("click", () => handleCapture("full-page"));
viewportButton.addEventListener("click", () => handleCapture("viewport"));
outputInputs.forEach((input) => {
  input.addEventListener("change", () => localStorage.setItem("screenshot-output", input.value));
});

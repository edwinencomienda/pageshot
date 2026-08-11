const captureButtons = [
  ...document.querySelectorAll(".capture-actions button:not(#stop)"),
];
const fullPageButton = document.querySelector("#capture-full-page");
const viewportButton = document.querySelector("#capture-viewport");
const statusText = document.querySelector("#status");
const statusDot = document.querySelector("#status-dot");
const stopButton = document.querySelector("#stop");
const editorToggle = document.querySelector("#use-editor");

// Set by the Stop button; the capture loop checks it between screens.
let stopRequested = false;

editorToggle.checked = localStorage.getItem("screenshot-editor") === "on";

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

// pinDown is only wanted for a full-page capture: a sticky header would
// otherwise be re-photographed on every screen and land across the middle of
// the stitched image.
function preparePage(pinDown) {
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

  // clientWidth/clientHeight leave out the scrollbars, so sizing the canvas by
  // them crops the scrollbars off each shot without touching the page: hiding
  // them in CSS widens the viewport, and anything that measured its own width
  // in JS on load does not follow, leaving a band down the side.
  //
  // scrollWidth/scrollHeight are no help either — they count overflow the page
  // will never scroll to. Asking it to scroll as far as it can and seeing where
  // it lands gives the area that can really be photographed.
  //
  // Measured BEFORE any pinning below: off-canvas menus are usually parked
  // beyond the right edge as position:fixed, which does not widen a page — but
  // re-pinning them to absolute does, and a width taken after that grows a
  // phantom column of empty background down the right of the stitched image.
  const viewportWidth = root.clientWidth;
  const viewportHeight = root.clientHeight;

  // A viewport capture shoots the page exactly where the user left it, so it
  // must not be scrolled around to find the reach it never uses.
  let reach = { x: 0, y: 0 };
  if (pinDown) {
    window.scrollTo(1e7, 1e7);
    reach = { x: window.scrollX, y: window.scrollY };
    window.scrollTo(0, 0);
  }

  // Fixed elements are re-pointed to where they sit at the top of the page and
  // sticky ones let go, so each appears once, in its natural place.
  original.pinned = [];

  if (pinDown) {
    window.scrollTo(0, 0);

    for (const element of document.body?.querySelectorAll("*") ?? []) {
      const position = getComputedStyle(element).position;
      if (position !== "fixed" && position !== "sticky") continue;

      const style = element.style;
      original.pinned.push({
        element,
        position: style.position,
        top: style.top,
        left: style.left,
      });

      if (position === "sticky") {
        style.setProperty("position", "static", "important");
        continue;
      }

      // Absolute offsets are measured from whichever ancestor is positioned,
      // so the element is dropped at 0,0 and then nudged back by however far
      // that landed it from where it was — no need to know the ancestor.
      const box = element.getBoundingClientRect();
      style.setProperty("position", "absolute", "important");
      style.setProperty("top", "0px", "important");
      style.setProperty("left", "0px", "important");

      const moved = element.getBoundingClientRect();
      style.setProperty("top", `${box.top - moved.top}px`, "important");
      style.setProperty("left", `${box.left - moved.left}px`, "important");
    }
  }

  window.__fullPageScreenshot = original;

  return {
    width: reach.x + viewportWidth,
    height: reach.y + viewportHeight,
    viewportWidth,
    viewportHeight,
    // What each shot covers, scrollbars and all — the yardstick for working out
    // how many image pixels there are per CSS pixel.
    shotWidth: window.innerWidth,
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

  for (const entry of original.pinned ?? []) {
    entry.element.style.position = entry.position;
    entry.element.style.top = entry.top;
    entry.element.style.left = entry.left;
  }

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

async function copyPng(blob) {
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
}

async function openInEditor(blob, tab, captureType) {
  setStatus("Opening editor");
  await shotStore.save(blob, {
    filename: safeFilename(tab.url, captureType),
    id: `${Date.now()}`,
  });

  // Reuse one editor tab so an older capture is never left sitting in another.
  const url = chrome.runtime.getURL("editor.html");
  const knownTabId = Number(localStorage.getItem("editor-tab-id"));

  if (knownTabId) {
    try {
      // Setting the url reloads the tab, so it picks up the new capture.
      await chrome.tabs.update(knownTabId, { url, active: true });
      return;
    } catch {
      // The tab was closed since last time; fall through and open a new one.
    }
  }

  const editorTab = await chrome.tabs.create({ url });
  localStorage.setItem("editor-tab-id", String(editorTab.id));
}

async function saveOutput(blob, tab, captureType) {
  if (editorToggle.checked) {
    await openInEditor(blob, tab, captureType);
    return;
  }

  setStatus("Copying image");
  await copyPng(blob);
}

async function captureFullPage(tab) {
  const page = await runOnPage(tab.id, preparePage, [true]);

  const xPositions = [];
  const yPositions = [];
  for (let x = 0; x < page.width; x += page.viewportWidth) xPositions.push(x);
  for (let y = 0; y < page.height; y += page.viewportHeight) yPositions.push(y);

  const positions = yPositions.flatMap((y) => xPositions.map((x) => ({ x, y })));

  // devicePixelRatio is only a guess at how big the shots come back — zoom and
  // rounding both bend it — so the real scale comes from the first one. Until
  // then there is nothing to draw on.
  let scale = page.devicePixelRatio;
  let canvas = null;
  let context = null;

  // How far the shots actually painted. Whatever measurement of the page was
  // off, cropping to this leaves no empty bands on the right or bottom.
  let paintedWidth = 0;
  let paintedHeight = 0;

  for (let index = 0; index < positions.length; index += 1) {
    if (stopRequested) throw new Error("Capture stopped.");

    const requested = positions[index];
    setStatus(`Capturing ${index + 1} of ${positions.length}`);
    const actual = await runOnPage(tab.id, scrollPageTo, [requested.x, requested.y]);
    // Chrome limits captureVisibleTab to two calls per second.
    await wait(550);

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });
    const image = await createImageBitmap(await (await fetch(dataUrl)).blob());

    if (!canvas) {
      scale = image.width / page.shotWidth;
      const outputWidth = Math.round(page.width * scale);
      const outputHeight = Math.round(page.height * scale);

      if (outputWidth > 32767 || outputHeight > 32767) {
        image.close();
        throw new Error("This page is too large for one PNG.");
      }

      canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      context = canvas.getContext("2d");
    }

    const destinationX = Math.round(actual.x * scale);
    const destinationY = Math.round(actual.y * scale);
    const sourceWidth = Math.min(image.width, canvas.width - destinationX);
    const sourceHeight = Math.min(image.height, canvas.height - destinationY);

    context.drawImage(
      image,
      0,
      0,
      sourceWidth,
      sourceHeight,
      destinationX,
      destinationY,
      sourceWidth,
      sourceHeight,
    );
    image.close();

    paintedWidth = Math.max(paintedWidth, destinationX + sourceWidth);
    paintedHeight = Math.max(paintedHeight, destinationY + sourceHeight);
  }

  if (paintedWidth < canvas.width || paintedHeight < canvas.height) {
    const cropped = document.createElement("canvas");
    cropped.width = Math.max(1, paintedWidth);
    cropped.height = Math.max(1, paintedHeight);
    cropped.getContext("2d").drawImage(canvas, 0, 0);
    canvas = cropped;
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("PNG creation failed."))),
      "image/png",
    );
  });

  // Opening the editor closes the popup, and with it this script, so the page
  // is put back before that rather than only in handleCapture's finally.
  await runOnPage(tab.id, restorePage).catch(() => {});
  await saveOutput(blob, tab, "full-page");
}

async function captureViewport(tab) {
  setStatus("Capturing viewport");
  const page = await runOnPage(tab.id, preparePage, [false]);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  await runOnPage(tab.id, restorePage).catch(() => {});

  const image = await createImageBitmap(await (await fetch(dataUrl)).blob());

  // The shot covers innerWidth/innerHeight, scrollbars included; the client
  // size stops where they start, so cropping to it cuts them off. Usually the
  // two match (overlay scrollbars) and the shot passes through untouched.
  const scale = image.width / page.shotWidth;
  const croppedWidth = Math.min(image.width, Math.round(page.viewportWidth * scale));
  const croppedHeight = Math.min(image.height, Math.round(page.viewportHeight * scale));

  let blob;
  if (croppedWidth === image.width && croppedHeight === image.height) {
    blob = await (await fetch(dataUrl)).blob();
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = croppedWidth;
    canvas.height = croppedHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("PNG creation failed."))),
        "image/png",
      );
    });
  }
  image.close();

  await saveOutput(blob, tab, "viewport");
}

async function handleCapture(captureType) {
  stopRequested = false;
  captureButtons.forEach((button) => {
    button.disabled = true;
  });
  stopButton.hidden = captureType !== "full-page";
  stopButton.disabled = false;
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
    setStatus(editorToggle.checked ? "Opened in editor" : "Screenshot copied", "");
  } catch (error) {
    if (stopRequested) {
      setStatus("Stopped", "");
    } else {
      console.error(error);
      setStatus(error.message || "Capture failed", "error");
    }
  } finally {
    stopButton.hidden = true;
    if (activeTab?.id) {
      await runOnPage(activeTab.id, restorePage).catch(() => {});
    }
    captureButtons.forEach((button) => {
      button.disabled = false;
    });
  }
}

stopButton.addEventListener("click", () => {
  stopRequested = true;
  stopButton.disabled = true;
  setStatus("Stopping");
});

fullPageButton.addEventListener("click", () => handleCapture("full-page"));
viewportButton.addEventListener("click", () => handleCapture("viewport"));
editorToggle.addEventListener("change", () => {
  localStorage.setItem("screenshot-editor", editorToggle.checked ? "on" : "off");
});

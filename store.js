// Hands a captured PNG from the popup to the editor tab.
// IndexedDB, not chrome.storage, because full-page PNGs blow past the 10 MB quota.
const SHOT_DB = "full-page-screenshot";
const SHOT_STORE = "shots";
// Shots are keyed by their id so several editor tabs can hold one each.
const LEGACY_SHOT_KEY = "latest";
const SHOT_TTL = 24 * 60 * 60 * 1000;

function openShotDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHOT_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(SHOT_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runShotTransaction(mode, run) {
  const db = await openShotDb();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(SHOT_STORE, mode);
      const request = run(transaction.objectStore(SHOT_STORE));
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

const BACKGROUNDS_KEY = "backgrounds";

const shotStore = {
  save: async (blob, meta = {}) => {
    const id = meta.id ?? `${Date.now()}`;
    await runShotTransaction("readwrite", (store) => {
      // Yesterday's shots are of no use to anyone; stop them piling up.
      const cutoff = Date.now() - SHOT_TTL;
      store.getAllKeys().onsuccess = (event) => {
        for (const key of event.target.result) {
          if (key === BACKGROUNDS_KEY) continue;
          const stamp = Number(key);
          if (key === LEGACY_SHOT_KEY || (Number.isFinite(stamp) && stamp < cutoff)) {
            store.delete(key);
          }
        }
      };
      return store.put({ blob, ...meta, id }, id);
    });
    return id;
  },
  load: (id) =>
    runShotTransaction("readonly", (store) =>
      store.get(id ?? LEGACY_SHOT_KEY),
    ),

  // Background images are kept as a list so they are still there next capture.
  saveBackgrounds: (images) =>
    runShotTransaction("readwrite", (store) => store.put(images, BACKGROUNDS_KEY)),
  loadBackgrounds: async () => {
    const images = await runShotTransaction("readonly", (store) =>
      store.get(BACKGROUNDS_KEY),
    );
    return Array.isArray(images) ? images : [];
  },
};

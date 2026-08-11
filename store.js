// Hands a captured PNG from the popup to the editor tab.
// IndexedDB, not chrome.storage, because full-page PNGs blow past the 10 MB quota.
const SHOT_DB = "full-page-screenshot";
const SHOT_STORE = "shots";
const SHOT_KEY = "latest";

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
  save: (blob, meta = {}) =>
    runShotTransaction("readwrite", (store) =>
      store.put({ blob, ...meta }, SHOT_KEY),
    ),
  load: () => runShotTransaction("readonly", (store) => store.get(SHOT_KEY)),

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

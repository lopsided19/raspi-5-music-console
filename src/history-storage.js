const DATABASE_NAME = "music-console-history";
const DATABASE_VERSION = 1;
const STORE_NAME = "sessions";
const ACTIVE_SESSION_KEY = "active";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

function transactionCompletion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error), { once: true });
  });
}

async function openDatabase() {
  if (!("indexedDB" in globalThis)) return null;
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.addEventListener("upgradeneeded", () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
  }, { once: true });
  return requestResult(request);
}

export async function loadHistorySession(sessionKey = ACTIVE_SESSION_KEY) {
  const database = await openDatabase();
  if (!database) return null;
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    return await requestResult(transaction.objectStore(STORE_NAME).get(sessionKey));
  } finally {
    database.close();
  }
}

export async function saveHistorySession(session, sessionKey = ACTIVE_SESSION_KEY) {
  const database = await openDatabase();
  if (!database) return false;
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completed = transactionCompletion(transaction);
    await requestResult(transaction.objectStore(STORE_NAME).put(session, sessionKey));
    await completed;
    return true;
  } finally {
    database.close();
  }
}

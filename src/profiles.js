export const PROFILE_STORAGE_KEY = "music-console-profiles-v1";
export const ACTIVE_PROFILE_STORAGE_KEY = "music-console-active-profile-v1";
export const TUTORIAL_VERSION = 1;

const PIN_ITERATIONS = 60000;
const textEncoder = new TextEncoder();

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function cleanProfile(rawProfile) {
  if (!rawProfile || typeof rawProfile !== "object") return null;
  const id = String(rawProfile.id ?? "").trim();
  const name = String(rawProfile.name ?? "").trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    nameKey: normalizedProfileName(name),
    createdAt: String(rawProfile.createdAt ?? new Date(0).toISOString()),
    pinSalt: typeof rawProfile.pinSalt === "string" ? rawProfile.pinSalt : null,
    pinHash: typeof rawProfile.pinHash === "string" ? rawProfile.pinHash : null,
    tutorial: normalizeTutorialProgress(rawProfile.tutorial),
  };
}

export function normalizedProfileName(name) {
  return String(name ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

export function validateProfileName(name) {
  const normalized = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "请输入昵称";
  if (normalized.length > 16) return "昵称最多 16 个字符";
  return "";
}

export function validatePin(pin) {
  const value = String(pin ?? "");
  if (!value) return "";
  return /^\d{4,8}$/.test(value) ? "" : "PIN 必须是 4～8 位数字";
}

export function normalizeTutorialProgress(rawProgress) {
  const status = ["not-started", "in-progress", "completed", "skipped"].includes(rawProgress?.status)
    ? rawProgress.status
    : "not-started";
  return {
    version: Number(rawProgress?.version) || TUTORIAL_VERSION,
    status,
    step: Math.max(0, Number.parseInt(rawProgress?.step, 10) || 0),
    chordProgress: Math.max(0, Number.parseInt(rawProgress?.chordProgress, 10) || 0),
    completedAt: typeof rawProgress?.completedAt === "string" ? rawProgress.completedAt : null,
  };
}

export function loadProfiles(storage = localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(PROFILE_STORAGE_KEY) ?? "null");
    if (!Array.isArray(parsed?.profiles)) return [];
    return parsed.profiles.map(cleanProfile).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveProfiles(profiles, storage = localStorage) {
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ version: 1, profiles }));
}

export function activeProfileId(storage = localStorage) {
  return storage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
}

export function setActiveProfileId(profileId, storage = localStorage) {
  storage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId);
}

export function clearActiveProfileId(storage = localStorage) {
  storage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
}

async function derivePinHash(pin, salt, cryptoImpl) {
  const key = await cryptoImpl.subtle.importKey(
    "raw",
    textEncoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await cryptoImpl.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations: PIN_ITERATIONS,
  }, key, 256);
  return bytesToBase64(new Uint8Array(bits));
}

export async function createProfile(name, pin = "", {
  cryptoImpl = globalThis.crypto,
  now = () => new Date(),
} = {}) {
  const cleanName = String(name).trim().replace(/\s+/g, " ");
  const nameError = validateProfileName(cleanName);
  if (nameError) throw new RangeError(nameError);
  const pinError = validatePin(pin);
  if (pinError) throw new RangeError(pinError);

  const id = cryptoImpl.randomUUID?.() ?? bytesToBase64(cryptoImpl.getRandomValues(new Uint8Array(12)))
    .replace(/[+/=]/g, "");
  let pinSalt = null;
  let pinHash = null;
  if (pin) {
    const salt = cryptoImpl.getRandomValues(new Uint8Array(16));
    pinSalt = bytesToBase64(salt);
    pinHash = await derivePinHash(pin, salt, cryptoImpl);
  }

  return {
    id,
    name: cleanName,
    nameKey: normalizedProfileName(cleanName),
    createdAt: now().toISOString(),
    pinSalt,
    pinHash,
    tutorial: normalizeTutorialProgress(null),
  };
}

export async function verifyProfilePin(profile, pin = "", cryptoImpl = globalThis.crypto) {
  if (!profile.pinHash || !profile.pinSalt) return String(pin) === "";
  const candidate = await derivePinHash(String(pin), base64ToBytes(profile.pinSalt), cryptoImpl);
  return candidate === profile.pinHash;
}

export function replaceProfile(profiles, nextProfile) {
  return profiles.map((profile) => profile.id === nextProfile.id ? nextProfile : profile);
}

export function scopedStorageKey(baseKey, profileId) {
  return `${baseKey}:user:${profileId}`;
}

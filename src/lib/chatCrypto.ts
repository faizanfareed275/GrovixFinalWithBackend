import { idbGet, idbPut } from "@/lib/idb";

function bufToB64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBuf(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function textToBuf(text: string) {
  return new TextEncoder().encode(text).buffer;
}

function bufToText(buf: ArrayBuffer) {
  return new TextDecoder().decode(new Uint8Array(buf));
}

async function deriveBackupKey(passphrase: string, salt: Uint8Array) {
  const baseKey = await crypto.subtle.importKey("raw", textToBuf(passphrase), { name: "PBKDF2" }, false, ["deriveKey"]);
  const saltBuf = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuf).set(salt);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuf,
      iterations: 200_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function exportDeviceKeyBackup(passphrase: string) {
  const deviceId = getOrCreateDeviceId();
  const stored = await idbGet<any>("device_keys", deviceId);
  if (!stored?.privateJwk || !stored?.publicJwk) throw new Error("no_device_keys");

  const payload = {
    v: 1,
    deviceId,
    privateJwk: stored.privateJwk,
    publicJwk: stored.publicJwk,
    createdAt: Date.now(),
  };

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await deriveBackupKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textToBuf(JSON.stringify(payload)));

  return JSON.stringify({
    v: 1,
    saltB64: bufToB64(salt.buffer),
    ivB64: bufToB64(iv.buffer),
    ciphertextB64: bufToB64(ct),
  });
}

export async function importDeviceKeyBackup(passphrase: string, backupJson: string) {
  const parsed = JSON.parse(backupJson);
  if (!parsed || parsed.v !== 1) throw new Error("invalid_backup");
  const salt = new Uint8Array(b64ToBuf(String(parsed.saltB64 || "")));
  const iv = new Uint8Array(b64ToBuf(String(parsed.ivB64 || "")));
  const ciphertextB64 = String(parsed.ciphertextB64 || "");
  if (!salt.length || !iv.length || !ciphertextB64) throw new Error("invalid_backup");

  const key = await deriveBackupKey(passphrase, salt);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, b64ToBuf(ciphertextB64));
  const data = JSON.parse(bufToText(pt));

  const deviceId = String(data?.deviceId || "");
  const privateJwk = data?.privateJwk;
  const publicJwk = data?.publicJwk;
  if (!deviceId || !privateJwk || !publicJwk) throw new Error("invalid_backup");

  localStorage.setItem("grovix_device_id", deviceId);
  await idbPut("device_keys", { deviceId, publicJwk, privateJwk, updatedAt: Date.now() });
  return { deviceId };
}

export function getOrCreateDeviceId() {
  const k = "grovix_device_id";
  const existing = localStorage.getItem(k);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(k, next);
  return next;
}

export async function getOrCreateDeviceKeyPair(deviceId: string) {
  const stored = await idbGet<any>("device_keys", deviceId);
  if (stored?.privateJwk && stored?.publicJwk) {
    return { privateJwk: stored.privateJwk, publicJwk: stored.publicJwk };
  }

  const kp = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);

  await idbPut("device_keys", { deviceId, publicJwk, privateJwk, updatedAt: Date.now() });

  return { privateJwk, publicJwk };
}

export async function importPrivateKey(privateJwk: JsonWebKey) {
  return crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

export async function importPublicKey(publicJwk: JsonWebKey) {
  return crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export function generateRoomKeyRawB64() {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  return bufToB64(raw.buffer);
}

export async function encryptRoomKeyForDevice(roomKeyRawB64: string, devicePublicJwk: JsonWebKey) {
  const pub = await importPublicKey(devicePublicJwk);
  const enc = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, b64ToBuf(roomKeyRawB64));
  return { encryptedKeyB64: bufToB64(enc) };
}

export async function decryptRoomKeyForMe(encryptedKeyB64: string, privateJwk: JsonWebKey) {
  const priv = await importPrivateKey(privateJwk);
  const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, b64ToBuf(encryptedKeyB64));
  return bufToB64(raw);
}

export async function loadRoomKey(conversationId: string) {
  const item = await idbGet<any>("room_keys", conversationId);
  return item?.roomKeyRawB64 ? String(item.roomKeyRawB64) : null;
}

export async function saveRoomKey(conversationId: string, roomKeyRawB64: string) {
  await idbPut("room_keys", { conversationId, roomKeyRawB64, updatedAt: Date.now() });
}

export async function encryptMessage(roomKeyRawB64: string, plaintext: string) {
  const key = await crypto.subtle.importKey("raw", b64ToBuf(roomKeyRawB64), { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textToBuf(plaintext));
  return { ivB64: bufToB64(iv.buffer), ciphertextB64: bufToB64(ct) };
}

export async function decryptMessage(roomKeyRawB64: string, ivB64: string, ciphertextB64: string) {
  const key = await crypto.subtle.importKey("raw", b64ToBuf(roomKeyRawB64), { name: "AES-GCM" }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(b64ToBuf(ivB64)) }, key, b64ToBuf(ciphertextB64));
  return bufToText(pt);
}

export type EncryptedValue = {
  v: 1;
  iv: string;
  ciphertext: string;
};

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(value: string): Uint8Array {
  const s = atob(value);
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function importKey(encoded: string): Promise<CryptoKey> {
  const raw = b64decode(encoded);
  if (raw.byteLength !== 32) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must be a base64 encoded 32-byte key");
  }
  return crypto.subtle.importKey("raw", toArrayBuffer(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptString(value: string, encodedKey: string): Promise<EncryptedValue> {
  const key = await importKey(encodedKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(value);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(plaintext)));
  return { v: 1, iv: b64encode(iv), ciphertext: b64encode(ciphertext) };
}

export async function decryptString(value: EncryptedValue, encodedKey: string): Promise<string> {
  if (value.v !== 1) throw new Error("Unsupported encrypted value version");
  const key = await importKey(encodedKey);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(b64decode(value.iv)) },
    key,
    toArrayBuffer(b64decode(value.ciphertext)),
  );
  return new TextDecoder().decode(plaintext);
}

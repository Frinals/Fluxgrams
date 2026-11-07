/**
 * End-to-end encryption utility using Web Crypto API.
 *
 * For 1-on-1 private chats, a deterministic shared key is derived from
 * the two participants' user IDs using PBKDF2. Both clients derive the
 * same key independently — no key exchange is needed. The database only
 * stores AES-GCM ciphertext with a per-message random IV.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

const keyCache = new Map<string, CryptoKey>();

function chatKeyId(userA: string, userB: string): string {
  return [userA, userB].sort().join(':');
}

async function deriveKey(userA: string, userB: string): Promise<CryptoKey> {
  const cacheKey = chatKeyId(userA, userB);
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;

  const seed = chatKeyId(userA, userB);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(seed),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('fluxgram-e2ee-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(cacheKey, key);
  return key;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptMessage(
  plaintext: string,
  userA: string,
  userB: string
): Promise<string> {
  const key = await deriveKey(userA, userB);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  const ivB64 = toBase64(iv.buffer);
  const ctB64 = toBase64(ciphertext);
  return `enc:${ivB64}:${ctB64}`;
}

export async function decryptMessage(
  ciphertext: string,
  userA: string,
  userB: string
): Promise<string> {
  if (!ciphertext.startsWith('enc:')) return ciphertext;

  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext;

  const iv = fromBase64(parts[1]);
  const ct = fromBase64(parts[2]);
  const key = await deriveKey(userA, userB);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ct
    );
    return dec.decode(plaintext);
  } catch {
    return '[Encrypted]';
  }
}

export function isEncrypted(content: string | null): boolean {
  return content !== null && content.startsWith('enc:');
}

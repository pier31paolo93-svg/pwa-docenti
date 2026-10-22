import Dexie, { type EntityTable } from "dexie";
type Envelope = {
  key: string;
  owner: string;
  iv: ArrayBuffer;
  cipher: ArrayBuffer;
  expires: number;
};
type KeyRow = { owner: string; key: CryptoKey };
export class VaultDatabase extends Dexie {
  records!: EntityTable<Envelope, "key">;
  keys!: EntityTable<KeyRow, "owner">;
  constructor(name = "quaderno-vault-v1") {
    super(name);
    this.version(1).stores({ records: "key,owner,expires", keys: "owner" });
  }
}
export const vaultDb = new VaultDatabase();
const TTL = 8 * 60 * 60 * 1000;
const pendingKeys = new Map<string, Promise<CryptoKey>>();
async function createKey(owner: string): Promise<CryptoKey> {
  const found = await vaultDb.keys.get(owner);
  if (found) return found.key;
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return vaultDb.transaction("rw", vaultDb.keys, async () => {
    const existing = await vaultDb.keys.get(owner);
    if (existing) return existing.key;
    await vaultDb.keys.add({ owner, key });
    return key;
  });
}
function keyFor(owner: string): Promise<CryptoKey> {
  const existing = pendingKeys.get(owner);
  if (existing) return existing;
  const pending = createKey(owner).finally(() => pendingKeys.delete(owner));
  pendingKeys.set(owner, pending);
  return pending;
}
const epochs = new Map<string, number>();
export async function seal(
  owner: string,
  key: string,
  value: unknown,
  expires = Date.now() + TTL,
): Promise<void> {
  const epoch = epochs.get(owner) ?? 0;
  const secret = await keyFor(owner);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const input = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(owner + "|" + key),
    },
    secret,
    input,
  );
  if ((epochs.get(owner) ?? 0) !== epoch) return;
  await vaultDb.transaction("rw", vaultDb.records, async () => {
    if ((epochs.get(owner) ?? 0) === epoch)
      await vaultDb.records.put({ key, owner, iv: iv.buffer, cipher, expires });
  });
}
export async function unseal<T>(
  owner: string,
  key: string,
): Promise<T | undefined> {
  const record = await vaultDb.records.get(key);
  if (!record || record.owner !== owner) return;
  if (record.expires < Date.now()) {
    await vaultDb.records.delete(key);
    return;
  }
  const secret = await vaultDb.keys.get(owner);
  if (!secret) return;
  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(record.iv),
        additionalData: new TextEncoder().encode(owner + "|" + key),
      },
      secret.key,
      record.cipher,
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return;
  }
}
export async function purge(owner: string) {
  epochs.set(owner, (epochs.get(owner) ?? 0) + 1);
  localStorage.removeItem("offline:" + owner);
  await pendingKeys.get(owner);
  await vaultDb.transaction("rw", vaultDb.records, vaultDb.keys, async () => {
    await vaultDb.records.where("owner").equals(owner).delete();
    await vaultDb.keys.delete(owner);
  });
}
export function consent(owner: string) {
  return localStorage.getItem("offline:" + owner) === "yes";
}

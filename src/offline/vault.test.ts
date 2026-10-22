import { afterEach, describe, it, expect } from "vitest";
import { seal, unseal, purge, vaultDb } from "./vault";
afterEach(async () => {
  await vaultDb.records.clear();
  await vaultDb.keys.clear();
  localStorage.clear();
});
describe("Encrypted offline storage", () => {
  it("separates owners and does not persist plaintext", async () => {
    await seal("a", "a|students", { name: "Fittizio" });
    expect(await unseal("a", "a|students")).toEqual({ name: "Fittizio" });
    expect(await unseal("b", "a|students")).toBeUndefined();
    const r = await vaultDb.records.get("a|students");
    expect(JSON.stringify(r)).not.toContain("Fittizio");
    expect((await vaultDb.keys.get("a"))!.key.extractable).toBe(false);
  });
  it("retains all initial concurrent writes with one owner key", async () => {
    await Promise.all(
      Array.from({ length: 30 }, (_, i) => seal("a", "a|" + i, { i })),
    );
    for (let i = 0; i < 30; i++)
      expect(await unseal("a", "a|" + i)).toEqual({ i });
  });
  it("expires cached data", async () => {
    await seal("a", "a|old", { value: 1 }, Date.now() - 1);
    expect(await unseal("a", "a|old")).toBeUndefined();
    expect(await vaultDb.records.get("a|old")).toBeUndefined();
  });
  it("purges only the signed-out owner", async () => {
    await seal("a", "a|row", { x: 1 });
    await seal("b", "b|row", { x: 2 });
    localStorage.setItem("offline:a", "yes");
    await purge("a");
    expect(await unseal("a", "a|row")).toBeUndefined();
    expect(await vaultDb.keys.get("a")).toBeUndefined();
    expect(await unseal("b", "b|row")).toEqual({ x: 2 });
    expect(localStorage.getItem("offline:a")).toBeNull();
  });
  it("rejects tampered ciphertext", async () => {
    await seal("a", "a|row", { x: 1 });
    const r = (await vaultDb.records.get("a|row"))!;
    const altered = new Uint8Array(r.cipher);
    altered[0] ^= 1;
    await vaultDb.records.update(r.key, { cipher: altered.buffer });
    expect(await unseal("a", "a|row")).toBeUndefined();
  });
});

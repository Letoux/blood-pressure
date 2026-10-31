import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApi, type TestApi } from "@/server/testing/test-api";
import { ensureVapidKeys } from "./vapid";

describe("clés VAPID de l'instance", () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await createTestApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it("sont générées au premier démarrage, puis réutilisées aux démarrages suivants", async () => {
    const first = await ensureVapidKeys(api.db);
    // Clé publique P-256 non compressée, en base64url : 65 octets, soit 87 caractères.
    expect(first.publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/);
    expect(first.privateKey).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // Un redémarrage relit la base : les mêmes clés, sans en générer de nouvelles.
    const generated: string[] = [];
    const afterRestart = await ensureVapidKeys(api.db, () => {
      generated.push("appel");
      return { publicKey: "autre", privateKey: "autre" };
    });
    expect(afterRestart).toEqual(first);
    expect(generated).toEqual([]);
  });

  it("deux démarrages simultanés (app et worker) obtiennent les mêmes clés", async () => {
    const [a, b] = await Promise.all([ensureVapidKeys(api.db), ensureVapidKeys(api.db)]);
    expect(a).toEqual(b);
  });
});

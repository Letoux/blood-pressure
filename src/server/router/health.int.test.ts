import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

describe("health", () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await createTestApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it("répond « ok » quand la base de données répond", async () => {
    await expect(api.client.health()).resolves.toEqual({ status: "ok" });
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApi, type TestApi } from "@/server/testing/test-api";
import { handleRpc, RPC_MAX_BODY_BYTES } from "./rpc-handler";

/** La route `/rpc` lit tout le corps avant le routage, même pour une procédure anonyme. */
describe("route HTTP /rpc", () => {
  let api: TestApi;

  const post = (path: string, body: string) =>
    handleRpc(
      new Request(`http://localhost:3000/rpc${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
      { db: api.db, auth: api.auth, headers: new Headers() },
    );

  beforeAll(async () => {
    api = await createTestApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it("répond à une procédure anonyme", async () => {
    const response = await post("/signUpOpen", JSON.stringify({}));
    expect(response.status).toBe(200);
  });

  it("refuse un corps trop gros (413) sans le lire en entier", async () => {
    const huge = JSON.stringify({ json: "x".repeat(RPC_MAX_BODY_BYTES + 1) });
    const response = await post("/signUpOpen", huge);
    expect(response.status).toBe(413);
  });

  it("accepte une requête qui n'est pas une instance native de Request (Next.js sous Node 24)", async () => {
    // La requête que Next.js passe à la route n'est pas toujours une `Request` native : la
    // recopier avec `new Request(requête, init)` échouait (« Cannot read private member #state »).
    const native = new Request("http://localhost:3000/rpc/signUpOpen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const foreign = new Proxy(native, {
      get: (target, property) => {
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    const response = await handleRpc(foreign, { db: api.db, auth: api.auth, headers: new Headers() });

    expect(response.status).toBe(200);
  });

  it("répond 404 hors du routeur", async () => {
    const response = await post("/inconnue", JSON.stringify({}));
    expect(response.status).toBe(404);
  });
});

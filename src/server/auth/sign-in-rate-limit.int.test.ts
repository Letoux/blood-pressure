import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApi, type TestApi } from "@/server/testing/test-api";
import { SIGN_IN_RATE_LIMIT } from "./create-auth";

/**
 * Limite de connexions derrière le reverse proxy (Nginx Proxy Manager) : il ajoute l'IP du client à
 * droite de `X-Forwarded-For` (`$proxy_add_x_forwarded_for`), après ce que le client a envoyé.
 * Seule cette dernière valeur est fiable : la limite doit s'appliquer par IP réelle, sans qu'un
 * attaquant puisse la contourner en variant la valeur de gauche ni épuiser celle des autres.
 */
describe("limite de connexions par IP derrière le reverse proxy", () => {
  let api: TestApi;

  const signIn = (forwardedFor: string) =>
    api.authRequest("/sign-in/email", {
      body: { email: "personne@example.org", password: "mauvais-mot-de-passe" },
      headers: { "x-forwarded-for": forwardedFor },
    });

  beforeAll(async () => {
    api = await createTestApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it("un attaquant qui varie l'IP de gauche est limité sur son IP réelle", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt <= SIGN_IN_RATE_LIMIT.max; attempt++) {
      statuses.push((await signIn(`10.0.0.${attempt}, 203.0.113.66`)).status);
    }
    expect(statuses.at(-1)).toBe(429);
  });

  it("un autre client n'est pas bloqué par l'attaquant", async () => {
    const response = await signIn("10.9.9.9, 198.51.100.7");
    expect(response.status).not.toBe(429);
  });
});

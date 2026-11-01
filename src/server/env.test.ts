import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAuthEnv } from "./env";

/** Variables du `.env.template` livré avec chaque release. */
function templateValues(): Record<string, string> {
  const text = readFileSync(new URL("../../.env.template", import.meta.url), "utf8");
  return Object.fromEntries(
    text
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
}

const valid = {
  APP_URL: "https://tension.example.org",
  BETTER_AUTH_SECRET: "9f2c4e1a7b3d5f6a8c0e2b4d6f8a1c3e5b7d9f0a",
  ADMIN_EMAIL: "admin@example.org",
  ADMIN_PASSWORD: "un-vrai-mot-de-passe",
};

describe("variables de l'authentification", () => {
  it("acceptent des valeurs choisies par l'opérateur", () => {
    expect(parseAuthEnv(valid)).toEqual({ ...valid, TRUSTED_PROXIES: [] });
  });

  it("lisent TRUSTED_PROXIES comme une liste séparée par des virgules", () => {
    expect(parseAuthEnv({ ...valid, TRUSTED_PROXIES: " 192.0.2.10, 10.0.0.0/24 ," }).TRUSTED_PROXIES).toEqual([
      "192.0.2.10",
      "10.0.0.0/24",
    ]);
  });

  it("refusent le mot de passe admin d'exemple du .env.template", () => {
    const template = templateValues();
    expect(() => parseAuthEnv({ ...valid, ADMIN_PASSWORD: template.ADMIN_PASSWORD })).toThrow(/ADMIN_PASSWORD/);
  });

  it("refusent la clé de signature d'exemple du .env.template", () => {
    const template = templateValues();
    expect(() => parseAuthEnv({ ...valid, BETTER_AUTH_SECRET: template.BETTER_AUTH_SECRET })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("refusent toute valeur restée « remplacer-… »", () => {
    expect(() => parseAuthEnv({ ...valid, ADMIN_PASSWORD: "remplacer-plus-tard-svp" })).toThrow(/ADMIN_PASSWORD/);
  });
});

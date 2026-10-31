import { describe, expect, it } from "vitest";
import { resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it("applique la langue enregistrée par l'utilisateur, quelle que soit celle du navigateur", () => {
    expect(resolveLocale({ saved: "en", acceptLanguage: "fr-FR,fr;q=0.9" })).toBe("en");
    expect(resolveLocale({ saved: "fr", acceptLanguage: "en-US,en;q=0.9" })).toBe("fr");
  });

  it("sans langue enregistrée, suit le navigateur", () => {
    expect(resolveLocale({ saved: null, acceptLanguage: "en-GB,en;q=0.9,fr;q=0.8" })).toBe("en");
    expect(resolveLocale({ saved: null, acceptLanguage: "fr-CA" })).toBe("fr");
  });

  it("retient la première langue du navigateur qui est disponible, par ordre de préférence", () => {
    expect(resolveLocale({ saved: null, acceptLanguage: "de-DE,de;q=0.9,en;q=0.8,fr;q=0.7" })).toBe("en");
    expect(resolveLocale({ saved: null, acceptLanguage: "fr;q=0.5,en;q=0.9" })).toBe("en");
  });

  it("par défaut, le français", () => {
    expect(resolveLocale({ saved: null, acceptLanguage: null })).toBe("fr");
    expect(resolveLocale({ saved: null, acceptLanguage: "de-DE,es;q=0.8" })).toBe("fr");
    expect(resolveLocale({ saved: null, acceptLanguage: "*" })).toBe("fr");
  });
});

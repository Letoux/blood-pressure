import { describe, expect, it } from "vitest";
import { parsePushMessage } from "./push-message";

describe("message reçu par le service worker", () => {
  it("lit le titre, le texte, la page à ouvrir et le tag", () => {
    expect(
      parsePushMessage(JSON.stringify({ title: "Rappel", body: "Mesure du matin", url: "/entry", tag: "slot" }), "App"),
    ).toEqual({ title: "Rappel", body: "Mesure du matin", url: "/entry", tag: "slot" });
  });

  it("un message illisible ou vide donne une notification générique qui ouvre l'accueil", () => {
    for (const text of [null, "", "pas du json", "42"]) {
      expect(parsePushMessage(text, "Tension")).toEqual({ title: "Tension", body: "", url: "/" });
    }
  });

  it("n'ouvre jamais une page hors de l'app", () => {
    for (const url of ["https://evil.example", "//evil.example/x", "javascript:alert(1)", "entry"]) {
      expect(parsePushMessage(JSON.stringify({ title: "T", url }), "App").url, url).toBe("/");
    }
  });
});
